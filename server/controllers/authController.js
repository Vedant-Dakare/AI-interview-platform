import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'

function generateToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
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

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token: generateToken(user.id),
    },
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

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    res.status(401)
    throw new Error('invalid email or password')
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token: generateToken(user.id),
    },
  })
})

export {
  registerUser,
  loginUser,
}
