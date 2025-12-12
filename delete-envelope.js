const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://gxprosign:U6c7nPI50LwaVEy6@cluster0.mongodb.net/gxprosign?retryWrites=true&w=majority';

async function deleteEnvelope() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB\n');

    const Envelope = mongoose.model('Envelope', new mongoose.Schema({}, { strict: false }));
    
    const envelopeId = '6936ee44e40b246cf55ce2ab';
    
    const envelope = await Envelope.findById(envelopeId);
    
    if (!envelope) {
      console.log('❌ Enveloppe non trouvée');
      process.exit(0);
    }

    console.log('📋 Enveloppe trouvée:');
    console.log('   ID:', envelope._id);
    console.log('   Titre:', envelope.title);
    console.log('   Status:', envelope.status);
    
    await Envelope.deleteOne({ _id: envelopeId });
    
    console.log('\n✅ Enveloppe supprimée avec succès!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

deleteEnvelope();
