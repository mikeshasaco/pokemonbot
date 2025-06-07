const mongoose = require('mongoose');

const PokemonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  health: {
    type: Number,
    required: true,
    default: 500
  },
  attack1: {
    name: {
      type: String,
      required: true
    },
    damage: {
      type: Number,
      required: true
    }
  },
  attack2: {
    name: {
      type: String,
      required: true
    },
    damage: {
      type: Number,
      required: true
    }
  }
});

module.exports = mongoose.model('Pokemon', PokemonSchema); 