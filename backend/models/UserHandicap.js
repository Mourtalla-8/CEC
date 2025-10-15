/**
 * MODÈLE UTILISATEUR HANDICAP
 * 
 * Ce schéma représente un utilisateur handicap dans la base de données
 * Il contient toutes les informations personnelles et l'état du compte
 */

const mongoose = require('mongoose');
const { DocumentSchema, DOCUMENT_TYPES } = require('./Document');

const userHandicapSchema = new mongoose.Schema({
  // INFORMATIONS PERSONNELLES
  // =========================
  nom: {
    type: String,
    required: [true, 'Le nom est obligatoire'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  
  prenom: {
    type: String,
    required: [true, 'Le prénom est obligatoire'],
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },

  sexe: {
    type: String,
    required: [true, 'Le sexe est obligatoire'],
    enum: {
      values: ['M', 'F'],
      message: 'Le sexe doit être M ou F'
    }
  },

  dateNaissance: {
    type: Date,
    required: [true, 'La date de naissance est obligatoire'],
    validate: {
      validator: function(value) {
        // Vérifier que la date n'est pas dans le futur
        return value < new Date();
      },
      message: 'La date de naissance ne peut pas être dans le futur'
    }
  },

  // INFORMATIONS DE HANDICAP
  // ========================
  typeHandicap: {
    type: String,
    required: [true, 'Le type de handicap est obligatoire'],
    enum: {
      values: [
        'Moteur',                        // mobilité / marcher / déplacement
        'Visuel',                        // vision basse, malvoyance, cécité
        'Auditif',                       // perte partielle ou totale de l’audition
        'Mental',                        // déficience intellectuelle, retard mental
        'Psychique',                     // troubles mentaux : schizophrénie, bipolarité, etc.
        'Polyhandicap',                  // association de plusieurs types
        'Cognitif',                      // mémoire, concentration, apprentissage (ex : troubles dys)
        'Communication'                  // trouble de parole, langage
      ],
      message: 'Type de handicap non valide'
    }
  },

  // COORDONNÉES
  // ===========
  adresse: {
    type: String,
    required: [true, 'L\'adresse est obligatoire'],
    maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
  },

  telephone: {
    type: String,
    required: [true, 'Le téléphone est obligatoire'],
    unique: true,
    validate: {
      validator: function(v) {
        // Regex pour numéro sénégalais mobile : commence par 7 ou 3 et 9 chiffres au total
        return /^(7|3)[0-9]{8}$/.test(v);
      },
      message: 'Format de téléphone invalide (ex: 77XXXXXXX ou 33XXXXXXX)'
    }
  },

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

  // AUTHENTIFICATION ET SÉCURITÉ
  // =============================
  motDePasse: {
    type: String,
    minlength: [8, 'Le mot de passe doit faire au moins 6 caractères'],
    select: false // ne pas retourner par défaut
  },

  // RÔLE (toujours handicap pour ce modèle)
  // ====================================
  role: {
    type: String,
    default: 'handicap',
    enum: ['handicap'],
    immutable: true // Le rôle ne peut pas être modifié
  },

  statutCompte: {
    type: String,
    enum: ['en_ligne', 'hors_ligne', 'suspendu'],
    default: 'hors_ligne'
  },

  // DOCUMENTS UTILISATEUR
  // ==========================================
  documents: {
    type: [DocumentSchema],
    default: []
  },

  // Références
  // ===========
  demandes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemandeCEC'
  }],
  carteCEC: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CarteCEC',
    default: null
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
userHandicapSchema.index({ email: 1 });
userHandicapSchema.index({ telephone: 1 });
userHandicapSchema.index({ statutCompte: 1 });
userHandicapSchema.index({ carteCEC: 1 });

// MÉTHODES DU MODÈLE
// ==================

/**
 * Méthode pour obtenir le nom complet
 */
userHandicapSchema.methods.getNomComplet = function() {
  return `${this.prenom} ${this.nom}`;
};

/**
 * Méthode pour vérifier si le compte n'est pas suspendu
 */
userHandicapSchema.methods.estActif = function() {
  return this.statutCompte !== 'suspendu';
};

/**
 * Vérifie si l'utilisateur possède un document du type donné
 */
userHandicapSchema.methods.hasDocumentType = function(type) {
  if (!this.documents) return false;
  return (this.documents || []).some(d => d.type === type);
};

/**
 * Retourne les types de documents manquants par rapport à une liste requise
 */
userHandicapSchema.methods.getMissingDocuments = function(requiredTypes = []) {
  const present = new Set((this.documents || []).map(d => d.type));
  return requiredTypes.filter(t => !present.has(t));
};

/**
 * Retourne true si tous les documents requis sont présents
 */
userHandicapSchema.methods.hasAllRequiredDocuments = function(requiredTypes = []) {
  return this.getMissingDocuments(requiredTypes).length === 0;
};

/**
 * Méthode pour nettoyer les données sensibles avant envoi
 */
userHandicapSchema.methods.toJSON = function() {
  const userObject = this.toObject({ virtuals: true });
  
  // Supprimer les champs sensibles
  delete userObject.motDePasse;

  // supprimer champs internes éventuels
  if (userObject.__v !== undefined) delete userObject.__v;
  
  return userObject;
};

// MIDDLEWARE PRE-SAVE
// ===================

/**
 * Avant la sauvegarde, effectuer quelques vérifications
 */
// userHandicapSchema.pre('save', function(next) {
//   // Si c'est un nouvel utilisateur, initialiser le statut
//   if (this.isNew && !this.statutCompte) {
//     this.statutCompte = 'hors_ligne';
//   }
  
//   next();
// });

module.exports = mongoose.model('UserHandicap', userHandicapSchema);