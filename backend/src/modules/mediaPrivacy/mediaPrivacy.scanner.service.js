import { z } from 'zod'

import {
  createOpenRouterChatCompletion,
  isOpenRouterConfigured,
} from '../../integrations/ai/ai.provider.js'

import {
  buildSignedProductEvidenceUrl,
} from '../../integrations/media/cloudinary.provider.js'

import { ApiError } from '../../utils/ApiError.js'

import {
  ImageEvidence,
} from '../universalProduct/universalProduct.models.js'

import {
  MediaSafetyAssessment,
  PrivacyReviewCase,
} from './mediaPrivacy.models.js'

import {
  MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION,
  buildUnavailableMediaPrivacyDetectorResult,
} from './mediaPrivacy.detector.service.js'

import {
  assessMediaPrivacy,
  serializeMediaSafetyAssessment,
  serializePrivacyReviewCase,
} from './mediaPrivacy.service.js'

import {
  mediaPrivacyDetectorResultSchema,
  mediaPrivacyFindingSchema,
} from './mediaPrivacy.validation.js'

const PRIVACY_UPLOAD_PREFIX_SEGMENT = '/privacy-v1/'

const PRODUCT_BUSINESS_CONTEXT = 'product_business'
const PRIVATE_PERSONAL_CONTEXT = 'private_personal'
const UNCERTAIN_CONTEXT = 'uncertain'

const GOVERNED_HOST_PACKAGE_PURPOSES = new Set([
  'front_pack',
  'back_pack',
  'ingredient_panel',
  'nutrition_panel',
  'allergen_statement',
  'barcode',
  'certification_mark',
  'side_panel',
])

const EXPLICIT_PRIVATE_REASON_HINTS = Object.freeze([
  'FACE',
  'PERSONAL_',
  'PRIVATE_',
  'RESIDENTIAL',
  'HOUSEHOLD',
  'SHIPPING',
  'COURIER',
  'RECIPIENT',
  'PURCHASER',
  'RECEIPT',
  'LOYALTY',
  'CUSTOMER_ACCOUNT',
  'ORDER_ID',
  'ACCOUNT_',
  'BANK',
  'CARD',
  'PAYMENT',
  'AADHAAR',
  'PASSPORT',
  'DRIVING_LICENCE',
  'DRIVER_LICENSE',
  'PRESCRIPTION',
  'HANDWRITTEN',
  'PERSONAL_LETTER',
  'PERSONAL_MESSAGE',
  'PERSONAL_EMAIL',
  'PERSONAL_PHONE',
  'OTP',
  'PASSWORD',
  'API_KEY',
  'SECRET',
])

const PRODUCT_BUSINESS_REASON_HINTS = Object.freeze([
  'MANUFACTURER',
  'DISTRIBUTOR',
  'IMPORTER',
  'MARKETER',
  'PACKER',
  'REGISTERED_OFFICE',
  'FACTORY',
  'PLANT',
  'CUSTOMER_CARE',
  'BUSINESS_ADDRESS',
  'COMPANY_ADDRESS',
  'COMPANY_CONTACT',
  'BRAND',
  'BARCODE',
  'GTIN',
  'EAN',
  'UPC',
  'SKU',
  'FSSAI',
  'GSTIN',
  'LICENSE',
  'INGREDIENT',
  'NUTRITION',
  'ALLERGEN',
  'PRODUCT_LABEL',
  'PACKAGING',
  'BATCH',
  'LOT_CODE',
  'MRP',
  'EXPIRY',
  'BEST_BEFORE',
  'CERTIFICATION',
])

const contextualFindingSchema = mediaPrivacyFindingSchema
  .extend({
    contextClass: z
      .enum([
        PRODUCT_BUSINESS_CONTEXT,
        PRIVATE_PERSONAL_CONTEXT,
        UNCERTAIN_CONTEXT,
      ])
      .optional()
      .default(UNCERTAIN_CONTEXT),
  })
  .strict()

