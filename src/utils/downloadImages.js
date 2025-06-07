const fs = require('fs');
const path = require('path');
const https = require('https');

const POKEMON_LIST = [
  'pikachu',
  'charmander',
  'squirtle',
  'bulbasaur'
];

const POKEMON_IMAGE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
const POKEMON_IDS = {
  pikachu: 25,
  charmander: 4,
  squirtle: 7,
  bulbasaur: 1
};

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
};

const downloadAllImages = async () => {
  const assetsDir = path.join(__dirname, '../../assets/pokemon');

  try {
    // Create assets directory if it doesn't exist
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Download each Pokemon image
    for (const pokemon of POKEMON_LIST) {
      const imageUrl = `${POKEMON_IMAGE_BASE_URL}${POKEMON_IDS[pokemon]}.png`;
      const imagePath = path.join(assetsDir, `${pokemon}.png`);
      
      console.log(`Downloading ${pokemon} image...`);
      await downloadImage(imageUrl, imagePath);
      console.log(`Downloaded ${pokemon} successfully!`);
    }

    console.log('All Pokemon images downloaded successfully!');
  } catch (error) {
    console.error('Error downloading images:', error);
  }
};

// Run the download
downloadAllImages(); 