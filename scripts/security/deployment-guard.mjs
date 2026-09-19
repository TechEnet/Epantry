import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const policyFile = path.join(root, 'security', 'deployment-policy.json')
const artifacts = path.join(root, '.security-artifacts')

function bool(value) {
  return String(value || '').toLowerCase() === 'true'
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

function ageHours(value) {
  const time = new Date(value || 0).getTime()
  if (!Number.isFinite(time) || time <= 0) return Number.POSITIVE_INFINITY
  return (Date.now() - time) / (60 * 60 * 1000)
}

async function run() {
  const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'))
  const environment = String(process.env.DEPLOY_ENVIRONMENT || 'production').trim()
  const checks = []

  const baseUrl = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').trim()
  let url = null
  try { url = new URL(baseUrl) } catch {}

  checks.push({
    key: 'https',
    passed: environment !== 'production' || url?.protocol === 'https:',
  })
  checks.push({
    key: 'waf_blocking',
    passed: environment !== 'production' || String(process.env.EDGE_WAF_MODE || '').toLowerCase() === 'blocking',
  })
  checks.push({
    key: 'edge_rate_limit',
    passed: environment !== 'production' || bool(process.env.EDGE_RATE_LIMIT_ENABLED),
  })
  checks.push({
    key: 'trusted_proxy',
    passed: environment !== 'production' || Number(process.env.TRUST_PROXY_HOPS || 0) > 0,
  })

  const secretSource = String(process.env.SECRETS_SOURCE || '').trim().toLowerCase()
  checks.push({
    key: 'secret_boundary',
    passed: environment !== 'production' || policy.secrets.productionAllowedSources.includes(secretSource),
  })

  const security = await readJson(path.join(artifacts, 'm26-security-gates.json'))
  checks.push({
    key: 'recent_security_gate',
    passed: Boolean(
      security?.passed === true &&
      ageHours(security.completedAt) <= Number(policy.production.requireRecentSecurityGateHours || 24)
    ),
  })

  const dast = await readJson(path.join(artifacts, 'm26-staging-dast.json'))
  checks.push({
    key: 'recent_staging_dast',
    passed: Boolean(
      dast?.passed === true &&
      ageHours(dast.completedAt) <= Number(policy.production.requireRecentDastHours || 24)
    ),
  })

  const restore = await readJson(path.join(artifacts, 'm26-backup-restore.json'))
  checks.push({
    key: 'recent_verified_restore',
    passed: Boolean(
      restore?.verified === true &&
      ageHours(restore.completedAt) <= Number(policy.production.requireVerifiedRestoreDays || 90) * 24
    ),
  })

  const passed = checks.every((item) => item.passed === true)
  const evidence = {
    schemaVersion: 1,
    policyVersion: policy.policyVersion,
    environment,
    completedAt: new Date().toISOString(),
    passed,
    checks,
    edgeProviderConfigured: Boolean(String(process.env.EDGE_SECURITY_PROVIDER || '').trim()),
    secretSource: secretSource || 'not_configured',
  }

  await fs.mkdir(artifacts, { recursive: true })
  await fs.writeFile(
    path.join(artifacts, 'm26-deployment-guard.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  )

  if (!passed) {
    process.stderr.write('M26 deployment guard BLOCKED production deployment.\n')
    process.exitCode = 1
    return
  }

  process.stdout.write('M26 deployment guard passed.\n')
}

run().catch((error) => {
  process.stderr.write(`${String(error?.message || error)}\n`)
  process.exitCode = 1
})
