/**
 * Guard d'authentification
 * Protège les routes et vérifie les permissions d'accès
 */

import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router 
} from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Vérifie si l'utilisateur peut accéder à la route
   * @param route - Route demandée
   * @param state - État du router
   * @returns true si l'accès est autorisé, false sinon
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    console.log(`🛡️ AuthGuard: Vérification accès à ${state.url}`);

    try {
      const routePath = route.routeConfig?.path;
      const currentUser = this.authService.getCurrentUser();
      const isAuthenticated = this.authService.isAuthenticated();

      // Si pas authentifié et pas sur login/signup
      if (!isAuthenticated && routePath !== 'login' && routePath !== 'signup') {
        console.log('🚫 Redirection vers login');
        this.router.navigate(['/login']);
        return false;
      }

      // Si authentifié et sur login/signup, rediriger vers dashboard
      if (isAuthenticated && (routePath === 'login' || routePath === 'signup')) {
        console.log('ℹ️ Déjà connecté, redirection dashboard');
        this.redirectToDashboard(currentUser.role);
        return false;
      }

      // Vérifier les rôles pour les dashboards
      if (routePath === 'admin-dashboard' && currentUser?.role !== 'admin') {
        this.router.navigate(['/handicap-dashboard']);
        return false;
      }

      if (routePath === 'handicap-dashboard' && currentUser?.role !== 'handicap') {
        this.router.navigate(['/admin-dashboard']);
        return false;
      }

      console.log(`✅ Accès autorisé à ${state.url}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur AuthGuard:', error);
      this.router.navigate(['/login']);
      return false;
    }
  }

  /**
   * Redirige l'utilisateur vers son dashboard selon son rôle
   * @param role - Rôle de l'utilisateur
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
        this.router.navigate(['/login']);
        break;
    }
  }
}