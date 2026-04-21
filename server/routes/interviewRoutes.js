import express from 'express'
import multer from 'multer'
import {
  startInterview,
  getQuestionsByRole,
  synthesizeInterviewSpeech,
  transcribeInterviewAudio,
  getInterviewById,
  submitAnswerByPayload,
  submitAnswer,
  moveToNextQuestion,
  endInterview,
  endInterviewByPayload,
  getInterviewReport,
} from '../controllers/interviewController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_AUDIO_UPLOAD_MB || 15) * 1024 * 1024,
  },
})

router.get('/questions', protect, getQuestionsByRole)
router.post('/tts', protect, synthesizeInterviewSpeech)
router.post('/transcribe', protect, uploadAudio.single('audio'), transcribeInterviewAudio)
router.get('/report', protect, getInterviewReport)
router.post('/start', protect, startInterview)
router.post('/answer', protect, submitAnswerByPayload)
router.post('/end', protect, endInterviewByPayload)
router.get('/:id', protect, getInterviewById)
router.post('/:id/answer', protect, submitAnswer)
router.post('/:id/next', protect, moveToNextQuestion)
router.post('/:id/end', protect, endInterview)

export default router
