import express from 'express'
import {
  addCandidateNote,
  getCandidateDetail,
  listCandidates,
  rejectCandidate,
  shortlistCandidate,
} from '../controllers/recruiterController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.use(requireRole('RECRUITER', 'ADMIN'))

router.get('/candidates', listCandidates)
router.get('/candidates/:candidateId', getCandidateDetail)
router.post('/candidates/:candidateId/shortlist', shortlistCandidate)
router.post('/candidates/:candidateId/reject', rejectCandidate)
router.post('/candidates/:candidateId/notes', addCandidateNote)

export default router