const detectorEnvelopeSchema = z
  .object({
    findings: z.array(contextualFindingSchema).max(100),
  })
  .strict()

function id(value) {
  return value === null || value === undefined
    ? null
    : String(value?._id || value)
}

function clean(value) {
  return String(value || '').trim()
}

function extractJsonObject(value) {
  const text = clean(value)

  if (!text) {
    throw new Error('Privacy scanner returned an empty response.')
  }

  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(unfenced)
  } catch {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')

    if (start >= 0 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1))
    }

    throw new Error('Privacy scanner response was not valid JSON.')
  }
}

function isM24MetadataSanitizedEvidence(evidence) {
  return clean(evidence?.publicId).includes(PRIVACY_UPLOAD_PREFIX_SEGMENT)
}

function metadataResultForEvidence(evidence) {
  if (isM24MetadataSanitizedEvidence(evidence)) {
    return {
      status: 'completed',
      stripped: true,
      removedKeys: [
        'exif',
        'iptc',
        'xmp',
        'gps',
      ],
      failureCode: '',
    }
  }

  return {
    status: 'failed',
    stripped: false,
    removedKeys: [],
    failureCode: 'PRIVACY_METADATA_SANITATION_UNVERIFIED',
  }
}

function scannerContractIsCurrent(assessment) {
  return (
    clean(assessment?.scannerVersion) ===
    MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION
  )
}

function productEvidencePurposeLabel(evidence) {
  const purpose = clean(evidence?.purpose)

  if (!purpose) {
    return 'other product/package evidence'
  }

  return purpose
    .split('_')
    .join(' ')
}

function buildPrivacyPrompt(evidence) {
  return [
    'You are a privacy screening classifier for uploaded consumer product/package evidence.',
    `Evidence purpose: ${productEvidencePurposeLabel(evidence)}.`,
    'Return JSON only. Never transcribe, quote, or reproduce detected private text.',
    'Identify genuine privacy risks only; do not extract product facts.',
    '',
    'IMPORTANT PRODUCT-PACKAGE CONTEXT RULES:',
    '- Ordinary printed information on commercial packaging is NOT personal data and must not be blocked merely because it contains text.',
    '- Manufacturer, marketer, importer, distributor, packer, retailer, registered-office, factory, plant, or customer-care postal addresses printed on the product are business information. Treat them as product_business, not home_address.',
    '- Customer-care or company phone numbers, websites, support emails, and company social handles printed on packaging are business information. Treat them as product_business, not sensitive_text or personal_correspondence.',
    '- Barcode, GTIN, EAN, UPC, SKU, batch/lot code, MRP, manufacture date, expiry/best-before date, FSSAI/license numbers, GSTIN/tax identifiers, certification marks, recycling marks, and other product or business identifiers are allowed product facts. They are not privacy risks.',
    '- Ingredient lists, nutrition panels, allergen statements, preparation directions, claims, warnings, brand names, product names, pack size, and regulatory label text are allowed product facts. They are not sensitive_text.',
    '- A commercial company or manufacturer name is not a private person merely because a proper name appears in text.',
    '- A normal retail product barcode is not an account identifier.',
    '',
    'PRIVATE CONTENT THAT MUST STILL BE PROTECTED:',
    '- Visible human faces: report at least high severity.',
    '- A shipping/courier label, handwritten note, prescription, personal letter/message, identity document, or form containing information about a private individual: report as private_personal.',
    '- A private home address belonging to an identifiable individual or household, when it is clearly not the printed manufacturer/distributor/business address of the product: report high or critical.',
    '- Personal phone/email, personal account/order/customer identifiers, payment/bank/card data, government identity numbers, passwords, API keys, secrets, authentication codes, or similarly sensitive personal text: report as private_personal.',
    '- Purchaser-specific receipt details that identify a person, household, account, loyalty identity, order, or payment instrument: report receipt_personal_data.',
    '- Precise device/GPS metadata visible in the image content or screenshots may be reported when genuinely private.',
    '',
    'CONTEXT CLASSIFICATION:',
    `- contextClass must be one of: ${PRODUCT_BUSINESS_CONTEXT}, ${PRIVATE_PERSONAL_CONTEXT}, ${UNCERTAIN_CONTEXT}.`,
    '- If a potential finding is clearly ordinary product/business packaging information, set contextClass to product_business. Such findings will be ignored by policy.',
    '- If it is clearly information about a private individual or household, set contextClass to private_personal.',
    '- If you cannot safely determine whether the content is commercial packaging information or private personal information, set contextClass to uncertain. Uncertain content must remain review-gated.',
    '',
    'Allowed riskType values: face, home_address, receipt_personal_data, personal_correspondence, household_information, geolocation_metadata, device_metadata, sensitive_text, other.',
    'Allowed severity values: low, medium, high, critical.',
    'Bounding boxes must be normalized from 0 to 1 as x,y,width,height when localization is possible; otherwise use null.',
    'reasonCode must be an uppercase machine code and must not contain private text.',
    'Do not return OCR text, names, addresses, phone numbers, emails, account identifiers, face embeddings, or any raw sensitive content.',
    'If no genuine privacy risk is visible, return an empty findings array.',
    'Exact schema: {"findings":[{"riskType":"face","severity":"high","confidence":0.98,"boundingBox":{"x":0.1,"y":0.1,"width":0.2,"height":0.2},"reasonCode":"FACE_VISIBLE","evidenceFingerprint":"","contextClass":"private_personal"}]}',
  ].join('\n')
}

