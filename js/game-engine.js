// ========================================
// SCORCH ONLINE - Game Engine
// ========================================

class ScorchGame {
    constructor(canvas, bgCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bgCanvas = bgCanvas;
        this.bgCtx = bgCanvas.getContext('2d');
        
        // Game state
        this.state = 'idle'; // idle, playing, firing, gameOver
        this.players = [];
        this.currentTurnIndex = 0;
        this.terrainData = null;
        this.withTanksData = null;
        
        // Local player
        this.localPlayerId = null;
        this.isMyTurn = false;
        
        // Callbacks
        this.onTurnChange = null;
        this.onPlayerHit = null;
        this.onGameOver = null;
        
        this.resize();
    }
    
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.bgCanvas.width = container.clientWidth;
        this.bgCanvas.height = container.clientHeight;
        
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }
    
    // Initialize game with players
    initGame(players, localPlayerId, terrainSeed) {
        this.players = players.map((p, i) => ({
            id: p.player_id,
            name: p.scorch_players?.display_name || `Player ${i + 1}`,
            color: CONFIG.PLAYER_COLORS[i],
            slotIndex: i,
            isAlive: true,
            x: 0,
            y: 0,
            angle: 90,
            power: 80
        }));
        
        this.localPlayerId = localPlayerId;
        this.state = 'playing';
        this.currentTurnIndex = 0;
        
        // Generate terrain
        this.generateTerrain(terrainSeed);
        
        // Place tanks
        this.placeTanks();
        
        // Draw everything
        this.draw();
        
        this.updateTurnState();
    }
    
    // Generate random terrain with seed
    generateTerrain(seed) {
        // Simple seeded random
        const seededRandom = (s) => {
            const x = Math.sin(s) * 10000;
            return x - Math.floor(x);
        };
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw gradient background
        const gradient = this.bgCtx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#1a0a2e');
        gradient.addColorStop(0.5, '#2d1b4e');
        gradient.addColorStop(1, '#4a2c7a');
        this.bgCtx.fillStyle = gradient;
        this.bgCtx.fillRect(0, 0, this.width, this.height);
        
        // Generate terrain
        let slopeChange = 1;
        let maxSlope = 3.5;
        let slope = seededRandom(seed) * slopeChange - slopeChange;
        let height = this.height * 0.5;
        let valley = this.height * 0.7;
        let peak = this.height * 0.3;
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);
        
        for (let i = 0; i < this.width; i++) {
            height += slope;
            slope += seededRandom(seed + i) * slopeChange * 2 - slopeChange;
            
            if (slope > maxSlope || slope < -maxSlope) {
                slope = seededRandom(seed + i * 2) * slopeChange * 2 - slopeChange;
            }
            if (height > valley) {
                slope *= -1;
                height -= 2;
            } else if (height < peak) {
                slope *= -1;
                slope += 2;
            }
            
            this.ctx.lineTo(i, height);
        }
        
        this.ctx.lineTo(this.width, this.height);
        this.ctx.closePath();
        this.ctx.fillStyle = CONFIG.TERRAIN_COLOR;
        this.ctx.fill();
        
        this.terrainData = this.ctx.getImageData(0, 0, this.width, this.height);
    }
    
    // Place tanks on terrain
    placeTanks() {
        const numPlayers = this.players.length;
        const sectionWidth = this.width / numPlayers;
        
        for (let i = 0; i < numPlayers; i++) {
            // Random X within section
            const minX = sectionWidth * i + 30;
            const maxX = sectionWidth * (i + 1) - 30;
            const x = minX + Math.random() * (maxX - minX);
            
            // Find Y (top of terrain)
            const y = this.findTerrainY(x);
            
            this.players[i].x = x;
            this.players[i].y = y;
        }
    }
    
    // Find terrain height at X
    findTerrainY(x) {
        const imageData = this.terrainData;
        const ix = Math.floor(x);
        
        for (let y = 0; y < this.height; y++) {
            const index = (y * this.width + ix) * 4;
            if (imageData.data[index + 3] > 0) {
                return y;
            }
        }
        return this.height * 0.5;
    }
    
    // Draw game
    draw() {
        // Restore terrain
        this.ctx.putImageData(this.terrainData, 0, 0);
        
        // Draw all tanks
        for (const player of this.players) {
            if (player.isAlive) {
                this.drawTank(player);
            }
        }
        
        // Save with tanks
        this.withTanksData = this.ctx.getImageData(0, 0, this.width, this.height);
    }
    
    // Draw single tank
    drawTank(player) {
        const { x, y, color, angle } = player;
        const ctx = this.ctx;
        
        // Tank body (half circle)
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.TANK_RADIUS, Math.PI, 0, false);
        ctx.fillStyle = color.hex;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Cannon
        const radians = (angle - 90) * (Math.PI / 180);
        const cannonEndX = x + Math.cos(radians) * CONFIG.CANNON_LENGTH;
        const cannonEndY = y + Math.sin(radians) * CONFIG.CANNON_LENGTH;
        
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(cannonEndX, cannonEndY);
        ctx.strokeStyle = color.hex;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Highlight on active player
        if (this.players[this.currentTurnIndex]?.id === player.id) {
            ctx.beginPath();
            ctx.arc(x, y - 5, CONFIG.TANK_RADIUS + 5, Math.PI, 0, false);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    // Set angle for local player
    setAngle(angle) {
        const player = this.getLocalPlayer();
        if (player && this.isMyTurn) {
            player.angle = angle;
            this.draw();
        }
    }
    
    // Set power for local player
    setPower(power) {
        const player = this.getLocalPlayer();
        if (player && this.isMyTurn) {
            player.power = power;
        }
    }
    
    // Fire cannon
    fire(playerId, angle, power) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isAlive) return;
        
        this.state = 'firing';
        
        // Calculate projectile
        const radians = angle * Math.PI / 180;
        const vx = power * Math.cos(radians);
        const vy = power * Math.sin(radians);
        
        // Animate projectile
        this.animateProjectile(player, vx, vy);
    }
    
    // Animate projectile flight
    animateProjectile(player, vx, vy) {
        let time = 0;
        const startX = player.x;
        const startY = player.y;
        const stepSize = CONFIG.PROJECTILE_SPEED;
        const trail = [];
        
        const animate = () => {
            time += stepSize;
            
            const x = startX - vx * time / 2;
            const y = startY - vy * time + (CONFIG.GRAVITY * time * time) / 2;
            
            // Draw trail
            trail.push({ x, y });
            this.ctx.putImageData(this.withTanksData, 0, 0);
            
            // Draw trail line
            if (trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(trail[0].x, trail[0].y);
                for (const point of trail) {
                    this.ctx.lineTo(point.x, point.y);
                }
                this.ctx.strokeStyle = player.color.hex;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            
            // Draw projectile
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();
            
            // Check collision
            if (time > 0.3) {
                const collision = this.checkCollision(x, y);
                
                if (collision.hit) {
                    this.handleCollision(x, y, collision, player.id);
                    return;
                }
            }
            
            // Out of bounds
            if (x < -50 || x > this.width + 50 || y > this.height + 50) {
                this.handleMiss();
                return;
            }
            
            // Continue animation
            if (time < 100) {
                requestAnimationFrame(animate);
            } else {
                this.handleMiss();
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // Check collision at point
    checkCollision(x, y) {
        // Check terrain
        const imageData = this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        
        if (imageData[3] > 0) {
            // Check if it's a tank
            for (const p of this.players) {
                if (!p.isAlive) continue;
                
                const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
                if (dist < CONFIG.TANK_RADIUS + 5) {
                    return { hit: true, type: 'tank', player: p };
                }
            }
            
            return { hit: true, type: 'terrain' };
        }
        
        return { hit: false };
    }
    
    // Handle collision
    handleCollision(x, y, collision, shooterId) {
        // Create explosion
        this.createExplosion(x, y);
        
        setTimeout(() => {
            if (collision.type === 'tank') {
                // Player hit!
                collision.player.isAlive = false;
                
                if (this.onPlayerHit) {
                    this.onPlayerHit(collision.player.id, shooterId);
                }
            }
            
            // Remove terrain in explosion radius
            this.destroyTerrain(x, y);
            
            // Redraw
            this.draw();
            
            // Check for game over
            const alivePlayers = this.players.filter(p => p.isAlive);
            if (alivePlayers.length <= 1) {
                this.state = 'gameOver';
                if (this.onGameOver) {
                    this.onGameOver(alivePlayers[0]?.id || null);
                }
            } else {
                this.nextTurn();
            }
        }, 500);
    }
    
    // Handle miss
    handleMiss() {
        setTimeout(() => {
            this.draw();
            this.nextTurn();
        }, 200);
    }
    
    // Create explosion visual
    createExplosion(x, y) {
        const ctx = this.ctx;
        const radius = CONFIG.EXPLOSION_RADIUS;
        
        // Animate explosion
        let frame = 0;
        const maxFrames = 15;
        
        const drawExplosion = () => {
            const progress = frame / maxFrames;
            const currentRadius = radius * progress;
            
            ctx.beginPath();
            ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
            
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${1 - progress})`);
            gradient.addColorStop(0.3, `rgba(255, 200, 0, ${1 - progress})`);
            gradient.addColorStop(0.6, `rgba(255, 100, 0, ${0.8 - progress * 0.8})`);
            gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            frame++;
            if (frame < maxFrames) {
                requestAnimationFrame(drawExplosion);
            }
        };
        
        drawExplosion();
    }
    
    // Destroy terrain at point
    destroyTerrain(cx, cy) {
        const radius = CONFIG.EXPLOSION_RADIUS;
        const imageData = this.terrainData;
        
        for (let x = cx - radius; x < cx + radius; x++) {
            for (let y = cy - radius; y < cy + radius; y++) {
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if (dist < radius && x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
                    imageData.data[index + 3] = 0; // Set alpha to 0
                }
            }
        }
    }
    
    // Next turn
    nextTurn() {
        // Find next alive player
        let nextIndex = (this.currentTurnIndex + 1) % this.players.length;
        let attempts = 0;
        
        while (!this.players[nextIndex].isAlive && attempts < this.players.length) {
            nextIndex = (nextIndex + 1) % this.players.length;
            attempts++;
        }
        
        this.currentTurnIndex = nextIndex;
        this.state = 'playing';
        this.updateTurnState();
        
        if (this.onTurnChange) {
            this.onTurnChange(nextIndex);
        }
        
        this.draw();
    }
    
    // Update turn state
    updateTurnState() {
        const currentPlayer = this.players[this.currentTurnIndex];
        this.isMyTurn = currentPlayer?.id === this.localPlayerId;
    }
    
    // Get local player
    getLocalPlayer() {
        return this.players.find(p => p.id === this.localPlayerId);
    }
    
    // Get current player
    getCurrentPlayer() {
        return this.players[this.currentTurnIndex];
    }
}

// Export
window.ScorchGame = ScorchGame;
