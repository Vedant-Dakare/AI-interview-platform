import express from 'express'
import { applyForInterview } from '../controllers/applicationController.js'
import { uploadResume } from '../utils/fileUpload.js'

const router = express.Router()

router.post('/', uploadResume.single('resume'), applyForInterview)

export default router
