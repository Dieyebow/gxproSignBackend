/**
 * Script pour réinitialiser le mot de passe du super admin
 */

require('dotenv').config();
const connectDB = require('../src/config/database');
const { User, Client } = require('../src/models');

const getAdminAccess = async () => {
  try {
    await connectDB();

    console.log('\n🔍 Vérification des comptes existants...\n');

    // Vérifier si le super admin existe
    let superAdmin = await User.findOne({ email: 'admin@gxprosign.com' });

    if (superAdmin) {
      // Réinitialiser le mot de passe
      superAdmin.password = 'Admin123!';
      await superAdmin.save();
      console.log('✅ Mot de passe du Super Admin réinitialisé');
    } else {
      // Créer le super admin s'il n'existe pas
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
      console.log('✅ Super Admin créé');
    }

    // Vérifier le client Peelo
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
      console.log('✅ Client Peelo créé');
    } else {
      console.log('ℹ️  Client Peelo existe déjà');
    }

    // Vérifier/créer admin Peelo
    let peeloAdmin = await User.findOne({ email: 'admin@peelo.com' });

    if (peeloAdmin) {
      peeloAdmin.password = 'Peelo123!';
      await peeloAdmin.save();
      console.log('✅ Mot de passe Admin Peelo réinitialisé');
    } else {
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
        },
      });
      console.log('✅ Admin Peelo créé');
    }

    // Compter tous les utilisateurs et clients
    const totalUsers = await User.countDocuments();
    const totalClients = await Client.countDocuments();
    const peeloUsers = await User.countDocuments({ clientId: peeloClient._id });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ÉTAT DE LA BASE DE DONNÉES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total utilisateurs: ${totalUsers}`);
    console.log(`Total clients: ${totalClients}`);
    console.log(`Utilisateurs Peelo: ${peeloUsers}`);
    console.log('\n🔐 ACCÈS DE CONNEXION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n1️⃣  SUPER ADMIN');
    console.log('   URL:      https://app.gxprosign.com/login');
    console.log('   Email:    admin@gxprosign.com');
    console.log('   Password: Admin123!');
    console.log('   Rôle:     SUPER_ADMIN');
    console.log('\n2️⃣  ADMIN PEELO');
    console.log('   URL:      https://peelo.gxprosign.com/login');
    console.log('   Email:    admin@peelo.com');
    console.log('   Password: Peelo123!');
    console.log('   Rôle:     ADMIN_B2B (Client: Peelo)');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Tous les comptes sont prêts!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
};

getAdminAccess();
