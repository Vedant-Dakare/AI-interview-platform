import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { sendRejectionEmail, sendShortlistEmail } from '../services/emailService.js'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 60

const STATUS_TABS = new Set(['all', 'submitted', 'invited', 'interviewing', 'completed', 'shortlisted', 'rejected'])

function parsePagination(query) {
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize || DEFAULT_PAGE_SIZE)))
  const skip = (page - 1) * pageSize

  return { page, pageSize, skip }
}

function buildCandidateFilters(query) {
  const status = String(query.status || 'all').toLowerCase()
  const role = typeof query.role === 'string' ? query.role.toLowerCase() : null
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''

  const where = {}

  if (STATUS_TABS.has(status) && status !== 'all') {
    where.applicationStatus = status
  }

  if (role) {
    where.role = role
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { candidateId: { contains: search, mode: 'insensitive' } },
    ]
  }

  return where
}

function normalizeInterviewScores(answers = []) {
  if (!answers.length) {
    return {
      overallScore: null,
      technicalScore: null,
      communicationScore: null,
      confidenceScore: null,
    }
  }

  const metrics = answers.reduce(
    (acc, answer) => {
      const meta = answer.evaluationMeta || {}
      const score = Number(answer.finalScore ?? answer.score ?? meta.score)
      const technical = Number(meta.technicalScore)
      const communication = Number(meta.communicationScore)
      const confidence = Number(meta.confidenceScore)

      if (Number.isFinite(score)) {
        acc.overall.push(score)
      }
      if (Number.isFinite(technical)) {
        acc.technical.push(technical)
      }
      if (Number.isFinite(communication)) {
        acc.communication.push(communication)
      }
      if (Number.isFinite(confidence)) {
        acc.confidence.push(confidence)
      }

      return acc
    },
    { overall: [], technical: [], communication: [], confidence: [] },
  )

  const average = (values) => {
    if (!values.length) {
      return null
    }
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  }

  return {
    overallScore: average(metrics.overall),
    technicalScore: average(metrics.technical),
    communicationScore: average(metrics.communication),
    confidenceScore: average(metrics.confidence),
  }
}

async function getLatestInterviewByUserIds(userIds = []) {
  if (!userIds.length) {
    return new Map()
  }

  const interviews = await prisma.interview.findMany({
    where: { userId: { in: userIds } },
    orderBy: { updatedAt: 'desc' },
    include: {
      answers: {
        select: {
          finalScore: true,
          score: true,
          evaluationMeta: true,
        },
      },
      proctoredEvents: {
        select: {
          id: true,
          eventType: true,
        },
      },
    },
  })

  const byUser = new Map()
  for (const interview of interviews) {
    if (!byUser.has(interview.userId)) {
      byUser.set(interview.userId, interview)
    }
  }

  return byUser
}

const listCandidates = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = parsePagination(req.query)
  const where = buildCandidateFilters(req.query)
  const sort = String(req.query.sort || 'recent')

  const orderBy = (() => {
    if (sort === 'oldest') {
      return { createdAt: 'asc' }
    }
    if (sort === 'name') {
      return { fullName: 'asc' }
    }
    return { createdAt: 'desc' }
  })()

  const [total, candidates] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        invites: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  const emails = candidates.map((candidate) => candidate.email)
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })

  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]))
  const userIds = users.map((user) => user.id)
  const interviewByUserId = await getLatestInterviewByUserIds(userIds)

  const payload = candidates.map((candidate) => {
    const invite = candidate.invites?.[0] || null
    const user = userByEmail.get(candidate.email.toLowerCase())
    const interview = user ? interviewByUserId.get(user.id) : null
    const scoreSummary = normalizeInterviewScores(interview?.answers || [])

    return {
      candidateId: candidate.candidateId,
      fullName: candidate.fullName,
      email: candidate.email,
      role: candidate.role,
      appliedAt: candidate.createdAt,
      applicationStatus: candidate.applicationStatus,
      resumeUploaded: Boolean(candidate.resumeFileUrl),
      inviteStatus: invite?.status || null,
      interviewStatus: interview?.status || null,
      interviewMode: interview?.interviewMode || null,
      overallScore: scoreSummary.overallScore,
      technicalScore: scoreSummary.technicalScore,
      communicationScore: scoreSummary.communicationScore,
      confidenceScore: scoreSummary.confidenceScore,
      suspiciousFlags: interview?.proctoredEvents?.length || 0,
      shortlisted: candidate.applicationStatus === 'shortlisted',
      rejected: candidate.applicationStatus === 'rejected',
    }
  })

  res.status(200).json({
    success: true,
    data: {
      items: payload,
      page,
      pageSize,
      total,
    },
  })
})

