/**
 * CONTRÔLEUR D'AUTHENTIFICATION
 *
 * Ce contrôleur gère toute la logique d'authentification :
 * -    Inscription des utilisateurs handicap
 * -    Connexion
 * -    Déonnexion
 * -    Réinitialisation de mot de passe
 * -    Récupération de profil
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserHandicap from '../models/UserHandicap.js';
import UserAdmin from '../models/UserAdmin.js';
import { redisClient } from '../redisClient.js';

// Client Redis (auto: local ou mémoire)
// Géré par ../redisClient.js avec logs explicites

// -------------------- CONSTANTES --------------------
const MAX_ATTEMPTS = 3;
const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes
const CODE_EXPIRATION = 5 * 60 * 1000; // 5 minutes
const TTL = 60 * 60 * 1000 // 1h
const MAX_RESENDS = 3;
const RESEND_INTERVAL = 60 * 1000; // 1 min

// -------------------- UTILITAIRES --------------------
const resolveEmailFromIdentifier = async (identifier) => {
  if (!identifier) return null;
  const id = String(identifier).toLowerCase();
  if (id.includes('@')) return id;
  let user = await UserHandicap.findOne({ telephone: id });
  if (!user) user = await UserHandicap.findOne({ email: id });
  if (!user) user = await UserAdmin.findOne({ email: id });
  return user?.email ? String(user.email).toLowerCase() : null;
};
/**
 * Générer un code de vérification
 * @returns {string}
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Vérifier si un utilisateur est bloqué temporairement
 * @param email
 * @param type
 * @returns {Promise<{blocked: boolean, remainingTime: number, reason}|{blocked: boolean}>}
 */
const isUserBlocked = async (email, type) => {
  const key = `${type}_${email}`;
  const blockInfo = await redisClient.get(key);

  if (!blockInfo) return { blocked: false };

  const parsed = JSON.parse(blockInfo);

  const now = Date.now();
  if (now > parsed.unblockTime) {
    // Supprimer le blocage
    await redisClient.del(key);

    // Réinitialiser les tentatives
    if (type === 'signupVerificationBlocked') {
      const verificationData = await getVerificationData(email);
      if (verificationData) {
        verificationData.attempts = 0;
        await setVerificationData(email, verificationData);
      }
    }
    if (type === 'resetVerificationBlocked') {
      const resetData = await getResetData(email);
      if (resetData) {
        resetData.attempts = 0;
        await setResetData(email, resetData);
      }
    }
    return { blocked: false };
  }
  
  return {
    blocked: true,
    unblockTime: parsed.unblockTime,
    remainingTime: Math.ceil((parsed.unblockTime - now) / 1000),
    reason: parsed.reason
  };
};

/**
 * Bloquer temporairement un utilisateur
 * @param email
 * @param type
 * @param reason
 * @returns {Promise<void>}
 */
const blockUser = async (email, type, reason) => {
  const key = `${type}_${email}`;
  const data = {
    unblockTime: Date.now() + BLOCK_DURATION,
    reason
  };
  await redisClient.set(key, JSON.stringify(data), 'PX', BLOCK_DURATION);
};

// Gestion codes Redis
/**
 * .....getVerificationData
 * @param email
 * @returns {Promise<any|null>}
 */
const getVerificationData = async (email) => {
  const data = await redisClient.get(`signupVerification_${email}`);
  return data ? JSON.parse(data) : null;
};
/**
 * ......setVerificationData
 * @param email
 * @param data
 * @returns {Promise<void>}
 */
const setVerificationData = async (email, data) => {
  await redisClient.set(`signupVerification_${email}`, JSON.stringify(data), 'PX', TTL);
};

/**
 * ..........getResetData
 * @param email
 * @returns {Promise<any|null>}
 */
const getResetData = async (email) => {
  const data = await redisClient.get(`resetVerification_${email}`);
  return data ? JSON.parse(data) : null;
};
/**
 * ..........setResetData
 * @param email
 * @param data
 * @returns {Promise<void>}
 */
const setResetData = async (email, data) => {
  await redisClient.set(`resetVerification_${email}`, JSON.stringify(data), 'PX', TTL);
};

/**
 * Nettoyer toutes les données Redis d'un utilisateur
 * @param {string} email - email de l'utilisateur
 */
