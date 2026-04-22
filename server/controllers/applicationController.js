import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { createInterviewInvite, normalizeRole } from '../services/interviewInviteService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

  const parsedPdf = await pdfParse(fileBuffer)
  const extractedText = (parsedPdf.text || '').trim()

  const originalName = req.file.originalname || 'resume.pdf'
  const safeBase = originalName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
  const safeFilename = `${Date.now()}-${safeBase || 'resume.pdf'}`
  const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes')
  await fs.mkdir(uploadDir, { recursive: true })
  await fs.writeFile(path.join(uploadDir, safeFilename), fileBuffer)

  const candidate = await prisma.candidate.create({
    data: {
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: normalizedRole,
      resumeFileUrl: `/uploads/resumes/${safeFilename}`,
      resumeInsights: extractedText || null,
      applicationStatus: 'submitted',
    },
  })

  const { invite } = await createInterviewInvite({
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
      applicationStatus: 'invited',
    },
  })

  res.status(201).json({
    success: true,
    message: 'Your application has been submitted. Please check your email for the interview link.',
    data: {
      candidateId: candidate.candidateId,
      email: candidate.email,
      role: candidate.role,
      inviteStatus: invite.status,
      tokenExpiry: invite.tokenExpiry,
    },
  })
})

export {
  applyForInterview,
}
