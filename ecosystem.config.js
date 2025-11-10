module.exports = {
  apps: [
    {
      name: 'gxprosign-api',
      script: './src/server.js',
      instances: 'max', // Utilise tous les CPU disponibles
      exec_mode: 'cluster', // Mode cluster pour load balancing
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      // Options de monitoring
      max_memory_restart: '500M', // Redémarre si la mémoire dépasse 500MB
      min_uptime: '10s', // Temps minimum avant de considérer un démarrage réussi
      max_restarts: 10, // Nombre max de redémarrages en cas d'erreur
      autorestart: true, // Redémarre automatiquement en cas de crash
      
      // Logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true, // Ajoute un timestamp aux logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Gestion des erreurs
      kill_timeout: 5000, // Timeout avant de forcer l'arrêt
      listen_timeout: 10000, // Timeout pour la création du serveur
      shutdown_with_message: true,
      
      // Rotation des logs (nécessite pm2-logrotate)
      merge_logs: true,
      
      // Variables d'environnement (lues depuis .env)
      env_file: '.env',
      
      // Watch (désactivé en production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'database-backup'],
      
      // Cron pour redémarrer automatiquement (optionnel)
      // cron_restart: '0 4 * * *', // Redémarre tous les jours à 4h du matin
    },
  ],

  // Configuration du déploiement
  deploy: {
    production: {
      user: 'root', // ou ton utilisateur
      host: 'api.gxprosign.com', // ton serveur Digital Ocean
      ref: 'origin/main',
      repo: 'https://github.com/Dieyebow/gxproSignBackend.git',
      path: '/var/www/gxprosign-backend',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
    },
  },
};
