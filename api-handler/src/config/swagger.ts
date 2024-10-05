import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '.';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Admin Stats API',
      version: '1.0.0',
      description: 'API for retrieving various statistics and data for admin dashboard',
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./src/routes/*.ts'], 
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;