#!/bin/bash

# Script pour restaurer la base de données MongoDB depuis un backup

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔄 Restauration de la base de données GXpro Sign${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Lire l'URI MongoDB depuis .env ou utiliser la valeur par défaut
MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017/gxprosign"}

echo -e "\n${YELLOW}📍 URI MongoDB: ${MONGODB_URI}${NC}"
echo -e "${YELLOW}📂 Backup directory: ./database-backup${NC}\n"

# Demander confirmation
read -p "⚠️  Cette opération va ÉCRASER la base de données existante. Continuer? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${RED}❌ Opération annulée${NC}"
    exit 1
fi

# Restaurer la base de données
echo -e "\n${GREEN}🔄 Restauration en cours...${NC}\n"

mongorestore --uri="$MONGODB_URI" --drop ./database-backup

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Base de données restaurée avec succès!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
else
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Erreur lors de la restauration${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi
