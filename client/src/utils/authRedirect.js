const AUTH_FLOW_HASHES = new Set([
  '#/',
  '#/login',
  '#/signup',
  '#/auth/callback',
])

function normalizeHashTarget(target) {
  if (typeof target !== 'string') {
    return ''
  }

  let value = target.trim()
  if (!value) {
    return ''
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value)
      value = parsed.hash ? parsed.hash.slice(1) : `${parsed.pathname}${parsed.search}`
    } catch {
      return ''
    }
  }

  if (value.startsWith('#')) {
    value = value.slice(1)
  }

  if (!value.startsWith('/')) {
    value = `/${value}`
  }

  return `#${value}`
}

function getDefaultDashboardHash(role) {
  if (role === 'ADMIN') {
    return '#/admin'
  }

  if (role === 'RECRUITER') {
    return '#/recruiter/dashboard'
  }

  return '#/dashboard'
}

function isAuthFlowHash(target) {
  const normalized = normalizeHashTarget(target)
  return AUTH_FLOW_HASHES.has(normalized)
}

function resolvePostAuthHash({ role, preferredTarget }) {
  const normalized = normalizeHashTarget(preferredTarget)

  if (normalized && !AUTH_FLOW_HASHES.has(normalized)) {
    return normalized
  }

  return getDefaultDashboardHash(role)
}

export {
  normalizeHashTarget,
  getDefaultDashboardHash,
  isAuthFlowHash,
  resolvePostAuthHash,
}
