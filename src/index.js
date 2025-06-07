require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const connectDB = require('./config/database');
const Pokemon = require('./models/Pokemon');
const User = require('./models/User');
const Battle = require('./utils/battle');
const Payments = require('./utils/payments');

// Initialize Twitter client with OAuth 1.0a for both read and write
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Get read-write client
const rwClient = client.readWrite;

// Initialize database
connectDB();

// Initialize Pokemon
const initializePokemon = async () => {
  try {
    console.log('Starting Pokemon initialization...');
    
    const pokemonList = [
      {
        name: 'Blizzard',
        health: 500,
        attack1: { name: 'Double Blizzard', damage: 120 },
        attack2: { name: 'Blue Fire', damage: 250 }
      },
      {
        name: 'Curselord',
        health: 500,
        attack1: { name: 'Shadow Saber', damage: 80 },
        attack2: { name: 'Brutal Claw', damage: 230 }
      },
      {
        name: 'Gar',
        health: 500,
        attack1: { name: 'Iron Slash', damage: 55 },
        attack2: { name: 'Dark Slash', damage: 100 }
      },
      {
        name: 'Neu',
        health: 500,
        attack1: { name: 'Nova Blast', damage: 240 },
        attack2: { name: 'Pyshic', damage: 150 }
      },
      {
        name: 'Turquoise',
        health: 500,
        attack1: { name: 'Petal Swirl', damage: 110 },
        attack2: { name: 'Petal Bullet', damage: 220 }
      }
    ];

    console.log('Pokemon to initialize:', pokemonList.map(p => p.name).join(', '));

    // Clear existing Pokemon collection
    console.log('Clearing existing Pokemon collection...');
    await Pokemon.deleteMany({});
    console.log('Successfully cleared Pokemon collection');

    // Initialize Pokemon one by one to ensure order
    const initializedPokemon = [];
    for (const pokemon of pokemonList) {
      console.log(`Initializing Pokemon: ${pokemon.name}`);
      try {
        const newPokemon = new Pokemon({
          ...pokemon,
          currentHealth: pokemon.health
        });
        const saved = await newPokemon.save();
        initializedPokemon.push(saved);
        console.log(`Successfully initialized ${pokemon.name}`);
      } catch (error) {
        console.error(`Error initializing ${pokemon.name}:`, error);
        throw error;
      }
    }

    // Double check initialization
    const allPokemon = await Pokemon.find({}).sort('name');
    console.log('\nVerifying initialization...');
    console.log('Found Pokemon:', allPokemon.map(p => p.name).join(', '));
    
    if (allPokemon.length !== pokemonList.length) {
      throw new Error(`Expected ${pokemonList.length} Pokemon, but found ${allPokemon.length}`);
    }

    // Verify each Pokemon was initialized
    for (const expected of pokemonList) {
      const found = allPokemon.find(p => p.name === expected.name);
      if (!found) {
        throw new Error(`Pokemon ${expected.name} was not properly initialized`);
      }
    }

    console.log('All Pokemon initialized successfully!');
    return initializedPokemon;
  } catch (error) {
    console.error('Error initializing Pokemon:', error);
    throw error;
  }
};

