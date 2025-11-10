const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GXpro Sign API',
      version: '0.2.0',
      description: `
        API de gestion de signatures électroniques pour GXpro Sign.

        ## Fonctionnalités
        - 🔐 Authentification JWT avec refresh tokens
        - 👥 Gestion multi-tenant (B2B)
        - 📝 Gestion de documents et enveloppes
        - ✍️ Signatures électroniques
        - 📊 Audit et conformité

        ## Architecture
        - **SuperAdmin** : Gestion des clients B2B
        - **Admin B2B** : Gestion de l'entreprise cliente
        - **User B2B** : Upload documents et gestion des signatures
        - **Signataire** : Signature sans compte (via token)

        ## Authentification
        La plupart des endpoints nécessitent un token JWT dans le header Authorization :
        \`\`\`
        Authorization: Bearer <access_token>
        \`\`\`
      `,
      contact: {
        name: 'GXpro Sign Support',
        email: 'support@gxprosign.com',
      },
      license: {
        name: 'Propriétaire',
      },
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Serveur de développement local',
      },
      {
        url: 'https://api.gxprosign.com',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenu via /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'ID unique de l\'utilisateur',
              example: '68f941c514f7143c35bb0a1f',
            },
            firstName: {
              type: 'string',
              description: 'Prénom',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'Nom',
              example: 'Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email',
              example: 'john@demo.com',
            },
            role: {
              type: 'string',
              enum: ['SUPER_ADMIN', 'ADMIN_B2B', 'USER_B2B'],
              description: 'Rôle de l\'utilisateur',
              example: 'ADMIN_B2B',
            },
            clientId: {
              type: 'string',
              nullable: true,
              description: 'ID du client B2B (null pour SuperAdmin)',
              example: '68f941c514f7143c35bb0a20',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
              description: 'Statut du compte',
              example: 'ACTIVE',
            },
            emailVerified: {
              type: 'boolean',
              description: 'Email vérifié',
              example: true,
            },
            profile: {
              type: 'object',
              properties: {
                timezone: {
                  type: 'string',
                  example: 'Europe/Paris',
                },
                language: {
                  type: 'string',
                  example: 'fr',
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Client: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '68f941c514f7143c35bb0a20',
            },
            companyName: {
              type: 'string',
              example: 'Acme Corporation',
            },
            subdomain: {
              type: 'string',
              example: 'acme',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contact@acme.com',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
              example: 'ACTIVE',
            },
            subscription: {
              type: 'object',
              properties: {
                plan: {
                  type: 'string',
                  enum: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'],
                  example: 'PROFESSIONAL',
                },
                status: {
                  type: 'string',
                  enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'],
                  example: 'ACTIVE',
                },
                billingCycle: {
                  type: 'string',
                  enum: ['MONTHLY', 'YEARLY'],
                  example: 'MONTHLY',
                },
              },
            },
            limits: {
              type: 'object',
              properties: {
                maxDocumentsPerMonth: {
                  type: 'integer',
                  example: 100,
                },
                maxUsers: {
                  type: 'integer',
                  example: 10,
                },
                maxStorageGB: {
                  type: 'integer',
                  example: 5,
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Message d\'erreur',
              example: 'Une erreur est survenue',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Champ en erreur',
                  },
                  message: {
                    type: 'string',
                    description: 'Message d\'erreur',
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Token d\'authentification manquant ou invalide',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Accès refusé. Aucun token fourni.',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Permissions insuffisantes',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Accès refusé. Permissions insuffisantes.',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Ressource non trouvée',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Ressource non trouvée',
              },
            },
          },
        },
        ValidationError: {
          description: 'Erreur de validation des données',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                errors: [
                  {
                    field: 'email',
                    message: '"email" must be a valid email',
                  },
                ],
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints d\'authentification et gestion des comptes',
      },
      {
        name: 'Clients',
        description: 'Gestion des clients B2B (SuperAdmin)',
      },
      {
        name: 'Users',
        description: 'Gestion des utilisateurs',
      },
      {
        name: 'Documents',
        description: 'Gestion des documents PDF',
      },
      {
        name: 'Envelopes',
        description: 'Workflow de signature',
      },
      {
        name: 'Signatures',
        description: 'Signatures électroniques',
      },
      {
        name: 'Dashboard',
        description: 'Statistiques et analytics',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Chemins vers les fichiers contenant les annotations
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
