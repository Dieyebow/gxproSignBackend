#!/bin/bash

# Script pour sauvegarder la base de données MongoDB

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}💾 Sauvegarde de la base de données GXpro Sign${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Lire l'URI MongoDB depuis .env ou utiliser la valeur par défaut
MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017/gxprosign"}

# Créer un nom de backup avec timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./database-backup"

echo -e "\n${YELLOW}📍 URI MongoDB: ${MONGODB_URI}${NC}"
echo -e "${YELLOW}📂 Backup directory: ${BACKUP_DIR}${NC}\n"

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Sauvegarder la base de données
echo -e "${GREEN}🔄 Sauvegarde en cours...${NC}\n"

mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Base de données sauvegardée avec succès!${NC}"
    echo -e "${GREEN}📂 Location: ${BACKUP_DIR}${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Afficher les statistiques
    echo -e "${YELLOW}📊 Statistiques:${NC}"
    du -sh "$BACKUP_DIR"
else
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Erreur lors de la sauvegarde${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi
