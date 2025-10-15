/**
 * CONTRÔLEUR DES DEMANDES CEC
 * 
 * Ce contrôleur gère toute la logique des demandes :
 * - Création de demandes (handicap)
 * - Liste des demandes (admin : toutes, handicap : ses demandes)
 * - Modification du statut (admin)
 * - Suppression de demandes
 */

const DemandeCEC = require('../models/DemandeCEC');
const UserHandicap = require('../models/UserHandicap');
const CarteCEC = require('../models/CarteCEC');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { emitToRole, emitToUser, emitToUsers } = require('../services/socketManager');
let archiver;

const getOwnerId = (demande) => {
  if (!demande) return null;
  const utilisateur = demande.utilisateur;
  if (!utilisateur) return null;
  if (typeof utilisateur === 'object' && utilisateur._id) {
    return utilisateur._id.toString();
  }
  if (typeof utilisateur === 'string') return utilisateur;
  if (typeof utilisateur === 'number') return utilisateur.toString();
  if (typeof utilisateur.toString === 'function') {
    return utilisateur.toString();
  }
  return null;
};

const buildDemandeEventPayload = (demande) => {
  if (!demande) return null;
  const ownerId = getOwnerId(demande);
  let owner = null;
  if (ownerId) {
    if (demande.utilisateur && typeof demande.utilisateur === 'object' && demande.utilisateur._id) {
      owner = {
        id: ownerId,
        nom: demande.utilisateur.nom,
        prenom: demande.utilisateur.prenom,
        email: demande.utilisateur.email
      };
    } else {
      owner = { id: ownerId };
    }
  }

  return {
    id: demande._id?.toString(),
    numeroDemande: demande.numeroDemande,
    type: demande.type,
    statut: demande.statut,
    dateCreation: demande.createdAt,
    dateDerniereModification: demande.dateDerniereModification,
    dateTraitement: demande.dateTraitement,
    assignedAdmin: demande.assignedAdmin ? demande.assignedAdmin.toString() : undefined,
    commentairesAdmin: demande.commentairesAdmin,
    motifRejet: demande.motifRejet,
    utilisateur: owner
  };
};

const emitDemandeEvent = (eventName, demande, meta = {}, options = {}) => {
  const { notifyOwner = true, adminRecipients = 'all', additionalUserIds = [] } = options || {};
  const demandePayload = buildDemandeEventPayload(demande);
  if (!demandePayload) return;
  const payload = {
    ...meta,
    demande: demandePayload
  };

  if (adminRecipients === 'all') {
    emitToRole('admin', eventName, payload);
  }

  const directUserIds = new Set();

  if (notifyOwner) {
    const ownerId = demandePayload.utilisateur?.id;
    if (ownerId) {
      directUserIds.add(ownerId);
    }
  }

  if (adminRecipients === 'actor' && meta?.actor?.id) {
    directUserIds.add(meta.actor.id.toString());
  } else if (Array.isArray(adminRecipients)) {
    adminRecipients.filter(Boolean).forEach(id => directUserIds.add(id.toString()));
  }

  if (Array.isArray(additionalUserIds)) {
    additionalUserIds.filter(Boolean).forEach(id => directUserIds.add(id.toString()));
  }

  if (adminRecipients === 'none') {
    // explicit noop for admins
  }

  if (directUserIds.size > 0) {
    emitToUsers(Array.from(directUserIds), eventName, payload);
  }
};

/**
 * CRÉER UNE NOUVELLE DEMANDE
 * ===========================
 * Un utilisateur handicap crée une demande CEC
 */
