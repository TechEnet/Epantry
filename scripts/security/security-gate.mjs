import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const SCRIPT_DIR = path.dirname(SCRIPT_PATH)
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
const POLICY_PATH = path.join(REPO_ROOT, 'security', 'security-policy.json')

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.webmanifest',
  '.yaml',
  '.yml',
])

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
])

const SECRET_ENV_NAMES = [
  'AUTH_EMAIL_OTP_HMAC_SECRET',
  'BREVO_API_KEY',
  'CLOUDINARY_API_SECRET',
  'FIREBASE_PRIVATE_KEY',
  'JWT_SECRET',
  'OPENROUTER_API_KEY',
  'PURCHASE_SOURCE_INTEGRATION_HMAC_SECRET',
  'RAZORPAY_KEY_SECRET',
  'SESSION_SECRET',
]

const SAST_RULES = Object.freeze([
  {
    id: 'M26_SAST_DYNAMIC_EVAL',
    severity: 'critical',
    message: 'Dynamic eval() execution is forbidden in application code.',
    pattern: /\beval\s*\(/g,
  },
  {
    id: 'M26_SAST_FUNCTION_CONSTRUCTOR',
    severity: 'critical',
    message: 'Function constructor execution is forbidden in application code.',
    pattern: /\bnew\s+Function\s*\(/g,
  },
  {
    id: 'M26_SAST_TLS_VERIFICATION_DISABLED',
    severity: 'critical',
    message: 'TLS certificate verification must never be disabled.',
    pattern: /\brejectUnauthorized\s*:\s*false\b/g,
  },
  {
    id: 'M26_SAST_NODE_TLS_DISABLED',
    severity: 'critical',
    message: 'NODE_TLS_REJECT_UNAUTHORIZED must never disable TLS validation.',
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0["']?/g,
  },
  {
    id: 'M26_SAST_SHELL_EXEC',
    severity: 'high',
    message: 'Direct shell exec/execSync is prohibited; use argument-safe spawn/execFile boundaries.',
    pattern: /\b(?:exec|execSync)\s*\(/g,
  },
  {
    id: 'M26_SAST_SPAWN_SHELL_TRUE',
    severity: 'high',
    message: 'child_process spawn with shell:true is prohibited.',
    pattern: /\bshell\s*:\s*true\b/g,
  },
  {
    id: 'M26_SAST_FRONTEND_SECRET_ENV',
    severity: 'critical',
    message: 'Secret-bearing VITE_* environment variables would be exposed to the browser bundle.',
    frontendOnly: true,
    pattern: /VITE_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|ADMIN|MONGODB|DATABASE|BREVO|RAZORPAY)[A-Z0-9_]*/g,
  },
  {
    id: 'M26_SAST_DANGEROUS_HTML',
    severity: 'medium',
    message: 'dangerouslySetInnerHTML requires explicit security review.',
    pattern: /\bdangerouslySetInnerHTML\b/g,
  },
])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function relative(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join('/')
}

function severityRank(value) {
  return {
    info: 0,
    low: 1,
    moderate: 2,
    medium: 2,
    high: 3,
    critical: 4,
  }[String(value || '').toLowerCase()] ?? 0
}

function shouldBlockSeverity(severity, blockSeverities) {
  const threshold = Math.min(
    ...blockSeverities.map((item) => severityRank(item)),
  )

  return severityRank(severity) >= threshold
}

function isPlaceholderSecret(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase()

  if (!normalized) return true

  return (
    normalized.includes('example') ||
    normalized.includes('changeme') ||
    normalized.includes('change_me') ||
    normalized.includes('replace_me') ||
    normalized.includes('your_') ||
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('${') ||
    normalized.includes('process.env') ||
    normalized === 'null' ||
    normalized === 'undefined'
  )
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length
}

export function detectSecretsInText(text, fileName = 'unknown') {
  const findings = []

  const pemPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  for (const match of text.matchAll(pemPattern)) {
    findings.push({
      ruleId: 'M26_SECRET_PRIVATE_KEY',
      severity: 'critical',
      file: fileName,
      line: lineNumberAt(text, match.index || 0),
      message: 'Private key material detected.',
    })
  }

  if (
    /["']type["']\s*:\s*["']service_account["']/.test(text) &&
    /["']private_key["']\s*:/.test(text)
  ) {
    findings.push({
      ruleId: 'M26_SECRET_SERVICE_ACCOUNT',
      severity: 'critical',
      file: fileName,
      line: 1,
      message: 'Service-account private credential document detected.',
    })
  }

  const envNames = SECRET_ENV_NAMES.join('|')
  const assignmentPattern = new RegExp(
    `(?:^|[\\s"'])(${envNames})(?:["'])?\\s*[:=]\\s*([^\\s,;]+)`,
    'gmi',
  )

  for (const match of text.matchAll(assignmentPattern)) {
    const value = match[2] || ''
    if (isPlaceholderSecret(value)) continue

    findings.push({
      ruleId: 'M26_SECRET_ENV_VALUE',
      severity: 'critical',
      file: fileName,
      line: lineNumberAt(text, match.index || 0),
      message: `Hard-coded value detected for ${match[1]}.`,
    })
  }

  const providerPatterns = [
    {
      id: 'M26_SECRET_AWS_ACCESS_KEY',
      regex: /\bAKIA[0-9A-Z]{16}\b/g,
      message: 'AWS access-key shaped value detected.',
    },
    {
      id: 'M26_SECRET_GITHUB_TOKEN',
      regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
      message: 'GitHub token shaped value detected.',
    },
    {
      id: 'M26_SECRET_OPENAI_STYLE_TOKEN',
      regex: /\bsk-[A-Za-z0-9_-]{24,}\b/g,
      message: 'API token shaped value detected.',
    },
    {
      id: 'M26_SECRET_MONGODB_CREDENTIAL_URI',
      regex: /mongodb(?:\+srv)?:\/\/[^\s/:]+:[^\s@]+@[^\s]+/gi,
      message: 'Credential-bearing MongoDB URI detected.',
    },
  ]

  for (const rule of providerPatterns) {
    for (const match of text.matchAll(rule.regex)) {
      findings.push({
        ruleId: rule.id,
        severity: 'critical',
        file: fileName,
        line: lineNumberAt(text, match.index || 0),
        message: rule.message,
      })
    }
  }

  return findings
}

export function detectSastFindingsInText(
  text,
  fileName = 'unknown',
  { frontend = false } = {},
) {
  const findings = []

  for (const rule of SAST_RULES) {
    if (rule.frontendOnly && !frontend) continue

    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    for (const match of text.matchAll(pattern)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        file: fileName,
        line: lineNumberAt(text, match.index || 0),
        message: rule.message,
      })
    }
  }

  return findings
}

function walkFiles(rootPath, policy, extensions) {
  if (!fs.existsSync(rootPath)) return []

  const files = []
  const excluded = new Set(policy.secretScan.excludedDirectories)

  function walk(currentPath) {
    const stat = fs.statSync(currentPath)

    if (stat.isDirectory()) {
      const name = path.basename(currentPath)
      if (excluded.has(name)) return

      for (const entry of fs.readdirSync(currentPath)) {
        walk(path.join(currentPath, entry))
      }
      return
    }

    if (!stat.isFile()) return
    if (stat.size > policy.secretScan.maxFileBytes) return

    const ext = path.extname(currentPath).toLowerCase()
    const base = path.basename(currentPath)

    if (extensions.has(ext) || base === '.env' || base.startsWith('.env.')) {
      files.push(currentPath)
    }
  }

  walk(rootPath)
  return files
}

function runSecretScan(policy) {
  const findings = []
  const files = walkFiles(REPO_ROOT, policy, TEXT_EXTENSIONS)

  for (const filePath of files) {
    const fileName = relative(filePath)
    if (fileName === 'scripts/security/security-self-test.mjs') continue

    const text = fs.readFileSync(filePath, 'utf8')
    findings.push(...detectSecretsInText(text, fileName))
  }

  return {
    status: findings.length ? 'fail' : 'pass',
    scannedFiles: files.length,
    findings,
  }
}

function runSastBaseline(policy) {
  const findings = []
  const scanned = new Set()

  for (const sourceRoot of policy.sast.sourceRoots) {
    const absoluteRoot = path.join(REPO_ROOT, sourceRoot)
    const files = walkFiles(absoluteRoot, policy, SOURCE_EXTENSIONS)

    for (const filePath of files) {
      const fileName = relative(filePath)
      if (fileName.startsWith('scripts/security/')) continue
      if (scanned.has(fileName)) continue
      scanned.add(fileName)

      const text = fs.readFileSync(filePath, 'utf8')
      findings.push(
        ...detectSastFindingsInText(text, fileName, {
          frontend: fileName.startsWith('frontend/'),
        }),
      )
    }
  }

  const blocking = findings.filter((finding) =>
    shouldBlockSeverity(finding.severity, policy.sast.blockSeverities),
  )

  return {
    status: blocking.length ? 'fail' : 'pass',
    scannedFiles: scanned.size,
    findings,
    blockingFindings: blocking,
  }
}

function runDependencyAudit(policy) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['audit', '--json', '--workspaces'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    },
  )

  let payload = null

  try {
    payload = JSON.parse(result.stdout || '{}')
  } catch {
    return {
      status: 'tool_error',
      message: 'npm audit did not return valid JSON.',
      exitCode: result.status,
    }
  }

  if (payload.error) {
    return {
      status: 'tool_error',
      message: payload.error.summary || payload.error.message || payload.message || 'npm audit failed.',
      exitCode: result.status,
    }
  }

  const vulnerabilities = payload.metadata?.vulnerabilities || {}
  const blockingCount = policy.dependencyAudit.blockSeverities.reduce(
    (sum, severity) => sum + Number(vulnerabilities[severity] || 0),
    0,
  )

  return {
    status: blockingCount > 0 ? 'fail' : 'pass',
    exitCode: result.status,
    blockingCount,
    vulnerabilityCounts: {
      info: Number(vulnerabilities.info || 0),
      low: Number(vulnerabilities.low || 0),
      moderate: Number(vulnerabilities.moderate || 0),
      high: Number(vulnerabilities.high || 0),
      critical: Number(vulnerabilities.critical || 0),
      total: Number(vulnerabilities.total || 0),
    },
  }
}

function writeEvidence(policy, evidence) {
  const directory = path.join(REPO_ROOT, policy.evidence.directory)
  fs.mkdirSync(directory, { recursive: true })

  const outputPath = path.join(directory, policy.evidence.fileName)
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

  return outputPath
}

function summarizeGate(name, result) {
  const marker =
    result.status === 'pass'
      ? 'PASS'
      : result.status === 'skipped'
        ? 'SKIP'
        : 'FAIL'

  console.log(`${marker} ${name}`)

  const blocking = result.blockingFindings || result.findings || []
  if (result.status !== 'pass' && blocking.length) {
    for (const finding of blocking.slice(0, 25)) {
      console.error(
        `  ${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.file}:${finding.line} - ${finding.message}`,
      )
    }
  }

  if (result.message) {
    console.error(`  ${result.message}`)
  }
}

export function runSecurityGates({ skipDependencyAudit = false } = {}) {
  const policy = readJson(POLICY_PATH)
  const startedAt = new Date()

  const secretScan = runSecretScan(policy)
  const sastBaseline = runSastBaseline(policy)
  const dependencyAudit = skipDependencyAudit
    ? {
        status: 'skipped',
        message: 'Dependency audit explicitly skipped for static author validation.',
      }
    : runDependencyAudit(policy)

  summarizeGate('Secret scan', secretScan)
  summarizeGate('SAST baseline', sastBaseline)
  summarizeGate('Dependency audit', dependencyAudit)

  const complete = dependencyAudit.status !== 'skipped'
  const passed =
    secretScan.status === 'pass' &&
    sastBaseline.status === 'pass' &&
    (dependencyAudit.status === 'pass' || dependencyAudit.status === 'skipped')

  const evidence = {
    schemaVersion: 1,
    module: 'M26',
    gateType: 'ci_security',
    policyVersion: policy.policyVersion,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    repositoryRef: process.env.GITHUB_SHA || '',
    workflowRunId: process.env.GITHUB_RUN_ID || '',
    complete,
    passed,
    gates: {
      secretScan,
      sastBaseline,
      dependencyAudit,
    },
  }

  const outputPath = writeEvidence(policy, evidence)
  console.log(`Security evidence: ${relative(outputPath)}`)

  return {
    passed,
    complete,
    evidence,
    outputPath,
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  const skipDependencyAudit = process.argv.includes('--skip-dependency-audit')

  if (
    skipDependencyAudit &&
    (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true')
  ) {
    console.error('Dependency audit cannot be skipped in CI.')
    process.exitCode = 1
  } else {
    const result = runSecurityGates({ skipDependencyAudit })

    if (!result.passed) {
      process.exitCode = 1
    }
  }
}
