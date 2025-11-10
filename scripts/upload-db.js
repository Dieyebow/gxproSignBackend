#!/usr/bin/env node

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI non trouvé dans .env');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📤 Upload de la base de données vers Digital Ocean');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📍 Host:', MONGODB_URI.split('@')[1]?.split('/')[0] || 'N/A');
console.log('📂 Backup local: ./database-backup\n');

const backupPath = path.join(__dirname, '..', 'database-backup', 'gxprosign');

const args = [
  '--uri=' + MONGODB_URI,
  '--drop',
  backupPath
];

console.log('🔄 Upload en cours... (cela peut prendre plusieurs minutes)\n');

const mongorestore = spawn('mongorestore', args);

mongorestore.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

mongorestore.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

mongorestore.on('close', (code) => {
  if (code === 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Base de données uploadée avec succès sur Digital Ocean!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Vérifier les données uploadées
    console.log('📊 Vérification des données uploadées...\n');
    const { MongoClient } = require('mongodb');
    
    MongoClient.connect(MONGODB_URI).then(async (client) => {
      const db = client.db();
      const collections = await db.listCollections().toArray();
      
      console.log('Collections uploadées:');
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  ✓ ${col.name}: ${count} documents`);
      }
      
      await client.close();
      process.exit(0);
    }).catch(err => {
      console.error('Erreur lors de la vérification:', err.message);
      process.exit(0);
    });
  } else {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Erreur lors de l\'upload (code:', code, ')');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(code);
  }
});
