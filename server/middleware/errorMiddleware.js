function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`)
  res.status(404)
  next(error)
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500)

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  })
}

export {
  notFound,
  errorHandler,
}
