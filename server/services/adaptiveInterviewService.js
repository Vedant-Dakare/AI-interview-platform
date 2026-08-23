import { callOllamaJson } from './ollamaService.js'

const DOMAIN_KEYWORDS = {
  frontend: ['react', 'vue', 'angular', 'next', 'vite', 'redux', 'css', 'html', 'frontend', 'ui', 'ux'],
  backend: ['node', 'express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'api', 'backend', 'postgres', 'mysql', 'mongodb', 'redis', 'graphql'],
  ml: ['machine learning', 'ml', 'tensorflow', 'pytorch', 'scikit-learn', 'nlp', 'cv', 'model', 'training', 'inference'],
  'problem-solving': ['algorithm', 'data structure', 'leetcode', 'complexity', 'graphs', 'dp'],
  projects: ['project', 'built', 'developed', 'designed', 'implemented'],
}

const DOMAIN_LABELS = {
  frontend: 'Frontend Engineering',
  backend: 'Backend Development',
  ml: 'Machine Learning',
  'problem-solving': 'Data Structures & Algorithms',
  projects: 'Project Deep-Dive',
}

const DOMAIN_GUIDANCE = {
  frontend: [
    'Focus on component architecture, rendering behavior, state management, browser APIs, accessibility, or performance.',
    'Good questions describe a concrete UI situation (large lists, slow interactions, complex forms, stale data) and ask how the candidate would reason about and solve it.',
  ],
  backend: [
    'Focus on API design, data modeling, caching, concurrency, reliability, security, or scalability.',
    'Good questions describe a concrete system situation (spiky traffic, slow endpoint, duplicate writes, schema growth) and ask how the candidate would design or debug it, including HTTP methods/status codes or database choices where relevant.',
  ],
  ml: [
    'Focus on modeling decisions, evaluation metrics, data leakage, generalization, feature engineering, or production inference.',
    'Good questions present a concrete modeling symptom (train/validation gap, class imbalance, drifting features) and ask for diagnosis and a reasoned action plan.',
  ],
  'problem-solving': [
    'Present one concrete problem statement with input constraints (sizes, ordering, value ranges).',
    'Ask the candidate to explain their approach step by step, state time and space complexity, and compare against at least one alternative approach.',
  ],
  projects: [
    'Reference one specific project, skill, or achievement from the candidate profile by name.',
    'Ask about real decisions made: architecture choices, trade-offs, failure modes, testing, or what they would change in hindsight.',
  ],
}

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'who', 'whom', 'why', 'how', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'shall',
  'may', 'might', 'must', 'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'for', 'to', 'of',
  'in', 'on', 'at', 'by', 'with', 'from', 'as', 'that', 'this', 'these', 'those', 'it', 'its', 'you',
  'your', 'we', 'our', 'they', 'their', 'he', 'she', 'his', 'her', 'explain', 'describe', 'tell', 'about',
  'give', 'example', 'between', 'difference', 'different', 'using', 'use', 'used',
])

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeQuestion(text) {
  return normalizeText(text)
}

function extractQuestionText(question) {
  if (!question) {
    return ''
  }

  if (typeof question === 'string') {
    return question
  }

  return String(question.questionText || question.question || '')
}

