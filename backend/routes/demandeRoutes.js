/**
 * ROUTES DES DEMANDES CEC
 * 
 * Ce fichier définit toutes les routes liées aux demandes :
 * - Création, consultation, modification, suppression
 * - Permissions selon le rôle (admin/handicap)
 */

const express = require('express');
const router = express.Router();

// Import des contrôleurs
const {
  creerDemande,
  listerToutesLesDemandes,
  listerMesDemandes,
  obtenirDemande,
  modifierDemande,
  supprimerDemande,
  checkEligibility,
  exporterDemandeZip
} = require('../controllers/demandeController');

// Import des middlewares
const { 
  authMiddleware, 
  requireAdmin, 
  requireHandicap 
} = require('../middlewares/authMiddleware');

// =============================
// TOUTES LES ROUTES NÉCESSITENT UNE AUTHENTIFICATION
// =============================
router.use(authMiddleware);

// =============================
// ROUTES CRÉATION DE DEMANDE
// =============================

/**
 * POST /api/demandes
 * Créer une nouvelle demande CEC (handicap uniquement)
 * 
 * Body requis: {
 *   type: 'premiere' | 'renouvellement',
 *   ancienneCarte?: { numero: string, dateExpiration: date } // si renouvellement
 * }
 */
router.post('/', requireHandicap, creerDemande);

/**
 * GET /api/demandes/eligibility
 * Vérifier l'éligibilité de l'utilisateur courant (handicap)
 */
router.get('/eligibility', requireHandicap, checkEligibility);
/**
 * GET /api/demandes/carte
 * Récupérer la carte CEC de l'utilisateur (handicap)
 */
router.get('/carte', requireHandicap, require('../controllers/demandeController').getMyCarte);

// =============================
// ROUTES CONSULTATION DES DEMANDES
// =============================

/**
 * GET /api/demandes
 * Lister toutes les demandes (admin uniquement)
 * 
 * Query params optionnels:
 *   - statut: string ('tous' | 'en_attente' | 'en_cours_traitement' | 'validee' | 'rejetee')
 *   - type: string ('tous' | 'premiere' | 'renouvellement')
 *   - page: number (default: 1)
 *   - limit: number (default: 10)
 *   - search: string (recherche dans numéros et noms)
 */
router.get('/', requireAdmin, listerToutesLesDemandes);

/**
 * GET /api/demandes/me
 * Lister mes demandes (handicap uniquement)
 * Retourne seulement les demandes de l'utilisateur connecté
 */
router.get('/me', requireHandicap, listerMesDemandes);

/**
 * GET /api/demandes/:id
 * Obtenir une demande spécifique
 * - Admin : peut voir toutes les demandes
 * - Handicap : peut voir seulement ses demandes
 */
router.get('/:id', obtenirDemande);

/**
 * GET /api/demandes/:id/export-zip
 * Exporter la demande en ZIP (admin assigné, en cours de traitement)
 */
router.get('/:id/export-zip', requireAdmin, exporterDemandeZip);

// =============================
// ROUTES MODIFICATION DES DEMANDES
// =============================

/**
 * PUT /api/demandes/:id
 * Modifier une demande
 * 
 * ADMIN peut modifier:
 *   - statut: string
 *   - commentairesAdmin: string
 *   - motifRejet: string (si statut = 'rejetee')
 * 
 * HANDICAP peut modifier (si statut = 'en_attente'):
 *   - type: string
 *   - ancienneCarte: object
 */
router.put('/:id', modifierDemande);

// =============================
// ROUTES SUPPRESSION DES DEMANDES
// =============================

/**
 * DELETE /api/demandes/:id
 * Supprimer une demande
 * 
 * Règles:
 *   - Admin : peut supprimer n'importe quelle demande (sauf validées)
 *   - Handicap : peut supprimer seulement ses demandes non traitées
 *   - Impossible de supprimer une demande en cours de traitement ou validée
 */
router.delete('/:id', supprimerDemande);

// =============================
// ROUTES STATISTIQUES (ADMIN)
// =============================

/**
 * GET /api/demandes/stats/dashboard
 * Obtenir les statistiques pour le dashboard admin
 */
router.get('/stats/dashboard', requireAdmin, async (req, res) => {
  try {
    const DemandeCEC = require('../models/DemandeCEC');
    const UserHandicap = require('../models/UserHandicap');

    // Statistiques des demandes
    const statsdemandes = await DemandeCEC.obtenirStatistiques();
    
    // Statistiques des utilisateurs
    const totalUtilisateurs = await UserHandicap.countDocuments({ statutCompte: 'actif' });
    const nouveauxUtilisateurs = await UserHandicap.countDocuments({
      statutCompte: 'actif',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 derniers jours
    });

    // Demandes récentes (dernières 24h)
    const demandesRecentes = await DemandeCEC.countDocuments({
      dateCreation: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        demandes: statsdemandes,
        utilisateurs: {
          total: totalUtilisateurs,
          nouveaux: nouveauxUtilisateurs
        },
        activiteRecente: {
          demandesRecentes
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// =============================
// ROUTES DE TEST
// =============================

/**
 * GET /api/demandes/test/permissions
 * Route de test pour vérifier les permissions
 */
router.get('/test/permissions', (req, res) => {
  res.json({
    success: true,
    message: 'Routes des demandes fonctionnelles!',
    utilisateur: {
      id: req.userId,
      role: req.userRole,
      email: req.user.email
    },
    routes: {
      'POST /': 'Créer demande (handicap)',
      'GET /': 'Lister toutes (admin)',
      'GET /me': 'Mes demandes (handicap)',
      'GET /:id': 'Obtenir demande (propriétaire ou admin)',
      'PUT /:id': 'Modifier demande (propriétaire ou admin)',
      'DELETE /:id': 'Supprimer demande (propriétaire ou admin)',
      'GET /stats/dashboard': 'Statistiques (admin)'
    }
  });
});

module.exports = router;