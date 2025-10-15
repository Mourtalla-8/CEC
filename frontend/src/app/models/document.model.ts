/**
 * Modèles TypeScript pour les documents
 * Définit les interfaces pour la gestion des documents uploadés
 */

// Interface pour un document uploadé
export interface Document {
  id?: string;
  nom?: string; // compat affichage
  originalName?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  // Nouveau type basé sur le backend
  type?:
    | 'photo_identite_1'
    | 'photo_identite_2'
    | 'extrait_naissance'
    | 'cni_recto'
    | 'cni_verso'
    | 'certificat_residence'
    | 'certificat_invalidite'
    | 'justificatif_domicile'
    | 'demande_manuscrite'
    | 'certificat_perte';
  // Ancien champ encore utilisé dans certains templates
  typeDocument?: string;
  proprietaire?: string;
  uploadDate?: Date;
  // Statut de validation (frontend)
  statut?: 'en_attente' | 'valide' | 'rejete';
  commentaires?: string;
}

// Interface pour l'upload d'un document
export interface UploadDocumentRequest {
  file: File;
  typeDocument: string;
}

// Interface pour la réponse d'upload
export interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    document: Document;
    url?: string;
  };
}

// Interface pour la liste des documents
export interface DocumentsResponse {
  success: boolean;
  data: {
    documents: Document[];
    stats: {
      total: number;
      parType: Record<string, number>;
    };
    utilisateur: {
      nom: string;
      prenom: string;
      email: string;
    };
  };
}


// Types de documents acceptés
export const DOCUMENT_TYPES = {
  photo_identite_1: "Photo d'identité 1",
  photo_identite_2: "Photo d'identité 2",
  extrait_naissance: 'Extrait de naissance',
  cni_recto: 'CNI - Recto',
  cni_verso: 'CNI - Verso',
  certificat_residence: 'Certificat de résidence',
  certificat_invalidite: "Certificat d'invalidité",
  justificatif_domicile: 'Justificatif de domicile',
  demande_manuscrite: 'Demande manuscrite',
  certificat_perte: 'Certificat de perte'
} as const;

// Extensions de fichiers autorisées
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'application/pdf'
];

// Taille maximale des fichiers (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;