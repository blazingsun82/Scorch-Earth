// ========================================
// SCORCH ONLINE - Supabase Client
// ========================================

class SupabaseClient {
    constructor() {
        this.client = null;
        this.user = null;
        this.playerData = null;
        this.isOnline = false;
        this.currentGame = null;
        this.gameChannel = null;
    }
    
    async init() {
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
            console.log('Supabase not configured');
            return false;
        }
        
        try {
            this.client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
            
            // Sign in anonymously
            const { data, error } = await this.client.auth.signInAnonymously();
            if (error) throw error;
            
            this.user = data.user;
            this.isOnline = true;
            console.log('Connected to Supabase:', this.user.id);
            
            // Clean up any stale entries
            await this.cleanupStaleData();
            
            return true;
        } catch (err) {
            console.error('Supabase init error:', err);
            this.isOnline = false;
            return false;
        }
    }
    
    // Clean up old data
    async cleanupStaleData() {
        if (!this.isOnline) return;
        
        try {
            // Remove old queue entries
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            await this.client.from('scorch_queue').delete().lt('created_at', tenMinutesAgo);
            
            // Remove self from queue
            await this.client.from('scorch_queue').delete().eq('player_id', this.user.id);
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }
    
    // Get or create player profile
    async getOrCreatePlayer(displayName) {
        if (!this.isOnline) return { id: 'offline', display_name: displayName };
        
        try {
            let { data: player, error } = await this.client
                .from('scorch_players')
                .select('*')
                .eq('id', this.user.id)
                .single();
            
            if (error && error.code === 'PGRST116') {
                // Create new player
                const { data: newPlayer, error: createError } = await this.client
                    .from('scorch_players')
                    .insert({
                        id: this.user.id,
                        display_name: displayName,
                        wins: 0,
                        losses: 0,
                        kills: 0,
                        games_played: 0,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                
                if (createError) throw createError;
                player = newPlayer;
            } else if (error) {
                throw error;
            } else if (player.display_name !== displayName) {
                // Update name
                await this.client
                    .from('scorch_players')
                    .update({ display_name: displayName })
                    .eq('id', this.user.id);
                player.display_name = displayName;
            }
            
            this.playerData = player;
            return player;
        } catch (err) {
            console.error('Get player error:', err);
            return { id: this.user.id, display_name: displayName };
        }
    }
    
    // Join quick match queue
    async joinQueue() {
        if (!this.isOnline) return null;
        
        try {
            // Remove self from queue first
            await this.client.from('scorch_queue').delete().eq('player_id', this.user.id);
            
            // Check for existing games looking for players
            const { data: openGames } = await this.client
                .from('scorch_games')
                .select('*, scorch_game_players(*)')
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(1);
            
            if (openGames && openGames.length > 0) {
                const game = openGames[0];
                const playerCount = game.scorch_game_players?.length || 0;
                
                if (playerCount < game.max_players) {
                    // Join existing game
                    return await this.joinGame(game.id);
                }
            }
            
            // No open games, create one
            return await this.createGame();
        } catch (err) {
            console.error('Join queue error:', err);
            return null;
        }
    }
    
    // Create a new game
    async createGame(isPrivate = false, maxPlayers = 4) {
        if (!this.isOnline) return null;
        
        try {
            const gameCode = this.generateGameCode();
            
            const { data: game, error } = await this.client
                .from('scorch_games')
                .insert({
                    code: gameCode,
                    host_id: this.user.id,
                    status: 'waiting',
                    max_players: maxPlayers,
                    is_private: isPrivate,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // Add self as player
            await this.addPlayerToGame(game.id, 0);
            
            this.currentGame = game;
            return { type: 'created', game };
        } catch (err) {
            console.error('Create game error:', err);
            return null;
        }
    }
    
    // Join existing game
    async joinGame(gameId) {
        if (!this.isOnline) return null;
        
        try {
            // Get game info
            const { data: game, error } = await this.client
                .from('scorch_games')
                .select('*, scorch_game_players(*)')
                .eq('id', gameId)
                .single();
            
            if (error) throw error;
            
            const playerCount = game.scorch_game_players?.length || 0;
            
            // Add self
            await this.addPlayerToGame(gameId, playerCount);
            
            this.currentGame = game;
            return { type: 'joined', game };
        } catch (err) {
            console.error('Join game error:', err);
            return null;
        }
    }
    
    // Join by code
    async joinByCode(code) {
        if (!this.isOnline) return null;
        
        try {
            const { data: game, error } = await this.client
                .from('scorch_games')
                .select('*')
                .eq('code', code.toUpperCase())
                .eq('status', 'waiting')
                .single();
            
            if (error) throw error;
            
            return await this.joinGame(game.id);
        } catch (err) {
            console.error('Join by code error:', err);
            return null;
        }
    }
    
    // Add player to game
    async addPlayerToGame(gameId, slotIndex) {
        const { error } = await this.client
            .from('scorch_game_players')
            .insert({
                game_id: gameId,
                player_id: this.user.id,
                slot_index: slotIndex,
                is_alive: true
            });
        
        if (error) throw error;
    }
    
    // Leave game
    async leaveGame() {
        if (!this.isOnline || !this.currentGame) return;
        
        try {
            await this.client
                .from('scorch_game_players')
                .delete()
                .eq('game_id', this.currentGame.id)
                .eq('player_id', this.user.id);
            
            // If host, delete game
            if (this.currentGame.host_id === this.user.id) {
                await this.client
                    .from('scorch_games')
                    .delete()
                    .eq('id', this.currentGame.id);
            }
            
            this.leaveGameChannel();
            this.currentGame = null;
        } catch (err) {
            console.error('Leave game error:', err);
        }
    }
    
    // Subscribe to game updates
    subscribeToGame(gameId, onUpdate) {
        if (!this.isOnline) return;
        
        this.leaveGameChannel();
        
        this.gameChannel = this.client
            .channel(`scorch-game:${gameId}`)
            .on('broadcast', { event: 'game_update' }, (payload) => {
                onUpdate('game_update', payload.payload);
            })
            .on('broadcast', { event: 'player_joined' }, (payload) => {
                onUpdate('player_joined', payload.payload);
            })
            .on('broadcast', { event: 'player_left' }, (payload) => {
                onUpdate('player_left', payload.payload);
            })
            .on('broadcast', { event: 'game_start' }, (payload) => {
                onUpdate('game_start', payload.payload);
            })
            .on('broadcast', { event: 'turn_update' }, (payload) => {
                onUpdate('turn_update', payload.payload);
            })
            .on('broadcast', { event: 'fire' }, (payload) => {
                onUpdate('fire', payload.payload);
            })
            .on('broadcast', { event: 'player_hit' }, (payload) => {
                onUpdate('player_hit', payload.payload);
            })
            .on('broadcast', { event: 'game_over' }, (payload) => {
                onUpdate('game_over', payload.payload);
            })
            .subscribe();
    }
    
    // Broadcast to game
    broadcast(event, payload) {
        if (!this.gameChannel) return;
        
        this.gameChannel.send({
            type: 'broadcast',
            event: event,
            payload: payload
        });
    }
    
    // Leave game channel
    leaveGameChannel() {
        if (this.gameChannel) {
            this.client.removeChannel(this.gameChannel);
            this.gameChannel = null;
        }
    }
    
    // Start game
    async startGame(terrainSeed, turnOrder) {
        if (!this.currentGame) return;
        
        try {
            await this.client
                .from('scorch_games')
                .update({ 
                    status: 'playing',
                    terrain_seed: terrainSeed,
                    turn_order: turnOrder,
                    current_turn: 0
                })
                .eq('id', this.currentGame.id);
            
            this.broadcast('game_start', { 
                terrainSeed, 
                turnOrder 
            });
        } catch (err) {
            console.error('Start game error:', err);
        }
    }
    
    // Update turn
    async updateTurn(turnIndex) {
        if (!this.currentGame) return;
        
        try {
            await this.client
                .from('scorch_games')
                .update({ current_turn: turnIndex })
                .eq('id', this.currentGame.id);
            
            this.broadcast('turn_update', { turnIndex });
        } catch (err) {
            console.error('Update turn error:', err);
        }
    }
    
    // Broadcast fire
    broadcastFire(playerId, angle, power) {
        this.broadcast('fire', { playerId, angle, power });
    }
    
    // Broadcast hit
    broadcastHit(hitPlayerId, shooterId) {
        this.broadcast('player_hit', { hitPlayerId, shooterId });
    }
    
    // End game
    async endGame(winnerId) {
        if (!this.currentGame) return;
        
        try {
            await this.client
                .from('scorch_games')
                .update({ 
                    status: 'finished',
                    winner_id: winnerId
                })
                .eq('id', this.currentGame.id);
            
            // Update player stats
            if (winnerId === this.user.id && this.playerData) {
                await this.client
                    .from('scorch_players')
                    .update({
                        wins: (this.playerData.wins || 0) + 1,
                        games_played: (this.playerData.games_played || 0) + 1
                    })
                    .eq('id', this.user.id);
            } else if (this.playerData) {
                await this.client
                    .from('scorch_players')
                    .update({
                        losses: (this.playerData.losses || 0) + 1,
                        games_played: (this.playerData.games_played || 0) + 1
                    })
                    .eq('id', this.user.id);
            }
            
            this.broadcast('game_over', { winnerId });
        } catch (err) {
            console.error('End game error:', err);
        }
    }
    
    // Update kills
    async addKill() {
        if (!this.isOnline || !this.playerData) return;
        
        try {
            await this.client
                .from('scorch_players')
                .update({ kills: (this.playerData.kills || 0) + 1 })
                .eq('id', this.user.id);
            
            this.playerData.kills = (this.playerData.kills || 0) + 1;
        } catch (err) {
            console.error('Add kill error:', err);
        }
    }
    
    // Get leaderboard
    async getLeaderboard(type = 'wins') {
        if (!this.isOnline) return [];
        
        try {
            const column = type === 'kills' ? 'kills' : 'wins';
            
            const { data, error } = await this.client
                .from('scorch_players')
                .select('display_name, wins, kills')
                .order(column, { ascending: false })
                .limit(20);
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Leaderboard error:', err);
            return [];
        }
    }
    
    // Get game players
    async getGamePlayers(gameId) {
        if (!this.isOnline) return [];
        
        try {
            const { data, error } = await this.client
                .from('scorch_game_players')
                .select('*, scorch_players(display_name)')
                .eq('game_id', gameId)
                .order('slot_index');
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Get players error:', err);
            return [];
        }
    }
    
    // Generate game code
    generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

// Export
window.SupabaseClient = SupabaseClient;
