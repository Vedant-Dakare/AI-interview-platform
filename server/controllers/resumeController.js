import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('Resume PDF file is required')
  }

  const fileBuffer = req.file.buffer
  if (!fileBuffer) {
    res.status(400)
    throw new Error('Resume upload failed. Please retry.')
  }

  const parsedPdf = await pdfParse(fileBuffer)
  const extractedText = (parsedPdf.text || '').trim()

  if (!extractedText) {
    res.status(400)
    throw new Error('Unable to extract text from this PDF')
  }

  const originalName = req.file.originalname || 'resume.pdf'
  const safeBase = originalName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
  const safeFilename = `${Date.now()}-${safeBase || 'resume.pdf'}`
  const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes')
  await fs.mkdir(uploadDir, { recursive: true })
  await fs.writeFile(path.join(uploadDir, safeFilename), fileBuffer)

  const resume = await prisma.resume.create({
    data: {
      userId: req.user.id,
      fileUrl: `/uploads/resumes/${safeFilename}`,
      extractedText,
    },
  })

  res.status(201).json({
    success: true,
    data: {
      id: resume.id,
      fileUrl: resume.fileUrl,
      extractedTextLength: extractedText.length,
      createdAt: resume.createdAt,
    },
  })
})

export {
  uploadResume,
}
