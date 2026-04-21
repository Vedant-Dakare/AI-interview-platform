const EMBEDDING_DIMENSION = 128

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function hashToken(token) {
  let hash = 2166136261

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function buildEmbeddingVector(text) {
  const vector = Array(EMBEDDING_DIMENSION).fill(0)
  const tokens = tokenize(text)

  if (!tokens.length) {
    return vector
  }

  for (const token of tokens) {
    const hash = hashToken(token)
    const bucket = hash % EMBEDDING_DIMENSION
    vector[bucket] += 1
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (magnitude === 0) {
    return vector
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)))
}

function cosineSimilarity(vectorA, vectorB) {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  const length = Math.min(vectorA.length, vectorB.length)

  for (let index = 0; index < length; index += 1) {
    const valueA = Number(vectorA[index]) || 0
    const valueB = Number(vectorB[index]) || 0

    dotProduct += valueA * valueB
    normA += valueA * valueA
    normB += valueB * valueB
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

function clampSimilarity(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4))
}

function scoreAnswer(answerText, idealAnswerText) {
  const answerEmbedding = buildEmbeddingVector(answerText)
  const idealEmbedding = buildEmbeddingVector(idealAnswerText)
  const similarityScore = clampSimilarity(cosineSimilarity(answerEmbedding, idealEmbedding))
  const score = Number((similarityScore * 100).toFixed(2))

  return {
    answerEmbedding,
    idealEmbedding,
    similarityScore,
    score,
  }
}

export { buildEmbeddingVector, cosineSimilarity, clampSimilarity, scoreAnswer }
