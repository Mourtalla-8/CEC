/**
 * CONTRÔLEUR D'UPLOAD DE DOCUMENTS
 * 
 * Ce contrôleur gère l'upload et la gestion des documents
 * pour les utilisateurs handicap
 */

const path = require('path');
const fs = require('fs').promises;
const UserHandicap = require('../models/UserHandicap');
const DemandeCEC = require('../models/DemandeCEC');
const { DOCUMENT_TYPES } = require('../models/Document');
const { emitToRole, emitToUser } = require('../services/socketManager');

/**
 * UPLOAD D'UN DOCUMENT
 * =====================
 * Upload un fichier et l'associe à l'utilisateur
 */
const uploadDocument = async (req, res) => {
  try {
    console.log('📁 Upload de document démarré');

    const utilisateurId = req.userId;
    const { typeDocument } = req.body; // correspond au champ "type" du nouveau schéma

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    // Valider selon les nouveaux types
    if (!typeDocument || !DOCUMENT_TYPES.includes(typeDocument)) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ success: false, message: 'Type de document invalide', typesValides: DOCUMENT_TYPES });
    }

    // Empêcher tout upload si une demande est en attente ou en cours de traitement
    const demandeActive = await DemandeCEC.findOne({
      utilisateur: utilisateurId,
      statut: { $in: ['en_attente', 'en_cours_traitement'] }
    }).select('numeroDemande statut dateCreation');

    if (demandeActive) {
      try { await fs.unlink(req.file.path); } catch (e) { /* noop */ }
      return res.status(400).json({
        success: false,
        message: 'Actions verrouillées: une demande est déjà en cours. Impossible de modifier ou ajouter des documents pour le moment.',
        demande: {
          numero: demandeActive.numeroDemande,
          statut: demandeActive.statut,
          dateCreation: demandeActive.dateCreation
        }
      });
    }

    const utilisateur = await UserHandicap.findById(utilisateurId).select('documents');
    if (!utilisateur) {
      await fs.unlink(req.file.path);
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Vérifier si un document de ce type existe déjà
    const existing = (utilisateur.documents || []).find(d => d.type === typeDocument);
    if (existing && typeof existing.bumpVersion === 'function') {
      existing.bumpVersion(req.file.path, {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } else if (existing) {
      // Fallback si méthode non attachée (sécurité)
      existing.history = existing.history || [];
      existing.history.push({
        version: existing.version || 1,
        url: existing.url,
        dateUpload: existing.dateUpload,
        filename: existing.filename,
        mimetype: existing.mimetype,
        size: existing.size
      });
      existing.version = (existing.version || 1) + 1;
      existing.url = req.file.path;
      existing.dateUpload = new Date();
      existing.filename = req.file.originalname;
      existing.mimetype = req.file.mimetype;
      existing.size = req.file.size;
      existing.valide = false;
      existing.validatedAt = undefined;
      existing.validatedBy = undefined;
    } else {
      // Ajouter un nouveau document
      utilisateur.documents.push({
        type: typeDocument,
        url: req.file.path,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        dateUpload: new Date(),
        valide: false,
        version: 1
      });
    }

    // Forcer Mongoose à considérer la modification des sous-docs
    utilisateur.markModified('documents');
    await utilisateur.save();

    const savedDoc = (utilisateur.documents || []).find(d => d.type === typeDocument);

    const documentPayload = savedDoc ? {
      id: savedDoc._id ? savedDoc._id.toString() : undefined,
      type: savedDoc.type,
      url: savedDoc.url,
      filename: savedDoc.filename,
      mimetype: savedDoc.mimetype,
      size: savedDoc.size,
      dateUpload: savedDoc.dateUpload
    } : null;

    if (documentPayload) {
      emitToUser(utilisateurId.toString(), 'document:uploaded', {
        action: 'uploaded',
        document: documentPayload
      });
      emitToRole('admin', 'document:uploaded', {
        action: 'uploaded',
        utilisateur: {
          id: utilisateurId.toString()
        },
        document: documentPayload
      });
    }

    res.status(201).json({ success: true, message: 'Document uploadé avec succès', data: { document: savedDoc } });

  } catch (error) {
    console.error('❌ Erreur upload document:', error);
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (unlinkError) { console.error(unlinkError); }
    }
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload du document' });
  }
};


