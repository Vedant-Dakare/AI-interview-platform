import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { buildAdaptiveSummary } from '../services/interviewEvaluationService.js'
import { createInterviewInvite, resendInviteEmail } from '../services/interviewInviteService.js'
import { sendRejectionEmail, sendShortlistEmail } from '../services/emailService.js'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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

  const answerRows = (interview?.questions || []).map((question) => question.answer).filter(Boolean)
  const scoreSummary = normalizeInterviewScores(answerRows)

  let reportSummary = null
  if (interview && answerRows.length && interview.interviewMode === 'adaptive') {
    const summary = buildAdaptiveSummary(answerRows)
    reportSummary = {
      overallScore: summary.overallScore,
      technicalScore: summary.technicalScore,
      communicationScore: summary.communicationScore,
      problemSolvingScore: summary.problemSolvingScore,
      cheatingRiskScore: summary.cheatingRiskScore,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      recommendation: summary.recommendation,
    }
  }

  let resumeInsightsObject = null
  if (candidate.resumeInsights) {
    try {
      const parsedInsights = JSON.parse(candidate.resumeInsights)
      if (parsedInsights && typeof parsedInsights === 'object') {
        resumeInsightsObject = parsedInsights
      }
    } catch {
      resumeInsightsObject = null
    }
  }

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
        resumeInsightsObject,
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
      reportSummary,
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

function computeInviteStatus(invite, now = new Date()) {
  if (invite.status === 'completed') {
    return 'completed'
  }

  if (invite.tokenExpiry <= now) {
    return 'expired'
  }

  return 'pending'
}

function averageAnswerScore(answers = []) {
  if (!answers.length) {
    return null
  }

  const scores = answers
    .map((answer) => Number(answer.finalScore ?? answer.score))
    .filter((score) => Number.isFinite(score))

  if (!scores.length) {
    return null
  }

  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
}

async function getLatestInterviewByUserIds(userIds = [], { includeAnswers = true } = {}) {
  if (!userIds.length) {
    return new Map()
  }

  const interviews = await prisma.interview.findMany({
    where: { userId: { in: userIds } },
    orderBy: { updatedAt: 'desc' },
    include: {
      answers: includeAnswers
        ? {
            select: {
              finalScore: true,
              score: true,
              evaluationMeta: true,
            },
          }
        : false,
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

async function mapInterviewSummaries(invites) {
  if (!invites.length) {
    return new Map()
  }

  const emails = Array.from(new Set(invites.map((invite) => String(invite.email || '').toLowerCase())))
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })

  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]))
  const interviewByUserId = await getLatestInterviewByUserIds(users.map((user) => user.id))

  return emails.reduce((map, email) => {
    const user = userByEmail.get(email)
    if (user) {
      map.set(email, interviewByUserId.get(user.id) || null)
    }
    return map
  }, new Map())
}

const getDashboardOverview = asyncHandler(async (req, res) => {
  const now = new Date()

  const [
    totalCandidates,
    activeInterviews,
    completedInterviews,
    pendingInvites,
    expiredInvites,
    averageScoreAggregate,
    statusGroups,
    roleGroups,
    recentInterviews,
  ] = await Promise.all([
    prisma.candidate.count(),
    prisma.interview.count({ where: { status: { in: ['started', 'in-progress'] } } }),
    prisma.interview.count({ where: { status: 'completed' } }),
    prisma.interviewInvite.count({ where: { status: 'pending', tokenExpiry: { gt: now } } }),
    prisma.interviewInvite.count({ where: { status: 'pending', tokenExpiry: { lte: now } } }),
    prisma.answer.aggregate({
      _avg: { finalScore: true },
      where: { interview: { status: 'completed' }, finalScore: { not: null } },
    }),
    prisma.candidate.groupBy({ by: ['applicationStatus'], _count: { _all: true } }),
    prisma.candidate.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.interview.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: {
        user: { select: { name: true, email: true } },
        answers: { select: { finalScore: true, score: true } },
        proctoredEvents: { select: { id: true } },
      },
    }),
  ])

  const averageScore = averageScoreAggregate?._avg?.finalScore != null
    ? Number(Number(averageScoreAggregate._avg.finalScore).toFixed(2))
    : null

  const applicationFunnel = statusGroups.reduce((acc, group) => {
    acc[group.applicationStatus] = group._count._all
    return acc
  }, {})

  const roleDistribution = roleGroups.reduce((acc, group) => {
    acc[group.role] = group._count._all
    return acc
  }, {})

  const recentActivity = recentInterviews.map((interview) => ({
    interviewId: interview.id,
    role: interview.role,
    status: interview.status,
    interviewMode: interview.interviewMode,
    candidateName: interview.user?.name || null,
    candidateEmail: interview.user?.email || null,
    overallScore: averageAnswerScore(interview.answers),
    proctoringFlags: interview.proctoredEvents.length,
    updatedAt: interview.updatedAt,
  }))

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalCandidates,
        activeInterviews,
        completedInterviews,
        pendingInvites,
        expiredInvites,
        averageScore,
      },
      applicationFunnel,
      roleDistribution,
      recentActivity,
    },
  })
})

const INTERVIEW_TABS = new Set(['all', 'pending', 'completed', 'expired'])

