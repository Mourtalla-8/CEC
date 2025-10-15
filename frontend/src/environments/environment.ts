/**
 * Configuration d'environnement pour le développement
 * Contient les URLs et paramètres pour se connecter au backend
 */

export const environment = {
  // Indicateur d'environnement
  production: false,
  
  // URL de base de l'API REST du backend
  apiUrl: 'http://localhost:5000/api',

  // URL du serveur Socket.IO pour les notifications temps réel
  socketUrl: 'http://localhost:5000',

  // Configuration Socket.IO
  socketConfig: {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true
  },
  
  // Configuration de l'application
  appConfig: {
    name: 'CEC - Carte d\'Égalité des Chances',
    version: '1.0.0',
    description: 'Application de gestion des demandes de carte d\'égalité des chances'
  },
  
  // Configuration JWT
  jwtConfig: {
    tokenKey: 'token',
    refreshTokenKey: 'refreshToken'
  },
}
