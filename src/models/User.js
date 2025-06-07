const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  twitterId: {
    type: String,
    required: true,
    unique: true
  },
  twitterUsername: {
    type: String,
    required: true
  },
  assignedPokemon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pokemon',
    required: true
  },
  currentHealth: {
    type: Number,
    default: 100
  },
  ownedPokemon: [{
    pokemonName: String,
    purchaseDate: Date,
    transactionHash: {
      type: String,
      unique: true,
      sparse: true
    }
  }],
  pendingPurchases: [{
    pokemonName: String,
    requestDate: Date,
    walletUsed: String,
    amountPaid: Number,
    status: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'pending'
    }
  }]
});

userSchema.index({ 'ownedPokemon.transactionHash': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema); 