export async function clearUserRedisData(email) {
  try {
    // Construire les patterns possibles
    const patterns = [
      `signupVerification_${email}`,
      `resetVerification_${email}`,
      `signupVerificationBlocked_${email}`,
      `resetVerificationBlocked_${email}`,
      `blockedUsers_${email}`,
    ];

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

  } catch (error) {
    console.error(`❌ Erreur nettoyage Redis pour ${email}:`, error);
  }
}

/**
 * -------------------- VALIDATION --------------------
 * @param data
 * @returns {{success: boolean}|{success: boolean, message: string}}
 */
const validateUserData = (data) => {
  const { nom, prenom, sexe, dateNaissance, typeHandicap, adresse, telephone, email } = data;

  // 1. Vérifier les champs requis
  const requiredFields = { nom, prenom, sexe, dateNaissance, typeHandicap, adresse, telephone, email };
  for (const [key, value] of Object.entries(requiredFields)) {
    if (!value || String(value).trim() === "") {
      return { success: false, message: `Le champ '${key}' est requis` };
    }
  }

  // 2. Vérifier email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: "Email invalide" };
  }

  // 3. Vérifier téléphone (Sénégal : 9 chiffres, commence par 7)
  const phoneRegex = /^7[0-9]{8}$/;
  if (!phoneRegex.test(telephone)) {
    return { success: false, message: "Numéro de téléphone invalide (format attendu : 7XXXXXXXX)" };
  }

  // 4. Vérifier date (valide et pas dans le futur)
  const date = new Date(dateNaissance);
  const today = new Date();
  if (isNaN(date.getTime())) {
    return { success: false, message: "Date de naissance invalide" };
  }
  if (date > today) {
    return { success: false, message: "La date de naissance ne peut pas être dans le futur" };
  }

  // 5. Vérifier sexe
  const sexesAutorises = ["M", "F"];
  if (!sexesAutorises.includes(sexe)) {
    return { success: false, message: "Sexe invalide (M ou F attendu)" };
  }

  // 6. Vérifier type de handicap
  const handicapsAutorises = ["Moteur", "Visuel", "Auditif", "Mental", "Psychique", "Polyhandicap", "Cognitif", "Difficultés de communication", "Autre"];
  if (!handicapsAutorises.includes(typeHandicap)) {
    return { success: false, message: "Type de handicap invalide" };
  }

  // Si tout est bon
  return { success: true };
}


/**
 * -------------------- INSCRIPTION FLOW --------------------
 * INSCRIPTION INITIALE       -> envoi du code (et stockage dans Redis)
 * vérification du code       -> vérifier le code envoyé
 * définir un mot de passe    -> l'utilisateur définit son mot de passe
 * resendResetCode            -> renvoyer code
 */

