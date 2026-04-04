import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { corsConfig } from './config/cors.js'
import { authMiddleware } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import demoRoutes from './routes/demo.js'
import projectRoutes from './routes/projects.js'

const app = express()

app.use(cors(corsConfig))
app.use(express.json())
app.use(cookieParser())

app.use('/auth', authRoutes)
app.use('/demo', demoRoutes)
app.use('/projects', authMiddleware, projectRoutes)

export default app
