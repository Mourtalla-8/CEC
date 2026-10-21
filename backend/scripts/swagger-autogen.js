const path = require('path');
const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

// Génère docs/openapi.auto.json en lisant les routes (sans lancer le serveur)
// Usage : npm run docs:auto
const outputFile = path.join(__dirname, '..', 'docs', 'openapi.auto.json');
const endpointsFiles = [path.join(__dirname, '..', 'server.js')];

const doc = {
  info: {
    title: "API CEC - générée automatiquement",
    version: '1.0.0',
    description: "Spec produite par swagger-autogen à partir du code. La doc détaillée (règles métier, erreurs, exemples) est sur /api-docs."
  },
  servers: [{ url: 'http://localhost:5000' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    }
  }
};

swaggerAutogen(outputFile, endpointsFiles, doc);

