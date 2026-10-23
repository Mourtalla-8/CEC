const mongoose = require('mongoose');

const RenewalEntrySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  certificatPerteUrl: { type: String },
  notes: { type: String }
}, { _id: false });

const carteSchema = new mongoose.Schema({
  numeroCarte: { type: String, unique: true, required: true }, // format CEC-YYYYMM-XXXXXX
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'UserHandicap', required: true, unique: true },
  dateDelivrance: { type: Date, default: Date.now },
  dateExpiration: { type: Date, required: true }, // 1 an après
  statut: { type: String, enum: ['valide', 'expiree'], default: 'valide' },
  nombreRenouvellements: { type: Number, default: 0 },
  dateDernierRenouvellement: { type: Date },
  certificat_perte: { type: String }, // url dernière perte
  historiqueRenouvellements: { type: [RenewalEntrySchema], default: [] }
}, { timestamps: true });

// Génération numéro de carte
carteSchema.statics.generateNumero = async function() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const seq = Date.now().toString().slice(-6);
  const numero = `CEC-${y}${m}-${seq}`;

  const existe = await this.findOne({ numeroCarte: numero });
  if (existe) return this.generateNumero();

  return numero
};

// Définir dateExpiration par défaut à +1 an si absente
carteSchema.pre('validate', function() {
  if (!this.dateExpiration && this.dateDelivrance) {
    const d = new Date(this.dateDelivrance);
    d.setFullYear(d.getFullYear() + 1);
    this.dateExpiration = d;
  }
});

module.exports = mongoose.model('CarteCEC', carteSchema);
