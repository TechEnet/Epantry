import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const artifactDir = path.join(root, '.security-artifacts')
const artifactPath = path.join(artifactDir, 'm26-backup-restore.json')

function required(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function safeFingerprint(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...options,
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      const error = new Error(`${command} failed with exit code ${code}.`)
      error.code = 'RECOVERY_COMMAND_FAILED'
      error.stderr = stderr.slice(-1000)
      reject(error)
    })
  })
}

async function run() {
  const startedAt = new Date()
  const sourceUri = required('BACKUP_SOURCE_MONGODB_URI')
  const restoreUri = required('RESTORE_DRILL_MONGODB_URI')
  const environment = String(process.env.RECOVERY_DRILL_ENVIRONMENT || 'staging').trim()

  if (sourceUri === restoreUri || safeFingerprint(sourceUri) === safeFingerprint(restoreUri)) {
    throw new Error('Restore drill target must be isolated from the backup source.')
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'epantry-m26-restore-'))
  const archivePath = path.join(tempDir, 'backup.archive.gz')

  try {
    await runCommand('mongodump', [
      `--uri=${sourceUri}`,
      `--archive=${archivePath}`,
      '--gzip',
    ])

    const stat = await fs.stat(archivePath)
    if (stat.size <= 0) throw new Error('Backup archive is empty.')

    await runCommand('mongorestore', [
      `--uri=${restoreUri}`,
      `--archive=${archivePath}`,
      '--gzip',
      '--drop',
    ])

    const smokeScript = String(process.env.RESTORE_SMOKE_COMMAND || '').trim()
    let applicationSmokePassed = false
    if (smokeScript) {
      const [command, ...args] = smokeScript.split(' ').filter(Boolean)
      await runCommand(command, args, { env: { ...process.env, MONGODB_URI: restoreUri } })
      applicationSmokePassed = true
    }

    const completedAt = new Date()
    const evidence = {
      schemaVersion: 1,
      evidenceType: 'restore_drill',
      environment,
      sourceSnapshotRef: `mongodb-backup:${safeFingerprint(sourceUri)}:${startedAt.toISOString()}`,
      restoredTargetRef: `isolated-target:${safeFingerprint(restoreUri)}`,
      recoveryPointAt: startedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      verificationChecks: {
        integrityCheckPassed: stat.size > 0,
        applicationSmokePassed,
        tenantIsolationPassed: sourceUri !== restoreUri,
      },
      verified: stat.size > 0 && applicationSmokePassed && sourceUri !== restoreUri,
      archiveSizeBytes: stat.size,
      containsRawCredentials: false,
    }

    await fs.mkdir(artifactDir, { recursive: true })
    await fs.writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

    if (!evidence.verified) {
      process.stderr.write('M26 restore drill completed but verification is incomplete.\n')
      process.exitCode = 1
      return
    }

    process.stdout.write(`M26 restore drill passed. Evidence: ${artifactPath}\n`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

run().catch(async (error) => {
  await fs.mkdir(artifactDir, { recursive: true })
  await fs.writeFile(
    artifactPath,
    `${JSON.stringify({
      schemaVersion: 1,
      evidenceType: 'restore_drill',
      completedAt: new Date().toISOString(),
      verified: false,
      errorCode: String(error?.code || error?.name || 'RESTORE_DRILL_FAILED').slice(0, 120),
      errorMessage: String(error?.message || 'Restore drill failed.').slice(0, 500),
    }, null, 2)}\n`,
    'utf8',
  )
  process.stderr.write(`${String(error?.message || error)}\n`)
  process.exitCode = 1
})