/**
 * ÉTAPE 1 : INSCRIPTION INITIALE
 * ===============================
 * L'utilisateur handicap remplit le formulaire initial
 * - body: { nom, prenom, sexe, typeHandicap, dateNaissance, adresse, telephone, email }
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
export const signupInit = async (req, res) => {
  try {
    const { nom, prenom, sexe, typeHandicap, dateNaissance, adresse, telephone, email } = req.body;

    // VALIDATION DES DONNÉES REQUISES
    // ===================================
    const validation = validateUserData(req.body);
    if (!validation.success) return res.status(400).json(validation);

    // VÉRIFIER SI L'EMAIL EXISTE DÉJÀ
    // ===================================
    const existingUser = await UserHandicap.findOne({ $or: [{ email }, { telephone }] });
    if (existingUser) return res.status(400).json({ success: false, message: 'Compte existant' });

    // VÉRIFIER SI L'UTILISATEUR À ÉTÉ BLOQUER
    // ========================================
    const blockStatus = await isUserBlocked(email, 'signupVerificationBlocked');
    if (blockStatus.blocked) {
      return res.status(429).json({
        success: false,
        blockedUntil: true,
        message: blockStatus.reason,
        unblockTime: blockStatus.unblockTime,
      });
    }

    console.log('📝 Inscription initiale démarrée');

    let verificationData = await getVerificationData(email);

    // Calcul du moment exact d'expiration
    const now = Date.now();
    const expiresAt = now + CODE_EXPIRATION;

    let cooldown;

    // Si pas de data, créer nouvelle session
    if (!verificationData) {
      verificationData = {
        code: generateVerificationCode(),
        userData: { nom, prenom, sexe, typeHandicap, dateNaissance, adresse, telephone, email },
        attempts: 1,
        lastResend: now,
        expiresAt: expiresAt,
        verified: false
      };
    } else {
      // Mise à jour des données utilisateur si déjà existantes
      verificationData.userData = { nom, prenom, sexe, typeHandicap, dateNaissance, adresse, telephone, email };
      verificationData.code = generateVerificationCode();
      verificationData.expiresAt = expiresAt;
      verificationData.attempts++;

      if (verificationData.attempts >= MAX_ATTEMPTS) {
        await blockUser(email, 'signupVerificationBlocked', 'Trop de tentatives.');
        cooldown = BLOCK_DURATION / 1000;
      }
    }

    await setVerificationData(email, verificationData);

    // SIMULER L'ENVOI DU CODE
    // ============================================
    console.log(`📱 CODE DE VÉRIFICATION GÉNÉRÉ pour ${email}: ${verificationData.code}`);
    console.log(`⏳ EXPIRE DANS ${CODE_EXPIRATION / 1000}s (${new Date(expiresAt).toLocaleTimeString()})`);

    return res.status(200).json({
      success: true,
      message: 'Inscription initialisée. Code de vérification envoyé.',
      data: {
        ...(process.env.NODE_ENV === 'development' && {
          attempts: verificationData.attempts,
          attemptsRemaining: MAX_ATTEMPTS - verificationData.attempts,
          codeVerification: verificationData.code, // visible seulement en DEV
          codeExpiresAt: verificationData.expiresAt,
        }),
        cooldown: cooldown ?? RESEND_INTERVAL / 1000,
        ...(verificationData.attempts >= MAX_ATTEMPTS && {
          blockedUntil: true
        })
      }
    });
  } catch (error) {
    console.error('❌ [SIGN-UP] Erreur lors de l\'inscription initiale:', error);

    // Gestion des erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const erreurs = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        erreurs
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'inscription'
    });
  }
};

/**
 * ÉTAPE 2 : VÉRIFICATION DU CODE
 * ===============================
 * Vérifier le code envoyé
 * - body: { email, code}
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
export const verifyCode = async (req, res) => {
  try {
    console.log('🔍 Vérification de code démarrée');

    const { email, code } = req.body

    if (!email || !code) return res.status(400).json({ success: false, message: 'Email et code requis' });

    // VÉRIFIER SI L'UTILISATEUR A UNE INSCRIPTION EN COURS
    // =====================================================
    const verificationData = await getVerificationData(email);
    if (!verificationData) return res.status(400).json({ success: false, message: 'Session expirée ou inexistante. Veuillez recommencer l\'inscription.' });

    // VÉRIFIER LE CODE ET L'EXPIRATION
    // =================================
    if (verificationData.code !== code || Date.now() > verificationData.expiresAt) {
      return res.status(400).json({ success: false, message: 'Code de vérification incorrect ou expiré' });
    }

    // MARQUER L'UTILISATEUR COMME VÉRIFIÉ
    // ====================================
    verificationData.verified = true;
    await setVerificationData(email, verificationData);

    console.log(`✅ Code vérifié avec succès pour ${email}`);

    // Code correct
    return res.status(200).json({
      success: true,
      message: 'Code vérifié avec succès. Vous pouvez maintenant définir votre mot de passe.'
    });
  } catch (error) {
    console.error('❌ [SIGN-UP] Erreur lors de la vérification du code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification'
    });
  }
};

/**
 * ÉTAPE 3 : DÉFINIR LE MOT DE PASSE
 * ==================================
 * L'utilisateur définit son mot de passe
 * - body: { email, motDePasse}
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
export const setPassword = async (req, res) => {
  try {
    console.log('🔐 Définition de mot de passe démarrée');

    const { email, motDePasse, confirmerMotDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({success: false, message: 'Email et mot de passe requis'});
    }

    // VÉRIFIER SI L'UTILISATEUR A UNE INSCRIPTION EN COURS
    // =====================================================
    const verificationData = await getVerificationData(email);
    if (!verificationData) {
      return res.status(400).json({ success: false, message: 'Session de vérification expirée. Veuillez recommencer l\'inscription.' });
    }

    // VÉRIFIER SI L'UTILISATEUR EST VERIFIÉ
    // ======================================
    if (!verificationData.verified) {
      return res.status(400).json({ success: false, message: 'Compte non vérifié. Veuillez recommencer l\'inscription.' });
    }

    if (motDePasse !== confirmerMotDePasse) {
      return res.status(400).json({
        success: false,
        message: 'Les mots de passe ne correspondent pas'
      });
    }

    if (motDePasse !== confirmerMotDePasse) {
      return res.status(400).json({
        success: false,
        message: 'Les mots de passe ne correspondent pas'
      });
    }

    if (motDePasse.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit faire au moins 8 caractères'
      });
    }

    // Hasher le mot de passe
    // ======================
    const hashedPassword = await bcrypt.hash(motDePasse, 12);

    // Créer l'utilisateur dans notre DB
    // =================================
    const newUser = new UserHandicap({
      ...verificationData.userData,
      motDePasse: hashedPassword,
      statut: '-',
      dateCreation: new Date()
    });

    await newUser.save();

    console.log(`✅ Compte créé avec succès pour ${email}`);

    await clearUserRedisData(email);

    res.status(200).json({
      success: true,
      message: 'Compte créé avec succès'
    });
  } catch (error) {
    console.error('❌ [SIGN-UP] Erreur lors de la création du compte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du compte'
    });
  }
};

/**
 * RENVOYER LE CODE D'INSCRIPTION
 * - body: { email }
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
export const resendCode = async (req, res) => {
  try {
    console.log('🔄️ Demande de renvoie de code démarrée');

    const rawIdentifier = req.body.email || req.body.identifier;
    const email = rawIdentifier ? String(rawIdentifier).toLowerCase() : '';
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    // Vérifier blocage
    const blockStatus = await isUserBlocked(email, 'signupVerificationBlocked');
    if (blockStatus.blocked) return res.status(429).json({
      success: false,
      blockedUntil: true,
      message: blockStatus.reason,
      unblockTime: blockStatus.unblockTime,
      remainingTime: blockStatus.remainingTime
    });

    const verificationData = await getVerificationData(email);
    if (!verificationData) return res.status(400).json({ success: false, message: 'Session expirée ou inexistante' });

    // Vérifier le cooldown
    // =====================
    const now = Date.now();
    if (now - verificationData.lastResend < RESEND_INTERVAL) {
      const remaining = Math.ceil((RESEND_INTERVAL - (now - verificationData.lastResend)) / 1000);
      return res.status(429).json({ success: false, message: `Veuillez attendre ${remaining}s avant de renvoyer`,  remainingTime: remaining});
    }

    // Calcul du moment exact d'expiration
    // ====================================
    const expiresAt = now + CODE_EXPIRATION;

    // Générer un nouveau code
    // ========================
    verificationData.code = generateVerificationCode();
    verificationData.lastResend = now;
    verificationData.expiresAt = expiresAt;
    verificationData.attempts++;

    let cooldown;

    // Vérifier si l'utilisateur a atteind le nombre max de tentative
    // ================================================================
    if (verificationData.attempts >= MAX_ATTEMPTS) {
      await blockUser(email, 'signupVerificationBlocked', 'Trop de tentatives.');
      cooldown = BLOCK_DURATION / 1000
    }

    await setVerificationData(email, verificationData);

    // SIMULER L'ENVOI DU CODE
    // ========================
    console.log(`♻️ NOUVEAU CODE DE VÉRIFICATION GÉNÉRÉ pour ${email}: ${verificationData.code}`);
    console.log(`⏳ EXPIRE DANS ${CODE_EXPIRATION / 1000}s (${new Date(expiresAt).toLocaleTimeString()})`);

    res.status(200).json({
      success: true,
      message: 'Nouveau code de verification envoyé',
      data: {
        ...(process.env.NODE_ENV === 'development' && {
          attempts: verificationData.attempts,
          attemptsRemaining: MAX_ATTEMPTS - verificationData.attempts,
          codeVerification: verificationData.code,
          codeExpiresAt: verificationData.expiresAt,
        }),
        cooldown: cooldown ?? RESEND_INTERVAL / 1000,
        ...(verificationData.attempts >= MAX_ATTEMPTS && {
          blockedUntil: true
        })
      }
    });
  } catch (error) {
    console.error('❌ [SIGN-UP] Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du renvoi du code'
    });
  }
};


/**
 * CONNEXION
 * =================
 * Gère la connexion pour admin et handicap
 * - body: {email, motDePasse}
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
export const login = async (req, res) => {
  try {
    console.log('🔑 Tentative de connexion');

    const { email, motDePasse } = req.body;

    // VALIDATION DES DONNÉES
    // =======================
    if (!email || !motDePasse) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const emailLower = email.toLowerCase();
    let utilisateur = null;
    let role = null; // 🔹 rôle explicite

    // CHERCHER D'ABORD DANS LES ADMINS
    // =================================
    const admin = await UserAdmin.trouverAdminActif(emailLower);

    if (admin) {
      const motDePasseValide = await bcrypt.compare(motDePasse, admin.motDePasse);

      if (motDePasseValide) {
        utilisateur = admin;
        role = 'admin';

        // Mettre à jour la dernière connexion
        admin.derniereConnexion = Date.now(); // timestamp actuel en ms

        // Mettre à jour son statut en ligne
        admin.statutCompte = 'en_ligne';

        await admin.save();  // Enregistre toutes les modifications

        console.log(`✅ Admin connecté: ${admin.email}`);
      }
    }

    // SI PAS ADMIN, CHERCHER DANS LES HANDICAPS
    // ==========================================
    if (!utilisateur) {
      const handicap = await UserHandicap.findOne({
        email: emailLower,
        statutCompte: { $ne: 'suspendu' }
      }).select('+motDePasse');

      if (handicap && handicap.motDePasse) {
        const motDePasseValide = await bcrypt.compare(motDePasse, handicap.motDePasse);

        if (motDePasseValide) {
          utilisateur = handicap;
          role = 'handicap';

          handicap.derniereConnexion = Date.now();
          handicap.statutCompte = 'en_ligne';
          await handicap.save();

          console.log(`✅ Utilisateur handicap connecté: ${handicap.email}`);
        }
      }
    }

    // VÉRIFICATION FINALE
    // ====================
    if (!utilisateur) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // GÉNÉRER LE TOKEN JWT
    // =====================
    const token = jwt.sign(
        {
          userId: utilisateur._id,
          email: utilisateur.email,
          role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // PRÉPARER LES DONNÉES DE RÉPONSE
    // ================================
    const userData = {
      id: utilisateur._id,
      email: utilisateur.email,
      role,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      derniereConnexion: utilisateur.derniereConnexion
    };

    await clearUserRedisData(email);

    res.status(200).json({
      success: true,
      message: `Connexion réussie en tant que ${role}`,
      data: {
        token,
        user: userData
      }
    });

  } catch (error) {
    console.error('❌ [LOGIN] Erreur login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
};



/**
 * -------------------- RESET PASSWORD FLOW --------------------
 * requestPasswordReset  -> envoi du code (et stockage dans Redis)
 * verifyResetCode       -> vérifier code
 * resetPassword         -> créer nouveau mot de passe
 * resendResetCode       -> renvoyer code (même règles que pour signup)
 */

