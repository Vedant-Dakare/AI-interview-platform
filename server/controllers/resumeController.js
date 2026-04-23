import pdfParse from 'pdf-parse'
import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { storeResumeFile } from '../services/resumeStorageService.js'

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

  let extractedText = ''
  try {
    const parsedPdf = await pdfParse(fileBuffer)
    extractedText = (parsedPdf.text || '').trim()
  } catch {
    res.status(400)
    throw new Error('Unable to read resume PDF. Please upload a valid PDF file.')
  }

  if (!extractedText) {
    res.status(400)
    throw new Error('Unable to extract text from this PDF')
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

  const resume = await prisma.resume.create({
    data: {
      userId: req.user.id,
      fileUrl: storedResume.fileUrl,
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
