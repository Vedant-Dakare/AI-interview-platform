import crypto from 'crypto'
import prisma from '../prisma/client.js'
import { sendInterviewLinkEmail } from './emailService.js'
import {
  buildInterviewLink,
  generateInterviewToken,
  getTokenExpiry,
  hashInterviewToken,
} from '../utils/interviewToken.js'

const ALLOWED_ROLES = new Set(['backend', 'ml', 'dsa'])

function normalizeRole(role) {
  if (typeof role !== 'string') {
    return null
  }

  const normalized = role.trim().toLowerCase()
  return ALLOWED_ROLES.has(normalized) ? normalized : null
}

function buildQuestionPlan(role) {
  const rolePlans = {
    backend: {
      focusAreas: ['System design basics', 'APIs and databases', 'Debugging and scalability'],
      questionCount: 10,
    },
    ml: {
      focusAreas: ['Model evaluation', 'Feature engineering', 'Production ML trade-offs'],
      questionCount: 10,
    },
    dsa: {
      focusAreas: ['Complexity analysis', 'Data structures', 'Problem solving strategy'],
      questionCount: 10,
    },
  }

  return rolePlans[role]
}

async function createInterviewInvite({
  candidateRecordId,
  candidatePublicId,
  email,
  role,
  resumeInsights,
  candidateName,
  sendEmail = false,
}) {
  const token = generateInterviewToken()
  const tokenHash = hashInterviewToken(token)
  const tokenExpiry = getTokenExpiry(24)
  const candidateId = candidatePublicId || crypto.randomUUID()
  const interviewLink = buildInterviewLink(token)

  const invite = await prisma.interviewInvite.create({
    data: {
      candidateRecordId,
      candidateId,
      email,
      role,
      interviewTokenHash: tokenHash,
      tokenExpiry,
      status: 'pending',
      resumeInsights: typeof resumeInsights === 'string' ? resumeInsights.trim() : null,
      questionPlan: buildQuestionPlan(role),
    },
  })

  let emailSent = false
  let emailError = null

  if (sendEmail) {
    try {
      await sendInterviewLinkEmail({
        to: email,
        role,
        interviewLink,
        expiresAt: tokenExpiry,
        candidateName,
      })

      await prisma.interviewInvite.update({
        where: { id: invite.id },
        data: { emailSentAt: new Date() },
      })

      emailSent = true
    } catch (error) {
      emailError = error instanceof Error ? error.message : 'Unknown email delivery error'
      console.error('Interview invite email delivery failed', {
        email,
        role,
        candidateId,
        error: emailError,
      })
    }
  }

  return {
    invite,
    interviewLink,
    emailSent,
    emailError,
  }
}

async function resendInviteEmail(candidateId) {
  const existingInvite = await prisma.interviewInvite.findUnique({
    where: { candidateId },
    include: {
      candidate: true,
    },
  })

  if (!existingInvite) {
    const error = new Error('Candidate invite not found')
    error.statusCode = 404
    throw error
  }

  if (existingInvite.status === 'completed') {
    const error = new Error('Interview already completed')
    error.statusCode = 409
    throw error
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

  return {
    invite: updatedInvite,
    interviewLink,
    expiresAt: updatedInvite.tokenExpiry,
  }
}

async function retryPendingInviteEmails({ limit = 25 } = {}) {
  const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 25

  const pendingInvites = await prisma.interviewInvite.findMany({
    where: {
      status: 'pending',
      emailSentAt: null,
      tokenExpiry: {
        gt: new Date(),
      },
    },
    include: {
      candidate: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: safeLimit,
  })

  let sentCount = 0
  let failedCount = 0

  for (const invite of pendingInvites) {
    try {
      const newToken = generateInterviewToken()
      const newTokenHash = hashInterviewToken(newToken)
      const newTokenExpiry = getTokenExpiry(24)
      const interviewLink = buildInterviewLink(newToken)

      await prisma.interviewInvite.update({
        where: { id: invite.id },
        data: {
          interviewTokenHash: newTokenHash,
          tokenExpiry: newTokenExpiry,
        },
      })

      await sendInterviewLinkEmail({
        to: invite.email,
        role: invite.role,
        interviewLink,
        expiresAt: newTokenExpiry,
        candidateName: invite.candidate?.fullName,
      })

      await prisma.interviewInvite.update({
        where: { id: invite.id },
        data: {
          emailSentAt: new Date(),
        },
      })

      sentCount += 1
    } catch (error) {
      failedCount += 1
      console.error('Interview invite retry email failed', {
        candidateId: invite.candidateId,
        email: invite.email,
        role: invite.role,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    processed: pendingInvites.length,
    sentCount,
    failedCount,
  }
}

export {
  normalizeRole,
  buildQuestionPlan,
  createInterviewInvite,
  resendInviteEmail,
  retryPendingInviteEmails,
}
