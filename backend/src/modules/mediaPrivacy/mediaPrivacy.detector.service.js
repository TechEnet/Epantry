import crypto from 'crypto'

import { mediaPrivacyDetectorResultSchema } from './mediaPrivacy.validation.js'

const SEVERITY_WEIGHT = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
})

const DIRECT_REDACTION_RISKS = new Set([
  'face',
  'home_address',
  'personal_correspondence',
  'household_information',
  'geolocation_metadata',
])

const REVIEW_RISKS = new Set([
  'receipt_personal_data',
  'device_metadata',
  'sensitive_text',
  'other',
])

/*
|-----------------------------------------------------------------------------
| Privacy scanner contract
|-----------------------------------------------------------------------------
|
| v4 adds product/package context awareness, automatic recovery from stale holds, and a narrowly-scoped Host package-evidence continuity rule for detector outages. The privacy layer still fails
| closed for genuinely private or ambiguous content, but ordinary commercial
| packaging facts (manufacturer/distributor address, customer-care contact,
| barcode, GTIN, nutrition, ingredients, regulatory identifiers, etc.) are not
| treated as personal-data findings merely because text is visible.
|
| Changing this version also causes the scanner to re-evaluate evidence that
| was held by an older contract instead of permanently caching a false-positive
| review state.
|
*/
export const MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION =
  'm24-privacy-v4-host-package-continuity'

function clean(value) {
  return String(value || '').trim()
}

export function fingerprintSensitiveDetectionEvidence(value) {
  const normalized = clean(value)

  if (!normalized) {
    return ''
  }

  return crypto
    .createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex')
}

export function normalizeMediaPrivacyDetectorResult(result) {
  const parsed = mediaPrivacyDetectorResultSchema.parse(result)

  return {
    provider: clean(parsed.provider),
    model: clean(parsed.model),
    status: parsed.status,
    scannerVersion: clean(parsed.scannerVersion),
    failureCode: clean(parsed.failureCode).toUpperCase(),
    findings: parsed.findings.map((finding) => ({
      riskType: finding.riskType,
      severity: finding.severity,
      confidence: Number(finding.confidence),
      boundingBox: finding.boundingBox || null,
      reasonCode: clean(finding.reasonCode).toUpperCase(),
      evidenceFingerprint: clean(finding.evidenceFingerprint).toLowerCase(),
    })),
  }
}

export function buildUnavailableMediaPrivacyDetectorResult({
  provider = 'unconfigured',
  model = '',
  failureCode = 'PRIVACY_DETECTOR_UNAVAILABLE',
} = {}) {
  return normalizeMediaPrivacyDetectorResult({
    provider,
    model,
    status: 'unavailable',
    scannerVersion: MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION,
    findings: [],
    failureCode,
  })
}

export function deriveMediaPrivacyDecision({ detectorResult, metadataResult }) {
  const normalized = normalizeMediaPrivacyDetectorResult(detectorResult)
  const reasonCodes = new Set()

  if (normalized.status !== 'completed') {
    reasonCodes.add(
      normalized.failureCode ||
        (normalized.status === 'failed'
          ? 'PRIVACY_DETECTOR_FAILED'
          : 'PRIVACY_DETECTOR_UNAVAILABLE'),
    )

    return {
      decision: 'needs_review',
      highestSeverity: null,
      reasonCodes: [...reasonCodes],
    }
  }

  if (metadataResult?.status === 'failed' || metadataResult?.stripped !== true) {
    reasonCodes.add(
      metadataResult?.failureCode || 'PRIVACY_METADATA_SANITATION_REQUIRED',
    )

    return {
      decision: 'needs_review',
      highestSeverity: null,
      reasonCodes: [...reasonCodes],
    }
  }

  let highestSeverity = null
  let highestWeight = 0
  let redactionRequired = false
  let reviewRequired = false

  for (const finding of normalized.findings) {
    const weight = SEVERITY_WEIGHT[finding.severity] || 0

    if (weight > highestWeight) {
      highestWeight = weight
      highestSeverity = finding.severity
    }

    reasonCodes.add(finding.reasonCode)

    if (
      DIRECT_REDACTION_RISKS.has(finding.riskType) ||
      finding.severity === 'critical' ||
      finding.severity === 'high'
    ) {
      redactionRequired = true
      continue
    }

    if (
      REVIEW_RISKS.has(finding.riskType) ||
      finding.severity === 'medium'
    ) {
      reviewRequired = true
    }
  }

  if (redactionRequired) {
    return {
      decision: 'redaction_required',
      highestSeverity,
      reasonCodes: [...reasonCodes],
    }
  }

  if (reviewRequired) {
    return {
      decision: 'needs_review',
      highestSeverity,
      reasonCodes: [...reasonCodes],
    }
  }

  return {
    decision: 'safe_to_use',
    highestSeverity,
    reasonCodes: [...reasonCodes],
  }
}

export function buildSuggestedRedactionOperations(findings = []) {
  const normalizedFindings = Array.isArray(findings) ? findings : []

  return normalizedFindings
    .filter(
      (finding) =>
        finding?.boundingBox &&
        (
          DIRECT_REDACTION_RISKS.has(finding.riskType) ||
          finding.severity === 'critical' ||
          finding.severity === 'high'
        ),
    )
    .slice(0, 50)
    .map((finding) => ({
      operationType: 'solid_mask',
      boundingBox: finding.boundingBox,
      reasonCode: clean(finding.reasonCode).toUpperCase(),
    }))
}
