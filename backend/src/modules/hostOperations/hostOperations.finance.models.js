import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

const appendOnlyGuard = (label) => function blockMutation(next) {
  next(new Error(`${label} is append-only.`))
}

const settlementLineSchema = new Schema({
  settlementId: { type: objectId, ref: 'HostSettlement', required: true, index: true },
  organizationId: { type: objectId, ref: 'MarketplaceOrganization', required: true, index: true },
  sellerOrderId: { type: objectId, ref: 'SellerOrder', required: true, unique: true, index: true },
  parentOrderId: { type: objectId, ref: 'ParentOrder', required: true, index: true },
  paymentLedgerEntryId: { type: objectId, ref: 'CommerceLedgerEntry', required: true },
  currency: { type: String, trim: true, uppercase: true, maxlength: 3, required: true, default: 'INR' },
  grossMerchandiseMinor: { type: Number, min: 0, required: true },
  platformFeeMinor: { type: Number, min: 0, required: true, default: 0 },
  taxWithheldMinor: { type: Number, min: 0, required: true, default: 0 },
  adjustmentMinor: { type: Number, required: true, default: 0 },
  netPayableMinor: { type: Number, required: true },
  sellerOrderStatusSnapshot: { type: String, required: true },
  sourcePolicyVersion: { type: String, required: true, default: 'm16-v1-no-commission-schedule' },
  occurredAt: { type: Date, required: true, default: Date.now },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'settlementLines',
  versionKey: false,
})

settlementLineSchema.index({ organizationId: 1, createdAt: -1 })

const settlementSchema = new Schema({
  organizationId: { type: objectId, ref: 'MarketplaceOrganization', required: true, index: true },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true, index: true },
  currency: { type: String, trim: true, uppercase: true, maxlength: 3, required: true, default: 'INR' },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'paid', 'void'],
    required: true,
    default: 'pending_approval',
    index: true,
  },
  totals: {
    grossMerchandiseMinor: { type: Number, min: 0, required: true, default: 0 },
    platformFeeMinor: { type: Number, min: 0, required: true, default: 0 },
    taxWithheldMinor: { type: Number, min: 0, required: true, default: 0 },
    adjustmentMinor: { type: Number, required: true, default: 0 },
    netPayableMinor: { type: Number, required: true, default: 0 },
  },
  lineCount: { type: Number, min: 0, required: true, default: 0 },
  createdByUserId: { type: objectId, ref: 'User', required: true },
  checkerUserId: { type: objectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  payoutReference: { type: String, trim: true, maxlength: 300, default: '' },
  reason: { type: String, trim: true, maxlength: 4000, required: true },
}, {
  timestamps: true,
  collection: 'settlements',
  versionKey: false,
})

settlementSchema.index({ organizationId: 1, periodStart: -1, periodEnd: -1 })

settlementSchema.pre('validate', function validatePeriod(next) {
  if (this.periodStart && this.periodEnd && this.periodEnd <= this.periodStart) {
    this.invalidate('periodEnd', 'Settlement period end must be after period start.')
  }
  next()
})

const settlementEventSchema = new Schema({
  settlementId: { type: objectId, ref: 'HostSettlement', required: true, index: true },
  organizationId: { type: objectId, ref: 'MarketplaceOrganization', required: true, index: true },
  eventType: {
    type: String,
    enum: ['created', 'approved', 'rejected', 'paid', 'voided'],
    required: true,
  },
  actorUserId: { type: objectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 4000, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  occurredAt: { type: Date, required: true, default: Date.now },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'settlementEvents',
  versionKey: false,
})

for (const [schema, label] of [
  [settlementLineSchema, 'Settlement line'],
  [settlementEventSchema, 'Settlement event'],
]) {
  schema.pre(
    ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
    appendOnlyGuard(label),
  )
}

export const HostSettlementLine =
  mongoose.models.HostSettlementLine ||
  mongoose.model('HostSettlementLine', settlementLineSchema)

export const HostSettlement =
  mongoose.models.HostSettlement ||
  mongoose.model('HostSettlement', settlementSchema)

export const HostSettlementEvent =
  mongoose.models.HostSettlementEvent ||
  mongoose.model('HostSettlementEvent', settlementEventSchema)