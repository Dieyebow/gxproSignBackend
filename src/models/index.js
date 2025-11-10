/**
 * Export centralisé de tous les modèles
 */

const User = require('./User');
const Client = require('./Client');
const Document = require('./Document');
const Envelope = require('./Envelope');
const Signature = require('./Signature');
const Field = require('./Field');
const AuditLog = require('./AuditLog');
const SystemSettings = require('./SystemSettings.model');

module.exports = {
  User,
  Client,
  Document,
  Envelope,
  Signature,
  Field,
  AuditLog,
  SystemSettings,
};
