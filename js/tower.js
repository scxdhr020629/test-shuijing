import { MathUtils } from './utils.js';
import { Projectile } from './projectile.js';

// --- 基类 ---
export class Tower {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.name = config.name;
        this.range = config.range;
        this.damage = config.damage;
        this.cooldownTime = config.cooldown;
        this.currentCooldown = 0;
        this.color = config.color;
        this.maxHp = config.hp;
        this.hp = this.maxHp;
        this.cost = config.cost;
        this.radius = 15;
        
        this.projectileSpeed = config.projectileSpeed || 300;
        this.projectileColor = config.projectileColor || this.color;
    }

    update(dt, game) {
        if (this.hp <= 0) return; // 死亡
        if (this.currentCooldown > 0) this.currentCooldown -= dt;

        if (this.currentCooldown <= 0) {
            const target = this.findTarget(game.entities.enemies);
            if (target) {
                this.attack(target, game);
                this.currentCooldown = this.cooldownTime;
            }
        }
    }

    findTarget(enemies) {
        let target = null;
        let minDst = Infinity;
        for (let e of enemies) {
            const dst = MathUtils.getDistance(this.x, this.y, e.x, e.y);
            if (dst <= this.range && dst < minDst) {
                minDst = dst;
                target = e;
            }
        }
        return target;
    }

    attack(target, game) {
        // 默认攻击：发射子弹
        game.entities.projectiles.push(new Projectile(this.x, this.y, target, {
            damage: this.damage,
            speed: this.projectileSpeed,
            color: this.projectileColor,
            type: 'normal'
        }));
    }

    takeDamage(amount) {
        this.hp -= amount;
    }

    draw(ctx) {
        // 1. 绘制底座
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 2. 绘制塔身
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
        
        // 3. 绘制高光/立体感
        const grad = ctx.createRadialGradient(this.x - 5, this.y - 5, 2, this.x, this.y, this.radius);
        grad.addColorStop(0, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(0,0,0,0.1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();

        // 4. 绘制炮塔/核心 (简单的通用样式)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI*2);
        ctx.fill();

        // 血条
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'red'; ctx.fillRect(this.x-12, this.y-24, 24, 4);
        ctx.fillStyle = '#0f0'; ctx.fillRect(this.x-12, this.y-24, 24 * hpPct, 4);
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.strokeRect(this.x-12, this.y-24, 24, 4);
    }
}

// --- 特殊塔 ---

export class FlameTower extends Tower {
    attack(target, game) {
        game.entities.projectiles.push(new Projectile(this.x, this.y, target, {
            damage: this.damage,
            speed: this.projectileSpeed,
            color: 'orange',
            type: 'flame' // 特殊类型
        }));
    }

    draw(ctx) {
        super.draw(ctx);
        // 火焰图标
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 8);
        ctx.quadraticCurveTo(this.x + 8, this.y, this.x + 4, this.y + 6);
        ctx.quadraticCurveTo(this.x, this.y + 2, this.x - 4, this.y + 6);
        ctx.quadraticCurveTo(this.x - 8, this.y, this.x, this.y - 8);
        ctx.fill();
    }
}

export class LaserTower extends Tower {
    attack(target, game) {
        const angle = MathUtils.getAngle(this.x, this.y, target.x, target.y);
        const endX = this.x + Math.cos(angle) * this.range;
        const endY = this.y + Math.sin(angle) * this.range;

        // 视觉特效
        game.entities.effects.push({type: 'beam', x1:this.x, y1:this.y, x2:endX, y2:endY, color:'rgba(255,0,0,0.8)', life:0.15});

        // 穿透伤害
        game.entities.enemies.forEach(e => {
            if (MathUtils.distToSegment(e, this, {x: endX, y: endY}) < e.radius + 10) {
                e.takeDamage(this.damage);
            }
        });
    }

