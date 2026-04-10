import jwt from 'jsonwebtoken'
import asyncHandler from './asyncHandler.js'
import prisma from '../prisma/client.js'

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401)
    throw new Error('Unauthorized: token missing')
  }

  const token = authHeader.split(' ')[1]
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

export {
  protect,
}
