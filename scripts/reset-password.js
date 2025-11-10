const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const resetPassword = async (email, newPassword) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gxprosign');
    console.log('✅ Connecté à MongoDB');

    const User = require('../src/models/User');
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', email);
      process.exit(1);
    }

    console.log('\n✅ Utilisateur trouvé:');
    console.log('  Email:', user.email);
    console.log('  Nom:', user.firstName, user.lastName);
    console.log('  Role:', user.role);
    console.log('  ClientId:', user.clientId);

    // Définir le mot de passe en clair - le hook pre-save va le hasher automatiquement
    user.password = newPassword;
    await user.save();

    console.log('\n✅ Mot de passe réinitialisé avec succès!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📧 Email:', email);
    console.log('  🔑 Nouveau mot de passe:', newPassword);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
};

// Récupérer les arguments de la ligne de commande
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: node reset-password.js <email> <nouveau-mot-de-passe>');
  console.log('Exemple: node reset-password.js user@example.com Test1234!');
  process.exit(1);
}

resetPassword(email, newPassword);
