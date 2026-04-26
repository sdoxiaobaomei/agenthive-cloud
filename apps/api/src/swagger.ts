import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import type { Express } from 'express'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AgentHive Cloud API',
      version: '1.1.0',
      description: 'AgentHive Cloud REST API 文档',
      contact: {
        name: 'AgentHive Team',
        url: 'https://agenthive.cloud',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: '本地开发服务器',
      },
      {
        url: 'http://localhost:8080/api',
        description: 'Gateway 代理地址',
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
  },
  apis: ['./src/routes/*.ts', './src/**/*.ts'],
}

const specs = swaggerJsdoc(options)

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(specs)
  })
}
