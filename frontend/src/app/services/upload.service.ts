/**
 * Service de gestion des uploads de documents
 * Gère l'upload, le téléchargement et la suppression des documents
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  Document, 
  UploadResponse, 
  DocumentsResponse,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE 
} from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  // URL de base de l'API d'upload
  private apiUrl = `${environment.apiUrl}/upload`;

  constructor(private http: HttpClient) {}

  /**
   * Upload d'un document
   * Envoie un fichier au serveur avec son type
   */
  uploadDocument(file: File, typeDocument: string): Observable<UploadResponse> {
    // Validation côté client
    if (!this.validateFile(file)) {
      return throwError(() => new Error('Fichier non valide'));
    }

    // Création du FormData pour l'upload multipart
    const formData = new FormData();
    formData.append('file', file);
    formData.append('typeDocument', typeDocument);

    return this.http.post<UploadResponse>(`${this.apiUrl}/document`, formData);
  }

  /**
   * Upload avec suivi de progression
   * Permet de suivre le pourcentage d'upload
   */
  uploadDocumentWithProgress(file: File, typeDocument: string): Observable<HttpEvent<any>> {
    if (!this.validateFile(file)) {
      return throwError(() => new Error('Fichier non valide'));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('typeDocument', typeDocument);

    // Requête avec suivi de progression
    const req = new HttpRequest('POST', `${this.apiUrl}/document`, formData, {
      reportProgress: true
    });

    return this.http.request(req);
  }

  /**
   * Récupérer la liste de mes documents
   * Retourne tous les documents uploadés par l'utilisateur connecté
   */
  getMyDocuments(): Observable<DocumentsResponse> {
    return this.http.get<DocumentsResponse>(`${this.apiUrl}/documents`);
  }

  /**
   * Télécharger un document
   * Récupère un document par son ID
   */
  downloadDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/document/${documentId}`, {
      responseType: 'blob'
    });
  }

  /**
   * Supprimer un document
   * Supprime définitivement un document
   */
  deleteDocument(documentId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/document/${documentId}`);
  }

  /**
   * Obtenir les informations d'un document
   * Récupère les métadonnées d'un document sans le télécharger
   */
  getDocumentInfo(documentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/document/${documentId}/info`);
  }

  /**
   * Validation côté client d'un fichier
   * Vérifie le type et la taille du fichier avant upload
   */
  private validateFile(file: File): boolean {
    // Vérifier le type de fichier
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      console.error('Type de fichier non autorisé:', file.type);
      return false;
    }

    // Vérifier la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      console.error('Fichier trop volumineux:', file.size);
      return false;
    }

    return true;
  }

  /**
   * Obtenir la taille maximale autorisée en format lisible
   */
  getMaxFileSizeFormatted(): string {
    return `${MAX_FILE_SIZE / (1024 * 1024)} MB`;
  }

  /**
   * Obtenir les types de fichiers autorisés
   */
  getAllowedFileTypes(): string[] {
    return ALLOWED_FILE_TYPES;
  }

  /**
   * Vérifier si un type de fichier est autorisé
   */
  isFileTypeAllowed(fileType: string): boolean {
    return ALLOWED_FILE_TYPES.includes(fileType);
  }

  /**
   * Formater la taille d'un fichier pour l'affichage
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtenir l'extension d'un fichier
   */
  getFileExtension(filename: string): string {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }
}