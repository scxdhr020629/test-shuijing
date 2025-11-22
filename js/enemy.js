import { MathUtils } from './utils.js';
import { Projectile } from './projectile.js';

// --- 基类 ---
export class Enemy {
    constructor(x, y, wave) {
        this.x = x;
        this.y = y;
        this.wave = wave;
        this.radius = 12;
        this.speed = 50;
        this.hp = 30 + (wave * 5);
        this.maxHp = this.hp;
        this.damage = 10;
        this.color = 'red';
        this.burnTimer = 0;
        this.markedForDeletion = false;
        this.isFlying = false; // 默认不仅是飞行
        this.name = '普通怪';
    }

    update(dt, game) {
        const crystal = game.state.crystal;
        const towers = game.entities.towers;

        // 燃烧效果
        if (this.burnTimer > 0) {
            this.hp -= 10 * dt;
            this.burnTimer -= dt;
        }

        // 移动
        const angle = MathUtils.getAngle(this.x, this.y, crystal.x, crystal.y);
        
        // 碰撞逻辑 (基类处理与防御塔的碰撞)
        let moveSpeed = this.speed;
        if (!this.isFlying) {
            for (let t of towers) {
                if (MathUtils.getDistance(this.x, this.y, t.x, t.y) < (this.radius + t.radius)) {
                    t.takeDamage(5 * dt); // 咬塔
                    moveSpeed = 0; // 被塔挡住
                    // 简单的滑步排斥
                    this.x -= Math.cos(angle) * 1;
                    this.y -= Math.sin(angle) * 1;
                }
            }
        }

        this.x += Math.cos(angle) * moveSpeed * dt;
        this.y += Math.sin(angle) * moveSpeed * dt;

        // 攻击水晶
        if (MathUtils.getDistance(this.x, this.y, crystal.x, crystal.y) < crystal.radius + this.radius) {
            crystal.takeDamage(this.damage);
            this.markedForDeletion = true;
        }

        if (this.hp <= 0) this.markedForDeletion = true;
    }

    takeDamage(amount) {
        this.hp -= amount;
    }

    onDeath(game) {
        // 默认无行为
    }

    applyBurn(duration) {
        this.burnTimer = duration;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        if (this.burnTimer > 0) {
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// --- 飞行怪 ---
export class FlyingEnemy extends Enemy {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.speed = 80;
        this.radius = 10;
        this.color = '#ffd700'; // 黄色
        this.hp *= 0.6;
        this.isFlying = true; // 开启飞行模式
        this.name = '飞行怪';
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y);
        ctx.lineTo(this.x - 5, this.y + 8);
        ctx.lineTo(this.x - 5, this.y - 8);
        ctx.fill();
    }
}

// --- 自爆怪 ---
export class ExploderEnemy extends Enemy {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.speed = 35;
        this.hp *= 1.5;
        this.color = '#222';
        this.radius = 15;
        this.name = '自爆怪';
    }
    
    update(dt, game) {
        super.update(dt, game);
        const towers = game.entities.towers;
        // 自爆检测
        for(let t of towers) {
            if(MathUtils.getDistance(this.x, this.y, t.x, t.y) < 60) {
                t.takeDamage(100); // 炸塔
                this.hp = 0; // 立即死亡触发AOE（需要在Game里处理死亡爆炸逻辑，或者在这里回调）
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        // 画个红点表示危险
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    onDeath(game) {
        // 死亡爆炸
        game.entities.towers.forEach(t => {
            if (MathUtils.getDistance(this.x, this.y, t.x, t.y) < 100) {
                t.takeDamage(50);
            }
        });
        game.entities.enemies.forEach(e => {
            if (e !== this && MathUtils.getDistance(this.x, this.y, e.x, e.y) < 100) {
                e.takeDamage(50); // 也可以炸同伴
            }
        });
        // 添加爆炸特效
        game.addExplosion(this.x, this.y, 'orange');
    }
}

// --- 治疗怪 ---
export class HealerEnemy extends Enemy {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.color = '#ff69b4'; // 粉色
        this.healTimer = 0;
        this.name = '治疗怪';
    }

    update(dt, game) {
        super.update(dt, game);
        this.healTimer += dt;
        if (this.healTimer > 3) {
            this.healTimer = 0;
            this.healArea(game.entities.enemies);
        }
    }

    healArea(enemies) {
        enemies.forEach(e => {
            if (MathUtils.getDistance(this.x, this.y, e.x, e.y) < 150) {
                e.hp = Math.min(e.hp + 20, e.maxHp);
            }
        });
    }
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 8, this.y - 8, 16, 16);
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x - 8, this.y - 3, 16, 6);
        ctx.fillRect(this.x - 3, this.y - 8, 6, 16);
    }
}

