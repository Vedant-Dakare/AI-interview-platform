import compression from 'compression'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import authRoutes from './routes/authRoutes.js'
import applicationRoutes from './routes/applicationRoutes.js'
import interviewRoutes from './routes/interviewRoutes.js'
import interviewLinkRoutes from './routes/interviewLinkRoutes.js'
import resumeRoutes from './routes/resumeRoutes.js'
import proctorRoutes from './routes/proctorRoutes.js'
import recruiterRoutes from './routes/recruiterRoutes.js'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'
import prisma from './prisma/client.js'
import { assertCloudinaryConfig } from './services/resumeStorageService.js'
import { retryPendingInviteEmails } from './services/interviewInviteService.js'
import { configurePassport } from './config/passport.js'

dotenv.config({ override: true })

const app = express()

app.set('trust proxy', 1)

configurePassport()

const inviteEmailRetryIntervalMs = Number(process.env.INVITE_EMAIL_RETRY_INTERVAL_MS || 300000)
const inviteEmailRetryBatchSize = Number(process.env.INVITE_EMAIL_RETRY_BATCH_SIZE || 25)

const alwaysAllowedOrigins = ['https://ai-interview-platform-sigma-ecru.vercel.app']
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...alwaysAllowedOrigins]))

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (no Origin header), e.g. curl/postman/health checks.
    if (!origin) {
      callback(null, true)
      return
    }

    const normalizedOrigin = origin.replace(/\/$/, '')
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true)
      return
    }

    callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
  credentials: true,
  optionsSuccessStatus: 204,
}

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
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(passport.initialize())

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'IntervueAI backend is running',
    environment: process.env.NODE_ENV || 'development',
  })
})

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/apply', applicationRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/interview', interviewRoutes)
app.use('/api/interview-links', interviewLinkRoutes)
app.use('/api/proctor', proctorRoutes)
app.use('/api/recruiter', recruiterRoutes)

app.use(notFound)
app.use(errorHandler)

async function bootstrap() {
  try {
    assertCloudinaryConfig()
    await prisma.$connect()
    console.log('PostgreSQL connected via Prisma')

    const port = Number(process.env.PORT || 5000)
    let inviteRetryTimer = null

    const runInviteEmailRetry = async () => {
      try {
        const result = await retryPendingInviteEmails({ limit: inviteEmailRetryBatchSize })
        if (result.sentCount > 0 || result.failedCount > 0) {
          console.log('Invite email retry run completed', result)
        }
      } catch (error) {
        console.error('Invite email retry run failed', error)
      }
    }

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`)

      if (inviteEmailRetryIntervalMs > 0) {
        runInviteEmailRetry()
        inviteRetryTimer = setInterval(runInviteEmailRetry, inviteEmailRetryIntervalMs)
        inviteRetryTimer.unref?.()
      }
    })

    process.on('unhandledRejection', (error) => {
      console.error('Unhandled promise rejection:', error)
      server.close(async () => {
        await prisma.$disconnect()
        process.exit(1)
      })
    })

    process.on('SIGTERM', () => {
      if (inviteRetryTimer) {
        clearInterval(inviteRetryTimer)
      }
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
