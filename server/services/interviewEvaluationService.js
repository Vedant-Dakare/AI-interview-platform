import { buildEmbeddingVector, clampSimilarity, cosineSimilarity } from './embeddingService.js'
import { callOpenAI, extractJsonObject, isOpenAIEnabled } from './openaiService.js'
import { callOllamaJson, clampPrompt } from './ollamaService.js'

function toFixedNumber(value, digits = 4) {
  return Number(Number(value || 0).toFixed(digits))
}

async function generateEmbedding(text) {
  const normalizedText = String(text || '').trim()

  if (!normalizedText) {
    return []
  }

  if (!isOpenAIEnabled()) {
    return buildEmbeddingVector(normalizedText)
  }

  try {
    const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    const response = await callOpenAI('/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: normalizedText,
      }),
    })

    const data = await response.json().catch(() => ({}))
    const embedding = data?.data?.[0]?.embedding

    if (!Array.isArray(embedding) || !embedding.length) {
      return buildEmbeddingVector(normalizedText)
    }

    return embedding.map((value) => Number(value) || 0)
  } catch {
    return buildEmbeddingVector(normalizedText)
  }
}

function clampScore(value, min = 0, max = 10) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return min
  }

  return Number(Math.max(min, Math.min(max, numeric)).toFixed(2))
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set()
  return value
    .map((item) => String(item || '').trim())
    .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()))
}

async function evaluateAdaptiveAnswer({ questionText, candidateAnswerText, resumeInsights, difficulty, topic }) {
  const answerText = String(candidateAnswerText || '').trim()
  const question = String(questionText || '').trim()

  if (!answerText || !question) {
    return {
      answerEmbedding: [],
      similarityScore: 0,
      llmScore: 0,
      finalScore: 0,
      feedback: 'No answer captured.',
      evaluationMeta: {
        score: 0,
        technicalScore: 0,
        communicationScore: 0,
        problemSolvingScore: 0,
        confidenceScore: 0,
        nextDifficulty: 'easy',
        nextTopic: topic || 'core',
        strengths: [],
        weaknesses: ['No response was provided.'],
      },
      evaluationProvider: 'ollama',
    }
  }

  const resumeSummary = {
    skills: resumeInsights?.skills || [],
    frameworks: resumeInsights?.frameworks || [],
    projects: resumeInsights?.projects || [],
    domains: resumeInsights?.domains || [],
    experienceLevel: resumeInsights?.experienceLevel || 'junior',
  }

  const prompt = clampPrompt([
    'You are an adaptive technical interview evaluator.',
    'Evaluate the candidate answer strictly and return JSON only with keys:',
    'score, technicalScore, communicationScore, problemSolvingScore, confidenceScore, strengths, weaknesses, feedback, nextDifficulty, nextTopic.',
    'Scores must be 0-10. nextDifficulty must be easy|medium|hard.',
    'Keep feedback concise and actionable.',
    '',
    `ROLE_CONTEXT: ${JSON.stringify(resumeSummary)}`,
    `TOPIC: ${topic || 'core'}`,
    `DIFFICULTY: ${difficulty || 'medium'}`,
    `QUESTION: ${question}`,
    `ANSWER: ${answerText}`,
  ].join('\n'), 4000)

  let parsed = null
  try {
    parsed = await callOllamaJson({
      prompt,
      timeoutMs: Number(process.env.OLLAMA_EVAL_TIMEOUT_MS || 3500),
      maxRetries: Number(process.env.OLLAMA_EVAL_RETRIES || 0),
    })
  } catch {
    parsed = null
  }

  const evaluation = parsed || {}
  const lengthScore = Math.min(10, Math.max(2, Math.round(answerText.length / 80)))
  const technicalScore = clampScore(evaluation.technicalScore ?? evaluation.score ?? lengthScore)
  const communicationScore = clampScore(evaluation.communicationScore)
  const problemSolvingScore = clampScore(evaluation.problemSolvingScore ?? lengthScore)
  const confidenceScore = clampScore(evaluation.confidenceScore ?? 6)
  const score = clampScore(evaluation.score ?? technicalScore)
  const nextDifficulty = ['easy', 'medium', 'hard'].includes(String(evaluation.nextDifficulty || '').toLowerCase())
    ? String(evaluation.nextDifficulty).toLowerCase()
    : score >= 7.5
      ? 'hard'
      : score >= 5.5
        ? 'medium'
        : 'easy'
  const nextTopic = String(evaluation.nextTopic || topic || 'core').trim()
  const strengths = normalizeStringArray(evaluation.strengths)
  const weaknesses = normalizeStringArray(evaluation.weaknesses)
  const feedback = String(evaluation.feedback || '').trim() || 'Provide more structured reasoning and concrete examples.'

  const [answerEmbedding, referenceEmbedding] = await Promise.all([
    generateEmbedding(answerText),
    generateEmbedding(question),
  ])

  const similarityScore = clampSimilarity(cosineSimilarity(answerEmbedding, referenceEmbedding))
  const finalScore = clampScore((technicalScore * 0.6) + (communicationScore * 0.2) + (problemSolvingScore * 0.2))

  return {
    answerEmbedding,
    similarityScore,
    llmScore: score,
    finalScore,
    feedback,
    evaluationMeta: {
      score,
      technicalScore,
      communicationScore,
      problemSolvingScore,
      confidenceScore,
      nextDifficulty,
      nextTopic,
      strengths,
      weaknesses,
    },
    evaluationProvider: 'ollama',
  }
}

