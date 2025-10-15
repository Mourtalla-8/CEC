import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Page d'accueil → login par défaut
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },

  // Authentification
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./signup/signup.component').then(m => m.SignupComponent)
  },

  // Dashboards protégés
  {
    path: 'handicap-dashboard',
    loadComponent: () =>
      import('./handicap-dashboard/handicap-dashboard.component')
        .then(m => m.HandicapDashboardComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'demandes/:id',
        loadComponent: () =>
          import('./demande-detail/demande-detail.component')
            .then(m => m.DemandeDetailComponent),
        canActivate: [AuthGuard]
      }
    ]
  },
  {
    path: 'admin-dashboard',
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard.component')
        .then(m => m.AdminDashboardComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'demandes/:id',
        loadComponent: () =>
          import('./demande-detail/demande-detail.component')
            .then(m => m.DemandeDetailComponent),
        canActivate: [AuthGuard]
      }
    ]
  },

  // Détail d'une demande est maintenant un enfant des dashboards

  // Page de profil
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },

  // Réinitialisation du mot de passe
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent)
  },

  // Page non trouvée → redirige vers login
  {
    path: '**',
    redirectTo: '/login'
  }
];
