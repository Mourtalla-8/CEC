/**
 * MIDDLEWARE D'AUTHENTIFICATION
 * 
 * Ce middleware vérifie et décode les tokens JWT
 * Il peut vérifier différents types d'utilisateurs (admin, handicap)
 */

const jwt = require('jsonwebtoken');
const UserAdmin = require('../models/UserAdmin');
const UserHandicap = require('../models/UserHandicap');

/**
 * Middleware principal d'authentification
 * Vérifie le token JWT et charge les informations utilisateur
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. RÉCUPÉRATION DU TOKEN
    // ========================
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Accès refusé. Token manquant.'
      });
    }

    // Vérifier le format "Bearer TOKEN"
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Format de token invalide. Utilisez: Bearer <token>'
      });
    }

    const token = authHeader.substring(7); // Retirer "Bearer "

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    // 2. VÉRIFICATION ET DÉCODAGE DU TOKEN
    // ====================================
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // 3. RÉCUPÉRATION DES INFORMATIONS UTILISATEUR
    // =============================================
    let user;
    
    if (decoded.role === 'admin') {
      user = await UserAdmin.findById(decoded.userId);
      if (!user || !user.estActif()) {
        return res.status(401).json({
          success: false,
          message: 'Compte administrateur non trouvé ou suspendu'
        });
      }
    } else if (decoded.role === 'handicap') {
      user = await UserHandicap.findById(decoded.userId);
      if (!user || !user.estActif()) {
        return res.status(401).json({
          success: false,
          message: 'Compte utilisateur non trouvé ou suspendu'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non reconnu'
      });
    }

    // 4. AJOUT DES INFOS À LA REQUÊTE
    // ===============================
    req.user = user;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.token = token;

    console.log(`✅ Utilisateur authentifié: ${decoded.role} - ${user.email}`);
    
    next(); // Passer au middleware/route suivant

  } catch (error) {
    console.error('❌ Erreur dans authMiddleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne d\'authentification'
    });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur est un admin
 * À utiliser APRÈS authMiddleware
 */
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Droits administrateur requis.'
    });
  }
  next();
};

/**
 * Middleware pour vérifier que l'utilisateur est un handicap
 * À utiliser APRÈS authMiddleware
 */
const requireHandicap = (req, res, next) => {
  if (req.userRole !== 'handicap') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Compte utilisateur handicap requis.'
    });
  }
  next();
};

/**
 * Middleware d'authentification optionnelle
 * Si un token Bearer est présent, il est vérifié et les infos utilisateur sont ajoutées à la requête.
 * Sinon, on continue sans authentifier (pas d'erreur retournée).
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      let user;
      if (decoded.role === 'admin') {
        user = await UserAdmin.findById(decoded.userId);
      } else if (decoded.role === 'handicap') {
        user = await UserHandicap.findById(decoded.userId);
      }

      if (user) {
        req.user = user;
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.token = token;
      }
    } catch (err) {
      // Token invalide: continuer sans authentification
    }

    return next();
  } catch (error) {
    return next();
  }
};

module.exports = {
  authMiddleware,
  requireAdmin,
  requireHandicap,
  optionalAuth
};