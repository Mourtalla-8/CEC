/**
 * CONFIGURATION BASE DE DONNÉES
 * 
 * Ce fichier gère la connexion à MongoDB via Mongoose
 * Il exporte une fonction pour établir la connexion
 */

const mongoose = require('mongoose');

/**
 * Fonction pour connecter à MongoDB
 */
const connectDB = async () => {
  try {
    // Tentative de connexion
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
    
    // Gestion des événements de connexion
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB déconnecté');
    });

  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    // Arrêter l'application si la DB n'est pas accessible
    process.exit(1);
  }
};

module.exports = connectDB;