const ELEVENLABS_TTS_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v1/voices'

let cachedFallbackVoiceId = ''

function getTtsConfig() {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    stability: Number(process.env.ELEVENLABS_STABILITY || 0.35),
    similarityBoost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST || 0.9),
    style: Number(process.env.ELEVENLABS_STYLE || 0.05),
    speakerBoost: String(process.env.ELEVENLABS_SPEAKER_BOOST || 'true').toLowerCase() === 'true',
    outputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
  }
}

async function synthesizeSpeech(text) {
  const config = getTtsConfig()

  if (!config.apiKey) {
    const error = new Error('ELEVENLABS_API_KEY is not configured for server TTS')
    error.statusCode = 503
    throw error
  }

  const voiceId = config.voiceId || (await getFallbackVoiceId(config.apiKey))

  if (!voiceId) {
    const error = new Error('No ElevenLabs voice is available. Add ELEVENLABS_VOICE_ID or create a voice in your ElevenLabs account.')
    error.statusCode = 503
    throw error
  }

  const endpoint = `${ELEVENLABS_TTS_BASE_URL}/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(config.outputFormat)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: config.modelId,
      voice_settings: {
        stability: config.stability,
        similarity_boost: config.similarityBoost,
        style: config.style,
        use_speaker_boost: config.speakerBoost,
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    const error = new Error(`ElevenLabs TTS failed (${response.status}) ${errorBody}`)
    error.statusCode = 502
    throw error
  }

  const audioArrayBuffer = await response.arrayBuffer()
  return {
    buffer: Buffer.from(audioArrayBuffer),
    contentType: 'audio/mpeg',
  }
}

async function getFallbackVoiceId(apiKey) {
  if (cachedFallbackVoiceId) {
    return cachedFallbackVoiceId
  }

  const response = await fetch(ELEVENLABS_VOICES_URL, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    return ''
  }

  const data = await response.json().catch(() => ({}))
  const voices = Array.isArray(data?.voices) ? data.voices : []

  const preferredVoiceNames = ['rachel', 'bella', 'sarah', 'aria', 'charlotte', 'antoni']
  let preferredVoice = null

  for (const voiceName of preferredVoiceNames) {
    preferredVoice = voices.find((voice) => String(voice?.name || '').toLowerCase() === voiceName)
    if (preferredVoice) {
      break
    }
  }

  if (!preferredVoice) {
    preferredVoice =
      voices.find((voice) => String(voice?.labels?.accent || '').toLowerCase().includes('american')) ||
      voices.find((voice) => String(voice?.labels?.language || '').toLowerCase().includes('english')) ||
      voices[0]
  }

  cachedFallbackVoiceId = preferredVoice?.voice_id || ''
  return cachedFallbackVoiceId
}

export { synthesizeSpeech }
