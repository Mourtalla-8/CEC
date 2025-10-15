/**
 * Composant Dashboard Handicap
 * Interface principale pour les utilisateurs handicapés
 */

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { RouterModule, Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavigationEnd } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { DemandeService } from '../services/demande.service';
import { UploadService } from '../services/upload.service';
import { SocketService } from '../services/socket.service';
import { DemandeCEC, CreateDemandeRequest, EligibilityData } from '../models/demande.model';
import { Document } from '../models/document.model';
import { User, UserHandicap } from '../models/user.model';
import { NotificationService } from '../shared/services/notification.service';
import { RealtimeBusService } from '../shared/services/realtime-bus.service';
import { CarteUpdatedEvent, DemandeRealtimeEvent, DocumentUploadedEvent } from '../models/realtime-events.model';
// Removed MatDatepickerInput (not used directly in template)

@Component({
  selector: 'app-handicap-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatChipsModule,
    MatMenuModule,
    MatDividerModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatNativeDateModule,
    RouterModule,
    RouterLink,
    
  ],
  templateUrl: './handicap-dashboard.component.html',
  styleUrls: ['./handicap-dashboard.component.css']
})
export class HandicapDashboardComponent implements OnInit, OnDestroy {
  // Données utilisateur
  currentUser?: User;
  showProfile = false;

  // Données des demandes
  demandes: DemandeCEC[] = [];
  demandesFiltrees: DemandeCEC[] = [];
  documents: Document[] = [];

  // États du composant
  isLoading = false;
  isCreatingDemande = false;
  isUploadingDocument = false;
  isDragOver = false;
  eligibility?: EligibilityData;
  hasCarte = false;
  carte?: { id: string; numeroCarte: string; dateDelivrance: string; dateExpiration: string; statut: string; nombreRenouvellements: number } | null;
  isLoadingCarte = false;
  isInDetail = false;
  selectedTab = 0; // 0: demandes, 1: documents
  @ViewChild(MatTabGroup) tabGroup?: MatTabGroup;

  // Pagination (client-side)
  page = 1;
  limit = 10;
  total = 0;
  totalPages = 1;
  pageSizeOptions: number[] = [10, 20, 50];
  private hasUserSetPageSize = false;

  // Upload unique avec sélection de type
  selectedDocType: string | null = null;
  allowedDocTypes: { value: string; label: string; disabled?: boolean }[] = [];
  lockAllActions = false; // verouiller actions si une demande en attente existe
  private userAgeYears: number | null = null;
  profile?: Partial<UserHandicap>;

