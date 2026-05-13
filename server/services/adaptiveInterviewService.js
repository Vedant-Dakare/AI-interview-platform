import { callOllamaJson, clampPrompt } from './ollamaService.js'

const DOMAIN_KEYWORDS = {
  frontend: ['react', 'vue', 'angular', 'next', 'vite', 'redux', 'css', 'html', 'frontend', 'ui', 'ux'],
  backend: ['node', 'express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'api', 'backend', 'postgres', 'mysql', 'mongodb', 'redis', 'graphql'],
  ml: ['machine learning', 'ml', 'tensorflow', 'pytorch', 'scikit-learn', 'nlp', 'cv', 'model', 'training', 'inference'],
  'problem-solving': ['algorithm', 'data structure', 'leetcode', 'complexity', 'graphs', 'dp'],
  projects: ['project', 'built', 'developed', 'designed', 'implemented'],
}

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

  if (normalizeQuestion(a) === normalizeQuestion(b)) {
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

function isDuplicateQuestion(candidate, askedQuestions = [], threshold = 0.82) {
  const normalized = normalizeQuestion(candidate)
  if (!normalized) {
    return true
  }

  return askedQuestions.some((question) => {
    const score = similarityScore(candidate, question)
    return score >= threshold || normalizeQuestion(question) === normalized
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

function sanitizeQuestion(raw, fallbackTopic = 'core', fallbackDifficulty = 'medium') {
  const question = String(raw?.question || raw?.questionText || '').trim()
  const topic = String(raw?.topic || fallbackTopic).trim()
  const difficulty = ['easy', 'medium', 'hard'].includes(String(raw?.difficulty || '').toLowerCase())
    ? String(raw.difficulty).toLowerCase()
    : fallbackDifficulty

  return {
    question: question || 'Tell me about a recent technical challenge you solved and how you approached it.',
    topic: topic || fallbackTopic,
    difficulty,
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

function buildQuestionPrompt({ role, resumeInsights, memory, activeDomain, nextDifficulty }) {
  const domainContext = filterResumeByDomain(resumeInsights, activeDomain)
  const recentQuestions = (memory?.askedQuestions || []).slice(-6)

  const prompt = [
    'You are a domain-focused technical interviewer.',
    'Generate ONE interview question only for the ACTIVE_DOMAIN.',
    'NEVER mix unrelated domains or technologies.',
    'Use resume context to be specific. Ask about real projects or skills.',
    'Avoid repetition. Return JSON only with keys: question, topic, difficulty.',
    '',
    `ROLE: ${role}`,
    `ACTIVE_DOMAIN: ${activeDomain}`,
    `DIFFICULTY: ${nextDifficulty || 'medium'}`,
    `DOMAIN_CONTEXT: ${JSON.stringify(domainContext)}`,
    `RECENT_QUESTIONS: ${JSON.stringify(recentQuestions)}`,
  ].join('\n')

  return clampPrompt(prompt, 3200)
}

function applyQuestionToMemory(memory, question, activeDomain, difficulty) {
  return {
    ...memory,
    askedQuestions: [...(memory.askedQuestions || []), question].slice(-16),
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

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const prompt = buildQuestionPrompt({ role, resumeInsights, memory, activeDomain: domain, nextDifficulty })
    try {
      const parsed = await callOllamaJson({
        prompt,
        timeoutMs: Number(process.env.OLLAMA_QUESTION_TIMEOUT_MS || 3500),
        maxRetries: Number(process.env.OLLAMA_QUESTION_RETRIES || 0),
        options: {
          temperature: Number(process.env.OLLAMA_QUESTION_TEMPERATURE || 0.35),
          top_p: Number(process.env.OLLAMA_QUESTION_TOP_P || 0.9),
        },
      })

      const candidate = sanitizeQuestion(parsed, domain, nextDifficulty || 'medium')
      if (!isDuplicateQuestion(candidate.question, askedQuestions)) {
        return candidate
      }
    } catch {
      // retry
    }
  }

  return {
    question: buildFallbackQuestion(domain, domainContext, resumeInsights, askedQuestions, nextDifficulty || 'medium'),
    topic: domain,
    difficulty: nextDifficulty || 'medium',
  }
}

function updateMemoryWithEvaluation(memory, evaluation, answerText, questionText) {
  const updated = { ...memory }
  const strengths = Array.isArray(evaluation?.strengths) ? evaluation.strengths : []
  const weaknesses = Array.isArray(evaluation?.weaknesses) ? evaluation.weaknesses : []

  updated.strengths = [...(updated.strengths || []), ...strengths].slice(0, 6)
  updated.weaknesses = [...(updated.weaknesses || []), ...weaknesses].slice(0, 6)
  updated.answerSummaries = [...(updated.answerSummaries || []), {
    question: questionText,
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
