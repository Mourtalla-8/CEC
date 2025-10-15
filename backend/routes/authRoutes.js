/**
 * ROUTES D'AUTHENTIFICATION
 * 
 * Ce fichier définit toutes les routes liées à l'authentification :
 * - Inscription des utilisateurs handicap
 * - Connexion unifiée
 * - Déonnexion
 * - Réinitialisation de mot de passe
 * - Récupération du profil
 */

const express = require('express');
const router = express.Router();

// Import des contrôleurs
const {
  signupInit,
  verifyCode,
  resendCode,
  setPassword,
  login,
  requestPasswordReset,
  verifyResetCode,
  resendResetCode,
  resetPassword,
  logout,
  getProfile,
} = require('../controllers/authController');

// Import des middlewares
const { authMiddleware } = require('../middlewares/authMiddleware');

// ===========================================
// ROUTES D'INSCRIPTION (UTILISATEURS HANDICAP)
// ===========================================

/**
 * POST /api/auth/signup-init
 * Étape 1 : Inscription initiale avec envoi du code de vérification
 * 
 * Body requis: {
 *   nom, prenom, sexe, dateNaissance,
 *   typeHandicap, adresse, telephone, email
 * }
 */
router.post('/signup-init', signupInit);

/**
 * POST /api/auth/verify-code
 * Étape 2 : Vérification du code reçu par SMS/email
 * 
 * Body requis: {
 *   email: string,
 *   code: string
 * }
 */
router.post('/verify-code', verifyCode);

/**
 * POST /api/auth/set-password
 * Étape 3 : Définition du mot de passe et finalisation du compte
 * 
 * Body requis: {
 *   email: string,
 *   motDePasse: string,
 *   confirmerMotDePasse: string
 * }
 */
router.post('/set-password', setPassword);

// Renvoyer un code d'inscription
router.post('/resend-code', resendCode);

// =============================
// ROUTES DE CONNEXION
// =============================

/**
 * POST /api/auth/login
 * Connexion unifiée pour admin et utilisateurs handicap
 * Le backend détermine automatiquement le rôle
 * 
 * Body requis: {
 *   email: string,
 *   motDePasse: string
 * }
 * 
 * Retourne: {
 *   token: string,
 *   user: { id, email, role, ... }
 * }
 */
router.post('/login', login);

// ===============================
// ROUTES DE RÉINITIALISATION MDP
// ===============================

/**
 * POST /api/auth/request-password-reset
 * Étape 1 : Demande de réinitialisation avec envoi de code
 * 
 * Body requis: {
 *   identifier: string (email ou téléphone)
 * }
 */
router.post('/request-password-reset', requestPasswordReset);

/**
 * POST /api/auth/verify-reset-code
 * Étape 2 : Vérification du code de réinitialisation
 * 
 * Body requis: {
 *   identifier: string,
 *   code: string
 * }
 */
router.post('/verify-reset-code', verifyResetCode);

/**
 * POST /api/auth/reset-password
 * Étape 3 : Définition du nouveau mot de passe
 * 
 * Body requis: {
 *   identifier: string,
 *   motDePasse: string,
 *   confirmerMotDePasse: string
 * }
 */
router.post('/reset-password', resetPassword);

/**
 * POST /api/auth/resend-reset-code
 * Renvoyer le code de réinitialisation
 *
 * Body requis: {
 *   identifier: string
 * }
 */
router.post('/resend-reset-code', resendResetCode);

// =============================
// ROUTES DE DÉCONNEXION
// =============================
/**
 * POST /api/auth/logout
 * Déconnexion unifiée pour admin et utilisateurs handicap
 * Le backend détermine automatiquement l'utilisateur
 */
router.post('/logout', authMiddleware, logout);

// =============================
// ROUTES AUTHENTIFIÉES
// =============================

/**
 * GET /api/auth/profile
 * Récupérer les informations du profil utilisateur connecté
 * Nécessite un token JWT valide
 * 
 * Headers requis: Authorization: Bearer <token>
 */
router.get('/profile', authMiddleware, getProfile);


// =============================
// ROUTES DE TEST
// =============================

/**
 * GET /api/auth/test
 * Route de test pour vérifier que les routes d'auth fonctionnent
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes d\'authentification fonctionnelles!',
    timestamp: new Date().toISOString(),
    routes: {
      'POST /signup-init': 'Inscription initiale',
      'POST /verify-code': 'Vérification du code',
      'POST /set-password': 'Définition du mot de passe',
      'POST /resend-code': 'Renvoi du code d\'inscription',
      'POST /login': 'Connexion unifiée',
      'POST /request-reset': 'Demande de réinitialisation',
      'POST /verify-reset-code': 'Vérification du code reset',
      'POST /reset-password': 'Définition du nouveau mot de passe',
      'POST /resend-reset-code': 'Renvoi du code reset',
      'GET /profile': 'Profil utilisateur'
    }
  });
});

module.exports = router;