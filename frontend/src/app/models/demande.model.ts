/**
 * Modèles TypeScript pour les demandes CEC
 * Définit les interfaces pour les demandes de carte d'égalité des chances
 */

// Interface pour une demande CEC
export interface DemandeCEC {
  id?: string;
  numeroDemande?: string;
  type: 'nouvelle' | 'renouvellement';
  statut: 'en_attente' | 'en_cours_traitement' | 'validee' | 'rejetee';
  proprietaire?: string | UserHandicap;
  dateCreation?: Date;
  dateTraitement?: Date;
  motifRefus?: string;
  commentairesAdmin?: string;
  assignedAdmin?: string | null;
  ancienneCarte?: {
    numero: string;
    dateExpiration: string;
  };
  documentsRequis?: string[];
  historique?: HistoriqueEntry[];
  carte?: {
    numeroCarte?: string;
    dateDelivrance?: string | Date;
    dateExpiration?: string | Date;
    nombreRenouvellements?: number;
    dateDernierRenouvellement?: string | Date;
  };
}

// Interface pour l'historique d'une demande
export interface HistoriqueEntry {
  date: Date;
  action: string;
  auteur: string;
  details?: string;
}

// Interface pour créer une nouvelle demande
export interface CreateDemandeRequest {
  type: 'nouvelle' | 'renouvellement';
  ancienneCarte?: {
    numero: string;
    dateExpiration: string;
  };
}

// Interface pour mettre à jour une demande (admin)
export type StatutDemande = 'en_attente' | 'en_cours_traitement' | 'validee' | 'rejetee';
export interface UpdateDemandeRequest {
  statut?: StatutDemande;
  commentairesAdmin?: string;
  motifRefus?: string;
}

// Interface pour la réponse API des demandes
export interface DemandeResponse {
  success: boolean;
  data: {
    demandes: DemandeCEC[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats: {
      total: number;
      enAttente: number;
      enCours: number;
      validees: number;
      rejetees: number;
    };
  };
}

export interface GetMyDemandesResponse {
  success: boolean;
  data: {
    demandes: DemandeCEC[];
    total: number;
  };
}

export interface EligibilityData {
  canCreate: boolean;
  canRenew: boolean;
  missingDocuments: string[];
  reason: string;
  requiredDocuments: string[];
  carte?: {
    id: string;
    numeroCarte: string;
    dateDelivrance: string | Date;
    dateExpiration: string | Date;
    statut: 'valide' | 'expiree';
    nombreRenouvellements: number;
  } | null;
}

export interface EligibilityResponse {
  success: boolean;
  data: EligibilityData;
}

// Import nécessaire pour UserHandicap
import { UserHandicap } from './user.model';