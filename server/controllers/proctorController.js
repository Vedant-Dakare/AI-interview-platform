import asyncHandler from '../middleware/asyncHandler.js'
import prisma from '../prisma/client.js'

const recordProctoredEvent = asyncHandler(async (req, res) => {
  const { interviewId, eventType, details } = req.body

  if (!interviewId || !eventType) {
    res.status(400)
    throw new Error('interviewId and eventType are required')
  }

  // Verify interview exists and belongs to user
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
  })

  if (!interview) {
    res.status(404)
    throw new Error('Interview not found')
  }

  // Check if interview is already terminated
  if (interview.isTerminated) {
    res.status(403)
    throw new Error('Interview has been terminated')
  }

  // Record the event
  const event = await prisma.proctoredEvent.create({
    data: {
      interviewId,
      eventType,
      details: details || {},
    },
  })

  // Increment warning count for violations
  const violationTypes = ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'CAMERA_OFF', 'WINDOW_BLUR', 'KEY_PRESS']
  if (violationTypes.includes(eventType)) {
    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        warningCount: {
          increment: 1,
        },
      },
    })

    // Check if warnings exceed limit
    if (updated.warningCount >= 5) {
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          isTerminated: true,
          terminationReason: 'Too many violations - auto terminated',
          status: 'terminated',
        },
      })

      return res.status(200).json({
        success: true,
        message: 'Interview terminated due to too many violations',
        warningCount: updated.warningCount,
        terminated: true,
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Violation recorded',
      warningCount: updated.warningCount,
      terminated: false,
    })
  }

  res.status(200).json({
    success: true,
    data: event,
  })
})

const terminateInterview = asyncHandler(async (req, res) => {
  const { interviewId, reason } = req.body

  if (!interviewId) {
    res.status(400)
    throw new Error('interviewId is required')
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
  })

  if (!interview) {
    res.status(404)
    throw new Error('Interview not found')
  }

  const updated = await prisma.interview.update({
    where: { id: interviewId },
    data: {
      isTerminated: true,
      terminationReason: reason || 'Manually terminated',
      status: 'terminated',
    },
  })

  res.status(200).json({
    success: true,
    message: 'Interview terminated',
    data: updated,
  })
})

const getInterviewEvents = asyncHandler(async (req, res) => {
  const { interviewId } = req.params

  if (!interviewId) {
    res.status(400)
    throw new Error('interviewId is required')
  }

  const events = await prisma.proctoredEvent.findMany({
    where: { interviewId: parseInt(interviewId) },
    orderBy: { createdAt: 'desc' },
  })

  res.status(200).json({
    success: true,
    data: events,
  })
})

export { recordProctoredEvent, terminateInterview, getInterviewEvents }
