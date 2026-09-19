import {
  getSecretsBoundaryStatus,
} from '../../integrations/secrets/secretsBoundary.service.js'

import {
  JobRun,
  RecoveryEvidence,
} from './reliability.models.js'

const RESTORE_MAX_AGE_DAYS = 90

function envBool(name) {
  return String(process.env[name] || '').toLowerCase() === 'true'
}

function safeUrlProtocol(value) {
  try {
    return new URL(String(value || '')).protocol
  } catch {
    return ''
  }
}

function ageDays(value) {
  const time = new Date(value || 0).getTime()
  if (!Number.isFinite(time) || time <= 0) return null
  return Math.max(0, (Date.now() - time) / (24 * 60 * 60 * 1000))
}

export async function getDeploymentSecurityOverview() {
  const production = String(process.env.NODE_ENV || 'development') === 'production'
  const publicUrl = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || ''
  const secretsBoundary = getSecretsBoundaryStatus()
  const secretSource = secretsBoundary.source

  const [latestDastJob, latestRestore] = await Promise.all([
    JobRun.findOne({ jobType: 'm26_staging_dast' })
      .sort({ finishedAt: -1 })
      .lean(),
    RecoveryEvidence.findOne({
      evidenceType: 'restore_drill',
      environment: { $in: ['staging', 'production'] },
      verified: true,
    })
      .sort({ completedAt: -1 })
      .lean(),
  ])

  const restoreAgeDays = latestRestore ? ageDays(latestRestore.completedAt) : null
  const tlsConfigured = safeUrlProtocol(publicUrl) === 'https:'
  const wafMode = String(process.env.EDGE_WAF_MODE || 'not_configured').toLowerCase()
  const edgeRateLimitEnabled = envBool('EDGE_RATE_LIMIT_ENABLED')
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0)
  const secretBoundaryConfigured = secretsBoundary.boundaryConfigured

  const checks = [
    {
      key: 'tls',
      label: 'TLS / HTTPS',
      passed: !production || tlsConfigured,
      state: tlsConfigured ? 'configured' : 'not_configured',
    },
    {
      key: 'waf',
      label: 'Edge WAF',
      passed: !production || wafMode === 'blocking',
      state: wafMode,
    },
    {
      key: 'edge_rate_limit',
      label: 'Edge rate limiting',
      passed: !production || edgeRateLimitEnabled,
      state: edgeRateLimitEnabled ? 'enabled' : 'not_configured',
    },
    {
      key: 'trusted_proxy',
      label: 'Trusted proxy boundary',
      passed: !production || trustedProxyHops > 0,
      state: trustedProxyHops > 0 ? 'configured' : 'not_configured',
    },
    {
      key: 'secrets',
      label: 'Secrets boundary',
      passed: secretBoundaryConfigured,
      state: secretSource || 'not_configured',
    },
    {
      key: 'restore_drill',
      label: 'Verified restore drill',
      passed: restoreAgeDays !== null && restoreAgeDays <= RESTORE_MAX_AGE_DAYS,
      state: restoreAgeDays === null ? 'missing' : restoreAgeDays <= RESTORE_MAX_AGE_DAYS ? 'current' : 'stale',
    },
  ]

  return {
    environment: production ? 'production' : String(process.env.NODE_ENV || 'development'),
    deploymentReady: checks.every((item) => item.passed === true),
    checks,
    edge: {
      providerConfigured: Boolean(String(process.env.EDGE_SECURITY_PROVIDER || '').trim()),
      providerLabel: String(process.env.EDGE_SECURITY_PROVIDER || 'not_configured').slice(0, 80),
      wafMode,
      rateLimitEnabled: edgeRateLimitEnabled,
    },
    secrets: {
      ...secretsBoundary,
      source: secretSource || 'not_configured',
      rawValuesExposed: false,
    },
    latestDastJob: latestDastJob
      ? {
          jobRunId: latestDastJob.jobRunId,
          status: latestDastJob.status,
          finishedAt: latestDastJob.finishedAt,
          errorCode: latestDastJob.errorCode || '',
        }
      : null,
    latestVerifiedRestore: latestRestore
      ? {
          recoveryEvidenceId: latestRestore.recoveryEvidenceId,
          environment: latestRestore.environment,
          completedAt: latestRestore.completedAt,
          ageDays: restoreAgeDays,
        }
      : null,
    policy: {
      restoreMaximumAgeDays: RESTORE_MAX_AGE_DAYS,
      aiMaySuppressVulnerabilities: false,
      publicCiMutationApiExposed: false,
    },
  }
}
