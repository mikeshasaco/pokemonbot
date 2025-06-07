# Pokemon Twitter Battle Bot

A Twitter bot that allows users to battle with Pokemon! Users can engage in turn-based battles with the bot using Twitter mentions.

## Features

- Users get assigned a unique Pokemon for battles
- Each Pokemon has 100 health and two attacks
- Turn-based battle system
- Persistent user-Pokemon assignments
- Random bot Pokemon selection for each battle

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Twitter Developer Account with API credentials

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
MONGODB_URI=mongodb://localhost:27017/pokemon-bot
BOT_USERNAME=your_bot_username
```

4. Start MongoDB service on your system

5. Run the bot:
```bash
npm start
```

## How to Play

1. Tweet "@[bot_username] battle" to start a new battle
2. The bot will assign you a Pokemon and choose its own
3. Reply with "attack1" or "attack2" to use your Pokemon's moves
4. Continue battling until either Pokemon's health reaches 0
5. Start a new battle anytime by tweeting "battle" again

## Available Pokemon

- Pikachu (Thunder Shock, Thunderbolt)
- Charmander (Ember, Flamethrower)
- Squirtle (Water Gun, Hydro Pump)
- Bulbasaur (Vine Whip, Solar Beam)

Each Pokemon starts with 100 health, and attacks do either 20 damage (attack1) or 30 damage (attack2).

## Development

To run in development mode with auto-reload:
```bash
npm run dev
``` # pokemonbot
