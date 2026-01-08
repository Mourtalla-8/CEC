# ÉTAPE 1 : Frontend CEC - Carte d'Égalité des Chances

## 📋 Description

Frontend Angular professionnel pour l'application de gestion des demandes de Carte d'Égalité des Chances (CEC). Cette application moderne et responsive permet aux personnes handicapées et aux admins de s'inscrire/se connecter.

## 🏗️ Architecture

```
frontend/
├── src/
│   ├── app/
│   │   ├── login/                     # Composant de connexion
│   │   │   ├── login.component.ts
│   │   │   ├── login.component.html
│   │   │   └── login.component.css
│   │   ├── signup/                    # Composant d'inscription (3 étapes)
│   │   │   ├── signup.component.ts
│   │   │   ├── signup.component.html
│   │   │   └── signup.component.css
│   │   ├── handicap-dashboard/        # Dashboard utilisateur handicapé
│   │   │   ├── handicap-dashboard.component.ts
│   │   │   ├── handicap-dashboard.component.html
│   │   │   └── handicap-dashboard.component.css
│   │   ├── admin-dashboard/           # Dashboard administrateur
│   │   │   ├── admin-dashboard.component.ts
│   │   │   ├── admin-dashboard.component.html
│   │   │   └── admin-dashboard.component.css
│   │   ├── services/                  # Services Angular
│   │   │   ├── auth.service.ts        # Authentification
│   │   ├── models/                    # Interfaces TypeScript
│   │   │   ├── user.model.ts
│   │   ├── guards/                    
│   │   │   └── auth.guard.ts          # Protection des routes
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts    # Injection automatique du JWT
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.component.css
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── environments/
│   │   └── environment.ts             # Configuration développement
│   └── styles.css                     # Styles globaux
└── README.md
```

## 🚀 Installation et Configuration

### Prérequis
- Node.js (version 18 ou supérieure)
- Angular CLI (version 17 ou supérieure)
- Backend CEC en cours d'exécution sur `http://localhost:5000`

### Installation

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer l'environnement**
Vérifiez le fichier `src/environments/environment.ts` :
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
};
```

4. **Lancer l'application**
```bash
# Mode développement
ng serve

# Mode développement avec ouverture automatique du navigateur
ng serve --open

# Mode production
ng build --prod
```

L'application sera accessible sur `http://localhost:4200`

## 🔑 Fonctionnalités

### 🔐 Authentification

#### Inscription Handicap (3 étapes)
1. **Informations personnelles** : Nom, prénom, sexe, handicap, adresse, etc.
2. **Vérification email** : Code de vérification envoyé par email
3. **Création mot de passe** : Définition du mot de passe sécurisé

#### Connexion
- Email + mot de passe
- Authentification JWT persistante
- Redirection automatique selon le rôle

### 👤 Dashboard Handicapé
- Vide pour l'instant

### 👨‍💼 Dashboard Admin
- Vide pour l'instant

## 🔄 Connexion Backend

### API REST
L'application communique avec le backend via les endpoints suivants :

- `POST /api/auth/signup-init` - Inscription initiale
- `POST /api/auth/verify-code` - Vérification du code
- `POST /api/auth/set-password` - Création du mot de passe
- `POST /api/auth/login` - Connexion

## 🛠️ Services Angular

### AuthService
Gère l'authentification complète :
```typescript
// Connexion
login(email: string, motDePasse: string): Observable<LoginResponse>

// Inscription (3 étapes)
signupInit(userData: SignupData): Observable<any>
verifyCode(email: string, code: string): Observable<any>
setPassword(email: string, motDePasse: string, confirmerMotDePasse: string): Observable<any>

// Gestion de session
isAuthenticated(): boolean
getCurrentUser(): any
logout(): void
```

## 🔒 Sécurité

### AuthGuard
Protège les routes selon l'authentification et les rôles :
```typescript
// Vérifications
- Utilisateur authentifié
- Rôle approprié pour la route
- Redirection automatique selon le rôle
```

### AuthInterceptor
Injection automatique du JWT :
```typescript
// Fonctionnalités
- Ajout automatique du token Bearer
- Gestion des erreurs 401 (token expiré)
- Déconnexion automatique si nécessaire
```

## 🎨 Interface Utilisateur

### Technologies utilisées
- **Angular Material** : Composants UI modernes
- **Responsive Design** : Adapté mobile/desktop
- **Animations CSS** : Transitions fluides
- **Thème personnalisé** : Couleurs CEC

### Composants principaux
- Formulaires réactifs avec validation
- Loaders et spinners
- Messages d'erreur contextuels

## 📱 Responsive Design

L'application est entièrement responsive :
- **Desktop** : Interface complète avec sidebar
- **Tablet** : Adaptation des colonnes et menus
- **Mobile** : Navigation optimisée, formulaires adaptés

## 🧪 Tests et Développement

### Commandes utiles
```bash
# Développement
ng serve                    # Serveur de développement
ng serve --open            # Avec ouverture automatique
ng serve --port 4201       # Port personnalisé

# Build
ng build                   # Build de développement
ng build --prod           # Build de production
ng build --watch          # Build avec surveillance

# Tests (à implémenter)
ng test                    # Tests unitaires
ng e2e                     # Tests end-to-end

# Analyse
ng lint                    # Vérification du code
ng build --stats-json      # Analyse du bundle
```

### Structure des composants
Chaque composant suit la structure :
```
component-name/
├── component-name.component.ts    # Logique TypeScript
├── component-name.component.html  # Template HTML
└── component-name.component.css   # Styles CSS
```

## 🤝 Contribution
- Cheikh Dieng
- Tanji (me),
- ..........😂........

---

## 📞 Support et Maintenance

### Logs et débogage
- Console du navigateur pour les erreurs frontend
- Network tab pour les requêtes API
- Angular DevTools pour le débogage des composants

### Problèmes courants

1. **Erreur CORS** : Vérifiez la configuration du backend
2. **Token expiré** : L'interceptor gère automatiquement la déconnexion

### Contact - Les AC
- **Email** : touremourtalla841@gmail.com

**😎 🚀**
