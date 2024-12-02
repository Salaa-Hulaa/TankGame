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

        // 修改音频相关属性
        this.audioCtx = null;  // 延迟创建音频上下文
        this.engineOscillator = null;
        this.engineGain = null;
        this.isEnginePlaying = false;
        this.engineVolume = 0.02;  // 降低引擎音量
        this.audioNodes = new Set(); // 添加音频节点跟踪

        this.baseSpeed = 180;     // 每秒移动像素数
        this.baseRotateSpeed = 2; // 每秒旋转弧度数
        this.showAimLine = false;  // 添加瞄准线显示控制
    }

    // 初始化音频上下文
    initAudioContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
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

        // 绘制阴影
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // 受击闪烁效果
        const alpha = this.flashTime > 0 ? 0.5 + Math.sin(this.flashTime * 0.4) * 0.5 : 1;
        ctx.globalAlpha = alpha;

        // 绘制坦克主体
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // 履带
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.width/2 - 5, -this.height/2, 5, this.height);
        ctx.fillRect(this.width/2, -this.height/2, 5, this.height);
        
        // 坦克主体
        const gradient = ctx.createLinearGradient(
            -this.width/2, -this.height/2,
            this.width/2, this.height/2
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.getDarkerColor(this.color));
        
        ctx.fillStyle = gradient;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        
        // 圆角矩形主体
        this.roundRect(ctx, -this.width/2, -this.height/2, this.width, this.height, 5);
        
        // 炮塔底座
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 炮管
        ctx.fillStyle = '#333';
        ctx.fillRect(-3, -this.height/2, 6, -20);
        ctx.strokeRect(-3, -this.height/2, 6, -20);
        
        ctx.restore();

        // 绘制生命值和护甲条
        this.drawStatusBars(ctx);

        // 无敌状态效果
        if (this.isInvincible) {
            ctx.strokeStyle = 'rgba(255,255,0,0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 绘制子弹
        this.bullets.forEach(bullet => bullet.draw(ctx));

        // 绘制击中特效
        this.drawHitEffects(ctx);

        // 在绘制坦克后，添加射击路径预测
        if (this.showAimLine) {
            this.drawShootingPath(ctx);
        }

        if (this.shakeAmount > 0) {
            ctx.restore();
        }
        ctx.restore();
    }

    // 辅助方法：绘制圆角矩形
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // 获取颜色的深色版本
    getDarkerColor(color) {
        const colors = {
            'blue': '#1a4f7a',
            'red': '#8b0000',
            'green': '#006400',
            'purple': '#4b0082'
        };
        return colors[color] || color;
    }

    // 绘制状态条
    drawStatusBars(ctx) {
        const barWidth = 50;
        const barHeight = 4;
        const barY = this.y - this.height/2 - 15;
        
        // 血条背景
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth, barHeight);
        
        // 血条
        const healthGradient = ctx.createLinearGradient(
            this.x - barWidth/2, 0,
            this.x + barWidth/2, 0
        );
        healthGradient.addColorStop(0, '#ff4757');
        healthGradient.addColorStop(1, '#ff6b81');
        
        ctx.fillStyle = healthGradient;
        ctx.fillRect(
            this.x - barWidth/2,
            barY,
            barWidth * (this.health / 100),
            barHeight
        );
        
        // 护甲条
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barWidth/2, barY - 5, barWidth, 2);
        
        const armorGradient = ctx.createLinearGradient(
            this.x - barWidth/2, 0,
            this.x + barWidth/2, 0
        );
        armorGradient.addColorStop(0, '#2e86de');
        armorGradient.addColorStop(1, '#54a0ff');
        
        ctx.fillStyle = armorGradient;
        ctx.fillRect(
            this.x - barWidth/2,
            barY - 5,
            barWidth * (this.armor / 50),
            2
        );
    }

    drawHitEffects(ctx) {
        this.hitEffects = this.hitEffects.filter(effect => {
            ctx.save();
            ctx.globalAlpha = effect.life / 20;
            
            // 爆炸效果
            const gradient = ctx.createRadialGradient(
                effect.x, effect.y, 0,
                effect.x, effect.y, (20 - effect.life) * 2
            );
            gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
            gradient.addColorStop(0.3, 'rgba(255,100,0,0.6)');
            gradient.addColorStop(1, 'rgba(255,0,0,0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, (20 - effect.life) * 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
            
            effect.life -= 1;
            return effect.life > 0;
        });
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
        if (this.shootCooldown > 0 || this.bullets.length >= 3) return;

        const bullet = new Bullet(
            this.x + Math.sin(this.angle) * 30,
            this.y - Math.cos(this.angle) * 30,
            this.angle,
            {
                damage: 20,
                speed: 10,
                size: 3
            },
            this.bulletType  // 使用当前坦克的子弹类型
        );

        this.bullets.push(bullet);
        this.shootCooldown = 500;
        this.playShootSound();
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

    // 修改引擎音效方法
    playEngineSound(isMoving) {
        if (!this.audioCtx) {
            this.initAudioContext();
        }

        if (isMoving && !this.isEnginePlaying) {
            try {
                this.stopEngineSound(); // 确保先停止现有音效

                this.engineOscillator = this.audioCtx.createOscillator();
                this.engineGain = this.audioCtx.createGain();
                
                this.engineOscillator.connect(this.engineGain);
                this.engineGain.connect(this.audioCtx.destination);
                
                this.engineOscillator.type = 'triangle';
                this.engineOscillator.frequency.setValueAtTime(40, this.audioCtx.currentTime);
                
                this.engineGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
                this.engineGain.gain.linearRampToValueAtTime(
                    this.engineVolume, 
                    this.audioCtx.currentTime + 0.1
                );
                
                this.engineOscillator.start();
                this.isEnginePlaying = true;

                // 跟踪音频节点
                this.audioNodes.add(this.engineOscillator);
                this.audioNodes.add(this.engineGain);
            } catch (error) {
                console.log('Audio start error:', error);
            }
        } else if (!isMoving && this.isEnginePlaying) {
            this.stopEngineSound();
        }
    }

    // 优化停止引擎音效的方法
    stopEngineSound() {
        if (this.isEnginePlaying) {
            try {
                if (this.engineGain) {
                    this.engineGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
                    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, this.audioCtx.currentTime);
                    this.engineGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);
                }

                setTimeout(() => {
                    try {
                        if (this.engineOscillator) {
                            this.engineOscillator.stop();
                        }
                        // 清理所有音频节点的连接
                        this.audioNodes.forEach(node => {
                            try {
                                node.disconnect();
                            } catch (e) {
                                // 忽略已断开连接的节点
                            }
                        });
                        this.audioNodes.clear();
                        this.engineOscillator = null;
                        this.engineGain = null;
                    } catch (error) {
                        // 忽略清理错误
                    }
                }, 200);
            } catch (error) {
                console.log('Audio stop error:', error);
            }
            this.isEnginePlaying = false;
        }
    }

    // 添加获取碰撞箱��方法
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
            return { hit: true, damage: bullet.damage * 1.5 }; // 炮塔受击���������1.5����害
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

    // ��转矩形碰撞检测
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

    // 修改销毁方法
    destroy() {
        this.stopEngineSound();
        if (this.audioCtx) {
            // 清理所有音频节点
            this.audioNodes.forEach(node => {
                try {
                    node.disconnect();
                } catch (e) {
                    // 忽略已断开连接的节点
                }
            });
            this.audioNodes.clear();
            
            // 关闭音频上下文
            this.audioCtx.close().catch(console.error);
            this.audioCtx = null;
        }
    }

    // 修改射击音效
    playShootSound() {
        if (!this.audioCtx) {
            this.initAudioContext();
        }

        try {
            const oscillator = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(200, this.audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
            
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 0.1);
            
            // 确保清理
            setTimeout(() => {
                oscillator.disconnect();
                gainNode.disconnect();
            }, 200);
        } catch (error) {
            console.log('Shoot sound error:', error);
        }
    }

    // 添加射击路径预测方法
    drawShootingPath(ctx) {
        ctx.save();
        
        // 创建渐变的虚线效果
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.3;

        // 计算射击起点
        const startX = this.x + Math.sin(this.angle) * 30;
        const startY = this.y - Math.cos(this.angle) * 30;

        // 模拟子弹路径
        ctx.beginPath();
        ctx.moveTo(startX, startY);

        // 预测路径点
        let hitPoint = this.predictBulletPath(startX, startY, this.angle);
        
        // 绘制路径线
        ctx.lineTo(hitPoint.x, hitPoint.y);
        ctx.stroke();

        // 绘制命中点
        if (hitPoint.hit) {
            // 绘制命中标记
            ctx.beginPath();
            ctx.arc(hitPoint.x, hitPoint.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = hitPoint.critical ? '#ff0000' : this.color;
            ctx.globalAlpha = 0.5;
            ctx.fill();
        }

        ctx.restore();
    }

    // 预测子弹路径
    predictBulletPath(startX, startY, angle) {
        const step = 5;  // 路径检测步长
        let currentX = startX;
        let currentY = startY;
        const maxSteps = 200;  // 最大检测步数
        
        for (let i = 0; i < maxSteps; i++) {
            // 计算下一个检测点
            currentX += Math.sin(angle) * step;
            currentY -= Math.cos(angle) * step;

            // 检查是否超出边界
            if (currentX < 0 || currentX > game.width || 
                currentY < 0 || currentY > game.height) {
                return {
                    x: currentX,
                    y: currentY,
                    hit: false
                };
            }

            // 检查障碍物碰撞
            for (let obstacle of game.obstacles) {
                if (obstacle.containsPoint(currentX, currentY) && obstacle.type !== 'bush') {
                    return {
                        x: currentX,
                        y: currentY,
                        hit: true,
                        type: obstacle.type
                    };
                }
            }

            // 检查坦克碰撞
            for (let tank of game.tanks) {
                if (tank !== this) {
                    const hitResult = tank.isHit({x: currentX, y: currentY, damage: 0});
                    if (hitResult.hit) {
                        return {
                            x: currentX,
                            y: currentY,
                            hit: true,
                            critical: hitResult.damage > 0,
                            target: tank
                        };
                    }
                }
            }
        }

        // 如果没有击中任何东西
        return {
            x: currentX,
            y: currentY,
            hit: false
        };
    }

    // 添加切换瞄准线的方法
    toggleAimLine() {
        this.showAimLine = !this.showAimLine;
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
        
        // 添加弹道轨迹相关属性
        this.trail = [];
        this.maxTrailLength = 15;  // 轨迹长度
        this.trailOpacity = 0.6;   // 轨迹透明度
    }

    update(deltaTime) {
        // 保存当前位置到轨迹
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.pop();
        }

        // 更新位置
        const speed = this.baseSpeed * (deltaTime / 1000);
        this.x += Math.sin(this.angle) * speed;
        this.y -= Math.cos(this.angle) * speed;

        // 检查边界
        if (this.x < 0 || this.x > game.width || 
            this.y < 0 || this.y > game.height) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.save();
        
        // �����������制轨迹
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            
            // 获取子弹颜色
            const colors = {
                normal: ['#fff', '#ff0'],
                heavy: ['#fff', '#f00'],
                rapid: ['#fff', '#0f0']
            }[this.type] || ['#fff', '#ff0'];

            // 创建轨迹渐变
            const gradient = ctx.createLinearGradient(
                this.trail[0].x, this.trail[0].y,
                this.trail[this.trail.length - 1].x,
                this.trail[this.trail.length - 1].y
            );
            
            gradient.addColorStop(0, `rgba(${this.getColorValues(colors[1])},${this.trailOpacity})`);
            gradient.addColorStop(1, `rgba(${this.getColorValues(colors[1])},0)`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = this.size;
            ctx.lineCap = 'round';

            // 绘制平滑轨迹
            for (let i = 1; i < this.trail.length; i++) {
                const point = this.trail[i];
                const prevPoint = this.trail[i - 1];
                const xc = (point.x + prevPoint.x) / 2;
                const yc = (point.y + prevPoint.y) / 2;
                
                if (i === 1) {
                    ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc);
                } else {
                    ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc);
                }
            }
            ctx.stroke();
        }

        // 绘制子弹本体
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size * 2
        );
        
        const colors = {
            normal: ['#fff', '#ff0'],
            heavy: ['#fff', '#f00'],
            rapid: ['#fff', '#0f0']
        }[this.type] || ['#fff', '#ff0'];
        
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = colors[1];
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    // 辅助方法：将颜色转换为RGB值
    getColorValues(color) {
        const colors = {
            '#ff0': '255,255,0',
            '#f00': '255,0,0',
            '#0f0': '0,255,0'
        };
        return colors[color] || '255,255,0';
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
        ctx.save();
        
        // 道具光晕效果
        const time = Date.now() / 1000;
        const scale = 1 + Math.sin(time * 4) * 0.1;
        
        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);
        
        const colors = {
            health: ['#2ecc71', '#27ae60'],
            armor: ['#3498db', '#2980b9'],
            rapid: ['#f1c40f', '#f39c12'],
            heavy: ['#e74c3c', '#c0392b']
        }[this.type];
        
        // 外圈发光
        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 15);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // 主体
        ctx.fillStyle = colors[0];
        ctx.shadowColor = colors[1];
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
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
        this.lastPositionChange = Date.now();
        this.stuckInCombat = false;
        this.combatRepositionTimer = 0;
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
        const obstacleInPath = this.checkObstacleInPath(this.targetTank);
        
        // 检查是否被钢板阻挡
        if (obstacleInPath && obstacleInPath.type === 'steel') {
            this.handleSteelObstacle();
            return;
        }

        // 正常的追击行为
        const optimalDistance = 200;
        if (distance < optimalDistance - 50) {
            this.tank.moveState.down = true;
        } else if (distance > optimalDistance + 50) {
            this.targetX = this.targetTank.x;
            this.targetY = this.targetTank.y;
            this.moveToTarget();
        } else {
            this.circleAroundTarget();
        }
        
        // 只在有清晰射线时射击
        if (!obstacleInPath || obstacleInPath.type === 'bush') {
            this.aimAndShoot(this.targetTank);
        }
    }

    handleSteelObstacle() {
        // 检查是否卡在钢板前
        const now = Date.now();
        if (!this.stuckInCombat) {
            this.stuckInCombat = true;
            this.combatRepositionTimer = now;
        }

        // 如果卡住超过2秒，寻找新位置
        if (now - this.combatRepositionTimer > 2000) {
            this.findAlternativePosition();
            this.stuckInCombat = false;
        }
    }

    findAlternativePosition() {
        const possiblePositions = this.generateFlankingPositions();
        let bestPosition = null;
        let bestScore = -Infinity;

        possiblePositions.forEach(pos => {
            const score = this.evaluatePosition(pos);
            if (score > bestScore) {
                bestScore = score;
                bestPosition = pos;
            }
        });

        if (bestPosition) {
            this.targetX = bestPosition.x;
            this.targetY = bestPosition.y;
            this.moveToTarget();
        } else {
            // 如果找不到好位置，后退并转向
            this.tank.moveState.down = true;
            this.tank.moveState.right = Math.random() > 0.5;
        }
    }

    generateFlankingPositions() {
        const positions = [];
        const angles = [Math.PI/2, -Math.PI/2, Math.PI/4, -Math.PI/4, 3*Math.PI/4, -3*Math.PI/4];
        const distance = 200;

        angles.forEach(angle => {
            const baseAngle = Math.atan2(
                this.targetTank.y - this.tank.y,
                this.targetTank.x - this.tank.x
            );
            
            const pos = {
                x: this.targetTank.x + Math.cos(baseAngle + angle) * distance,
                y: this.targetTank.y + Math.sin(baseAngle + angle) * distance
            };

            // 确保位置在地图内
            pos.x = Math.max(50, Math.min(game.width - 50, pos.x));
            pos.y = Math.max(50, Math.min(game.height - 50, pos.y));
            
            positions.push(pos);
        });

        return positions;
    }

    evaluatePosition(position) {
        let score = 0;
        
        // 检查从该位置到目标是否有清晰的射击路径
        const hasLineOfSight = !this.checkObstacleInPath({
            x: position.x,
            y: position.y
        });
        if (hasLineOfSight) score += 100;

        // 检查距离是否合适
        const distance = Math.sqrt(
            Math.pow(position.x - this.targetTank.x, 2) +
            Math.pow(position.y - this.targetTank.y, 2)
        );
        const optimalDistance = 200;
        score -= Math.abs(distance - optimalDistance);

        // 检查是否靠近地图边缘
        const edgeDistance = Math.min(
            position.x, game.width - position.x,
            position.y, game.height - position.y
        );
        score -= (100 - edgeDistance) * 0.5;

        // 检查是否有掩护
        game.obstacles.forEach(obs => {
            if (obs.type === 'wall') {
                const distToObs = Math.sqrt(
                    Math.pow(position.x - (obs.x + obs.width/2), 2) +
                    Math.pow(position.y - (obs.y + obs.height/2), 2)
                );
                if (distToObs < 100) score += 50;
            }
        });

        return score;
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
        
        // 添加材质图案
        this.pattern = {
            bricks: [], // 砖块位置
            details: []  // 细节位置
        };
        this.initializePattern();
        
        // 为草丛预生成形状
        if (type === 'bush') {
            this.bushShape = this.generateBushShape();
        }
    }

    initializePattern() {
        // 生成砖块图案
        const brickWidth = 20;
        const brickHeight = 10;
        
        for (let x = 0; x < this.width; x += brickWidth) {
            for (let y = 0; y < this.height; y += brickHeight) {
                // 错���排列
                const offsetX = (y / brickHeight % 2) * (brickWidth / 2);
                this.pattern.bricks.push({
                    x: x + offsetX,
                    y: y,
                    width: Math.min(brickWidth, this.width - x),
                    height: Math.min(brickHeight, this.height - y)
                });
            }
        }

        // 生成细节点
        if (this.type === 'steel') {
            for (let i = 0; i < 10; i++) {
                this.pattern.details.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    radius: Math.random() * 2 + 1
                });
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 添加阴影效果
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        switch(this.type) {
            case 'wall':
                this.drawWall(ctx);
                break;
            case 'steel':
                this.drawSteel(ctx);
                break;
            case 'bush':
                this.drawBush(ctx);
                break;
        }

        // 绘制损坏效果
        if (this.type !== 'bush' && this.health < 100) {
            this.drawDamage(ctx);
        }

        ctx.restore();
    }

    drawWall(ctx) {
        // 绘制基础颜色
        const baseGradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        baseGradient.addColorStop(0, '#8B4513');
        baseGradient.addColorStop(1, '#654321');
        ctx.fillStyle = baseGradient;
        ctx.fillRect(0, 0, this.width, this.height);

        // 绘制砖块图案
        this.pattern.bricks.forEach(brick => {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 1);
            
            // 砖块高光
            const brickGradient = ctx.createLinearGradient(
                brick.x, brick.y,
                brick.x, brick.y + brick.height
            );
            brickGradient.addColorStop(0, 'rgba(255,255,255,0.1)');
            brickGradient.addColorStop(1, 'rgba(0,0,0,0.1)');
            ctx.fillStyle = brickGradient;
            ctx.fillRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 1);
        });
    }

    drawSteel(ctx) {
        // 金属基础渐变
        const metalGradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        metalGradient.addColorStop(0, '#808080');
        metalGradient.addColorStop(0.5, '#A0A0A0');
        metalGradient.addColorStop(1, '#606060');
        
        ctx.fillStyle = metalGradient;
        ctx.fillRect(0, 0, this.width, this.height);

        // 添加金属纹理
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        
        // 绘制斜线纹理
        for (let i = 0; i < this.width + this.height; i += 8) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(0, i);
            ctx.stroke();
        }

        // 添加铆钉效果
        this.pattern.details.forEach(detail => {
            const gradient = ctx.createRadialGradient(
                detail.x, detail.y, 0,
                detail.x, detail.y, detail.radius
            );
            gradient.addColorStop(0, '#FFF');
            gradient.addColorStop(1, '#666');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(detail.x, detail.y, detail.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawBush(ctx) {
        // 增加草丛大小
        const scale = 1.5;
        ctx.scale(scale, scale);
        ctx.translate(-this.width/4, -this.height/4);
        
        // 使用预生成的形状绘制草丛
        this.bushShape.forEach((layerPoints, layerIndex) => {
            // 深浅不同的绿色
            const baseColor = layerIndex === 0 ? '#1a472a' : // 深绿
                            layerIndex === 1 ? '#2d5a27' : // 中绿
                            '#355e20';  // 浅绿
            
            ctx.fillStyle = baseColor;
            ctx.beginPath();
            
            // 确保有足够的点来绘制
            if (layerPoints.length > 0) {
                ctx.moveTo(layerPoints[0].x, layerPoints[0].y);
                
                for (let i = 1; i < layerPoints.length; i++) {
                    const point = layerPoints[i];
                    const prevPoint = layerPoints[i - 1];
                    const cpX = (point.x + prevPoint.x) / 2;
                    const cpY = (point.y + prevPoint.y) / 2;
                    ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpX, cpY);
                }
                
                // 闭合路径
                const firstPoint = layerPoints[0];
                const lastPoint = layerPoints[layerPoints.length - 1];
                const cpX = (firstPoint.x + lastPoint.x) / 2;
                const cpY = (firstPoint.y + lastPoint.y) / 2;
                ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, cpX, cpY);
            }
            
            ctx.closePath();
            ctx.fill();
            
            // 添加纹理
            ctx.save();
            ctx.clip();  // 限制纹理在草丛形状内
            
            // 绘制细小的叶子纹理
            ctx.strokeStyle = `rgba(255,255,255,0.1)`;
            ctx.lineWidth = 0.5;
            
            for (let i = 0; i < 20; i++) {
                const x = Math.sin(i * 7) * this.width/2 + this.width/2;
                const y = Math.cos(i * 5) * this.height/2 + this.height/2;
                const size = 5 + Math.sin(i) * 3;
                
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + size, y + size);
                ctx.stroke();
            }
            
            ctx.restore();
        });

        // 添加环境光效果
        const gradient = ctx.createRadialGradient(
            this.width/2, this.height/2, 0,
            this.width/2, this.height/2, this.width
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0.1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width * scale, this.height * scale);
    }

    drawDamage(ctx) {
        const damageLevel = (100 - this.health) / 20;
        
        // 绘制裂纹
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < damageLevel * 3; i++) {
            const startX = Math.random() * this.width;
            const startY = Math.random() * this.height;
            const length = Math.random() * 20 + 10;
            const angle = Math.random() * Math.PI * 2;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(
                startX + Math.cos(angle) * length,
                startY + Math.sin(angle) * length
            );
            
            // 添加分支裂纹
            if (Math.random() < 0.5) {
                const branchAngle = angle + (Math.random() - 0.5) * Math.PI;
                const branchLength = length * 0.7;
                ctx.lineTo(
                    startX + Math.cos(branchAngle) * branchLength,
                    startY + Math.sin(branchAngle) * branchLength
                );
            }
            
            ctx.stroke();
        }

        // 添加烟尘效果
        if (damageLevel > 3) {
            ctx.fillStyle = `rgba(0,0,0,${(damageLevel - 3) * 0.1})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    // 添加点碰撞检测方法
    containsPoint(x, y) {
        // 检查点是否在障碍物的矩形范围内
        return x >= this.x && 
               x <= this.x + this.width && 
               y >= this.y && 
               y <= this.y + this.height;
    }

    // 添加伤害处理方法（之前被删除了）
    takeDamage(damage) {
        if (this.type === 'bush') return false;
        
        const oldHealth = this.health;
        this.health -= damage;
        
        // 如果跨越了损坏等级，重新生成图案
        if (Math.floor(oldHealth / 20) !== Math.floor(this.health / 20)) {
            this.initializePattern();
        }
        
        return this.health <= 0;
    }

    // 生成固定的草丛形状
    generateBushShape() {
        const shapes = [];
        const layers = 3;
        const numPoints = 12;  // 改名以避免冲突
        
        for (let layer = 0; layer < layers; layer++) {
            const layerPoints = [];  // 改名以避免冲突
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                // 使用固定的随机种子
                const radius = this.width/2 * (0.7 + (Math.sin(angle * 3 + layer) * 0.3));
                layerPoints.push({
                    x: this.width/2 + Math.cos(angle) * radius,
                    y: this.height/2 + Math.sin(angle) * radius
                });
            }
            shapes.push(layerPoints);
        }
        return shapes;
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
        
        // 性能优化相关
        this.frameCount = 0;
        this.fps = 60;
        this.frameInterval = 1000 / 60; // 目标帧率间隔
        this.accumulatedTime = 0;
        
        // 缓存画布尺寸
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // 创建离屏画布用于缓存静态内容
        this.staticCanvas = document.createElement('canvas');
        this.staticCanvas.width = this.width;
        this.staticCanvas.height = this.height;
        this.staticCtx = this.staticCanvas.getContext('2d');
        
        // 用于追踪是否需要重绘静态内容
        this.needsStaticRedraw = true;
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

        // 计算帧时间
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        this.accumulatedTime += deltaTime;

        // 固定时间步长更新
        const maxSteps = 3;  // 防止spiral of death
        let stepCount = 0;
        
        while (this.accumulatedTime >= this.frameInterval && stepCount < maxSteps) {
            this.update(this.frameInterval);
            this.accumulatedTime -= this.frameInterval;
            stepCount++;
        }

        // 如果积累的时间过多，直接丢弃
        if (this.accumulatedTime > this.frameInterval * 2) {
            this.accumulatedTime = 0;
        }

        // 只在需要时重绘静态内容
        if (this.needsStaticRedraw) {
            this.drawStaticContent();
            this.needsStaticRedraw = false;
        }

        // 绘制动态内容
        this.drawDynamicContent();

        // 性能监控
        this.frameCount++;
        if (currentTime - this.lastPerformanceCheck > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastPerformanceCheck = currentTime;
            
            // 如果FPS过低，进行优化
            if (this.fps < 30) {
                this.optimizePerformance();
            }
        }

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    drawStaticContent() {
        // 清空静态画布
        this.staticCtx.clearRect(0, 0, this.width, this.height);
        
        // 绘制所有静态障碍物
        this.obstacles.filter(obs => obs.type !== 'bush').forEach(obstacle => {
            obstacle.draw(this.staticCtx);
        });
    }

    drawDynamicContent() {
        // 清空主画布
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 绘制静态内容
        this.ctx.drawImage(this.staticCanvas, 0, 0);
        
        // 绘制动态内容
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        
        // 先绘制所有子弹的轨迹
        this.tanks.forEach(tank => {
            tank.bullets.forEach(bullet => bullet.draw(this.ctx));
        });
        
        // 然后绘制坦克
        this.tanks.forEach(tank => tank.draw(this.ctx));
        
        // 最后绘制草丛
        this.obstacles.filter(obs => obs.type === 'bush').forEach(obstacle => {
            obstacle.draw(this.ctx);
        });
        
        // 更新状态面板
        this.updateGameStats();
    }

    optimizePerformance() {
        // 减少特效数量
        this.tanks.forEach(tank => {
            if (tank.hitEffects.length > 3) {
                tank.hitEffects.length = 3;
            }
        });

        // 清理远处的子弹
        this.tanks.forEach(tank => {
            tank.bullets = tank.bullets.filter(bullet => {
                return bullet.x >= -50 && 
                       bullet.x <= this.width + 50 && 
                       bullet.y >= -50 && 
                       bullet.y <= this.height + 50;
            });
        });

        // 减少草丛细节
        this.obstacles.forEach(obs => {
            if (obs.type === 'bush') {
                obs.reducedDetail = true;
            }
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
                case 'KeyV':  // 使用V键切换瞄准线
                    tank.toggleAimLine();
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
                                    this.needsStaticRedraw = true;  // 标记需要重绘静态内容
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
                            // 在移除坦克前调用销毁方法
                            otherTank.destroy();
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
        // 清理所有坦克的音频
        this.tanks.forEach(tank => tank.destroy());
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
        const bushCount = 8;  // 减少数量
        let attempts = 0;
        const maxAttempts = 50;
        
        for (let i = 0; i < bushCount && attempts < maxAttempts; i++) {
            // 增加草丛��小
            const width = Math.random() * 60 + 60;  // 60-120
            const height = Math.random() * 60 + 60; // 60-120
            const x = Math.random() * (this.canvas.width - width - 100) + 50;
            const y = Math.random() * (this.canvas.height - height - 100) + 50;
            
            if (!this.checkObstacleCollision(x, y, width, height) && 
                !this.isNearSpawnPoint(x, y, width, height) &&
                !this.isBlockingPath(x, y, width, height)) {
                this.obstacles.push(new Obstacle(x, y, width, height, 'bush'));
            } else {
                i--;
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