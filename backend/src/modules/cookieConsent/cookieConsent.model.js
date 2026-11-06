import mongoose from 'mongoose'

/*
 * M1-A cookie choices are deliberately separate from M02 account terms,
 * email-marketing consent and M19 operational analytics.
 *
 * Guest records expire. Account records persist until the user changes their
 * choice or the relevant privacy lifecycle deletes the account's data.
 */
const consentRevisionSchema = new mongoose.Schema({
  decidedAt: { type: Date, required: true },
  source: { type: String, enum: ['banner', 'settings'], required: true },
  policyVersion: { type: String, required: true },
  preferences: { type: Boolean, required: true },
  analytics: { type: Boolean, required: true },
}, { _id: false })

const cookieConsentSchema = new mongoose.Schema({
  subjectKey: { type: String, required: true, unique: true, immutable: true },
  subjectType: { type: String, enum: ['guest', 'user'], required: true, immutable: true },
  policyVersion: { type: String, required: true },
  preferences: { type: Boolean, required: true, default: false },
  analytics: { type: Boolean, required: true, default: false },
  decidedAt: { type: Date, required: true },
  revisions: { type: [consentRevisionSchema], default: [] },
  expiresAt: { type: Date, default: null },
}, { timestamps: true, collection: 'cookie_consents' })

cookieConsentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const CookieConsent = mongoose.models.CookieConsent ||
  mongoose.model('CookieConsent', cookieConsentSchema)
