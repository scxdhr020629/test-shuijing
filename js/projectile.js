import { MathUtils } from './utils.js';

export class Projectile {
    constructor(x, y, target, stats) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.speed = stats.speed || 400;
        this.damage = stats.damage;
        this.color = stats.color || 'white';
        this.type = stats.type || 'normal'; // normal, flame
        this.radius = 3;
        this.markedForDeletion = false;
    }

    update(dt, enemies) {
        // 如果目标死了，销毁子弹
        if (this.target.hp <= 0) {
            this.markedForDeletion = true;
            return;
        }

        const angle = MathUtils.getAngle(this.x, this.y, this.target.x, this.target.y);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;

        // 命中检测
        if (MathUtils.getDistance(this.x, this.y, this.target.x, this.target.y) < this.target.radius + 5) {
            this.hit(this.target);
            this.markedForDeletion = true;
        }
    }

    hit(enemy) {
        enemy.takeDamage(this.damage);
        if (this.type === 'flame') {
            enemy.applyBurn(3.0); // 燃烧3秒
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}