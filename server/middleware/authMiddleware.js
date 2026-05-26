import jwt from 'jsonwebtoken'
import asyncHandler from './asyncHandler.js'
import prisma from '../prisma/client.js'

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
  const cookieToken = req.cookies?.['intervueai-token']
  const token = headerToken || cookieToken

  if (!token) {
    res.status(401)
    throw new Error('Unauthorized: token missing')
  }
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    res.status(500)
    throw new Error('JWT_SECRET is not configured')
  }

  try {
    const decoded = jwt.verify(token, jwtSecret)
    const userId = Number(decoded.id)

    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401)
      throw new Error('Unauthorized: invalid token payload')
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        provider: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      res.status(401)
      throw new Error('Unauthorized: user not found')
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401)
    throw new Error('Unauthorized: invalid token')
  }
})

const requireRole = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role
  if (!role || !allowedRoles.includes(role)) {
    res.status(403)
    throw new Error('Forbidden: insufficient role')
  }

  next()
}

export {
  protect,
  requireRole,
}
