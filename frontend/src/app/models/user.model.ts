/**
 * Modèles TypeScript pour les utilisateurs
 * Définit les interfaces pour les données utilisateur
 */

// Interface pour un utilisateur handicapé
export interface UserHandicap {
  _id?: string;
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  dateNaissance: Date;
  typeHandicap:
      | 'Moteur'           // mobilité / marcher / déplacement
      | 'Visuel'           // vision basse, malvoyance, cécité
      | 'Auditif'          // perte partielle ou totale de l’audition
      | 'Mental'           // déficience intellectuelle, retard mental
      | 'Psychique'        // troubles mentaux : schizophrénie, bipolarité, etc.
      | 'Polyhandicap'     // association de plusieurs types
      | 'Cognitif'         // mémoire, concentration, apprentissage (ex : troubles dys)
      | 'Difficultés de communication'; // trouble de parole, langage
  adresse: string;
  telephone: string;
  email: string;
  statutCompte: 'en_ligne' | 'hors_ligne' | 'suspendu';
  documentsUploades?: string[];
  demandes?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface pour un administrateur
export interface UserAdmin {
  _id?: string;
  email: string;
  role: 'admin';
  statut: 'en_ligne' | 'hors_ligne' | 'suspendu';
  nom?: string;
  prenom?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  id: string;
  email: string;
  role: 'handicap' | 'admin';
  nom?: string;
  prenom?: string;
}

// Interface pour la réponse de connexion
export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      role: 'admin' | 'handicap';
      nom?: string;
      prenom?: string;
      derniereConnexion?: string;
    };
  };
}

// Interface pour l'inscription (étape 1)
export interface SignupData {
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
  handicap: string;
  typeHandicap: string;
  adresse: string;
  telephone: string;
  email: string;
}

// Interface pour la vérification du code (étape 2)
export interface CodeVerification {
  email: string;
  code: string;
}

// Interface pour la création du mot de passe (étape 3)
export interface PasswordCreation {
  email: string;
  motDePasse: string;
  confirmerMotDePasse: string;
}
