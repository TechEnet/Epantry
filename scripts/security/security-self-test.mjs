import assert from 'node:assert/strict'

import {
  detectSastFindingsInText,
  detectSecretsInText,
} from './security-gate.mjs'

function ruleIds(findings) {
  return new Set(findings.map((finding) => finding.ruleId))
}

const fakePrivateKey = [
  '-----BEGIN ',
  'PRIVATE KEY-----',
  'not-a-real-key',
  '-----END ',
  'PRIVATE KEY-----',
].join('')

assert(
  ruleIds(detectSecretsInText(fakePrivateKey, 'fixture.txt')).has(
    'M26_SECRET_PRIVATE_KEY',
  ),
  'Private-key fixture must be detected.',
)

const fakeSecretAssignment = [
  'BREVO_API_',
  'KEY=',
  'test_only_value_1234567890',
].join('')

assert(
  ruleIds(detectSecretsInText(fakeSecretAssignment, 'fixture.env')).has(
    'M26_SECRET_ENV_VALUE',
  ),
  'Sensitive environment assignment fixture must be detected.',
)

assert.equal(
  detectSecretsInText('BREVO_API_KEY=<replace_me>', '.env.example').length,
  0,
  'Explicit placeholder secrets must not fail the repository gate.',
)

const fakeMongoCredentialUri = [
  'mongodb+srv://',
  'test-user:',
  'not-a-real-password',
  '@example.invalid/database',
].join('')

assert(
  ruleIds(detectSecretsInText(fakeMongoCredentialUri, 'fixture.env')).has(
    'M26_SECRET_MONGODB_CREDENTIAL_URI',
  ),
  'Credential-bearing MongoDB URI fixture must be detected.',
)

assert.equal(
  detectSecretsInText('MONGODB_URI=mongodb://127.0.0.1:27017/epantry_ci', 'ci.yml').length,
  0,
  'Credential-free local MongoDB URI must not be treated as a leaked secret.',
)

assert(
  ruleIds(detectSastFindingsInText('eval(userInput)', 'fixture.js')).has(
    'M26_SAST_DYNAMIC_EVAL',
  ),
  'eval fixture must be detected.',
)

assert(
  ruleIds(
    detectSastFindingsInText(
      'const x = import.meta.env.VITE_DATABASE_PASSWORD',
      'frontend/src/fixture.js',
      { frontend: true },
    ),
  ).has('M26_SAST_FRONTEND_SECRET_ENV'),
  'Secret-bearing frontend environment variable fixture must be detected.',
)

assert.equal(
  detectSastFindingsInText(
    'const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID',
    'frontend/src/config.js',
    { frontend: true },
  ).length,
  0,
  'Browser-safe Firebase project configuration must not be treated as a server secret.',
)

console.log('M26 security scanner self-test PASS')
