import pdfParse from 'pdf-parse'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { createInterviewInvite, normalizeRole } from '../services/interviewInviteService.js'
import { storeResumeFile } from '../services/resumeStorageService.js'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const applyForInterview = asyncHandler(async (req, res) => {
  const { fullName, email, role } = req.body

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    res.status(400)
    throw new Error('fullName is required')
  }

  if (!email || typeof email !== 'string') {
    res.status(400)
    throw new Error('email is required')
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!isValidEmail(normalizedEmail)) {
    res.status(400)
    throw new Error('Invalid email format')
  }

  const normalizedRole = normalizeRole(role)
  if (!normalizedRole) {
    res.status(400)
    throw new Error('role must be one of: backend, ml, dsa')
  }

  if (!req.file) {
    res.status(400)
    throw new Error('resume PDF file is required')
  }

  const duplicatePending = await prisma.interviewInvite.findFirst({
    where: {
      email: normalizedEmail,
      role: normalizedRole,
      status: 'pending',
      emailSentAt: {
        not: null,
      },
      tokenExpiry: {
        gt: new Date(),
      },
    },
  })

  if (duplicatePending) {
    res.status(409)
    throw new Error('An active interview link already exists for this email and role')
  }

  const fileBuffer = req.file.buffer
  if (!fileBuffer) {
    res.status(400)
    throw new Error('Resume upload failed. Please retry.')
  }

  let extractedText = ''
  try {
    const parsedPdf = await pdfParse(fileBuffer)
    extractedText = (parsedPdf.text || '').trim()
  } catch {
    res.status(400)
    throw new Error('Unable to read resume PDF. Please upload a valid PDF file.')
  }

  let storedResume
  try {
    storedResume = await storeResumeFile({
      fileBuffer,
      originalName: req.file.originalname,
    })
  } catch {
    res.status(500)
    throw new Error('Unable to store resume file. Please try again shortly.')
  }

  const candidate = await prisma.candidate.create({
    data: {
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: normalizedRole,
      resumeFileUrl: storedResume.fileUrl,
      resumeInsights: extractedText || null,
      applicationStatus: 'submitted',
    },
  })

  const { invite, emailSent } = await createInterviewInvite({
    candidateRecordId: candidate.id,
    candidatePublicId: candidate.candidateId,
    email: candidate.email,
    role: candidate.role,
    resumeInsights: candidate.resumeInsights,
    candidateName: candidate.fullName,
    sendEmail: true,
  })

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      applicationStatus: emailSent ? 'invited' : 'submitted',
    },
  })

  res.status(201).json({
    success: true,
    message: emailSent
      ? 'Your application has been submitted. Please check your email for the interview link.'
      : 'Your application has been submitted. We are processing your interview invite and will email it shortly.',
    data: {
      candidateId: candidate.candidateId,
      email: candidate.email,
      role: candidate.role,
      emailSent,
      inviteStatus: invite.status,
      tokenExpiry: invite.tokenExpiry,
    },
  })
})

export {
  applyForInterview,
}
