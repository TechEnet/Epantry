import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makeReportAccessToken,
  tokenDigest,
  tokenMatches,
  publicReportView,
  validateDecisionTransition,
} from '../src/modules/dsa/dsa.models.js'

test('guest report access keys are unpredictable and stored only as a digest', () => {
  const a = makeReportAccessToken()
  const b = makeReportAccessToken()
  assert.notEqual(a, b)
  assert.equal(a.length >= 40, true)
  assert.equal(tokenMatches(a, tokenDigest(a)), true)
  assert.equal(tokenMatches(b, tokenDigest(a)), false)
  assert.equal(tokenMatches('invalid', tokenDigest(a)), false)
})

test('public tracking omits private contact and administrative notes', () => {
  const view = publicReportView({ reference: 'DSA-example', status: 'under_review',
    listingUrl: '/grocery/product/foo', reason: 'illegal_product',
    reporterContact: 'person@example.com', reviewNotes: 'private',
    accessTokenDigest: 'secret', timeline: [{ note: 'secret' }],
  })
  assert.equal(view.reference, 'DSA-example')
  assert.equal('reporterContact' in view, false)
  assert.equal('reviewNotes' in view, false)
  assert.equal('accessTokenDigest' in view, false)
  assert.equal('timeline' in view, false)
})

test('decision and appeal state machine disallows premature or duplicate appeals', () => {
  assert.equal(validateDecisionTransition({ status: 'submitted' }, 'decide'), true)
  assert.equal(validateDecisionTransition({ status: 'under_review' }, 'decide'), true)
  assert.equal(validateDecisionTransition({ status: 'decision_issued' }, 'decide'), false)
  assert.equal(validateDecisionTransition({ status: 'decision_issued' }, 'appeal'), true)
  assert.equal(validateDecisionTransition({ status: 'submitted' }, 'appeal'), false)
  assert.equal(validateDecisionTransition({ status: 'appeal_pending' }, 'appeal'), false)
  assert.equal(validateDecisionTransition({ status: 'appeal_pending' }, 'appealDecision'), true)
})
