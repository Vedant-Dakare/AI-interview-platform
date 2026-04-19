import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { recordProctoredEvent, terminateInterview, getInterviewEvents } from '../controllers/proctorController.js'

const router = express.Router()

router.post('/proctor-event', protect, recordProctoredEvent)
router.post('/terminate', protect, terminateInterview)
router.get('/events/:interviewId', protect, getInterviewEvents)

export default router
