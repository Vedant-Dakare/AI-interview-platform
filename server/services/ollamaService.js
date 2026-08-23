import { extractJsonObject } from './openaiService.js'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b'
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 12000)
const DEFAULT_MAX_RETRIES = Number(process.env.OLLAMA_MAX_RETRIES || 2)
// Keeps the model resident in memory between requests so candidates never pay
// the multi-second (often 30s+) model load cost mid-interview.
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m'

function clampPrompt(prompt, maxChars = 4000) {
  const normalized = String(prompt || '').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }

  return normalized.slice(0, maxChars)
}

async function callOllama({
  prompt,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  options = {},
  format = null,
}) {
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

  const requestBody = {
    model: OLLAMA_MODEL,
    prompt: safePrompt,
    stream: false,
    keep_alive: OLLAMA_KEEP_ALIVE,
    options: requestOptions,
  }

  if (format === 'json') {
    requestBody.format = 'json'
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
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        throw new Error(`Ollama request failed (${response.status}) ${errorBody}`.slice(0, 300))
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
  if (failure.name === 'AbortError') {
    failure.message = `AI service timed out after ${timeoutMs}ms`
  }
  failure.statusCode = failure.statusCode || 502
  throw failure
}

async function callOllamaJson({ prompt, timeoutMs, maxRetries, options, format }) {
  const content = await callOllama({ prompt, timeoutMs, maxRetries, options, format })
  const parsed = extractJsonObject(content)

  if (!parsed) {
    const error = new Error('Ollama returned invalid JSON')
    error.statusCode = 502
    throw error
  }

  return parsed
}

let warmupPromise = null

function isOllamaWarmupEnabled() {
  const raw = String(process.env.OLLAMA_WARMUP_ON_BOOT ?? 'true').toLowerCase()
  return !['0', 'false', 'no', 'off'].includes(raw)
}

async function warmupOllama() {
  if (!isOllamaWarmupEnabled()) {
    return false
  }

  if (!warmupPromise) {
    warmupPromise = (async () => {
      const startedAt = Date.now()
      try {
        await callOllama({
          prompt: 'Reply with the single word: ready',
          timeoutMs: Number(process.env.OLLAMA_WARMUP_TIMEOUT_MS || 90000),
          maxRetries: 0,
          options: { num_predict: 4 },
        })
        console.log(`[Ollama] Model ${OLLAMA_MODEL} warmed up in ${Date.now() - startedAt}ms`)
        return true
      } catch (error) {
        console.warn(`[Ollama] Warmup failed (${error?.message || 'unknown error'}). AI features will load the model on first use.`)
        return false
      }
    })()
  }

  return warmupPromise
}

export { callOllama, callOllamaJson, clampPrompt, warmupOllama }
