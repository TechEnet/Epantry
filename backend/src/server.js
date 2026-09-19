import app from './app.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { env } from './config/env.js'

let server

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down EPANTRY backend...`)

  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }

  await disconnectDatabase()
  process.exit(0)
}

async function startServer() {
  try {
    await connectDatabase()

    server = app.listen(env.port, () => {
      console.log('')
      console.log('=================================')
      console.log('       EPANTRY BACKEND')
      console.log('=================================')
      console.log(`Environment : ${env.nodeEnv}`)
      console.log(`API         : http://localhost:${env.port}`)
      console.log(`Health      : http://localhost:${env.port}/api/v1/health`)
      console.log(`Ready       : http://localhost:${env.port}/api/v1/ready`)
      console.log(`Bootstrap   : http://localhost:${env.port}/api/v1/meta/bootstrap`)
      console.log('=================================')
      console.log('')
    })
  } catch (error) {
    console.error('Backend startup failed:', error.message)
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

startServer()
