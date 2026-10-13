// Predefined-question mode: resume insights are extracted heuristically (no LLM).
// Used only for record-keeping / recruiter display, NOT for question generation.
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
  return fallbackInsights(trimmed)
}

export { extractResumeInsights, buildEmptyInsights, sanitizeInsights }
