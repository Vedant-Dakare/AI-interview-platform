import { buildEmbeddingVector, clampSimilarity, cosineSimilarity } from './embeddingService.js'
import { callOpenAI, extractJsonObject, isOpenAIEnabled } from './openaiService.js'

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
}

export { evaluateInterviewAnswer, summarizeInterviewPerformance }
