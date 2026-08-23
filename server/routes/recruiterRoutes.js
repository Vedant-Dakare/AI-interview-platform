import express from 'express'
import {
  addCandidateNote,
  createInterviewInviteForCandidate,
  getCandidateDetail,
  getDashboardOverview,
  listCandidates,
  listInterviews,
  rejectCandidate,
  resendInterviewInviteEmail,
  shortlistCandidate,
} from '../controllers/recruiterController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.use(requireRole('RECRUITER', 'ADMIN'))

router.get('/dashboard', getDashboardOverview)
router.get('/interviews', listInterviews)
router.post('/interviews', createInterviewInviteForCandidate)
router.post('/interviews/:candidateId/resend', resendInterviewInviteEmail)

router.get('/candidates', listCandidates)
router.get('/candidates/:candidateId', getCandidateDetail)
router.post('/candidates/:candidateId/shortlist', shortlistCandidate)
router.post('/candidates/:candidateId/reject', rejectCandidate)
router.post('/candidates/:candidateId/notes', addCandidateNote)

export default router
