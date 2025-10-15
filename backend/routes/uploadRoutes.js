/**
 * ROUTES D'UPLOAD DE DOCUMENTS
 * 
 * Ce fichier définit toutes les routes liées à l'upload :
 * - Upload de documents
 * - Liste des documents
 * - Téléchargement de documents
 * - Suppression de documents
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Import des contrôleurs
const {
  uploadDocument,
  listerMesDocuments,
  telechargerDocument
} = require('../controllers/uploadController');

// Import des middlewares
const { 
  authMiddleware, 
  requireHandicap,
  optionalAuth 
} = require('../middlewares/authMiddleware');

// =============================
// CONFIGURATION MULTER
// =============================

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Dossier uploads créé');
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer un sous-dossier par utilisateur
    const userDir = path.join(uploadsDir, req.userId.toString());
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique avec timestamp
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const nomSansExtension = path.basename(file.originalname, extension);
    const nomFichier = `${timestamp}-${nomSansExtension}${extension}`;
    
    cb(null, nomFichier);
  }
});

// Filtres pour les types de fichiers acceptés
const fileFilter = (req, file, cb) => {
  // Types MIME acceptés
  const typesAcceptes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];

  if (typesAcceptes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé: ${file.mimetype}. Types acceptés: PDF, DOC, DOCX, JPG, PNG, GIF`), false);
  }
};

// Configuration finale de multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB maximum
  },
  fileFilter: fileFilter
});

// =============================
// TOUTES LES ROUTES NÉCESSITENT UNE AUTHENTIFICATION
// =============================
router.use(authMiddleware);

// =============================
// ROUTES D'UPLOAD
// =============================

/**
 * POST /api/upload/document
 * Upload un document (handicap uniquement)
 * 
 * Form-data requis:
 *   - file: File (PDF, DOC, DOCX, JPG, PNG, GIF, max 5MB)
 *   - typeDocument: string ('piece_identite' | 'justificatif_handicap' | 'justificatif_domicile' | 'autre')
 */
router.post('/document', requireHandicap, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Fichier trop volumineux (maximum 5MB)'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Erreur upload: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    next();
  });
}, uploadDocument);

// =============================
// ROUTES CONSULTATION DES DOCUMENTS
// =============================

/**
 * GET /api/upload/documents
 * Lister mes documents (handicap uniquement)
 * Retourne tous les documents uploadés par l'utilisateur connecté
 */
router.get('/documents', requireHandicap, listerMesDocuments);

/**
 * GET /api/upload/document/:documentId
 * Télécharger un document spécifique
 * - Admin : peut télécharger tous les documents
 * - Handicap : peut télécharger seulement ses documents
 */
router.get('/document/:documentId', telechargerDocument);

// =============================
// ROUTES ADMINISTRATIVES
// =============================

/**
 * GET /api/upload/admin/all-documents
 * Lister tous les documents de tous les utilisateurs (admin uniquement)
 */
router.get('/admin/all-documents', authMiddleware, async (req, res) => {
  try {
    // Vérifier que c'est un admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    const UserHandicap = require('../models/UserHandicap');
    
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Récupérer les utilisateurs avec leurs documents
    const utilisateurs = await UserHandicap.find({ 'documentsUploades.0': { $exists: true } })
      .select('nom prenom email documentsUploades')
      .skip(skip)
      .limit(limitNum)
      .sort({ updatedAt: -1 });

    // Formater les données
    const documentsParUtilisateur = utilisateurs.map(user => ({
      utilisateur: {
        id: user._id,
        nomComplet: `${user.prenom} ${user.nom}`,
        email: user.email
      },
      documents: user.documentsUploades.map(doc => ({
        id: doc._id,
        nom: doc.nom,
        typeDocument: doc.typeDocument,
        taille: doc.taille,
        dateUpload: doc.dateUpload
      }))
    }));

    // Statistiques globales
    const totalUtilisateurs = await UserHandicap.countDocuments({ 'documentsUploades.0': { $exists: true } });
    const totalDocuments = await UserHandicap.aggregate([
      { $project: { nombreDocuments: { $size: '$documentsUploades' } } },
      { $group: { _id: null, total: { $sum: '$nombreDocuments' } } }
    ]);

    res.json({
      success: true,
      data: {
        documentsParUtilisateur,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalUtilisateurs,
          pages: Math.ceil(totalUtilisateurs / limitNum)
        },
        stats: {
          totalUtilisateurs,
          totalDocuments: totalDocuments[0]?.total || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur liste documents admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents'
    });
  }
});

// =============================
// ROUTES DE TEST ET INFO
// =============================

/**
 * GET /api/upload/test
 * Route de test pour vérifier que les routes d'upload fonctionnent
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes d\'upload fonctionnelles!',
    utilisateur: {
      id: req.userId,
      role: req.userRole,
      email: req.user.email
    },
    configuration: {
      tailleMaximale: '5MB',
      typesAcceptes: ['PDF', 'DOC', 'DOCX', 'JPG', 'PNG', 'GIF'],
      dossierUpload: 'uploads/'
    },
    routes: {
      'POST /document': 'Upload document (handicap)',
      'GET /documents': 'Mes documents (handicap)',
      'GET /document/:id': 'Télécharger document',
      'DELETE /document/:id': 'Supprimer document (handicap)',
      'GET /admin/all-documents': 'Tous les documents (admin)'
    }
  });
});

module.exports = router;