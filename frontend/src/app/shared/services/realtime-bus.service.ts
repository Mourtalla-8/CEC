import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  DemandeRealtimeEvent,
  DocumentUploadedEvent,
  CarteUpdatedEvent,
  UserStatusEvent,
  SelfStatusEvent
} from '../../models/realtime-events.model';

@Injectable({ providedIn: 'root' })
export class RealtimeBusService {
  private demandeCreatedSubject = new Subject<DemandeRealtimeEvent>();
  private demandeUpdatedSubject = new Subject<DemandeRealtimeEvent>();
  private demandeStatusChangedSubject = new Subject<DemandeRealtimeEvent>();
  private demandeDeletedSubject = new Subject<DemandeRealtimeEvent>();
  private documentUploadedSubject = new Subject<DocumentUploadedEvent>();
  private carteUpdatedSubject = new Subject<CarteUpdatedEvent>();
  private userStatusSubject = new Subject<UserStatusEvent>();
  private selfStatusSubject = new Subject<SelfStatusEvent>();

  get demandeCreated$(): Observable<DemandeRealtimeEvent> {
    return this.demandeCreatedSubject.asObservable();
  }

  get demandeUpdated$(): Observable<DemandeRealtimeEvent> {
    return this.demandeUpdatedSubject.asObservable();
  }

  get demandeStatusChanged$(): Observable<DemandeRealtimeEvent> {
    return this.demandeStatusChangedSubject.asObservable();
  }

  get demandeDeleted$(): Observable<DemandeRealtimeEvent> {
    return this.demandeDeletedSubject.asObservable();
  }

  get documentUploaded$(): Observable<DocumentUploadedEvent> {
    return this.documentUploadedSubject.asObservable();
  }

  get carteUpdated$(): Observable<CarteUpdatedEvent> {
    return this.carteUpdatedSubject.asObservable();
  }

  get userStatus$(): Observable<UserStatusEvent> {
    return this.userStatusSubject.asObservable();
  }

  get selfStatus$(): Observable<SelfStatusEvent> {
    return this.selfStatusSubject.asObservable();
  }

  emitDemandeCreated(event: DemandeRealtimeEvent): void {
    this.demandeCreatedSubject.next(event);
  }

  emitDemandeUpdated(event: DemandeRealtimeEvent): void {
    this.demandeUpdatedSubject.next(event);
  }

  emitDemandeStatusChanged(event: DemandeRealtimeEvent): void {
    this.demandeStatusChangedSubject.next(event);
  }

  emitDemandeDeleted(event: DemandeRealtimeEvent): void {
    this.demandeDeletedSubject.next(event);
  }

  emitDocumentUploaded(event: DocumentUploadedEvent): void {
    this.documentUploadedSubject.next(event);
  }

  emitCarteUpdated(event: CarteUpdatedEvent): void {
    this.carteUpdatedSubject.next(event);
  }

  emitUserStatus(event: UserStatusEvent): void {
    this.userStatusSubject.next(event);
  }

  emitSelfStatus(event: SelfStatusEvent): void {
    this.selfStatusSubject.next(event);
  }
}
