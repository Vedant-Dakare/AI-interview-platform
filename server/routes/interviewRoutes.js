import express from 'express'
import {
  startInterview,
  getQuestionsByRole,
  synthesizeInterviewSpeech,
  getInterviewById,
  submitAnswerByPayload,
  submitAnswer,
  moveToNextQuestion,
  endInterview,
  endInterviewByPayload,
} from '../controllers/interviewController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/questions', protect, getQuestionsByRole)
router.post('/tts', protect, synthesizeInterviewSpeech)
router.post('/start', protect, startInterview)
router.post('/answer', protect, submitAnswerByPayload)
router.post('/end', protect, endInterviewByPayload)
router.get('/:id', protect, getInterviewById)
router.post('/:id/answer', protect, submitAnswer)
router.post('/:id/next', protect, moveToNextQuestion)
router.post('/:id/end', protect, endInterview)

export default router
