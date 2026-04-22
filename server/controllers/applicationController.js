import fs from 'fs/promises'
import path from 'path'
import pdfParse from 'pdf-parse'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { createInterviewInvite, normalizeRole } from '../services/interviewInviteService.js'

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

  const absolutePath = path.resolve(req.file.path)
  const fileBuffer = await fs.readFile(absolutePath)
  const parsedPdf = await pdfParse(fileBuffer)
  const extractedText = (parsedPdf.text || '').trim()

  const candidate = await prisma.candidate.create({
    data: {
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: normalizedRole,
      resumeFileUrl: `/uploads/resumes/${req.file.filename}`,
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