// Add this function at the top level
const uploadMedia = async (client, filepath) => {
  try {
    // Add file existence check
    const fs = require('fs').promises;
    await fs.access(filepath);
    
    // Add file size check (Twitter limit is 5MB for images)
    const stats = await fs.stat(filepath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    console.log(`\nAttempting to upload: ${filepath}`);
    console.log(`File size: ${fileSizeInMB.toFixed(2)}MB`);
    
    if (fileSizeInMB > 5) {
      console.error(`File ${filepath} is too large (${fileSizeInMB.toFixed(2)}MB). Max size is 5MB.`);
      return null;
    }

    // Try v1 upload first
    try {
      console.log('Attempting v1 upload...');
      const mediaId = await client.v1.uploadMedia(filepath);
      console.log('Successfully uploaded media with v1:', filepath);
      console.log('Media ID:', mediaId);
      return mediaId;
    } catch (v1Error) {
      console.error('v1 upload failed:', v1Error.message);
      console.error('Error details:', JSON.stringify(v1Error.data || {}, null, 2));
      
      // If v1 fails, try v2
      console.log('Attempting v2 upload...');
      const mediaId = await client.v2.uploadMedia(filepath);
      console.log('Successfully uploaded media with v2:', filepath);
      console.log('Media ID:', mediaId);
      return mediaId;
    }
  } catch (error) {
    console.error('\nError uploading media:', filepath);
    console.error('Error message:', error.message);
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    console.error('Full error:', error);
    return null;
  }
};

// Handle battle commands
const handleBattle = async (tweet) => {
  const userId = tweet.author_id;
  const tweetText = tweet.text.toLowerCase();
  
  try {
    // Handle buy command
    if (tweetText.includes('buy')) {
      const words = tweetText.split(' ');
      const buyIndex = words.findIndex(word => word === 'buy');
      
      // Only handle the plain 'buy' command now
      if (words.length === 2) { // @aidex_agent buy
        const prices = Payments.getPokemonPrices();
        const examplePokemon = Object.keys(prices)[Math.floor(Math.random() * Object.keys(prices).length)];
        const exampleHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        
        return {
          text: "Available Pokemon for purchase:\n\n" +
               Object.entries(prices)
                 .map(([name, price]) => `${name}: ${price} ETH`)
                 .join('\n') +
               "\n\nTo purchase, send ETH to our wallet and confirm:\n" +
               "Wallet: 0x6274bFef22fF551732593A455B5502DD3C1B5E09\n\n" +
               "Example confirmation:\n" +
               `@aidex_agent confirm ${examplePokemon} ${exampleHash}`
        };
      }
      return {
        text: "To see available Pokemon and prices, just tweet: @aidex_agent buy"
      };
    }

    // Handle confirm command
    if (tweetText.includes('confirm')) {
      const words = tweetText.split(' ');
      const confirmIndex = words.findIndex(word => word === 'confirm');
      if (confirmIndex >= words.length - 2) {
        return {
          text: "Please provide both Pokemon name and transaction hash.\nFormat: @aidex_agent confirm <pokemon_name> <transaction_hash>"
        };
      }

      const pokemonName = words[confirmIndex + 1];
      const transactionHash = words[confirmIndex + 2];

      try {
        await Payments.confirmPayment(userId, transactionHash, pokemonName);
        return {
          text: `Payment confirmed! ${pokemonName} has been added to your collection!\n` +
                `Tweet '@aidex_agent battle ${pokemonName}' to start battling with your new Pokemon!`
        };
      } catch (error) {
        return {
          text: error.message || "Error confirming payment. Please make sure you've sent the correct amount of ETH and provided the correct transaction hash."
        };
      }
    }

    // Handle list command
    if (tweetText.includes('list')) {
      const ownedPokemon = await Payments.getOwnedPokemon(userId);
      if (ownedPokemon.length === 0) {
        return {
          text: "You don't own any Pokemon yet! Use 'buy' to purchase one."
        };
      }

      return {
        text: "Your Pokemon collection:\n\n" +
              ownedPokemon.map(p => p.pokemonName).join('\n') +
              "\n\nTo use a specific Pokemon, tweet: @aidex_agent battle <pokemon_name>"
      };
    }

    // Check if this is a new battle request
    if (tweetText.includes('battle')) {
      const words = tweetText.split(' ');
      const battleIndex = words.findIndex(word => word === 'battle');
      const requestedPokemon = battleIndex < words.length - 1 ? words[battleIndex + 1] : null;

      try {
        let user;
        if (requestedPokemon) {
          // Check if user owns this Pokemon
          const ownedPokemon = await Payments.getOwnedPokemon(userId);
          if (!ownedPokemon.find(p => p.pokemonName.toLowerCase() === requestedPokemon.toLowerCase())) {
            return {
              text: `You don't own ${requestedPokemon}! Use '@aidex_agent list' to see your Pokemon or just 'battle' for a random one.`
            };
          }
        }

        user = await Battle.assignPokemonToUser(userId, requestedPokemon);
        
        // Get all available Pokemon except the user's
        const allPokemon = await Pokemon.find({ _id: { $ne: user.assignedPokemon._id } });
        console.log('Available Pokemon for bot:', allPokemon.map(p => p.name).join(', '));
        
        if (!allPokemon.length) {
          console.error('No other Pokemon available for bot');
          return {
            text: "Sorry, I'm having trouble choosing a Pokemon. Please try again!"
          };
        }

        // Randomly select one of the available Pokemon
        const randomIndex = Math.floor(Math.random() * allPokemon.length);
        const botPokemon = [allPokemon[randomIndex]];
        
        if (!botPokemon || !botPokemon[0]) {
          console.error('No bot Pokemon found');
          return {
            text: "Sorry, I'm having trouble choosing a Pokemon. Please try again!"
          };
        }

        // Store bot's Pokemon for this battle
        await User.findOneAndUpdate(
          { twitterId: 'BOT' },
          {
            twitterId: 'BOT',
            assignedPokemon: botPokemon[0]._id,
            currentHealth: botPokemon[0].health || 500
          },
          { upsert: true }
        );
        
        // Get Pokemon images
        const media = await Battle.prepareBattleMedia(user.assignedPokemon.name, botPokemon[0].name);
        
        return {
          text: `Welcome to the battle! You've been assigned ${user.assignedPokemon.name}! ` +
                `I choose ${botPokemon[0].name}!\n\n` +
                `Your moves:\n` +
                `attack1: ${user.assignedPokemon.attack1.name} (${user.assignedPokemon.attack1.damage} damage)\n` +
                `attack2: ${user.assignedPokemon.attack2.name} (${user.assignedPokemon.attack2.damage} damage)`,
          media: media
        };
      } catch (error) {
        console.error('Error handling battle:', error);
        return {
          text: error.message || "Sorry, something went wrong. Please try again!"
        };
      }
    }

    // Handle attacks
    if (tweetText.includes('attack1') || tweetText.includes('attack2')) {
      const user = await User.findOne({ twitterId: userId }).populate('assignedPokemon');
      const botUser = await User.findOne({ twitterId: 'BOT' }).populate('assignedPokemon');

      if (!user || !user.assignedPokemon) {
        return {
          text: "You haven't started a battle yet! Tweet 'battle' to begin!"
        };
      }

      if (!botUser || !botUser.assignedPokemon) {
        return {
          text: "Sorry, I lost track of our battle. Let's start a new one! Tweet 'battle' to begin!"
        };
      }

      const userMove = tweetText.includes('attack1') ? 'attack1' : 'attack2';
      const botMove = Battle.getBotMove();

      // Process user's attack
      const userAttack = await Battle.processAttack(
        userMove,
        botUser.currentHealth,
        user.assignedPokemon[userMove].name,
        user.assignedPokemon[userMove].damage
      );

      // Process bot's attack
      const botAttack = await Battle.processAttack(
        botMove,
        user.currentHealth,
        botUser.assignedPokemon[botMove].name,
        botUser.assignedPokemon[botMove].damage
      );

      // Update health for both user and bot
      await Battle.updateUserHealth(userId, botAttack.newHealth);
      await Battle.updateUserHealth('BOT', userAttack.newHealth);

      // Get Pokemon images
      const media = await Battle.prepareBattleMedia(user.assignedPokemon.name, botUser.assignedPokemon.name);

      let response = `Your ${user.assignedPokemon.name} ${userAttack.message}\n` +
                    `My ${botUser.assignedPokemon.name} ${botAttack.message}\n\n` +
                    `Your health: ${botAttack.newHealth}\n` +
                    `My health: ${userAttack.newHealth}`;

      if (botAttack.newHealth <= 0 || userAttack.newHealth <= 0) {
        // If user's health (botAttack.newHealth) is 0 or less, AI wins
        const winner = userAttack.newHealth <= 0 ? 'I' : 'You';
        await Battle.resetUserHealth(userId);
        await Battle.resetUserHealth('BOT');
        response += `\n\n${winner} won the battle! Tweet 'battle' to play again!`;
      }

      return {
        text: response,
        media: media
      };
    }

    return {
      text: "Invalid command! Tweet 'battle' to start a new game or use 'attack1' or 'attack2' during battle!"
    };
  } catch (error) {
    console.error('Error handling command:', error);
    return {
      text: error.message || "Sorry, something went wrong. Please try again!"
    };
  }
};

let lastCheckedId = null;
let consecutiveErrors = 0;
const MAX_RETRIES = 3;
const BASE_POLLING_INTERVAL = 120 * 1000; // 2 minutes

// Utility function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Handle rate limits
const handleRateLimit = async (error) => {
  if (error.code === 429) {
    const resetTime = error.rateLimit?.reset;
    if (resetTime) {
      const waitTime = (resetTime * 1000) - Date.now();
      console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await wait(waitTime + 1000); // Add 1 second buffer
      return true;
    }
  }
  return false;
};

// Poll for mentions with retry logic
const pollMentions = async () => {
  try {
    console.log('\nChecking for new mentions...');
    const options = {
      max_results: 100, // Increased from 10 to get more mentions
      'tweet.fields': ['author_id', 'created_at', 'text'],
      'expansions': ['referenced_tweets.id'],
    };

    // For the first poll, get recent mentions from the past hour
    if (!lastCheckedId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // Look back 1 hour instead of 15 minutes
      options.start_time = oneHourAgo.toISOString();
      console.log('First poll: Checking mentions from the past hour');
      console.log('Start time:', options.start_time);
      console.log('Current time:', new Date().toISOString());
    } else {
      options.since_id = lastCheckedId;
      console.log('Checking mentions since tweet:', lastCheckedId);
    }

    console.log('Making API request with options:', JSON.stringify(options, null, 2));
    const mentionsResponse = await rwClient.v2.userMentionTimeline(process.env.BOT_USER_ID, options);
    
    console.log('Response type:', typeof mentionsResponse);
    console.log('Response keys:', Object.keys(mentionsResponse));
    
    // Log the raw API response
    console.log('Raw API response:', JSON.stringify(mentionsResponse, null, 2));

    // Try to access data directly first
    let tweets = [];
    if (mentionsResponse._realData && mentionsResponse._realData.data) {
      console.log('Found data in _realData');
      tweets = mentionsResponse._realData.data;
      console.log(`Found ${tweets.length} tweets in _realData.data`);
      console.log('Tweets:', JSON.stringify(tweets, null, 2));
    } else if (mentionsResponse._realData && mentionsResponse._realData.meta) {
      console.log('No tweets found. Meta data:', mentionsResponse._realData.meta);
      if (mentionsResponse._realData.meta.result_count === 0) {
        console.log('No mentions found in the specified time range.');
        console.log('Make sure to tweet "@aidex_agent battle" to start a battle!');
      }
    } else {
      console.log('Unexpected response structure:', JSON.stringify(mentionsResponse, null, 2));
      return;
    }

    if (tweets.length > 0) {
      console.log(`Processing ${tweets.length} new mentions!`);
      // Process mentions in chronological order
      for (const tweet of tweets.reverse()) {
        console.log('\nProcessing tweet details:');
        console.log('Tweet text:', tweet.text);
        console.log('Tweet ID:', tweet.id);
        console.log('Author ID:', tweet.author_id);
        console.log('Created at:', tweet.created_at);
        
        // Check if the tweet is actually mentioning our bot
        if (!tweet.text.toLowerCase().includes('@' + process.env.BOT_USERNAME.toLowerCase())) {
          console.log('Tweet does not mention bot, skipping...');
          continue;
        }
        
        console.log('Processing battle for tweet:', tweet.text);
        const battleResponse = await handleBattle(tweet);
        console.log('Generated response:', battleResponse);
        
        try {
          let tweetOptions = {
            reply: { in_reply_to_tweet_id: tweet.id }
          };

          // If we have media, upload and attach it
          if (battleResponse.media) {
            console.log('Uploading media files...');
            try {
              // Add retry logic for media uploads
              let retries = 3;
              let mediaIds = null;
              
              while (retries > 0 && !mediaIds) {
                try {
                  mediaIds = await Promise.all([
                    uploadMedia(rwClient, battleResponse.media.userImage),
                    uploadMedia(rwClient, battleResponse.media.botImage)
                  ]);
                  
                  // Check if both uploads succeeded
                  if (mediaIds[0] && mediaIds[1]) {
                    tweetOptions.media = { media_ids: mediaIds };
                    console.log('Media uploaded successfully:', mediaIds);
                    break;
                  } else {
                    console.log('One or both media uploads failed, retrying...');
                    mediaIds = null;
                    retries--;
                    if (retries > 0) {
                      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                    }
                  }
                } catch (uploadError) {
                  console.error('Error during media upload attempt:', uploadError);
                  retries--;
                  if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                  }
                }
              }
              
              if (!mediaIds || !mediaIds[0] || !mediaIds[1]) {
                console.log('All media upload attempts failed, sending tweet without media');
              }
            } catch (mediaError) {
              console.error('Error handling media upload:', mediaError);
              if (mediaError.data) {
                console.error('Media error data:', JSON.stringify(mediaError.data, null, 2));
              }
              // Continue without media if upload fails
            }
          }

          await rwClient.v2.tweet(battleResponse.text, tweetOptions);
          console.log('Response sent successfully!');
          lastCheckedId = tweet.id;
        } catch (replyError) {
          console.error('Error sending reply:', replyError);
          if (replyError.data) {
            console.error('Reply error data:', JSON.stringify(replyError.data, null, 2));
          }
          
          // Try to send the tweet without media if it failed
          if (battleResponse.media) {
            console.log('Retrying tweet without media...');
            try {
              await rwClient.v2.tweet(battleResponse.text, {
                reply: { in_reply_to_tweet_id: tweet.id }
              });
              console.log('Response sent successfully without media!');
              lastCheckedId = tweet.id;
            } catch (retryError) {
              console.error('Error sending retry without media:', retryError);
            }
          }
        }
        
        // Wait 1 second between processing tweets to avoid rate limits
        await wait(1000);
      }
    } else {
      console.log('No new mentions found');
    }
  } catch (error) {
    console.error('Polling error:', error.code || error.message || error);
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    console.error('Full error:', error);
    
    // Handle rate limits
    if (await handleRateLimit(error)) {
      return; // Will retry on next interval
    }

    // Handle other errors with exponential backoff
    consecutiveErrors++;
    if (consecutiveErrors <= MAX_RETRIES) {
      const backoffTime = Math.min(1000 * Math.pow(2, consecutiveErrors), 60000);
      console.log(`Retrying in ${backoffTime/1000} seconds... (Attempt ${consecutiveErrors}/${MAX_RETRIES})`);
      await wait(backoffTime);
    } else {
      console.error('Max retries reached. Will try again on next polling interval.');
      consecutiveErrors = 0;
    }
  }
};