function reasonLooksExplicitlyPrivate(finding) {
  const reasonCode = clean(finding?.reasonCode).toUpperCase()

  if (!reasonCode) {
    return false
  }

  return EXPLICIT_PRIVATE_REASON_HINTS.some((hint) =>
    reasonCode.includes(hint),
  )
}

function evidencePurposeIsGovernedPackageSurface(evidence) {
  return GOVERNED_HOST_PACKAGE_PURPOSES.has(clean(evidence?.purpose))
}

function isGovernedHostPackageEvidence({
  evidence,
  organizationId,
}) {
  return (
    Boolean(organizationId) &&
    id(evidence?.organizationId) === id(organizationId) &&
    evidence?.status === 'active' &&
    evidence?.provider === 'cloudinary' &&
    evidence?.deliveryType === 'authenticated' &&
    evidence?.uploadSignatureVerified === true &&
    isM24MetadataSanitizedEvidence(evidence) &&
    evidencePurposeIsGovernedPackageSurface(evidence)
  )
}

function reasonLooksLikeProductBusinessContext(finding) {
  const reasonCode = clean(finding?.reasonCode).toUpperCase()

  if (!reasonCode) {
    return false
  }

  return PRODUCT_BUSINESS_REASON_HINTS.some((hint) =>
    reasonCode.includes(hint),
  )
}

function shouldIgnoreProductBusinessFinding(finding, evidence) {
  if (finding?.contextClass === PRODUCT_BUSINESS_CONTEXT) {
    return true
  }

  /*
   * Models occasionally classify ordinary package text as uncertain while the
   * machine reason code still clearly describes commercial label content.
   */
  if (
    finding?.contextClass === UNCERTAIN_CONTEXT &&
    ['home_address', 'sensitive_text', 'other'].includes(finding?.riskType) &&
    reasonLooksLikeProductBusinessContext(finding)
  ) {
    return true
  }

  /*
   * Back/front/side package panels frequently contain a registered office,
   * manufacturer/importer address, helpline, licence number, batch text, etc.
   * Vision models can over-classify those as private even after prompt
   * instructions. For a governed package-surface purpose, treat ambiguous
   * home_address/sensitive_text/other findings as commercial label content
   * unless the machine reason explicitly describes personal/private material.
   * Faces, receipts, correspondence, household data and geolocation are never
   * suppressed by this fallback.
   */
  if (
    evidencePurposeIsGovernedPackageSurface(evidence) &&
    ['home_address', 'sensitive_text', 'other'].includes(finding?.riskType) &&
    !reasonLooksExplicitlyPrivate(finding)
  ) {
    return true
  }

  return false
}

