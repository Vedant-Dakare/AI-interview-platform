import express from 'express'
import { uploadResume } from '../controllers/resumeController.js'
import { protect } from '../middleware/authMiddleware.js'
import { handleResumeUpload } from '../utils/resumeUploadHandler.js'

const router = express.Router()

router.post('/upload', protect, handleResumeUpload, uploadResume)

export default router
