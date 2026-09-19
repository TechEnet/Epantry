import mongoose from 'mongoose'

import { env } from '../../config/env.js'
import { FeatureFlag } from './meta.model.js'

const fallbackFeatures = {
  grocery: true,
  brands: true,
  recipes: true,
  aiCopilot: false,
  pantry: false,
  checkout: false,
}

export async function getBootstrapMeta() {
  let features = fallbackFeatures

  if (mongoose.connection.readyState === 1) {
    const flags = await FeatureFlag.find({}).select({ key: 1, enabled: 1, _id: 0 }).lean()

    if (flags.length) {
      features = Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled]))
    }
  }

  return {
    app: {
      name: 'EPANTRY',
      apiVersion: 'v1',
      environment: env.nodeEnv,
    },
    features,
  }
}