/**
 * ÉTAPE 1 : Demande de réinitialisation de mot de passe
 * - body: { email }
 */
export const requestPasswordReset = async (req, res) => {
  try {
    console.log('🔁 Demande de réinitialisation de mot de passe démarrée.')

    const identifier = req.body.identifier || req.body.email;
    const email = await resolveEmailFromIdentifier(identifier);
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    // Vérifier blocage
    const blockStatus = await isUserBlocked(email, 'resetVerificationBlocked');
    if (blockStatus.blocked) return res.status(429).json({
      success: false,
      blockedUntil: true,
      message: blockStatus.reason,
      unblockTime: blockStatus.unblockTime
    });

    // Chercher utilisateur
    let user = await UserHandicap.findOne({ email, statutCompte: { $ne: 'suspendu' } });
    if (!user) user = await UserAdmin.findOne({ email, statut: { $ne: 'suspendu' } });
    if (!user) return res.status(404).json({ success: false, message: 'Compte non trouvé' });

    let resetData = await getResetData(email);
    const now = Date.now();
    const expiresAt = now + CODE_EXPIRATION;

    let cooldown;

    if (!resetData) {
      resetData = {
        code: generateVerificationCode(),
        userId: user._id,
        attempts: 1,
        lastResend: now,
        expiresAt,
        verified: false
      };
    } else {
      resetData.code = generateVerificationCode();
      resetData.lastResend = now;
      resetData.expiresAt = expiresAt;
      resetData.attempts++;

      if (resetData.attempts > MAX_ATTEMPTS) {
        await blockUser(email, 'resetVerificationBlocked', 'Trop de tentatives de réinitialisation');
        cooldown = BLOCK_DURATION / 1000;
      }
    }

    await setResetData(email, resetData);

    console.log(`📱 CODE DE RÉINITIALISATION pour ${email}: ${resetData.code}`);
    console.log(`⏳ EXPIRE DANS ${CODE_EXPIRATION / 1000}s (${new Date(expiresAt).toLocaleTimeString()})`);

    res.status(200).json({
      success: true,
      message: 'Code de réinitialisation envoyé',
      data: {
        ...(process.env.NODE_ENV === 'development' && {
          attempts: resetData.attempts,
          attemptsRemaining: MAX_ATTEMPTS - resetData.attempts,
          resetCode: resetData.code,
          codeExpiresAt: resetData.expiresAt,
        }),
        cooldown: cooldown ?? RESEND_INTERVAL / 1000,
        ...(resetData.attempts >= MAX_ATTEMPTS && {
          blockedUntil: true
        })
      }
    });
  } catch (error) {
    console.error('❌ [RESET PASSWORD] Erreur requestPasswordReset:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la demande de réinitialisation' });
  }
};

