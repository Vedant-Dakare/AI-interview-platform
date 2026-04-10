function requireAdminApiKey(req, res, next) {
  const configuredKey = process.env.INTERVIEW_ADMIN_API_KEY

  if (!configuredKey) {
    res.status(500)
    throw new Error('INTERVIEW_ADMIN_API_KEY is not configured')
  }

  const providedKey = req.headers['x-admin-api-key']

  if (!providedKey || providedKey !== configuredKey) {
    res.status(401)
    throw new Error('Unauthorized: invalid admin API key')
  }

  next()
}

export {
  requireAdminApiKey,
}
