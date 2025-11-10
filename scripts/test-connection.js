/**
 * Script de test de connexion à MongoDB
 * Usage: npm run test-connection
 */

require('dotenv').config();
const connectDB = require('../src/config/database');

console.log('🔍 Test de connexion à MongoDB...\n');
console.log(`📍 URI: ${process.env.MONGODB_URI}\n`);

connectDB()
  .then(() => {
    console.log('\n✅ Test de connexion réussi !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test de connexion échoué:', error.message);
    process.exit(1);
  });
