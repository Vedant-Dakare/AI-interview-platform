import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { getClientBaseUrl } from '../utils/urlUtils.js'

function getCookieOptions() {
  const baseUrl = getClientBaseUrl()
  const isSecure = baseUrl.startsWith('https://')

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

function setAuthCookie(res, token) {
  const options = getCookieOptions()
  res.cookie('intervueai-token', token, options)
}

function clearAuthCookie(res) {
  const options = getCookieOptions()
  res.clearCookie('intervueai-token', options)
}

function generateToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || null,
    provider: user.provider || null,
    role: user.role || 'USER',
  }
}

function buildAuthPayload(user) {
  return {
    user: sanitizeUser(user),
    token: generateToken(user.id),
  }
}

function parseOAuthState(state) {
  if (!state) {
    return {}
  }

  try {
    const decoded = Buffer.from(String(state), 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return {}
  }
}

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    res.status(400)
    throw new Error('name, email and password are required')
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400)
    throw new Error('name, email and password must be strings')
  }

  if (password.length < 6) {
    res.status(400)
    throw new Error('password must be at least 6 characters')
  }

  const normalizedEmail = email.toLowerCase().trim()

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    res.status(409)
    throw new Error('email is already registered')
  }

  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    },
  })

  const authPayload = buildAuthPayload(user)
  setAuthCookie(res, authPayload.token)

  console.log('Auth register success', { userId: user.id, email: user.email })

  res.status(201).json({
    success: true,
    data: authPayload,
  })
})

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400)
    throw new Error('email and password are required')
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400)
    throw new Error('email and password must be strings')
  }

  const normalizedEmail = email.toLowerCase().trim()
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    res.status(401)
    throw new Error('invalid email or password')
  }

  if (!user.password) {
    res.status(401)
    throw new Error('This account uses OAuth. Sign in with Google or GitHub.')
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    res.status(401)
    throw new Error('invalid email or password')
  }

  const authPayload = buildAuthPayload(user)
  setAuthCookie(res, authPayload.token)

  console.log('Auth login success', { userId: user.id, email: user.email })

  res.status(200).json({
    success: true,
    data: authPayload,
  })
})

const getCurrentUser = asyncHandler(async (req, res) => {
  console.log('Auth session fetch', { userId: req.user?.id })
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  })
})

const logoutUser = asyncHandler(async (req, res) => {
  clearAuthCookie(res)
  console.log('Auth logout')
  res.status(200).json({ success: true })
})

const oauthSuccessRedirect = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401)
    throw new Error('OAuth user missing')
  }

  const authPayload = buildAuthPayload(req.user)
  setAuthCookie(res, authPayload.token)

  console.log('OAuth callback user authenticated', {
    userId: req.user.id,
    provider: req.user.provider,
    email: req.user.email,
  })
  const baseUrl = getClientBaseUrl()
  const state = parseOAuthState(req.query.state)
  const redirectPath = typeof state.redirect === 'string' ? state.redirect : ''

  const redirectParams = new URLSearchParams()
  redirectParams.set('success', '1')
  if (redirectPath) {
    redirectParams.set('redirect', redirectPath)
  }

  const redirectUrl = new URL(baseUrl)
  redirectUrl.hash = `/auth/callback?${redirectParams.toString()}`

  console.log('OAuth callback redirect', {
    redirect: redirectPath,
    url: redirectUrl.toString(),
  })

  res.redirect(redirectUrl.toString())
})

export {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  oauthSuccessRedirect,
}
