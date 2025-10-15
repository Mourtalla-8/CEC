/**
 * Composant Dashboard Admin
 * Interface principale pour les administrateurs
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule, Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NavigationEnd } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { DemandeService } from '../services/demande.service';
import { SocketService } from '../services/socket.service';
import {DemandeCEC, StatutDemande, UpdateDemandeRequest} from '../models/demande.model';
import { User, UserAdmin } from '../models/user.model';
import { RealtimeBusService } from '../shared/services/realtime-bus.service';
import { DemandeRealtimeEvent, DocumentUploadedEvent } from '../models/realtime-events.model';
import { AdminStatsComponent } from '../shared/ui/admin-stats/admin-stats.component';
import { NotificationService } from '../shared/services/notification.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSelectModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatMenuModule,
    MatDividerModule,
    RouterModule,
    RouterLink,
    AdminStatsComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  // Données utilisateur
  currentUser?: User;
  showProfile = false;
  profile?: Partial<UserAdmin>;

  // Données des demandes
  demandes: DemandeCEC[] = [];
  demandesFiltrees: DemandeCEC[] = [];

  // États du composant
  isLoading = false;
  isUpdatingDemande = false;
  isInDetail = false;

  // Pagination
  page = 1;
  limit = 10;
  total = 0;
  totalPages = 1;
  pageSizeOptions: number[] = [10, 20, 50];

  // Filtres
  filtreStatut = '';
  filtreType = '';

  // Statistiques
  statistiques = {
    total: 0,
    enAttente: 0,
    enCours: 0,
    validees: 0,
    rejetees: 0
  };

  // Colonnes du tableau
  displayedColumns: string[] = [
    'numeroDemande',
    'proprietaire',
    'type',
    'statut',
    'dateCreation'
  ];

  // Subscriptions
  private subscriptions: Subscription[] = [];
  private deferredStatusTransitions = new Map<string, DemandeCEC['statut']>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private demandeService: DemandeService,
    private socketService: SocketService,
    private notify: NotificationService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private realtimeBus: RealtimeBusService
  ) {}

  ngOnInit(): void {
    // Récupérer les informations utilisateur
    this.currentUser = this.authService.getCurrentUser();

    // Charger le profil détaillé (admin)
    const subProfile = this.authService.getProfile().subscribe({
      next: (res: any) => {
        const u = res?.data?.user || res?.user || {};
        this.profile = {
          email: u.email,
          role: u.role || 'admin',
          statut: u.statut,
          createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
          _id: u._id
        } as any;
      },
      error: () => {}
    });
    this.subscriptions.push(subProfile);

    // Charger les données initiales
    this.loadDemandes();
    this.loadStats();

    // Écouter les notifications Socket.IO
    this.setupSocketListeners();

    // Déterminer si on est dans la vue détail (route enfant)
    const updateInDetail = () => {
      const url = this.router.url || '';
      this.isInDetail = /\/admin-dashboard\/demandes\/.+/.test(url);
    };
    updateInDetail();
    const subNav = this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) updateInDetail();
    });
    this.subscriptions.push(subNav);
  }

  /**
   * Ouvrir le détail d'une demande au clic sur la ligne
   */
  onRowClick(row: DemandeCEC): void {
    if (!row?.id) return;
    this.router.navigate(['demandes', row.id], { relativeTo: this.route });
  }

  ngOnDestroy(): void {
    // Nettoyer les subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Charger toutes les demandes
   */
  loadDemandes(): void {
    this.isLoading = true;

    const sub = this.demandeService.getAllDemandes({
      page: this.page,
      limit: this.limit,
      statut: this.filtreStatut || undefined,
      type: this.filtreType || undefined
    }).subscribe({
      next: (response) => {
        if (response.success) {
          // this.demandes = Array.isArray(response.data) ? response.data : [response.data];
          // récupérer le tableau des demandes
          const sourceDemandes = Array.isArray(response.data.demandes)
            ? response.data.demandes
            : [];
          this.demandes = sourceDemandes.map(raw => this.normalizeFetchedDemande(raw));

          // Trier par date de création (plus récentes en haut)
          this.demandes.sort((a: any, b: any) => {
            const ad = a?.dateCreation ? new Date(a.dateCreation).getTime() : 0;
            const bd = b?.dateCreation ? new Date(b.dateCreation).getTime() : 0;
            return bd - ad;
          });
          // garder une copie filtrée (déjà triée)
          this.demandesFiltrees = [...this.demandes];

          // Mettre à jour stats depuis réponse si fournies, sinon on les rafraîchit via loadStats()
          const s: any = response.data?.stats || null;
          if (s) {
            this.statistiques = {
              total: (s.total ?? 0),
              enAttente: (s.en_attente ?? s.enAttente ?? 0),
              enCours: (s.en_cours_traitement ?? s.enCours ?? 0),
              validees: (s.validee ?? s.validees ?? 0),
              rejetees: (s.rejetee ?? s.rejetees ?? 0)
            };
          } else {
            this.loadStats();
          }
          this.calculerStatistiques();

          // pagination metadata
          const p = response.data.pagination || {} as any;
          this.total = p.total || this.demandes.length;
          this.totalPages = p.pages || 1;
          this.page = p.page || this.page;
          this.limit = p.limit || this.limit;

          // Mettre à jour les options de taille de page selon le total
          this.pageSizeOptions = this.buildPageSizeOptions(this.total);

          console.log('✅ Demandes chargées:', this.demandes);
          console.log('📊 Stats:', this.statistiques);
          console.log('📄 Pagination:', response.data.pagination);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur lors du chargement des demandes:', error);
        this.showMessage('Erreur lors du chargement des demandes', 'error');
        this.isLoading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  /** Charger les statistiques globales depuis l'API dédiée */
  private loadStats(): void {
    const sub = this.demandeService.getStatistiques().subscribe({
      next: (res: any) => {
        const payload = res?.data?.demandes || res?.demandes || {};
        this.statistiques = {
          total: (payload.total ?? 0),
          enAttente: (payload.en_attente ?? payload.enAttente ?? 0),
          enCours: (payload.en_cours_traitement ?? payload.enCours ?? 0),
          validees: (payload.validee ?? payload.validees ?? 0),
          rejetees: (payload.rejetee ?? payload.rejetees ?? 0)
        };
      },
      error: () => {
        // Ne rien faire: conserver les valeurs actuelles pour éviter d'écraser par 0
      }
    });
    this.subscriptions.push(sub);
  }

  /**
   * Calculer les statistiques
   */
  calculerStatistiques(): void {
    // If backend provided global stats, keep them. Otherwise fallback to local page stats.
    if (this.statistiques && typeof this.statistiques.total === 'number' && this.statistiques.total > 0) {
      return;
    }
    this.statistiques = {
      total: this.demandes.length,
      enAttente: this.demandes.filter(d => d.statut === 'en_attente').length,
      enCours: this.demandes.filter(d => d.statut === 'en_cours_traitement').length,
      validees: this.demandes.filter(d => d.statut === 'validee').length,
      rejetees: this.demandes.filter(d => d.statut === 'rejetee').length
    };
  }

  /**
   * Filtrer les demandes
   */
  filtrerDemandes(): void {
    // refetch from server with filters and reset to first page
    this.page = 1;
    this.loadDemandes();
  }

  changePageSize(newLimit: number): void {
    this.limit = Number(newLimit) || 10;
    this.page = 1;
    this.loadDemandes();
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.loadDemandes();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadDemandes();
    }
  }

  goToFirstPage(): void {
    if (this.page !== 1) {
      this.page = 1;
      this.loadDemandes();
    }
  }

  goToLastPage(): void {
    if (this.page !== this.totalPages) {
      this.page = this.totalPages;
      this.loadDemandes();
    }
  }

  get pageStart(): number {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.limit + 1;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.limit, this.total);
  }

  private buildPageSizeOptions(total: number): number[] {
    if (!total || total < 1) return [10, 20, 50];
    const base = [10, 20, 50].filter(v => v <= total);
    if (!base.includes(total)) base.push(total);
    return base.sort((a, b) => a - b);
  }

  /**
   * Mettre à jour le statut d'une demande
   */
  updateStatutDemande(demande: DemandeCEC, nouveauStatut: StatutDemande): void {
    console.log(demande);
    if (!demande.id) {
      this.showMessage('ID de la demande manquant', 'error');
      return;
    }

    this.isUpdatingDemande = true;

    const updates: UpdateDemandeRequest = {
      statut: nouveauStatut,
      commentairesAdmin: `Statut mis à jour par ${this.currentUser?.email}`
    };

    const sub = this.demandeService.updateDemande(demande.id!, updates).subscribe({
      next: (response) => {
        this.isUpdatingDemande = false;

        if (response.success) {
          this.showMessage(`Demande ${nouveauStatut} avec succès !`, 'success');
          this.loadDemandes(); // Recharger les demandes
        }
      },
      error: (error) => {
        this.isUpdatingDemande = false;
        console.error('❌ Erreur lors de la mise à jour:', error);
        this.showMessage('Erreur lors de la mise à jour', 'error');
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Valider une demande
   */
  validerDemande(demande: DemandeCEC): void {
    if (confirm(`Êtes-vous sûr de vouloir valider la demande ${demande.numeroDemande} ?`)) {
      this.updateStatutDemande(demande, 'validee');
    }
  }

  /**
   * Rejeter une demande
   */
  rejeterDemande(demande: DemandeCEC): void {
    const motif = prompt('Motif de rejet (optionnel):');
    if (motif !== null) { // L'utilisateur n'a pas annulé
      const updates: UpdateDemandeRequest = {
        statut: 'rejetee',
        motifRefus: motif || 'Aucun motif spécifié',
        commentairesAdmin: `Demande rejetée par ${this.currentUser?.email}`
      };

      this.isUpdatingDemande = true;

      const sub = this.demandeService.updateDemande(demande.id!, updates).subscribe({
        next: (response) => {
          this.isUpdatingDemande = false;

          if (response.success) {
            this.showMessage('Demande rejetée avec succès !', 'success');
            this.loadDemandes();
          }
        },
        error: (error) => {
          this.isUpdatingDemande = false;
          console.error('❌ Erreur lors du rejet:', error);
          this.showMessage('Erreur lors du rejet', 'error');
        }
      });

      this.subscriptions.push(sub);
    }
  }

  /**
   * Mettre en cours de traitement (désactivé dans le nouveau workflow)
   */
  mettreEnCours(demande: DemandeCEC): void {
    // Statut intermédiaire supprimé - ne rien faire
    this.showMessage('Statut "en cours" supprimé. Utilisez "Accepter" ou "Refuser".', 'info');
  }

  /**
   * Obtenir la couleur du statut
   */
  getStatutColor(statut: string): string {
    switch (statut) {
      case 'en_attente': return 'primary';
      case 'en_cours_traitement': return 'accent';
      case 'validee': return 'primary';
      case 'rejetee': return 'warn';
      default: return 'primary';
    }
  }

  /**
   * Obtenir le libellé du statut
   */
  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'en_attente': return 'En attente';
      case 'en_cours_traitement': return 'En cours';
      case 'validee': return 'Validée';
      case 'rejetee': return 'Rejetée';
      default: return statut;
    }
  }

  /**
   * Obtenir le nom du propriétaire
   */
  getProprietaireNom(demande: DemandeCEC): string {
    if (typeof demande.proprietaire === 'object' && demande.proprietaire) {
      return `${demande.proprietaire.prenom} ${demande.proprietaire.nom}`;
    }
    return 'Utilisateur inconnu';
  }

  /**
   * Configuration des listeners Socket.IO
   */
  private setupSocketListeners(): void {
    // Écouter les nouvelles demandes
    const subCreated = this.realtimeBus.demandeCreated$.subscribe(event => {
      this.onDemandeCreated(event);
    });
    const subStatus = this.realtimeBus.demandeStatusChanged$.subscribe(event => {
      this.onDemandeStatusChanged(event);
    });
    const subUpdated = this.realtimeBus.demandeUpdated$.subscribe(event => {
      if (!event?.statutChanged) {
        this.onDemandeUpdated(event);
      }
    });
    const subDeleted = this.realtimeBus.demandeDeleted$.subscribe(event => {
      this.onDemandeDeleted(event);
    });
    const subDocument = this.realtimeBus.documentUploaded$.subscribe(event => {
      this.onDocumentUploaded(event);
    });

    this.subscriptions.push(subCreated, subStatus, subUpdated, subDeleted, subDocument);
  }

  private onDemandeCreated(event: DemandeRealtimeEvent): void {
    const demande = this.normalizeDemandeEventData(event);
    if (!demande?.id) return;
    const result = this.upsertDemande(demande);
    this.sortDemandes();
    this.applyFiltersAfterMutation();
    if (result.created) {
      const nextTotal = (this.statistiques?.total ?? 0) + 1;
      this.updateStats({ total: nextTotal });
      this.incrementStatCount(demande.statut);
      this.total = this.total + 1;
      this.ensurePaginationBounds();
    }
    if (!event?.silentForAdmins && demande.numeroDemande) {
      this.showMessage(`Nouvelle demande reçue: ${demande.numeroDemande}`, 'info');
    }
  }

  private onDemandeStatusChanged(event: DemandeRealtimeEvent): void {
    const demande = this.normalizeDemandeEventData(event);
    if (!demande?.id) return;
    const actorId = event.actor?.id ? event.actor.id.toString() : null;
    const viewerId = this.currentUser?.id ?? null;
    const isCurrentActor = actorId && viewerId ? actorId === viewerId : false;

    const result = this.upsertDemande(demande);

    if (demande.statut === 'en_cours_traitement' && event.actor?.role === 'admin' && !isCurrentActor) {
      const storedPrevious = (event.previousStatut as DemandeCEC['statut']) ?? result.previousStatut;
      if (storedPrevious) {
        this.deferredStatusTransitions.set(demande.id, storedPrevious);
      }
    } else {
      const deferredPrevious = this.deferredStatusTransitions.get(demande.id);
      if (deferredPrevious) {
        this.deferredStatusTransitions.delete(demande.id);
      }
      const previousStatut = deferredPrevious ?? result.previousStatut ?? (event.previousStatut as DemandeCEC['statut'] | undefined);
      if (previousStatut && previousStatut !== demande.statut) {
        this.updateStatsForTransition(previousStatut, demande.statut);
      }
    }
    this.sortDemandes();
    this.applyFiltersAfterMutation();
    this.ensurePaginationBounds();

    const isOtherAdminAction = event.actor?.role === 'admin' && !isCurrentActor;
    if (!event?.silentForAdmins && !isOtherAdminAction && demande.numeroDemande && demande.statut && demande.statut !== 'en_cours_traitement') {
      this.showMessage(`Demande ${demande.numeroDemande} → ${this.getStatutLabel(demande.statut)}`, 'info');
    }
  }

  private onDemandeUpdated(event: DemandeRealtimeEvent): void {
    const demande = this.normalizeDemandeEventData(event);
    if (!demande?.id) return;
    const result = this.upsertDemande(demande);
    this.sortDemandes();
    this.applyFiltersAfterMutation();
    if (!result.created && event?.commentaireChange && demande.numeroDemande) {
      this.showMessage(`Commentaires mis à jour pour ${demande.numeroDemande}`, 'info');
    }
  }

  private onDemandeDeleted(event: DemandeRealtimeEvent): void {
    const demande = this.normalizeDemandeEventData(event);
    const removed = this.removeDemande(demande?.id);
    if (removed) {
      const nextTotal = Math.max(0, (this.statistiques?.total ?? 0) - 1);
      this.updateStats({ total: nextTotal });
      this.decrementStatCount(removed.statut);
      this.total = Math.max(this.demandes.length, this.total - 1);
      this.sortDemandes();
      this.applyFiltersAfterMutation();
      this.ensurePaginationBounds();
    }
    if (!event?.silentForAdmins && demande?.numeroDemande) {
      this.showMessage(`Demande ${demande.numeroDemande} supprimée`, 'info');
    }
  }

  private onDocumentUploaded(event: DocumentUploadedEvent): void {
    if (!event?.document || !event.utilisateur?.id) return;
    this.showMessage(`Nouveau document reçu`, 'info');
  }

  private normalizeDemandeEventData(event: DemandeRealtimeEvent): DemandeCEC | null {
    if (!event?.demande) {
      return null;
    }

    const raw: any = event.demande;
    const id: string | undefined = raw.id || raw._id;
    if (!id) {
      return null;
    }

    const existing = this.demandes.find(d => d.id === id);
    const type = (raw.type as DemandeCEC['type']) || existing?.type || 'nouvelle';
    const statut = (raw.statut as DemandeCEC['statut']) || existing?.statut || 'en_attente';

    const dateCreation = raw.dateCreation ? new Date(raw.dateCreation) : undefined;
    const normalizedCreation = dateCreation && !Number.isNaN(dateCreation.getTime())
      ? dateCreation
      : existing?.dateCreation;

    const dateTraitement = raw.dateTraitement ? new Date(raw.dateTraitement) : undefined;
    const normalizedTraitement = dateTraitement && !Number.isNaN(dateTraitement.getTime())
      ? dateTraitement
      : existing?.dateTraitement;

    const assignedAdmin = raw.assignedAdmin ?? event?.assignedAdminAfter ?? existing?.assignedAdmin ?? null;
    const utilisateur = raw.utilisateur || null;
    const proprietaire = utilisateur
      ? { ...(typeof existing?.proprietaire === 'object' ? existing?.proprietaire : {}), ...utilisateur }
      : existing?.proprietaire;

    const normalized: DemandeCEC = {
      id,
      numeroDemande: raw.numeroDemande ?? existing?.numeroDemande,
      type,
      statut,
      commentairesAdmin: raw.commentairesAdmin ?? existing?.commentairesAdmin,
      motifRefus: raw.motifRejet ?? raw.motifRefus ?? existing?.motifRefus,
      dateCreation: normalizedCreation,
      dateTraitement: normalizedTraitement,
      proprietaire: proprietaire as any,
      assignedAdmin: assignedAdmin ? String(assignedAdmin) : existing?.assignedAdmin,
      ancienneCarte: existing?.ancienneCarte,
      carte: existing?.carte,
      documentsRequis: existing?.documentsRequis,
      historique: existing?.historique
    };

    return normalized;
  }

  private normalizeFetchedDemande(raw: any): DemandeCEC {
    if (!raw) {
      return {
        id: undefined,
        numeroDemande: undefined,
        type: 'nouvelle',
        statut: 'en_attente'
      } as DemandeCEC;
    }
    const id = raw.id ?? raw._id ?? raw.Id ?? raw.ID;
    const dateCreation = raw.dateCreation ? new Date(raw.dateCreation) : undefined;
    const dateTraitement = raw.dateTraitement ? new Date(raw.dateTraitement) : undefined;
    const formatted: DemandeCEC = {
      ...raw,
      id: id ? String(id) : raw.id,
      dateCreation,
      dateTraitement,
      type: raw.type || 'nouvelle',
      statut: raw.statut || 'en_attente',
      assignedAdmin: raw.assignedAdmin ? String(raw.assignedAdmin) : undefined
    };
    return formatted;
  }

  private upsertDemande(demande: DemandeCEC): { created: boolean; previousStatut?: DemandeCEC['statut'] } {
    const index = this.demandes.findIndex(d => d.id === demande.id);
    if (index === -1) {
      this.demandes.push({ ...demande });
      return { created: true };
    }

    const previousStatut = this.demandes[index].statut;
    this.demandes[index] = { ...this.demandes[index], ...demande };
    return { created: false, previousStatut };
  }

  private removeDemande(id?: string | null): DemandeCEC | null {
    if (!id) {
      return null;
    }
    const index = this.demandes.findIndex(d => d.id === id);
    if (index === -1) {
      return null;
    }
    const [removed] = this.demandes.splice(index, 1);
    this.demandesFiltrees = this.demandesFiltrees.filter(d => d.id !== id);
    return removed ?? null;
  }

  private sortDemandes(): void {
    const sorter = (a: DemandeCEC, b: DemandeCEC) => {
      const aTime = a?.dateCreation ? new Date(a.dateCreation).getTime() : 0;
      const bTime = b?.dateCreation ? new Date(b.dateCreation).getTime() : 0;
      return bTime - aTime;
    };
    this.demandes.sort(sorter);
  }

  private applyFiltersAfterMutation(): void {
    const filtered = this.demandes.filter(d => this.matchesFilters(d) && this.isVisibleToCurrentAdmin(d));
    this.demandesFiltrees = [...filtered];
  }

  private matchesFilters(demande: DemandeCEC): boolean {
    const statutOk = !this.filtreStatut || demande.statut === this.filtreStatut;
    const typeOk = !this.filtreType || demande.type === this.filtreType;
    return statutOk && typeOk;
  }

  private isVisibleToCurrentAdmin(demande: DemandeCEC): boolean {
    if (!demande) return false;
    if (demande.statut !== 'en_cours_traitement') {
      return true;
    }
    const assignedAdmin = (demande as any).assignedAdmin ? String((demande as any).assignedAdmin) : null;
    const viewerId = this.currentUser?.id ?? null;
    if (assignedAdmin && viewerId && assignedAdmin !== viewerId) {
      return false;
    }
    return true;
  }

  private incrementStatCount(statut?: DemandeCEC['statut']): void {
    const key = this.mapStatKey(statut);
    if (!key) return;
    const nextValue = (this.statistiques[key] ?? 0) + 1;
    this.updateStats({ [key]: nextValue } as Partial<typeof this.statistiques>);
  }

  private decrementStatCount(statut?: DemandeCEC['statut']): void {
    const key = this.mapStatKey(statut);
    if (!key) return;
    const current = this.statistiques[key] ?? 0;
    const nextValue = current > 0 ? current - 1 : 0;
    this.updateStats({ [key]: nextValue } as Partial<typeof this.statistiques>);
  }

  private updateStatsForTransition(previous?: DemandeCEC['statut'], next?: DemandeCEC['statut']): void {
    if (previous && previous !== next) {
      this.decrementStatCount(previous);
    }
    if (next) {
      this.incrementStatCount(next);
    }
  }

  private ensurePaginationBounds(): void {
    const totalCount = this.total || this.demandes.length;
    this.totalPages = Math.max(1, Math.ceil(totalCount / this.limit));
    if (this.page > this.totalPages) {
      this.page = this.totalPages;
    }
    if (this.page < 1) {
      this.page = 1;
    }
    this.pageSizeOptions = this.buildPageSizeOptions(totalCount);
  }

  private mapStatKey(statut?: DemandeCEC['statut']): 'enAttente' | 'enCours' | 'validees' | 'rejetees' | null {
    switch (statut) {
      case 'en_attente':
        return 'enAttente';
      case 'en_cours_traitement':
        return 'enCours';
      case 'validee':
        return 'validees';
      case 'rejetee':
        return 'rejetees';
      default:
        return null;
    }
  }

  private updateStats(partial: Partial<typeof this.statistiques>): void {
    this.statistiques = {
      total: partial.total ?? this.statistiques.total,
      enAttente: partial.enAttente ?? this.statistiques.enAttente,
      enCours: partial.enCours ?? this.statistiques.enCours,
      validees: partial.validees ?? this.statistiques.validees,
      rejetees: partial.rejetees ?? this.statistiques.rejetees
    };
  }

  /**
   * Appliquer les filtres
   */
  onFiltreChange(): void {
    this.filtrerDemandes();
  }

  /**
   * Réinitialiser les filtres
   */
  resetFiltres(): void {
    this.filtreStatut = '';
    this.filtreType = '';
    this.page = 1;
    this.loadDemandes();
  }

  /**
   * Afficher un message à l'utilisateur
   */
  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    if (type === 'success') return this.notify.success(message);
    if (type === 'error') return this.notify.error(message);
    return this.notify.info(message);
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.authService.logout();
  }

  toggleProfile(): void {
    this.showProfile = !this.showProfile;
  }

  /** Rafraîchir la page (au clic sur le titre/icône) */
  refreshPage(): void {
    window.location.reload();
  }
}