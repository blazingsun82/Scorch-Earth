// ========================================
// SCORCH ONLINE - UI Manager
// ========================================

class UIManager {
    constructor() {
        // Screens
        this.menuScreen = document.getElementById('menu-screen');
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.leaderboardScreen = document.getElementById('leaderboard-screen');
        this.gameScreen = document.getElementById('game-screen');
        
        // Menu elements
        this.playerNameInput = document.getElementById('player-name');
        this.btnSolo = document.getElementById('btn-solo');
        this.btnQuickMatch = document.getElementById('btn-quick-match');
        this.btnPrivate = document.getElementById('btn-private');
        this.btnLeaderboard = document.getElementById('btn-leaderboard');
        this.queueStatus = document.getElementById('queue-status');
        this.searchingStatus = document.getElementById('searching-status');
        this.btnCancel = document.getElementById('btn-cancel');
        
        // Lobby elements
        this.lobbyCode = document.getElementById('lobby-code');
        this.lobbyPlayers = document.getElementById('lobby-players');
        this.maxPlayersSelect = document.getElementById('max-players');
        this.btnStartGame = document.getElementById('btn-start-game');
        this.btnLeaveLobby = document.getElementById('btn-leave-lobby');
        
        // Leaderboard elements
        this.leaderboardList = document.getElementById('leaderboard-list');
        this.leaderboardTabs = document.querySelectorAll('.leaderboard-tabs .tab');
        this.btnBack = document.getElementById('btn-back');
        
        // Game elements
        this.playersHud = document.getElementById('players-hud');
        this.turnText = document.getElementById('turn-text');
        this.angleSlider = document.getElementById('angle-slider');
        this.angleValue = document.getElementById('angle-value');
        this.powerSlider = document.getElementById('power-slider');
        this.powerValue = document.getElementById('power-value');
        this.btnFire = document.getElementById('btn-fire');
        
        // Result overlay
        this.resultOverlay = document.getElementById('result-overlay');
        this.resultTitle = document.getElementById('result-title');
        this.resultMessage = document.getElementById('result-message');
        this.resultStats = document.getElementById('result-stats');
        this.btnPlayAgain = document.getElementById('btn-play-again');
        this.btnToMenu = document.getElementById('btn-to-menu');
        
        this.currentScreen = 'menu';
        this.currentLeaderboardTab = 'wins';
        
        this.init();
    }
    