const getCandidateDetail = asyncHandler(async (req, res) => {
  const { candidateId } = req.params

  const candidate = await prisma.candidate.findUnique({
    where: { candidateId },
    include: {
      invites: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!candidate) {
    res.status(404)
    throw new Error('Candidate not found')
  }

  const user = await prisma.user.findUnique({
    where: { email: candidate.email },
    select: { id: true, name: true, email: true },
  })

  let interview = null
  if (user) {
    interview = await prisma.interview.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            answer: {
              select: {
                answerText: true,
                finalScore: true,
                score: true,
                feedback: true,
                evaluationMeta: true,
                similarityScore: true,
              },
            },
          },
        },
        proctoredEvents: {
          orderBy: { createdAt: 'desc' },
        },
        interviewMemory: true,
      },
    })
  }

  const scoreSummary = normalizeInterviewScores(interview?.questions?.map((q) => q.answer).filter(Boolean) || [])

  const activities = await prisma.recruiterActivity.findMany({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: 'desc' },
    include: {
      recruiter: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  res.status(200).json({
    success: true,
    data: {
      candidate: {
        candidateId: candidate.candidateId,
        fullName: candidate.fullName,
        email: candidate.email,
        role: candidate.role,
        resumeFileUrl: candidate.resumeFileUrl,
        resumeInsights: candidate.resumeInsights,
        applicationStatus: candidate.applicationStatus,
        appliedAt: candidate.createdAt,
      },
      inviteHistory: candidate.invites || [],
      interview: interview
        ? {
            id: interview.id,
            role: interview.role,
            status: interview.status,
            createdAt: interview.createdAt,
            updatedAt: interview.updatedAt,
            warningCount: interview.warningCount,
            isTerminated: interview.isTerminated,
            terminationReason: interview.terminationReason,
            questions: interview.questions.map((question) => ({
              id: question.id,
              questionText: question.questionText,
              orderIndex: question.orderIndex,
              answer: question.answer
                ? {
                    answerText: question.answer.answerText,
                    feedback: question.answer.feedback,
                    finalScore: question.answer.finalScore ?? question.answer.score,
                    evaluationMeta: question.answer.evaluationMeta,
                    similarityScore: question.answer.similarityScore,
                  }
                : null,
            })),
            proctoredEvents: interview.proctoredEvents,
            interviewMemory: interview.interviewMemory,
          }
        : null,
      scores: scoreSummary,
      activities,
    },
  })
})

async function logRecruiterActivity({ recruiterId, candidateId, action, notes }) {
  return prisma.recruiterActivity.create({
    data: {
      recruiterId,
      candidateId,
      action,
      notes: notes ? String(notes).trim() : null,
    },
  })
}

const shortlistCandidate = asyncHandler(async (req, res) => {
  const { candidateId } = req.params
  const { notes } = req.body || {}

  const candidate = await prisma.candidate.findUnique({
    where: { candidateId },
  })

  if (!candidate) {
    res.status(404)
    throw new Error('Candidate not found')
  }

  const updated = await prisma.candidate.update({
    where: { id: candidate.id },
    data: { applicationStatus: 'shortlisted' },
  })

  await logRecruiterActivity({
    recruiterId: req.user.id,
    candidateId: candidate.id,
    action: 'shortlisted',
    notes,
  })

  try {
    await sendShortlistEmail({
      to: updated.email,
      candidateName: updated.fullName,
      role: updated.role,
      recruiterName: req.user.name,
    })
  } catch (error) {
    console.error('Shortlist email failed', {
      candidateId: updated.candidateId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  res.status(200).json({
    success: true,
    data: {
      candidateId: updated.candidateId,
      applicationStatus: updated.applicationStatus,
    },
  })
})

const rejectCandidate = asyncHandler(async (req, res) => {
  const { candidateId } = req.params
  const { notes } = req.body || {}

  const candidate = await prisma.candidate.findUnique({
    where: { candidateId },
  })

  if (!candidate) {
    res.status(404)
    throw new Error('Candidate not found')
  }

  const updated = await prisma.candidate.update({
    where: { id: candidate.id },
    data: { applicationStatus: 'rejected' },
  })

  await logRecruiterActivity({
    recruiterId: req.user.id,
    candidateId: candidate.id,
    action: 'rejected',
    notes,
  })

  try {
    await sendRejectionEmail({
      to: updated.email,
      candidateName: updated.fullName,
      role: updated.role,
      recruiterName: req.user.name,
    })
  } catch (error) {
    console.error('Rejection email failed', {
      candidateId: updated.candidateId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  res.status(200).json({
    success: true,
    data: {
      candidateId: updated.candidateId,
      applicationStatus: updated.applicationStatus,
    },
  })
})

const addCandidateNote = asyncHandler(async (req, res) => {
  const { candidateId } = req.params
  const { notes } = req.body || {}

  const candidate = await prisma.candidate.findUnique({
    where: { candidateId },
  })

  if (!candidate) {
    res.status(404)
    throw new Error('Candidate not found')
  }

  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    res.status(400)
    throw new Error('notes is required')
  }

  const activity = await logRecruiterActivity({
    recruiterId: req.user.id,
    candidateId: candidate.id,
    action: 'note',
    notes,
  })

  res.status(201).json({
    success: true,
    data: activity,
  })
})

export {
  listCandidates,
  getCandidateDetail,
  shortlistCandidate,
  rejectCandidate,
  addCandidateNote,
}