/**
 * ÉTAPE 2 : Vérification du code de réinitialisation
 * - body: { email, code }
 */
export const verifyResetCode = async (req, res) => {
  try {
    console.log('🔍 Vérification de code de réinitialisation démarrée');

    const identifier = req.body.identifier || req.body.email;
    const email = await resolveEmailFromIdentifier(identifier);
    const { code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: 'Email et code requis' });

    const resetData = await getResetData(email);
    if (!resetData) return res.status(400).json({ success: false, message: 'Session expirée ou inexistante.  Veuillez recommencer la réinitialisation.' });

    if (resetData.code !== code || Date.now() > resetData.expiresAt) {
      return res.status(400).json({ success: false, message: 'Code incorrect ou expiré.' });
    }

    resetData.verified = true;
    await setResetData(email, resetData);

    // Code correct
    return res.status(200).json({
      success: true,
      message: 'Code vérifié avec succès.'
    });
  } catch (error) {
    console.error('❌ [RESET PASSWORD] Erreur verifyResetCode:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la vérification' });
  }
};

/**
 * ÉTAPE 3 : Réinitialiser le mot de passe
 * - body: { email, motDePasse }
 */
export const resetPassword = async (req, res) => {
  try {
    console.log('🔐 Définition du nouveau mot de passe démarrée');

    const identifier = req.body.identifier || req.body.email;
    const email = await resolveEmailFromIdentifier(identifier);
    const { motDePasse } = req.body;
    if (!email || !motDePasse) return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });

    const resetData = await getResetData(email);
    if (!resetData) return res.status(400).json({ success: false, message: 'Session expirée ou inexistante. Veuillez recommencer la réinitialisation.' });

    if (!resetData.verified) {
      return res.status(400).json({ success: false, message: 'Compte non vérifié. Veuillez recommencer la réinitialisation.' });
    }

    let user = await UserHandicap.findById(resetData.userId);
    if (!user) user = await UserAdmin.findById(resetData.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(motDePasse, 12);
    user.motDePasse = hashedPassword;
    await user.save();

    // Nettoyer Redis
    await clearUserRedisData(email);

    res.status(200).json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('❌ [RESET PASSWORD] Erreur resetPassword:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la réinitialisation' });
  }
};

