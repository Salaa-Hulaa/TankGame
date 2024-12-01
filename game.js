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
        
        // 添加碰撞箱属性
        this.hitbox = {
            width: 30,    // 坦克主体宽度
            height: 40,   // 坦克主体高度
            turret: {     // 炮塔碰撞箱
                width: 4,
                height: 15
            }
        };

        // 添加新属性
        this.hitEffects = [];     // 击中特效
        this.shakeAmount = 0;     // 震屏效果
        this.flashTime = 0;       // 受击闪烁
        this.lastHitTime = 0;     // 上次受击时间
        this.killStreak = 0;      // 连杀数

        // 添加音频上下文
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        this.baseSpeed = 180;     // 每秒移动像素数
        this.baseRotateSpeed = 2; // 每秒旋转弧度数
    }

    draw(ctx) {
        // 应用震屏效果
        if (this.shakeAmount > 0) {
            ctx.save();
            ctx.translate(
                (Math.random() - 0.5) * this.shakeAmount,
                (Math.random() - 0.5) * this.shakeAmount
            );
        }

        // 受击闪烁效果
        const alpha = this.flashTime > 0 ? 0.5 + Math.sin(this.flashTime * 0.4) * 0.5 : 1;
        ctx.globalAlpha = alpha;

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

        // 绘制击中特效
        this.hitEffects = this.hitEffects.filter(effect => {
            effect.draw(ctx);
            effect.life -= 1;
            return effect.life > 0;
        });

        if (this.shakeAmount > 0) {
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    update(deltaTime) {
        this.move(deltaTime);
        
        // 更新射击冷却
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime; // 使用实际时间而不是固定值
        }
        
        // 更新子弹位置
        this.bullets = this.bullets.filter(bullet => {
            bullet.update(deltaTime);  // 传递 deltaTime 到子弹更新
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
        this.playShootSound(); // 添加射击音效
    }

    move(deltaTime) {  // 添加 deltaTime 参数
        // 将速度转换为每帧移动距离
        const moveSpeed = this.baseSpeed * (deltaTime / 1000); // 转换为每帧移动距离
        const rotateSpeed = this.baseRotateSpeed * (deltaTime / 1000); // 转换为每帧旋转角度
        let isMoving = false;

        if (this.moveState.up) {
            this.y -= moveSpeed * Math.cos(this.angle);
            this.x += moveSpeed * Math.sin(this.angle);
            isMoving = true;
        }
        if (this.moveState.down) {
            this.y += moveSpeed * Math.cos(this.angle);
            this.x -= moveSpeed * Math.sin(this.angle);
            isMoving = true;
        }
        if (this.moveState.left) {
            this.angle -= rotateSpeed;
            isMoving = true;
        }
        if (this.moveState.right) {
            this.angle += rotateSpeed;
            isMoving = true;
        }

        // 播放引擎音效
        this.playEngineSound(isMoving);

        // 确保坦克不会离开画布
        this.x = Math.max(this.width/2, Math.min(800 - this.width/2, this.x));
        this.y = Math.max(this.height/2, Math.min(600 - this.height/2, this.y));
    }

    // 优化受伤反馈
    takeDamage(damage, bulletType) {
        if (this.isInvincible) return false;
        
        // 添加震屏效果
        this.shakeAmount = damage * 0.5;
        setTimeout(() => this.shakeAmount = 0, 200);
        
        // 添加闪烁效果
        this.flashTime = 10;
        
        // 添加击中特效
        this.addHitEffect(damage);
        
        // 计算实际伤害
        let actualDamage = damage;
        if (this.armor > 0) {
            actualDamage = damage * 0.5;
            this.armor = Math.max(0, this.armor - damage * 0.3);
        }
        
        this.health = Math.max(0, this.health - actualDamage);
        
        // 受伤音效和视觉反馈
        this.playHitSound(damage);
        
        // 暂无敌
        this.isInvincible = true;
        setTimeout(() => this.isInvincible = false, 500);
        
        return this.health <= 0;
    }

    addHitEffect(damage) {
        const effect = {
            x: this.x,
            y: this.y,
            size: damage * 0.5,
            life: 20,
            draw: (ctx) => {
                ctx.strokeStyle = 'rgba(255,0,0,' + effect.life/20 + ')';
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, (20 - effect.life) * 2, 0, Math.PI * 2);
                ctx.stroke();
            }
        };
        this.hitEffects.push(effect);
    }

    playHitSound(damage) {
        // 创建音频节点
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        // 连接节点
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        // 设置音效参数
        const volume = Math.min(damage / 100, 1);
        const frequency = damage >= 30 ? 100 : 200; // 重击低音，轻击高音
        
        // 设置音色
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
        
        // 设置音量包络
        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        
        // 播放音效
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.1);
    }

    // 添加射击音效
    playShootSound() {
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        // 设置射击音效参数
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, this.audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.1);
    }

    // 添加引擎音效
    playEngineSound(isMoving) {
        if (!this.engineOscillator) {
            this.engineOscillator = this.audioCtx.createOscillator();
            this.engineGain = this.audioCtx.createGain();
            
            this.engineOscillator.connect(this.engineGain);
            this.engineGain.connect(this.audioCtx.destination);
            
            this.engineOscillator.type = 'triangle';
            this.engineOscillator.frequency.setValueAtTime(50, this.audioCtx.currentTime);
            this.engineGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            
            this.engineOscillator.start();
        }
        
        // 根据移动状态调整音量
        const targetVolume = isMoving ? 0.1 : 0;
        this.engineGain.gain.linearRampToValueAtTime(
            targetVolume,
            this.audioCtx.currentTime + 0.1
        );
    }

    // 添加获取碰撞箱的方法
    getHitboxes() {
        // 主体碰撞箱
        const bodyBox = {
            x: this.x - this.hitbox.width/2,
            y: this.y - this.hitbox.height/2,
            width: this.hitbox.width,
            height: this.hitbox.height
        };

        // 炮塔碰撞箱（考虑旋转角度）
        const turretBox = {
            x: this.x - this.hitbox.turret.width/2 + Math.sin(this.angle) * (this.hitbox.height/2),
            y: this.y - this.hitbox.turret.height/2 - Math.cos(this.angle) * (this.hitbox.height/2),
            width: this.hitbox.turret.width,
            height: this.hitbox.turret.height,
            angle: this.angle
        };

        return { body: bodyBox, turret: turretBox };
    }

    // 添加碰撞检测方法
    isHit(bullet) {
        const hitboxes = this.getHitboxes();
        
        // 检查主体碰撞
        if (this.checkBoxCollision(bullet, hitboxes.body)) {
            return { hit: true, damage: bullet.damage };
        }
        
        // 检查炮塔碰撞（暴击）
        if (this.checkRotatedBoxCollision(bullet, hitboxes.turret)) {
            return { hit: true, damage: bullet.damage * 1.5 }; // 炮塔受击造成1.5倍伤害
        }
        
        return { hit: false };
    }

    // 矩形碰撞检测
    checkBoxCollision(bullet, box) {
        return bullet.x >= box.x && 
               bullet.x <= box.x + box.width &&
               bullet.y >= box.y && 
               bullet.y <= box.y + box.height;
    }

    // 旋转矩形碰撞检测
    checkRotatedBoxCollision(bullet, box) {
        // 将子弹坐标转换到炮塔的局部坐标系
        const dx = bullet.x - box.x;
        const dy = bullet.y - box.y;
        
        // 应用逆旋转
        const rotatedX = dx * Math.cos(-box.angle) - dy * Math.sin(-box.angle);
        const rotatedY = dx * Math.sin(-box.angle) + dy * Math.cos(-box.angle);
        
        // 在局部坐标系中检查碰撞
        return rotatedX >= -box.width/2 &&
               rotatedX <= box.width/2 &&
               rotatedY >= -box.height/2 &&
               rotatedY <= box.height/2;
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
        this.baseSpeed = 600; // 每秒移动像素数
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

    update(deltaTime) {  // 添加 deltaTime 参数
        const speed = this.baseSpeed * (deltaTime / 1000);
        this.x += Math.sin(this.angle) * speed;
        this.y -= Math.cos(this.angle) * speed;

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

// 改进AI控制器
class AIController {
    constructor(tank) {
        this.tank = tank;
        this.targetX = Math.random() * 800;
        this.targetY = Math.random() * 600;
        this.state = 'patrol';
        this.lastStateChange = Date.now();
        this.targetTank = null;
        this.updateTargetInterval = setInterval(() => this.updateTarget(), 3000);
        this.thinkTime = 0;
        this.stuckTime = 0;      // 添加卡住检测
        this.lastPosition = { x: tank.x, y: tank.y };
        this.avoidanceDirection = null;
        this.lastShotTime = 0;
        this.minShootInterval = 500; // 最小射击间隔
    }

    update(tanks, deltaTime) {
        // 重置移动状态
        this.tank.moveState = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        // 检测是否卡住
        this.checkStuck();
        
        // 如果卡住了，执行避障
        if (this.stuckTime > 1000) {
            this.avoidObstacle();
            return;
        }

        // 更新AI状态
        this.updateState(tanks);
        
        switch(this.state) {
            case 'patrol':
                this.patrolBehavior();
                break;
            case 'chase':
                this.chaseBehavior();
                break;
            case 'retreat':
                this.retreatBehavior();
                break;
        }

        // 更新上一次位置
        this.lastPosition = { x: this.tank.x, y: this.tank.y };
    }

    checkStuck() {
        const dx = this.tank.x - this.lastPosition.x;
        const dy = this.tank.y - this.lastPosition.y;
        const movement = Math.sqrt(dx * dx + dy * dy);
        
        if (movement < 0.1 && (this.tank.moveState.up || this.tank.moveState.down)) {
            this.stuckTime += 16; // 假设60fps
        } else {
            this.stuckTime = 0;
            this.avoidanceDirection = null;
        }
    }

    avoidObstacle() {
        if (!this.avoidanceDirection) {
            this.avoidanceDirection = Math.random() > 0.5 ? 'left' : 'right';
        }
        
        // 后退并转向
        this.tank.moveState.down = true;
        this.tank.moveState[this.avoidanceDirection] = true;
        
        // 果还是卡住太久，重新选择目
        if (this.stuckTime > 2000) {
            this.updateTarget();
            this.stuckTime = 0;
        }
    }

    updateState(tanks) {
        const nearestEnemy = this.findNearestEnemy(tanks);
        if (!nearestEnemy) return;

        const distance = this.getDistance(nearestEnemy);
        const healthRatio = this.tank.health / 100;
        
        // 根据生命值和距离动态决定状态
        if (healthRatio < 0.3 && distance < 200) {
            // 血量低且敌人近时撤退
            this.state = 'retreat';
            this.targetTank = nearestEnemy;
        } else if (healthRatio > 0.6 || (distance < 150 && healthRatio > 0.4)) {
            // 血量高或者敌人很近时追击
            this.state = 'chase';
            this.targetTank = nearestEnemy;
        } else {
            // 其他情况巡逻
            this.state = 'patrol';
        }
    }

    chaseBehavior() {
        if (!this.targetTank) return;
        
        const distance = this.getDistance(this.targetTank);
        const optimalDistance = 200;
        
        // 检查是否有直接射击路径
        const obstacleInPath = this.checkObstacleInPath(this.targetTank);
        
        if (obstacleInPath && obstacleInPath.type === 'steel') {
            // 如果有钢墙阻挡，寻找更好的位置
            this.findBetterPosition();
        } else {
            // 正常的追击行为
            if (distance < optimalDistance - 50) {
                this.tank.moveState.down = true;
            } else if (distance > optimalDistance + 50) {
                this.targetX = this.targetTank.x;
                this.targetY = this.targetTank.y;
                this.moveToTarget();
            } else {
                this.circleAroundTarget();
            }
            
            this.aimAndShoot(this.targetTank);
        }
    }

    findBetterPosition() {
        // 寻找可以射击的位置
        const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 
                       5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
        
        let bestAngle = null;
        let bestDistance = Infinity;
        
        angles.forEach(angle => {
            const testX = this.targetTank.x + Math.cos(angle) * 200;
            const testY = this.targetTank.y + Math.sin(angle) * 200;
            
            // 创建临时目标点进行检查
            const testTarget = { x: testX, y: testY };
            
            if (!this.checkObstacleInPath(testTarget)) {
                const dist = Math.sqrt(
                    Math.pow(testX - this.tank.x, 2) + 
                    Math.pow(testY - this.tank.y, 2)
                );
                
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestAngle = angle;
                }
            }
        });
        
        if (bestAngle !== null) {
            this.targetX = this.targetTank.x + Math.cos(bestAngle) * 200;
            this.targetY = this.targetTank.y + Math.sin(bestAngle) * 200;
            this.moveToTarget();
        } else {
            // 如果找不到好位��，就保持移动
            this.circleAroundTarget();
        }
    }

    retreatBehavior() {
        if (this.targetTank) {
            // 计算逃跑方向，避免逃到角落
            const dx = this.tank.x - this.targetTank.x;
            const dy = this.tank.y - this.targetTank.y;
            
            // 选择离中心更近的方向逃跑
            const centerX = 400;
            const centerY = 300;
            
            this.targetX = this.tank.x + dx;
            this.targetY = this.tank.y + dy;
            
            // 如果逃跑方向会导致远离中心，调整目标点
            if (Math.abs(this.targetX - centerX) > 300) {
                this.targetX = centerX + (this.targetX > centerX ? 250 : -250);
            }
            if (Math.abs(this.targetY - centerY) > 200) {
                this.targetY = centerY + (this.targetY > centerY ? 150 : -150);
            }
            
            this.moveToTarget();
        }
    }

    patrolBehavior() {
        this.moveToTarget();
        
        // 只在看到敌人且路径上没有钢墙时射击
        const nearestEnemy = this.findNearestEnemy(game.tanks);
        if (nearestEnemy) {
            const obstacleInPath = this.checkObstacleInPath(nearestEnemy);
            if (!obstacleInPath || obstacleInPath.type !== 'steel') {
                if (Math.random() < 0.01) { // 降低射击频率
                    this.aimAndShoot(nearestEnemy);
                }
            }
        }
    }

    getDistance(target) {
        const dx = target.x - this.tank.x;
        const dy = target.y - this.tank.y;
        return Math.sqrt(dx * dx + dy * dy);
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

    updateTarget() {
        // 更新巡目标点
        this.targetX = Math.random() * 600 + 100;
        this.targetY = Math.random() * 400 + 100;
    }

    moveToTarget() {
        const dx = this.targetX - this.tank.x;
        const dy = this.targetY - this.tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 50) {
            this.updateTarget();
            return;
        }

        // 计算目标角度
        const targetAngle = Math.atan2(dx, -dy);
        const angleDiff = this.normalizeAngle(targetAngle - this.tank.angle);
        
        // 转向目标
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

        // 前进
        if (Math.abs(angleDiff) < 0.5) {
            this.tank.moveState.up = true;
            this.tank.moveState.down = false;
        } else {
            this.tank.moveState.up = false;
        }
    }

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }

    aimAndShoot(target) {
        if (!target) return;
        
        const dx = target.x - this.tank.x;
        const dy = target.y - this.tank.y;
        const targetAngle = Math.atan2(dx, -dy);
        const angleDiff = this.normalizeAngle(targetAngle - this.tank.angle);
        
        // 瞄准目标
        if (Math.abs(angleDiff) > 0.1) {
            if (angleDiff > 0) {
                this.tank.moveState.right = true;
                this.tank.moveState.left = false;
            } else {
                this.tank.moveState.left = true;
                this.tank.moveState.right = false;
            }
        }
        
        // 检查射击路径上是否有障碍物
        if (Math.abs(angleDiff) < 0.1 && 
            Date.now() - this.lastShotTime > this.minShootInterval) {
            
            const obstacleInPath = this.checkObstacleInPath(target);
            if (!obstacleInPath || obstacleInPath.type === 'wall' || obstacleInPath.type === 'bush') {
                this.tank.shoot();
                this.lastShotTime = Date.now();
            }
        }
    }

    checkObstacleInPath(target) {
        // 计算到目标的距离
        const dx = target.x - this.tank.x;
        const dy = target.y - this.tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 检查路径上的点
        const steps = Math.floor(distance / 10); // 每10像素检查一次
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        for (let i = 1; i < steps; i++) {
            const checkX = this.tank.x + stepX * i;
            const checkY = this.tank.y + stepY * i;
            
            // 检查每个障碍物
            for (const obstacle of game.obstacles) {
                if (obstacle.containsPoint(checkX, checkY)) {
                    return obstacle;
                }
            }
        }
        
        return null;
    }

    destroy() {
        if (this.updateTargetInterval) {
            clearInterval(this.updateTargetInterval);
        }
    }

    circleAroundTarget() {
        if (!this.targetTank) return;
        
        const angle = Math.atan2(
            this.targetTank.y - this.tank.y,
            this.targetTank.x - this.tank.x
        );
        
        // 计算切线移动方向，使AI绕着目标旋转
        const circleRadius = 200;  // 绕圈半径
        const circleSpeed = 1;     // 绕圈速度
        const circleAngle = angle + Math.PI/2;  // 垂直于目标方向
        
        // 计算目标位置，使AI沿着圆形轨迹移动
        this.targetX = this.targetTank.x + Math.cos(circleAngle) * circleRadius;
        this.targetY = this.targetTank.y + Math.sin(circleAngle) * circleRadius;
        
        // 检查目标位置是否有障碍物
        if (this.checkObstacleInPath({x: this.targetX, y: this.targetY})) {
            // 如果有障碍物，尝试反向绕圈
            this.targetX = this.targetTank.x + Math.cos(circleAngle + Math.PI) * circleRadius;
            this.targetY = this.targetTank.y + Math.sin(circleAngle + Math.PI) * circleRadius;
        }
        
        this.moveToTarget();
    }
}

