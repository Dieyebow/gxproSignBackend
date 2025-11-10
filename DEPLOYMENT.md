# 🚀 Guide de Déploiement - GXpro Sign Backend

Guide complet pour déployer le backend GXpro Sign sur Digital Ocean avec le domaine `https://api.gxprosign.com`.

## 📋 Prérequis

- Un compte Digital Ocean
- Un Droplet Ubuntu 22.04 LTS (ou plus récent)
- Un domaine configuré (`gxprosign.com`)
- MongoDB hébergé sur Digital Ocean
- Accès SSH à votre serveur

## 🔧 Étape 1 : Configuration du Serveur

### 1.1 Connexion au serveur

```bash
ssh root@your-droplet-ip
```

### 1.2 Mise à jour du système

```bash
apt update && apt upgrade -y
```

### 1.3 Installation de Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Devrait afficher v20.x.x
npm --version
```

### 1.4 Installation de PM2 (Process Manager)

```bash
npm install -g pm2
pm2 --version
```

### 1.5 Installation de Nginx

```bash
apt install -y nginx
systemctl status nginx
```

### 1.6 Installation de Certbot (SSL/TLS)

```bash
apt install -y certbot python3-certbot-nginx
```

## 🌐 Étape 2 : Configuration DNS

Dans votre panneau de configuration de domaine (ex: Cloudflare, NameCheap, etc.) :

1. Créer un enregistrement A pour `api.gxprosign.com`
   - Type: `A`
   - Name: `api`
   - Value: `<IP de votre Droplet>`
   - TTL: `Auto` ou `3600`

2. Attendre la propagation DNS (5-30 minutes)

Vérifier avec :
```bash
dig api.gxprosign.com
# ou
nslookup api.gxprosign.com
```

## 📦 Étape 3 : Déploiement du Code

### 3.1 Créer le dossier de déploiement

```bash
mkdir -p /var/www/gxprosign-backend
cd /var/www/gxprosign-backend
```

### 3.2 Cloner le repository

```bash
git clone https://github.com/Dieyebow/gxproSignBackend.git .
```

### 3.3 Installer les dépendances

```bash
npm install --production
```

### 3.4 Configurer les variables d'environnement

```bash
nano .env
```

Coller la configuration de production :

```env
# SERVEUR
PORT=5001
NODE_ENV=production

# BASE DE DONNÉES (Digital Ocean MongoDB)
MONGODB_URI=mongodb+srv://gxproSign:PASSWORD@gxpro-xxxxx.mongo.ondigitalocean.com/gxprosign?tls=true&authSource=admin&replicaSet=gxpro

# JWT
JWT_SECRET=<générer-une-clé-forte-ici>
JWT_REFRESH_SECRET=<générer-une-clé-forte-ici>
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# EMAIL
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM_NAME=GXpro Sign
EMAIL_FROM_ADDRESS=noreply@gxprosign.com

# FRONTEND
FRONTEND_URL=https://gxprosign.com
FRONTEND_URL_PRODUCTION=https://gxprosign.com

# DOMAINE
BASE_DOMAIN=gxprosign.com

# LOGGING
LOG_LEVEL=info

# FEATURES
ENABLE_TWO_FACTOR=true
ENABLE_SIGNATURE_UPLOAD=true
ENABLE_MOBILE_SIGNING=true
ENABLE_API_DOCS=true

