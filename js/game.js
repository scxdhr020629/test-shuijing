import { MathUtils } from './utils.js';
import { Enemy, FlyingEnemy, ExploderEnemy, HealerEnemy, ArmoredEnemy, SplitterEnemy, BossEnemy } from './enemy.js';
import { Tower, FlameTower, LaserTower, TeslaTower, HealerTower, MoneyTower, BlackHoleTower } from './tower.js';

// 塔的配置数据 (按文档调整)
const TOWER_TYPES = {
    1: { class: Tower, name:'基础塔', cost:50, range:250, damage:30, cooldown:1.5, color:'#4caf50', hp:100, unlockLevel: 1 },
    2: { class: Tower, name:'射箭塔', cost:100, range:300, damage:50, cooldown:1.8, color:'#9c27b0', hp:80, projectileSpeed: 700, unlockLevel: 3 }, // 穿透逻辑需在Tower里实现或简化
    3: { class: FlameTower, name:'灼烧塔', cost:150, range:200, damage:40, cooldown:1.2, color:'#ff5722', hp:120, projectileSpeed: 250, unlockLevel: 5 },
    4: { class: HealerTower, name:'治疗塔', cost:200, range:350, damage:15, cooldown:1.5, color:'#00bcd4', hp:200, unlockLevel: 7 },
    5: { class: LaserTower, name:'镭射塔', cost:300, range:400, damage:80, cooldown:0.8, color:'#d32f2f', hp:150, unlockLevel: 10 },
    6: { class: MoneyTower, name:'金钱塔', cost:400, range:100, damage:10, cooldown:1.0, color:'#ffd700', hp:100, unlockLevel: 3 },
    7: { class: BlackHoleTower, name:'黑洞塔', cost:500, range:150, damage:60, cooldown:3.0, color:'#000000', hp:200, unlockLevel: 15 }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.state = {
            active: true,
            gold: 200, // 初始200
            wave: 1,
            bossSpawnedWave: 0, // 记录Boss是否已生成
            frameCount: 0,
            speed: 1, // 游戏速度
            camera: { x: 0, y: 0 }, // 摄像机偏移
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0,
            crystal: { 
                x:0, y:0, 
                hp:1000, maxHp:1000, 
                level:1, exp:0, maxExp:1000,
                radius:35, regen:10, 
                shield: 500, maxShield: 500, shieldCooldown: 0,
                upgradeCost:500 // 保留旧逻辑兼容，但主要靠EXP升级
            },
            lastTime: 0
        };
        
        this.entities = {
            enemies: [],
            towers: [],
            projectiles: [],
            effects: [] // 视觉特效+飘字
        };

        this.input = { selectedTowerId: null, selectedEntity: null, mouseX: 0, mouseY: 0 };
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.initUI();
        this.initInput();
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.state.crystal.x = this.canvas.width / 2;
        this.state.crystal.y = this.canvas.height / 2;
        // 初始居中
        this.state.camera.x = 0;
        this.state.camera.y = 0;
    }

    initInput() {
        this.canvas.addEventListener('mousemove', e => {
            // 记录屏幕坐标用于UI，记录世界坐标用于游戏逻辑
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            this.input.mouseX = screenX - this.state.camera.x;
            this.input.mouseY = screenY - this.state.camera.y;

            // 拖拽逻辑
            if (this.state.isDragging) {
                const dx = screenX - this.state.lastMouseX;
                const dy = screenY - this.state.lastMouseY;
                this.state.camera.x += dx;
                this.state.camera.y += dy;
                this.state.lastMouseX = screenX;
                this.state.lastMouseY = screenY;
            }
        });

        this.canvas.addEventListener('mousedown', e => {
            if (e.button === 2) return; // 右键不拖拽
            // 如果点击的是UI或正在放置塔，不拖拽
            if (this.input.selectedTowerId) return;

            this.state.isDragging = true;
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mouseup', e => {
            this.state.isDragging = false;
        });

        this.canvas.addEventListener('click', e => {
            // 放置塔
            if (this.input.selectedTowerId) {
                this.placeTower();
                return;
            }
            
            // 选择塔 (回收逻辑)
            const clickedTower = this.entities.towers.find(t => MathUtils.getDistance(t.x, t.y, this.input.mouseX, this.input.mouseY) < t.radius + 5);
            if (clickedTower) {
                this.input.selectedEntity = clickedTower;
                this.updateUIButtons(); // 显示回收按钮
            } else {
                this.input.selectedEntity = null;
                this.updateUIButtons();
            }
        });

        this.canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            this.input.selectedTowerId = null;
            this.input.selectedEntity = null;
            this.updateUIButtons();
        });
    }

    initUI() {
        // 生成塔按钮
        const container = document.getElementById('tower-buttons');
        Object.keys(TOWER_TYPES).forEach(id => {
            const t = TOWER_TYPES[id];
            const btn = document.createElement('button');
            btn.id = `btn-tower-${id}`;
            btn.innerHTML = `${t.name}<br><small>$${t.cost}</small>`;
            btn.onclick = () => {
                this.input.selectedTowerId = parseInt(id);
                this.updateUIButtons();
            };
            container.appendChild(btn);
        });

        document.getElementById('btn-upgrade').onclick = () => this.upgradeCrystal();
        
        // 速度按钮
        const btnSpeed = document.getElementById('btn-speed');
        btnSpeed.onclick = () => {
            this.state.speed = this.state.speed === 1 ? 2 : 1;
            btnSpeed.innerText = `速度: ${this.state.speed}x`;
            btnSpeed.classList.toggle('active', this.state.speed === 2);
        };

        // 回到水晶按钮
        const btnHome = document.createElement('button');
        btnHome.innerText = '回到水晶';
        btnHome.style.marginLeft = '10px';
        btnHome.onclick = () => {
            this.state.camera.x = 0;
            this.state.camera.y = 0;
        };
        document.getElementById('controls-panel').appendChild(btnHome);
    }

    // 主循环
    loop(timestamp) {
        if (!this.state.active) return;
        requestAnimationFrame((t) => this.loop(t));
        
        if (!this.state.lastTime) {
            this.state.lastTime = timestamp;
            return;
        }

        let dt = (timestamp - this.state.lastTime) / 1000;
        this.state.lastTime = timestamp;

        // 限制最大 dt 防止切换标签页后跳跃过大
        if (dt > 0.1) dt = 0.1;

        this.state.frameCount++;
        dt *= this.state.speed; // 应用速度

        this.update(dt);
        this.draw();
    }

    update(dt) {
        const { crystal } = this.state;

        // 1. 水晶逻辑
        // 回血 (每秒)
        if (this.state.frameCount % 60 === 0) {
            if (crystal.hp < crystal.maxHp) {
                crystal.hp = Math.min(crystal.hp + crystal.regen, crystal.maxHp);
                this.updateUI();
            }
        }
        // 护盾恢复
        if (crystal.shield < crystal.maxShield) {
            crystal.shieldCooldown -= dt;
            if (crystal.shieldCooldown <= 0) {
                crystal.shield = crystal.maxShield;
                this.updateUI();
            }
        }

        // 2. 生成怪物
        this.spawnLogic();

        // 3. 更新实体
        // 怪物
        this.entities.enemies.forEach(e => e.update(dt, this));
        this.entities.enemies = this.entities.enemies.filter(e => {
            if (e.hp <= 0) { // 死亡
                // 经验获取
                this.gainExp(e.wave * 10); // 简单经验公式
                this.state.gold += 10 + Math.floor(e.wave * 0.5);
                this.addExplosion(e.x, e.y, e.color);
                if (e.onDeath) e.onDeath(this);
                return false;
            }
            return !e.markedForDeletion;
        });

        // 塔 (传入 this)
        this.entities.towers.forEach(t => t.update(dt, this));
        this.entities.towers = this.entities.towers.filter(t => t.hp > 0);

        // 子弹
        this.entities.projectiles.forEach(p => p.update(dt, this.entities.enemies));
        this.entities.projectiles = this.entities.projectiles.filter(p => !p.markedForDeletion);

        // 特效
        this.entities.effects.forEach(fx => {
            fx.life -= dt;
            if (fx.type === 'text') fx.y += fx.vy * dt; // 飘字移动
        });
        this.entities.effects = this.entities.effects.filter(fx => fx.life > 0);

        // 游戏结束检测
        if (crystal.hp <= 0) {
            this.state.active = false;
            document.getElementById('game-over').style.display = 'block';
        }
        
        // 增加水晶对象方法以便怪物调用
        crystal.takeDamage = (amt) => {
            // 护盾抵挡
            if (crystal.shield > 0) {
                if (crystal.shield >= amt) {
                    crystal.shield -= amt;
                    amt = 0;
                } else {
                    amt -= crystal.shield;
                    crystal.shield = 0;
                    crystal.shieldCooldown = 60 - (crystal.level * 5); // 冷却逻辑
                }
            }
            crystal.hp -= amt;
            this.updateUI();
        };
    }

    gameOver() {
        this.state.active = false;
        document.getElementById('game-over').style.display = 'block';
    }

    gainExp(amount) {
        const c = this.state.crystal;
        if (c.level >= 20) return;
        c.exp += amount;
        if (c.exp >= c.maxExp) {
            c.exp -= c.maxExp;
            c.level++;
            c.maxExp = Math.floor(c.maxExp * 1.2);
            c.maxHp += 200;
            c.hp += 200;
            c.regen += 5;
            c.maxShield += 100;
            // 升级特效
            this.addExplosion(c.x, c.y, '#00ffff');
            this.updateUI();
        }
        this.updateUI(); // 更新经验条
    }

    spawnLogic() {
        // 波次提升逻辑
        if (this.state.frameCount % 2000 === 0) this.state.wave++;

        const wave = this.state.wave;

        // Boss 生成逻辑
        if (wave % 5 === 0 && this.state.bossSpawnedWave < wave) {
            this.state.bossSpawnedWave = wave;
            const bossCount = 1 + Math.floor(wave / 10);
            for (let i = 0; i < bossCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const rad = Math.max(this.canvas.width, this.canvas.height) / 2 + 50;
                const x = this.state.crystal.x + Math.cos(angle) * rad;
                const y = this.state.crystal.y + Math.sin(angle) * rad;
                
                const boss = new BossEnemy(x, y, wave);
                // Boss 奖励
                boss.onDeath = (game) => {
                    game.state.gold += 500;
                    game.gainExp(1000);
                    game.addExplosion(boss.x, boss.y, 'purple');
                };
                this.entities.enemies.push(boss);
            }
        }

        // 普通怪物生成间隔
        // 加快生成速度，并且随波次增加每次生成的数量
        const spawnRate = Math.max(20, 100 - wave * 3); 
        if (this.state.frameCount % spawnRate === 0) {
            const count = 1 + Math.floor(wave / 5); // 每轮增加生成数量
            
            for (let i = 0; i < count; i++) {
                let EnemyClass = Enemy;
                
                // 怪物池逻辑
                let pool = [Enemy];
                if (wave > 2) pool.push(FlyingEnemy);
                if (wave > 4) pool.push(ExploderEnemy);
                if (wave > 7) pool.push(HealerEnemy);
                if (wave > 10) pool.push(ArmoredEnemy);
                if (wave > 15) pool.push(SplitterEnemy);

                // 简单权重选择
                EnemyClass = pool[Math.floor(Math.random() * pool.length)];

                const angle = Math.random() * Math.PI * 2;
                const rad = Math.max(this.canvas.width, this.canvas.height) / 2 + 50;
                // 稍微分散一点
                const offset = i * 20; 
                const x = this.state.crystal.x + Math.cos(angle) * (rad + offset);
                const y = this.state.crystal.y + Math.sin(angle) * (rad + offset);

                const enemy = new EnemyClass(x, y, wave);
                this.entities.enemies.push(enemy);
            }
        }
    }

    placeTower() {
        const conf = TOWER_TYPES[this.input.selectedTowerId];
        if (!conf || this.state.gold < conf.cost) return;
        
        // 等级解锁检测
        if (this.state.crystal.level < conf.unlockLevel) return;

        // 使用世界坐标
        const x = this.input.mouseX;
        const y = this.input.mouseY;
        const TowerClass = conf.class;
        
        // 距离检测
        const distToCrystal = MathUtils.getDistance(x, y, this.state.crystal.x, this.state.crystal.y);
        if (distToCrystal < this.state.crystal.radius + 20) return;
        
        // 塔与塔之间的碰撞检测
        for (let t of this.entities.towers) {
            if (MathUtils.getDistance(x, y, t.x, t.y) < t.radius + 20) {
                return;
            }
        }
        
        this.state.gold -= conf.cost;
        this.entities.towers.push(new TowerClass(x, y, conf));
        this.updateUI();
    }

    sellTower() {
        if (!this.input.selectedEntity) return;
        const t = this.input.selectedEntity;
        
        // 回收 50%
        this.state.gold += Math.floor(t.cost * 0.5);
        
        // 移除塔
        this.entities.towers = this.entities.towers.filter(tower => tower !== t);
        
        // 特效
        this.addExplosion(t.x, t.y, 'gold');
        
        this.input.selectedEntity = null;
        this.updateUIButtons();
        this.updateUI();
    }
    
    upgradeCrystal() {
        // 废弃金币升级，改为经验自动升级，这里可以改成购买能量或护盾
        // 但为了兼容UI，暂时保留为“购买经验”
        const cost = 500;
        if (this.state.gold >= cost) {
            this.state.gold -= cost;
            this.gainExp(500);
            this.updateUI();
        }
    }

    addExplosion(x, y, color) {
        // 简单的视觉效果，存入effects
        for(let i=0; i<5; i++) {
            this.entities.effects.push({
                type: 'particle', x:x, y:y, 
                vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, 
                life:0.5, color:color, radius: Math.random()*3
            });
        }
    }

    draw() {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.state.camera.x, this.state.camera.y);

        // 绘制
        this.entities.towers.forEach(t => t.draw(this.ctx));
        this.entities.enemies.forEach(e => e.draw(this.ctx));
        this.entities.projectiles.forEach(p => p.draw(this.ctx));

        // 绘制水晶
        this.ctx.shadowBlur = 20; this.ctx.shadowColor = 'blue';
        this.ctx.fillStyle = '#00ffff';
        this.ctx.beginPath(); 
        this.ctx.arc(this.state.crystal.x, this.state.crystal.y, this.state.crystal.radius, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // 绘制特效
        this.entities.effects.forEach(fx => {
            if (fx.type === 'beam' || fx.type === 'line' || fx.type === 'lightning') {
                this.ctx.strokeStyle = fx.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath(); this.ctx.moveTo(fx.x1, fx.y1); this.ctx.lineTo(fx.x2, fx.y2); this.ctx.stroke();
            } else if (fx.type === 'particle') {
                fx.x += fx.vx; fx.y += fx.vy;
                this.ctx.fillStyle = fx.color;
                this.ctx.beginPath(); this.ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI*2); this.ctx.fill();
            } else if (fx.type === 'text') {
                this.ctx.fillStyle = fx.color || 'white';
                this.ctx.font = '14px Arial';
                this.ctx.fillText(fx.text, fx.x, fx.y);
            } else if (fx.type === 'blackhole') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(fx.x, fx.y, fx.radius * fx.life, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = 'purple';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        });

        // 放置预览
        if (this.input.selectedTowerId) {
            const conf = TOWER_TYPES[this.input.selectedTowerId];
            // 绘制范围圈
            this.ctx.beginPath();
            this.ctx.arc(this.input.mouseX, this.input.mouseY, conf.range, 0, Math.PI*2);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            this.ctx.stroke();

            // 绘制塔身预览
            this.ctx.fillStyle = conf.color;
            this.ctx.beginPath();
            this.ctx.arc(this.input.mouseX, this.input.mouseY, 15, 0, Math.PI*2);
            this.ctx.fill();
        }
        
        this.ctx.restore();

        // 怪物悬浮提示
        const hoverEnemy = this.entities.enemies.find(e => MathUtils.getDistance(e.x, e.y, this.input.mouseX, this.input.mouseY) < e.radius + 5);
        const hoverTower = this.entities.towers.find(t => MathUtils.getDistance(t.x, t.y, this.input.mouseX, this.input.mouseY) < t.radius + 5);
        const tooltip = document.getElementById('tooltip');
        
        if (hoverEnemy) {
            tooltip.style.display = 'block';
            tooltip.style.left = (this.input.mouseX + this.state.camera.x) + 15 + 'px';
            tooltip.style.top = (this.input.mouseY + this.state.camera.y) + 15 + 'px';
            tooltip.innerHTML = `<strong>${hoverEnemy.name}</strong><br>HP: ${Math.floor(hoverEnemy.hp)}/${Math.floor(hoverEnemy.maxHp)}`;
        } else if (hoverTower) {
            tooltip.style.display = 'block';
            tooltip.style.left = (this.input.mouseX + this.state.camera.x) + 15 + 'px';
            tooltip.style.top = (this.input.mouseY + this.state.camera.y) + 15 + 'px';
            tooltip.innerHTML = `<strong>${hoverTower.name}</strong><br>HP: ${Math.floor(hoverTower.hp)}/${Math.floor(hoverTower.maxHp)}<br>伤害: ${hoverTower.damage}<br>攻速: ${(1/hoverTower.cooldownTime).toFixed(1)}/s`;
        } else {
            tooltip.style.display = 'none';
        }
    }

    updateUI() {
        document.getElementById('gold').innerText = Math.floor(this.state.gold);
        document.getElementById('wave').innerText = this.state.wave;
        document.getElementById('hp').innerText = Math.floor(this.state.crystal.hp);
        document.getElementById('shield').innerText = Math.floor(this.state.crystal.shield);
        document.getElementById('level').innerText = this.state.crystal.level;
        document.getElementById('exp').innerText = `${Math.floor(this.state.crystal.exp)}/${this.state.crystal.maxExp}`;
        this.updateUIButtons();
    }

    updateUIButtons() {
        document.getElementById('btn-upgrade').disabled = this.state.gold < 500;
        
        // 回收按钮逻辑
        let sellBtn = document.getElementById('btn-sell');
        if (!sellBtn) {
            sellBtn = document.createElement('button');
            sellBtn.id = 'btn-sell';
            sellBtn.style.marginLeft = '10px';
            sellBtn.style.backgroundColor = '#d32f2f';
            document.getElementById('controls-panel').appendChild(sellBtn);
        }
        
        if (this.input.selectedEntity) {
            const t = this.input.selectedEntity;
            sellBtn.style.display = 'inline-block';
            sellBtn.innerHTML = `回收 ${t.name} <br><small>+$${Math.floor(t.cost * 0.5)}</small>`;
            sellBtn.onclick = () => this.sellTower();
        } else {
            sellBtn.style.display = 'none';
        }

        document.querySelectorAll('#tower-buttons button').forEach(btn => {
            const id = btn.id.split('-')[2];
            const conf = TOWER_TYPES[id];
            
            // 解锁检测
            if (this.state.crystal.level < conf.unlockLevel) {
                btn.disabled = true;
                btn.style.opacity = 0.3;
                btn.innerHTML = `${conf.name}<br><small>LV${conf.unlockLevel}解锁</small>`;
                return;
            }
            
            btn.style.opacity = 1;
            btn.innerHTML = `${conf.name}<br><small>$${conf.cost}</small>`;
            btn.disabled = this.state.gold < conf.cost;
            
            if (this.input.selectedTowerId == id) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }
}

// 启动
new Game();