#!/bin/bash

# Script pour uploader la base de données vers Digital Ocean

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📤 Upload vers Digital Ocean MongoDB${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Demander les informations de connexion
echo -e "\n${BLUE}Veuillez fournir les informations de connexion Digital Ocean:${NC}\n"

read -p "Host (ex: mongodb-do-user-xxxxx-0.db.ondigitalocean.com): " DO_HOST
read -p "Port (par défaut 27017): " DO_PORT
DO_PORT=${DO_PORT:-27017}

read -p "Username: " DO_USER
read -sp "Password: " DO_PASS
echo

read -p "Database name (par défaut gxprosign): " DO_DB
DO_DB=${DO_DB:-gxprosign}

read -p "Utiliser TLS/SSL? (y/n, par défaut y): " USE_TLS
USE_TLS=${USE_TLS:-y}

# Construire l'URI
if [[ $USE_TLS =~ ^[Yy]$ ]]; then
    MONGODB_URI="mongodb://${DO_USER}:${DO_PASS}@${DO_HOST}:${DO_PORT}/${DO_DB}?authSource=admin&tls=true"
else
    MONGODB_URI="mongodb://${DO_USER}:${DO_PASS}@${DO_HOST}:${DO_PORT}/${DO_DB}?authSource=admin"
fi

echo -e "\n${YELLOW}📍 URI construit (mot de passe masqué)${NC}"
echo -e "${YELLOW}📂 Backup local: ./database-backup${NC}\n"

# Demander confirmation
read -p "⚠️  Cette opération va ÉCRASER la base de données distante. Continuer? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${RED}❌ Opération annulée${NC}"
    exit 1
fi

# Tester la connexion
echo -e "\n${BLUE}🔍 Test de connexion au serveur Digital Ocean...${NC}\n"

mongosh "$MONGODB_URI" --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Impossible de se connecter au serveur Digital Ocean${NC}"
    echo -e "${RED}Vérifiez vos identifiants et votre connexion internet${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connexion réussie!${NC}\n"

# Upload de la base de données
echo -e "${GREEN}🔄 Upload en cours... (cela peut prendre plusieurs minutes)${NC}\n"

mongorestore --uri="$MONGODB_URI" --drop ./database-backup --numInsertionWorkers=4

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Base de données uploadée avec succès sur Digital Ocean!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Afficher les statistiques
    echo -e "${BLUE}📊 Vérification des données uploadées...${NC}\n"
    mongosh "$MONGODB_URI" --quiet --eval "
        print('Collections:');
        db.getCollectionNames().forEach(function(col) {
            var count = db[col].countDocuments();
            print('  - ' + col + ': ' + count + ' documents');
        });
    "
else
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Erreur lors de l'upload${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi
