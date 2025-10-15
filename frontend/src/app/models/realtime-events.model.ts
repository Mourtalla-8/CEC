export interface ActorInfo {
  id?: string;
  role?: string;
}

export interface DemandeRealtimeUser {
  id?: string;
  nom?: string;
  prenom?: string;
  email?: string;
}

export interface DemandeRealtimeData {
  id?: string;
  numeroDemande?: string;
  type?: string;
  statut?: string;
  dateCreation?: string | Date;
  dateDerniereModification?: string | Date;
  dateTraitement?: string | Date;
  commentairesAdmin?: string;
  motifRejet?: string | null;
  utilisateur?: DemandeRealtimeUser | null;
}

export interface DemandeRealtimeEvent {
  action?: string;
  actor?: ActorInfo;
  demande: DemandeRealtimeData;
  statut?: string;
  previousStatut?: string;
  statutChanged?: boolean;
  commentaireChange?: boolean;
  assignedAdminBefore?: string | null;
  assignedAdminAfter?: string | null;
  motifRejet?: string | null;
  silentForAdmins?: boolean;
  silentForOwner?: boolean;
  performedByOwner?: boolean;
}

export interface DocumentRealtimePayload {
  id?: string;
  type?: string;
  url?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  dateUpload?: string | Date;
}

export interface DocumentUploadedEvent {
  action?: string;
  utilisateur?: {
    id?: string;
  } | null;
  document: DocumentRealtimePayload;
}

export interface CarteUpdatedEvent {
  numeroCarte?: string;
  dateDelivrance?: string | Date;
  dateExpiration?: string | Date;
  statut?: string;
  nombreRenouvellements?: number;
  dateDernierRenouvellement?: string | Date;
  actor?: ActorInfo;
  demande?: DemandeRealtimeData;
}

export interface UserStatusEvent {
  userId: string;
  role: string;
  statut: string;
  timestamp?: string;
}

export interface SelfStatusEvent extends UserStatusEvent {}