/**
 * ÉTAPE 4 : Renvoyer le code de réinitialisation
 * - body: { email }
 */
export const resendResetCode = async (req, res) => {
  try {
    console.log('🔄️ Demande de renvoie de code de réinitialisation démarrée');

    const identifier = req.body.identifier || req.body.email;
    const email = await resolveEmailFromIdentifier(identifier);
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    const blockStatus = await isUserBlocked(email, 'resetVerificationBlocked');
    if (blockStatus.blocked) return res.status(429).json({
      success: false,
      blockedUntil: true,
      message: blockStatus.reason,
      unblockTime: blockStatus.unblockTime,
      remainingTime: blockStatus.remainingTime
    });

    const resetData = await getResetData(email);
    if (!resetData) return res.status(400).json({ success: false, message: 'Session expirée ou inexistante' });

    const now = Date.now();
    if (now - resetData.lastResend < RESEND_INTERVAL) {
      const remaining = Math.ceil((RESEND_INTERVAL - (now - resetData.lastResend)) / 1000);
      return res.status(429).json({ success: false, message: `Veuillez attendre ${remaining}s avant de renvoyer le code`, remainingTime: remaining });
    }

    const expiresAt = now + CODE_EXPIRATION;

    resetData.code = generateVerificationCode();
    resetData.lastResend = now;
    resetData.expiresAt = expiresAt;
    resetData.attempts++;

    let cooldown;

    if (resetData.attempts > MAX_ATTEMPTS) {
      await blockUser(email, 'resetVerificationBlocked', 'Trop de tentatives.');
      cooldown = BLOCK_DURATION / 1000
    }

    await setResetData(email, resetData);

    console.log(`♻️ NOUVEAU CODE DE RÉINITIALISATION pour ${email}: ${resetData.code}`);
    console.log(`⏳ EXPIRE DANS ${CODE_EXPIRATION / 1000}s (${new Date(expiresAt).toLocaleTimeString()})`);

    res.status(200).json({
      success: true,
      message: 'Nouveau code de réinitialisation envoyé',
      data: {
        ...(process.env.NODE_ENV === 'development' && {
          attempts: resetData.attempts,
          attemptsRemaining: MAX_ATTEMPTS - resetData.attempts,
          resetCode: resetData.code,
          codeExpiresAt: resetData.expiresAt,
        }),
        cooldown: cooldown ?? RESEND_INTERVAL / 1000,
        ...(resetData.attempts >= MAX_ATTEMPTS && {
          blockedUntil: true
        })
      }
    });
  } catch (error) {
    console.error('❌ [RESET PASSWORD] Erreur resendResetCode:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors du renvoi du code' });
  }
};


