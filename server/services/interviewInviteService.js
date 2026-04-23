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

export {
  normalizeRole,
  buildQuestionPlan,
  createInterviewInvite,
}
