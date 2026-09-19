import mongoose from 'mongoose'

import { connectDatabase, disconnectDatabase } from '../src/config/db.js'

try {
  await connectDatabase()

  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB did not reach connected state')
  }

  console.log('MongoDB readiness check passed.')
  await disconnectDatabase()
} catch (error) {
  console.error(`MongoDB readiness check failed: ${error.message}`)
  process.exitCode = 1
}