function evaluateByConceptCoverage(questionText, answerText, expectedConcepts = []) {
  const normalizedAnswer = String(answerText || '').toLowerCase()
  const normalizedQuestion = String(questionText || '').toLowerCase()
  const concepts = expectedConcepts.map((concept) => String(concept || '').toLowerCase()).filter(Boolean)

  const conceptHits = concepts.filter((concept) => normalizedAnswer.includes(concept)).length
  const conceptCoverage = concepts.length ? conceptHits / concepts.length : 0
  const lengthScore = Math.min(1, normalizedAnswer.length / 280)
  const relevanceScore = normalizedQuestion && normalizedAnswer
    ? Number(normalizedAnswer.split(' ').filter((word) => normalizedQuestion.includes(word)).length) / Math.max(1, normalizedAnswer.split(' ').length)
    : 0

  const rawScore = 10 * ((conceptCoverage * 0.55) + (lengthScore * 0.25) + (Math.min(1, relevanceScore * 3) * 0.2))
  const llmScore = Number(Math.max(0, Math.min(10, rawScore)).toFixed(2))
  const feedback = llmScore >= 8
    ? 'Strong answer with good coverage and clear explanation.'
    : llmScore >= 6
      ? 'Decent answer but include more concrete details and examples.'
      : 'Answer is partially correct; improve depth and cover key concepts explicitly.'

  return {
    llmScore,
    feedback,
    provider: 'heuristic',
  }
}

