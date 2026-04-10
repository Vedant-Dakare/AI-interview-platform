import express from 'express'
import { uploadResume } from '../controllers/resumeController.js'
import { protect } from '../middleware/authMiddleware.js'
import { uploadResume as uploadResumeMiddleware } from '../utils/fileUpload.js'

const router = express.Router()

router.post('/upload', protect, uploadResumeMiddleware.single('resume'), uploadResume)

export default router