function significantWords(text) {
  return normalizeQuestion(text)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

function bigrams(text) {
  const normalized = normalizeQuestion(text)
  if (!normalized) {
    return []
  }

  const grams = []
  for (let i = 0; i < normalized.length - 1; i += 1) {
    grams.push(normalized.slice(i, i + 2))
  }

  return grams
}

function similarityScore(a, b) {
  if (!a || !b) {
    return 0
  }

  const normalizedA = normalizeQuestion(a)
  const normalizedB = normalizeQuestion(b)
  if (normalizedA === normalizedB) {
    return 1
  }

  const aBigrams = bigrams(a)
  const bBigrams = bigrams(b)
  if (!aBigrams.length || !bBigrams.length) {
    return 0
  }

  const map = new Map()
  for (const gram of aBigrams) {
    map.set(gram, (map.get(gram) || 0) + 1)
  }

  let intersection = 0
  for (const gram of bBigrams) {
    const count = map.get(gram) || 0
    if (count > 0) {
      intersection += 1
      map.set(gram, count - 1)
    }
  }

  return (2 * intersection) / (aBigrams.length + bBigrams.length)
}

function wordOverlapScore(a, b) {
  const wordsA = new Set(significantWords(a))
  const wordsB = significantWords(b)

  if (!wordsA.size || !wordsB.length) {
    return 0
  }

  let hits = 0
  for (const word of wordsB) {
    if (wordsA.has(word)) {
      hits += 1
    }
  }

  return hits / Math.min(wordsA.size, wordsB.length)
}

function isDuplicateQuestion(candidate, askedQuestions = [], threshold = 0.72) {
  const normalized = normalizeQuestion(candidate)
  if (!normalized) {
    return true
  }

  return askedQuestions.some((question) => {
    const questionText = extractQuestionText(question)
    if (!questionText) {
      return false
    }

    if (normalizeQuestion(questionText) === normalized) {
      return true
    }

    // Catches reworded repeats: same significant concepts reshuffled.
    if (similarityScore(candidate, questionText) >= threshold) {
      return true
    }

    return wordOverlapScore(candidate, questionText) >= 0.65
  })
}

function detectDomains(resumeInsights, role) {
  if (role === 'dsa') {
    return ['problem-solving']
  }
  if(role === 'ml') {
    return ['ml']
  }
  if(role === 'frontend') {
    return ['frontend']
  }
  if(role === 'backend') {
    return ['backend']
  }

  const fields = [
    ...(resumeInsights?.skills || []),
    ...(resumeInsights?.frameworks || []),
    ...(resumeInsights?.technologies || []),
    ...(resumeInsights?.languages || []),
    ...(resumeInsights?.domains || []),
  ].map((item) => String(item || '').toLowerCase())

  const detected = new Set()

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((keyword) => fields.some((item) => item.includes(keyword)))) {
      detected.add(domain)
    }
  }

  if (role === 'backend') {
    detected.add('backend')
  }

  if (role === 'ml') {
    detected.add('ml')
  }

  if (role === 'dsa') {
    detected.add('problem-solving')
  }

  if (Array.isArray(resumeInsights?.projects) && resumeInsights.projects.length) {
    detected.add('projects')
  }

  return Array.from(detected)
}

function buildDomainPlan(resumeInsights, role, totalQuestions = 10) {
  const detected = detectDomains(resumeInsights, role)
  const priorityOrder = ['frontend', 'backend', 'ml', 'projects', 'problem-solving']

  const ordered = priorityOrder.filter((domain) => detected.includes(domain))
  if (!ordered.length) {
    ordered.push(role === 'ml' ? 'ml' : role === 'dsa' ? 'problem-solving' : 'backend')
  }

  const base = Math.max(1, Math.floor(totalQuestions / ordered.length))
  let remainder = Math.max(0, totalQuestions - (base * ordered.length))

  return ordered.map((domain, index) => {
    const extra = remainder > 0 ? 1 : 0
    remainder = Math.max(0, remainder - 1)
    const targetCount = base + (extra && index < ordered.length ? extra : 0)
    return { domain, targetCount }
  })
}

function buildDefaultMemory({ resumeInsights, role, targetQuestionCount = 10 }) {
  const domainPlan = buildDomainPlan(resumeInsights, role, targetQuestionCount)
  const activeDomain = domainPlan[0]?.domain || 'backend'

  return {
    askedQuestions: [],
    strengths: [],
    weaknesses: [],
    topicProgression: [],
    difficultyProgression: [],
    answerSummaries: [],
    domainPlan,
    activeDomain,
    domainQuestionCount: 0,
    completedDomains: [],
    currentRound: 1,
  }
}

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const VALID_QUESTION_TYPES = new Set(['scenario', 'conceptual', 'debugging', 'design', 'problem-solving'])

function sanitizeQuestion(raw, fallbackTopic = 'core', fallbackDifficulty = 'medium') {
  const question = String(raw?.question || raw?.questionText || '').trim()
  const topic = String(raw?.topic || fallbackTopic).trim().slice(0, 80)
  const difficulty = VALID_DIFFICULTIES.has(String(raw?.difficulty || '').toLowerCase())
    ? String(raw.difficulty).toLowerCase()
    : fallbackDifficulty
  const questionType = VALID_QUESTION_TYPES.has(String(raw?.questionType || raw?.type || '').toLowerCase())
    ? String(raw.questionType || raw.type).toLowerCase()
    : 'scenario'
  const expectedConcepts = Array.isArray(raw?.expectedConcepts)
    ? raw.expectedConcepts.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : []

  return {
    question: question || 'Tell me about a recent technical challenge you solved and how you approached it.',
    topic: topic || fallbackTopic,
    difficulty,
    questionType,
    expectedConcepts,
    followUpPossible: raw?.followUpPossible !== false,
  }
}

