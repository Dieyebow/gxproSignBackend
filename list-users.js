require('dotenv').config();
const connectDB = require('./src/config/database');
const { User, Client } = require('./src/models');

(async () => {
  await connectDB();

  const clients = await Client.find({}).select('_id companyName subdomain email');

  console.log('\\n📋 Utilisateurs par client:\\n');

  for (const client of clients) {
    const users = await User.find({ clientId: client._id }).select('firstName lastName email role status');

    console.log(`🏢 ${client.companyName} (${client.subdomain})`);
    console.log(`   Email client: ${client.email}`);

    if (users.length > 0) {
      users.forEach(u => {
        console.log(`   👤 ${u.firstName} ${u.lastName} - ${u.email} (${u.role}) - ${u.status}`);
      });
    } else {
      console.log('   ⚠️  Aucun utilisateur créé');
    }
    console.log('');
  }

  process.exit(0);
})();
