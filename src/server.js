/**
 * Serveur principal de l'API GXpro Sign
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const connectDB = require('./config/database');

// Initialiser l'application Express
const app = express();

// Connexion à MongoDB
connectDB();

// Middlewares de sécurité
app.use(
  helmet({
    contentSecurityPolicy: false, // Désactiver CSP pour Swagger UI
  })
);

// CORS - Accepter plusieurs origines en développement
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origine (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // En développement, autoriser tous les sous-domaines localhost
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
        // Autoriser localhost et tous les sous-domaines *.localhost
        if (
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          allowedOrigins.includes(origin)
        ) {
          return callback(null, true);
        }
      }

      // En production, vérifier strictement
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔍 DEBUG MIDDLEWARE - Log TOUTES les requêtes qui arrivent
app.use((req, res, next) => {
  console.log(`\n🌐 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.path === '/api/auth/login') {
    console.log('  Body:', JSON.stringify(req.body, null, 2));
    console.log('  Headers:', JSON.stringify(req.headers, null, 2));
  }
  next();
});

// Static files - serve uploaded files
app.use('/uploads', express.static('uploads'));

// ⚠️ SUBDOMAIN MIDDLEWARE DISABLED
// Les sous-domaines sont maintenant gérés côté frontend et envoyés dans le body des requêtes
// Le Host header est toujours localhost:5001 (pas de sous-domaine côté backend)
// const { extractSubdomain } = require('./middleware/subdomain');
// app.use(extractSubdomain);

// Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Route de test
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue sur l\'API GXpro Sign',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route de test de base de données
app.get('/api/test-db', async (req, res) => {
  try {
    const { Client, User } = require('./models');

    const clientCount = await Client.countDocuments();
    const userCount = await User.countDocuments();

    res.json({
      success: true,
      message: 'Connexion à la base de données OK',
      data: {
        clients: clientCount,
        users: userCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur de connexion à la base de données',
      error: error.message,
    });
  }
});

// Documentation API Swagger
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'GXpro Sign API Documentation',
}));

// Routes API
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/activation', require('./routes/activation.routes')); // Routes d'activation de compte
app.use('/api/users', require('./routes/user.routes')); // Routes utilisateur (profile, avatar)
app.use('/api/clients', require('./routes/client.routes'));
app.use('/api/documents', require('./routes/documents.routes')); // Nouvelles routes documents
app.use('/api/envelopes', require('./routes/envelopes.routes')); // Nouvelles routes envelopes
app.use('/api/fields', require('./routes/fields.routes')); // Routes pour les champs de signature
app.use('/api/sign', require('./routes/signature.routes')); // Routes publiques pour signature
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/admin/system-settings', require('./routes/systemSettings.routes')); // Paramètres système (Super Admin)
app.use('/api/admin/billing-plans', require('./routes/billingPlans.routes')); // Plans de facturation (Super Admin)

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});

module.exports = app;
