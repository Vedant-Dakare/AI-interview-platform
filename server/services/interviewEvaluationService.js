import { buildEmbeddingVector, clampSimilarity, cosineSimilarity } from './embeddingService.js'

function toFixedNumber(value, digits = 4) {
  return Number(Number(value || 0).toFixed(digits))
}

function clampScore(value, min = 0, max = 10) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return min
  }

  return Number(Math.max(min, Math.min(max, numeric)).toFixed(2))
}

// Predefined-question mode: deterministic heuristic scoring only (no LLM).
// Compares candidate answer against the predefined ideal answer.
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

function combineFinalScore(similarityScore, llmScore) {
  const finalScore = (Number(similarityScore) * 4) + (Number(llmScore) * 0.6)
  return Number(Math.max(0, Math.min(10, finalScore)).toFixed(2))
}

async function evaluateInterviewAnswer({ questionText, expectedAnswerText, expectedConcepts = [], candidateAnswerText }) {
  const answerText = String(candidateAnswerText || '').trim()
  const referenceText = String(expectedAnswerText || questionText || '').trim()

  const answerEmbedding = buildEmbeddingVector(answerText)
  const referenceEmbedding = buildEmbeddingVector(referenceText)
  const llmResult = evaluateByConceptCoverage(questionText, answerText, expectedConcepts)

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
  return buildDeterministicSummary(answerRows)
}

export {
  evaluateInterviewAnswer,
  summarizeInterviewPerformance,
  buildDeterministicSummary,
}
