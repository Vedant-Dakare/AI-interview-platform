import path from 'path'
import { fileURLToPath } from 'url'
import compression from 'compression'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes.js'
import interviewRoutes from './routes/interviewRoutes.js'
import resumeRoutes from './routes/resumeRoutes.js'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'
import prisma from './prisma/client.js'

dotenv.config()

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please retry later.',
  },
})

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Expose uploaded resume files via static route.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'IntervueAI backend is running',
    environment: process.env.NODE_ENV || 'development',
  })
})

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/interview', interviewRoutes)

app.use(notFound)
app.use(errorHandler)

async function bootstrap() {
  try {
    await prisma.$connect()
    console.log('PostgreSQL connected via Prisma')

    const port = Number(process.env.PORT || 5000)

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`)
    })

    process.on('unhandledRejection', (error) => {
      console.error('Unhandled promise rejection:', error)
      server.close(async () => {
        await prisma.$disconnect()
        process.exit(1)
      })
    })

    process.on('SIGTERM', () => {
      server.close(async () => {
        await prisma.$disconnect()
        process.exit(0)
      })
    })
  } catch (error) {
    console.error('Failed to bootstrap server', error)
    process.exit(1)
  }
}

bootstrap()
