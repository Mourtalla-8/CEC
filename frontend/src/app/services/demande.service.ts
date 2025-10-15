/**
 * Service de gestion des demandes CEC
 * Gère toutes les opérations CRUD sur les demandes de carte d'égalité des chances
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  DemandeCEC, 
  CreateDemandeRequest, 
  UpdateDemandeRequest,
  DemandeResponse,
  GetMyDemandesResponse,
  EligibilityResponse
} from '../models/demande.model';

@Injectable({
  providedIn: 'root'
})
export class DemandeService {
  // URL de base de l'API des demandes
  private apiUrl = `${environment.apiUrl}/demandes`;

  constructor(private http: HttpClient) {}

  /**
   * Créer une nouvelle demande CEC
   * Utilisé par les utilisateurs handicapés pour créer une demande
   */
  createDemande(demande: CreateDemandeRequest): Observable<DemandeResponse> {
    return this.http.post<DemandeResponse>(this.apiUrl, demande);
  }

  /**
   * Récupérer toutes les demandes (admin seulement)
   * Permet aux administrateurs de voir toutes les demandes du système
   */
  getAllDemandes(params?: { page?: number; limit?: number; statut?: string; type?: string; search?: string }): Observable<DemandeResponse> {
    const httpParams: any = {};
    if (params) {
      if (params.page) httpParams.page = params.page;
      if (params.limit) httpParams.limit = params.limit;
      if (params.statut !== undefined && params.statut !== null) httpParams.statut = params.statut;
      if (params.type !== undefined && params.type !== null) httpParams.type = params.type;
      if (params.search) httpParams.search = params.search;
    }
    return this.http.get<DemandeResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Récupérer mes demandes (utilisateur handicapé)
   * Permet à un utilisateur de voir uniquement ses propres demandes
   */
  getMyDemandes(): Observable<GetMyDemandesResponse> {
    return this.http.get<GetMyDemandesResponse>(`${this.apiUrl}/me`);
  }

  /**
   * Récupérer une demande spécifique par son ID
   * Accessible au propriétaire de la demande et aux administrateurs
   */
  getDemandeById(id: string): Observable<DemandeResponse> {
    return this.http.get<DemandeResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Mettre à jour une demande
   * Utilisé par les administrateurs pour changer le statut d'une demande
   */
  updateDemande(id: string, updates: UpdateDemandeRequest): Observable<DemandeResponse> {
    return this.http.put<DemandeResponse>(`${this.apiUrl}/${id}`, updates);
  }

  /**
   * Supprimer une demande
   * Permet de supprimer une demande (propriétaire ou admin)
   */
  deleteDemande(id: string): Observable<DemandeResponse> {
    return this.http.delete<DemandeResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Mettre à jour le statut d'une demande (admin seulement)
   * Méthode spécialisée pour les administrateurs
   */
  updateStatut(
    id: string, 
    statut: string, 
    commentairesAdmin?: string, 
    motifRefus?: string
  ): Observable<DemandeResponse> {
    const updates: UpdateDemandeRequest = {
      statut: statut as any,
      commentairesAdmin,
      motifRefus
    };
    
    return this.updateDemande(id, updates);
  }

  /**
   * Valider une demande (admin)
   * Raccourci pour valider une demande
   */
  validerDemande(id: string, commentaires?: string): Observable<DemandeResponse> {
    return this.updateStatut(id, 'validee', commentaires);
  }

  /**
   * Rejeter une demande (admin)
   * Raccourci pour rejeter une demande avec motif
   */
  rejeterDemande(id: string, motifRefus: string, commentaires?: string): Observable<DemandeResponse> {
    return this.updateStatut(id, 'rejetee', commentaires, motifRefus);
  }

  /**
   * Mettre une demande en cours de traitement (admin seulement)
   * Raccourci pour marquer une demande comme en cours
   */
  mettreEnCours(id: string, commentaires?: string): Observable<DemandeResponse> {
    return this.updateStatut(id, 'en_cours_traitement', commentaires);
  }

  /**
   * Obtenir les statistiques des demandes (admin)
   * Retourne des statistiques sur les demandes pour le dashboard admin
   */
  getStatistiques(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/dashboard`);
  }

  /**
   * Rechercher des demandes avec filtres (admin)
   * Permet de filtrer les demandes par statut, type, date, etc.
   */
  searchDemandes(filters: any): Observable<DemandeResponse> {
    return this.http.get<DemandeResponse>(`${this.apiUrl}/search`, { params: filters });
  }

  /**
   * Retourne l'historique complet des modifications d'une demande
   */
  getHistorique(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}/historique`);
  }

  /**
   * Vérifier l'éligibilité de l'utilisateur courant
   */
  getEligibility(): Observable<EligibilityResponse> {
    return this.http.get<EligibilityResponse>(`${this.apiUrl}/eligibility`);
  }

  /**
   * Récupérer la carte CEC de l'utilisateur courant
   */
  getMyCarte(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/carte`);
  }

  /**
   * Télécharger la demande au format ZIP (admin assigné, en cours de traitement)
   */
  downloadZip(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/export-zip`, {
      responseType: 'blob' as 'json'
    }) as unknown as Observable<Blob>;
  }
}