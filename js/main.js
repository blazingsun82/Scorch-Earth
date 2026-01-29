// ========================================
// SCORCH ONLINE - Main App
// ========================================

class ScorchOnline {
    constructor() {
        this.ui = null;
        this.game = null;
        this.supabase = null;
        
        this.isHost = false;
        this.myKills = 0;
    }
    
    async init() {
        // Initialize UI
        this.ui = new UIManager();
        
        // Initialize Supabase
        this.supabase = new SupabaseClient();
        window.Supabase = this.supabase;
        
        const connected = await this.supabase.init();
        if (!connected) {
            console.warn('Running in offline mode');
        }
        
        // Initialize game engine
        const canvas = document.getElementById('game-canvas');
        const bgCanvas = document.getElementById('background');
        this.game = new ScorchGame(canvas, bgCanvas);
        
        // Bind events
        this.bindEvents();
        
        // Handle resize
        window.addEventListener('resize', () => {
            if (this.ui.currentScreen === 'game') {
                this.game.resize();
                this.game.draw();
            }
        });
        
        console.log('Scorch Online ready!');
    }
    
    bindEvents() {
        // Quick match
        this.ui.btnQuickMatch.addEventListener('click', () => this.quickMatch());
        
        // Private game
        this.ui.btnPrivate.addEventListener('click', () => this.createPrivateGame());
        
        // Leaderboard
        this.ui.btnLeaderboard.addEventListener('click', () => {
            this.ui.showScreen('leaderboard');
        });
        
        // Cancel search
        this.ui.btnCancel.addEventListener('click', () => {
            this.ui.showSearching(false);
            this.supabase.leaveGame();
        });
        
        // Back from leaderboard
        this.ui.btnBack.addEventListener('click', () => {
            this.ui.showScreen('menu');
        });
        
        // Lobby buttons
        this.ui.btnStartGame.addEventListener('click', () => this.startGame());
        this.ui.btnLeaveLobby.addEventListener('click', () => this.leaveLobby());
        
        // Game controls
        this.ui.angleSlider.addEventListener('input', () => {
            this.game.setAngle(this.ui.getAngle());
        });
        
        this.ui.powerSlider.addEventListener('input', () => {
            this.game.setPower(this.ui.getPower());
        });
        
        this.ui.btnFire.addEventListener('click', () => this.fire());
        
        // Result buttons
        this.ui.btnPlayAgain.addEventListener('click', () => this.playAgain());
        this.ui.btnToMenu.addEventListener('click', () => this.backToMenu());
        
        // Game callbacks
        this.game.onTurnChange = (turnIndex) => this.onTurnChange(turnIndex);
        this.game.onPlayerHit = (hitId, shooterId) => this.onPlayerHit(hitId, shooterId);
        this.game.onGameOver = (winnerId) => this.onGameOver(winnerId);
    }
    
    async quickMatch() {
        const name = this.ui.getPlayerName();
        await this.supabase.getOrCreatePlayer(name);
        
        this.ui.showSearching(true);
        
        const result = await this.supabase.joinQueue();
        
        this.ui.showSearching(false);
        
        if (!result) {
            alert('Failed to find match. Try again!');
            return;
        }
        
        this.isHost = result.type === 'created';
        this.setupLobby(result.game);
    }
    
    async createPrivateGame() {
        const name = this.ui.getPlayerName();
        await this.supabase.getOrCreatePlayer(name);
        
        const maxPlayers = parseInt(this.ui.maxPlayersSelect.value);
        const result = await this.supabase.createGame(true, maxPlayers);
        
        if (!result) {
            alert('Failed to create game. Try again!');
            return;
        }
        
        this.isHost = true;
        this.setupLobby(result.game);
    }
    
    async setupLobby(game) {
        // Subscribe to game updates
        this.supabase.subscribeToGame(game.id, (event, data) => {
            this.handleGameEvent(event, data);
        });
        
        // Get current players
        const players = await this.supabase.getGamePlayers(game.id);
        
        this.ui.updateLobby(game, players, this.isHost);
        this.ui.showScreen('lobby');
        
        // Poll for player updates (simple approach)
        this.lobbyPollInterval = setInterval(async () => {
            if (this.ui.currentScreen !== 'lobby') {
                clearInterval(this.lobbyPollInterval);
                return;
            }
            
            const players = await this.supabase.getGamePlayers(game.id);
            this.ui.updateLobby(game, players, this.isHost);
        }, 2000);
    }
    
