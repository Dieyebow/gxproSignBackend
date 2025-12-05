const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    // Informations personnelles
    firstName: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
      select: false, // Ne pas retourner le mot de passe par défaut
    },

    // Rôle et appartenance
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN_B2B', 'USER_B2B'],
      default: 'USER_B2B',
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },

    // Permissions spécifiques
    permissions: [
      {
        resource: {
          type: String,
          enum: ['documents', 'users', 'settings', 'envelopes', 'reports'],
        },
        actions: {
          type: [String],
          enum: ['create', 'read', 'update', 'delete'],
        },
      },
    ],

    // Profil
    profile: {
      avatar: String,
      title: String,
      department: String,
      phone: String,
      timezone: {
        type: String,
        default: 'Europe/Paris',
      },
      language: {
        type: String,
        default: 'fr',
      },
    },

    // Sécurité
    security: {
      twoFactorEnabled: {
        type: Boolean,
        default: false,
      },
      twoFactorSecret: String,
      lastPasswordChange: Date,
      failedLoginAttempts: {
        type: Number,
        default: 0,
      },
      lockedUntil: Date,
    },

    // Tokens
    refreshToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerified: {
      type: Boolean,
      default: false,
    },

    // Métadonnées
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    lastLoginAt: Date,
    lastLoginIP: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: email already has unique index from schema definition
userSchema.index({ clientId: 1, role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });

// Hash du mot de passe avant sauvegarde
userSchema.pre('save', async function (next) {
  // Si le mot de passe n'est pas modifié, passer
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.security.lastPasswordChange = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Générer un JWT access token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      clientId: this.clientId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '1h',
    }
  );
};

// Générer un JWT refresh token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    }
  );
};

// Générer un token de réinitialisation de mot de passe
userSchema.methods.generateResetPasswordToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 3600000; // 1 heure

  return resetToken;
};

// Vérifier si l'utilisateur est verrouillé
userSchema.methods.isLocked = function () {
  return !!(this.security.lockedUntil && this.security.lockedUntil > Date.now());
};

// Incrémenter les tentatives de connexion échouées
userSchema.methods.incrementFailedAttempts = async function () {
  // Si le compte est déjà verrouillé et que le temps est écoulé, réinitialiser
  if (this.security.lockedUntil && this.security.lockedUntil < Date.now()) {
    await this.updateOne({
      $set: { 'security.failedLoginAttempts': 1 },
      $unset: { 'security.lockedUntil': 1 },
    });
    return;
  }

  // Incrémenter le compteur
  const updates = { $inc: { 'security.failedLoginAttempts': 1 } };

  // Verrouiller après 5 tentatives
  const maxAttempts = 5;
  const lockTime = 15 * 60 * 1000; // 15 minutes

  if (this.security.failedLoginAttempts + 1 >= maxAttempts) {
    updates.$set = { 'security.lockedUntil': Date.now() + lockTime };
  }

  await this.updateOne(updates);
};

// Réinitialiser les tentatives de connexion
userSchema.methods.resetFailedAttempts = async function () {
  await this.updateOne({
    $set: { 'security.failedLoginAttempts': 0 },
    $unset: { 'security.lockedUntil': 1 },
  });
};

// Méthode pour retourner l'objet utilisateur sans données sensibles
userSchema.methods.toJSON = function () {
  const user = this.toObject();

  // Protection contre les objets null/undefined
  if (!user) {
    return null;
  }

  delete user.password;
  delete user.refreshToken;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;

  // Protection pour security qui peut ne pas exister
  if (user.security && user.security.twoFactorSecret) {
    delete user.security.twoFactorSecret;
  }

  return user;
};

module.exports = mongoose.model('User', userSchema);