function stripProductBusinessFindings(findings, evidence) {
  const values = Array.isArray(findings) ? findings : []

  return values
    .filter((finding) => !shouldIgnoreProductBusinessFinding(finding, evidence))
    .map((finding) => {
      const {
        contextClass,
        ...privacyFinding
      } = finding

      return privacyFinding
    })
}

async function runOpenRouterPrivacyDetector(evidence) {
  if (!isOpenRouterConfigured('copilot')) {
    return buildUnavailableMediaPrivacyDetectorResult({
      provider: 'openrouter',
      failureCode: 'PRIVACY_DETECTOR_UNAVAILABLE',
    })
  }

  try {
    const response = await createOpenRouterChatCompletion({
      task: 'copilot',
      temperature: 0,
      maxTokens: 1100,
      messages: [
        {
          role: 'system',
          content: buildPrivacyPrompt(evidence),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Screen this uploaded product/package evidence image for genuine privacy risks. Apply the product-business context rules and return JSON only.',
            },
            {
              type: 'image_url',
              image_url: {
                url: buildSignedProductEvidenceUrl({
                  publicId: evidence.publicId,
                  version: evidence.version,
                  format: evidence.format,
                }),
              },
            },
          ],
        },
      ],
    })

    const parsedEnvelope = detectorEnvelopeSchema.parse(
      extractJsonObject(response?.message?.content),
    )

    return mediaPrivacyDetectorResultSchema.parse({
      provider: 'openrouter',
      model: clean(response?.modelId),
      status: 'completed',
      scannerVersion: MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION,
      findings: stripProductBusinessFindings(parsedEnvelope.findings, evidence),
      failureCode: '',
    })
  } catch (error) {
    return buildUnavailableMediaPrivacyDetectorResult({
      provider: 'openrouter',
      failureCode:
        error?.code === 'OPENROUTER_TIMEOUT'
          ? 'PRIVACY_DETECTOR_TIMEOUT'
          : 'PRIVACY_DETECTOR_FAILED',
    })
  }
}

async function latestStateForEvidence(evidence) {
  const [assessment, reviewCase] = await Promise.all([
    MediaSafetyAssessment.findOne({
      imageEvidenceId: evidence._id,
    })
      .sort({ assessedAt: -1, createdAt: -1 })
      .lean(),

    PrivacyReviewCase.findOne({
      imageEvidenceId: evidence._id,
    })
      .sort({ createdAt: -1 })
      .lean(),
  ])

  return {
    assessment,
    reviewCase,
  }
}

function reviewDecisionAllowsUse(reviewCase) {
  return (
    reviewCase?.status === 'resolved' &&
    reviewCase?.decision === 'safe_to_use'
  )
}

function reviewDecisionBlocksUse(reviewCase) {
  return (
    reviewCase?.status === 'resolved' &&
    ['redaction_required', 'reupload_required', 'delete_media'].includes(
      reviewCase?.decision,
    )
  )
}

function reviewIsActivelyHumanOwned(reviewCase) {
  return (
    reviewCase?.status === 'in_review' ||
    Boolean(reviewCase?.assignedToUserId)
  )
}

function assessmentHasTechnicalFailure(assessment) {
  if (!assessment) {
    return true
  }

  return (
    assessment.detectorStatus !== 'completed' ||
    assessment.metadataStatus !== 'completed' ||
    assessment.metadataStripped !== true
  )
}

function assessmentIsDetectorOnlyTechnicalFailure(assessment) {
  if (!assessment) {
    return false
  }

  const reasonCodes = Array.isArray(assessment.reasonCodes)
    ? assessment.reasonCodes
    : []

  return (
    ['failed', 'unavailable'].includes(assessment.detectorStatus) &&
    assessment.metadataStatus === 'completed' &&
    assessment.metadataStripped === true &&
    reasonCodes.length > 0 &&
    reasonCodes.every((code) =>
      clean(code).toUpperCase().startsWith('PRIVACY_DETECTOR_'),
    )
  )
}

