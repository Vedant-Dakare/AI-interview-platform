import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'
import { evaluateInterviewAnswer, summarizeInterviewPerformance } from '../services/interviewEvaluationService.js'
import { getRoleQuestionsOrFail, normalizeRole } from '../services/questionBankService.js'
import { transcribeAudio } from '../services/transcriptionService.js'
import { synthesizeSpeech } from '../services/ttsService.js'

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
  const normalizedRole = normalizeRole(req.body?.role)

  if (!normalizedRole) {
    res.status(400)
    throw new Error('role must be one of: backend, dsa, ml')
  }

  const existingCompletedInterview = await prisma.interview.findFirst({
    where: {
      userId: req.user.id,
      status: 'completed',
    },
    select: {
      id: true,
      role: true,
      completedAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  if (existingCompletedInterview) {
    res.status(409)
    throw new Error('You have already completed an interview and cannot start another one.')
  }

  const { questions: roleQuestions } = await getRoleQuestionsOrFail(normalizedRole)

  const interview = await prisma.interview.create({
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
      totalQuestions: interview.questions.length,
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
  const nextStatus = interview.status === 'started' ? 'in-progress' : interview.status

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
        ? interview.questions[result.nextQuestionIndex]?.questionText || null
        : null,
      similarityScore: result.similarityScore,
      llmScore: result.llmScore,
      finalScore: result.finalScore,
      score: result.finalScore,
      feedback: result.feedback,
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
      savedAnswer: result.savedAnswer,
      similarityScore: result.similarityScore,
      llmScore: result.llmScore,
      finalScore: result.finalScore,
      score: result.finalScore,
      feedback: result.feedback,
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
  const summary = await summarizeInterviewPerformance(answers)

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      overallScore: totalScore,
      averageScore,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      recommendation: summary.recommendation,
      breakdown: answers.map((item) => ({
        questionId: item.questionId,
        question: item.question?.questionText || '',
        answerText: item.answerText,
        similarityScore: item.similarityScore,
        llmScore: item.llmScore,
        finalScore: item.finalScore ?? item.score,
        feedback: item.feedback,
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
