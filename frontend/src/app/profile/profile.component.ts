import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, RouterModule],
  template: `
    <div class="profile-container">
      <mat-card class="profile-card">
        <div class="profile-header">
          <mat-icon class="avatar">person</mat-icon>
          <div class="identity">
            <h2>{{ user?.prenom }} {{ user?.nom }}</h2>
            <p>{{ user?.email }}</p>
          </div>
        </div>
        <mat-card-content>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Rôle</span>
              <span class="value">{{ user?.role || 'handicap' }}</span>
            </div>
            @if (profile?.telephone) {
              <div class="info-item">
                <span class="label">Téléphone</span>
                <span class="value">{{ profile?.telephone }}</span>
              </div>
            }
            @if (profile?.adresse) {
              <div class="info-item">
                <span class="label">Adresse</span>
                <span class="value">{{ profile?.adresse }}</span>
              </div>
            }
            @if (profile?.dateNaissance; as dn) {
              <div class="info-item">
                <span class="label">Date de naissance</span>
                <span class="value">{{ dn | date:'dd/MM/yyyy' }}</span>
              </div>
            }
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-stroked-button color="primary" routerLink="/handicap-dashboard">
            <mat-icon>arrow_back</mat-icon>
            Retour au dashboard
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .profile-container { padding: 16px; display: flex; justify-content: center; }
    .profile-card { width: 100%; max-width: 720px; background: #fff; color: var(--text-primary); }
    .profile-header { display: flex; align-items: center; gap: 16px; padding: 16px 16px 0; }
    .avatar { font-size: 48px; height: 48px; width: 48px; }
    .identity h2 { margin: 0; color: var(--text-primary); }
    .identity p { margin: 2px 0 0; color: var(--text-secondary); }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; padding: 8px 0; }
    .info-item { display: flex; flex-direction: column; padding: 8px 12px; border-radius: 8px; background: rgba(0,0,0,0.03); }
    .label { font-size: 12px; color: rgba(0,0,0,0.6); }
    .value { font-weight: 600; }
  `]
})
export class ProfileComponent implements OnInit {
  user: any;
  profile: any;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser?.() || null;
    this.authService.getProfile?.().subscribe({
      next: (res: any) => {
        this.profile = res?.data?.user || res?.user || null;
      },
      error: () => {
        this.profile = null;
      }
    });
  }
}