// Start the bot
const startBot = async () => {
  try {
    // Connect to database first
    await connectDB();
    console.log('\nInitializing Pokemon...');
    
    await initializePokemon();
    console.log('Pokemon initialized successfully');

    // Get and verify bot's identity
    const me = await rwClient.v2.me();
    console.log('\nBot Account Details:');
    console.log('-------------------');
    console.log('Username:', me.data.username);
    console.log('Display Name:', me.data.name);
    console.log('User ID:', me.data.id);
    console.log('Bot username:', process.env.BOT_USERNAME);
    console.log('-------------------\n');

    if (!process.env.BOT_USER_ID) {
      console.log('Please add this ID to your .env file as BOT_USER_ID');
      process.exit(1);
    }

    if (!process.env.BOT_USERNAME) {
      console.log('Please add the bot username to your .env file as BOT_USERNAME');
      process.exit(1);
    }

    console.log('Bot is running and polling for mentions...');
    console.log(`Polling interval: ${BASE_POLLING_INTERVAL/1000} seconds`);
    
    // Initial poll immediately
    console.log('Running initial poll...');
    await pollMentions();
    
    // Poll on interval
    setInterval(pollMentions, BASE_POLLING_INTERVAL);

  } catch (error) {
    console.error('Error starting bot:', error);
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    throw error;
  }
};

module.exports = startBot; 