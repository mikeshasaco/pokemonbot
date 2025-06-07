const Pokemon = require('../models/Pokemon');
const User = require('../models/User');
const fs = require('fs').promises;
const path = require('path');

// Get Pokemon image path
const getPokemonImagePath = (pokemonName) => {
  // Map the Pokemon names to their image filenames (all lowercase)
  const imageNames = {
    'Blizzard': 'blizzard',
    'Curselord': 'curselord',
    'Gar': 'gar',
    'Neu': 'neu',
    'Turquoise': 'turquoise'
  };
  
  const imageName = imageNames[pokemonName] || pokemonName.toLowerCase();
  return path.join(__dirname, '../../assets/pokemon', `${imageName}.png`);
};

// Assign Pokemon to user
const assignPokemonToUser = async (userId, requestedPokemon = null) => {
  try {
    let pokemon;
    
    if (requestedPokemon) {
      // If a specific Pokemon is requested, find it
      pokemon = await Pokemon.findOne({ name: new RegExp(requestedPokemon, 'i') });
      if (!pokemon) {
        throw new Error(`Pokemon ${requestedPokemon} not found`);
      }
      pokemon = [pokemon]; // Match the format of aggregate result
    } else {
      // Get all Pokemon first
      const allPokemon = await Pokemon.find({});
      console.log('Available Pokemon:', allPokemon.map(p => p.name).join(', '));
      
      // Get a truly random Pokemon
      const randomIndex = Math.floor(Math.random() * allPokemon.length);
      pokemon = [allPokemon[randomIndex]];
    }

    if (!pokemon.length) throw new Error('No Pokemon available');

    console.log(`Assigning Pokemon ${pokemon[0].name} to user ${userId}`);

    // Create or update user with assigned Pokemon
    const user = await User.findOneAndUpdate(
      { twitterId: userId },
      {
        twitterId: userId,
        assignedPokemon: pokemon[0]._id,
        currentHealth: pokemon[0].health || 500
      },
      { upsert: true, new: true }
    ).populate('assignedPokemon');

    return user;
  } catch (error) {
    console.error('Error assigning Pokemon:', error);
    throw error;
  }
};

// Get bot's move
const getBotMove = () => {
  return Math.random() < 0.5 ? 'attack1' : 'attack2';
};

// Process attack
const processAttack = async (move, targetHealth, attackName, damage) => {
  // 50% chance to miss
  const missed = Math.random() < 0.5;
  
  if (missed) {
    return {
      damage: 0,
      newHealth: targetHealth,
      message: `tried to use ${attackName} but missed!`
    };
  }
  
  // If attack hits, calculate damage as before
  const newHealth = Math.max(0, targetHealth - damage);
  
  return {
    damage,
    newHealth,
    message: `used ${attackName} dealing ${damage} damage!`
  };
};

// Update user's health
const updateUserHealth = async (userId, newHealth) => {
  await User.findOneAndUpdate(
    { twitterId: userId },
    { currentHealth: newHealth }
  );
};

// Reset user's health
const resetUserHealth = async (userId) => {
  await User.findOneAndUpdate(
    { twitterId: userId },
    { currentHealth: 100 }
  );
};

// Prepare battle media
const prepareBattleMedia = async (userPokemon, botPokemon) => {
  try {
    console.log('\nPreparing battle media:');
    console.log('User Pokemon:', userPokemon);
    console.log('Bot Pokemon:', botPokemon);

    const userImagePath = getPokemonImagePath(userPokemon);
    const botImagePath = getPokemonImagePath(botPokemon);

    console.log('Image paths:');
    console.log('User image:', userImagePath);
    console.log('Bot image:', botImagePath);

    // Check if images exist
    try {
      await fs.access(userImagePath);
      console.log('User image exists');
    } catch (error) {
      console.error('User image not found:', error.message);
      return null;
    }

    try {
      await fs.access(botImagePath);
      console.log('Bot image exists');
    } catch (error) {
      console.error('Bot image not found:', error.message);
      return null;
    }

    return {
      userImage: userImagePath,
      botImage: botImagePath
    };
  } catch (error) {
    console.error('Error preparing battle media:', error);
    return null;
  }
};

module.exports = {
  assignPokemonToUser,
  getBotMove,
  processAttack,
  updateUserHealth,
  resetUserHealth,
  prepareBattleMedia
}; 