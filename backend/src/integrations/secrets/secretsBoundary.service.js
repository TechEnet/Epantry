import fs from 'node:fs'

const SENSITIVE_KEYS = Object.freeze([
  'MONGODB_URI',
  'BREVO_API_KEY',
  'AUTH_EMAIL_OTP_HMAC_SECRET',
  'PURCHASE_SOURCE_INTEGRATION_HMAC_SECRET',
  'RAZORPAY_KEY_SECRET',
  'OPENROUTER_API_KEY',
  'CLOUDINARY_API_SECRET',
])

function trim(value) {
  return String(value || '').trim()
}

function readFileSecret(filePath, name) {
  try {
    const value = trim(fs.readFileSync(filePath, 'utf8'))
    if (!value) {
      throw new Error(`${name}_FILE resolved to an empty secret.`)
    }
    return value
  } catch (error) {
    const wrapped = new Error(`Unable to resolve ${name} from its file reference.`)
    wrapped.code = 'SECRET_FILE_RESOLUTION_FAILED'
    wrapped.cause = error
    throw wrapped
  }
}

export function readSecretFromBoundary(name, { required = false } = {}) {
  const fileReference = trim(process.env[`${name}_FILE`])
  if (fileReference) {
    return readFileSecret(fileReference, name)
  }

  const directValue = trim(process.env[name])
  const production = trim(process.env.NODE_ENV) === 'production'
  const requireFileReferences = trim(process.env.SECRETS_REQUIRE_FILE_REFERENCES).toLowerCase() === 'true'

  if (production && requireFileReferences && directValue) {
    const error = new Error(`${name} must use a file/external secret reference in production.`)
    error.code = 'DIRECT_PRODUCTION_SECRET_BLOCKED'
    throw error
  }

  if (required && !directValue) {
    const error = new Error(`Missing secret: ${name}`)
    error.code = 'REQUIRED_SECRET_MISSING'
    throw error
  }

  return directValue
}

export function getSecretsBoundaryStatus() {
  const configuredSource = trim(process.env.SECRETS_SOURCE).toLowerCase()
  const production = trim(process.env.NODE_ENV) === 'production'
  const requireFileReferences = trim(process.env.SECRETS_REQUIRE_FILE_REFERENCES).toLowerCase() === 'true'

  let fileReferenceCount = 0
  let directValueCount = 0

  for (const key of SENSITIVE_KEYS) {
    if (trim(process.env[`${key}_FILE`])) {
      fileReferenceCount += 1
    } else if (trim(process.env[key])) {
      directValueCount += 1
    }
  }

  const allowedProductionSources = new Set([
    'orchestrator_injected',
    'file_reference',
    'external_secret_manager',
  ])

  return {
    source: configuredSource || 'not_configured',
    production,
    fileReferenceCount,
    directValueCount,
    fileReferencesRequired: requireFileReferences,
    boundaryConfigured: !production || allowedProductionSources.has(configuredSource),
    rawValuesExposed: false,
  }
}
