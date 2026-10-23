/**
 * MODÈLE DEMANDE CEC
 * 
 * Ce schéma représente une demande de Carte d'Égalité des Chances
 * Il contient le type, le statut et la référence vers l'utilisateur
 */

const mongoose = require('mongoose');

const DocumentFournisSchema = new mongoose.Schema({
  type: { type: String, enum: ['demande_manuscrite', 'certificat_perte'], required: true },
  url: { type: String, required: true },
  filename: String,
  mimetype: String,
  size: Number,
  dateUpload: { type: Date, default: Date.now }
}, { _id: false });

const demandeCECSchema = new mongoose.Schema({
  numeroDemande: { type: String, unique: true, required: true }, // SN-YYYYMM-XXXXXX
  type: { type: String, enum: ['nouvelle', 'renouvellement'], required: true },
  statut: { type: String, enum: ['en_attente', 'en_cours_traitement', 'validee', 'rejetee'], default: 'en_attente', required: true },
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'UserHandicap', required: true },

  // Admin en charge du traitement (propriété de la demande pendant le traitement)
  assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAdmin', default: null },
  assignedAt: { type: Date },

  documentsFournis: { type: [DocumentFournisSchema], default: [] },
  dateSoumission: { type: Date, default: Date.now },
  motifRefus: { type: String },
  commentairesAdmin: { type: String, default: '' },

  historique: [{
    action: { type: String, enum: ['creation', 'traitement', 'validation', 'refus'], required: true },
    date: { type: Date, default: Date.now },
    acteur: { type: String, required: true },
    details: { type: String }
  }]
}, { timestamps: true });

// INDEX POUR OPTIMISER LES REQUÊTES
// ==================================
demandeCECSchema.index({ utilisateur: 1 });
demandeCECSchema.index({ statut: 1 });
demandeCECSchema.index({ numeroDemande: 1 });
demandeCECSchema.index({ createdAt: -1 });

// MÉTHODES DU MODÈLE
// ==================

demandeCECSchema.statics.generateNumeroDemande = async function() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const seq = Date.now().toString().slice(-6);
  const numero = `SN-${y}${m}-${seq}`;

  const existe = await this.findOne({ numeroDemande: numero });
  if (existe) return await this.generateNumeroDemande();

  return numero
};

demandeCECSchema.methods.setStatut = function(nouveau, acteur, details='') {
  const ancien = this.statut;
  this.statut = nouveau;
  this.historique.push({ action: nouveau === 'validee' ? 'validation' : nouveau === 'rejetee' ? 'refus' : 'modification', acteur, details: details || `Statut: ${ancien} -> ${nouveau}` });
};


/**
 * Méthode pour changer le statut avec historique
 */
demandeCECSchema.methods.changerStatut = function(nouveauStatut, auteur, details = '') {
  const ancienStatut = this.statut;
  this.statut = nouveauStatut;
  this.dateDerniereModification = new Date();
  
  // Si la demande est validée ou rejetée, mettre la date de traitement
  if (nouveauStatut === 'validee' || nouveauStatut === 'rejetee') {
    this.dateTraitement = new Date();
  }
  
  // Ajouter à l'historique
  this.historique.push({
    action: this.obtenirActionPourStatut(nouveauStatut),
    acteur: auteur,
    details: details || `Changement de statut: ${ancienStatut} → ${nouveauStatut}`
  });
  
  return this;
};

/**
 * Méthode pour obtenir l'action correspondant à un statut
 */
demandeCECSchema.methods.obtenirActionPourStatut = function(statut) {
  const actions = {
    'en_attente': 'creation',
    'en_cours_traitement': 'traitement',
    'validee': 'validation',
    'rejetee': 'refus'
  };
  return actions[statut] || 'modification';
};


// MIDDLEWARE PRE-SAVE
// ===================

// async : une erreur levée ici fait échouer le save (mongoose 9 ne passe plus next)
demandeCECSchema.pre('save', async function() {
  if (this.isNew) {
    this.numeroDemande = await this.constructor.generateNumeroDemande();
    this.historique.push({ action: 'creation', acteur: this.utilisateur.toString(), details: 'Création de la demande' });
  }
});

// MÉTHODES STATIQUES
// ==================

/**
 * Méthode statique pour obtenir les statistiques des demandes
 */
demandeCECSchema.statics.obtenirStatistiques = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$statut',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    en_attente: 0,
    en_cours_traitement: 0,
    validee: 0,
    rejetee: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

module.exports = mongoose.model('DemandeCEC', demandeCECSchema);