    async leaveLobby() {
        clearInterval(this.lobbyPollInterval);
        await this.supabase.leaveGame();
        this.ui.showScreen('menu');
    }
    
    async startGame() {
        if (!this.isHost) return;
        
        const players = await this.supabase.getGamePlayers(this.supabase.currentGame.id);
        
        if (players.length < CONFIG.MIN_PLAYERS) {
            alert('Need at least 2 players to start!');
            return;
        }
        
        // Generate terrain seed
        const terrainSeed = Math.floor(Math.random() * 100000);
        
        // Generate turn order (shuffle player IDs)
        const turnOrder = players.map(p => p.player_id).sort(() => Math.random() - 0.5);
        
        // Start game
        await this.supabase.startGame(terrainSeed, turnOrder);
        
        // Initialize locally
        this.initGameplay(players, terrainSeed, turnOrder);
    }
    
    initGameplay(players, terrainSeed, turnOrder) {
        clearInterval(this.lobbyPollInterval);
        
        // Reorder players by turn order
        const orderedPlayers = turnOrder.map(id => players.find(p => p.player_id === id));
        
        this.game.resize();
        this.game.initGame(orderedPlayers, this.supabase.user.id, terrainSeed);
        
        this.ui.showScreen('game');
        this.ui.setupGameHUD(this.game.players, this.supabase.user.id);
        
        this.myKills = 0;
        
        this.updateTurnUI();
    }
    
    handleGameEvent(event, data) {
        switch (event) {
            case 'game_start':
                // Another player started the game
                this.supabase.getGamePlayers(this.supabase.currentGame.id).then(players => {
                    this.initGameplay(players, data.terrainSeed, data.turnOrder);
                });
                break;
                
            case 'turn_update':
                this.game.currentTurnIndex = data.turnIndex;
                this.game.updateTurnState();
                this.updateTurnUI();
                this.game.draw();
                break;
                
            case 'fire':
                if (data.playerId !== this.supabase.user.id) {
                    this.game.fire(data.playerId, data.angle, data.power);
                }
                break;
                
            case 'player_hit':
                this.ui.markPlayerDead(data.hitPlayerId);
                break;
                
            case 'game_over':
                const winner = this.game.players.find(p => p.id === data.winnerId);
                const won = data.winnerId === this.supabase.user.id;
                this.ui.showResult(won, winner?.name || 'Unknown', { kills: this.myKills });
                break;
                
            case 'player_left':
                // Handle player disconnect
                console.log('Player left:', data);
                break;
        }
    }
    
    updateTurnUI() {
        const currentPlayer = this.game.getCurrentPlayer();
        this.ui.updateTurn(currentPlayer, this.game.isMyTurn);
    }
    
    fire() {
        if (!this.game.isMyTurn || this.game.state !== 'playing') return;
        
        const angle = this.ui.getAngle();
        const power = this.ui.getPower();
        const player = this.game.getLocalPlayer();
        
        this.ui.setFiring(true);
        
        // Broadcast fire
        this.supabase.broadcastFire(player.id, angle, power);
        
        // Fire locally
        this.game.fire(player.id, angle, power);
    }
    
    onTurnChange(turnIndex) {
        // Broadcast turn change (only host)
        if (this.isHost) {
            this.supabase.updateTurn(turnIndex);
        }
        
        this.updateTurnUI();
        this.ui.setFiring(false);
    }
    
    onPlayerHit(hitPlayerId, shooterId) {
        // Broadcast hit
        this.supabase.broadcastHit(hitPlayerId, shooterId);
        
        this.ui.markPlayerDead(hitPlayerId);
        
        // Track kills
        if (shooterId === this.supabase.user.id) {
            this.myKills++;
            this.supabase.addKill();
        }
    }
    
    onGameOver(winnerId) {
        // End game (only host)
        if (this.isHost) {
            this.supabase.endGame(winnerId);
        }
        
        const winner = this.game.players.find(p => p.id === winnerId);
        const won = winnerId === this.supabase.user.id;
        
        this.ui.showResult(won, winner?.name || 'Unknown', { kills: this.myKills });
    }
    
    playAgain() {
        this.ui.hideResult();
        this.supabase.leaveGame();
        this.quickMatch();
    }
    
    backToMenu() {
        this.ui.hideResult();
        this.supabase.leaveGame();
        this.ui.showScreen('menu');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    const app = new ScorchOnline();
    await app.init();
    window.ScorchApp = app;
});