    init() {
        // Load saved name
        const savedName = localStorage.getItem('scorchPlayerName');
        if (savedName) {
            this.playerNameInput.value = savedName;
        }
        
        // Save name on change
        this.playerNameInput.addEventListener('change', () => {
            localStorage.setItem('scorchPlayerName', this.playerNameInput.value);
        });
        
        // Slider updates
        this.angleSlider.addEventListener('input', () => {
            this.angleValue.textContent = this.angleSlider.value + '°';
        });
        
        this.powerSlider.addEventListener('input', () => {
            this.powerValue.textContent = this.powerSlider.value;
        });
        
        // Leaderboard tabs
        this.leaderboardTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.leaderboardTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentLeaderboardTab = tab.dataset.tab;
                this.loadLeaderboard();
            });
        });
    }
    
    getPlayerName() {
        return this.playerNameInput.value.trim() || 'PLAYER';
    }
    
    showScreen(screenName) {
        this.menuScreen.classList.remove('active');
        this.lobbyScreen.classList.remove('active');
        this.leaderboardScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        
        switch (screenName) {
            case 'menu':
                this.menuScreen.classList.add('active');
                break;
            case 'lobby':
                this.lobbyScreen.classList.add('active');
                break;
            case 'leaderboard':
                this.leaderboardScreen.classList.add('active');
                this.loadLeaderboard();
                break;
            case 'game':
                this.gameScreen.classList.add('active');
                break;
        }
        
        this.currentScreen = screenName;
    }
    
    showSearching(show) {
        if (show) {
            this.searchingStatus.classList.remove('hidden');
            this.queueStatus.classList.add('hidden');
            this.btnQuickMatch.disabled = true;
            this.btnPrivate.disabled = true;
        } else {
            this.searchingStatus.classList.add('hidden');
            this.btnQuickMatch.disabled = false;
            this.btnPrivate.disabled = false;
        }
    }
    
    updateLobby(game, players, isHost) {
        this.lobbyCode.textContent = game.code;
        
        this.lobbyPlayers.innerHTML = players.map((p, i) => `
            <div class="lobby-player">
                <div class="color-dot" style="background: ${CONFIG.PLAYER_COLORS[i].hex}"></div>
                <span class="name">${p.scorch_players?.display_name || 'Player'}</span>
                ${p.player_id === game.host_id ? '<span class="host-badge">HOST</span>' : ''}
            </div>
        `).join('');
        
        console.log('Lobby update - isHost:', isHost, 'players:', players.length);
        
        // Enable start for host with 1+ players (can test solo or wait for more)
        const canStart = isHost && players.length >= 1;
        this.btnStartGame.disabled = !canStart;
        this.maxPlayersSelect.disabled = !isHost;
        
        // Update button text
        if (players.length < CONFIG.MIN_PLAYERS) {
            this.btnStartGame.textContent = `WAITING (${players.length}/${CONFIG.MIN_PLAYERS})`;
        } else {
            this.btnStartGame.textContent = 'START GAME';
        }
    }
    
    setupGameHUD(players, localPlayerId) {
        this.playersHud.innerHTML = players.map(p => `
            <div class="player-hud-item" data-player-id="${p.id}" style="color: ${p.color.hex}">
                <div class="color-dot" style="background: ${p.color.hex}"></div>
                <span>${p.name}</span>
                ${p.id === localPlayerId ? '<span>(You)</span>' : ''}
            </div>
        `).join('');
    }
    
    updateTurn(currentPlayer, isMyTurn) {
        // Update HUD
        document.querySelectorAll('.player-hud-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.playerId === currentPlayer.id) {
                el.classList.add('active');
            }
        });
        
        // Update turn text
        if (isMyTurn) {
            this.turnText.textContent = 'YOUR TURN!';
            this.turnText.style.color = '#ffd93d';
        } else {
            this.turnText.textContent = `${currentPlayer.name}'s turn`;
            this.turnText.style.color = currentPlayer.color.hex;
        }
        
        // Enable/disable controls
        this.btnFire.disabled = !isMyTurn;
        this.angleSlider.disabled = !isMyTurn;
        this.powerSlider.disabled = !isMyTurn;
    }
    
    markPlayerDead(playerId) {
        const el = document.querySelector(`.player-hud-item[data-player-id="${playerId}"]`);
        if (el) {
            el.classList.add('dead');
        }
    }
    
    getAngle() {
        return parseInt(this.angleSlider.value);
    }
    
    getPower() {
        return parseInt(this.powerSlider.value);
    }
    
    setFiring(firing) {
        this.btnFire.disabled = firing;
        this.btnFire.textContent = firing ? 'FIRING...' : 'FIRE!';
    }
    
    showResult(won, winnerName, stats) {
        this.resultTitle.textContent = won ? 'VICTORY!' : 'DEFEAT';
        this.resultTitle.style.color = won ? '#ffd93d' : '#ff4757';
        
        this.resultMessage.textContent = won 
            ? 'You are the last tank standing!' 
            : `${winnerName} wins!`;
        
        this.resultStats.innerHTML = `
            <div>Kills: ${stats.kills || 0}</div>
        `;
        
        this.resultOverlay.classList.remove('hidden');
    }
    
    hideResult() {
        this.resultOverlay.classList.add('hidden');
    }
    
    async loadLeaderboard() {
        this.leaderboardList.innerHTML = '<div style="text-align:center;padding:20px;">Loading...</div>';
        
        let data = [];
        if (window.Supabase) {
            data = await window.Supabase.getLeaderboard(this.currentLeaderboardTab);
        }
        
        if (data.length === 0) {
            this.leaderboardList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);">No players yet!</div>';
            return;
        }
        
        const scoreKey = this.currentLeaderboardTab === 'kills' ? 'kills' : 'wins';
        
        this.leaderboardList.innerHTML = data.map((player, index) => `
            <div class="leaderboard-entry ${index < 3 ? 'top-3' : ''}">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${player.display_name}</span>
                <span class="leaderboard-score">${player[scoreKey] || 0}</span>
            </div>
        `).join('');
    }
}

// Export
window.UIManager = UIManager;
