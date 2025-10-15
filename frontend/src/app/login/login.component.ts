/**
 * Composant de connexion
 * Gère l'authentification des utilisateurs (handicapés et administrateurs)
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';
import { SocketService } from '../services/socket.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  // Formulaire de connexion
  loginForm: FormGroup;
  
  // États du composant
  isLoading = false;
  hidePassword = true;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private socketService: SocketService,
    private router: Router
  ) {
    // Initialisation du formulaire avec validation
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      motDePasse: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    // Vérifier si l'utilisateur est déjà connecté
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      if (user) {
        this.redirectToDashboard(user.role);
      }
    }

    // Nettoyer les messages au changement des champs
    this.loginForm.valueChanges.subscribe(() => {
      this.clearMessages();
    });
  }

  /**
   * Soumission du formulaire de connexion
   */
  onSubmit(): void {
    if (this.loginForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.clearMessages();

      const { email, motDePasse } = this.loginForm.value;

      // Appel au service d'authentification
      this.authService.login(email, motDePasse).subscribe({
        next: (response) => {
          this.isLoading = false;
          
          if (response.success) {
            this.successMessage = response.message;

            // Connecter Socket.IO après connexion réussie
            this.socketService.connect();
            this.socketService.identify(
              response.data.user.id,
              response.data.user.role
            );

            // Redirection automatique gérée par AuthService
            console.log('✅ Connexion réussie:', response.data.user);
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Erreur de connexion:', error);
          
          // Afficher le message d'erreur approprié
          if (error.error?.message) {
            this.errorMessage = error.error.message;
          } else if (error.status === 401) {
            this.errorMessage = 'Email ou mot de passe incorrect';
          } else if (error.status === 0) {
            this.errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
          } else {
            this.errorMessage = 'Une erreur est survenue lors de la connexion';
          }
        }
      });
    } else {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      this.markFormGroupTouched();
    }
  }

  /**
   * Redirection vers le dashboard approprié selon le rôle
   */
  private redirectToDashboard(role: string): void {
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin-dashboard']);
        break;
      case 'handicap':
        this.router.navigate(['/handicap-dashboard']);
        break;
      default:
        console.warn('⚠️ Rôle utilisateur non reconnu:', role);
        break;
    }
  }

  /**
   * Nettoie les messages d'erreur et de succès
   */
  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Marque tous les champs du formulaire comme touchés
   * Utile pour afficher les erreurs de validation
   */
  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  /**
   * Vérifie si un champ spécifique a une erreur et a été touché
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Obtient le message d'erreur pour un champ spécifique
   */
  getFieldErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName === 'email' ? 'L\'email' : 'Le mot de passe'} est requis`;
      }
      if (field.errors['email']) {
        return 'Format d\'email invalide';
      }
      if (field.errors['minlength']) {
        return 'Le mot de passe doit contenir au moins 8 caractères';
      }
    }
    return '';
  }
}