function pickFallbackSkill(domainContext, resumeInsights) {
  return domainContext?.skills?.[0]
    || domainContext?.frameworks?.[0]
    || domainContext?.technologies?.[0]
    || resumeInsights?.skills?.[0]
    || resumeInsights?.frameworks?.[0]
    || 'a recent project'
}

function buildFallbackQuestion(domain, domainContext, resumeInsights, askedQuestions, difficulty = 'medium') {
  const skill = pickFallbackSkill(domainContext, resumeInsights)
  const difficultyLabel = difficulty === 'hard'
    ? 'deep-dive'
    : difficulty === 'easy'
      ? 'foundational'
      : 'practical'

  const templates = {
    frontend: [
      `Walk me through a ${difficultyLabel} frontend challenge you solved using ${skill}. Focus on UI trade-offs and performance.`,
      `Describe a ${difficultyLabel} React or frontend issue you tackled. How did you diagnose and fix it?`,
      `How did you structure state management in a ${difficultyLabel} frontend feature?`,
    ],
    backend: [
      `Walk me through a ${difficultyLabel} backend challenge you solved using ${skill}. Focus on trade-offs and decisions.`,
      `Describe a ${difficultyLabel} API or service you built. How did you handle reliability?`,
      `Explain a ${difficultyLabel} database or caching decision you made and why.`,
    ],
    ml: [
      `Describe a ${difficultyLabel} ML problem you worked on involving ${skill}. How did you evaluate success?`,
      `How did you handle a ${difficultyLabel} model training or evaluation issue?`,
      `Explain a ${difficultyLabel} feature engineering choice you made and its impact.`,
    ],
    projects: [
      `Pick a project from your resume and explain a ${difficultyLabel} technical decision you made. What trade-offs did you consider?`,
      `What was the hardest ${difficultyLabel} challenge in one of your projects and how did you solve it?`,
      `Describe how you scaled or optimized a ${difficultyLabel} part of a project you built.`,
    ],
    'problem-solving': [
      `Explain a ${difficultyLabel} algorithmic problem you solved recently. What data structures did you use and why?`,
      `How did you reason about a ${difficultyLabel} time/space trade-off in a coding problem?`,
      `Walk me through a ${difficultyLabel} problem where you used dynamic programming or graphs.`,
    ],
  }

  const options = templates[domain] || [
    `Tell me about a ${difficultyLabel} technical challenge you solved recently using ${skill}.`,
  ]

  for (const candidate of options) {
    if (!isDuplicateQuestion(candidate, askedQuestions)) {
      return candidate
    }
  }

  return `${options[0]} Please focus on the ${domain} aspects only.`
}

function filterResumeByDomain(resumeInsights, domain) {
  const source = {
    skills: resumeInsights?.skills || [],
    frameworks: resumeInsights?.frameworks || [],
    technologies: resumeInsights?.technologies || [],
    languages: resumeInsights?.languages || [],
    projects: resumeInsights?.projects || [],
    domains: resumeInsights?.domains || [],
    experienceLevel: resumeInsights?.experienceLevel || 'junior',
  }

  const keywords = DOMAIN_KEYWORDS[domain] || []
  if (!keywords.length) {
    return source
  }

  const match = (value) => keywords.some((keyword) => String(value || '').toLowerCase().includes(keyword))

  const projects = source.projects.filter((project) => match(project))

  return {
    skills: source.skills.filter(match),
    frameworks: source.frameworks.filter(match),
    technologies: source.technologies.filter(match),
    languages: source.languages.filter(match),
    projects: projects.length ? projects : source.projects.slice(0, 2),
    domains: source.domains.filter(match),
    experienceLevel: source.experienceLevel,
  }
}