# SUPPORT
SUPPORT_EMAIL=support@gxprosign.com
ADMIN_EMAIL=admin@gxprosign.com
```

**⚠️ Important** : Générer des clés JWT fortes :
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3.5 Créer le dossier de logs

```bash
mkdir -p logs
chmod 755 logs
```

## 🔄 Étape 4 : Démarrage avec PM2

### 4.1 Démarrer l'application

```bash
pm2 start ecosystem.config.js --env production
```

### 4.2 Configurer PM2 pour démarrer au boot

```bash
pm2 startup systemd
# Copier et exécuter la commande affichée
pm2 save
```

### 4.3 Vérifier le statut

```bash
pm2 status
pm2 logs gxprosign-api
pm2 monit  # Dashboard interactif
```

## 🔒 Étape 5 : Configuration Nginx

### 5.1 Créer la configuration Nginx

```bash
nano /etc/nginx/sites-available/api.gxprosign.com
```

Coller cette configuration :

```nginx
# Redirection HTTP vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.gxprosign.com;

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.gxprosign.com;

    # SSL Certificates (seront générés par Certbot)
    ssl_certificate /etc/letsencrypt/live/api.gxprosign.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gxprosign.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/api.gxprosign.com/chain.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logs
    access_log /var/log/nginx/api.gxprosign.com.access.log;
    error_log /var/log/nginx/api.gxprosign.com.error.log;

    # Proxy to Node.js backend
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads (si nécessaire)
    location /uploads {
        alias /var/www/gxprosign-backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5001/health;
        access_log off;
    }

    # Client body size (pour les uploads)
    client_max_body_size 10M;
}
```

### 5.2 Activer la configuration

```bash
ln -s /etc/nginx/sites-available/api.gxprosign.com /etc/nginx/sites-enabled/
nginx -t  # Tester la configuration
systemctl reload nginx
```

## 🔐 Étape 6 : Certificat SSL avec Let's Encrypt

### 6.1 Obtenir le certificat

```bash
certbot --nginx -d api.gxprosign.com
```

Suivre les instructions et choisir :
- Email pour les notifications
- Accepter les termes
- Choisir "Redirect" pour forcer HTTPS

### 6.2 Tester le renouvellement automatique

```bash
certbot renew --dry-run
```

Le certificat se renouvellera automatiquement tous les 90 jours.

## 🔥 Étape 7 : Configuration du Firewall

```bash
# Autoriser SSH, HTTP, HTTPS
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## ✅ Étape 8 : Vérification

### 8.1 Tester l'API

```bash
curl https://api.gxprosign.com/health
# Devrait retourner: {"success":true,"status":"healthy",...}
```

### 8.2 Vérifier les logs

```bash
pm2 logs gxprosign-api
tail -f /var/log/nginx/api.gxprosign.com.access.log
```

## 🔄 Commandes de Maintenance

### Mettre à jour le code

```bash
cd /var/www/gxprosign-backend
git pull origin main
npm install --production
pm2 reload gxprosign-api
```

### Redémarrer l'application

```bash
pm2 restart gxprosign-api
```

### Voir les logs

```bash
pm2 logs gxprosign-api --lines 100
```

### Monitoring

```bash
pm2 monit  # Dashboard interactif
pm2 status # Statut rapide
```

## 📊 Étape 9 : Monitoring et Alertes (Optionnel)

### 9.1 Installer PM2-Logrotate

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 9.2 Monitoring avec PM2 Plus (Optionnel)

```bash
pm2 link <secret-key> <public-key>
```

Obtenir les clés sur : https://pm2.io

## 🐛 Dépannage

### Backend ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs gxprosign-api --err

# Vérifier les variables d'environnement
pm2 env 0

# Redémarrer
pm2 delete gxprosign-api
pm2 start ecosystem.config.js --env production
```

### Nginx erreur 502

```bash
# Vérifier que Node.js écoute sur le port 5001
netstat -tulpn | grep 5001

# Vérifier les logs Nginx
tail -f /var/log/nginx/error.log

# Tester la configuration Nginx
nginx -t
```

### Problèmes de connexion MongoDB

```bash
# Tester la connexion depuis le serveur
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ Connected to MongoDB');
  process.exit(0);
}).catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});
"
```

## 📞 Support

- Email: support@gxprosign.com
- GitHub: https://github.com/Dieyebow/gxproSignBackend

---

**🎉 Félicitations ! Votre backend GXpro Sign est maintenant déployé sur `https://api.gxprosign.com` !**