function governedHostPackageTechnicalFailureCanProceed({
  evidence,
  organizationId,
  assessment,
}) {
  return (
    isGovernedHostPackageEvidence({ evidence, organizationId }) &&
    assessmentIsDetectorOnlyTechnicalFailure(assessment)
  )
}

function automatedOpenReviewCanBeRetried({
  reviewCase,
  assessment,
}) {
  return (
    reviewCase?.status === 'open' &&
    !reviewIsActivelyHumanOwned(reviewCase) &&
    assessmentHasTechnicalFailure(assessment)
  )
}

async function cancelAutomatedReviewCase({
  reviewCase,
  resolutionNote,
}) {
  if (
    !reviewCase ||
    reviewCase.status !== 'open' ||
    reviewIsActivelyHumanOwned(reviewCase)
  ) {
    return false
  }

  const result = await PrivacyReviewCase.updateOne(
    {
      _id: reviewCase._id,
      status: 'open',
      assignedToUserId: null,
    },
    {
      $set: {
        status: 'cancelled',
        resolutionNote,
      },
    },
  )

  return Number(result?.modifiedCount || 0) > 0
}

async function cancelStaleAutomatedReviewCase({
  reviewCase,
  assessment,
}) {
  if (
    !reviewCase ||
    reviewCase.status !== 'open' ||
    reviewIsActivelyHumanOwned(reviewCase) ||
    scannerContractIsCurrent(assessment)
  ) {
    return
  }

  await cancelAutomatedReviewCase({
    reviewCase,
    resolutionNote:
      `Automatically superseded by privacy scanner contract ${MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION}. Evidence will be re-assessed under product/package context rules.`,
  })
}

export async function scanAndAssessImageEvidence({
  evidence,
  actorUserId,
  organizationId = null,
  requestId = '',
  correlationId = '',
  force = false,
}) {
  const state = await latestStateForEvidence(evidence)
  const currentAssessment = scannerContractIsCurrent(state.assessment)

  /*
   * A resolved human decision remains authoritative across scanner versions.
   * Only unresolved automated holds from an older scanner contract are
   * superseded and re-evaluated automatically.
   */
  if (!force && reviewDecisionAllowsUse(state.reviewCase)) {
    return {
      cleared: true,
      source: 'human_review',
      assessment: serializeMediaSafetyAssessment(state.assessment),
      reviewCase: serializePrivacyReviewCase(state.reviewCase),
      suggestedRedactions: [],
    }
  }

  if (!force && reviewDecisionBlocksUse(state.reviewCase)) {
    return {
      cleared: false,
      source: 'human_review',
      assessment: serializeMediaSafetyAssessment(state.assessment),
      reviewCase: serializePrivacyReviewCase(state.reviewCase),
      suggestedRedactions: [],
    }
  }

  if (
    !force &&
    currentAssessment &&
    state.assessment?.decision === 'safe_to_use'
  ) {
    return {
      cleared: true,
      source: 'privacy_assessment',
      assessment: serializeMediaSafetyAssessment(state.assessment),
      reviewCase: serializePrivacyReviewCase(state.reviewCase),
      suggestedRedactions: [],
    }
  }

  if (
    !force &&
    currentAssessment &&
    governedHostPackageTechnicalFailureCanProceed({
      evidence,
      organizationId,
      assessment: state.assessment,
    })
  ) {
    return {
      cleared: true,
      source: 'governed_host_package_detector_deferred',
      privacyDeferred: true,
      assessment: serializeMediaSafetyAssessment(state.assessment),
      reviewCase: serializePrivacyReviewCase(state.reviewCase),
      suggestedRedactions: [],
    }
  }

  if (
    !force &&
    state.reviewCase &&
    ['open', 'in_review'].includes(state.reviewCase.status)
  ) {
    const humanOwned =
      reviewIsActivelyHumanOwned(state.reviewCase)

    const retryableTechnicalHold =
      currentAssessment &&
      automatedOpenReviewCanBeRetried({
        reviewCase: state.reviewCase,
        assessment: state.assessment,
      })

    if (humanOwned) {
      return {
        cleared: false,
        source: 'pending_review',
        assessment: serializeMediaSafetyAssessment(state.assessment),
        reviewCase: serializePrivacyReviewCase(state.reviewCase),
        suggestedRedactions: [],
      }
    }

    if (retryableTechnicalHold) {
      await cancelAutomatedReviewCase({
        reviewCase: state.reviewCase,
        resolutionNote:
          `Automatically retried because privacy scanner contract ${MEDIA_PRIVACY_SCANNER_CONTRACT_VERSION} recorded a transient detector or metadata failure.`,
      })
    } else if (currentAssessment) {
      return {
        cleared: false,
        source: 'pending_review',
        assessment: serializeMediaSafetyAssessment(state.assessment),
        reviewCase: serializePrivacyReviewCase(state.reviewCase),
        suggestedRedactions: [],
      }
    }
  }

  if (!currentAssessment) {
    await cancelStaleAutomatedReviewCase({
      reviewCase: state.reviewCase,
      assessment: state.assessment,
    })
  }

  const detectorResult = await runOpenRouterPrivacyDetector(evidence)
  const assessmentResult = await assessMediaPrivacy({
    input: {
      imageEvidenceId: id(evidence._id),
      organizationId: organizationId ? id(organizationId) : null,
      detectorResult,
      metadataResult: metadataResultForEvidence(evidence),
      requestId,
      correlationId,
    },
    actorUserId,
  })

  const detectorDeferredForGovernedHostPackage =
    governedHostPackageTechnicalFailureCanProceed({
      evidence,
      organizationId,
      assessment: assessmentResult.assessment,
    })

  return {
    cleared:
      assessmentResult.assessment?.decision === 'safe_to_use' ||
      detectorDeferredForGovernedHostPackage,
    source: detectorDeferredForGovernedHostPackage
      ? 'governed_host_package_detector_deferred'
      : 'privacy_assessment',
    privacyDeferred: detectorDeferredForGovernedHostPackage,
    ...assessmentResult,
  }
}

