/**
 * SERVEUR PRINCIPAL - Point d'entrée de l'application
 * 
 * Ce fichier configure et lance notre serveur Express
 * Il gère également Socket.IO pour les notifications temps réel
 */

// Import des modules nécessaires
require('dotenv').config(); // Pour charger les variables d'environnement
const express = require('express');
const cors = require('cors');
const http = require('http');

const socketManager = require('./services/socketManager');

// Import de la configuration de la base de données
const connectDB = require('./config/database');

// Import des routes
const authRoutes = require('./routes/authRoutes');
const demandeRoutes = require('./routes/demandeRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Initialisation de l'application Express
const app = express();
const server = http.createServer(app);

// Configuration de Socket.IO pour les notifications temps réel via le gestionnaire
const io = socketManager.initSocket(server);

// Connexion à la base de données MongoDB
connectDB();

// MIDDLEWARES GLOBAUX
// ==================

// CORS : permet les requêtes cross-origin (nécessaire pour Angular)
app.use(cors());

// Parser JSON : permet de lire les données JSON dans les requêtes
app.use(express.json());

// Parser URL-encoded : pour les formulaires
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques uploadés
app.use('/uploads', express.static('uploads'));

// Rendre Socket.IO disponible dans toutes les routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ROUTES DE L'API
// ===============

// Route de base pour tester si le serveur fonctionne
app.get('/', (req, res) => {
  res.json({ 
    message: 'API - tanJI🤖😎!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      demandes: '/api/demandes/*',
      upload: '/api/upload/*'
    }
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes des demandes CEC
app.use('/api/demandes', demandeRoutes);

// Routes d'upload de documents
app.use('/api/upload', uploadRoutes);

// Exporter io via le gestionnaire (déjà accessible via socketManager.getIo())

// GESTION DES ERREURS GLOBALES
// =============================

// Middleware pour gérer les routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`
  });
});

// Middleware pour gérer les erreurs
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// LANCEMENT DU SERVEUR
// ====================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
🚀 Serveur CEC Backend démarré avec succès!
📡 Port: ${PORT}
🗄️  Base de données: ${process.env.MONGODB_URI}
🌐 CORS autorisé pour: http://localhost:4200
💬 Socket.IO activé pour les notifications temps réel
  `);
});

// Gestion propre de l'arrêt du serveur
process.on('unhandledRejection', (err, promise) => {
  console.log('❌ Erreur non gérée:', err.message);
  server.close(() => {
    process.exit(1);
  });
});