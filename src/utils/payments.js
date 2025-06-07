const User = require('../models/User');
const Web3 = require('web3');

// Initialize Web3 with Coinbase Cloud credentials
const initializeWeb3 = () => {
  try {
    // Coinbase Cloud configuration
    const options = {
      headers: {
        'x-api-key': process.env.COINBASE_API_KEY,
        'x-api-secret': process.env.COINBASE_API_SECRET
      }
    };

    // Create Web3 instance with fallback to public RPC
    const provider = new Web3.providers.HttpProvider(
      process.env.BASE_NODE_URL || 'https://mainnet.base.org',
      options
    );

    const web3Instance = new Web3(provider);
    
    // Test connection
    web3Instance.eth.getBlockNumber()
      .then(() => console.log('Successfully connected to Base network'))
      .catch(err => console.error('Warning: Base network connection error:', err));

    return web3Instance;
  } catch (error) {
    console.error('Error initializing Web3:', error);
    // Fallback to public RPC if credentials fail
    return new Web3('https://mainnet.base.org');
  }
};

const web3 = initializeWeb3();

// Your fixed wallet address where you want to receive payments
const PAYMENT_WALLET = process.env.PAYMENT_WALLET_ADDRESS;

// Pokemon prices in BASE
const POKEMON_PRICES = {
  'Blizzard': 0.3,    // 0.1 BASE
  'Curselord': 0.4,   // 0.1 BASE
  'Gar': 0.1,         // 0.1 BASE
  'Neu': 0.2,         // 0.1 BASE
  'Turquoise': 0.1    // 0.1 BASE
};

// Verify Base transaction
const verifyTransaction = async (transactionHash, expectedAmount, pokemonName) => {
  try {
    // Get transaction details
    const transaction = await web3.eth.getTransaction(transactionHash);
    if (!transaction) {
      throw new Error('Transaction not found on Base network');
    }

    // Get transaction receipt to check status
    const receipt = await web3.eth.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    // Check if transaction was successful
    if (!receipt.status) {
      throw new Error('Transaction failed on Base network');
    }

    // Check if sent to correct address
    if (transaction.to.toLowerCase() !== PAYMENT_WALLET.toLowerCase()) {
      throw new Error('Transaction was not sent to the correct wallet address');
    }

    // Convert transaction value from Wei to BASE
    const amountPaid = parseFloat(web3.utils.fromWei(transaction.value, 'ether'));
    const expectedPrice = POKEMON_PRICES[pokemonName];

    // Check if paid enough (with some tolerance for gas price fluctuations)
    if (amountPaid < expectedPrice * 0.99) { // Allow 1% tolerance
      throw new Error(`Insufficient payment. Expected ${expectedPrice} BASE but received ${amountPaid} BASE`);
    }

    // Additional Base-specific checks can be added here
    // For example, checking if the transaction is confirmed on Base network
    const currentBlock = await web3.eth.getBlockNumber();
    const transactionBlock = receipt.blockNumber;
    const confirmations = currentBlock - transactionBlock;
    
    if (confirmations < 1) {
      throw new Error('Please wait for at least 1 confirmation on Base network');
    }

    return true;
  } catch (error) {
    console.error('Error verifying Base transaction:', error);
    throw error;
  }
};

// Create a pending purchase for a user
const createPurchaseRequest = async (twitterId, twitterUsername, pokemonName) => {
  try {
    // Convert pokemonName to proper case by finding a case-insensitive match
    const properPokemonName = Object.keys(POKEMON_PRICES).find(
      name => name.toLowerCase() === pokemonName.toLowerCase()
    );

    if (!properPokemonName) {
      throw new Error(`Invalid Pokemon: ${pokemonName}. Available Pokemon: ${Object.keys(POKEMON_PRICES).join(', ')}`);
    }

    await User.findOneAndUpdate(
      { twitterId },
      { 
        $push: { 
          pendingPurchases: {
            pokemonName: properPokemonName,
            requestDate: new Date(),
            walletUsed: PAYMENT_WALLET,
            amountPaid: POKEMON_PRICES[properPokemonName],
            status: 'pending'
          }
        },
        twitterUsername // Update username if not set
      },
      { upsert: true }
    );

    return {
      walletAddress: PAYMENT_WALLET,
      amount: POKEMON_PRICES[properPokemonName],
      currency: 'BASE'  // Changed from ETH to BASE
    };
  } catch (error) {
    console.error('Error creating purchase request:', error);
    throw error;
  }
};

// Confirm a payment and assign Pokemon
const confirmPayment = async (twitterId, transactionHash, pokemonName) => {
  try {
    // First check if this transaction hash has been used before
    const existingTransaction = await User.findOne({
      'ownedPokemon.transactionHash': transactionHash
    });

    if (existingTransaction) {
      throw new Error('This transaction has already been used for a purchase!');
    }

    // Verify the transaction on Base network
    const properPokemonName = Object.keys(POKEMON_PRICES).find(
      name => name.toLowerCase() === pokemonName.toLowerCase()
    );

    if (!properPokemonName) {
      throw new Error(`Invalid Pokemon: ${pokemonName}`);
    }

    await verifyTransaction(transactionHash, POKEMON_PRICES[properPokemonName], properPokemonName);

    const user = await User.findOne({ twitterId });
    if (!user) {
      throw new Error('User not found');
    }

    try {
      // Add Pokemon to user's collection
      await User.findOneAndUpdate(
        { twitterId },
        {
          $push: {
            ownedPokemon: {
              pokemonName: properPokemonName,
              purchaseDate: new Date(),
              transactionHash,
              amountPaid: POKEMON_PRICES[properPokemonName],
              network: 'Base'  // Added network information
            }
          }
        },
        { runValidators: true }
      );

      return true;
    } catch (updateError) {
      if (updateError.code === 11000) {
        throw new Error('This transaction has already been used for a purchase!');
      }
      throw updateError;
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

// Get Pokemon prices
const getPokemonPrices = () => {
  return POKEMON_PRICES;
};

// Get pending purchases for a user
const getPendingPurchases = async (twitterId) => {
  try {
    const user = await User.findOne({ twitterId });
    if (!user) {
      return [];
    }
    return user.pendingPurchases.filter(p => p.status === 'pending');
  } catch (error) {
    console.error('Error getting pending purchases:', error);
    throw error;
  }
};

// Get owned Pokemon for a user
const getOwnedPokemon = async (twitterId) => {
  try {
    const user = await User.findOne({ twitterId });
    if (!user) {
      return [];
    }
    return user.ownedPokemon;
  } catch (error) {
    console.error('Error getting owned Pokemon:', error);
    throw error;
  }
};

module.exports = {
  createPurchaseRequest,
  confirmPayment,
  getPokemonPrices,
  getPendingPurchases,
  getOwnedPokemon,
  PAYMENT_WALLET
}; 