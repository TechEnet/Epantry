import { env } from '../config/env.js'

export function requestLoggerMiddleware(req, res, next) {
  if (env.nodeEnv === 'test') return next()

  const startedAt = Date.now()

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    console.log(
      `[${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`,
    )
  })

  next()
}
