import mongoose from 'mongoose'

const customerBookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['recipe', 'grocery'], required: true },
  slug: { type: String, trim: true, required: true, maxlength: 210 },
  title: { type: String, trim: true, required: true, maxlength: 220 },
  imageUrl: { type: String, trim: true, default: '' },
  subtitle: { type: String, trim: true, default: '' },
  sourceType: { type: String, enum: ['canonical', 'host'], required: true },
  sourceId: { type: String, default: '' },
}, { timestamps: true, collection: 'customerBookmarks' })

customerBookmarkSchema.index({ userId: 1, kind: 1, slug: 1 }, { unique: true })
customerBookmarkSchema.index({ userId: 1, createdAt: -1 })

export const CustomerBookmark = mongoose.models.CustomerBookmark ||
  mongoose.model('CustomerBookmark', customerBookmarkSchema)
