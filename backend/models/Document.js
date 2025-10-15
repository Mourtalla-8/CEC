const mongoose = require('mongoose');

// Types de documents gérés par le système
const DOCUMENT_TYPES = [
  'photo_identite_1',
  'photo_identite_2',
  'extrait_naissance',     // obligatoire uniquement pour mineur
  'cni_recto',             // obligatoire uniquement pour majeur
  'cni_verso',             // ...
  'certificat_residence',
  'certificat_invalidite',
  'justificatif_domicile',
  'demande_manuscrite',    // obligatoire uniquement pour 1ère demande
  'certificat_perte'       // obligatoire uniquement pour renouvellement
];

const DocumentHistorySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  url: { type: String, required: true },
  dateUpload: { type: Date, default: Date.now },
  filename: String,
  mimetype: String,
  size: Number
}, { _id: false });

const DocumentSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: DOCUMENT_TYPES },
  url: { type: String, required: true },
  filename: String,
  mimetype: String,
  size: Number,
  dateUpload: { type: Date, default: Date.now },
  valide: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  history: { type: [DocumentHistorySchema], default: [] },
  validatedAt: { type: Date },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAdmin' }
}, { _id: true, timestamps: true });

DocumentSchema.methods.bumpVersion = function(newUrl, meta = {}) {
  // Archiver la version actuelle
  this.history.push({
    version: this.version,
    url: this.url,
    dateUpload: this.dateUpload,
    filename: this.filename,
    mimetype: this.mimetype,
    size: this.size
  });
  // Appliquer la nouvelle version
  this.version += 1;
  this.url = newUrl;
  this.dateUpload = new Date();
  if (meta.filename) this.filename = meta.filename;
  if (meta.mimetype) this.mimetype = meta.mimetype;
  if (meta.size) this.size = meta.size;
  // Toute mise à jour invalide le doc jusqu'à revalidation
  this.valide = false;
  this.validatedAt = undefined;
  this.validatedBy = undefined;
};

module.exports = {
  DocumentSchema,
  DOCUMENT_TYPES
};
