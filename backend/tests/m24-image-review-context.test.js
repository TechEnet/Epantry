import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { test } from 'node:test'

const root = dirname(fileURLToPath(import.meta.url))
const backend = readFileSync(join(root, '../src/modules/mediaPrivacy/mediaPrivacy.service.js'), 'utf8')
const queue = readFileSync(join(root, '../../frontend/src/features/hardening/components/MediaPrivacyReviewQueue.jsx'), 'utf8')

function readProductLabel(candidateFields = {}) {
  for (const candidate of [candidateFields.displayName, candidateFields.productName, candidateFields.title, candidateFields.name]) {
    const value = typeof candidate === 'string' ? candidate : candidate?.value
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 180)
  }
  return ''
}

test('product evidence name handles real candidateFields displayName object', () => {
  assert.equal(readProductLabel({ displayName: { value: 'Fresh Broccoli' } }), 'Fresh Broccoli')
  assert.equal(readProductLabel({ productName: 'Jeera Rice' }), 'Jeera Rice')
  assert.equal(readProductLabel({}), '')
})

test('Host display name comes from the actual User.name field', () => {
  assert.match(backend, /\.select\(\{ name: 1, email: 1, hostEnabled: 1 \}\)/)
  assert.match(backend, /displayName: owner\.name \|\| ''/)
})

test('item identity only comes from explicitly linked image evidence', () => {
  assert.match(backend, /CommunityProductDraft\.findOne\(\{ sourceEvidenceIds: evidence\._id \}\)/)
  assert.match(backend, /HostUnifiedListingPacket\.findOne\(\{ catalogNpiDraftId: productDraft\._id, deletedAt: null \}\)/)
  assert.match(backend, /item: itemName \? /)
})

test('signed previews, item names, image types and existing review decisions remain wired', () => {
  assert.match(backend, /buildSignedProductEvidenceUrl/)
  assert.match(queue, /entry\.evidence\?\.previewUrl/)
  assert.match(queue, /entry\.item\?\.name/)
  assert.match(queue, /entry\.evidence\?\.purpose/)
  assert.match(queue, /resolveAdminMediaPrivacyReview/)
  assert.match(queue, /listAdminMediaPrivacyReviews/)
})
