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
        // 血条
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'red'; ctx.fillRect(this.x-10, this.y-20, 20, 4);
        ctx.fillStyle = '#0f0'; ctx.fillRect(this.x-10, this.y-20, 20 * hpPct, 4);
        
        // 塔身
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
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
        ctx.fillRect(this.x-3, this.y-8, 6, 16);
        ctx.fillRect(this.x-8, this.y-3, 16, 6);
    }
}

// --- 金钱塔 ---
export class MoneyTower extends Tower {
    constructor(x, y, config) {
        super(x, y, config);
        this.goldRate = 8; // 每秒8金币
        this.timer = 0;
    }

    update(dt, game) {
        if (this.hp <= 0) return;
        this.timer += dt;
        if (this.timer >= 1.0) {
            this.timer -= 1.0;
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
}