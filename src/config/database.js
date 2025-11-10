const mongoose = require('mongoose');

/**
 * Configuration et connexion à MongoDB
 */
const connectDB = async () => {
  try {
    const options = {
      maxPoolSize: 10, // Nombre max de connexions dans le pool
      serverSelectionTimeoutMS: 5000, // Timeout de sélection du serveur
      socketTimeoutMS: 45000, // Timeout de socket
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`✅ MongoDB connecté avec succès: ${conn.connection.host}`);
    console.log(`📊 Base de données: ${conn.connection.name}`);

    // Gestion des événements de connexion
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connecté à MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur de connexion Mongoose:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Mongoose déconnecté de MongoDB');
    });

    // Fermeture propre lors de l'arrêt de l'application
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 Connexion MongoDB fermée suite à l\'arrêt de l\'application');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