/**
 * Récupérer le profil
 * ====================
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
export const getProfile = async (req, res) => {
  try {
    const user = req.user; // Déjà récupéré par authMiddleware
    const role = req.userRole; // 'admin' ou 'handicap'

    console.log(`👤 [PROFILE] Récupération du profil: ${role} - ${user.email}`);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Retirer le mot de passe du résultat
    const userObj = user.toObject();
    delete userObj.motDePasse;

    return res.status(200).json({
      success: true,
      user: userObj
    });

  } catch (error) {
    console.error('❌ [PROFILE] Erreur lors de la récupération du profil:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du profil'
    });
  }
};

/**
 * DÉCONNEXION
 * ============
 * Gère la déconnexion pour admin et handicap
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
export const logout = async (req, res) => {
  try {
    if (!req.user) {
      console.warn('⚠️ [LOGOUT] Aucune info utilisateur (token manquant ou invalide)');
      return res.status(200).json({
        success: true,
        message: 'Session déjà expirée ou utilisateur non authentifié'
      });
    }

    const utilisateur = req.user; // objet complet depuis authMiddleware
    const role = req.userRole;
    const emailLower = utilisateur.email.toLowerCase();

    console.log(`🔚 [LOGOUT] Tentative de déconnexion : ${emailLower} (${role})`);
    console.log(`ℹ️ [LOGOUT] Statut actuel: ${utilisateur.statutCompte}`);

    // Mettre à jour le statut si nécessaire
    if (utilisateur.statutCompte === 'en_ligne') {
      utilisateur.statutCompte = 'hors_ligne';
      await utilisateur.save();
      console.log(`👋 [LOGOUT] Statut mis à jour → hors_ligne`);
    } else {
      console.log('ℹ️ [LOGOUT] Utilisateur déjà hors ligne → pas besoin de mise à jour');
    }

    console.log('✅ [LOGOUT] Déconnexion terminée avec succès');
    return res.status(200).json({
      success: true,
      message: 'Déconnexion réussie',
      role
    });

  } catch (error) {
    console.error('❌ [LOGOUT] Erreur serveur lors de la déconnexion:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la déconnexion'
    });
  }
};
