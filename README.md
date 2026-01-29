# Scorch Online

A multiplayer online artillery game based on the classic Scorched Earth.

## Features

- **Online Multiplayer** - 2-4 players per match
- **Quick Match** - Jump into a game instantly
- **Private Games** - Create a game with a code and invite friends
- **Leaderboard** - Track top players by wins and kills
- **Mobile Support** - Play on any device
- **Turn-Based Combat** - Adjust angle and power, then fire!

## How to Play

1. Enter your name
2. Click "Quick Match" to find a game or "Private Game" to create one
3. Wait for players to join (minimum 2)
4. Host clicks "Start Game"
5. On your turn:
   - Adjust your cannon angle (10° - 170°)
   - Set power (20 - 150)
   - Click "FIRE!"
6. Last tank standing wins!

## Setup

### 1. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor and run the contents of `supabase-setup.sql`
3. Enable Anonymous Authentication in Authentication > Providers
4. Copy your project URL and anon key

### 2. Configure

Edit `js/config.js` and replace:
```javascript
SUPABASE_URL: 'your-project-url',
SUPABASE_ANON_KEY: 'your-anon-key',
```

### 3. Deploy

Upload all files to Cloudflare Pages, Netlify, or any static host.

## Credits

Based on [Scorch Clone](https://github.com/webermn15/wdi-10-project-1) by Michael Weber (MIT License)

Original game: Scorched Earth (1991)

## License

MIT License - See LICENSE file
