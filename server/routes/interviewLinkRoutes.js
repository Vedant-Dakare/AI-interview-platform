import express from 'express'
import {
  completeInterviewWithToken,
  createInterviewLink,
  sendInterviewLink,
  startInterviewWithToken,
  validateInterviewToken,
} from '../controllers/interviewLinkController.js'
import { protect } from '../middleware/authMiddleware.js'
import { requireAdminApiKey } from '../middleware/internalApiKeyMiddleware.js'

const router = express.Router()

router.post('/', requireAdminApiKey, createInterviewLink)
router.post('/:candidateId/send-email', requireAdminApiKey, sendInterviewLink)
router.get('/validate/:token', protect, validateInterviewToken)
router.post('/start/:token', protect, startInterviewWithToken)
router.post('/complete/:token', protect, completeInterviewWithToken)

export default router
