import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const policyPath = path.join(root, 'security', 'deployment-policy.json')
const artifactDir = path.join(root, '.security-artifacts')
const artifactPath = path.join(artifactDir, 'm26-staging-dast.json')

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw) fail('STAGING_BASE_URL is required for M26 staging DAST.')

  const url = new URL(raw)
  if (url.protocol !== 'https:') {
    fail('Staging DAST requires HTTPS.', { protocol: url.protocol })
  }
  return url
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      redirect: 'manual',
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function followBoundedRedirects(url, policy) {
  let current = new URL(url)
  const maxRedirects = Number(policy.staging.dast.maxRedirects || 3)

  for (let count = 0; count <= maxRedirects; count += 1) {
    const response = await fetchWithTimeout(
      current,
      { method: 'GET', headers: { 'user-agent': 'EPANTRY-M26-DAST/1.0' } },
      Number(policy.staging.dast.requestTimeoutMs || 10000),
    )

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current, redirects: count }
    }

    const location = response.headers.get('location')
    if (!location) fail('Redirect response did not include Location header.')

    const next = new URL(location, current)
    if (next.protocol !== 'https:') {
      fail('DAST detected redirect downgrade away from HTTPS.', {
        from: current.origin,
        toProtocol: next.protocol,
      })
    }
    current = next
  }

  fail('Staging exceeded bounded redirect policy.')
}

async function run() {
  const startedAt = new Date()
  const policy = JSON.parse(await fs.readFile(policyPath, 'utf8'))
  const baseUrl = normalizeBaseUrl(process.env.STAGING_BASE_URL)
  const checks = []

  const home = await followBoundedRedirects(baseUrl, policy)
  checks.push({
    key: 'https_navigation',
    passed: home.finalUrl.protocol === 'https:' && home.response.status < 500,
    status: home.response.status,
    redirects: home.redirects,
  })

  for (const header of policy.staging.dast.requiredHeaders) {
    checks.push({
      key: `required_header:${header}`,
      passed: Boolean(home.response.headers.get(header)),
    })
  }

  for (const header of policy.staging.dast.forbiddenHeaders) {
    checks.push({
      key: `forbidden_header:${header}`,
      passed: !home.response.headers.has(header),
    })
  }

  const unknown = await fetchWithTimeout(
    new URL(`/__m26_dast_unknown_${Date.now()}`, baseUrl),
    { headers: { 'user-agent': 'EPANTRY-M26-DAST/1.0' } },
    Number(policy.staging.dast.requestTimeoutMs || 10000),
  )
  checks.push({
    key: 'unknown_route_not_success',
    passed: unknown.status === 404,
    status: unknown.status,
  })

  const health = await fetchWithTimeout(
    new URL('/api/v1/health', baseUrl),
    { headers: { 'user-agent': 'EPANTRY-M26-DAST/1.0' } },
    Number(policy.staging.dast.requestTimeoutMs || 10000),
  )
  checks.push({
    key: 'health_no_server_error',
    passed: health.status < 500,
    status: health.status,
  })

  const probe = policy.staging.dast.rateLimitProbe
  const requestCount = Math.min(Math.max(Number(probe.requests || 12), 1), 30)
  const statuses = []
  for (let i = 0; i < requestCount; i += 1) {
    const response = await fetchWithTimeout(
      new URL(probe.path, baseUrl),
      { headers: { 'user-agent': 'EPANTRY-M26-RateLimit-Probe/1.0' } },
      Number(policy.staging.dast.requestTimeoutMs || 10000),
    )
    statuses.push(response.status)
  }
  checks.push({
    key: 'edge_probe_completed',
    passed: statuses.every((status) => status >= 200 && status < 600),
    sampleCount: statuses.length,
    sawRateLimit: statuses.includes(429),
  })

  const passed = checks.every((check) => check.passed === true)
  const artifact = {
    schemaVersion: 1,
    policyVersion: policy.policyVersion,
    environment: 'staging',
    targetOrigin: baseUrl.origin,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    passed,
    checks,
  }

  await fs.mkdir(artifactDir, { recursive: true })
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')

  if (!passed) {
    process.stderr.write(`M26 staging DAST blocked. Evidence: ${artifactPath}\n`)
    process.exitCode = 1
    return
  }

  process.stdout.write(`M26 staging DAST passed. Evidence: ${artifactPath}\n`)
}

run().catch(async (error) => {
  await fs.mkdir(artifactDir, { recursive: true })
  const artifact = {
    schemaVersion: 1,
    environment: 'staging',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    passed: false,
    errorCode: error?.name || 'DAST_FAILED',
    errorMessage: String(error?.message || 'Staging DAST failed.').slice(0, 500),
  }
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  process.stderr.write(`${artifact.errorMessage}\n`)
  process.exitCode = 1
})
