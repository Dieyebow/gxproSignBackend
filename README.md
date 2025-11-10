# 🚀 GXpro Sign - Backend API

API REST pour la plateforme de signature électronique GXpro Sign.

## 📋 Prérequis

- Node.js 18+
- MongoDB 6+ (local ou MongoDB Atlas)
- npm ou yarn

## 🛠️ Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer les variables d'environnement

Copier le fichier `.env.example` vers `.env` et modifier les valeurs:

```bash
cp .env.example .env
```

Ou utiliser le fichier `.env` déjà créé.

### 3. Installer MongoDB localement (si nécessaire)

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

#### Linux (Ubuntu/Debian)
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Windows
Télécharger depuis: https://www.mongodb.com/try/download/community

## 🧪 Tests et Scripts

### Tester la connexion MongoDB
```bash
npm run test-connection
```

Résultat attendu:
```
✅ MongoDB connecté avec succès: localhost
📊 Base de données: gxprosign
```

### Seed des données initiales
```bash
npm run seed
```

Cela créera:
- 1 SuperAdmin (admin@gxprosign.com / Admin123!)
- 1 Client de démo (demo.gxprosign.com)
- 1 Admin B2B (john@demo.com / Demo123!)
- 1 Utilisateur B2B (jane@demo.com / Demo123!)

### 💾 Sauvegarde et Restauration de la Base de Données

#### Sauvegarder la base de données
```bash
npm run backup-db
# ou
bash scripts/backup-database.sh
```

Cela créera un dump complet de la base de données dans `database-backup/gxprosign/`.

#### Restaurer la base de données
```bash
npm run restore-db
# ou
bash scripts/restore-database.sh
```

⚠️ **Attention** : Cette opération **écrasera** la base de données existante.

#### Structure du backup
Le backup contient:
- **Collections** : clients, users, documents, envelopes, signatures, fields, auditlogs
- **Format** : BSON (format binaire MongoDB)
- **Métadonnées** : Indexes et schémas

#### Importer vers MongoDB Atlas ou autre serveur distant
```bash
# Définir l'URI MongoDB
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/gxprosign"

# Restaurer
mongorestore --uri="$MONGODB_URI" --drop ./database-backup
```

### Démarrer le serveur en mode développement
```bash
npm run dev
```

Le serveur démarrera sur: http://localhost:5000

### Démarrer le serveur en mode production
```bash
npm start
```

## 📡 Routes API Disponibles

### Routes de Base

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Page d'accueil de l'API |
| GET | `/health` | Health check |
| GET | `/api/test-db` | Test de la base de données |

## 🗄️ Structure de la Base de Données

La base de données contient **7 collections** :

1. **clients** - Clients B2B (multi-tenant)
2. **users** - Utilisateurs (SuperAdmin, Admin B2B, User B2B)
3. **documents** - Documents PDF uploadés
4. **envelopes** - Enveloppes de signature (workflow)
5. **signatures** - Signatures électroniques
6. **fields** - Champs de formulaire sur les documents
7. **audit_logs** - Journal d'audit et traçabilité

Voir [DATABASE_STRUCTURE.md](../DATABASE_STRUCTURE.md) pour les détails complets.

## 📦 Modèles Mongoose

Tous les modèles sont dans `src/models/`:

- `User.js` - Gestion des utilisateurs avec authentification
- `Client.js` - Gestion des clients B2B multi-tenant
- `Document.js` - Gestion des documents PDF
- `Envelope.js` - Workflow de signature complet
- `Signature.js` - Signatures électroniques
- `Field.js` - Champs de formulaire
- `AuditLog.js` - Logs d'audit

## 🔐 Sécurité

- **Mots de passe** : Hashés avec bcrypt (10 rounds)
- **JWT** : Tokens d'authentification avec expiration
- **Rate Limiting** : À implémenter
- **CORS** : Configuré pour le frontend
- **Helmet** : Headers de sécurité HTTP

## 🚧 À Faire

- [ ] Implémenter les routes d'authentification
- [ ] Implémenter les routes CRUD clients
- [ ] Implémenter les routes documents
- [ ] Implémenter les routes envelopes
- [ ] Implémenter les routes signatures
- [ ] Service d'envoi d'emails
- [ ] Service de manipulation PDF
- [ ] Middleware d'authentification JWT
- [ ] Middleware multi-tenant
- [ ] Rate limiting
- [ ] Tests unitaires
- [ ] Documentation API (Swagger)

## 📝 Comptes de Test

Après avoir exécuté `npm run seed`:

### SuperAdmin
- Email: `admin@gxprosign.com`
- Password: `Admin123!`
- Rôle: SUPER_ADMIN
- Accès: Tous les clients

### Client Demo (demo.gxprosign.com)

**Admin B2B**
- Email: `john@demo.com`
- Password: `Demo123!`
- Rôle: ADMIN_B2B

**Utilisateur B2B**
- Email: `jane@demo.com`
- Password: `Demo123!`
- Rôle: USER_B2B

## 🐛 Débogage

### Vérifier si MongoDB est en cours d'exécution

```bash
# macOS
brew services list | grep mongodb

# Linux
sudo systemctl status mongod

# Connexion manuelle
mongosh
```

### Voir les logs MongoDB

```bash
# macOS
tail -f /usr/local/var/log/mongodb/mongo.log

# Linux
sudo tail -f /var/log/mongodb/mongod.log
```

### Réinitialiser la base de données

```bash
# Se connecter à MongoDB
mongosh

# Supprimer la base de données
use gxprosign
db.dropDatabase()

# Sortir et re-seed
exit
npm run seed
```

## 📚 Documentation

- [Documentation complète](../README.md)
- [Structure de la base de données](../DATABASE_STRUCTURE.md)
- [Mongoose Docs](https://mongoosejs.com/)
- [Express Docs](https://expressjs.com/)

## 🤝 Contribution

Ce projet est développé par Peeloinc.

## 📄 Licence

Propriétaire - Tous droits réservés © 2025 Peeloinc