// 添加障碍物类
class Obstacle {
    constructor(x, y, width, height, type = 'wall') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.health = type === 'wall' ? 100 : (type === 'steel' ? 300 : Infinity);
        
        // 添加固定的破损纹理
        this.cracks = [];
        // 初始化破损纹理的位置
        this.initializeCracks();
    }

    initializeCracks() {
        // 预生成破损纹理的位置
        const maxCracks = 10;
        for (let i = 0; i < maxCracks; i++) {
            this.cracks.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                angle: Math.random() * Math.PI,
                size: Math.random() * 5 + 5
            });
        }
    }

    draw(ctx) {
        // 绘制主体
        switch(this.type) {
            case 'wall':
                ctx.fillStyle = '#8B4513';
                ctx.strokeStyle = '#654321';
                break;
            case 'steel':
                ctx.fillStyle = '#808080';
                ctx.strokeStyle = '#505050';
                break;
            case 'bush':
                ctx.fillStyle = '#228B22';
                ctx.strokeStyle = '#006400';
                break;
        }

        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // 绘制破损效果
        if (this.type !== 'bush' && this.health < 100) {
            const damageLevel = (100 - this.health) / 20; // 0-5的损坏等级
            const visibleCracks = Math.floor(damageLevel * 2); // 显示的裂数量
            
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // 绘制裂痕
            for (let i = 0; i < visibleCracks && i < this.cracks.length; i++) {
                const crack = this.cracks[i];
                const alpha = Math.min(1, damageLevel - i/2);
                
                ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                // 绘制星形裂痕
                for (let j = 0; j < 4; j++) {
                    const angle = crack.angle + j * Math.PI / 2;
                    ctx.moveTo(crack.x, crack.y);
                    ctx.lineTo(
                        crack.x + Math.cos(angle) * crack.size,
                        crack.y + Math.sin(angle) * crack.size
                    );
                }
                
                ctx.stroke();
            }
            
            // 添加阴影效果
            if (damageLevel > 2) {
                ctx.fillStyle = `rgba(0,0,0,${(damageLevel-2) * 0.1})`;
                ctx.fillRect(0, 0, this.width, this.height);
            }
            
            ctx.restore();
        }
    }

    takeDamage(damage) {
        if (this.type === 'bush') return false;
        
        const oldHealth = this.health;
        this.health -= damage;
        
        // 如果跨越了损坏等级，重新计算裂痕位置
        if (Math.floor(oldHealth / 20) !== Math.floor(this.health / 20)) {
            this.initializeCracks();
        }
        
        return this.health <= 0;
    }

    // 检查点是否在障碍物内
    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
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
        this.obstacles = [];  // 添加障碍物数组
        this.gameStats = document.getElementById('gameStats');

        // 添加性能优化相关属性
        this.frameCount = 0;
        this.lastPerformanceCheck = performance.now();
        this.fpsHistory = [];
        this.garbageCollectInterval = 10000; // 10秒进行一次垃圾回收
        this.lastGarbageCollect = performance.now();
        
        // 对象池
        this.bulletPool = [];
        this.effectPool = [];
        this.maxPoolSize = 100;

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
        
        // 修改玩家1的控制键，使用J键射击
        const player1Tank = new Tank(200, 300, 'blue', {
            up: 'w',
            down: 's',
            left: 'a',
            right: 'd',
            shoot: 'KeyJ'
        });
        this.tanks.push(player1Tank);

        const gameMode = document.getElementById('gameMode').value;
        
        if (gameMode === 'pvp') {
            // 双人对战模式
            const player2Tank = new Tank(600, 300, 'red', {
                up: 'ArrowUp',
                down: 'ArrowDown',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                shoot: 'Numpad0'
            });
            this.tanks.push(player2Tank);
        } else if (gameMode === 'pve' || gameMode === 'multi') {
            // PVE 或多人混战模式
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

        // 初始化障碍物
        this.initializeObstacles();

        // 开始游戏循环
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    gameLoop(currentTime) {
        if (!this.isGameRunning) return;

        // 性能监控
        this.frameCount++;
        if (currentTime - this.lastPerformanceCheck > 1000) {
            const fps = this.frameCount * 1000 / (currentTime - this.lastPerformanceCheck);
            this.fpsHistory.push(fps);
            if (this.fpsHistory.length > 60) this.fpsHistory.shift();
            
            this.frameCount = 0;
            this.lastPerformanceCheck = currentTime;
            
            // 如果FPS过低，进行优化
            if (this.getAverageFPS() < 30) {
                this.optimizePerformance();
            }
        }

        // 定期垃圾回收
        if (currentTime - this.lastGarbageCollect > this.garbageCollectInterval) {
            this.cleanupResources();
            this.lastGarbageCollect = currentTime;
        }

        const deltaTime = Math.min(currentTime - this.lastFrameTime, 32); // 限制最大帧时间为32ms
        this.lastFrameTime = currentTime;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    getAverageFPS() {
        if (this.fpsHistory.length === 0) return 60;
        return this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
    }

    optimizePerformance() {
        // 减少特效数量
        this.tanks.forEach(tank => {
            if (tank.hitEffects.length > 5) {
                tank.hitEffects.length = 5;
            }
        });

        // 清理远处的子弹
        this.tanks.forEach(tank => {
            tank.bullets = tank.bullets.filter(bullet => {
                const inRange = bullet.x >= -100 && bullet.x <= this.canvas.width + 100 &&
                              bullet.y >= -100 && bullet.y <= this.canvas.height + 100;
                if (!inRange) {
                    this.returnBulletToPool(bullet);
                }
                return inRange;
            });
        });
    }

    cleanupResources() {
        // 清理对象池
        if (this.bulletPool.length > this.maxPoolSize) {
            this.bulletPool.length = this.maxPoolSize;
        }
        if (this.effectPool.length > this.maxPoolSize) {
            this.effectPool.length = this.maxPoolSize;
        }

        // 清理音频上下文
        this.tanks.forEach(tank => {
            if (tank.engineOscillator && !tank.moveState.up && !tank.moveState.down) {
                tank.engineOscillator.stop();
                tank.engineOscillator = null;
            }
        });
    }

    update(deltaTime) {
        // 更新AI控制器
        this.aiControllers.forEach(controller => {
            controller.update(this.tanks, deltaTime);  // 传递 deltaTime 到 AI 控制器
        });

        // 更新坦
        this.tanks.forEach(tank => tank.update(deltaTime));  // 传递 deltaTime 到坦克
        
        // 检查碰撞
        this.checkCollisions();
        
        // 定期生成道具
        if (Date.now() - this.lastPowerUpTime > 10000) {
            this.spawnPowerUp();
            this.lastPowerUpTime = Date.now();
        }
    }

    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制道具
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        
        // 先绘制非草丛障碍物
        this.obstacles.filter(obs => obs.type !== 'bush').forEach(obstacle => {
            obstacle.draw(this.ctx);
        });
        
        // 绘制坦克
        this.tanks.forEach(tank => tank.draw(this.ctx));
        
        // 最后绘制草丛，实现遮挡效果
        this.obstacles.filter(obs => obs.type === 'bush').forEach(obstacle => {
            obstacle.draw(this.ctx);
        });
        
        // 绘制分数
        this.ctx.fillStyle = 'black';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`蓝方: ${this.tanks[0].score}`, 10, 30);
        if (this.tanks[1]) {
            this.ctx.fillText(`${this.tanks[1].color}方: ${this.tanks[1].score}`, this.canvas.width - 100, 30);
        }

        // 更新状态面板
        this.updateGameStats();
    }

    handleKeyDown(e) {
        const key = e.code;
        
        // 防止空格键的默认行为（页面滚动）
        if (key === 'Space') {
            e.preventDefault();
            return;  // 直接返回，不处理空格键
        }
        
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
                case 'KeyJ':      // 玩家1射击键
                case 'Numpad0':   // 玩家2射击键
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
            tank.bullets = tank.bullets.filter(bullet => {
                // 检查子弹是否击中障碍物
                for (let obstacle of this.obstacles) {
                    if (obstacle.containsPoint(bullet.x, bullet.y)) {
                        if (obstacle.type !== 'bush') {
                            if (obstacle.takeDamage(bullet.damage)) {
                                // 如果是普通墙，被摧毁后移除
                                if (obstacle.type === 'wall') {
                                    this.obstacles = this.obstacles.filter(obs => obs !== obstacle);
                                }
                            }
                            return false;  // 子弹消失
                        }
                    }
                }

                // 检查子弹是否击中坦克
                let hitTank = false;
                this.tanks.forEach(otherTank => {
                    if (tank === otherTank) return; // 跳过自己
                    
                    const hitResult = otherTank.isHit(bullet);
                    if (hitResult.hit) {
                        hitTank = true;
                        // 应用伤害并检查击杀
                        if (otherTank.takeDamage(hitResult.damage, bullet.type)) {
                            tank.score += 1;
                            // 检查游戏结束条件
                            const aliveTanks = this.tanks.filter(t => t.health > 0);
                            if (aliveTanks.length <= 1) {
                                this.endGame(tank);
                            } else {
                                this.tanks = this.tanks.filter(t => t.health > 0);
                                this.aiControllers = this.aiControllers.filter(ai => ai.tank.health > 0);
                            }
                        }
                    }
                });

                // 如果子弹击中了坦克或障碍物，返回false使其消失
                return !hitTank && bullet.isActive();
            });
        });

        // 检查坦克与障碍物的碰撞
        this.tanks.forEach(tank => {
            this.obstacles.forEach(obstacle => {
                if (obstacle.type === 'bush') return;  // 草丛不影响移动

                const tankBox = {
                    left: tank.x - tank.width/2,
                    right: tank.x + tank.width/2,
                    top: tank.y - tank.height/2,
                    bottom: tank.y + tank.height/2
                };

                const obsBox = {
                    left: obstacle.x,
                    right: obstacle.x + obstacle.width,
                    top: obstacle.y,
                    bottom: obstacle.y + obstacle.height
                };

                // 简单的矩形碰撞检测
                if (!(tankBox.right < obsBox.left || 
                      tankBox.left > obsBox.right || 
                      tankBox.bottom < obsBox.top || 
                      tankBox.top > obsBox.bottom)) {
                    // 发生碰撞，将坦克推出障碍物
                    const overlap = {
                        left: obsBox.right - tankBox.left,
                        right: tankBox.right - obsBox.left,
                        top: obsBox.bottom - tankBox.top,
                        bottom: tankBox.bottom - obsBox.top
                    };

                    // 找出最小重叠方向
                    const minOverlap = Math.min(
                        overlap.left, overlap.right,
                        overlap.top, overlap.bottom
                    );

                    if (minOverlap === overlap.left) tank.x += overlap.left;
                    else if (minOverlap === overlap.right) tank.x -= overlap.right;
                    else if (minOverlap === overlap.top) tank.y += overlap.top;
                    else if (minOverlap === overlap.bottom) tank.y -= overlap.bottom;
                }
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

    // 初始化障碍物
    initializeObstacles() {
        this.obstacles = [];

        // 添加边界墙
        const wallThickness = 20;
        this.obstacles.push(
            new Obstacle(0, 0, this.canvas.width, wallThickness, 'steel'),
            new Obstacle(0, this.canvas.height - wallThickness, this.canvas.width, wallThickness, 'steel'),
            new Obstacle(0, 0, wallThickness, this.canvas.height, 'steel'),
            new Obstacle(this.canvas.width - wallThickness, 0, wallThickness, this.canvas.height, 'steel')
        );

        // 添加中心掩体
        this.addCenterCover();
        
        // 添加对称的掩体
        this.addSymmetricCovers();
        
        // 添加随机草丛
        this.addRandomBushes();
    }

    addCenterCover() {
        // 在地图中心添加十字形掩体
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.obstacles.push(
            new Obstacle(centerX - 100, centerY - 20, 200, 40, 'steel'),
            new Obstacle(centerX - 20, centerY - 100, 40, 200, 'steel')
        );
    }

    addSymmetricCovers() {
        // 在地图两侧添加对称的掩体
        const coverPositions = [
            // 左上角掩体组
            { x: 100, y: 100, width: 60, height: 60, type: 'wall' },
            { x: 180, y: 100, width: 40, height: 120, type: 'steel' },
            { x: 100, y: 180, width: 120, height: 40, type: 'wall' },
            
            // 右下角掩体组（对称）
            { x: this.canvas.width - 160, y: this.canvas.height - 160, width: 60, height: 60, type: 'wall' },
            { x: this.canvas.width - 220, y: this.canvas.height - 220, width: 40, height: 120, type: 'steel' },
            { x: this.canvas.width - 220, y: this.canvas.height - 220, width: 120, height: 40, type: 'wall' },
            
            // 左下和右上的小型掩体
            { x: 150, y: this.canvas.height - 150, width: 80, height: 30, type: 'wall' },
            { x: this.canvas.width - 230, y: 120, width: 80, height: 30, type: 'wall' },
            
            // 中部两侧的掩体
            { x: 50, y: this.canvas.height/2 - 40, width: 100, height: 80, type: 'steel' },
            { x: this.canvas.width - 150, y: this.canvas.height/2 - 40, width: 100, height: 80, type: 'steel' }
        ];

        coverPositions.forEach(pos => {
            if (!this.isNearSpawnPoint(pos.x, pos.y, pos.width, pos.height)) {
                this.obstacles.push(new Obstacle(pos.x, pos.y, pos.width, pos.height, pos.type));
            }
        });
    }

    addRandomBushes() {
        // 添加随机分布的草丛
        const bushCount = 12;
        let attempts = 0;
        const maxAttempts = 50; // 防止无限循环
        
        for (let i = 0; i < bushCount && attempts < maxAttempts; i++) {
            const width = Math.random() * 40 + 30;
            const height = Math.random() * 40 + 30;
            const x = Math.random() * (this.canvas.width - width - 100) + 50;
            const y = Math.random() * (this.canvas.height - height - 100) + 50;
            
            // 确保草丛不会完全挡住路径
            if (!this.checkObstacleCollision(x, y, width, height) && 
                !this.isNearSpawnPoint(x, y, width, height) &&
                !this.isBlockingPath(x, y, width, height)) {
                this.obstacles.push(new Obstacle(x, y, width, height, 'bush'));
            } else {
                i--; // 如果位置不合适，重试
                attempts++;
            }
        }
    }

    isBlockingPath(x, y, width, height) {
        // 检查是否会阻塞主要通道
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const pathWidth = 80; // 保持通道宽度

        // 检查是否阻塞十字通道
        const blockingHorizontal = y < centerY + pathWidth/2 && y + height > centerY - pathWidth/2;
        const blockingVertical = x < centerX + pathWidth/2 && x + width > centerX - pathWidth/2;

        return blockingHorizontal && blockingVertical;
    }

    isNearSpawnPoint(x, y, width, height) {
        const spawnPoints = [
            { x: 200, y: 300 },  // 玩家1出生点
            { x: 600, y: 300 }   // 玩家2出生点
        ];

        const safeRadius = 120; // 增加安全区域
        return spawnPoints.some(point => {
            const distance = Math.sqrt(
                Math.pow((x + width/2) - point.x, 2) + 
                Math.pow((y + height/2) - point.y, 2)
            );
            return distance < safeRadius;
        });
    }

    updateGameStats() {
        if (!this.isGameRunning) return;

        let statsHTML = '';
        this.tanks.forEach((tank, index) => {
            const color = tank.color.charAt(0).toUpperCase() + tank.color.slice(1);
            statsHTML += `
                <div class="player-stats">
                    <div class="stat-item">
                        <span>${color}方</span>
                    </div>
                    <div class="stat-item">
                        <span>生命:</span>
                        <div class="health-bar">
                            <div style="width: ${tank.health}%; background: ${tank.health < 30 ? '#ff4757' : '#2ecc71'}"></div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <span>护甲:</span>
                        <div class="armor-bar">
                            <div style="width: ${(tank.armor / 50) * 100}%"></div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <span>得分: ${tank.score}</span>
                    </div>
                </div>
            `;
        });
        
        this.gameStats.innerHTML = statsHTML;
    }

    // 添加对象池管理方法
    getBulletFromPool() {
        return this.bulletPool.pop() || null;
    }

    returnBulletToPool(bullet) {
        if (this.bulletPool.length < this.maxPoolSize) {
            // 重置子弹状态
            bullet.active = false;
            bullet.x = 0;
            bullet.y = 0;
            this.bulletPool.push(bullet);
        }
    }

    getEffectFromPool() {
        return this.effectPool.pop() || null;
    }

    returnEffectToPool(effect) {
        if (this.effectPool.length < this.maxPoolSize) {
            effect.life = 0;
            this.effectPool.push(effect);
        }
    }

    // 添加检查障碍物之间的碰撞方法
    checkObstacleCollision(x, y, width, height) {
        return this.obstacles.some(obs => {
            // 矩形碰撞检测
            const noCollision = x + width < obs.x || 
                              x > obs.x + obs.width ||
                              y + height < obs.y || 
                              y > obs.y + obs.height;
            
            return !noCollision;
        });
    }
}

// 初始化游戏
const game = new Game(); 