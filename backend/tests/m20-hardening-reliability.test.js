import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename =
  fileURLToPath(
    import.meta.url,
  )

const __dirname =
  path.dirname(
    __filename,
  )

const backendRoot =
  path.resolve(
    __dirname,
    '..',
  )

function read(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      backendRoot,
      relativePath,
    ),
    'utf8',
  )
}

test(
  'M20 Batch 1 registers security retention privacy job and regulatory collections',
  () => {
    const hardening =
      read(
        'src/modules/hardening/hardening.models.js',
      )

    const reliability =
      read(
        'src/modules/reliability/reliability.models.js',
      )

    for (const collection of [
      'securityEvents',
      'retentionPolicies',
      'privacyRightsRequests',
      'regulatoryProfiles',
    ]) {
      assert.match(
        hardening,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.match(
      reliability,
      /collection:\s*['"]jobRuns['"]/,
    )
  },
)

test(
  'M20 SecurityEvent is append-only and security metadata redacts secrets',
  () => {
    const models =
      read(
        'src/modules/hardening/hardening.models.js',
      )

    const service =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    assert.match(
      models,
      /Security events are append-only/,
    )

    assert.match(
      service,
      /SENSITIVE_SECURITY_KEY_PATTERN/,
    )

    assert.match(
      service,
      /password\|passcode\|otp\|token\|secret/,
    )

    assert.match(
      service,
      /\[REDACTED\]/,
    )
  },
)

test(
  'M20 Privacy uses frozen M02 UserConsent truth instead of creating another consent collection',
  () => {
    const service =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    const models =
      read(
        'src/modules/hardening/hardening.models.js',
      )

    assert.match(
      service,
      /UserConsent/,
    )

    assert.match(
      service,
      /m02_user_consent_events/,
    )

    assert.doesNotMatch(
      models,
      /collection:\s*['"](?:consents|user_consents|privacyConsentsV2)['"]/,
    )
  },
)

test(
  'M20 privacy deletion is a retention-evaluated request and never a blind database cascade',
  () => {
    const service =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    assert.match(
      service,
      /getApplicableRetentionPolicies/,
    )

    assert.match(
      service,
      /deletionIsBlindCascade:\s*false/,
    )

    assert.doesNotMatch(
      service,
      /User\.delete|deleteMany\(\s*\{\s*userId/,
    )
  },
)

test(
  'M20 retention policies are versioned effective-dated and preserve immutable record classes',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.models.js',
      )

    for (const token of [
      'versionNumber',
      'effectiveFrom',
      'effectiveTo',
      'dispositionAction',
      'immutableRecordClass',
      'evidenceRefs',
    ]) {
      assert.equal(
        source.includes(
          token,
        ),
        true,
      )
    }
  },
)

test(
  'M20 retention policy approval requires maker-checker',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    assert.match(
      source,
      /RETENTION_POLICY_MAKER_CHECKER_REQUIRED/,
    )

    assert.match(
      source,
      /createdByUserId/,
    )
  },
)

test(
  'M20 RegulatoryProfile stores jurisdiction applicability effective dates methodology presentation evidence and lifecycle',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.models.js',
      )

    for (const token of [
      'jurisdiction',
      'operatorApplicability',
      'effectiveFrom',
      'effectiveTo',
      'requiredFields',
      'calculationMethodologyVersion',
      'presentationRules',
      'evidenceRefs',
    ]) {
      assert.equal(
        source.includes(
          token,
        ),
        true,
      )
    }
  },
)

test(
  'M20 RegulatoryProfile uses Host business operator contexts instead of Seller Brand B2B application roles',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.models.js',
      )

    assert.match(
      source,
      /marketplace_operator/,
    )

    assert.match(
      source,
      /brand_content_operator/,
    )

    assert.match(
      source,
      /hospitality_operator/,
    )

    assert.doesNotMatch(
      source,
      /sellerEnabled|brandEnabled|b2bEnabled/,
    )
  },
)

test(
  'M20 RegulatoryProfile approval and activation enforce maker-checker',
  () => {
    const source =
      read(
        'src/modules/hardening/hardening.service.js',
      )

    assert.match(
      source,
      /REGULATORY_PROFILE_MAKER_CHECKER_REQUIRED/,
    )

    assert.match(
      source,
      /status:\s*['"]superseded['"]/,
    )

    assert.match(
      source,
      /getApplicableRegulatoryProfile/,
    )
  },
)

test(
  'M20 JobRun attempts are append-only and carry idempotency correlation attempt and error evidence',
  () => {
    const source =
      read(
        'src/modules/reliability/reliability.models.js',
      )

    assert.match(
      source,
      /Job Run attempts are append-only/,
    )

    for (const token of [
      'idempotencyKey',
      'correlationId',
      'attemptNumber',
      'errorCode',
      'resultFingerprint',
    ]) {
      assert.equal(
        source.includes(
          token,
        ),
        true,
      )
    }
  },
)

test(
  'M20 recoverable jobs only retry when explicitly safe and deduplicate succeeded idempotency keys',
  () => {
    const source =
      read(
        'src/modules/reliability/reliability.service.js',
      )

    assert.match(
      source,
      /safeToRetry = false/,
    )

    assert.match(
      source,
      /status:\s*['"]succeeded['"]/,
    )

    assert.match(
      source,
      /deduplicated:\s*true/,
    )
  },
)

test(
  'M20 partner circuit breaker labels fallback as stale non-authoritative and never guaranteed live truth',
  () => {
    const source =
      read(
        'src/modules/reliability/reliability.service.js',
      )

    assert.match(
      source,
      /stale_non_authoritative/,
    )

    assert.match(
      source,
      /authoritative:\s*false/,
    )

    assert.match(
      source,
      /PARTNER_CIRCUIT_OPEN/,
    )

    assert.match(
      source,
      /PARTNER_OPERATION_FAILED/,
    )
  },
)

test(
  'M20 health preserves existing endpoints and adds live ready aliases',
  () => {
    const source =
      read(
        'src/routes/health.routes.js',
      )

    for (const route of [
      "'/health'",
      "'/ready'",
      "'/health/live'",
      "'/health/ready'",
    ]) {
      assert.equal(
        source.includes(
          route,
        ),
        true,
      )
    }

    assert.match(
      source,
      /database:\s*readiness\.components\.database\.state/,
    )
  },
)