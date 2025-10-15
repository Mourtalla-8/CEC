import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { SocketService } from './services/socket.service';
import { AppShellComponent } from './shared/layout/app-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AppShellComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  currentUser: any = null;

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('🚀 AppComponent initialisé');
    
    // Initialiser l'état d'authentification de manière simple
    this.initializeAuth();
    
    // Écouter les changements d'authentification
    this.authService.currentUser$.subscribe(user => {
      // console.log('👤 Utilisateur:', user);
      this.currentUser = user;
      this.isAuthenticated = !!user;

      // Connecter Socket.IO si authentifié
      if (user) {
        this.socketService.connect();
        this.socketService.identify(user.id, user.role);
      } else {
        this.socketService.disconnect();
      }
    });
  }

  /**
   * Initialise l'authentification de manière simple
   */
  private initializeAuth(): void {
    try {
      const currentUser = this.authService.getCurrentUser();
      console.log('👤 Utilisateur actuel:', currentUser);
      
      if (currentUser) {
        this.currentUser = currentUser;
        this.isAuthenticated = true;
        
        // Rediriger vers le dashboard approprié si on est sur la page d'accueil
        const currentUrl = this.router.url;
        if (currentUrl === '/' || currentUrl === '') {
          this.redirectToDashboard(currentUser.role);
        }
      } else {
        // Rediriger vers login si pas authentifié
        const currentUrl = this.router.url;
        if (currentUrl !== '/login' && currentUrl !== '/signup') {
          console.log('🔄 Redirection vers login');
          this.router.navigate(['/login']);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
      this.router.navigate(['/login']);
    }
  }

  /**
   * Redirige vers le dashboard approprié selon le rôle
   */
  private redirectToDashboard(role: string): void {
    if (role === 'admin') {
      this.router.navigate(['/admin-dashboard']);
    } else if (role === 'handicap') {
      this.router.navigate(['/handicap-dashboard']);
    }
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }

  logout() {
    this.authService.logout();
  }
}