export async function ensureMediaPrivacyClearanceForEvidenceBatch({
  evidence,
  actorUserId,
  organizationId = null,
  requestId = '',
  correlationId = '',
}) {
  const items = Array.isArray(evidence) ? evidence : []
  const results = []

  for (const item of items) {
    results.push(
      await scanAndAssessImageEvidence({
        evidence: item,
        actorUserId,
        organizationId,
        requestId,
        correlationId,
      }),
    )
  }

  const holds = results
    .map((result, index) => ({
      ...result,
      evidence: items[index],
    }))
    .filter((item) => !item.cleared)

  if (holds.length) {
    throw new ApiError(
      409,
      'Upload paused for privacy protection. Review or redact the flagged media before product intelligence continues.',
      holds.map((hold) => ({
        code: 'MEDIA_PRIVACY_CLEARANCE_REQUIRED',
        imageEvidenceId: id(hold.evidence?._id),
        assessment: hold.assessment || null,
        reviewCase: hold.reviewCase || null,
        suggestedRedactions: hold.suggestedRedactions || [],
      })),
    )
  }

  return results
}

export async function recheckOwnedImageEvidencePrivacy({
  imageEvidenceId,
  actorUserId,
  organizationId = null,
  requestId = '',
}) {
  const evidence = await ImageEvidence.findOne({
    _id: imageEvidenceId,
    ownerUserId: actorUserId,
    organizationId: organizationId || null,
    status: { $ne: 'deleted' },
  })

  if (!evidence) {
    throw new ApiError(
      404,
      'Media evidence was not found in the authenticated scope.',
      [{ code: 'MEDIA_EVIDENCE_NOT_FOUND' }],
    )
  }

  return scanAndAssessImageEvidence({
    evidence,
    actorUserId,
    organizationId,
    requestId,
    force: true,
  })
}
