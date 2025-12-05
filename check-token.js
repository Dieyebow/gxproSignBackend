require('dotenv').config();
const connectDB = require('./gxprosign/src/config/database');
const { Client } = require('./gxprosign/src/models');

const checkToken = async () => {
  try {
    await connectDB();

    const token = process.argv[2];

    if (!token) {
      console.log('Usage: node check-token.js <token>');
      process.exit(1);
    }

    console.log(`\n🔍 Recherche du token: ${token}\n`);

    const client = await Client.findOne({
      invitationToken: token
    }).select('+invitationToken +invitationExpires');

    if (!client) {
      console.log('❌ Aucun client trouvé avec ce token\n');

      // Lister tous les clients avec leurs tokens
      const allClients = await Client.find({}).select('companyName subdomain invitationToken invitationExpires invitationUsed');
      console.log('📋 Clients existants:\n');
      allClients.forEach(c => {
        console.log(`- ${c.companyName} (${c.subdomain})`);
        console.log(`  Token: ${c.invitationToken || 'N/A'}`);
        console.log(`  Expire: ${c.invitationExpires || 'N/A'}`);
        console.log(`  Utilisé: ${c.invitationUsed || false}\n`);
      });
    } else {
      console.log('✅ Client trouvé:');
      console.log(`   Entreprise: ${client.companyName}`);
      console.log(`   Sous-domaine: ${client.subdomain}`);
      console.log(`   Email: ${client.email}`);
      console.log(`   Token expire: ${client.invitationExpires}`);
      console.log(`   Utilisé: ${client.invitationUsed || false}`);

      const now = new Date();
      const expired = client.invitationExpires < now;

      if (expired) {
        console.log('\n⚠️  Le token a expiré!');
      } else {
        const daysLeft = Math.ceil((client.invitationExpires - now) / (1000 * 60 * 60 * 24));
        console.log(`\n✅ Le token est valide (expire dans ${daysLeft} jours)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

checkToken();
