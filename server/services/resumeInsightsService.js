import { callOllamaJson, clampPrompt } from './ollamaService.js'

const MAX_RESUME_CHARS = Number(process.env.RESUME_MAX_CHARS || 3500)

const KNOWN_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'go', 'c++', 'c#', 'node', 'react', 'vue', 'angular',
  'express', 'fastapi', 'django', 'flask', 'spring', 'postgres', 'mysql', 'mongodb', 'redis', 'aws',
  'azure', 'gcp', 'docker', 'kubernetes', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
]

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function uniqueStrings(values) {
  const seen = new Set()
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => value && !seen.has(value.toLowerCase()) && seen.add(value.toLowerCase()))
}

function buildEmptyInsights() {
  return {
    skills: [],
    technologies: [],
    frameworks: [],
    languages: [],
    projects: [],
    domains: [],
    experienceLevel: 'junior',
    yearsExperience: null,
    highlights: [],
  }
}

function fallbackInsights(resumeText) {
  const normalized = normalizeText(resumeText).toLowerCase()
  const hits = KNOWN_SKILLS.filter((skill) => normalized.includes(skill))

  return {
    ...buildEmptyInsights(),
    skills: uniqueStrings(hits),
    technologies: uniqueStrings(hits.filter((skill) => !['react', 'vue', 'angular', 'spring'].includes(skill))),
    frameworks: uniqueStrings(hits.filter((skill) => ['react', 'vue', 'angular', 'spring', 'django', 'flask', 'fastapi', 'express'].includes(skill))),
    languages: uniqueStrings(hits.filter((skill) => ['javascript', 'typescript', 'python', 'java', 'go', 'c++', 'c#'].includes(skill))),
  }
}

function sanitizeInsights(raw) {
  if (!raw || typeof raw !== 'object') {
    return buildEmptyInsights()
  }

  return {
    skills: uniqueStrings(Array.isArray(raw.skills) ? raw.skills : []),
    technologies: uniqueStrings(Array.isArray(raw.technologies) ? raw.technologies : []),
    frameworks: uniqueStrings(Array.isArray(raw.frameworks) ? raw.frameworks : []),
    languages: uniqueStrings(Array.isArray(raw.languages) ? raw.languages : []),
    projects: uniqueStrings(Array.isArray(raw.projects) ? raw.projects : []),
    domains: uniqueStrings(Array.isArray(raw.domains) ? raw.domains : []),
    experienceLevel: ['junior', 'mid', 'senior', 'lead'].includes(String(raw.experienceLevel || '').toLowerCase())
      ? String(raw.experienceLevel || '').toLowerCase()
      : 'junior',
    yearsExperience: Number.isFinite(Number(raw.yearsExperience)) ? Number(raw.yearsExperience) : null,
    highlights: uniqueStrings(Array.isArray(raw.highlights) ? raw.highlights : []),
  }
}

async function extractResumeInsights(resumeText) {
  const normalized = normalizeText(resumeText)
  if (!normalized) {
    return buildEmptyInsights()
  }

  const trimmed = normalized.slice(0, MAX_RESUME_CHARS)
  const prompt = clampPrompt([
    'Extract resume insights as strict JSON with keys:',
    'skills, technologies, frameworks, languages, projects, domains, experienceLevel, yearsExperience, highlights.',
    'experienceLevel must be one of: junior, mid, senior, lead.',
    'Return JSON only. Keep arrays short (max 8 items).',
    '',
    `RESUME_TEXT: ${trimmed}`,
  ].join('\n'), 4000)

  try {
    const parsed = await callOllamaJson({
      prompt,
      timeoutMs: Number(process.env.OLLAMA_RESUME_TIMEOUT_MS || 5000),
      maxRetries: Number(process.env.OLLAMA_RESUME_RETRIES || 0),
    })
    return sanitizeInsights(parsed)
  } catch {
    return fallbackInsights(trimmed)
  }
}

export { extractResumeInsights, buildEmptyInsights, sanitizeInsights }