async function evaluateWithLLM(questionText, answerText, expectedConcepts = []) {
  if (!isOpenAIEnabled()) {
    return evaluateByConceptCoverage(questionText, answerText, expectedConcepts)
  }

  try {
    const model = process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini'
    const prompt = [
      'Evaluate the candidate answer for correctness, depth, and clarity.',
      'Return strict JSON only with keys: score, feedback.',
      'score must be a number in range 0-10.',
      'feedback must be a short 2-3 line string.',
      '',
      `Question: ${questionText}`,
      `Expected Concepts: ${expectedConcepts.join(', ') || 'None provided'}`,
      `Candidate Answer: ${answerText}`,
    ].join('\n')

    const response = await callOpenAI('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You are a strict interview evaluator. Output JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const data = await response.json().catch(() => ({}))
    const content = data?.choices?.[0]?.message?.content || ''
    const parsed = extractJsonObject(content) || {}
    const score = Number(parsed.score)
    const llmScore = Number.isFinite(score) ? Number(Math.max(0, Math.min(10, score)).toFixed(2)) : 0
    const feedback = String(parsed.feedback || 'No feedback available').trim()

    return {
      llmScore,
      feedback,
      provider: 'openai',
    }
  } catch {
    return evaluateByConceptCoverage(questionText, answerText, expectedConcepts)
  }
}

function combineFinalScore(similarityScore, llmScore) {
  const finalScore = (Number(similarityScore) * 4) + (Number(llmScore) * 0.6)
  return Number(Math.max(0, Math.min(10, finalScore)).toFixed(2))
}

async function evaluateInterviewAnswer({ questionText, expectedAnswerText, expectedConcepts = [], candidateAnswerText }) {
  const answerText = String(candidateAnswerText || '').trim()
  const referenceText = String(expectedAnswerText || questionText || '').trim()

  const [answerEmbedding, referenceEmbedding, llmResult] = await Promise.all([
    generateEmbedding(answerText),
    generateEmbedding(referenceText),
    evaluateWithLLM(questionText, answerText, expectedConcepts),
  ])

  const similarityScore = clampSimilarity(cosineSimilarity(answerEmbedding, referenceEmbedding))
  const llmScore = toFixedNumber(llmResult.llmScore, 2)
  const finalScore = combineFinalScore(similarityScore, llmScore)

  return {
    answerEmbedding,
    referenceEmbedding,
    similarityScore,
    llmScore,
    finalScore,
    feedback: llmResult.feedback,
    evaluationProvider: llmResult.provider,
  }
}

function buildDeterministicSummary(answerRows) {
  const strengths = []
  const weaknesses = []

  for (const row of answerRows) {
    const score = Number(row?.finalScore ?? row?.score ?? 0)

    if (score >= 7.5 && strengths.length < 3) {
      strengths.push(`Strong response on: ${row?.question?.questionText || 'a core topic'}`)
    }

    if (score < 6.5 && weaknesses.length < 3) {
      weaknesses.push(`Needs improvement on: ${row?.question?.questionText || 'a core topic'}`)
    }
  }

  if (!strengths.length) {
    strengths.push('Demonstrated basic understanding across multiple questions.')
  }

  if (!weaknesses.length) {
    weaknesses.push('Could add more depth and practical examples in responses.')
  }

  return {
    strengths,
    weaknesses,
    recommendation: weaknesses.length > strengths.length ? 'REJECT' : 'SHORTLIST',
    provider: 'heuristic',
  }
}

async function summarizeInterviewPerformance(answerRows) {
  if (!isOpenAIEnabled()) {
    return buildDeterministicSummary(answerRows)
  }

  try {
    const model = process.env.OPENAI_REPORT_MODEL || process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini'
    const compactAnswers = answerRows.map((row) => ({
      question: row?.question?.questionText || '',
      answerText: row?.answerText || '',
      finalScore: Number(row?.finalScore ?? row?.score ?? 0),
      feedback: row?.feedback || '',
    }))

    const prompt = [
      'Based on the following interview answers, return strict JSON with keys:',
      'strengths (array of strings), weaknesses (array of strings), recommendation (SHORTLIST or REJECT).',
      'Keep output concise and role-appropriate.',
      '',
      JSON.stringify(compactAnswers),
    ].join('\n')

    const response = await callOpenAI('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You generate structured interview summaries in JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const data = await response.json().catch(() => ({}))
    const content = data?.choices?.[0]?.message?.content || ''
    const parsed = extractJsonObject(content)

    if (!parsed) {
      return buildDeterministicSummary(answerRows)
    }

    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map((value) => String(value || '').trim()).filter(Boolean) : []
    const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map((value) => String(value || '').trim()).filter(Boolean) : []
    const recommendationRaw = String(parsed.recommendation || '').trim().toUpperCase()

    return {
      strengths: strengths.length ? strengths : ['Consistent effort shown during interview.'],
      weaknesses: weaknesses.length ? weaknesses : ['Provide deeper technical examples.'],
      recommendation: recommendationRaw === 'SHORTLIST' ? 'SHORTLIST' : 'REJECT',
      provider: 'openai',
    }
  } catch {
    return buildDeterministicSummary(answerRows)
  }
}

function buildAdaptiveSummary(answerRows) {
  const totals = {
    technical: 0,
    communication: 0,
    problemSolving: 0,
    confidence: 0,
    count: 0,
  }
  const strengths = []
  const weaknesses = []

  for (const row of answerRows) {
    const meta = row?.evaluationMeta || {}
    if (meta.technicalScore !== undefined) {
      totals.technical += Number(meta.technicalScore || 0)
      totals.communication += Number(meta.communicationScore || 0)
      totals.problemSolving += Number(meta.problemSolvingScore || 0)
      totals.confidence += Number(meta.confidenceScore || 0)
      totals.count += 1
    }

    const rowStrengths = normalizeStringArray(meta.strengths)
    const rowWeaknesses = normalizeStringArray(meta.weaknesses)
    strengths.push(...rowStrengths)
    weaknesses.push(...rowWeaknesses)
  }

  const avg = (value) => totals.count ? Number((value / totals.count).toFixed(2)) : 0
  const technicalScore = avg(totals.technical)
  const communicationScore = avg(totals.communication)
  const problemSolvingScore = avg(totals.problemSolving)
  const confidenceScore = avg(totals.confidence)
  const overallScore = Number(((technicalScore * 0.5) + (communicationScore * 0.2) + (problemSolvingScore * 0.3)).toFixed(2))
  const cheatingRiskScore = Number((10 - confidenceScore).toFixed(2))
  const recommendation = overallScore >= 7 ? 'SHORTLIST' : 'REJECT'

  return {
    overallScore,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    cheatingRiskScore,
    strengths: normalizeStringArray(strengths).slice(0, 5),
    weaknesses: normalizeStringArray(weaknesses).slice(0, 5),
    recommendation,
  }
}

async function summarizeAdaptiveInterviewPerformance(answerRows, resumeInsights) {
  const fallback = buildAdaptiveSummary(answerRows)

  const compact = answerRows.map((row) => ({
    question: row?.question?.questionText || '',
    score: row?.evaluationMeta?.score ?? row?.finalScore ?? row?.score ?? 0,
    strengths: row?.evaluationMeta?.strengths || [],
    weaknesses: row?.evaluationMeta?.weaknesses || [],
    feedback: row?.feedback || '',
  }))

  const resumeSummary = {
    skills: resumeInsights?.skills || [],
    frameworks: resumeInsights?.frameworks || [],
    projects: resumeInsights?.projects || [],
    experienceLevel: resumeInsights?.experienceLevel || 'junior',
  }

  const prompt = clampPrompt([
    'Summarize the adaptive interview results. Return JSON only with keys:',
    'strengths, weaknesses, recommendation, summary.',
    'Keep summary under 4 sentences.',
    '',
    `ROLE_CONTEXT: ${JSON.stringify(resumeSummary)}`,
    `ANSWERS: ${JSON.stringify(compact)}`,
  ].join('\n'), 4000)

  try {
    const parsed = await callOllamaJson({ prompt })
    return {
      ...fallback,
      strengths: normalizeStringArray(parsed.strengths).slice(0, 5) || fallback.strengths,
      weaknesses: normalizeStringArray(parsed.weaknesses).slice(0, 5) || fallback.weaknesses,
      recommendation: String(parsed.recommendation || fallback.recommendation).toUpperCase() === 'SHORTLIST'
        ? 'SHORTLIST'
        : 'REJECT',
      summary: String(parsed.summary || '').trim() || undefined,
    }
  } catch {
    return fallback
  }
}

export { evaluateInterviewAnswer, evaluateAdaptiveAnswer, summarizeInterviewPerformance, summarizeAdaptiveInterviewPerformance }
