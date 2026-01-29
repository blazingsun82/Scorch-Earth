// ========================================
// SCORCH ONLINE - Configuration
// ========================================

const CONFIG = {
    // Supabase - Replace with your own credentials
    SUPABASE_URL: 'https://qjkfbluckpskcwibsuzh.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa2ZibHVja3Bza2N3aWJzdXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMTY5MjMsImV4cCI6MjA3Nzc5MjkyM30.Ku2u2-UgBGyM2FnKtL3KcjxUCqbtXG6vGeKttADHdIw',
    
    // Game settings
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 4,
    TURN_TIME: 30,              // seconds per turn
    
    // Physics
    GRAVITY: 9.8,
    
    // Tank settings
    TANK_RADIUS: 12,
    CANNON_LENGTH: 18,
    
    // Projectile
    EXPLOSION_RADIUS: 35,
    PROJECTILE_SPEED: 0.02,     // time step
    
    // Terrain
    TERRAIN_COLOR: '#2a1a4a',
    
    // Player colors
    PLAYER_COLORS: [
        { name: 'Blue', hex: '#4a9eff', rgb: [74, 158, 255] },
        { name: 'Red', hex: '#ff4757', rgb: [255, 71, 87] },
        { name: 'Green', hex: '#2ed573', rgb: [46, 213, 115] },
        { name: 'Yellow', hex: '#ffd93d', rgb: [255, 217, 61] }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
