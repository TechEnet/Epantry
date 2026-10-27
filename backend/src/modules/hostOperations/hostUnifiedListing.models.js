import mongoose from 'mongoose'

const listingPacketSchema = new mongoose.Schema({
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceType: { type: String, required: true },
  type: { type: String, required: true, index: true },
  title: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'submitted_for_review', 'changes_requested', 'approved', 'rejected'], default: 'draft', index: true },
  packet: { type: mongoose.Schema.Types.Mixed, required: true },
  deletedAt: { type: Date, default: null, index: true },
  deletedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  correctionSection: { type: String, default: '' },
  reviewNote: { type: String, default: '' },
  reviewRevision: { type: Number, default: 0 },
  reviewHistory: [{
    decision: { type: String, enum: ['submitted_for_review', 'changes_requested', 'approved', 'rejected'] },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
    section: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
  bulkBatchId: { type: String, default: '', index: true },
}, { timestamps: true, strict: true, collection: 'hostUnifiedListingPackets', optimisticConcurrency: true })

listingPacketSchema.index({ ownerUserId: 1, updatedAt: -1 })
listingPacketSchema.index({ status: 1, submittedAt: -1 })
listingPacketSchema.index({ status: 1, approvedAt: -1 })
export const HostUnifiedListingPacket = mongoose.models.HostUnifiedListingPacket ||
  mongoose.model('HostUnifiedListingPacket', listingPacketSchema)
