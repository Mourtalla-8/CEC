/**
 * Service d'authentification
 * Gère la connexion, l'inscription et la gestion des tokens JWT
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  LoginResponse, 
  SignupData, 
  CodeVerification, 
  PasswordCreation,
  UserHandicap,
  UserAdmin 
} from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // URL de base de l'API d'authentification
  private apiUrl = `${environment.apiUrl}/auth`;
  
  // Subject pour suivre l'état de l'utilisateur connecté
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Initialiser l'utilisateur depuis localStorage
    this.initializeUser();
  }

  /**
   * Initialise l'utilisateur depuis localStorage
   * Restaure l'utilisateur depuis localStorage si disponible
   */
  private initializeUser(): void {
    try {
      const token = this.getToken();
      const savedUser = this.getSavedUser();
      
      if (token && savedUser) {
        this.currentUserSubject.next(savedUser);
        console.log('✅ Session restaurée:', savedUser);
      }
    } catch (error) {
      console.error('❌ Erreur initialisation utilisateur:', error);
      this.clearSession();
    }
  }


  /**
   * Sauvegarde l'utilisateur dans localStorage
   */
  private saveUser(user: any): void {
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (error) {
      console.error('Erreur sauvegarde utilisateur:', error);
    }
  }

  /**
   * Récupère l'utilisateur sauvé depuis localStorage
   */
  private getSavedUser(): any {
    try {
      const savedUser = localStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error('Erreur lecture utilisateur sauvé:', error);
      return null;
    }
  }

  /**
   * Nettoie complètement la session
   */
  private clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  /**
   * ÉTAPE 1 : Inscription initiale d'un utilisateur handicapé
   * Envoie les données personnelles et déclenche l'envoi du code de vérification
   */
  signupInit(userData: SignupData): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup-init`, userData);
  }

  /**
   * ÉTAPE 2 : Vérification du code reçu par SMS/email
   * Valide le code de vérification envoyé à l'utilisateur
   */
  verifyCode(email: string, code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-code`, { email, code });
  }


  resendCode(email: string) {
    return this.http.post(`${this.apiUrl}/resend-code`, { email });
  }


  /**
   * ÉTAPE 3 : Définition du mot de passe
   * Finalise l'inscription en créant le mot de passe
   */
  setPassword(email: string, motDePasse: string, confirmerMotDePasse: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/set-password`, {
      email,
      motDePasse,
      confirmerMotDePasse
    });
  }

  /**
   * Connexion d'un utilisateur (handicapé ou admin)
   * Authentifie l'utilisateur et stocke le token JWT
   */
  login(email: string, motDePasse: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
      email,
      motDePasse
    }).pipe(
      tap(response => {
        if (response.success) {
          console.log("!token")

          // Stocker le token dans localStorage
          localStorage.setItem('token', response.data.token);

          console.log("token stocke")

          // Sauvegarder et mettre à jour l'utilisateur connecté
          this.saveUser(response.data.user);
          this.currentUserSubject.next(response.data.user);

          console.log("user saved")
          
          // Rediriger selon le rôle
          this.redirectAfterLogin(response.data.user.role);

          console.log("redirect", response.data.user.role)
        }
      })
    );
  }

  /**
   * Demander la réinitialisation du mot de passe (étape 1)
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request-password-reset`, { email });
  }

  /**
   * Vérifier le code de réinitialisation (étape 2)
   */
  verifyResetCode(email: string, code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-reset-code`, { email, code });
  }

  /**
   * Réinitialiser le mot de passe (étape 3)
   */
  resetPassword(email: string, motDePasse: string, confirmerMotDePasse: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { 
      email,
      motDePasse, 
      confirmerMotDePasse 
    });
  }

  /**
   * Renvoyer le code de réinitialisation
   */
  resendResetCode(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/resend-reset-code`, { email });
  }

  /**
   * Récupère le profil de l'utilisateur connecté
   */
  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile`);
  }

  /**
   * Déconnexion de l'utilisateur
   * Nettoie complètement la session et redirige
   */
  logoutBackend(): Observable<any> {
    const user = this.getCurrentUser();
    const email = user.email;
    return this.http.post(`${this.apiUrl}/logout`, { email }, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
  }
  logout(): void {
    const token = this.getToken();
    if (!token) {
      console.warn('⚠️ Aucun token présent, on nettoie juste la session');
      this.clearSession();
      this.router.navigate(['/login']);
      return;
    }

    this.logoutBackend().subscribe({
      next: () => {
        this.clearSession();
        this.router.navigate(['/login']);
        console.log('🔓 Déconnexion effectuée');
      },
      error: (err) => console.error('❌ Erreur logout backend:', err)
    });
  }

  forceLogout(): void {
    console.log('🧹 Force logout (local only)');
    this.clearSession();
    this.router.navigate(['/login']);
  }



  /**
   * Redirection après connexion selon le rôle de l'utilisateur
   */
  private redirectAfterLogin(role: string): void {
    if (role === 'admin') {
      this.router.navigate(['/admin-dashboard']);
    } else if (role === 'handicap') {
      this.router.navigate(['/handicap-dashboard']);
    }
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser() || this.getSavedUser();
    return !!token && !!user;
  }

  /**
   * Récupère le token JWT depuis localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Récupère l'utilisateur actuellement connecté
   */
  getCurrentUser(): any {
    return this.currentUserSubject.value || this.getSavedUser();
  }

  setCurrentUser(user: any) {
    this.currentUserSubject.next(user);
  }

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.role === role : false;
  }

  /**
   * Vérifie si l'utilisateur est un administrateur
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Vérifie si l'utilisateur est une personne handicapée
   */
  isHandicap(): boolean {
    return this.hasRole('handicap');
  }
}