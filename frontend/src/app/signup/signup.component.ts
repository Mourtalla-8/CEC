import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';
import { SignupData } from '../models/user.model';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit, OnDestroy {
  currentStep = 1;

  // États
  isLoading = false;
  hidePassword = true;
  hideConfirmPassword = true;
  errorMessage = '';
  successMessage = '';
  userEmail = '';

  // Cooldown & blocage
  resendDisabled = false;
  resendCountdown = 0;
  countdownInterval: any;

  step1Form!: FormGroup;
  step2Form!: FormGroup;
  step3Form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      if (user?.role === 'handicap') this.router.navigate(['/handicap-dashboard']);
      else if (user?.role === 'admin') this.router.navigate(['/admin-dashboard']);
    }
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  private initializeForms(): void {
    this.step1Form = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      prenom: ['', [Validators.required, Validators.minLength(3)]],
      sexe: ['', Validators.required],
      dateNaissance: ['', Validators.required],
      typeHandicap: ['', Validators.required],
      adresse: ['', [Validators.required, Validators.minLength(10)]],
      telephone: ['', [Validators.required, Validators.pattern(/^7[0-9]{8}$/)]],
      email: ['', [Validators.required, Validators.email]]
    });

    this.step2Form = this.fb.group({
      code: ['', [
        Validators.required,
        Validators.pattern(/^[0-9]{6}$/)
      ]]
    });

    this.step3Form = this.fb.group({
      motDePasse: ['', [Validators.required, Validators.minLength(8)]],
      confirmerMotDePasse: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(group: AbstractControl): {[key: string]: any} | null {
    const password = group.get('motDePasse');
    const confirmPassword = group.get('confirmerMotDePasse');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      if(!confirmPassword.hasError('required')) confirmPassword.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  submitStep1(): void {
    if (!this.step1Form.valid || this.isLoading) {
      this.markFormGroupTouched(this.step1Form);
      return;
    }

    this.isLoading = true;
    this.clearMessages();

    const signupData: SignupData = { ...this.step1Form.value };
    this.userEmail = signupData.email;

    this.authService.signupInit(signupData).subscribe({
      next: (resp: any) => {
        this.isLoading = false;

        if (resp.success) {
          this.successMessage = resp.message;

          // Compte à rebours avant possibilité de renvoi
          this.startCountdown(resp.data?.cooldown ?? 60);

          if (resp.data?.codeVerification) {
            console.log('📱 Code de vérification (DEV) :', resp.data.codeVerification);
            console.log('⏰ Expire à :', new Date(resp.data.codeExpiresAt).toLocaleTimeString());
          }
          if (resp.data?.attempts) {
            console.log('Nombre de code envoye:', resp.data.attempts)
          }
          if (resp.data?.attemptsRemaining) {
            console.log('Tentative restante:', resp.data.attemptsRemaining)
          }

          setTimeout(() => {
            this.currentStep = 2;
            this.clearMessages();
          }, 1000);
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 429 && err.error?.blockedUntil) {
          this.resendDisabled = true;
          const unblockTime = new Date(err.error.unblockTime);
          this.errorMessage = `${err.error.message}. Réessayez après ${unblockTime.toLocaleTimeString()}`;
        } else this.handleError(err);
      }
    });
  }

  submitStep2(): void {
    if (!this.step2Form.valid || this.isLoading) {
      this.markFormGroupTouched(this.step2Form);
      return;
    }

    this.isLoading = true;
    this.clearMessages();

    const code = this.step2Form.value.code;
    this.authService.verifyCode(this.userEmail, code).subscribe({
      next: (resp: any) => {
        this.isLoading = false;
        if (resp.success) {
          this.successMessage = resp.message;
          setTimeout(() => {
            this.currentStep = 3;
            this.clearMessages();
          }, 800);
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 400 && err.error?.message) {
          this.errorMessage = err.error.message;
        } else this.handleError(err);
      }
    });
  }

  submitStep3(): void {
    if (this.step3Form.valid && !this.isLoading) {
      this.isLoading = true;
      this.clearMessages();

      const { motDePasse, confirmerMotDePasse } = this.step3Form.value;

      // Appel à l'API de création du mot de passe
      this.authService.setPassword(this.userEmail, motDePasse, confirmerMotDePasse).subscribe({
        next: (response) => {
          this.isLoading = false;

          if (response.success) {
            this.successMessage = 'Inscription terminée avec succès !';

            // Connexion automatique après inscription
            setTimeout(() => {
              // Appel au service d'authentification
              this.authService.login(this.userEmail, motDePasse).subscribe({
                next: (response) => {
                  this.isLoading = false;

                  if (response.success) {
                    this.successMessage = response.message;

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
            }, 2000);
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Erreur étape 3:', error);
          this.handleError(error);
        }
      });
    } else {
      this.markFormGroupTouched(this.step3Form);
    }
  }

  resendCode(): void {
    if (!this.userEmail || this.resendDisabled) return;

    this.isLoading = true;
    this.clearMessages();

    this.authService.resendCode(this.userEmail).subscribe({
      next: (resp: any) => {
        this.isLoading = false;
        this.successMessage = resp.message;

        this.startCountdown(resp.data?.cooldown ?? 60);

        if (resp.data?.codeVerification) {
          console.log('📱 Nouveau code (DEV) :', resp.data.codeVerification);
          console.log('⏰ Expire à :', new Date(resp.data.expiration).toLocaleTimeString());
        }
        if (resp.data?.attempts) {
          console.log('Nombre de code envoye:', resp.data.attempts)
        }
        if (resp.data?.attemptsRemaining) {
          console.log('Tentative restante:', resp.data.attemptsRemaining)
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 429 && err.error?.blockedUntil) {
          const unblockTime = new Date(err.error.unblockTime);
          this.errorMessage = `${err.error.message}. Réessayez après ${unblockTime.toLocaleTimeString()}`;
          this.startCountdown(err.error.remainingTime);
        } else if (err.status === 429) {
          this.errorMessage = `${err.error.message}`;
          this.startCountdown(err.error.remaining);
        } else this.handleError(err);
      }
    });
  }

  private startCountdown(seconds: number): void {
    this.resendDisabled = true;
    this.resendCountdown = seconds;
    clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.resendDisabled = false;
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  getResendButtonText(): string {
    return this.resendDisabled ? `Renvoyer dans ${this.resendCountdown}s` : 'Renvoyer le code';
  }

  goToPreviousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.clearMessages();
    }
  }

  private handleError(error: any): void {
    this.errorMessage = error.error?.message || 'Une erreur est survenue. Réessayez.';
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => formGroup.get(key)?.markAsTouched());
  }

  isFieldInvalid(formGroup: FormGroup, fieldName: string): boolean {
    const field = formGroup.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldErrorMessage(formGroup: FormGroup, fieldName: string): string {
    const field = formGroup.get(fieldName);
    if (!field?.errors) return '';
    if (field.errors['required']) return `Ce champ est requis`;
    if (field.errors['email']) return `Format d'email invalide`;
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères`;
    if (field.errors['pattern'] && fieldName === 'telephone') return `Format de téléphone invalide`;
    if (field.errors['pattern'] && fieldName === 'code') return `Le code doit contenir 6 chiffres`;
    if (field.errors['mismatch']) return `Les mots de passe ne correspondent pas`;
    return '';
  }
}
