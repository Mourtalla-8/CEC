import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur d'authentification fonctionnel
 * Ajoute automatiquement le token JWT à toutes les requêtes HTTP sortantes
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Récupérer le token JWT
  const token = authService.getToken();

  // Cloner la requête et ajouter le token si disponible
  let authReq = req;
  if (token) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    
    console.log(`🔐 Token ajouté à la requête: ${req.method} ${req.url}`);
  }

  // Passer la requête au handler suivant et gérer les erreurs
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('🔒 Token expiré ou invalide, déconnexion automatique');

        // Éviter boucle si l'erreur vient déjà de /logout
        if (!req.url.includes('/logout')) {
          authService.forceLogout(); // 🔑 logout sans appel au backend
        }
      }
      return handleError(error, authService, router);
    })
  );
};

/**
 * Gère les erreurs HTTP globales
 * @param error - Erreur HTTP reçue
 * @param authService - Service d'authentification
 * @param router - Router Angular
 * @returns Observable d'erreur
 */
function handleError(
  error: HttpErrorResponse, 
  authService: AuthService, 
  router: Router
): Observable<never> {
  console.error('❌ Erreur HTTP interceptée:', error);

  const token = authService.getToken();
  const isOnLoginPage = router.url.includes('/login');

  switch (error.status) {
    case 401:
      // Token expiré ou invalide
      if (token && !isOnLoginPage) {
        console.log('🔒 Token expiré ou invalide, déconnexion automatique');
        authService.logout();
      }
      break;

    case 403:
      // Accès interdit
      console.log('🚫 Accès interdit');
      break;

    case 404:
      // Ressource non trouvée
      console.log('🔍 Ressource non trouvée');
      break;

    case 500:
      // Erreur serveur
      console.log('🔥 Erreur serveur interne');
      break;

    case 0:
      // Erreur de réseau (serveur inaccessible)
      console.log('🌐 Erreur de réseau - Serveur inaccessible');
      break;

    default:
      console.log(`❓ Erreur HTTP ${error.status}: ${error.message}`);
      break;
  }

  // Retourner l'erreur pour que les composants puissent la gérer
  return throwError(() => error);
}