const express = require('express');
const app = express();
const startBot = require('./index.js');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start the Twitter bot
  startBot().catch(error => {
    console.error('Error starting bot:', error);
    process.exit(1);
  });
}); 