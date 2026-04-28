const FACE_SERVICE_URL = import.meta.env.VITE_FACE_SERVICE_URL || 'http://localhost:8000'

const FRAME_WIDTH = 320
const FRAME_HEIGHT = 240
const JPEG_QUALITY = 0.5
const REQUEST_TIMEOUT_MS = 6000

function waitForVideoReady(videoElement) {
  if (videoElement.readyState >= 2) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error('Camera stream is not ready for capture'))
    }

    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out while preparing camera frame'))
    }, 4000)

    function cleanup() {
      window.clearTimeout(timeoutId)
      videoElement.removeEventListener('loadeddata', onReady)
      videoElement.removeEventListener('canplay', onReady)
      videoElement.removeEventListener('error', onError)
    }

    videoElement.addEventListener('loadeddata', onReady)
    videoElement.addEventListener('canplay', onReady)
    videoElement.addEventListener('error', onError)
  })
}

async function captureFrame(videoElement) {
  if (!videoElement) {
    throw new Error('video element is required for face capture')
  }

  await waitForVideoReady(videoElement)

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_WIDTH
  canvas.height = FRAME_HEIGHT

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not initialize capture canvas')
  }

  context.drawImage(videoElement, 0, 0, FRAME_WIDTH, FRAME_HEIGHT)

  const blob = await new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', JPEG_QUALITY)
  })

  if (!blob) {
    throw new Error('Failed to capture frame')
  }

  return blob
}

async function callFaceService(path, formData) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${FACE_SERVICE_URL}${path}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = data.detail || data.message || 'Face verification service request failed'
      throw new Error(message)
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Face verification request timed out')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function callFaceServiceDelete(path) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${FACE_SERVICE_URL}${path}`, {
      method: 'DELETE',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error('Failed to clear face verification session')
    }
  } catch {
    // Cleanup failures should not block interview flow.
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function registerFace({ videoElement, sessionId }) {
  const imageBlob = await captureFrame(videoElement)
  const formData = new FormData()
  formData.append('session_id', String(sessionId))
  formData.append('image', imageBlob, 'register.jpg')

  return callFaceService('/register-face', formData)
}

export async function verifyFace({ videoElement, sessionId }) {
  const imageBlob = await captureFrame(videoElement)
  const formData = new FormData()
  formData.append('session_id', String(sessionId))
  formData.append('image', imageBlob, 'verify.jpg')

  return callFaceService('/verify-face', formData)
}

export async function clearFaceSession(sessionId) {
  if (!sessionId) {
    return
  }

  await callFaceServiceDelete(`/sessions/${encodeURIComponent(String(sessionId))}`)
}
