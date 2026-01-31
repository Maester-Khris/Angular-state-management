const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PostAir API Documentation',
      version: '1.0.0',
      description: 'Node.js Orchestrator for Semantic Search and User Activity',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://angular-state-management.onrender.com'
          : 'http://localhost:3000',
        description: 'Current Environment',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  // Path to the API docs (where your routes are)
  // apis: ['./routing/*.js', './docs/*.js'], 
  apis: [path.join(__dirname, '../docs/*.js'), path.join(__dirname, '../routes/*.js')]
};

module.exports = swaggerJsdoc(options);