import express from 'express'
import { applyForInterview } from '../controllers/applicationController.js'
import { handleResumeUpload } from '../utils/resumeUploadHandler.js'

const router = express.Router()

router.post('/', handleResumeUpload, applyForInterview)

export default router
