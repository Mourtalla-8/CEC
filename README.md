# CEC - Plateforme de Gestion de la Carte d'Égalité des Chances (Senegal) 🇸🇳

## 📋 Présentation du Projet
Le projet **CEC** est une solution numérique complète conçue pour dématérialiser et simplifier le processus de demande et de gestion de la **Carte d'Égalité des Chances**. Cette plateforme permet aux personnes en situation de handicap de soumettre leurs demandes en ligne et aux administrateurs de les traiter de manière efficace et transparente.

L'application se compose d'un **Backend (API REST)** et d'un **Frontend (Application Web)** moderne.

---

## 🏗️ Architecture Technique

### 🛡️ Backend (Node.js & Express)
Le cœur du système, gérant la logique métier, l'authentification et les données.
- **Base de données** : MongoDB (via Mongoose) pour une gestion flexible des documents.
- **Temps Réel** : Socket.io pour les notifications instantanées (changement de statut, nouveaux messages).
- **Authentification** : Sécurisée par JSON Web Tokens (JWT) avec rôles (Admin / Handicap).
- **Cache** : Intégration de Redis pour optimiser les performances.
- **Stockage** : Gestion des uploads de documents (CNI, Certificat de handicap, etc.).

### 🎨 Frontend (Angular 17+)
Une interface utilisateur réactive et intuitive.
- **Framework** : Angular avec une architecture basée sur les composants.
- **Design** : Angular Material pour une expérience utilisateur moderne et accessible.
- **Sécurité** : Guards de navigation et Intercepteurs HTTP pour la gestion automatique du JWT.
- **Temps Réel** : Consommation des événements Socket.io pour une mise à jour fluide de l'interface.

---

## ✨ Fonctionnalités Principales

### 👤 Pour les Demandeurs (Espace Handicap)
1. **Inscription en 3 étapes** : 
   - Saisie des informations personnelles.
   - Vérification sécurisée par code (Email/SMS).
   - Définition du mot de passe.
2. **Tableau de bord** : Suivi en temps réel de l'état d'avancement de la demande.
3. **Gestion de Profil** : Mise à jour des informations et documents.
4. **Notifications** : Alertes instantanées sur l'évolution du dossier.

### 👨‍💼 Pour les Administrateurs (Espace Admin)
1. **Vue d'ensemble** : Statistiques et monitoring des demandes.
2. **Gestion des Dossiers** : Consultation, validation ou rejet des demandes de cartes.
3. **Système d'Upload** : Visualisation sécurisée des pièces justificatives.
4. **Communication** : Notifications envoyées directement aux utilisateurs.

---

## 📂 Structure du Projet

```text
CEC/
├── backend/                # API REST Node.js
│   ├── config/             # Configuration (DB, Redis)
│   ├── controllers/        # Logique des routes
│   ├── models/             # Schémas MongoDB
│   ├── routes/             # Définition des points d'entrée API
│   ├── services/           # Services (Socket, Mail, etc.)
│   └── uploads/            # Stockage des fichiers
├── frontend/               # Application Angular
│   ├── src/app/
│   │   ├── admin-dashboard/# Espace Administration
│   │   ├── handicap-dashboard/ # Espace Utilisateur
│   │   ├── services/       # Services de communication API
│   │   └── shared/         # Composants et services partagés
└── README.md               # Documentation globale
```

---

## 🚀 Installation Rapide

### 1. Prérequis
- Node.js (v18+)
- MongoDB & Redis (locaux ou cloud)
- Angular CLI (`npm install -g @angular/cli`)

### 2. Configuration du Backend
```bash
cd backend
npm install
# Créez un fichier .env avec :
# PORT=5000
# MONGODB_URI=votre_uri
# JWT_SECRET=votre_secret
npm run dev
```

### 3. Configuration du Frontend
```bash
cd frontend
npm install
ng serve --open
```

L'application sera accessible sur `http://localhost:4200` et l'API sur `http://localhost:5000`.

---

## 🛠️ Outils de Développement
- **Postman** : Pour tester les endpoints de l'API.
- **MongoDB Compass** : Pour visualiser les données.
- **Angular DevTools** : Pour le débogage de l'interface.

---

## 👥 Équipe de Développement
- **Développeurs** : Tanji, Cheikh Dieng.
- **Contact** : touremourtalla841@gmail.com

---
*Ce projet a été conçu avec passion pour améliorer l'accessibilité des services publics. 😎 🚀*
