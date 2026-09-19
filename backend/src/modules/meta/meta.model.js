import mongoose from 'mongoose'

const featureFlagSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    enabled: { type: Boolean, required: true, default: false },
    description: { type: String, default: '' },
  },
  { timestamps: true, collection: 'featureFlags' },
)

export const FeatureFlag =
  mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', featureFlagSchema)
