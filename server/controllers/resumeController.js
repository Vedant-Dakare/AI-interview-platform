import fs from 'fs/promises'
import path from 'path'
import pdfParse from 'pdf-parse'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'

const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('Resume PDF file is required')
  }

  const absolutePath = path.resolve(req.file.path)
  const fileBuffer = await fs.readFile(absolutePath)
  const parsedPdf = await pdfParse(fileBuffer)
  const extractedText = (parsedPdf.text || '').trim()

  if (!extractedText) {
    res.status(400)
    throw new Error('Unable to extract text from this PDF')
  }

  const resume = await prisma.resume.create({
    data: {
      userId: req.user.id,
      fileUrl: `/uploads/resumes/${req.file.filename}`,
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
