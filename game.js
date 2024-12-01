class Tank {
    constructor(x, y, color, controls) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.angle = 0;
        this.speed = 5;
        this.controls = controls;
        this.width = 30;
        this.height = 40;
        this.bullets = [];
        this.moveState = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        this.health = 100;        // 生命值
        this.armor = 50;         // 护甲值
        this.shootCooldown = 0;  // 改用数值型冷却时间
        this.bulletType = 'normal'; // 子弹类型
        this.score = 0;          // 得分
        this.isInvincible = false; // 无敌状态
        this.powerUps = [];      // 当前拥有的道具
        this.canShoot = true;  // 添加一个新属性来控制是否可以射击
    }

    draw(ctx) {
        // 绘制生命值和护甲条
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 25, this.y - 40, 50 * (this.health / 100), 5);
        ctx.fillStyle = 'blue';
        ctx.fillRect(this.x - 25, this.y - 45, 50 * (this.armor / 50), 3);
        
        // 无敌状态效果
        if (this.isInvincible) {
            ctx.strokeStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 绘制坦克主体
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // 绘制坦克主体
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // 绘制炮管
        ctx.fillRect(-2, -this.height/2, 4, -15);
        
        ctx.restore();

        // 绘制子弹
        this.bullets.forEach(bullet => bullet.draw(ctx));
    }

    update() {
        this.move();
        // 更新射击冷却
        if (this.shootCooldown > 0) {
            this.shootCooldown -= 16; // 假设60fps，每帧约16ms
        }
        
        // 更新子弹位置
        this.bullets = this.bullets.filter(bullet => {
            bullet.update();
            return bullet.isActive();
        });
    }

    shoot() {
        // 检查是否在冷却中或子弹数量已达上限
        if (this.shootCooldown > 0 || this.bullets.length >= 3) return;

        // 创建新子弹
        this.bullets.push(new Bullet(
            this.x + Math.sin(this.angle) * 30,
            this.y - Math.cos(this.angle) * 30,
            this.angle,
            {
                damage: 20,
                speed: 10,
                size: 3
            },
            'normal'
        ));
        
        // 设置冷却时间
        this.shootCooldown = 500; // 0.5秒冷却
    }

    move() {
        const moveSpeed = 3; // 降低移动速度
        const rotateSpeed = 0.03; // 降低旋转速度

        if (this.moveState.up) {
            this.y -= moveSpeed * Math.cos(this.angle);
            this.x += moveSpeed * Math.sin(this.angle);
        }
        if (this.moveState.down) {
            this.y += moveSpeed * Math.cos(this.angle);
            this.x -= moveSpeed * Math.sin(this.angle);
        }
        if (this.moveState.left) {
            this.angle -= rotateSpeed;
        }
        if (this.moveState.right) {
            this.angle += rotateSpeed;
        }

        // 确保坦克不会离开画布
        this.x = Math.max(this.width/2, Math.min(800 - this.width/2, this.x));
        this.y = Math.max(this.height/2, Math.min(600 - this.height/2, this.y));
    }

    // 添加受伤方法
    takeDamage(damage, bulletType) {
        if (this.isInvincible) return;
        
        let actualDamage = damage;
        if (this.armor > 0) {
            // 护甲能减免50%的伤害
            actualDamage = damage * 0.5;
            this.armor = Math.max(0, this.armor - damage * 0.3);
        }
        
        this.health = Math.max(0, this.health - actualDamage);
        
        // 受伤时短暂无敌
        this.isInvincible = true;
        setTimeout(() => this.isInvincible = false, 1000);
        
        return this.health <= 0;
    }
}

