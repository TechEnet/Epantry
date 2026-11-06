import mongoose from 'mongoose'

// Isolated from M19 business/operational analytics. No user identity, raw IP,
// full URL, query text, payment identifier or complete user-agent is stored.
const websiteEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, immutable: true },
  eventName: { type: String, required: true, index: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  receivedAt: { type: Date, default: Date.now, immutable: true },
  visitorId: { type: String, required: true, immutable: true },
  sessionId: { type: String, required: true, immutable: true },
  pageKey: { type: String, required: true, immutable: true },
  entityType: { type: String, default: '', immutable: true },
  entityId: { type: String, default: '', immutable: true },
  filterKey: { type: String, default: '', immutable: true },
  source: { type: String, default: 'unknown', immutable: true },
  medium: { type: String, default: 'unknown', immutable: true },
  campaign: { type: String, default: '', immutable: true },
  referrerHost: { type: String, default: '', immutable: true },
  deviceClass: { type: String, default: 'unknown', immutable: true },
  consentPolicyVersion: { type: String, required: true, immutable: true },
  expiresAt: { type: Date, required: true },
}, { collection: 'website_analytics_events', timestamps: false, versionKey: false, strict: 'throw' })

websiteEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
websiteEventSchema.index({ occurredAt: 1, eventName: 1 })
websiteEventSchema.index({ pageKey: 1, occurredAt: 1 })
websiteEventSchema.index({ sessionId: 1, occurredAt: 1 })
websiteEventSchema.index({ source: 1, occurredAt: 1 })

export const WebsiteAnalyticsEvent = mongoose.models.WebsiteAnalyticsEvent ||
  mongoose.model('WebsiteAnalyticsEvent', websiteEventSchema)