const creerDemande = async (req, res) => {
  try {
    console.log('📋 Création d\'une nouvelle demande');

    const { type, ancienneCarte } = req.body;
    const utilisateurId = req.userId;

    // 1. VALIDATION DES DONNÉES
    if (!type || !['nouvelle', 'renouvellement'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type de demande requis (nouvelle ou renouvellement)'
      });
    }

    // 2. VÉRIFIER SI L'UTILISATEUR A DÉJÀ UNE DEMANDE EN COURS
    const demandeEnCours = await DemandeCEC.findOne({
      utilisateur: utilisateurId,
      statut: { $in: ["en_attente", "en_cours_traitement"] }
    });

    if (demandeEnCours) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà une demande en cours',
        demandeExistante: {
          numero: demandeEnCours.numeroDemande,
          statut: demandeEnCours.statut,
          dateCreation: demandeEnCours.dateCreation
        }
      });
    }

    // 3. CAS SPÉCIAL : RENOUVELLEMENT
    if (type === 'renouvellement') {
      if (!ancienneCarte || !ancienneCarte.numero || !ancienneCarte.dateExpiration) {
        return res.status(400).json({
          success: false,
          message: 'Informations de l\'ancienne carte requises pour un renouvellement'
        });
      }

      // Vérifier la carte existante de l'utilisateur par numeroCarte
      const carte = await CarteCEC.findOne({ utilisateur: utilisateurId, numeroCarte: ancienneCarte.numero });
      if (!carte) {
        return res.status(404).json({ success: false, message: 'Carte CEC introuvable pour ce numéro' });
      }
    }

    // 4. Vérifier l'éligibilité documents (présence, pas forcément validés)
    const user = await UserHandicap.findById(utilisateurId).select('documents carteCEC dateNaissance').populate('carteCEC');
    const hasCarte = !!user?.carteCEC;

    // Empêcher incohérences: si carte existe -> pas de nouvelle, seulement renouvellement
    if (hasCarte && type === 'nouvelle') {
      return res.status(400).json({ success: false, message: 'Vous avez déjà une carte valide. Seul le renouvellement est permis.' });
    }
    if (!hasCarte && type === 'renouvellement') {
      return res.status(400).json({ success: false, message: 'Aucune carte existante. Vous devez faire une première demande.' });
    }

    // Règle: le renouvellement n'est permis que si la carte expire dans < 3 mois (ou déjà expirée)
    const presentDocs = new Set((user?.documents || []).map(d => d.type));
    const hasCertificatPerte = presentDocs.has('certificat_perte');

    if (type === 'renouvellement' && hasCarte) {
      const now = new Date();
      const inThreeMonths = new Date(now);
      inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);
      const exp = new Date(user.carteCEC.dateExpiration);
      if (!hasCertificatPerte && exp > inThreeMonths) {
        return res.status(400).json({
          success: false,
          message: "Le renouvellement est autorisé uniquement si la carte expire dans moins de 3 mois"
        });
      }
    }

    // Construire la liste de base selon l'âge (mineur: extrait; majeur: CNI recto+verso)
    const ageYears = (() => {
      if (!user?.dateNaissance) return null;
      const dob = new Date(user.dateNaissance);
      const now = new Date();
      let a = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a--;
      return a;
    })();

    const baseCommon = [
      'photo_identite_1',
      'photo_identite_2',
      'certificat_residence',
      'certificat_invalidite',
      'justificatif_domicile'
    ];
    const identityDocs = (ageYears !== null && ageYears < 18)
      ? ['extrait_naissance']
      : ['cni_recto', 'cni_verso'];
    const requiredBase = [...baseCommon, ...identityDocs];
    const required = type === 'nouvelle'
      ? [...requiredBase]
      : [...requiredBase, 'certificat_perte'];
    const missing = required.filter(t => !presentDocs.has(t));
    // Exiger les pièces spéciales selon le type de demande
    if (type === 'nouvelle' && !presentDocs.has('demande_manuscrite')) {
      missing.push('demande_manuscrite');
    }
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: 'Documents obligatoires manquants', missingDocuments: missing, requiredDocuments: required });
    }

    // 5. CRÉER LA NOUVELLE DEMANDE
    const nouvelleDemande = new DemandeCEC({
      numeroDemande: await DemandeCEC.generateNumeroDemande(),
      type,
      utilisateur: utilisateurId
    });

    if (type === 'renouvellement') {
      nouvelleDemande.ancienneCarte = {
        numero: ancienneCarte.numero,
        dateExpiration: new Date(ancienneCarte.dateExpiration)
      };
    }

    await nouvelleDemande.save();

    await UserHandicap.findByIdAndUpdate(
      utilisateurId,
      { $push: { demandes: nouvelleDemande._id } }
    );

    await nouvelleDemande.populate('utilisateur', 'nom prenom email');
    emitDemandeEvent('demande:created', nouvelleDemande, {
      action: 'created',
      actor: {
        id: utilisateurId?.toString?.() ?? utilisateurId,
        role: req.userRole || 'handicap'
      }
    }, {
      notifyOwner: true,
      adminRecipients: 'all'
    });

    console.log(`✅ Demande créée: ${nouvelleDemande.numeroDemande} par ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Demande créée avec succès',
      data: {
        id: nouvelleDemande._id,
        numeroDemande: nouvelleDemande.numeroDemande,
        type: nouvelleDemande.type,
        statut: nouvelleDemande.statut,
        dateCreation: nouvelleDemande.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur création demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la demande'
    });
  }
};

/**
 * VÉRIFIER L'ÉLIGIBILITÉ DE L'UTILISATEUR À CRÉER/RENOUVELER
 * ==========================================================
 * Retourne: { canCreate, canRenew, missingDocuments, reason, requiredDocuments }
 */
const checkEligibility = async (req, res) => {
  try {
    const utilisateurId = req.userId;
    const user = await UserHandicap.findById(utilisateurId).select('documents carteCEC dateNaissance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const ageYears = (() => {
      if (!user?.dateNaissance) return null;
      const dob = new Date(user.dateNaissance);
      const now = new Date();
      let a = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a--;
      return a;
    })();

    const baseCommon = [
      'photo_identite_1',
      'photo_identite_2',
      'certificat_residence',
      'certificat_invalidite',
      'justificatif_domicile'
    ];
    const identityDocs = (ageYears !== null && ageYears < 18)
      ? ['extrait_naissance']
      : ['cni_recto', 'cni_verso'];
    const baseDocs = [...baseCommon, ...identityDocs];

    const present = new Set((user.documents || []).map(d => d.type));
    const missingBase = baseDocs.filter(t => !present.has(t));
    const hasCarte = !!user.carteCEC;
    const hasCertificatPerte = present.has('certificat_perte');

    const missingForRenewal = [...missingBase];
    if (hasCarte && !hasCertificatPerte) {
      missingForRenewal.push('certificat_perte');
    }

    const hasAllBase = missingBase.length === 0;
    const hasAllForRenewal = missingForRenewal.length === 0;

    const nowElig = new Date();
    const inThreeMonthsElig = new Date(nowElig);
    inThreeMonthsElig.setMonth(inThreeMonthsElig.getMonth() + 3);
    const carteExp = hasCarte ? new Date(user.carteCEC.dateExpiration) : null;

    const canRenewByExpiry = hasCarte && (carteExp <= inThreeMonthsElig);
    const canRenewByLoss = hasCarte && hasCertificatPerte;

    const result = {
      canCreate: hasAllBase && !hasCarte,
      canRenew: hasCarte && hasAllForRenewal && (canRenewByExpiry || canRenewByLoss),
      missingDocuments: hasCarte ? missingForRenewal : missingBase,
      reason: '',
      requiredDocuments: hasCarte ? [...baseDocs, 'certificat_perte'] : baseDocs,
      carte: hasCarte ? {
        id: user.carteCEC._id,
        numeroCarte: user.carteCEC.numeroCarte,
        dateDelivrance: user.carteCEC.dateDelivrance,
        dateExpiration: user.carteCEC.dateExpiration,
        statut: user.carteCEC.statut,
        nombreRenouvellements: user.carteCEC.nombreRenouvellements
      } : null
    };

    if (!hasCarte && !hasAllBase) {
      result.reason = 'Documents obligatoires manquants';
    } else if (hasCarte) {
      if (!canRenewByExpiry && !canRenewByLoss) {
        result.reason = 'Renouvellement autorisé uniquement si la carte expire dans moins de 3 mois ou en cas de perte avec certificat';
      } else if (!hasAllForRenewal) {
        result.reason = 'Documents obligatoires manquants pour le renouvellement';
      } else {
        result.reason = canRenewByLoss && !canRenewByExpiry
          ? 'Carte perdue: renouvellement autorisé avec certificat de perte'
          : 'Carte existante: renouvellement autorisé';
      }
    } else {
      // Pas de carte: peut créer nouvelle demande
      result.reason = 'Éligible pour une première demande';
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Erreur checkEligibility:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la vérification de l\'éligibilité' });
  }
};


/**
 * LISTER TOUTES LES DEMANDES (ADMIN UNIQUEMENT)
 * ==============================================
 * Retourne toutes les demandes avec filtres et pagination
 */
const listerToutesLesDemandes = async (req, res) => {
  try {
    console.log('📋 Récupération de toutes les demandes (admin)');
    
    const { statut, type, page = 1, limit = 10, search } = req.query;
    // 1. CONSTRUIRE LE FILTRE
    // ========================
    const filtre = {};
    
    if (statut && statut !== 'tous') {
      filtre.statut = statut;
    }
    
    if (type && type !== 'tous') {
      filtre.type = type;
    }

    // 2. PAGINATION
    // =============
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 3. REQUÊTE AVEC POPULATION
    // ===========================
    let query = DemandeCEC.find(filtre)
      .populate('utilisateur', 'nom prenom email telephone handicap')
      .sort({ createdAt: -1 }) // Plus récent en premier
      .skip(skip)
      .limit(limitNum);

    // 4. RECHERCHE TEXTUELLE (optionnelle)
    // =====================================
    if (search) {
      // Rechercher dans les numéros de demande ou les noms des propriétaires
      const searchRegex = new RegExp(search, 'i');
      
      // Il faut faire une approche différente pour chercher dans les propriétaires
      const proprietairesMatchs = await UserHandicap.find({
        $or: [
          { nom: searchRegex },
          { prenom: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');
      
      const proprietairesIds = proprietairesMatchs.map(p => p._id);
      
      filtre.$or = [
        { numeroDemande: searchRegex },
        { utilisateur: { $in: proprietairesIds } }
      ];
      
      query = DemandeCEC.find(filtre)
        .populate('utilisateur', 'nom prenom email telephone handicap')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
    }

    // 3.5 Restreindre la visibilité des demandes en cours de traitement à l'admin assigné
    if (req.userRole === 'admin') {
      query = query.where({
        $or: [
          { statut: { $ne: 'en_cours_traitement' } },
          { assignedAdmin: null },
          { assignedAdmin: req.userId }
        ]
      });
    }

    const demandes = await query;
    const total = await DemandeCEC.countDocuments(filtre);

    // 5. ENRICHIR LES DONNÉES
    // ========================
    const demandesEnrichies = demandes.map(demande => ({
      id: demande._id,
      numeroDemande: demande.numeroDemande,
      type: demande.type,
      statut: demande.statut,
      dateCreation: demande.createdAt,
      dateDerniereModification: demande.dateDerniereModification,
      dateTraitement: demande.dateTraitement,
      proprietaire: demande.utilisateur ? {
        id: demande.utilisateur._id,
        prenom: demande.utilisateur.prenom,
        nom: demande.utilisateur.nom,
        email: demande.utilisateur.email,
        telephone: demande.utilisateur.telephone,
        handicap: demande.utilisateur.handicap
      } : undefined,
      assignedAdmin: demande.assignedAdmin,
      commentairesAdmin: demande.commentairesAdmin,
      motifRejet: demande.motifRejet
    }));

    // 6. STATISTIQUES RAPIDES
    // ========================
    const stats = typeof DemandeCEC.obtenirStatistiques === 'function'
      ? await DemandeCEC.obtenirStatistiques()
      : null;

    console.log(`✅ ${demandes.length} demandes récupérées sur ${total}`);

    res.status(200).json({
      success: true,
      data: {
        demandes: demandesEnrichies,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        stats
      }
    });

  } catch (error) {
    console.error('❌ Erreur liste demandes admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des demandes'
    });
  }
};

/**
 * LISTER LES DEMANDES DE L'UTILISATEUR CONNECTÉ
 * ==============================================
 * Retourne seulement les demandes du handicap connecté
 */
const listerMesDemandes = async (req, res) => {
  try {
    console.log('📋 Récupération des demandes utilisateur');
    
    const utilisateurId = req.userId;

    // 1. RÉCUPÉRER LES DEMANDES DE L'UTILISATEUR
    // ===========================================
    const demandes = await DemandeCEC.find({ utilisateur: utilisateurId })
      .sort({ createdAt: -1 })
      .populate('utilisateur', 'nom prenom email');

    // 2. ENRICHIR LES DONNÉES
    // ========================
    const demandesEnrichies = demandes.map(demande => ({
      id: demande._id,
      numeroDemande: demande.numeroDemande,
      type: demande.type,
      statut: demande.statut,
      dateCreation: demande.createdAt,
      dateDerniereModification: demande.dateDerniereModification,
      dateTraitement: demande.dateTraitement,
      commentairesAdmin: demande.commentairesAdmin,
      motifRejet: demande.motifRejet,
      ancienneCarte: demande.ancienneCarte,
      // Historique simplifié (sans détails internes)
      historiquePublic: (demande.historique || []).map(h => ({
        action: h.action,
        date: h.date,
        details: h.details
      }))
    }));

    console.log(`✅ ${demandes.length} demandes trouvées pour ${req.user.email}`);

    res.status(200).json({
      success: true,
      data: {
        demandes: demandesEnrichies,
        total: demandes.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur liste mes demandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos demandes'
    });
  }
};

/**
 * OBTENIR UNE DEMANDE SPÉCIFIQUE
 * ===============================
 * Récupère les détails d'une demande (admin : toute demande, handicap : ses demandes)
 */
const obtenirDemande = async (req, res) => {
  try {
    console.log('🔍 Récupération d\'une demande spécifique');
    
    const { id } = req.params;
    const utilisateurRole = req.userRole;
    const utilisateurId = req.userId;

    // 1. CONSTRUIRE LE FILTRE SELON LE RÔLE
    // ======================================
    let filtre = { _id: id };
    
    // Si c'est un handicap, il ne peut voir que ses demandes
    if (utilisateurRole === 'handicap') {
      filtre.utilisateur = utilisateurId;
    }

    // 2. RÉCUPÉRER LA DEMANDE
    // ========================
    const demande = await DemandeCEC.findOne(filtre)
      .populate('utilisateur', 'nom prenom email telephone typeHandicap adresse documents');

    // Si admin, empêcher l'accès aux demandes en cours assignées à un autre admin
    if (utilisateurRole === 'admin' && demande.statut === 'en_cours_traitement') {
      if (demande.assignedAdmin && demande.assignedAdmin.toString() !== utilisateurId.toString()) {
        return res.status(403).json({ success: false, message: 'Demande en cours assignée à un autre administrateur' });
      }
    }

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou accès non autorisé'
      });
    }

    // 3. PRÉPARER LA RÉPONSE SELON LE RÔLE
    // =====================================
    const toPublicUrl = (p) => {
      if (!p) return undefined;
      const norm = String(p).replace(/\\\\/g, '/').replace(/\\/g, '/');
      const idx = norm.indexOf('/uploads/');
      const rel = idx !== -1 ? norm.substring(idx) : null;
      const base = process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
      return rel ? `${base}${rel}` : `${base}/uploads/${norm.split('/').pop()}`;
    };

    const reponse = {
      id: demande._id,
      numeroDemande: demande.numeroDemande,
      type: demande.type,
      statut: demande.statut,
      dateCreation: demande.createdAt,
      dateDerniereModification: demande.dateDerniereModification,
      dateTraitement: demande.dateTraitement,
      ancienneCarte: demande.ancienneCarte,
      assignedAdmin: demande.assignedAdmin,
      documents: Array.isArray(demande.utilisateur?.documents) ? demande.utilisateur.documents.map(d => ({
        id: d._id?.toString?.() || undefined,
        nom: d.nom || d.filename || 'document',
        typeDocument: d.type || d.typeDocument,
        url: toPublicUrl(d.url),
        dateUpload: d.dateUpload || d.createdAt || undefined
      })) : []
    };

    // Si demande de type renouvellement, inclure les détails de la carte du propriétaire
    if (demande.type === 'renouvellement') {
      try {
        const ownerId = (demande.utilisateur && demande.utilisateur._id) ? demande.utilisateur._id : demande.utilisateur;
        const userWithCarte = await UserHandicap.findById(ownerId).populate('carteCEC');
        if (userWithCarte && userWithCarte.carteCEC) {
          reponse.carte = {
            numeroCarte: userWithCarte.carteCEC.numeroCarte,
            dateDelivrance: userWithCarte.carteCEC.dateDelivrance,
            dateExpiration: userWithCarte.carteCEC.dateExpiration,
            nombreRenouvellements: userWithCarte.carteCEC.nombreRenouvellements,
            dateDernierRenouvellement: userWithCarte.carteCEC.dateDernierRenouvellement
          };
        }
      } catch (e) {
        console.warn('Impossible de récupérer la carte pour la demande de renouvellement:', e);
      }
    }

    // Infos propriétaire (plus détaillées pour admin)
    if (utilisateurRole === 'admin') {
      if (demande.utilisateur) {
        reponse.proprietaire = {
          id: demande.utilisateur._id,
          nom: demande.utilisateur.nom,
          prenom: demande.utilisateur.prenom,
          nomComplet: `${demande.utilisateur.prenom} ${demande.utilisateur.nom}`,
          email: demande.utilisateur.email,
          telephone: demande.utilisateur.telephone,
          handicap: demande.utilisateur.handicap,
          typeHandicap: demande.utilisateur.typeHandicap,
          adresse: demande.utilisateur.adresse
        };
      }
      reponse.commentairesAdmin = demande.commentairesAdmin;
      reponse.historique = demande.historique || [];
    } else {
      if (demande.utilisateur) {
        reponse.proprietaire = {
          nomComplet: `${demande.utilisateur.prenom} ${demande.utilisateur.nom}`
        };
      }
      // Historique public seulement
      reponse.historique = (demande.historique || []).map(h => ({
        action: h.action,
        date: h.date,
        details: h.details
      }));
    }

    // Motif de rejet visible par tous
    if (demande.statut === 'rejetee') {
      reponse.motifRejet = demande.motifRejet;
    }

    console.log(`✅ Demande ${demande.numeroDemande} récupérée par ${req.user.email}`);

    res.status(200).json({
      success: true,
      data: reponse
    });

  } catch (error) {
    console.error('❌ Erreur obtenir demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la demande'
    });
  }
};

/**
 * MODIFIER UNE DEMANDE
 * =====================
 * Admin : changer statut, ajouter commentaires
 * Handicap : modifier sa demande si statut permet
 */
const modifierDemande = async (req, res) => {
  try {
    console.log('✏️  Modification d\'une demande');
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID de la demande manquant"
      });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de la demande invalide"
      });
    }

    const utilisateurRole = req.userRole;
    const utilisateurId = req.userId;
    
    // 1. RÉCUPÉRER LA DEMANDE
    // ========================
    let filtre = { _id: id };
    if (utilisateurRole === 'handicap') {
      filtre.utilisateur = utilisateurId;
    }

    const demande = await DemandeCEC.findOne(filtre)
      .populate('utilisateur', 'nom prenom email');

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou accès non autorisé'
      });
    }

    const actorMeta = {
      id: utilisateurId?.toString?.() ?? utilisateurId,
      role: utilisateurRole
    };
    let statutChanged = false;
    let statutChangeMeta = null;
    let carteEventPayload = null;
    const previousCommentairesAdmin = demande.commentairesAdmin;
    const assignedAdminBefore = demande.assignedAdmin ? demande.assignedAdmin.toString() : null;

    // 2. TRAITEMENT SELON LE RÔLE
    // ============================
    
    if (utilisateurRole === 'admin') {
      // MODIFICATIONS ADMIN
      // ===================
      const { statut, commentairesAdmin, motifRejet } = req.body;
      const previousStatutValue = demande.statut;

      if (statut && statut !== demande.statut) {
        // Validation du nouveau statut
        const statutsValides = ['en_attente', 'en_cours_traitement', 'validee', 'rejetee'];
        if (!statutsValides.includes(statut)) {
          return res.status(400).json({
            success: false,
            message: 'Statut invalide'
          });
        }

        // Si rejet, motif obligatoire
        if (statut === 'rejetee' && !motifRejet) {
          return res.status(400).json({
            success: false,
            message: 'Motif de rejet obligatoire'
          });
        }

        // Si démarrage du traitement, assigner l'admin si non encore assigné
        if (statut === 'en_cours_traitement') {
          if (demande.assignedAdmin && demande.assignedAdmin.toString() !== utilisateurId.toString()) {
            return res.status(403).json({ success: false, message: 'Demande en cours assignée à un autre administrateur' });
          }
          if (!demande.assignedAdmin) {
            demande.assignedAdmin = utilisateurId;
            demande.assignedAt = new Date();
          }
        }

        // Changer le statut avec historique
        demande.changerStatut(statut, utilisateurId, motifRejet || 'Modification par admin');
        
        if (statut === 'rejetee') {
          demande.motifRejet = motifRejet;
        }

        statutChanged = true;
        statutChangeMeta = {
          action: 'statut_update',
          actor: actorMeta,
          statut,
          previousStatut: previousStatutValue,
          motifRejet: statut === 'rejetee' ? (motifRejet || demande.motifRejet || null) : null
        };

        // Si validation: gérer la Carte CEC (création ou renouvellement)
        if (statut === 'validee') {
          const userId = (demande.utilisateur && demande.utilisateur._id) ? demande.utilisateur._id : demande.utilisateur;
          const user = await UserHandicap.findById(userId).populate('carteCEC');
          if (demande.type === 'nouvelle') {
            // Créer une nouvelle carte si inexistante
            if (!user.carteCEC) {
              const numeroCarte = await CarteCEC.generateNumero();
              const now = new Date();
              const exp = new Date(now);
              exp.setFullYear(exp.getFullYear() + 1);
              const carte = await CarteCEC.create({
                numeroCarte,
                utilisateur: user._id,
                dateDelivrance: now,
                dateExpiration: exp,
                statut: 'valide'
              });
              await UserHandicap.findByIdAndUpdate(user._id, { carteCEC: carte._id });
              console.log(`🎴 Carte CEC créée pour ${user.email}: ${numeroCarte}`);
              carteEventPayload = {
                numeroCarte,
                dateDelivrance: now,
                dateExpiration: exp,
                statut: 'valide',
                nombreRenouvellements: 0
              };
            }
          } else if (demande.type === 'renouvellement' && user.carteCEC) {
            // Vérifier l'éligibilité: carte expirant dans < 3 mois
            const nowCheck = new Date();
            const inThreeMonthsCheck = new Date(nowCheck);
            inThreeMonthsCheck.setMonth(inThreeMonthsCheck.getMonth() + 3);
            const expDateCheck = new Date(user.carteCEC.dateExpiration);
            if (expDateCheck > inThreeMonthsCheck) {
              return res.status(400).json({
                success: false,
                message: "Renouvellement non autorisé: la carte n'expire pas dans les 3 prochains mois"
              });
            }
            // Renouveler la carte existante
            const carte = await CarteCEC.findById(user.carteCEC._id);
            if (carte) {
              const now = new Date();
              carte.dateDelivrance = now;
              // pre-validate hook sets expiration if missing, but here we recalc +1 an
              const exp = new Date(now);
              exp.setFullYear(exp.getFullYear() + 1);
              carte.dateExpiration = exp;
              carte.nombreRenouvellements = (carte.nombreRenouvellements || 0) + 1;
              carte.dateDernierRenouvellement = now;
              carte.statut = 'valide';
              // Historiser le renouvellement (inclure certificat de perte si fourni)
              try {
                const certPerte = Array.isArray(demande.documentsFournis)
                  ? demande.documentsFournis.find(d => d.type === 'certificat_perte')
                  : null;
                if (certPerte && certPerte.url) {
                  carte.certificat_perte = certPerte.url;
                }
                carte.historiqueRenouvellements = Array.isArray(carte.historiqueRenouvellements)
                  ? carte.historiqueRenouvellements
                  : [];
                carte.historiqueRenouvellements.push({
                  date: now,
                  certificatPerteUrl: certPerte?.url,
                  notes: `Renouvellement validé via demande ${demande.numeroDemande}`
                });
              } catch (e) {
                console.warn('Impossible d\'historiser le renouvellement:', e);
              }
              await carte.save();
              console.log(`♻️ Carte CEC renouvelée: ${carte.numeroCarte}`);
              carteEventPayload = {
                numeroCarte: carte.numeroCarte,
                dateDelivrance: now,
                dateExpiration: exp,
                statut: 'valide',
                nombreRenouvellements: carte.nombreRenouvellements,
                dateDernierRenouvellement: carte.dateDernierRenouvellement
              };
            }
          }
        }

        console.log(`📡 Statut demande ${demande.numeroDemande} mis à jour vers ${statut}`);
      }

      // Mise à jour des commentaires admin
      if (commentairesAdmin !== undefined) {
        demande.commentairesAdmin = commentairesAdmin;
      }

    } else {
      // MODIFICATIONS HANDICAP
      // =======================
      
      // Vérifier que la demande peut être modifiée
      if (!['en_attente'].includes(demande.statut)) {
        return res.status(400).json({
          success: false,
          message: 'Cette demande ne peut plus être modifiée'
        });
      }

      const { type, ancienneCarte } = req.body;
      
      if (type && type !== demande.type) {
        if (!['nouvelle', 'renouvellement'].includes(type)) {
          return res.status(400).json({
            success: false,
            message: 'Type de demande invalide'
          });
        }
        demande.type = type;
        
        // Réinitialiser les documents requis selon le nouveau type
        demande.initialiserDocumentsRequis();
      }

      if (ancienneCarte && demande.type === 'renouvellement') {
        demande.ancienneCarte = {
          numero: ancienneCarte.numero,
          dateExpiration: new Date(ancienneCarte.dateExpiration)
        };
      }

      demande.dateDerniereModification = new Date();
    }

    // 3. SAUVEGARDER
    // ==============
    await demande.save();

    await demande.populate('utilisateur', 'nom prenom email');

    console.log(`✅ Demande ${demande.numeroDemande} modifiée par ${req.user.email}`);

    const emitOptions = {
      notifyOwner: !(utilisateurRole === 'handicap' && actorMeta?.id === getOwnerId(demande)),
      adminRecipients: utilisateurRole === 'admin' ? 'all' : 'none'
    };

    if (statutChanged) {
      emitDemandeEvent('demande:statusChanged', demande, statutChangeMeta, emitOptions);
    }

    emitDemandeEvent('demande:updated', demande, {
      action: 'updated',
      actor: actorMeta,
      statutChanged,
      commentaireChange: previousCommentairesAdmin !== demande.commentairesAdmin,
      assignedAdminBefore,
      assignedAdminAfter: demande.assignedAdmin ? demande.assignedAdmin.toString() : null
    }, emitOptions);

    if (carteEventPayload) {
      const ownerId = getOwnerId(demande);
      if (ownerId) {
        emitToUser(ownerId, 'carte:updated', {
          ...carteEventPayload,
          actor: actorMeta,
          demande: buildDemandeEventPayload(demande)
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Demande modifiée avec succès',
      data: {
        id: demande._id,
        numeroDemande: demande.numeroDemande,
        statut: demande.statut,
        dateDerniereModification: demande.dateDerniereModification,
        dateTraitement: demande.dateTraitement
      }
    });

  } catch (error) {
    console.error('❌ Erreur modification demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification de la demande'
    });
  }
};

/**
 * SUPPRIMER UNE DEMANDE
 * =====================
 * Seul le propriétaire peut supprimer sa demande (si statut permet)
 */
const supprimerDemande = async (req, res) => {
  try {
    console.log('🗑️  Suppression d\'une demande');
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID de la demande manquant"
      });
    }

    // Vérifier l'ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de la demande invalide"
      });
    }

    const utilisateurRole = req.userRole;
    const utilisateurId = req.userId;

    // 1. RÉCUPÉRER LA DEMANDE
    // ========================
    let filtre = { _id: id };
    if (utilisateurRole === 'handicap') {
      // Utiliser le champ correct du modèle
      filtre.utilisateur = utilisateurId;
    }

    const demande = await DemandeCEC.findOne(filtre)
      .populate('utilisateur', 'nom prenom email');

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou accès non autorisé'
      });
    }

    // 2. VÉRIFIER SI LA SUPPRESSION EST AUTORISÉE
    // ============================================
    if (demande.statut === 'en_cours_traitement') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une demande en cours de traitement'
      });
    }

    if (demande.statut === 'validee') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une demande validée'
      });
    }

    // 3. SUPPRIMER LA DEMANDE
    // ========================
    await DemandeCEC.findByIdAndDelete(id);

    // 4. RETIRER LA RÉFÉRENCE DE L'UTILISATEUR
    // =========================================
    await UserHandicap.findByIdAndUpdate(
      demande.utilisateur,
      { $pull: { demandes: demande._id } }
    );

    console.log(`✅ Demande ${demande.numeroDemande} supprimée par ${req.user.email}`);

    const ownerId = getOwnerId(demande);

    emitDemandeEvent('demande:deleted', demande, {
      action: 'deleted',
      actor: {
        id: utilisateurId?.toString?.() ?? utilisateurId,
        role: utilisateurRole
      },
      silentForAdmins: utilisateurRole !== 'admin'
    }, {
      notifyOwner: !!ownerId,
      adminRecipients: utilisateurRole === 'admin' ? (utilisateurId ? [utilisateurId] : 'actor') : 'all'
    });

    res.status(200).json({
      success: true,
      message: 'Demande supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la demande'
    });
  }
};

/**
 * EXPORTER UNE DEMANDE EN ZIP (ADMIN)
 * ====================================
 * Contient tous les documents et un résumé texte
 */
async function exporterDemandeZip(req, res) {
  try {
    // Chargement lazy d'archiver pour éviter crash si non installé
    archiver = archiver || require('archiver');
    const { id } = req.params;
    const utilisateurRole = req.userRole;
    const utilisateurId = req.userId;

    // 1. RÉCUPÉRER LA DEMANDE
    // ========================
    let filtre = { _id: id };
    if (utilisateurRole === 'handicap') {
      filtre.utilisateur = utilisateurId;
    }

    const demande = await DemandeCEC.findOne(filtre)
      .populate('utilisateur', 'nom prenom email telephone typeHandicap adresse documents');

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou accès non autorisé'
      });
    }

    // 2. PRÉPARER LE ZIP
    // ==================
    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipName = `demande-${demande.numeroDemande}.zip`;
    const zipStream = res.attachment(zipName);

    // 3. AJOUTER LES DOCUMENTS
    // =========================
    if (demande.utilisateur && demande.utilisateur.documents) {
      demande.utilisateur.documents.forEach(doc => {
        if (doc.url) {
          const type = doc.type || doc.typeDocument || 'document';
          const base = doc.filename || require('path').basename(doc.url);
          archive.file(doc.url, { name: `documents/${type}/${base}` });
        }
      });
    }

    // 4. AJOUTER LE RÉSUMÉ TEXTE
    // ===========================
    const fDate = (d) => (d ? new Date(d).toISOString() : '');
    const fSize = (n) => {
      if (!n && n !== 0) return '';
      const u = ['o','Ko','Mo','Go'];
      let s = n, i = 0; while (s >= 1024 && i < u.length-1) { s/=1024; i++; }
      return `${Math.round(s*100)/100} ${u[i]}`;
    };

    const proprietaire = demande.utilisateur || {};
    const lignes = [];
    lignes.push(`FICHE DEMANDE CEC`);
    lignes.push(`Numero        : ${demande.numeroDemande}`);
    lignes.push(`Type          : ${demande.type}`);
    lignes.push(`Statut        : ${demande.statut}`);
    lignes.push(`Date creation : ${fDate(demande.createdAt)}`);
    lignes.push(`Derniere maj  : ${fDate(demande.dateDerniereModification)}`);
    lignes.push(`Date traitement: ${fDate(demande.dateTraitement)}`);
    if (demande.assignedAdmin) {
      lignes.push(`Admin assigne : ${demande.assignedAdmin}`);
      lignes.push(`Assigne le    : ${fDate(demande.assignedAt)}`);
    }
    lignes.push('');
    lignes.push('DEMANDEUR');
    lignes.push(`Nom           : ${proprietaire.nom || ''}`);
    lignes.push(`Prenom        : ${proprietaire.prenom || ''}`);
    lignes.push(`Email         : ${proprietaire.email || ''}`);
    lignes.push(`Telephone     : ${proprietaire.telephone || ''}`);
    lignes.push(`Adresse       : ${typeof proprietaire.adresse === 'string' ? proprietaire.adresse : ''}`);
    lignes.push('');
    lignes.push('DOCUMENTS');
    (proprietaire.documents || []).forEach((d, idx) => {
      const type = d.type || d.typeDocument || 'document';
      const base = d.filename || require('path').basename(d.url || '');
      const size = fSize(d.size);
      const date = fDate(d.dateUpload);
      lignes.push(` - [${idx+1}] ${type} | ${base} | ${size} | ${date}`);
    });

    archive.append(lignes.join('\n'), { name: 'dossier_demande.txt' });

    // 5. FINALISER LE ZIP
    // ===================
    archive.pipe(zipStream);
    await archive.finalize();
  } catch (error) {
    console.error('❌ Erreur export ZIP:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Erreur lors de la génération du ZIP' });
    }
  }
}

/**
 * Récupérer la Carte CEC de l'utilisateur connecté (handicap)
 */
async function getMyCarte(req, res) {
  try {
    const utilisateurId = req.userId;
    const user = await UserHandicap.findById(utilisateurId).populate('carteCEC');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    const c = user.carteCEC;
    return res.status(200).json({
      success: true,
      data: c ? {
        id: c._id,
        numeroCarte: c.numeroCarte,
        dateDelivrance: c.dateDelivrance,
        dateExpiration: c.dateExpiration,
        statut: c.statut,
        nombreRenouvellements: c.nombreRenouvellements
      } : null
    });
  } catch (e) {
    console.error('❌ Erreur getMyCarte:', e);
    return res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la carte' });
  }
}

module.exports = {
  creerDemande,
  listerToutesLesDemandes,
  listerMesDemandes,
  obtenirDemande,
  modifierDemande,
  supprimerDemande,
  checkEligibility,
  exporterDemandeZip,
  getMyCarte
};