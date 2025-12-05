require('dotenv').config();
const connectDB = require('./src/config/database');
const { Client } = require('./src/models');

(async () => {
  await connectDB();
  const token = '3dbbec4006efac4190c17a0cabab529d2d86c48f2972381028cd263aec3baef3';

  const clients = await Client.find({}).select('companyName subdomain invitationToken invitationExpires email');

  console.log('\\n📋 Tous les clients:\\n');
  clients.forEach(c => {
    const match = c.invitationToken === token ? ' ✅ MATCH!' : '';
    console.log(`${c.companyName} (${c.subdomain}) - ${c.email}${match}`);
    if (c.invitationToken) {
      console.log(`  Token: ${c.invitationToken}`);
      console.log(`  Expire: ${c.invitationExpires}`);
    }
    console.log('');
  });

  process.exit(0);
})();