  get isCarteExpiringSoon(): boolean {
    if (!this.carte?.dateExpiration) return false;
    const now = new Date();
    const inThreeMonths = new Date(now);
    inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);
    const exp = new Date(this.carte.dateExpiration);
    return exp <= inThreeMonths;
  }

  onDragOver(event: DragEvent): void {
    if (!this.selectedDocType || this.isUploadingDocument || this.lockAllActions) return;
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    if (!this.selectedDocType) return;
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    if (!this.selectedDocType || this.isUploadingDocument || this.lockAllActions) return;
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const inputEvent: any = { target: { files: [file] } };
    this.onSingleFileSelected(inputEvent);
  }

  onCertificatPerteSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    this.isUploadingDocument = true;
    const sub = this.uploadService.uploadDocument(file, 'certificat_perte').subscribe({
      next: (response) => {
        this.isUploadingDocument = false;
        if (response.success) {
          this.showMessage('Certificat de perte uploadé avec succès !', 'success');
          this.loadDocuments();
          this.loadEligibility();
        }
      },
      error: (error) => {
        this.isUploadingDocument = false;
        console.error('❌ Erreur upload certificat de perte:', error);
        this.showMessage('Erreur lors de l\'upload du certificat de perte', 'error');
      }
    });
    this.subscriptions.push(sub);
  }

  // Appliquer la tranche courante sur demandes
  private applyPageSlice(): void {
    if (!Array.isArray(this.demandes)) {
      this.demandesFiltrees = [];
      return;
    }
    const start = (this.page - 1) * this.limit;
    const end = start + this.limit;
    this.demandesFiltrees = this.demandes.slice(start, end);
  }

  changePageSize(newLimit: number): void {
    this.limit = Number(newLimit) || 10;
    this.hasUserSetPageSize = true;
    this.page = 1;
    this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));
    this.applyPageSlice();
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.applyPageSlice();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.applyPageSlice();
    }
  }

  goToFirstPage(): void {
    if (this.page !== 1) {
      this.page = 1;
      this.applyPageSlice();
    }
  }

  goToLastPage(): void {
    if (this.page !== this.totalPages) {
      this.page = this.totalPages;
      this.applyPageSlice();
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

  onDemandeManuscriteSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    this.isUploadingDocument = true;
    const sub = this.uploadService.uploadDocument(file, 'demande_manuscrite').subscribe({
      next: (response) => {
        this.isUploadingDocument = false;
        if (response.success) {
          this.showMessage('Demande manuscrite uploadée avec succès !', 'success');
          this.loadDocuments();
          this.loadEligibility();
        }
      },
      error: (error) => {
        this.isUploadingDocument = false;
        console.error('❌ Erreur upload demande manuscrite:', error);
        this.showMessage('Erreur lors de l\'upload de la demande manuscrite', 'error');
      }
    });
    this.subscriptions.push(sub);
  }

  // Helpers pour documents spéciaux de la demande
  get hasDemandeManuscrite(): boolean {
    return (this.documents || []).some(d => (d.type as string) === 'demande_manuscrite' || (d.typeDocument as string) === 'demande_manuscrite');
  }

  onRowClick(row: DemandeCEC): void {
    if (!row?.id) return;
    this.router.navigate(['demandes', row.id], { relativeTo: this.route });
  }
  get hasCertificatPerte(): boolean {
    return (this.documents || []).some(d => (d.type as string) === 'certificat_perte' || (d.typeDocument as string) === 'certificat_perte');
  }

  // Formulaires
  demandeForm: FormGroup;

  // Colonnes du tableau des demandes
  displayedColumns: string[] = ['numeroDemande', 'type', 'statut', 'dateCreation'];

  // Subscriptions pour éviter les fuites mémoire
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private demandeService: DemandeService,
    private uploadService: UploadService,
    private socketService: SocketService,
    private notify: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private realtimeBus: RealtimeBusService
  ) {
    // Initialisation du formulaire de demande
    this.demandeForm = this.fb.group({
      type: ['nouvelle', Validators.required],
      ancienNumero: [''],
      ancienneDateExpiration: ['']
    });
  }

  /**
   * Upload via le sélecteur unique
   */
  onSingleFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file || !this.selectedDocType) return;
    this.isUploadingDocument = true;

    const sub = this.uploadService.uploadDocument(file, this.selectedDocType).subscribe({
      next: (response) => {
        this.isUploadingDocument = false;
        if (response.success) {
          this.showMessage('Document uploadé avec succès !', 'success');
          this.selectedDocType = null;
          this.loadDocuments();
          this.loadEligibility();
        }
      },
      error: (error) => {
        this.isUploadingDocument = false;
        console.error('❌ Erreur lors de l\'upload:', error);
        this.showMessage('Erreur lors de l\'upload du document', 'error');
      }
    });

    this.subscriptions.push(sub);
  }

  ngOnInit(): void {
    // Récupérer les informations utilisateur
    this.currentUser = this.authService.getCurrentUser();

    // Charger les données initiales
    this.loadDemandes();
    this.loadDocuments();
    this.loadEligibility();
    this.loadProfile();

    // Écouter les notifications Socket.IO
    this.setupSocketListeners();

    // Déterminer si on est dans la vue détail (route enfant)
    const updateInDetail = () => {
      const url = this.router.url || '';
      this.isInDetail = /\/handicap-dashboard\/demandes\/.+/.test(url);
    };
    updateInDetail();
    const subNav = this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) updateInDetail();
    });
    this.subscriptions.push(subNav);

    // Listen to fragment to select correct tab
    const subFrag = this.route.fragment.subscribe(fragment => {
      if (fragment === 'documents') this.selectedTab = 1;
      else if (fragment === 'demandes') this.selectedTab = 0;
      // 'carte' doesn't change tab, just anchor target
    });
    this.subscriptions.push(subFrag);

    // Gérer les changements du type de demande
    this.demandeForm.get('type')?.valueChanges.subscribe(type => {
      if (type === 'renouvellement') {
        this.demandeForm.get('ancienNumero')?.setValidators([Validators.required]);
        this.demandeForm.get('ancienneDateExpiration')?.setValidators([Validators.required]);
      } else {
        this.demandeForm.get('ancienNumero')?.clearValidators();
        this.demandeForm.get('ancienneDateExpiration')?.clearValidators();
      }
      this.demandeForm.get('ancienNumero')?.updateValueAndValidity();
      this.demandeForm.get('ancienneDateExpiration')?.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    // Nettoyer les subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
    const fragment = index === 1 ? 'documents' : 'demandes';
    this.router.navigate([], { fragment, relativeTo: this.route });
  }


  /**
   * Charger la liste des demandes de l'utilisateur
   */
  loadDemandes(): void {
    this.isLoading = true;

    const sub = this.demandeService.getMyDemandes().subscribe({
      next: (response) => {
        if (response.success) {
          this.demandes = Array.isArray(response.data.demandes)
            ? response.data.demandes
            : [];
          console.log('✅ Demandes chargées:', this.demandes);
          // Verrouiller actions si une demande est en attente OU en cours de traitement
          this.lockAllActions = this.demandes.some(d => d.statut === 'en_attente' || d.statut === 'en_cours_traitement');
          // Déduire la présence d'une carte si une demande a été validée
          const hasValidated = this.demandes.some(d => d.statut === 'validee');
          if (hasValidated) this.hasCarte = true;

          // Trier par date de création (plus récentes en haut)
          this.demandes.sort((a: any, b: any) => {
            const ad = a?.dateCreation ? new Date(a.dateCreation).getTime() : 0;
            const bd = b?.dateCreation ? new Date(b.dateCreation).getTime() : 0;
            return bd - ad;
          });

          // Mettre à jour pagination (client)
          this.total = this.demandes.length;
          this.pageSizeOptions = this.buildPageSizeOptions(this.total);
          // Par défaut (premier chargement), forcer la plus petite option
          if (!this.hasUserSetPageSize) {
            this.limit = Math.min(...this.pageSizeOptions);
          } else if (this.limit > this.total || !this.pageSizeOptions.includes(this.limit)) {
            // Corriger la limite si elle n'est pas valide ou supérieure au total
            this.limit = Math.min(...this.pageSizeOptions);
          }
          this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));
          if (this.page > this.totalPages) this.page = this.totalPages;
          this.applyPageSlice();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur lors du chargement des demandes:', error);
        this.notify.error('Erreur lors du chargement des demandes');
        this.isLoading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Charger le profil utilisateur pour calculer l'âge et adapter les types requis
   */
  private loadProfile(): void {
    const sub = this.authService.getProfile().subscribe({
      next: (res) => {
        const u = res?.data?.user || res?.user || {};
        this.profile = {
          nom: u.nom,
          prenom: u.prenom,
          sexe: u.sexe,
          dateNaissance: u.dateNaissance,
          typeHandicap: u.typeHandicap,
          adresse: u.adresse,
          telephone: u.telephone,
          email: u.email
        } as any;
        const dobStr = this.profile?.dateNaissance as any;
        if (dobStr) {
          const dob = new Date(dobStr);
          this.userAgeYears = this.computeAgeYears(dob);
        }
        this.buildAllowedDocTypes();
      },
      error: () => {
        // Si échec, construire quand même avec valeurs par défaut
        this.buildAllowedDocTypes();
      }
    });
    this.subscriptions.push(sub);
  }

  private computeAgeYears(dob: Date): number {
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  /**
   * Construit la liste des types disponibles en fonction de l'âge et de l'éligibilité
   */
  private buildAllowedDocTypes(): void {
    const isMinor = this.userAgeYears !== null ? this.userAgeYears < 18 : false;
    const requireCNI = !isMinor;
    const requireBirth = isMinor;

    const labels: Record<string, string> = {
      photo_identite_1: 'Photo identité 1',
      photo_identite_2: 'Photo identité 2',
      extrait_naissance: "Extrait de naissance",
      cni_recto: 'CNI - Recto',
      cni_verso: 'CNI - Verso',
      certificat_residence: 'Certificat de résidence',
      certificat_invalidite: "Certificat d'invalidité",
      justificatif_domicile: 'Justificatif de domicile',
      // Types spéciaux retirés du sélecteur: gérés dans l'onglet demande
      // demande_manuscrite: 'Demande manuscrite (nouvelle)',
      // certificat_perte: 'Certificat de perte (renouvellement)'
    };

    const baseOrder = [
      'photo_identite_1',
      'photo_identite_2',
      'extrait_naissance',
      'cni_recto',
      'cni_verso',
      'certificat_residence',
      'certificat_invalidite',
      'justificatif_domicile'
    ];

    const presentTypes = new Set((this.documents || []).map(d => (d.type as string) || (d.typeDocument as string)));

    // Construire la liste en excluant les types déjà fournis et ceux exclus par l'âge
    this.allowedDocTypes = baseOrder
      .filter(key => !presentTypes.has(key))
      .filter(key => {
        if (key === 'extrait_naissance' && !requireBirth) return false;
        if ((key === 'cni_recto' || key === 'cni_verso') && !requireCNI) return false;
        return true;
      })
      .map(key => ({ value: key, label: labels[key] }));
  }

  get hasAddableDocTypes(): boolean {
    return Array.isArray(this.allowedDocTypes) && this.allowedDocTypes.length > 0;
  }

  /**
   * Charger la liste des documents de l'utilisateur
   */
  loadDocuments(): void {
    const sub = this.uploadService.getMyDocuments().subscribe({
      next: (response) => {
        if (response.success) {
          this.documents = (response.data.documents || []).sort((a: any, b: any) => {
            const ad = a?.dateUpload ? new Date(a.dateUpload).getTime() : 0;
            const bd = b?.dateUpload ? new Date(b.dateUpload).getTime() : 0;
            return bd - ad;
          });
          console.log('✅ Documents chargés:', this.documents);
          // Reconstruire les types pour griser ceux déjà fournis
          this.buildAllowedDocTypes();
        }
      },
      error: (error) => {
        console.error('❌ Erreur lors du chargement des documents:', error);
        this.notify.error('Erreur lors du chargement des documents');
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Charger l'éligibilité
   */
  loadEligibility(): void {
    const sub = this.demandeService.getEligibility().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.eligibility = res.data;
          this.carte = (this.eligibility as any)?.carte || null;
          console.log('ℹ️ Carte depuis eligibility:', this.carte);
          // Conserver true si déjà déduit par les demandes validées
          // et considérer la présence de la carte même si canRenew est faux (documents manquants)
          this.hasCarte = this.hasCarte || !!this.carte || !!this.eligibility?.canRenew;
          // Re-construire les types disponibles selon les nouvelles règles
          this.buildAllowedDocTypes();
          // Pré-sélectionner le type de demande pour afficher l'upload spécial
          const typeCtrl = this.demandeForm?.get('type');
          if (typeCtrl && !typeCtrl.value) {
            typeCtrl.setValue(this.hasCarte ? 'renouvellement' : 'nouvelle');
          }
          // Toujours récupérer la carte directement pour garantir les données à jour
          this.loadCarte();
        }
      },
      error: (err: any) => {
        console.error('❌ Erreur éligibilité:', err);
      }
    });
    this.subscriptions.push(sub);
  }

  /**
   * Créer une nouvelle demande
   */
  createDemande(): void {
    if (this.lockAllActions) {
      this.notify.info('Actions verrouillées: une demande est déjà en cours.');
      return;
    }
    if (this.demandeForm.valid && !this.isCreatingDemande) {
      // Empêcher une nouvelle demande si l'utilisateur a déjà une carte
      if (this.hasCarte && this.demandeForm.get('type')?.value === 'nouvelle') {
        this.notify.error('Vous possédez déjà une Carte CEC. Seul le renouvellement est autorisé.');
        return;
      }
      this.isCreatingDemande = true;

      const formValue = this.demandeForm.value;
      const demandeData: CreateDemandeRequest = {
        // backend attend 'nouvelle' | 'renouvellement'
        type: formValue.type
      };

      // Ajouter les informations de l'ancienne carte si renouvellement
      if (formValue.type === 'renouvellement') {
        demandeData.ancienneCarte = {
          numero: formValue.ancienNumero,
          dateExpiration: formValue.ancienneDateExpiration
        };
      }

      const sub = this.demandeService.createDemande(demandeData).subscribe({
        next: (response) => {
          this.isCreatingDemande = false;

          if (response.success) {
            this.notify.success('Demande créée avec succès !');
            this.demandeForm.reset({ type: 'nouvelle' });
            this.loadDemandes(); // Recharger la liste
            this.loadEligibility();
          }
        },
        error: (error) => {
          this.isCreatingDemande = false;
          console.error('❌ Erreur lors de la création de la demande:', error);
          this.notify.error('Erreur lors de la création de la demande');
        }
      });

      this.subscriptions.push(sub);
    }
  }

  /** Créer automatiquement une première demande */
  createFirstDemande(): void {
    if (this.isCreatingDemande || this.lockAllActions) return;
    if (!this.eligibility?.canCreate) {
      this.notify.error('Documents manquants pour créer une demande.');
      return;
    }
    this.isCreatingDemande = true;
    const payload: CreateDemandeRequest = { type: 'nouvelle' } as any;
    const sub = this.demandeService.createDemande(payload).subscribe({
      next: (response) => {
        this.isCreatingDemande = false;
        if (response.success) {
          this.notify.success('Demande créée avec succès !');
          this.loadDemandes();
          this.loadEligibility();
          this.loadCarte();
        }
      },
      error: (error) => {
        this.isCreatingDemande = false;
        console.error('❌ Erreur création demande:', error);
        this.notify.error('Erreur lors de la création de la demande');
      }
    });
    this.subscriptions.push(sub);
  }

  /** Créer automatiquement une demande de renouvellement */
  renewCarte(): void {
    if (this.isCreatingDemande || this.lockAllActions) return;
    if (!this.eligibility?.canRenew || !this.carte) {
      this.notify.error('Renouvellement non disponible. Vérifiez vos documents.');
      return;
    }
    this.isCreatingDemande = true;
    const payload: CreateDemandeRequest = {
      type: 'renouvellement',
      ancienneCarte: {
        numero: String(this.carte.numeroCarte),
        dateExpiration: new Date(this.carte.dateExpiration as any).toISOString()
      }
    } as any;
    const sub = this.demandeService.createDemande(payload).subscribe({
      next: (response) => {
        this.isCreatingDemande = false;
        if (response.success) {
          this.notify.success('Demande de renouvellement créée !');
          this.loadDemandes();
          this.loadEligibility();
          this.loadCarte();
        }
      },
      error: (error) => {
        this.isCreatingDemande = false;
        console.error('❌ Erreur renouvellement:', error);
        const msg = error?.error?.message || error?.message || 'Erreur lors de la création du renouvellement';
        this.notify.error(msg);
      }
    });
    this.subscriptions.push(sub);
  }

  /**
   * Supprimer une demande
   */
  deleteDemande(demande: DemandeCEC): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette demande ?')) {
      const sub = this.demandeService.deleteDemande(demande.id!).subscribe({
        next: (response) => {
          if (response.success) {
            this.notify.success('Demande supprimée avec succès !');
            this.loadDemandes();
          }
        },
        error: (error) => {
          console.error('❌ Erreur lors de la suppression:', error);
          this.notify.error('Erreur lors de la suppression');
        }
      });

      this.subscriptions.push(sub);
    }
  }

  /**
   * Upload d'un document
   */
  onFileSelected(event: any, typeDocument: string): void {
    const file = event.target.files[0];
    if (file) {
      this.isUploadingDocument = true;

      const sub = this.uploadService.uploadDocument(file, typeDocument).subscribe({
        next: (response) => {
          this.isUploadingDocument = false;

          if (response.success) {
            this.notify.success('Document uploadé avec succès !');
            this.loadDocuments(); // Recharger la liste des documents
          }
        },
        error: (error) => {
          this.isUploadingDocument = false;
          console.error('❌ Erreur lors de l\'upload:', error);
          this.notify.error('Erreur lors de l\'upload du document');
        }
      });

      this.subscriptions.push(sub);
    }
  }

  download(documentId: string): void {
    this.uploadService.downloadDocument(documentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document'; // tu peux mettre doc.nom si tu l’as dans le tableau
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('❌ Erreur téléchargement:', error);
        this.notify.error('Erreur lors du téléchargement du document');
      }
    });
  }

  // Suppression désactivée par les nouvelles règles

  replaceDocument(event: any, documentId: string, typeDocument: string): void {
    const file = event.target.files[0];
    if (file) {
      this.isUploadingDocument = true;

      const sub = this.uploadService.uploadDocument(file, typeDocument).subscribe({
        next: (response) => {
          this.isUploadingDocument = false;

          if (response.success) {
            this.notify.success('Document remplacé avec succès');
            this.loadDocuments();
            this.loadEligibility();
          }
        },
        error: (error) => {
          this.isUploadingDocument = false;
          console.error('❌ Erreur lors du remplacement:', error);
          this.notify.error('Erreur lors du remplacement du document');
        }
      });

      this.subscriptions.push(sub);
    }
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
   * Configuration des listeners Socket.IO
   */
  private setupSocketListeners(): void {
    const subCreated = this.realtimeBus.demandeCreated$.subscribe(event => {
      if (this.isCurrentUserDemandeEvent(event)) {
        this.onOwnDemandeCreated(event);
      }
    });
    const subUpdated = this.realtimeBus.demandeUpdated$.subscribe(event => {
      if (this.isCurrentUserDemandeEvent(event)) {
        this.onOwnDemandeUpdated(event);
      }
    });
    const subStatus = this.realtimeBus.demandeStatusChanged$.subscribe(event => {
      if (this.isCurrentUserDemandeEvent(event)) {
        this.onOwnDemandeStatusChanged(event);
      }
    });
    const subDeleted = this.realtimeBus.demandeDeleted$.subscribe(event => {
      if (this.isCurrentUserDemandeEvent(event)) {
        this.onOwnDemandeDeleted(event);
      }
    });
    const subDocument = this.realtimeBus.documentUploaded$.subscribe(event => {
      if (this.isCurrentUserDocumentEvent(event)) {
        this.onOwnDocumentUploaded(event);
      }
    });
    const subCarte = this.realtimeBus.carteUpdated$.subscribe(event => {
      this.onCarteUpdated(event);
    });

    this.subscriptions.push(subCreated, subUpdated, subStatus, subDeleted, subDocument, subCarte);
  }

  private isCurrentUserDemandeEvent(event: DemandeRealtimeEvent | null | undefined): boolean {
    if (!event || !event.demande) return false;
    const ownerId = event.demande.utilisateur?.id;
    const currentId = this.currentUser?.id;
    return !ownerId || (currentId ? ownerId === currentId : false);
  }

  private isCurrentUserDocumentEvent(event: DocumentUploadedEvent | null | undefined): boolean {
    if (!event) return false;
    const ownerId = event.utilisateur?.id;
    const currentId = this.currentUser?.id;
    return !ownerId || (currentId ? ownerId === currentId : false);
  }

  private onOwnDemandeCreated(event: DemandeRealtimeEvent): void {
    const numero = event.demande?.numeroDemande;
    if (numero) {
      this.showMessage(`Demande ${numero} enregistrée`, 'success');
    }
    this.refreshDemandeData();
  }

  private onOwnDemandeUpdated(event: DemandeRealtimeEvent): void {
    if (event.statutChanged) {
      this.onOwnDemandeStatusChanged(event);
      return;
    }
    const numero = event.demande?.numeroDemande;
    if (numero && event.commentaireChange) {
      this.showMessage(`Commentaires mis à jour pour ${numero}`, 'info');
    }
    this.refreshDemandeData(false);
  }

  private onOwnDemandeStatusChanged(event: DemandeRealtimeEvent): void {
    const numero = event.demande?.numeroDemande;
    const statut = event.statut || event.demande?.statut;
    if (numero && statut) {
      this.showMessage(`Votre demande ${numero} est maintenant ${this.getStatutLabel(statut)}`, 'info');
    }
    if (event.motifRejet) {
      this.showMessage(`Motif: ${event.motifRejet}`, 'info');
    }
    this.refreshDemandeData();
  }

  private onOwnDemandeDeleted(event: DemandeRealtimeEvent): void {
    const numero = event.demande?.numeroDemande;
    if (numero) {
      this.showMessage(`Votre demande ${numero} a été supprimée`, 'info');
    }
    this.refreshDemandeData();
  }

  private onOwnDocumentUploaded(event: DocumentUploadedEvent): void {
    const label = event.document?.filename || event.document?.type;
    if (label) {
      this.showMessage(`Document mis à jour: ${label}`, 'info');
    }
    this.loadDocuments();
    this.loadEligibility();
  }

  private onCarteUpdated(event: CarteUpdatedEvent): void {
    if (event?.numeroCarte) {
      this.showMessage(`Votre carte CEC ${event.numeroCarte} est à jour`, 'success');
    }
    this.loadCarte();
  }

  private refreshDemandeData(refreshCarte: boolean = true): void {
    this.loadDemandes();
    this.loadEligibility();
    if (refreshCarte) {
      this.loadCarte();
    }
  }

  /** Charger la carte CEC depuis l'API dédiée */
  private loadCarte(): void {
    this.isLoadingCarte = true;
    const sub = this.demandeService.getMyCarte().subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.carte = res.data || null;
          this.hasCarte = this.hasCarte || !!this.carte;
        }
        this.isLoadingCarte = false;
      },
      error: (e) => {
        console.warn('⚠️ Impossible de récupérer la carte:', e);
        this.isLoadingCarte = false;
      }
    });
    this.subscriptions.push(sub);
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

  /** Rafraîchir la page (au clic sur le titre) */
  refreshPage(): void {
    window.location.reload();
  }

  /**
   * TrackBy function pour optimiser le rendu de la liste des documents
   */
  trackByDocumentId(index: number, document: Document): string {
    return document.id || index.toString();
  }

  /** Transformer un type technique en libellé lisible */
  prettyType(key: string | undefined | null): string {
    if (!key) return '—';
    const map: Record<string, string> = {
      photo_identite_1: 'Photo identité 1',
      photo_identite_2: 'Photo identité 2',
      extrait_naissance: 'Extrait de naissance',
      cni_recto: 'CNI - Recto',
      cni_verso: 'CNI - Verso',
      certificat_residence: 'Certificat de résidence',
      certificat_invalidite: "Certificat d'invalidité",
      justificatif_domicile: 'Justificatif de domicile',
      demande_manuscrite: 'Demande manuscrite',
      certificat_perte: 'Certificat de perte'
    };
    if (map[key]) return map[key];
    // fallback: replace underscores and capitalize words
    return String(key)
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}