import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import {
  evaluateInterviewAnswer,
  evaluateAdaptiveAnswer,
  summarizeInterviewPerformance,
  summarizeAdaptiveInterviewPerformance,
} from '../services/interviewEvaluationService.js'
import { getRoleQuestionsOrFail, normalizeRole } from '../services/questionBankService.js'
import { transcribeAudio } from '../services/transcriptionService.js'
import { synthesizeSpeech } from '../services/ttsService.js'
import {
  buildDefaultMemory,
  generateAdaptiveQuestion,
  applyQuestionToMemory,
  updateMemoryWithEvaluation,
} from '../services/adaptiveInterviewService.js'
import { hashInterviewToken } from '../utils/interviewToken.js'

let cachedAnswerColumns = null

async function getAnswerColumns() {
  if (cachedAnswerColumns) {
    return cachedAnswerColumns
  }

  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Answer'
  `

  cachedAnswerColumns = new Set(rows.map((row) => row.column_name))
  return cachedAnswerColumns
}

async function getAnswerSelectShape() {
  const columns = await getAnswerColumns()

  return {
    id: true,
    interviewId: true,
    questionId: true,
    answerText: true,
    embeddingVector: true,
    similarityScore: true,
    score: true,
    createdAt: true,
    updatedAt: true,
    ...(columns.has('llm_score') ? { llmScore: true } : {}),
    ...(columns.has('final_score') ? { finalScore: true } : {}),
    ...(columns.has('feedback') ? { feedback: true } : {}),
    ...(columns.has('evaluation_meta') ? { evaluationMeta: true } : {}),
  }
}

function parseInterviewId(interviewId) {
  const parsedId = Number(interviewId)

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    const error = new Error('Invalid interview id')
    error.statusCode = 400
    throw error
  }

  return parsedId
}

function isInterviewRetakeAllowed() {
  const raw = process.env.ALLOW_INTERVIEW_RETAKE

  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false
    }
  }

  return (process.env.NODE_ENV || 'development') !== 'production'
}

function parseResumeInsights(raw) {
  if (!raw) {
    return null
  }

  if (typeof raw === 'object') {
    return raw
  }

  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

function getInviteValidationState(invite) {
  if (!invite) {
    return { valid: false, statusCode: 404, message: 'Interview link is invalid or expired' }
  }

  if (!invite.interviewTokenHash) {
    return { valid: false, statusCode: 404, message: 'Interview link is invalid or expired' }
  }

  if (invite.status === 'completed') {
    return { valid: false, statusCode: 409, message: 'Interview already completed' }
  }

  if (invite.tokenExpiry < new Date()) {
    return { valid: false, statusCode: 410, message: 'Interview link expired' }
  }

  return { valid: true }
}

function requireSameIdentity(inviteEmail, loggedInEmail, res) {
  if (!loggedInEmail || inviteEmail.toLowerCase() !== loggedInEmail.toLowerCase()) {
    res.status(403)
    throw new Error('This interview link belongs to a different account')
  }
}

async function getInterviewMemory(interviewId) {
  return prisma.interviewMemory.findUnique({
    where: { interviewId },
  })
}

function mapQuestionsAndAnswers(questions) {
  const sortedQuestions = [...questions].sort((a, b) => a.orderIndex - b.orderIndex)
  const mappedQuestions = sortedQuestions.map((question) => ({
    id: question.id,
    questionText: question.questionText,
    orderIndex: question.orderIndex,
  }))
  const answers = sortedQuestions
    .filter((question) => question.answer)
    .map((question) => ({
      questionId: question.id,
      question: question.questionText,
      answer: question.answer.answerText,
      similarityScore: question.answer.similarityScore,
      llmScore: question.answer.llmScore,
      score: question.answer.finalScore ?? question.answer.score,
      feedback: question.answer.feedback,
    }))

  return {
    questions: mappedQuestions,
    answers,
  }
}

async function getOwnedInterviewOrFail(interviewId, userId) {
  const parsedInterviewId = parseInterviewId(interviewId)
  const answerSelect = await getAnswerSelectShape()

  const interview = await prisma.interview.findFirst({
    where: {
      id: parsedInterviewId,
      userId,
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: 'asc',
        },
        include: {
          answer: {
            select: answerSelect,
          },
          roleQuestion: true,
        },
      },
    },
  })

  if (!interview) {
    const error = new Error('Interview not found')
    error.statusCode = 404
    throw error
  }

  return interview
}

const startInterview = asyncHandler(async (req, res) => {
  const inviteToken = req.body?.inviteToken
  if (!inviteToken || typeof inviteToken !== 'string') {
    res.status(403)
    throw new Error('Interview link is required to start an interview')
  }

  const invite = await prisma.interviewInvite.findUnique({
    where: {
      interviewTokenHash: hashInterviewToken(inviteToken),
    },
  })

  const validation = getInviteValidationState(invite)
  if (!validation.valid) {
    res.status(validation.statusCode)
    throw new Error(validation.message)
  }

  requireSameIdentity(invite.email, req.user?.email, res)

  if (!invite.startedAt) {
    await prisma.interviewInvite.update({
      where: { id: invite.id },
      data: { startedAt: new Date() },
    })
  }

  const normalizedRole = normalizeRole(req.body?.role)
  const inviteResumeInsights = parseResumeInsights(invite.resumeInsights)
  const resumeInsights = parseResumeInsights(req.body?.resumeInsights) || inviteResumeInsights
  const useAdaptiveMode = Boolean(resumeInsights)

  if (!normalizedRole) {
    res.status(400)
    throw new Error('role must be one of: backend, dsa, ml')
  }

  if (invite.role && normalizedRole !== invite.role) {
    res.status(403)
    throw new Error('Interview role does not match the invitation')
  }

  const existingCompletedInterview = await prisma.interview.findFirst({
    where: {
      userId: req.user.id,
      status: 'completed',
    },
    select: {
      id: true,
      role: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  if (existingCompletedInterview && !isInterviewRetakeAllowed()) {
    res.status(409)
    throw new Error('You have already completed an interview and cannot start another one.')
  }

  let interview

  if (useAdaptiveMode) {
    const initialMemory = buildDefaultMemory({
      resumeInsights,
      role: normalizedRole,
      targetQuestionCount: 10,
    })

    const adaptiveQuestion = await generateAdaptiveQuestion({
      role: normalizedRole,
      resumeInsights,
      memory: initialMemory,
      activeDomain: initialMemory.activeDomain,
      nextDifficulty: 'medium',
    })

    const memoryWithQuestion = applyQuestionToMemory(
      initialMemory,
      adaptiveQuestion.question,
      initialMemory.activeDomain,
      adaptiveQuestion.difficulty,
    )

    interview = await prisma.interview.create({
      data: {
        userId: req.user.id,
        role: normalizedRole,
        interviewMode: 'adaptive',
        targetQuestionCount: 10,
        currentQuestionIndex: 0,
        status: 'started',
        questions: {
          create: [
            {
              questionText: adaptiveQuestion.question,
              orderIndex: 0,
            },
          ],
        },
        interviewMemory: {
          create: {
            resumeInsights,
            memory: memoryWithQuestion,
          },
        },
      },
      include: {
        questions: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    })
  } else {
    const { questions: roleQuestions } = await getRoleQuestionsOrFail(normalizedRole)

    interview = await prisma.interview.create({
      data: {
        userId: req.user.id,
        role: normalizedRole,
        currentQuestionIndex: 0,
        status: 'started',
        questions: {
          create: roleQuestions.map((question, index) => ({
            roleQuestionId: question.id,
            questionText: question.questionText,
            orderIndex: index,
          })),
        },
      },
      include: {
        questions: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    })
  }

  res.status(201).json({
    success: true,
    data: {
      interviewId: interview.id,
      role: interview.role,
      candidateName: req.body?.candidateName || req.user?.name || 'Candidate',
      status: interview.status,
      currentQuestionIndex: interview.currentQuestionIndex,
      questions: interview.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        orderIndex: question.orderIndex,
      })),
      currentQuestion: interview.questions[0]?.questionText || null,
      currentQuestionId: interview.questions[0]?.id || null,
      totalQuestions: interview.interviewMode === 'adaptive'
        ? interview.targetQuestionCount
        : interview.questions.length,
      interviewMode: interview.interviewMode || 'standard',
      createdAt: interview.createdAt,
    },
  })
})

const getQuestionsByRole = asyncHandler(async (req, res) => {
  const { role, questions } = await getRoleQuestionsOrFail(req.query?.role)

  res.status(200).json({
    success: true,
    data: questions.map((question) => ({
      id: question.id,
      role,
      question_text: question.questionText,
      order_index: question.orderIndex,
    })),
  })
})

const synthesizeInterviewSpeech = asyncHandler(async (req, res) => {
  const text = String(req.body?.text || '').trim()

  if (!text) {
    res.status(400)
    throw new Error('text is required')
  }

  if (text.length > 1200) {
    res.status(400)
    throw new Error('text must be 1200 characters or fewer')
  }

  const { buffer, contentType } = await synthesizeSpeech(text)

  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(buffer)
})

const transcribeInterviewAudio = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('audio file is required')
  }

  const { transcript, confidence, provider } = await transcribeAudio({
    buffer: req.file.buffer,
    filename: req.file.originalname || 'answer.webm',
    mimetype: req.file.mimetype || 'audio/webm',
  })

  res.status(200).json({
    success: true,
    data: {
      transcript,
      confidence,
      provider,
    },
  })
})

const getInterviewById = asyncHandler(async (req, res) => {
  const interview = await getOwnedInterviewOrFail(req.params.id, req.user.id)
  const { questions, answers } = mapQuestionsAndAnswers(interview.questions)

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      userId: interview.userId,
      role: interview.role,
      interviewMode: interview.interviewMode || 'standard',
      status: interview.status,
      currentQuestionIndex: interview.currentQuestionIndex,
      questions,
      answers,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
    },
  })
})

async function saveInterviewAnswer(interview, question, answerText) {
  const trimmedAnswer = answerText.trim()

  if (question.answer) {
    const error = new Error('Answer already submitted for this question')
    error.statusCode = 409
    throw error
  }

  const isAdaptive = interview.interviewMode === 'adaptive'
  const nextStatus = interview.status === 'started' ? 'in-progress' : interview.status

  if (isAdaptive) {
    const memoryRecord = await getInterviewMemory(interview.id)
    const resumeInsights = memoryRecord?.resumeInsights || {}
    let memory = memoryRecord?.memory || null

    if (!memory) {
      const rebuilt = buildDefaultMemory({
        resumeInsights,
        role: interview.role,
        targetQuestionCount: interview.targetQuestionCount || interview.questions.length,
      })

      const sortedQuestions = [...interview.questions]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .slice(0, interview.currentQuestionIndex + 1)

      memory = sortedQuestions.reduce((acc, item) => (
        applyQuestionToMemory(acc, item.questionText, acc.activeDomain || 'backend', 'medium')
      ), rebuilt)
    }

    const difficultyHistory = Array.isArray(memory?.difficultyProgression) ? memory.difficultyProgression : []
    const topicHistory = Array.isArray(memory?.topicProgression) ? memory.topicProgression : []

    const currentDifficulty = difficultyHistory[difficultyHistory.length - 1] || 'medium'
    const currentTopic = topicHistory[topicHistory.length - 1] || 'core'

    const evaluation = await evaluateAdaptiveAnswer({
      questionText: question.questionText,
      candidateAnswerText: trimmedAnswer,
      resumeInsights,
      difficulty: currentDifficulty,
      topic: currentTopic,
    })

    const hasNextQuestion = interview.currentQuestionIndex < interview.targetQuestionCount - 1
    const nextQuestionIndex = hasNextQuestion ? interview.currentQuestionIndex + 1 : interview.currentQuestionIndex

    let nextQuestionPayload = null
    let createdNextQuestion = null
    let updatedMemory = updateMemoryWithEvaluation(memory, evaluation.evaluationMeta, trimmedAnswer, question.questionText)

    if (hasNextQuestion) {
      const nextDifficulty = evaluation.evaluationMeta?.nextDifficulty || 'medium'
      const activeDomain = updatedMemory?.activeDomain || memory?.activeDomain || 'backend'

      const nextQuestion = await generateAdaptiveQuestion({
        role: interview.role,
        resumeInsights,
        memory: updatedMemory,
        activeDomain,
        nextDifficulty,
      })

      nextQuestionPayload = {
        questionText: nextQuestion.question,
        orderIndex: nextQuestionIndex,
      }

      updatedMemory = applyQuestionToMemory(
        updatedMemory,
        nextQuestion.question,
        activeDomain,
        nextQuestion.difficulty,
      )
    }

    try {
      await prisma.$transaction(async (tx) => {
        try {
          await tx.answer.create({
            data: {
              interviewId: interview.id,
              questionId: question.id,
              answerText: trimmedAnswer,
              embeddingVector: evaluation.answerEmbedding,
              similarityScore: evaluation.similarityScore,
              llmScore: evaluation.llmScore,
              finalScore: evaluation.finalScore,
              score: evaluation.finalScore,
              feedback: evaluation.feedback,
              evaluationMeta: evaluation.evaluationMeta,
            },
          })
        } catch (error) {
          const message = String(error?.message || '')
          const hasNewFieldValidationError =
            message.includes('Unknown argument `llmScore`') ||
            message.includes('Unknown argument `finalScore`') ||
            message.includes('Unknown argument `feedback`') ||
            message.includes('Unknown argument `evaluationMeta`') ||
            message.includes('column `Answer.llm_score` does not exist') ||
            message.includes('column `Answer.final_score` does not exist') ||
            message.includes('column `Answer.feedback` does not exist') ||
            message.includes('column `Answer.evaluation_meta` does not exist')

          if (!hasNewFieldValidationError) {
            throw error
          }

          await tx.answer.create({
            data: {
              interviewId: interview.id,
              questionId: question.id,
              answerText: trimmedAnswer,
              embeddingVector: evaluation.answerEmbedding,
              similarityScore: evaluation.similarityScore,
              score: evaluation.finalScore,
            },
          })
        }

        if (nextQuestionPayload) {
          createdNextQuestion = await tx.question.create({
            data: {
              interviewId: interview.id,
              questionText: nextQuestionPayload.questionText,
              orderIndex: nextQuestionPayload.orderIndex,
            },
          })
        }

        await tx.interview.update({
          where: {
            id: interview.id,
          },
          data: {
            status: nextStatus,
            currentQuestionIndex: nextQuestionIndex,
          },
        })

        await tx.interviewMemory.upsert({
          where: { interviewId: interview.id },
          update: {
            memory: updatedMemory,
          },
          create: {
            interviewId: interview.id,
            resumeInsights,
            memory: updatedMemory,
          },
        })
      })
    } catch (error) {
      if (error?.code === 'P2002') {
        const conflictError = new Error('Answer already submitted for this question')
        conflictError.statusCode = 409
        throw conflictError
      }

      throw error
    }

    return {
      hasNextQuestion,
      nextQuestionIndex,
      nextStatus,
      similarityScore: evaluation.similarityScore,
      llmScore: evaluation.llmScore,
      finalScore: evaluation.finalScore,
      feedback: evaluation.feedback,
      savedAnswer: trimmedAnswer,
      nextQuestion: nextQuestionPayload?.questionText || null,
      nextQuestionId: createdNextQuestion?.id || null,
      evaluationMeta: evaluation.evaluationMeta,
    }
  }

  const idealAnswerText = question.roleQuestion?.idealAnswer || question.questionText
  const expectedConcepts = idealAnswerText
    .split(/[,.;]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 4)
    .slice(0, 8)

  const {
    answerEmbedding,
    similarityScore,
    llmScore,
    finalScore,
    feedback,
  } = await evaluateInterviewAnswer({
    questionText: question.questionText,
    expectedAnswerText: idealAnswerText,
    expectedConcepts,
    candidateAnswerText: trimmedAnswer,
  })

  const hasNextQuestion = interview.currentQuestionIndex < interview.questions.length - 1
  const nextQuestionIndex = hasNextQuestion ? interview.currentQuestionIndex + 1 : interview.currentQuestionIndex

  try {
    await prisma.$transaction(async (tx) => {
      try {
        await tx.answer.create({
          data: {
            interviewId: interview.id,
            questionId: question.id,
            answerText: trimmedAnswer,
            embeddingVector: answerEmbedding,
            similarityScore,
            llmScore,
            finalScore,
            score: finalScore,
            feedback,
          },
        })
      } catch (error) {
        const message = String(error?.message || '')
        const hasNewFieldValidationError =
          message.includes('Unknown argument `llmScore`') ||
          message.includes('Unknown argument `finalScore`') ||
          message.includes('Unknown argument `feedback`') ||
          message.includes('column `Answer.llm_score` does not exist') ||
          message.includes('column `Answer.final_score` does not exist') ||
          message.includes('column `Answer.feedback` does not exist')

        if (!hasNewFieldValidationError) {
          throw error
        }

        await tx.answer.create({
          data: {
            interviewId: interview.id,
            questionId: question.id,
            answerText: trimmedAnswer,
            embeddingVector: answerEmbedding,
            similarityScore,
            score: finalScore,
          },
        })
      }

      await tx.interview.update({
        where: {
          id: interview.id,
        },
        data: {
          status: nextStatus,
          currentQuestionIndex: nextQuestionIndex,
        },
      })
    })
  } catch (error) {
    if (error?.code === 'P2002') {
      const conflictError = new Error('Answer already submitted for this question')
      conflictError.statusCode = 409
      throw conflictError
    }

    throw error
  }

  return {
    hasNextQuestion,
    nextQuestionIndex,
    nextStatus,
    similarityScore,
    llmScore,
    finalScore,
    feedback,
    savedAnswer: trimmedAnswer,
  }
}

const submitAnswerByPayload = asyncHandler(async (req, res) => {
  const interviewId = parseInterviewId(req.body?.interviewId)
  const questionId = Number(req.body?.questionId)
  const answerText = req.body?.answerText

  if (!Number.isInteger(questionId) || questionId <= 0) {
    res.status(400)
    throw new Error('questionId is required')
  }

  if (!answerText || typeof answerText !== 'string' || !answerText.trim()) {
    res.status(400)
    throw new Error('answerText is required')
  }

  if (answerText.trim().length > 5000) {
    res.status(400)
    throw new Error('answerText must be 5000 characters or fewer')
  }

  const interview = await getOwnedInterviewOrFail(interviewId, req.user.id)

  if (interview.status === 'completed') {
    res.status(400)
    throw new Error('Interview is already completed')
  }

  if (interview.status === 'terminated') {
    res.status(400)
    throw new Error('Interview has been terminated')
  }

  const question = interview.questions[interview.currentQuestionIndex]
  if (!question) {
    res.status(400)
    throw new Error('No active question found')
  }

  if (question.id !== questionId) {
    res.status(400)
    throw new Error('Submitted question does not match current active question')
  }

  const result = await saveInterviewAnswer(interview, question, answerText)

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      questionId: question.id,
      currentQuestionIndex: result.nextQuestionIndex,
      hasNextQuestion: result.hasNextQuestion,
      nextQuestion: result.hasNextQuestion
        ? result.nextQuestion || interview.questions[result.nextQuestionIndex]?.questionText || null
        : null,
      nextQuestionId: result.nextQuestionId || null,
      similarityScore: result.similarityScore,
      llmScore: result.llmScore,
      finalScore: result.finalScore,
      score: result.finalScore,
      feedback: result.feedback,
      evaluationMeta: result.evaluationMeta || null,
      savedAnswer: result.savedAnswer,
      status: result.nextStatus,
    },
  })
})

const submitAnswer = asyncHandler(async (req, res) => {
  const { answer } = req.body

  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    res.status(400)
    throw new Error('answer is required')
  }

  if (answer.trim().length > 5000) {
    res.status(400)
    throw new Error('answer must be 5000 characters or fewer')
  }

  const interview = await getOwnedInterviewOrFail(req.params.id, req.user.id)

  if (interview.status === 'completed') {
    res.status(400)
    throw new Error('Interview is already completed')
  }

  if (interview.status === 'terminated') {
    res.status(400)
    throw new Error('Interview has been terminated')
  }

  const question = interview.questions[interview.currentQuestionIndex]
  if (!question) {
    res.status(400)
    throw new Error('No active question found')
  }

  const result = await saveInterviewAnswer(interview, question, answer)

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      currentQuestionIndex: result.nextQuestionIndex,
      hasNextQuestion: result.hasNextQuestion,
      question: question.questionText,
      nextQuestion: result.nextQuestion || null,
      nextQuestionId: result.nextQuestionId || null,
      savedAnswer: result.savedAnswer,
      similarityScore: result.similarityScore,
      llmScore: result.llmScore,
      finalScore: result.finalScore,
      score: result.finalScore,
      feedback: result.feedback,
      evaluationMeta: result.evaluationMeta || null,
      status: result.nextStatus,
    },
  })
})

const getInterviewReport = asyncHandler(async (req, res) => {
  const interviewId = parseInterviewId(req.query?.interviewId)
  const interview = await getOwnedInterviewOrFail(interviewId, req.user.id)
  const answerSelect = await getAnswerSelectShape()

  const answers = await prisma.answer.findMany({
    where: {
      interviewId: interview.id,
    },
    orderBy: {
      question: {
        orderIndex: 'asc',
      },
    },
    select: {
      ...answerSelect,
      question: true,
    },
  })

  const totalScore = Number(answers.reduce((sum, item) => sum + Number(item.finalScore ?? item.score ?? 0), 0).toFixed(2))
  const averageScore = answers.length ? Number((totalScore / answers.length).toFixed(2)) : 0

  let summary = null
  let adaptiveMetrics = null

  if (interview.interviewMode === 'adaptive') {
    const memoryRecord = await getInterviewMemory(interview.id)
    adaptiveMetrics = await summarizeAdaptiveInterviewPerformance(answers, memoryRecord?.resumeInsights || null)
    summary = adaptiveMetrics
  } else {
    summary = await summarizeInterviewPerformance(answers)
  }

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      overallScore: adaptiveMetrics?.overallScore ?? totalScore,
      averageScore,
      strengths: summary?.strengths || [],
      weaknesses: summary?.weaknesses || [],
      recommendation: summary?.recommendation || 'REJECT',
      technicalScore: adaptiveMetrics?.technicalScore ?? null,
      communicationScore: adaptiveMetrics?.communicationScore ?? null,
      problemSolvingScore: adaptiveMetrics?.problemSolvingScore ?? null,
      cheatingRiskScore: adaptiveMetrics?.cheatingRiskScore ?? null,
      summary: adaptiveMetrics?.summary,
      breakdown: answers.map((item) => ({
        questionId: item.questionId,
        question: item.question?.questionText || '',
        answerText: item.answerText,
        similarityScore: item.similarityScore,
        llmScore: item.llmScore,
        finalScore: item.finalScore ?? item.score,
        feedback: item.feedback,
        evaluationMeta: item.evaluationMeta,
      })),
    },
  })
})

const moveToNextQuestion = asyncHandler(async (req, res) => {
  const interview = await getOwnedInterviewOrFail(req.params.id, req.user.id)

  if (interview.status === 'completed') {
    res.status(400)
    throw new Error('Interview is already completed')
  }

  const isLastQuestion = interview.currentQuestionIndex >= interview.questions.length - 1

  if (isLastQuestion) {
    res.status(200).json({
      success: true,
      data: {
        interviewId: interview.id,
        message: 'No more questions. Please end interview.',
        hasNextQuestion: false,
        currentQuestionIndex: interview.currentQuestionIndex,
      },
    })
    return
  }

  if (interview.interviewMode === 'adaptive') {
    const nextIndex = interview.currentQuestionIndex + 1
    const existingNext = interview.questions.find((item) => item.orderIndex === nextIndex)

    if (!existingNext) {
      const memoryRecord = await getInterviewMemory(interview.id)
      const resumeInsights = memoryRecord?.resumeInsights || {}
      const memory = memoryRecord?.memory || {}
      const activeDomain = memory?.activeDomain || 'backend'
      const nextQuestion = await generateAdaptiveQuestion({
        role: interview.role,
        resumeInsights,
        memory,
        activeDomain,
        nextDifficulty: 'medium',
      })

      await prisma.$transaction(async (tx) => {
        await tx.question.create({
          data: {
            interviewId: interview.id,
            questionText: nextQuestion.question,
            orderIndex: nextIndex,
          },
        })

        await tx.interviewMemory.update({
          where: { interviewId: interview.id },
          data: {
            memory: applyQuestionToMemory(memory, nextQuestion.question, activeDomain, nextQuestion.difficulty),
          },
        })
      })
    }
  }

  const updatedInterview = await prisma.interview.update({
    where: {
      id: interview.id,
    },
    data: {
      currentQuestionIndex: interview.currentQuestionIndex + 1,
      status: interview.status === 'started' ? 'in-progress' : interview.status,
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
  })

  res.status(200).json({
    success: true,
    data: {
      interviewId: updatedInterview.id,
      hasNextQuestion: true,
      currentQuestionIndex: updatedInterview.currentQuestionIndex,
      nextQuestion: updatedInterview.questions[updatedInterview.currentQuestionIndex]?.questionText || null,
      status: updatedInterview.status,
    },
  })
})

const endInterview = asyncHandler(async (req, res) => {
  const interviewId = parseInterviewId(req.params.id)
  const interview = await getOwnedInterviewOrFail(interviewId, req.user.id)

  const completedInterview = await prisma.interview.update({
    where: {
      id: interview.id,
    },
    data: {
      status: 'completed',
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: 'asc',
        },
        include: {
          answer: true,
        },
      },
    },
  })

  const { questions, answers } = mapQuestionsAndAnswers(completedInterview.questions)

  res.status(200).json({
    success: true,
    data: {
      interviewId: completedInterview.id,
      status: completedInterview.status,
      role: completedInterview.role,
      questions,
      answers,
      completedAt: completedInterview.updatedAt,
    },
  })
})

const endInterviewByPayload = asyncHandler(async (req, res) => {
  const interviewId = parseInterviewId(req.body?.interviewId)
  const interview = await getOwnedInterviewOrFail(interviewId, req.user.id)

  const completedInterview = await prisma.interview.update({
    where: {
      id: interview.id,
    },
    data: {
      status: 'completed',
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: 'asc',
        },
        include: {
          answer: true,
        },
      },
    },
  })

  const { questions, answers } = mapQuestionsAndAnswers(completedInterview.questions)

  res.status(200).json({
    success: true,
    data: {
      interviewId: completedInterview.id,
      status: completedInterview.status,
      role: completedInterview.role,
      questions,
      answers,
      completedAt: completedInterview.updatedAt,
    },
  })
})

export {
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
}