// Builds a compact candidate profile string within a character budget instead of
// blindly truncating the whole prompt (which used to cut JSON mid-array).
function compactCandidateProfile(domainContext, budgetChars = 900) {
  const parts = []
  const push = (label, values, maxItems) => {
    if (!Array.isArray(values) || !values.length) {
      return
    }
    const joined = values.slice(0, maxItems).map((value) => String(value).slice(0, 60)).join(', ')
    if (joined) {
      parts.push(`${label}: ${joined}`)
    }
  }

  push('Skills', [...(domainContext.skills || []), ...(domainContext.frameworks || [])], 10)
  push('Technologies', domainContext.technologies || [], 8)
  push('Languages', domainContext.languages || [], 5)
  push('Projects', domainContext.projects || [], 4)

  let output = parts.join(' | ')
  if (output.length > budgetChars) {
    output = `${output.slice(0, budgetChars)}...`
  }

  return output || 'No resume details available'
}

function getRecentScores(memory) {
  const summaries = Array.isArray(memory?.answerSummaries) ? memory.answerSummaries : []
  return summaries.slice(-4).map((summary) => Number(summary?.score ?? 0).toFixed(1))
}

function getCoveredTopics(memory) {
  const asked = Array.isArray(memory?.askedQuestions) ? memory.askedQuestions : []
  const topics = asked
    .map((question) => (typeof question === 'object' && question !== null ? String(question.topic || '') : ''))
    .filter(Boolean)
    .map((topic) => topic.toLowerCase())

  return Array.from(new Set(topics)).slice(-8)
}

function getRecentAskedLines(memory, maxQuestions = 6) {
  const asked = Array.isArray(memory?.askedQuestions) ? memory.askedQuestions : []
  return asked
    .slice(-maxQuestions)
    .map((question) => `- ${extractQuestionText(question).slice(0, 180)}`)
    .filter((line) => line.length > 3)
}

function buildQuestionPrompt({ role, resumeInsights, memory, activeDomain, nextDifficulty }) {
  const domainContext = filterResumeByDomain(resumeInsights, activeDomain)
  const domainLabel = DOMAIN_LABELS[activeDomain] || 'Software Engineering'
  const guidance = (DOMAIN_GUIDANCE[activeDomain] || DOMAIN_GUIDANCE.backend)
    .map((line) => `- ${line}`)
    .join('\n')
  const askedLines = getRecentAskedLines(memory)
  const avoidTopics = getCoveredTopics(memory)
  const recentScores = getRecentScores(memory)

  const difficultyGuide = nextDifficulty === 'hard'
    ? 'HARD: system-design or trade-off depth. Involve scale, failure modes, or conflicting constraints.'
    : nextDifficulty === 'easy'
      ? 'EASY: a contextualized fundamental the candidate can reason through. Still scenario-based, not a definition.'
      : 'MEDIUM: an applied scenario requiring practical reasoning.'

  const sections = [
    `You are a senior ${domainLabel} interviewer conducting a LIVE technical interview for a ${String(role || activeDomain).toUpperCase()} role.`,
    'Write exactly ONE interview question for the candidate\'s next turn.',
    '',
    'QUALITY RULES:',
    '- Ask a SPECIFIC, self-contained question (3-6 sentences) describing a realistic situation, constraint, or goal.',
    '- Require reasoning, trade-offs, diagnosis, or design decisions. NEVER ask a bare definition like "What is X?" or "Explain Y."',
    guidance,
    `- Target difficulty: ${difficultyGuide}`,
    `- Ground the question in the candidate's own skills/projects when possible: ${domainContext.experienceLevel || 'junior'} level candidate.`,
    '- Do NOT repeat or lightly rephrase any listed previously-asked question. Explore a NEW angle or subtopic.',
    '',
    `CANDIDATE_PROFILE: ${compactCandidateProfile(domainContext)}`,
    `TOPIC_AREA: ${activeDomain}${avoidTopics.length ? ` (subtopics already covered: ${avoidTopics.join(', ')})` : ''}`,
    `TARGET_DIFFICULTY: ${nextDifficulty || 'medium'}`,
    ...(recentScores.length ? [`RECENT_ANSWER_SCORES: [${recentScores.join(', ')}]`] : []),
    ...(askedLines.length ? ['PREVIOUSLY_ASKED:', ...askedLines] : []),
    '',
    'Respond ONLY with a JSON object using exactly these keys:',
    '{"question": "...", "topic": "short subtopic label", "difficulty": "easy|medium|hard", "questionType": "scenario|conceptual|debugging|design|problem-solving", "expectedConcepts": ["3-6 concepts a strong answer must cover"], "followUpPossible": true}',
  ]

  return sections.join('\n')
}

