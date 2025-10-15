import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

import { Subscription } from 'rxjs';
import { DemandeService } from '../services/demande.service';
import { DemandeCEC } from '../models/demande.model';
import { UploadService } from '../services/upload.service';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../shared/services/notification.service';

@Component({
  selector: 'app-demande-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './demande-detail.component.html',
  styleUrls: ['./demande-detail.component.css']
})
export class DemandeDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  isUpdating = false;
  demande?: DemandeCEC;
  documents: Array<{ id?: string; nom?: string; typeDocument?: string; url?: string; dateUpload?: string | Date }>=[];
  carte?: { numeroCarte?: string; dateDelivrance?: string | Date; dateExpiration?: string | Date; nombreRenouvellements?: number; dateDernierRenouvellement?: string | Date };

  showDecision = false;
  decisionType: 'validee' | 'rejetee' | null = null;
  motif: string = '';

  // Rôles
  isAdmin = false;
  isHandicap = false;
  // Affectation admin (optionnelle si renvoyée par l'API)
  assignedAdminId?: string;

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private demandeService: DemandeService,
    private uploadService: UploadService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') as string;
    if (!id) { this.router.navigate(['/']); return; }
    // Déterminer le rôle courant
    const user = this.authService.getCurrentUser();
    this.isAdmin = user?.role === 'admin';
    this.isHandicap = user?.role === 'handicap';
    this.fetchDemande(id);
  }

  statusLabel(statut?: DemandeCEC['statut']): string {
    switch (statut) {
      case 'en_attente':
        return 'En attente';
      case 'en_cours_traitement':
        return 'En cours de traitement';
      case 'validee':
        return 'Validée';
      case 'rejetee':
        return 'Rejetée';
      default:
        return 'Statut inconnu';
    }
  }

  typeLabel(type?: DemandeCEC['type']): string {
    switch (type) {
      case 'renouvellement':
        return 'Renouvellement';
      case 'nouvelle':
        return 'Nouvelle demande';
      default:
        return 'Type inconnu';
    }
  }

  decisionNote(d?: DemandeCEC | null): string | null {
    if (!d) return null;
    const motif = d.motifRefus?.trim();
    const commentaire = d.commentairesAdmin?.trim();
    if (motif && commentaire) {
      return `${motif} — ${commentaire}`;
    }
    return motif || commentaire || null;
  }

  formatDocType(type?: string | null): string {
    if (!type) {
      return '—';
    }
    const cleaned = type.replace(/_/g, ' ').toLowerCase();
    return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  fetchDemande(id: string): void {
    this.isLoading = true;
    const sub = this.demandeService.getDemandeById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res?.success) {
          // API renvoie data: reponse
          const d = res.data as any;
          this.demande = {
            id: d.id,
            numeroDemande: d.numeroDemande,
            type: d.type,
            statut: d.statut,
            dateCreation: d.dateCreation,
            dateTraitement: d.dateTraitement,
            commentairesAdmin: d.commentairesAdmin,
            motifRefus: d.motifRejet,
            historique: d.historique,
          } as DemandeCEC;
          this.documents = Array.isArray(d.documents) ? d.documents : [];
          this.assignedAdminId = d.assignedAdmin || d.assignedTo;
          this.carte = d.carte || undefined;
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur récupération demande:', err);
        this.notify.error('Erreur lors du chargement de la demande');
      }
    });
    this.subs.push(sub);
  }

  // Navigation
  goBack(): void {
    history.back();
  }

  // Documents
  download(docId?: string): void {
    if (!docId) return;
    this.uploadService.downloadDocument(docId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('Erreur téléchargement')
    });
  }

  // Admin actions
  canStartOrResume(): boolean {
    return this.demande?.statut === 'en_attente';
  }

  startResumeLabel(): string {
    return 'Démarrer le traitement';
  }

  canTakeOwnership(): boolean {
    if (!this.isAdmin) return false;
    // Si aucune affectation, n'importe quel admin peut démarrer
    if (!this.assignedAdminId) return true;
    const user = this.authService.getCurrentUser();
    return this.assignedAdminId === user?.id || this.assignedAdminId === user?._id;
  }

  startOrResume(): void {
    if (!this.demande?.id) return;
    this.isUpdating = true;
    const sub = this.demandeService.updateDemande(this.demande.id, { statut: 'en_cours_traitement' as any }).subscribe({
      next: (res) => {
        this.isUpdating = false;
        if (res.success) {
          this.notify.success('Traitement démarré/repris');
          this.fetchDemande(this.demande!.id!);
        }
      },
      error: (err) => { this.isUpdating = false; this.notify.error('Erreur démarrage traitement'); }
    });
    this.subs.push(sub);
  }

  showValidation(): void {
    this.showDecision = true;
    this.decisionType = 'validee';
  }

  showRejet(): void {
    this.showDecision = true;
    this.decisionType = 'rejetee';
  }

  confirmerDecision(): void {
    if (!this.demande?.id || !this.decisionType) return;
    this.isUpdating = true;
    const updates: any = { statut: this.decisionType };
    if (this.decisionType === 'rejetee') {
      updates.motifRejet = this.motif || 'Motif non précisé';
    } else {
      updates.commentairesAdmin = this.motif || 'Validation';
    }
    const sub = this.demandeService.updateDemande(this.demande.id, updates).subscribe({
      next: (res) => {
        this.isUpdating = false;
        if (res.success) {
          this.notify.success('Décision appliquée');
          this.fetchDemande(this.demande!.id!);
          this.cancelDecision();
        }
      },
      error: () => { this.isUpdating = false; this.notify.error('Erreur application décision'); }
    });
    this.subs.push(sub);
  }

  cancelDecision(): void {
    this.showDecision = false;
    this.decisionType = null;
    this.motif = '';
  }

  // Handicap actions
  canCancel(): boolean {
    return this.isHandicap && this.demande?.statut === 'en_attente';
  }

  cancelDemande(): void {
    if (!this.demande?.id) return;
    if (!confirm('Confirmez-vous l\'annulation de cette demande ?')) return;
    this.isUpdating = true;
    const sub = this.demandeService.deleteDemande(this.demande.id).subscribe({
      next: (res) => {
        this.isUpdating = false;
        if (res.success) {
          this.notify.success('Demande annulée');
          this.goBack();
        }
      },
      error: () => { this.isUpdating = false; this.notify.error('Erreur lors de l\'annulation'); }
    });
    this.subs.push(sub);
  }

  // Export ZIP (admin)
  downloadZip(): void {
    if (!this.demande?.id) return;
    this.demandeService.downloadZip(this.demande.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const base = this.demande?.numeroDemande ? `demande_${this.demande.numeroDemande}.zip` : 'demande.zip';
        a.download = base;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('Erreur export ZIP')
    });
  }
}
