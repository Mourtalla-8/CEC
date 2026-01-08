# ÉTAPE 1 : Backend CEC - Carte d'Égalité des Chances

## 📋 Description

Application backend pour la gestion des demandes de Carte d'Égalité des Chances (CEC). Développée avec Node.js, Express et MongoDB, cette application offre une API REST robuste avec authentification JWT.

## 🏗️ Architecture du Projet

```
backend/
├── server.js                 # Point d'entrée du serveur
├── package.json              # Dépendances et scripts
├── .env                      # Variables d'environnement
├── README.md                 # Documentation du projet
├── config/
│   └── database.js           # Configuration MongoDB
├── models/                   # Schémas Mongoose
│   ├── UserHandicap.js       # Modèle utilisateur handicap
│   └── UserAdmin.js          # Modèle administrateur  
├── middlewares/              # Middlewares Express
│   └── authMiddleware.js     # Authentification JWT
├── controllers/              # Logique métier
│   └── authController.js     # Contrôleur d'authentification
└── routes/                   # Routes Express
    └── authRoutes.js         # Routes d'authentification
```

## 🚀 Installation et Configuration

### Prérequis
- Node.js (version 16 ou supérieure)
- MongoDB (local ou cloud)
- npm ou yarn

### Installation

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
Modifiez le fichier `.env` avec vos paramètres :
```env
PORT=5000
MONGODB_URI=votre URI de connexion MongoDB
```

4. **Démarrer MongoDB**
```bash
# Si MongoDB est installé localement
mongod

# Ou utilisez MongoDB Atlas (cloud)
```

5. **Lancer le serveur**
```bash
# Mode développement
npm run dev
```

## 📡 API Endpoints

### 🔐 Authentification (`/api/auth`)

| Méthode | Endpoint | Description | Auth | Rôle |
|---------|----------|-------------|------|---|
| POST | `/signup-init` | Inscription initiale | ❌ | Handicap  |
| POST | `/verify-code` | Vérification code SMS/email | ❌ | Handicap  |
| POST | `/set-password` | Définition mot de passe | ❌ | Handicap  |
| POST | `/login` | Connexion unifiée | ❌ | Tous |
| GET | `/profile` | Profil utilisateur | ✅ | Tous |

## 🔧 Utilisation

### 1. Inscription d'un utilisateur handicap

```javascript
// Étape 1 : Inscription initiale
POST /api/auth/signup-init
{
  "nom": "Mame Mor",
  "prenom": "Sylla",
  "sexe": "M",
  "handicap": "Moteur",
  "dateNaissance": "2000-01-01",
  "adresse": "..., Dakar,
  "telephone": "760987654",
  "email": "mamemoresylla@gmail.com"
}

// Étape 2 : Vérification du code (code affiché dans la console)
POST /api/auth/verify-code
{
  "email": "mamemoresylla@gmail.com",
  "code": "123456"
}

// Étape 3 : Définition du mot de passe
POST /api/auth/set-password
{
  "email": "mamemoresylla@gmail.com",
  "motDePasse": "MPWD2000",
  "confirmerMotDePasse": "MPWD2000"
}
```

### 2. Connexion

```javascript
POST /api/auth/login
{
  "email": "mamemoresylla@gmail.com",
  "motDePasse": "MPWD2000"
}

// Réponse :
{
  "success": true,
  "message": "Connexion réussie en tant que handicap",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "email": "mamemoresylla@gmail.com",
      "role": "handicap",
      "nom": "Mame Mor",
      "prenom": "Sylla"
    }
  }
}
```

## 🔐 Authentification et Autorisations

### Token JWT

Le token contient :
```json
{
  "userId": "objectId",
  "email": "user@gmail.com", 
  "role": "admin|handicap",
  "iat": 1234567890,
  "exp": 1234567890
}
```

## 🛠️ Développement

### Scripts disponibles

```bash
npm run dev      # Développement avec nodemon
```

### Ajout d'un admin
```bash
npm run seed      # script pour ajouter un admin (fichier seed-admin.js dans la dossier scripts)
```

ou

Pour créer un administrateur directement dans la base de données :

```javascript
// Dans MongoDB shell ou via un script
db.useradmins.insertOne({
  email: "admin1@cec.gouv.sn",
  motDePasse: "$2a$12$..." // Hash bcrypt du mot de passe
  role: "admin",
  statut: "actif",
  createdAt: new Date(),
  updatedAt: new Date()
});
```

## 🔍 Tests et Débuggage

### Routes de test disponibles

- `GET /` - Test du serveur
- `GET /api/auth/test` - Test des routes d'auth
- `GET /api/demandes/test/permissions` - Test des permissions
- `GET /api/upload/test` - Test des routes d'upload

### Logs

Le serveur affiche des logs détaillés :
- ✅ Succès (vert)
- ❌ Erreurs (rouge)  
- ⚠️ Avertissements (jaune)

## 🚨 Sécurité

### Mesures implémentées

1. **Mots de passe** : Hashage bcrypt avec salt
2. **JWT** : Expiration 24h, secret sécurisé
3. **Validation** : Schémas Mongoose stricts
4. **CORS** : Configuration pour Angular
5. **Permissions** : Middleware d'autorisation

## 🤝 Contribution
- tanji (me)
- ..........😂........

---

## 📞 Support et Maintenance

Pour toute question technique :

1. Vérifiez les logs du serveur
2. Testez les routes avec Postman/Insomnia
3. Vérifiez la connexion MongoDB
4. Consultez la documentation des dépendances


### Contact - Les AC
- **Email** : touremourtalla841@gmail.com

**😎 🚀**

