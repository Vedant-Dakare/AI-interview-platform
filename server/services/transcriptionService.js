import { callOpenAI, isOpenAIEnabled } from './openaiService.js'

function normalizeTranscript(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function transcribeAudio({ buffer, filename = 'answer.webm', mimetype = 'audio/webm' }) {
  if (!buffer || !buffer.length) {
    const error = new Error('Audio buffer is required for transcription')
    error.statusCode = 400
    throw error
  }

  if (!isOpenAIEnabled()) {
    const error = new Error('Transcription service unavailable: OPENAI_API_KEY is not configured')
    error.statusCode = 503
    throw error
  }

  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimetype })

  formData.append('model', model)
  formData.append('response_format', 'verbose_json')
  formData.append('file', blob, filename)

  const response = await callOpenAI('/audio/transcriptions', {
    method: 'POST',
    body: formData,
  })

  const data = await response.json().catch(() => ({}))
  const transcript = normalizeTranscript(data?.text || data?.transcript || '')

  if (!transcript) {
    const error = new Error('Could not transcribe audio')
    error.statusCode = 502
    throw error
  }

  let confidence = null
  if (Array.isArray(data?.segments) && data.segments.length) {
    const logprobs = data.segments
      .map((segment) => Number(segment?.avg_logprob))
      .filter((value) => Number.isFinite(value))

    if (logprobs.length) {
      const averageLogProb = logprobs.reduce((sum, value) => sum + value, 0) / logprobs.length
      confidence = Number((1 / (1 + Math.exp(-averageLogProb))).toFixed(4))
    }
  }

  return {
    transcript,
    confidence,
    provider: 'openai',
  }
}

export { transcribeAudio }
