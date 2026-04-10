import crypto from 'crypto'

function generateInterviewToken() {
  return crypto.randomBytes(48).toString('base64url')
}

function hashInterviewToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getTokenExpiry(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

function buildInterviewLink(token) {
  const baseUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '')
  return `${baseUrl}/#/interview/${token}`
}

export {
  generateInterviewToken,
  hashInterviewToken,
  getTokenExpiry,
  buildInterviewLink,
}