    draw(ctx) {
        super.draw(ctx);
        // 激光核心
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI*2);
        ctx.stroke();
    }
}

export class TeslaTower extends Tower {
    attack(target, game) {
        let chain = [target];
        let curr = target;
        // 闪电链逻辑
        for(let i=0; i<3; i++) {
            let next = game.entities.enemies.find(e => !chain.includes(e) && MathUtils.getDistance(curr.x, curr.y, e.x, e.y) < 150);
            if(next) { chain.push(next); curr = next; } else break;
        }

        let startObj = this;
        chain.forEach(hit => {
            hit.takeDamage(this.damage);
            game.entities.effects.push({type: 'lightning', x1:startObj.x, y1:startObj.y, x2:hit.x, y2:hit.y, color:'#8af', life:0.15});
            startObj = hit;
        });
    }

    draw(ctx) {
        super.draw(ctx);
        // 电圈
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI*2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
}

export class HealerTower extends Tower {
    constructor(x, y, config) {
        super(x, y, config);
        this.range = 150; // 固定范围
    }

    // 覆写 update，因为它是给塔回血，不是打怪
    update(dt, game) {
        if (this.hp <= 0) return;
        if (this.currentCooldown > 0) this.currentCooldown -= dt;

        if (this.currentCooldown <= 0) {
            // 找受伤的塔
            let target = game.entities.towers.find(t => t !== this && t.hp < t.maxHp && MathUtils.getDistance(this.x, this.y, t.x, t.y) < this.range);
            if (target) {
                target.hp = Math.min(target.maxHp, target.hp + this.damage); // damage即治疗量
                game.entities.effects.push({type: 'line', x1:this.x, y1:this.y, x2:target.x, y2:target.y, color:'#0ff', life:0.2});
                this.currentCooldown = this.cooldownTime;
            }
        }
    }
    
    draw(ctx) {
        super.draw(ctx); // 绘制血条和底座
        // 绘制十字标
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'white';
        ctx.fillRect(this.x-3, this.y-8, 6, 16);
        ctx.fillRect(this.x-8, this.y-3, 16, 6);
        ctx.shadowBlur = 0;
    }
}

// --- 金钱塔 ---
export class MoneyTower extends Tower {
    constructor(x, y, config) {
        super(x, y, config);
        this.goldRate = 3; // 每次3金币
        this.timer = 0;
        this.interval = 5.0; // 间隔5秒
    }

    update(dt, game) {
        if (this.hp <= 0) return;
        this.timer += dt;
        if (this.timer >= this.interval) {
            this.timer -= this.interval;
            game.state.gold += this.goldRate;
            // 飘字特效
            game.entities.effects.push({
                type: 'text', x: this.x, y: this.y - 20, 
                text: `+$${this.goldRate}`, color: 'gold', life: 1.0, vy: -20
            });
        }
        
        // 辅助攻击 (低伤害)
        super.update(dt, game);
    }

    draw(ctx) {
        super.draw(ctx);
        // 金币符号
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', this.x, this.y + 1);
    }
}

// --- 黑洞塔 ---
export class BlackHoleTower extends Tower {
    attack(target, game) {
        // 制造黑洞特效
        game.entities.effects.push({
            type: 'blackhole', x: target.x, y: target.y, 
            radius: 100, life: 1.0
        });
        
        // 吸附周围敌人
        game.entities.enemies.forEach(e => {
            const dist = MathUtils.getDistance(target.x, target.y, e.x, e.y);
            if (dist < 150) {
                e.takeDamage(this.damage);
                // 强力吸附位移
                const angle = MathUtils.getAngle(e.x, e.y, target.x, target.y);
                e.x += Math.cos(angle) * 100; // 增加吸附力度
                e.y += Math.sin(angle) * 100;
            }
        });
    }

    draw(ctx) {
        super.draw(ctx);
        // 黑洞核心
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#9c27b0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI*2);
        ctx.stroke();
    }
}