class Bullet {
    constructor(x, y, angle, config, type) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.damage = config.damage;
        this.speed = config.speed;
        this.size = config.size;
        this.type = type;
        this.active = true;
    }

    draw(ctx) {
        ctx.fillStyle = {
            normal: '#000',
            heavy: '#800',
            rapid: '#080'
        }[this.type];
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;

        // 检查是否超出边界
        if (this.x < 0 || this.x > 800 || this.y < 0 || this.y > 600) {
            this.active = false;
        }
    }

    isActive() {
        return this.active;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.active = true;
    }

    draw(ctx) {
        ctx.fillStyle = {
            health: 'green',
            armor: 'blue',
            rapid: 'yellow',
            heavy: 'red'
        }[this.type];
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 添加AI控制类
class AIController {
    constructor(tank) {
        this.tank = tank;
        this.targetX = Math.random() * 800;
        this.targetY = Math.random() * 600;
        this.updateTargetInterval = setInterval(() => this.updateTarget(), 5000);
        this.lastShootTime = 0;
        this.thinkTime = 0;
    }

    update(tanks) {
        // 移动到目标点
        this.moveToTarget();
        
        // 查找最近的敌人
        let nearestEnemy = this.findNearestEnemy(tanks);
        if (nearestEnemy) {
            this.aimAndShoot(nearestEnemy);
        }
    }

    moveToTarget() {
        if (this.thinkTime > 0) {
            this.thinkTime--;
            return;
        }

        const dx = this.targetX - this.tank.x;
        const dy = this.targetY - this.tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 50) {
            this.thinkTime = 60;
            this.updateTarget();
            return;
        }

        const targetAngle = Math.atan2(dx, -dy);
        const angleDiff = targetAngle - this.tank.angle;
        
        if (Math.abs(angleDiff) > 0.1) {
            if (angleDiff > 0) {
                this.tank.moveState.right = true;
                this.tank.moveState.left = false;
            } else {
                this.tank.moveState.left = true;
                this.tank.moveState.right = false;
            }
        } else {
            this.tank.moveState.left = false;
            this.tank.moveState.right = false;
        }

        if (Math.abs(angleDiff) < 0.5) {
            this.tank.moveState.up = true;
            this.tank.moveState.down = false;
        } else {
            this.tank.moveState.up = false;
        }
    }

    findNearestEnemy(tanks) {
        let nearestDist = Infinity;
        let nearestTank = null;
        
        tanks.forEach(otherTank => {
            if (otherTank === this.tank) return;
            
            const dx = otherTank.x - this.tank.x;
            const dy = otherTank.y - this.tank.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < nearestDist) {
                nearestDist = distance;
                nearestTank = otherTank;
            }
        });
        
        return nearestTank;
    }

    aimAndShoot(enemy) {
        // 计算瞄准角度
        const dx = enemy.x - this.tank.x;
        const dy = enemy.y - this.tank.y;
        const targetAngle = Math.atan2(dx, -dy);
        
        // 调整炮管方向
        const angleDiff = targetAngle - this.tank.angle;
        if (Math.abs(angleDiff) < 0.1) {
            // 在射程内且瞄准后射击
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 300 && Date.now() - this.lastShootTime > 1000) {
                this.tank.shoot();
                this.lastShootTime = Date.now();
            }
        }
    }

    updateTarget() {
        this.targetX = Math.random() * 600 + 100;
        this.targetY = Math.random() * 400 + 100;
        this.thinkTime = 30;
    }

    destroy() {
        clearInterval(this.updateTargetInterval);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameMode = 'pvp';
        this.tanks = [];
        this.isGameRunning = false;
        this.pressedKeys = new Set();
        this.powerUps = [];
        this.lastPowerUpTime = 0;
        this.aiControllers = [];
        this.lastFrameTime = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('startGame').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('gameMode').addEventListener('change', (e) => {
            this.gameMode = e.target.value;
        });

        // 键盘控制
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    startGame() {
        this.isGameRunning = true;
        this.tanks = [];
        this.aiControllers = [];
        this.powerUps = [];
        this.lastFrameTime = performance.now();
        
        // 修改玩家1的控制键，使用左Ctrl射击
        const player1Tank = new Tank(200, 300, 'blue', {
            up: 'w',
            down: 's',
            left: 'a',
            right: 'd',
            shoot: 'ControlLeft'  // 改为左Ctrl
        });
        this.tanks.push(player1Tank);

        const gameMode = document.getElementById('gameMode').value;
        
        if (gameMode === 'pvp') {
            // 修改玩家2的控制键，使用右Ctrl射击
            const player2Tank = new Tank(600, 300, 'red', {
                up: 'ArrowUp',
                down: 'ArrowDown',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                shoot: 'ControlRight'  // 改为右Ctrl
            });
            this.tanks.push(player2Tank);
        } else {
            // PVE 或 多人混战模式
            const aiCount = parseInt(document.getElementById('aiCount').value);
            const colors = ['red', 'green', 'purple'];
            
            for (let i = 0; i < aiCount; i++) {
                const aiTank = new Tank(
                    Math.random() * 600 + 100,
                    Math.random() * 400 + 100,
                    colors[i],
                    {} // AI坦克不需要控制键
                );
                this.tanks.push(aiTank);
                const aiController = new AIController(aiTank);
                this.aiControllers.push(aiController);
            }
        }

        // 开始游戏循环
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    gameLoop(currentTime) {
        if (!this.isGameRunning) return;

        // 计算帧时间
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 更新和绘制
        this.update(deltaTime);
        this.draw();

        // 继续下一帧
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        // 更新AI控制器
        this.aiControllers.forEach(controller => {
            controller.update(this.tanks);
        });

        // 更新坦克
        this.tanks.forEach(tank => tank.update());
        
        // 检查碰撞
        this.checkCollisions();
        
        // 定期生成道具
        if (Date.now() - this.lastPowerUpTime > 10000) {
            this.spawnPowerUp();
            this.lastPowerUpTime = Date.now();
        }
    }

    draw() {
        // 绘制道具
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        
        // 绘制坦克
        this.tanks.forEach(tank => tank.draw(this.ctx));
        
        // 绘制分数
        this.ctx.fillStyle = 'black';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`蓝方: ${this.tanks[0].score}`, 10, 30);
        if (this.tanks[1]) {
            this.ctx.fillText(`${this.tanks[1].color}方: ${this.tanks[1].score}`, this.canvas.width - 100, 30);
        }
    }

    handleKeyDown(e) {
        const key = e.code;  // 使用 e.code
        
        // 如果按键已经被按下，则不重复处理
        if (this.pressedKeys.has(key)) return;
        
        this.pressedKeys.add(key);
        
        this.tanks.forEach(tank => {
            const controls = tank.controls;
            if (!controls) return;

            // 使用正确的键码匹配移动键
            switch(key) {
                case 'KeyW':
                    if (controls.up === 'w') tank.moveState.up = true;
                    break;
                case 'KeyS':
                    if (controls.down === 's') tank.moveState.down = true;
                    break;
                case 'KeyA':
                    if (controls.left === 'a') tank.moveState.left = true;
                    break;
                case 'KeyD':
                    if (controls.right === 'd') tank.moveState.right = true;
                    break;
                case 'ArrowUp':
                    if (controls.up === 'ArrowUp') tank.moveState.up = true;
                    break;
                case 'ArrowDown':
                    if (controls.down === 'ArrowDown') tank.moveState.down = true;
                    break;
                case 'ArrowLeft':
                    if (controls.left === 'ArrowLeft') tank.moveState.left = true;
                    break;
                case 'ArrowRight':
                    if (controls.right === 'ArrowRight') tank.moveState.right = true;
                    break;
                case 'ControlLeft':
                case 'ControlRight':
                    if (key === controls.shoot) tank.shoot();
                    break;
            }
        });
    }

    handleKeyUp(e) {
        const key = e.code;
        this.pressedKeys.delete(key);
        
        this.tanks.forEach(tank => {
            const controls = tank.controls;
            if (!controls) return;

            // 使用正确的键码匹配移动键
            switch(key) {
                case 'KeyW':
                    if (controls.up === 'w') tank.moveState.up = false;
                    break;
                case 'KeyS':
                    if (controls.down === 's') tank.moveState.down = false;
                    break;
                case 'KeyA':
                    if (controls.left === 'a') tank.moveState.left = false;
                    break;
                case 'KeyD':
                    if (controls.right === 'd') tank.moveState.right = false;
                    break;
                case 'ArrowUp':
                    if (controls.up === 'ArrowUp') tank.moveState.up = false;
                    break;
                case 'ArrowDown':
                    if (controls.down === 'ArrowDown') tank.moveState.down = false;
                    break;
                case 'ArrowLeft':
                    if (controls.left === 'ArrowLeft') tank.moveState.left = false;
                    break;
                case 'ArrowRight':
                    if (controls.right === 'ArrowRight') tank.moveState.right = false;
                    break;
            }
        });
    }

    checkCollisions() {
        // 检查子弹碰撞
        this.tanks.forEach(tank => {
            tank.bullets.forEach(bullet => {
                this.tanks.forEach(otherTank => {
                    if (tank === otherTank) return;
                    
                    const dx = bullet.x - otherTank.x;
                    const dy = bullet.y - otherTank.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 20) {
                        bullet.active = false;
                        // 造成伤害但不立即结束游戏
                        if (otherTank.takeDamage(bullet.damage, bullet.type)) {
                            tank.score += 1;
                            // 只有当只剩下一个坦克时才结束游戏
                            const aliveTanks = this.tanks.filter(t => t.health > 0);
                            if (aliveTanks.length <= 1) {
                                this.endGame(tank);
                            } else {
                                // 如果坦克被击毁但游戏未结束，将其移除
                                this.tanks = this.tanks.filter(t => t.health > 0);
                                // 同时移除对应的AI控制器
                                this.aiControllers = this.aiControllers.filter(ai => ai.tank.health > 0);
                            }
                        }
                    }
                });
            });
        });

        // 检查道具碰撞
        this.powerUps = this.powerUps.filter(powerUp => {
            let collected = false;
            this.tanks.forEach(tank => {
                const dx = powerUp.x - tank.x;
                const dy = powerUp.y - tank.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 30) {
                    this.applyPowerUp(tank, powerUp.type);
                    collected = true;
                }
            });
            return !collected;
        });
    }

    endGame(winner) {
        this.isGameRunning = false;
        // 清理AI控制器
        this.aiControllers.forEach(controller => controller.destroy());
        this.aiControllers = [];
        alert(`游戏结束！${winner.color}方获胜！`);
    }

    spawnPowerUp() {
        const types = ['health', 'armor', 'rapid', 'heavy'];
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.random() * (this.canvas.width - 100) + 50;
        const y = Math.random() * (this.canvas.height - 100) + 50;
        this.powerUps.push(new PowerUp(x, y, type));
    }

    applyPowerUp(tank, type) {
        switch(type) {
            case 'health':
                tank.health = Math.min(100, tank.health + 30);
                break;
            case 'armor':
                tank.armor = Math.min(50, tank.armor + 20);
                break;
            case 'rapid':
                tank.bulletType = 'rapid';
                setTimeout(() => tank.bulletType = 'normal', 10000);
                break;
            case 'heavy':
                tank.bulletType = 'heavy';
                setTimeout(() => tank.bulletType = 'normal', 10000);
                break;
        }
    }
}

// 初始化游戏
const game = new Game(); 