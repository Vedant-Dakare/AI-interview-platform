import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'

const DUMMY_QUESTIONS = [
  'Explain REST APIs',
  'What is a database index?',
  'Explain event loop in Node.js',
]

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
  const questionTexts = sortedQuestions.map((question) => question.questionText)
  const answers = sortedQuestions
    .filter((question) => question.answer)
    .map((question) => ({
      question: question.questionText,
      answer: question.answer.answerText,
    }))

  return {
    questionTexts,
    answers,
  }
}

async function getOwnedInterviewOrFail(interviewId, userId) {
  const parsedInterviewId = parseInterviewId(interviewId)

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
          answer: true,
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
  const { role } = req.body

  if (!role || typeof role !== 'string' || !role.trim()) {
    res.status(400)
    throw new Error('role is required')
  }

  if (role.trim().length > 120) {
    res.status(400)
    throw new Error('role must be 120 characters or fewer')
  }

  const interview = await prisma.interview.create({
    data: {
      userId: req.user.id,
      role: role.trim(),
      currentQuestionIndex: 0,
      status: 'started',
      questions: {
        create: DUMMY_QUESTIONS.map((questionText, index) => ({
          questionText,
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
      status: interview.status,
      currentQuestionIndex: interview.currentQuestionIndex,
      currentQuestion: interview.questions[0]?.questionText || null,
      totalQuestions: interview.questions.length,
      createdAt: interview.createdAt,
    },
  })
})

const getInterviewById = asyncHandler(async (req, res) => {
  const interview = await getOwnedInterviewOrFail(req.params.id, req.user.id)
  const { questionTexts, answers } = mapQuestionsAndAnswers(interview.questions)

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      userId: interview.userId,
      role: interview.role,
      status: interview.status,
      currentQuestionIndex: interview.currentQuestionIndex,
      questions: questionTexts,
      answers,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
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

  const question = interview.questions[interview.currentQuestionIndex]
  if (!question) {
    res.status(400)
    throw new Error('No active question found')
  }

  await prisma.$transaction(async (tx) => {
    await tx.answer.upsert({
      where: {
        questionId: question.id,
      },
      update: {
        answerText: answer.trim(),
      },
      create: {
        questionId: question.id,
        answerText: answer.trim(),
      },
    })

    if (interview.status === 'started') {
      await tx.interview.update({
        where: {
          id: interview.id,
        },
        data: {
          status: 'in-progress',
        },
      })
    }
  })

  res.status(200).json({
    success: true,
    data: {
      interviewId: interview.id,
      currentQuestionIndex: interview.currentQuestionIndex,
      question: question.questionText,
      savedAnswer: answer.trim(),
      status: interview.status === 'started' ? 'in-progress' : interview.status,
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
  const interview = await getOwnedInterviewOrFail(req.params.id, req.user.id)

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

  const { questionTexts, answers } = mapQuestionsAndAnswers(completedInterview.questions)

  res.status(200).json({
    success: true,
    data: {
      interviewId: completedInterview.id,
      status: completedInterview.status,
      role: completedInterview.role,
      questions: questionTexts,
      answers,
      completedAt: completedInterview.updatedAt,
    },
  })
})

export {
  startInterview,
  getInterviewById,
  submitAnswer,
  moveToNextQuestion,
  endInterview,
}
