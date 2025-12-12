require('dotenv').config();
const mongoose = require('mongoose');

async function checkEmail() {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    console.log('🔗 Connexion à MongoDB Atlas...\n');

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    const db = mongoose.connection.db;

    // Lister toutes les collections
    console.log('📋 Collections disponibles:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => console.log('   -', col.name));

    // Chercher dans la collection clients
    console.log('\n🔍 Recherche dans "clients" pour: dieyebow@gmail.com');
    const Client = db.collection('clients');
    const clientResult = await Client.findOne({ email: 'dieyebow@gmail.com' });

    if (clientResult) {
      console.log('✅ TROUVÉ:');
      console.log(JSON.stringify(clientResult, null, 2));
    } else {
      console.log('❌ NON TROUVÉ');
    }

    // Chercher tous les clients
    console.log('\n📋 TOUS les clients dans la base:');
    const allClients = await Client.find({}).toArray();
    console.log(`Total: ${allClients.length} clients\n`);
    allClients.forEach(c => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🏢 Entreprise:', c.companyName);
      console.log('📧 Email:', c.email);
      console.log('🆔 ID:', c._id);
      console.log('🌐 Sous-domaine:', c.subdomain);
      console.log('📞 Téléphone:', c.phone || 'N/A');
      console.log('👤 Contact:', (c.contactPerson?.firstName || 'N/A'), (c.contactPerson?.lastName || ''));
      console.log('✅ Status:', c.status);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkEmail();