function buildInviteFilters(query, now) {
  const tab = INTERVIEW_TABS.has(String(query.status || '').toLowerCase()) ? String(query.status).toLowerCase() : 'all'
  const role = typeof query.role === 'string' ? query.role.toLowerCase() : ''
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''

  const where = {}

  if (tab === 'pending') {
    where.status = 'pending'
    where.tokenExpiry = { gt: now }
  } else if (tab === 'completed') {
    where.status = 'completed'
  } else if (tab === 'expired') {
    where.status = 'pending'
    where.tokenExpiry = { lte: now }
  }

  if (role) {
    where.role = role
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { candidateId: { contains: search, mode: 'insensitive' } },
      { candidate: { fullName: { contains: search, mode: 'insensitive' } } },
    ]
  }

  return { tab, where }
}

const listInterviews = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = parsePagination(req.query)
  const now = new Date()
  const { tab, where } = buildInviteFilters(req.query, now)

  const [total, invites] = await Promise.all([
    prisma.interviewInvite.count({ where }),
    prisma.interviewInvite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            resumeFileUrl: true,
            applicationStatus: true,
          },
        },
      },
    }),
  ])

  const interviewByEmail = await mapInterviewSummaries(invites)

  const items = invites.map((invite) => {
    const interview = interviewByEmail.get(String(invite.email || '').toLowerCase()) || null

    return {
      candidateId: invite.candidateId,
      fullName: invite.candidate?.fullName || invite.email.split('@')[0],
      email: invite.email,
      role: invite.role,
      inviteStatus: computeInviteStatus(invite, now),
      createdAt: invite.createdAt,
      tokenExpiry: invite.tokenExpiry,
      startedAt: invite.startedAt,
      completedAt: invite.completedAt,
      emailSentAt: invite.emailSentAt,
      resumeUploaded: Boolean(invite.candidate?.resumeFileUrl),
      applicationStatus: invite.candidate?.applicationStatus || null,
      interview: interview
        ? {
            id: interview.id,
            status: interview.status,
            interviewMode: interview.interviewMode,
            currentQuestionIndex: interview.currentQuestionIndex,
            targetQuestionCount: interview.targetQuestionCount,
            overallScore: averageAnswerScore(interview.answers),
            proctoringFlags: interview.proctoredEvents.length,
          }
        : null,
    }
  })

  res.status(200).json({
    success: true,
    data: {
      items,
      page,
      pageSize,
      total,
    },
  })
})

const createInterviewInviteForCandidate = asyncHandler(async (req, res) => {
  const { email, fullName, role, sendEmail = false } = req.body || {}

  if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
    res.status(400)
    throw new Error('A valid email is required')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedRole = ['backend', 'ml', 'dsa'].includes(String(role || '').toLowerCase())
    ? String(role).toLowerCase()
    : null

  if (!normalizedRole) {
    res.status(400)
    throw new Error('role must be one of: backend, ml, dsa')
  }

  const duplicateActiveInvite = await prisma.interviewInvite.findFirst({
    where: {
      email: normalizedEmail,
      role: normalizedRole,
      status: 'pending',
      tokenExpiry: { gt: new Date() },
    },
  })

  if (duplicateActiveInvite) {
    res.status(409)
    throw new Error('An active interview link already exists for this email and role')
  }

  const candidate = await prisma.candidate.create({
    data: {
      fullName: (typeof fullName === 'string' && fullName.trim()) || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      role: normalizedRole,
      applicationStatus: 'invited',
    },
  })

  const { invite, interviewLink, emailSent, emailError } = await createInterviewInvite({
    candidateRecordId: candidate.id,
    candidatePublicId: candidate.candidateId,
    email: normalizedEmail,
    role: normalizedRole,
    candidateName: candidate.fullName,
    sendEmail: Boolean(sendEmail),
  })

  await logRecruiterActivity({
    recruiterId: req.user.id,
    candidateId: candidate.id,
    action: 'interview_created',
    notes: sendEmail ? 'Invite created and emailed' : 'Invite created with shareable link',
  })

  res.status(201).json({
    success: true,
    data: {
      candidateId: invite.candidateId,
      fullName: candidate.fullName,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      tokenExpiry: invite.tokenExpiry,
      interviewLink,
      emailSent,
      emailError: emailSent ? undefined : emailError,
    },
  })
})

const resendInterviewInviteEmail = asyncHandler(async (req, res) => {
  const { candidateId } = req.params

  if (!candidateId) {
    res.status(400)
    throw new Error('candidateId is required')
  }

  const { invite, interviewLink } = await resendInviteEmail(candidateId)

  if (invite.candidateRecordId) {
    await logRecruiterActivity({
      recruiterId: req.user.id,
      candidateId: invite.candidateRecordId,
      action: 'invite_resent',
    })
  }

  res.status(200).json({
    success: true,
    data: {
      candidateId: invite.candidateId,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      tokenExpiry: invite.tokenExpiry,
      interviewLink,
      message: 'Interview link emailed successfully',
    },
  })
})

export {
  listCandidates,
  getCandidateDetail,
  shortlistCandidate,
  rejectCandidate,
  addCandidateNote,
  getDashboardOverview,
  listInterviews,
  createInterviewInviteForCandidate,
  resendInterviewInviteEmail,
}
