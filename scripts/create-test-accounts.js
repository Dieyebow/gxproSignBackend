/**
 * Script pour créer les comptes de test en production
 * Usage: node scripts/create-test-accounts.js
 */

require('dotenv').config();
const connectDB = require('../src/config/database');
const { User, Client } = require('../src/models');

const createTestAccounts = async () => {
  try {
    await connectDB();

    console.log('\n🔧 Création des comptes de test...\n');

    // 1. Créer un SuperAdmin
    let superAdmin = await User.findOne({ email: 'admin@gxprosign.com' });

    if (!superAdmin) {
      superAdmin = await User.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@gxprosign.com',
        password: 'Admin123!',
        role: 'SUPER_ADMIN',
        clientId: null,
        emailVerified: true,
        status: 'ACTIVE',
      });
      console.log('✅ SuperAdmin créé:', superAdmin.email);
    } else {
      console.log('ℹ️  SuperAdmin existe déjà:', superAdmin.email);
    }

    // 2. Créer le client "peelo"
    let peeloClient = await Client.findOne({ subdomain: 'peelo' });

    if (!peeloClient) {
      peeloClient = await Client.create({
        companyName: 'Peelo Inc.',
        subdomain: 'peelo',
        email: 'contact@peelo.com',
        phone: '+1 234 567 8900',
        address: {
          street: '123 Tech Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          country: 'USA',
        },
        branding: {
          primaryColor: '#6366F1',
          secondaryColor: '#8B5CF6',
        },
        limits: {
          maxDocumentsPerMonth: 100,
          maxUsers: 20,
          maxStorageGB: 10,
        },
        subscription: {
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
          startDate: new Date(),
          billingCycle: 'MONTHLY',
        },
        status: 'ACTIVE',
        createdBy: superAdmin._id,
      });
      console.log('✅ Client Peelo créé:', peeloClient.subdomain);
    } else {
      console.log('ℹ️  Client Peelo existe déjà:', peeloClient.subdomain);
    }

    // 3. Créer un Admin B2B pour Peelo
    let peeloAdmin = await User.findOne({ email: 'admin@peelo.com' });

    if (!peeloAdmin) {
      peeloAdmin = await User.create({
        firstName: 'Peelo',
        lastName: 'Admin',
        email: 'admin@peelo.com',
        password: 'Peelo123!',
        role: 'ADMIN_B2B',
        clientId: peeloClient._id,
        emailVerified: true,
        status: 'ACTIVE',
        profile: {
          title: 'CEO',
          department: 'Management',
          phone: '+1 234 567 8901',
        },
      });
      console.log('✅ Admin Peelo créé:', peeloAdmin.email);
    } else {
      console.log('ℹ️  Admin Peelo existe déjà:', peeloAdmin.email);
    }

    // 4. Créer un utilisateur standard pour Peelo
    let peeloUser = await User.findOne({ email: 'user@peelo.com' });

    if (!peeloUser) {
      peeloUser = await User.create({
        firstName: 'John',
        lastName: 'Peelo',
        email: 'user@peelo.com',
        password: 'Peelo123!',
        role: 'USER_B2B',
        clientId: peeloClient._id,
        emailVerified: true,
        status: 'ACTIVE',
        profile: {
          title: 'Document Manager',
          department: 'Operations',
          phone: '+1 234 567 8902',
        },
      });
      console.log('✅ User Peelo créé:', peeloUser.email);
    } else {
      console.log('ℹ️  User Peelo existe déjà:', peeloUser.email);
    }

    // Mettre à jour le compteur d'utilisateurs
    const userCount = await User.countDocuments({ clientId: peeloClient._id });
    await Client.findByIdAndUpdate(peeloClient._id, {
      $set: { 'limits.currentUsers': userCount },
    });

    console.log('\n✅ Comptes de test créés avec succès !');
    console.log('\n📋 ACCÈS DE TEST:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔐 SUPER ADMIN (accès complet):');
    console.log('   URL: https://app.gxprosign.com/login');
    console.log('   Email: admin@gxprosign.com');
    console.log('   Password: Admin123!');
    console.log('   Rôle: Gestion globale de la plateforme');
    console.log('\n🏢 CLIENT PEELO (peelo.gxprosign.com):');
    console.log('   ┌─ ADMIN:');
    console.log('   │  URL: https://peelo.gxprosign.com/login');
    console.log('   │  Email: admin@peelo.com');
    console.log('   │  Password: Peelo123!');
    console.log('   │  Rôle: Admin du client Peelo');
    console.log('   │');
    console.log('   └─ USER:');
    console.log('      URL: https://peelo.gxprosign.com/login');
    console.log('      Email: user@peelo.com');
    console.log('      Password: Peelo123!');
    console.log('      Rôle: Utilisateur standard de Peelo');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Note: Les utilisateurs Peelo doivent se connecter sur');
    console.log('   https://peelo.gxprosign.com (avec le sous-domaine)\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la création des comptes:', error.message);
    console.error(error);
    process.exit(1);
  }
};

createTestAccounts();
