const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

function getOpenAIKey() {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function isOpenAIEnabled() {
  return Boolean(getOpenAIKey())
}

async function callOpenAI(path, options = {}) {
  const apiKey = getOpenAIKey()

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured')
    error.statusCode = 503
    throw error
  }

  const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    const error = new Error(`OpenAI request failed (${response.status}) ${errorBody}`)
    error.statusCode = 502
    throw error
  }

  return response
}

function extractJsonObject(rawText) {
  const text = String(rawText || '').trim()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      return null
    }

    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export { callOpenAI, extractJsonObject, isOpenAIEnabled }
