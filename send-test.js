const { Resend } = require('resend');
const resend = new Resend('re_YDUsVuwo_FeLD25N7vd31oahhhAG5cTDG');

(async () => {
  try {
    console.log('📧 Envoi à zeuzkilla@gmail.com...\n');

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'zeuzkilla@gmail.com',
      subject: '✅ Test GXpro Sign - Backend Opérationnel',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">🎉 Backend GXpro Sign</h1>
            <p style="font-size: 18px; margin: 10px 0 0 0;">Test d'envoi d'email réussi!</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <strong style="font-size: 16px;">✅ Votre backend fonctionne parfaitement!</strong>
            </div>

            <h2 style="color: #333;">Configuration Déployée:</h2>
            <ul style="color: #666; line-height: 1.8;">
              <li>✅ <strong>Backend API:</strong> https://api.gxprosign.com</li>
              <li>✅ <strong>Node.js:</strong> 20.x</li>
              <li>✅ <strong>MongoDB:</strong> Connecté</li>
              <li>✅ <strong>PM2:</strong> 2 instances (cluster mode)</li>
              <li>✅ <strong>Nginx:</strong> Reverse proxy configuré</li>
              <li>✅ <strong>SSL:</strong> Wildcard certificate actif</li>
              <li>✅ <strong>Email:</strong> Resend API opérationnel</li>
            </ul>

            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
              <p style="margin: 0; color: #666;"><strong>Date d'envoi:</strong> ${new Date().toLocaleString('fr-FR')}</p>
            </div>

            <p style="color: #666; margin-top: 30px; font-size: 16px;">
              <strong>🚀 Votre plateforme de signature électronique est prête!</strong>
            </p>
          </div>

          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>GXpro Sign - Plateforme de signature électronique</p>
            <p>Ceci est un email de test automatique</p>
          </div>
        </div>
      `
    });

    console.log('✅ Email envoyé avec succès!');
    console.log('📬 Message ID:', result.data?.id);
    console.log('');
    console.log('🎉 Vérifiez votre boîte email zeuzkilla@gmail.com!');
    console.log('💡 Si vous ne voyez rien, vérifiez les SPAM/PROMOTIONS');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('Détails:', JSON.stringify(error.response.data, null, 2));
    }
  }
})();
