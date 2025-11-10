/**
 * Script de seed pour créer des données initiales
 * Usage: npm run seed
 */

require('dotenv').config();
const connectDB = require('../src/config/database');
const { User, Client } = require('../src/models');

const seedData = async () => {
  try {
    await connectDB();

    console.log('\n🌱 Début du seed des données...\n');

    // Supprimer les données existantes (ATTENTION: en développement uniquement)
    if (process.env.NODE_ENV === 'development') {
      await User.deleteMany({});
      await Client.deleteMany({});
      console.log('🗑️  Données existantes supprimées');
    }

    // Créer un SuperAdmin
    const superAdmin = await User.create({
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

    // Créer un client de démonstration
    const demoClient = await Client.create({
      companyName: 'Demo Company',
      subdomain: 'demo',
      email: 'contact@demo.com',
      phone: '+33 1 23 45 67 89',
      address: {
        street: '123 Rue de la Démo',
        city: 'Paris',
        state: 'Île-de-France',
        zipCode: '75001',
        country: 'France',
      },
      branding: {
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
      },
      limits: {
        maxDocumentsPerMonth: 100,
        maxUsers: 10,
        maxStorageGB: 5,
      },
      subscription: {
        plan: 'PREMIUM',
        status: 'ACTIVE',
        startDate: new Date(),
        billingCycle: 'MONTHLY',
      },
      status: 'ACTIVE',
      createdBy: superAdmin._id,
    });
    console.log('✅ Client de démo créé:', demoClient.subdomain);

    // Créer un Admin B2B pour le client de démo
    const adminB2B = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@demo.com',
      password: 'Demo123!',
      role: 'ADMIN_B2B',
      clientId: demoClient._id,
      emailVerified: true,
      status: 'ACTIVE',
      profile: {
        title: 'Directeur',
        department: 'Administration',
        phone: '+33 6 12 34 56 78',
      },
    });
    console.log('✅ Admin B2B créé:', adminB2B.email);

    // Créer un utilisateur standard B2B
    const userB2B = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@demo.com',
      password: 'Demo123!',
      role: 'USER_B2B',
      clientId: demoClient._id,
      emailVerified: true,
      status: 'ACTIVE',
      profile: {
        title: 'Gestionnaire de documents',
        department: 'Ventes',
        phone: '+33 6 98 76 54 32',
      },
    });
    console.log('✅ Utilisateur B2B créé:', userB2B.email);

    // Mettre à jour le compteur d'utilisateurs du client
    await Client.findByIdAndUpdate(demoClient._id, {
      $set: { 'limits.currentUsers': 2 },
    });

    console.log('\n✅ Seed terminé avec succès !');
    console.log('\n📋 Résumé des comptes créés:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 SuperAdmin:');
    console.log(`   Email: admin@gxprosign.com`);
    console.log(`   Password: Admin123!`);
    console.log('');
    console.log('🏢 Client Demo (demo.gxprosign.com):');
    console.log(`   Admin Email: john@demo.com`);
    console.log(`   Admin Password: Demo123!`);
    console.log(`   User Email: jane@demo.com`);
    console.log(`   User Password: Demo123!`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du seed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedData();
