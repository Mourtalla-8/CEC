/**
 * Service Socket.IO pour les notifications temps réel
 * Gère la connexion WebSocket et les événements en temps réel
 */

import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CarteUpdatedEvent,
  DemandeRealtimeEvent,
  DocumentUploadedEvent,
  SelfStatusEvent,
  UserStatusEvent
} from '../models/realtime-events.model';
import { RealtimeBusService } from '../shared/services/realtime-bus.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  // Instance Socket.IO
  private socket: Socket | null = null;
  
  // Subject pour suivre l'état de connexion
  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  private heartbeatInterval?: any;
  private readonly HEARTBEAT_KEY = 'cec_socket_tabs';
  private readonly HEARTBEAT_INTERVAL = 5000;

  constructor(
    private realtimeBus: RealtimeBusService,
    private authService: AuthService
  ) {}

  /**
   * Se connecter au serveur Socket.IO
   * Établit la connexion WebSocket avec le backend
   */
  connect(): void {
    if (!this.socket || !this.socket.connected) {
      // Créer la connexion Socket.IO
      this.socket = io(environment.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Écouter l'événement de connexion
      this.socket.on('connect', () => {
        console.log('✅ Connecté à Socket.IO avec ID:', this.socket?.id);
        this.connectedSubject.next(true);
        this.startHeartbeat();
        this.identifyCurrentUser();
      });

      // Écouter l'événement de déconnexion
      this.socket.on('disconnect', (reason) => {
        console.log('❌ Déconnecté de Socket.IO. Raison:', reason);
        this.connectedSubject.next(false);
        this.stopHeartbeat();
      });

      // Écouter les erreurs de connexion
      this.socket.on('connect_error', (error) => {
        console.error('❌ Erreur de connexion Socket.IO:', error);
        this.connectedSubject.next(false);
      });

      this.registerCoreListeners();
    }
  }

  /**
   * Se déconnecter du serveur Socket.IO
   * Ferme proprement la connexion WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectedSubject.next(false);
      this.stopHeartbeat();
      console.log('🔌 Déconnexion Socket.IO');
    }
  }

  /**
   * S'identifier auprès du serveur
   * Envoie les informations utilisateur au serveur pour les notifications ciblées
   */
  identify(userId: string, role: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('identify', { userId, role });
      console.log(`🔗 Identifié comme ${role} (${userId})`);
    } else {
      console.warn('⚠️ Impossible de s\'identifier: Socket non connecté');
    }
  }

  identifyCurrentUser(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.id && currentUser?.role) {
      this.identify(currentUser.id, currentUser.role);
      this.joinRoom(`role:${currentUser.role}`);
      this.joinRoom(`user:${currentUser.id}`);
    }
  }

  /**
   * Émettre un événement vers le serveur
   * Envoie des données au serveur via Socket.IO
   */
  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      console.log(`📤 Événement émis: ${event}`, data);
    } else {
      console.warn(`⚠️ Impossible d'émettre ${event}: Socket non connecté`);
    }
  }

  /**
   * Écouter un événement spécifique
   * Ajoute un listener pour un événement personnalisé
   */
  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
      console.log(`👂 Écoute de l'événement: ${event}`);
    }
  }

  /**
   * Arrêter d'écouter un événement
   * Supprime un listener pour un événement
   */
  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
      console.log(`🔇 Arrêt de l'écoute: ${event}`);
    }
  }

  /**
   * Vérifier si la connexion est active
   */
  isConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  /**
   * Obtenir l'ID de la socket
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Rejoindre une room spécifique
   * Utile pour les notifications ciblées par groupe
   */
  joinRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('joinRoom', room);
      console.log(`🏠 Rejoint la room: ${room}`);
    }
  }

  /**
   * Quitter une room
   */
  leaveRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leaveRoom', room);
      console.log(`🚪 Quitté la room: ${room}`);
    }
  }

  /**
   * Obtenir un Observable pour un événement spécifique
   * Permet d'utiliser les événements Socket.IO avec RxJS
   */
  fromEvent(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data: any) => observer.next(data));
      }
      
      // Cleanup function
      return () => {
        if (this.socket) {
          this.socket.off(event);
        }
      };
    });
  }

  private registerCoreListeners(): void {
    if (!this.socket) return;

    this.socket.on('demande:created', (event: DemandeRealtimeEvent) => {
      console.log('📨 demande:created', event);
      this.realtimeBus.emitDemandeCreated(event);
    });

    this.socket.on('demande:updated', (event: DemandeRealtimeEvent) => {
      console.log('📨 demande:updated', event);
      this.realtimeBus.emitDemandeUpdated(event);
    });

    this.socket.on('demande:statusChanged', (event: DemandeRealtimeEvent) => {
      console.log('📨 demande:statusChanged', event);
      this.realtimeBus.emitDemandeStatusChanged(event);
    });

    this.socket.on('demande:deleted', (event: DemandeRealtimeEvent) => {
      console.log('📨 demande:deleted', event);
      this.realtimeBus.emitDemandeDeleted(event);
    });

    this.socket.on('document:uploaded', (event: DocumentUploadedEvent) => {
      console.log('📨 document:uploaded', event);
      this.realtimeBus.emitDocumentUploaded(event);
    });

    this.socket.on('carte:updated', (event: CarteUpdatedEvent) => {
      console.log('📨 carte:updated', event);
      this.realtimeBus.emitCarteUpdated(event);
    });

    this.socket.on('user:status', (event: UserStatusEvent) => {
      this.realtimeBus.emitUserStatus(event);
    });

    this.socket.on('user:selfStatus', (event: SelfStatusEvent) => {
      this.realtimeBus.emitSelfStatus(event);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.writeHeartbeat();
    this.heartbeatInterval = setInterval(() => this.writeHeartbeat(), this.HEARTBEAT_INTERVAL);
    window.addEventListener('storage', this.onStorageEvent);
    window.addEventListener('beforeunload', this.stopHeartbeat.bind(this));
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    this.removeHeartbeat();
    window.removeEventListener('storage', this.onStorageEvent);
    window.removeEventListener('beforeunload', this.stopHeartbeat.bind(this));
  }

  private writeHeartbeat(): void {
    if (!this.socket?.id) return;
    const currentUser = this.authService.getCurrentUser();
    const entry = {
      socketId: this.socket.id,
      lastSeen: Date.now(),
      userId: currentUser?.id,
      role: currentUser?.role
    };
    try {
      localStorage.setItem(this.HEARTBEAT_KEY, JSON.stringify(entry));
    } catch (error) {
      console.warn('Impossible d\'écrire le heartbeat socket', error);
    }
  }

  private removeHeartbeat(): void {
    try {
      const entryRaw = localStorage.getItem(this.HEARTBEAT_KEY);
      if (!entryRaw) return;
      const entry = JSON.parse(entryRaw);
      if (entry?.socketId === this.socket?.id) {
        localStorage.removeItem(this.HEARTBEAT_KEY);
      }
    } catch (error) {
      console.warn('Impossible de supprimer le heartbeat socket', error);
    }
  }

  private onStorageEvent = (event: StorageEvent) => {
    if (event.key !== this.HEARTBEAT_KEY) return;
    const entry = event.newValue ? JSON.parse(event.newValue) : null;
    const currentUser = this.authService.getCurrentUser();
    if (!entry || !currentUser) return;
    if (entry.userId === currentUser.id && entry.role === currentUser.role) {
      if (!this.socket?.connected) {
        this.connect();
      }
    }
  };
}