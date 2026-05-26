import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { sendInterviewLinkEmail } from '../services/emailService.js'
import { createInterviewInvite, normalizeRole } from '../services/interviewInviteService.js'
import { buildInterviewLink, generateInterviewToken, getTokenExpiry, hashInterviewToken } from '../utils/interviewToken.js'

function getInviteValidationState(invite) {
  if (!invite) {
    return { valid: false, code: 'invalid', message: 'Invalid link', statusCode: 404 }
  }

  if (!invite.interviewTokenHash) {
    return { valid: false, code: 'invalid', message: 'Invalid link', statusCode: 404 }
  }

  if (invite.status === 'completed') {
    return {
      valid: false,
      code: 'completed',
      message: 'Interview already completed',
      statusCode: 409,
    }
  }

  if (invite.tokenExpiry < new Date()) {
    return { valid: false, code: 'expired', message: 'Link expired', statusCode: 410 }
  }

  return { valid: true }
}

function requireSameIdentity(inviteEmail, loggedInEmail, res) {
  if (!loggedInEmail || inviteEmail.toLowerCase() !== loggedInEmail.toLowerCase()) {
    res.status(403)
    throw new Error('This interview link belongs to a different account')
  }
}

const createInterviewLink = asyncHandler(async (req, res) => {
  const { email, role, resumeInsights, sendEmail = false } = req.body

  if (!email || typeof email !== 'string') {
    res.status(400)
    throw new Error('email is required')
  }

  const normalizedRole = normalizeRole(role)
  if (!normalizedRole) {
    res.status(400)
    throw new Error('role must be one of: backend, ml, dsa')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existingCandidate = await prisma.candidate.create({
    data: {
      fullName: normalizedEmail.split('@')[0],
      email: normalizedEmail,
      role: normalizedRole,
      applicationStatus: 'invited',
    },
  })

  const { invite, interviewLink } = await createInterviewInvite({
    candidateRecordId: existingCandidate.id,
    candidatePublicId: existingCandidate.candidateId,
    email: normalizedEmail,
    role: normalizedRole,
    resumeInsights,
    candidateName: existingCandidate.fullName,
    sendEmail: Boolean(sendEmail),
  })

  res.status(201).json({
    success: true,
    data: {
      candidateId: invite.candidateId,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      tokenExpiry: invite.tokenExpiry,
      interviewLink,
      emailSent: Boolean(sendEmail),
    },
  })
})

const sendInterviewLink = asyncHandler(async (req, res) => {
  const { candidateId } = req.params

  if (!candidateId) {
    res.status(400)
    throw new Error('candidateId is required')
  }

  const existingInvite = await prisma.interviewInvite.findUnique({
    where: { candidateId },
  })

  if (!existingInvite) {
    res.status(404)
    throw new Error('Candidate invite not found')
  }

  if (existingInvite.status === 'completed') {
    res.status(409)
    throw new Error('Interview already completed')
  }

  const newToken = generateInterviewToken()
  const newTokenHash = hashInterviewToken(newToken)
  const newExpiry = getTokenExpiry(24)
  const interviewLink = buildInterviewLink(newToken)

  const updatedInvite = await prisma.interviewInvite.update({
    where: { candidateId },
    data: {
      interviewTokenHash: newTokenHash,
      tokenExpiry: newExpiry,
      emailSentAt: null,
      status: 'pending',
    },
    include: {
      candidate: true,
    },
  })

  await sendInterviewLinkEmail({
    to: updatedInvite.email,
    role: updatedInvite.role,
    interviewLink,
    expiresAt: updatedInvite.tokenExpiry,
    candidateName: updatedInvite.candidate?.fullName,
  })

  await prisma.interviewInvite.update({
    where: { candidateId },
    data: {
      emailSentAt: new Date(),
    },
  })

  res.status(200).json({
    success: true,
    data: {
      candidateId: updatedInvite.candidateId,
      email: updatedInvite.email,
      role: updatedInvite.role,
      tokenExpiry: updatedInvite.tokenExpiry,
      status: updatedInvite.status,
      interviewLink,
      message: 'Interview link emailed successfully',
    },
  })
})

const validateInterviewToken = asyncHandler(async (req, res) => {
  const { token } = req.params

  if (!token || typeof token !== 'string') {
    res.status(400)
    throw new Error('token is required')
  }

  const invite = await prisma.interviewInvite.findUnique({
    where: {
      interviewTokenHash: hashInterviewToken(token),
    },
  })

  const validation = getInviteValidationState(invite)
  if (!validation.valid) {
    res.status(validation.statusCode)
    throw new Error(validation.message)
  }

  requireSameIdentity(invite.email, req.user?.email, res)

  res.status(200).json({
    success: true,
    data: {
      candidateId: invite.candidateId,
      email: invite.email,
      role: invite.role,
      tokenExpiry: invite.tokenExpiry,
      status: invite.status,
      message: 'Interview link is valid',
    },
  })
})

const startInterviewWithToken = asyncHandler(async (req, res) => {
  const { token } = req.params

  if (!token || typeof token !== 'string') {
    res.status(400)
    throw new Error('token is required')
  }

  const invite = await prisma.interviewInvite.findUnique({
    where: {
      interviewTokenHash: hashInterviewToken(token),
    },
  })

  const validation = getInviteValidationState(invite)
  if (!validation.valid) {
    res.status(validation.statusCode)
    throw new Error(validation.message)
  }

  requireSameIdentity(invite.email, req.user?.email, res)

  const updatedInvite = await prisma.interviewInvite.update({
    where: { id: invite.id },
    data: {
      startedAt: invite.startedAt || new Date(),
    },
    include: {
      candidate: true,
    },
  })

  if (updatedInvite.candidateRecordId) {
    await prisma.candidate.update({
      where: { id: updatedInvite.candidateRecordId },
      data: { applicationStatus: 'interviewing' },
    })
  }

  res.status(200).json({
    success: true,
    data: {
      candidateId: updatedInvite.candidateId,
      candidateFullName: updatedInvite.candidate?.fullName || req.user?.name || 'Candidate',
      role: updatedInvite.role,
      resumeInsights: updatedInvite.resumeInsights,
      questionPlan: updatedInvite.questionPlan,
      startedAt: updatedInvite.startedAt,
      tokenExpiry: updatedInvite.tokenExpiry,
      status: updatedInvite.status,
    },
  })
})

const completeInterviewWithToken = asyncHandler(async (req, res) => {
  const { token } = req.params

  if (!token || typeof token !== 'string') {
    res.status(400)
    throw new Error('token is required')
  }

  const invite = await prisma.interviewInvite.findUnique({
    where: {
      interviewTokenHash: hashInterviewToken(token),
    },
  })

  const validation = getInviteValidationState(invite)
  if (!validation.valid) {
    res.status(validation.statusCode)
    throw new Error(validation.message)
  }

  requireSameIdentity(invite.email, req.user?.email, res)

  const updatedInvite = await prisma.interviewInvite.update({
    where: { id: invite.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  })

  if (updatedInvite.candidateRecordId) {
    await prisma.candidate.update({
      where: { id: updatedInvite.candidateRecordId },
      data: { applicationStatus: 'completed' },
    })
  }

  res.status(200).json({
    success: true,
    data: {
      candidateId: updatedInvite.candidateId,
      status: updatedInvite.status,
      completedAt: updatedInvite.completedAt,
      message: 'Interview marked as completed',
    },
  })
})

export {
  createInterviewLink,
  sendInterviewLink,
  validateInterviewToken,
  startInterviewWithToken,
  completeInterviewWithToken,
}
