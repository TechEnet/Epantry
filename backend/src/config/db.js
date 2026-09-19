import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase() {
  const connection = await mongoose.connect(env.mongodbUri)
  console.log(`MongoDB connected: ${connection.connection.host}`)
  return connection
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}
