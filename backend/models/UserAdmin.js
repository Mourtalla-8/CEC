/**
 * MODÈLE UTILISATEUR ADMINISTRATEUR
 * 
 * Ce schéma représente un administrateur du système
 * Structure simple : email, mot de passe hashé, rôle
 */

const mongoose = require('mongoose');

const userAdminSchema = new mongoose.Schema({
  // EMAIL DE CONNEXION
  // ==================
  email: {
    type: String,
    required: [true, 'L\'email est obligatoire'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Format d\'email invalide'
    }
  },

  // MOT DE PASSE HASHÉ
  // ==================
  motDePasse: {
    type: String,
    required: [true, 'Le mot de passe est obligatoire'],
    minlength: [8, 'Le mot de passe doit faire au moins 8 caractères']
  },

  // RÔLE (toujours admin pour ce modèle)
  // ====================================
  role: {
    type: String,
    default: 'admin',
    enum: ['admin'],
    immutable: true // Le rôle ne peut pas être modifié
  },

  // INFORMATIONS OPTIONNELLES
  // =========================
  nom: {
    type: String,
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },

  prenom: {
    type: String,
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },

  // STATUT DU COMPTE ADMIN
  // ======================
  statut: {
    type: String,
    enum: ['en_ligne', 'hors_ligne', 'suspendu'],
    default: 'hors_ligne'
  },

  // DERNIÈRE CONNEXION
  // ==================
  derniereConnexion: {
    type: Date,
    default: null
  }

}, {
  // Options du schéma
  timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

// INDEX POUR OPTIMISER LES REQUÊTES
// ==================================
userAdminSchema.index({ statut: 1 });

// MÉTHODES DU MODÈLE
// ==================

/**
 * Méthode pour obtenir le nom complet (si disponible)
 */
userAdminSchema.methods.getNomComplet = function() {
  if (this.nom && this.prenom) {
    return `${this.prenom} ${this.nom}`;
  }
  return this.email; // Retourner l'email si pas de nom/prénom
};

/**
 * Méthode pour vérifier si le compte n'est pas suspendu
 */
userAdminSchema.methods.estActif = function() {
  return this.statut !== 'suspendu';
};

/**
 * Méthode pour nettoyer les données sensibles avant envoi
 */
userAdminSchema.methods.toJSON = function() {
  const adminObject = this.toObject();
  
  // Supprimer le mot de passe hashé
  delete adminObject.motDePasse;
  
  return adminObject;
};

// MÉTHODES STATIQUES
// ==================

/**
 * Méthode statique pour trouver un admin actif par email
 */
userAdminSchema.statics.trouverAdminActif = function(email) {
  return this.findOne({ 
    email: email.toLowerCase(), 
    statut: { $ne: 'suspendu' }
  });
};

module.exports = mongoose.model('UserAdmin', userAdminSchema);