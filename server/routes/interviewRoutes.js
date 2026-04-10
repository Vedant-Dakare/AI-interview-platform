import express from 'express'
import {
  startInterview,
  getInterviewById,
  submitAnswer,
  moveToNextQuestion,
  endInterview,
} from '../controllers/interviewController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/start', protect, startInterview)
router.get('/:id', protect, getInterviewById)
router.post('/:id/answer', protect, submitAnswer)
router.post('/:id/next', protect, moveToNextQuestion)
router.post('/:id/end', protect, endInterview)

export default router