function applyQuestionToMemory(memory, question, activeDomain, difficulty) {
  const questionText = extractQuestionText(question)
  const entry = typeof question === 'object' && question !== null
    ? { ...question, questionText }
    : { questionText: String(question || ''), topic: '', difficulty: difficulty || 'medium' }

  return {
    ...memory,
    askedQuestions: [...(memory.askedQuestions || []), entry].slice(-16),
    topicProgression: [...(memory.topicProgression || []), activeDomain].slice(-16),
    difficultyProgression: [...(memory.difficultyProgression || []), difficulty].slice(-16),
    domainQuestionCount: Number(memory.domainQuestionCount || 0) + 1,
  }
}

function advanceDomainIfNeeded(memory) {
  const plan = Array.isArray(memory?.domainPlan) ? memory.domainPlan : []
  const currentDomain = memory?.activeDomain || plan[0]?.domain || 'backend'
  const currentTarget = plan.find((item) => item.domain === currentDomain)?.targetCount || 1
  const currentCount = Number(memory?.domainQuestionCount || 0)

  if (currentCount < currentTarget) {
    return memory
  }

  const currentIndex = Math.max(0, plan.findIndex((item) => item.domain === currentDomain))
  const nextDomain = plan[currentIndex + 1]?.domain

  if (!nextDomain) {
    return memory
  }

  return {
    ...memory,
    completedDomains: [...(memory.completedDomains || []), currentDomain],
    activeDomain: nextDomain,
    domainQuestionCount: 0,
    currentRound: Number(memory.currentRound || 1) + 1,
  }
}

async function generateAdaptiveQuestion({ role, resumeInsights, memory, activeDomain, nextDifficulty }) {
  const domain = activeDomain || memory?.activeDomain || 'backend'
  const askedQuestions = memory?.askedQuestions || []
  const maxAttempts = Number(process.env.OLLAMA_QUESTION_ATTEMPTS || 3)
  const domainContext = filterResumeByDomain(resumeInsights, domain)
  const difficulty = VALID_DIFFICULTIES.has(String(nextDifficulty)) ? nextDifficulty : 'medium'

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const prompt = buildQuestionPrompt({ role, resumeInsights, memory, activeDomain: domain, nextDifficulty })
    try {
      const parsed = await callOllamaJson({
        prompt,
        format: 'json',
        timeoutMs: Number(process.env.OLLAMA_QUESTION_TIMEOUT_MS || 20000),
        maxRetries: Number(process.env.OLLAMA_QUESTION_RETRIES || 0),
        options: {
          temperature: Number(process.env.OLLAMA_QUESTION_TEMPERATURE || 0.55) + attempt * 0.15,
          top_p: Number(process.env.OLLAMA_QUESTION_TOP_P || 0.9),
          num_predict: Number(process.env.OLLAMA_QUESTION_NUM_PREDICT || 400),
        },
      })

      const candidate = sanitizeQuestion(parsed, domain, difficulty)
      if (!isDuplicateQuestion(candidate.question, askedQuestions)) {
        return candidate
      }
    } catch (error) {
      console.warn(`[Interview] Question generation attempt ${attempt + 1}/${maxAttempts} failed: ${error?.message || 'unknown error'}`)
    }
  }

  return {
    question: buildFallbackQuestion(domain, domainContext, resumeInsights, askedQuestions, difficulty),
    topic: domain,
    difficulty,
    questionType: 'scenario',
    expectedConcepts: [],
    followUpPossible: true,
  }
}

function updateMemoryWithEvaluation(memory, evaluation, answerText, questionText) {
  const updated = { ...memory }
  const strengths = Array.isArray(evaluation?.strengths) ? evaluation.strengths : []
  const weaknesses = Array.isArray(evaluation?.weaknesses) ? evaluation.weaknesses : []

  updated.strengths = [...(updated.strengths || []), ...strengths].slice(0, 6)
  updated.weaknesses = [...(updated.weaknesses || []), ...weaknesses].slice(0, 6)
  updated.answerSummaries = [...(updated.answerSummaries || []), {
    question: extractQuestionText(questionText),
    answer: String(answerText || '').slice(0, 260),
    score: Number(evaluation?.score || 0),
  }].slice(-10)

  return advanceDomainIfNeeded(updated)
}

export {
  buildDefaultMemory,
  generateAdaptiveQuestion,
  sanitizeQuestion,
  updateMemoryWithEvaluation,
  applyQuestionToMemory,
  filterResumeByDomain,
  detectDomains,
}