// --- 装甲怪 ---
export class ArmoredEnemy extends Enemy {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.speed = 40;
        this.color = '#555'; // 灰色
        this.hp *= 2.0; // 高血量
        this.radius = 14;
        this.name = '装甲怪';
    }

    takeDamage(amount) {
        // 减伤 50%
        super.takeDamage(amount * 0.5);
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'silver';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// --- 分裂怪 ---
export class SplitterEnemy extends Enemy {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.speed = 45;
        this.color = '#800080'; // 紫色
        this.hp *= 1.2;
        this.radius = 16;
        this.name = '分裂怪';
    }

    onDeath(game) {
        super.onDeath(game);
        // 分裂出2个小怪
        for(let i=0; i<2; i++) {
            const offset = (i === 0 ? -10 : 10);
            const small = new Enemy(this.x + offset, this.y + offset, this.wave);
            small.hp = this.maxHp * 0.3;
            small.radius = 8;
            small.speed *= 1.2;
            small.color = '#da70d6';
            game.entities.enemies.push(small);
        }
    }
}

// --- Boss怪 ---
export class BossEnemy extends Enemy {
    constructor(x, y, wave) {
        super(x, y, wave);
        this.speed = 30;
        this.hp = 500 + (wave * 100);
        this.maxHp = this.hp;
        this.radius = 30;
        this.color = '#8B0000'; // 深红
        this.name = 'Boss';
        
        // AI 状态
        this.state = 'wander'; // wander | charge
        this.stateTimer = 0;
        this.wanderTarget = { x: x, y: y };
        
        // 射击
        this.shootTimer = 0;
        this.shootInterval = 2.0;
    }

    update(dt, game) {
        const crystal = game.state.crystal;
        
        // 状态机
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            if (this.state === 'wander') {
                this.state = 'charge';
                this.stateTimer = 5.0; // 冲锋5秒
            } else {
                this.state = 'wander';
                this.stateTimer = 3.0; // 游走3秒
                // 随机游走目标 (在水晶周围 300 范围内)
                const angle = Math.random() * Math.PI * 2;
                const dist = 100 + Math.random() * 200;
                this.wanderTarget = {
                    x: crystal.x + Math.cos(angle) * dist,
                    y: crystal.y + Math.sin(angle) * dist
                };
            }
        }

        // 移动逻辑
        let targetX, targetY;
        if (this.state === 'charge') {
            targetX = crystal.x;
            targetY = crystal.y;
        } else {
            targetX = this.wanderTarget.x;
            targetY = this.wanderTarget.y;
        }

        const angle = MathUtils.getAngle(this.x, this.y, targetX, targetY);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;

        // 射击逻辑
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootInterval;
            this.shoot(game);
        }

        // 碰撞检测 (Boss 碰到水晶直接游戏结束)
        if (MathUtils.getDistance(this.x, this.y, crystal.x, crystal.y) < crystal.radius + this.radius) {
            game.gameOver();
        }

        if (this.hp <= 0) this.markedForDeletion = true;
    }

    shoot(game) {
        // 寻找最近的塔
        let target = null;
        let minDst = 400; // 射程
        for (let t of game.entities.towers) {
            const d = MathUtils.getDistance(this.x, this.y, t.x, t.y);
            if (d < minDst) {
                minDst = d;
                target = t;
            }
        }

        if (target) {
            // 发射子弹
            const p = new Projectile(this.x, this.y, target, {
                damage: 20,
                speed: 150,
                color: 'red',
                type: 'boss'
            });
            p.radius = 5;
            game.entities.projectiles.push(p);
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制血条
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x - 20, this.y - 40, 40, 6);
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 20, this.y - 40, 40 * hpPct, 6);

        // 绘制状态指示
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.state === 'charge' ? '!' : '?', this.x, this.y);
    }
}