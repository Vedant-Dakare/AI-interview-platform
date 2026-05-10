import { extractJsonObject } from './openaiService.js'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b'
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 12000)
const DEFAULT_MAX_RETRIES = Number(process.env.OLLAMA_MAX_RETRIES || 2)

function clampPrompt(prompt, maxChars = 4000) {
  const normalized = String(prompt || '').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }

  return normalized.slice(0, maxChars)
}

async function callOllama({ prompt, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, options = {} }) {
  const safePrompt = clampPrompt(prompt)
  if (!safePrompt) {
    const error = new Error('Ollama prompt is required')
    error.statusCode = 400
    throw error
  }

  const requestOptions = {
    temperature: 0.2,
    top_p: 0.9,
    repeat_penalty: 1.1,
    num_predict: 512,
    ...options,
  }

  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: safePrompt,
          stream: false,
          options: requestOptions,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        throw new Error(`Ollama request failed (${response.status}) ${errorBody}`)
      }

      const data = await response.json().catch(() => ({}))
      const content = String(data?.response || '').trim()
      if (!content) {
        throw new Error('Ollama returned an empty response')
      }

      return content
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error
      if (attempt === maxRetries) {
        break
      }
    }
  }

  const failure = lastError instanceof Error ? lastError : new Error('Ollama request failed')
  failure.statusCode = 502
  throw failure
}

async function callOllamaJson({ prompt, timeoutMs, maxRetries, options }) {
  const content = await callOllama({ prompt, timeoutMs, maxRetries, options })
  const parsed = extractJsonObject(content)

  if (!parsed) {
    const error = new Error('Ollama returned invalid JSON')
    error.statusCode = 502
    throw error
  }

  return parsed
}

export { callOllama, callOllamaJson, clampPrompt }
