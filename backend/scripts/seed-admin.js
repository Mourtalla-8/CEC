require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const UserAdmin = require('../models/UserAdmin');

// Liste facile à modifier pour créer/mettre à jour plusieurs admins
// Ajoute/modifie les objets ci-dessous selon tes besoins
const admins = [
  {
    email: process.env.SEED_ADMIN_EMAIL || 'admin1@cec.gouv.sn',
    motDePasseClair: process.env.SEED_ADMIN_PASSWORD || 'Admin1@1234',
    nom: process.env.SEED_ADMIN_NOM || 'Kamado',
    prenom: process.env.SEED_ADMIN_PRENOM || 'TanJI',
    statut: process.env.SEED_ADMIN_STATUT || 'hors_ligne'
  }
  // , { email: 'autre@cec.gouv.sn', motDePasseClair: 'Mot2Passe', nom: 'Nom', prenom: 'Prénom', statut: 'en_ligne' }
];

async function seedOne(spec) {
  if (!spec?.email) throw new Error('Email requis pour créer un admin');
  if (!spec?.motDePasseClair) throw new Error('motDePasseClair requis pour créer un admin');

  const email = String(spec.email).toLowerCase();
  const existing = await UserAdmin.findOne({ email });

  // Hasher le mot de passe fourni
  const hash = await bcrypt.hash(spec.motDePasseClair, 10);

  if (existing) {
    // Mettre à jour les infos utiles, y compris le mot de passe si fourni
    existing.nom = spec.nom ?? existing.nom;
    existing.prenom = spec.prenom ?? existing.prenom;
    existing.statut = spec.statut ?? existing.statut;
    existing.motDePasse = hash; // forcer MAJ pour garantir l'accès
    await existing.save();
    return { action: 'updated', email };
  }

  // Créer un nouvel admin
  const admin = new UserAdmin({
    email,
    motDePasse: hash,
    role: 'admin',
    nom: spec.nom,
    prenom: spec.prenom,
    statut: spec.statut || 'hors_ligne'
  });
  await admin.save();
  return { action: 'created', email };
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erreur: MONGODB_URI manquant dans les variables d\'environnement.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ Connecté à MongoDB');

    const results = [];
    for (const spec of admins) {
      try {
        const res = await seedOne(spec);
        results.push(res);
        console.log(`Admin ${res.action}: ${res.email}`);
      } catch (e) {
        console.error(`❌ Echec création/mise à jour admin (${spec.email}):`, e.message);
      }
    }

    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    if (results.length === 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seeding:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}