/**
 * LISTER LES DOCUMENTS DE L'UTILISATEUR
 * ======================================
 * Retourne tous les documents uploadés par l'utilisateur
 */
const listerMesDocuments = async (req, res) => {
  try {
    console.log('📋 Récupération des documents utilisateur');
    
    const utilisateurId = req.userId;

    // 1. RÉCUPÉRER L'UTILISATEUR ET SES DOCUMENTS
    // ============================================
    const utilisateur = await UserHandicap.findById(utilisateurId)
      .select('documents nom prenom email');

    if (!utilisateur) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // 2. ENRICHIR LES INFOS DES DOCUMENTS
    // ====================================
    const documentsEnrichis = (utilisateur.documents || []).map(doc => ({
      id: doc._id,
      nom: doc.filename || path.basename(doc.url || ''),
      type: doc.type,
      typeDocument: doc.type, // compat frontend
      taille: doc.size,
      tailleHumaine: doc.size ? formatTaille(doc.size) : undefined,
      dateUpload: doc.dateUpload,
      extension: doc.filename ? path.extname(doc.filename).toLowerCase() : (doc.url ? path.extname(doc.url).toLowerCase() : undefined),
      statut: doc.valide ? 'valide' : 'en_attente'
    }));

    // 3. STATISTIQUES
    // ===============
    const stats = {
      total: documentsEnrichis.length,
      parType: {}
    };

    documentsEnrichis.forEach(doc => {
      const key = doc.typeDocument || 'autre';
      if (!stats.parType[key]) {
        stats.parType[key] = 0;
      }
      stats.parType[key]++;
    });

    console.log(`✅ ${documentsEnrichis.length} documents récupérés pour ${utilisateur.email}`);

    res.status(200).json({
      success: true,
      data: {
        documents: documentsEnrichis,
        stats,
        utilisateur: {
          nom: utilisateur.nom,
          prenom: utilisateur.prenom,
          email: utilisateur.email
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur liste documents:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents'
    });
  }
};

/**
 * TÉLÉCHARGER UN DOCUMENT
 * ========================
 * Permet de télécharger un document spécifique
 */
const telechargerDocument = async (req, res) => {
  try {
    console.log('⬇️ Téléchargement de document');
    
    const { documentId } = req.params;
    const utilisateurId = req.userId;
    const utilisateurRole = req.userRole;

    // 1. TROUVER LE DOCUMENT
    // ======================
    let utilisateur;
    let document;

    if (utilisateurRole === 'admin') {
      // Admin peut télécharger tout document
      // Chercher dans tous les utilisateurs
      const utilisateurs = await UserHandicap.find({
        'documents._id': documentId
      });
      
      if (utilisateurs.length > 0) {
        utilisateur = utilisateurs[0];
        document = utilisateur.documents.id(documentId);
      }
    } else {
      // Handicap peut télécharger seulement ses documents
      utilisateur = await UserHandicap.findById(utilisateurId);
      if (utilisateur) {
        document = utilisateur.documents.id(documentId);
      }
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé ou accès non autorisé'
      });
    }

    // 2. VÉRIFIER QUE LE FICHIER EXISTE
    // ==================================
    try {
      await fs.access(document.url);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    // 3. ENVOYER LE FICHIER
    // =====================
    const nomFichier = document.filename || path.basename(document.url);
    const cheminFichier = path.resolve(document.url);

    console.log(`✅ Téléchargement: ${nomFichier} par ${req.user.email}`);

    res.download(cheminFichier, nomFichier, (err) => {
      if (err) {
        console.error('❌ Erreur téléchargement:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement'
          });
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur téléchargement document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du document'
    });
  }
};

/**
 * FONCTION UTILITAIRE : FORMATER LA TAILLE
 * =========================================
 */
function formatTaille(octets) {
  const unites = ['o', 'Ko', 'Mo', 'Go'];
  let taille = octets;
  let uniteIndex = 0;
  
  while (taille >= 1024 && uniteIndex < unites.length - 1) {
    taille /= 1024;
    uniteIndex++;
  }
  
  return `${Math.round(taille * 100) / 100} ${unites[uniteIndex]}`;
}

module.exports = {
  uploadDocument,
  listerMesDocuments,
  telechargerDocument
};