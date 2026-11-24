/** EPANTRY test-data reset. Run from backend/scripts. Backup before delete. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/db.js'
import { env } from '../src/config/env.js'

const TARGET_DB = 'epantry'
const PROTECTED_EMAIL = 'alokgkp8@gmail.com'
const APPLY = false
if (process.argv.includes('--apply')) {
  throw new Error('STOP: Old bulk reset disabled to protect developer uploads and shared data.')
}
const KEEP = new Set([
  'adminroles', 'roles', 'featureflags', 'proplans',
  'retentionpolicies', 'regulatoryprofiles', 'experimentdefinitions',
  'substitutionpolicies', 'ruleprofiles', 'serviceaccounts',
  'admin_audit_events', 'securityevents', 'auditevents',
  'categories', 'ingredients', 'allergens', 'nutrients', 'brands',
])
const lower = (v) => String(v ?? '').trim().toLowerCase()
const fail = (reason) => { throw new Error(`STOP: ${reason}`) }

let db
try {
  if (process.env.NODE_ENV === 'production') fail('NODE_ENV=production')
  await connectDatabase()
  db = mongoose.connection.db
  if (db.databaseName !== TARGET_DB) fail(`expected ${TARGET_DB}, got ${db.databaseName}`)

  const allUsers = await db.collection('users').find({}, {
    projection: { _id: 1, email: 1, firebaseUid: 1, superAdminEnabled: 1 },
  }).toArray()
  const admins = allUsers.filter((u) => u.superAdminEnabled === true)
  const chosen = admins.find((u) => lower(u.email) === PROTECTED_EMAIL)
  if (!chosen || !chosen.firebaseUid) fail('protected Super Admin email/UID missing')
  if (admins.length !== 1) fail(`expected one Super Admin, found ${admins.length}; review manually`)
  const removed = allUsers.filter((u) => u.superAdminEnabled !== true)
  const protectedIds = admins.map((u) => u._id)

  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((x) => x.name)
    .filter((n) => !n.startsWith('system.'))
    .sort()
  const counts = []
  for (const name of names) {
    const action = name === 'users' ? 'REMOVE NON-ADMINS'
      : lower(name) === 'adminassignments' ? 'KEEP ADMIN ONLY'
      : KEEP.has(lower(name)) ? 'KEEP' : 'CLEAR TEST RECORDS'
    const count = await db.collection(name).countDocuments({})
    counts.push({ name, count, action })
  }

  console.log(`\nDATABASE ${db.databaseName} | protected: ${chosen.email} | non-admin users: ${removed.length}`)
  console.log('Data plan (collections and indexes will NOT be dropped):')
  for (const x of counts) console.log(`${x.action.padEnd(21)} ${String(x.count).padStart(6)} ${x.name}`)
  if (!APPLY) {
    console.log('\nPREVIEW COMPLETE. Nothing deleted. Add --apply only after reviewing the list.')
  } else {
    console.log('\nWARNING: Removes all records from CLEAR TEST RECORDS collections.')
    console.log('Keeps Super Admin, system roles, plan/feature definitions, food reference data and audit/security logs.')
    console.log('Stop the EPANTRY backend server and ensure this is a test database before continuing.')
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    let answer
    try {
      answer = await rl.question(`Type RESET ${TARGET_DB} KEEP ${PROTECTED_EMAIL} to create backup and delete: `)
    } finally {
      rl.close()
    }
    if (answer !== `RESET ${TARGET_DB} KEEP ${PROTECTED_EMAIL}`) fail('confirmation did not match; nothing deleted')

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const folder = path.join(os.homedir(), 'EPANTRY_RESET_BACKUPS', `fresh-test-${stamp}`)
    const dumpRoot = path.join(folder, 'mongodb')
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 })
    console.log(`\nBacking up MongoDB to ${dumpRoot}`)
    const result = spawnSync('mongodump', ['--uri', env.mongodbUri, '--db', TARGET_DB, '--out', dumpRoot], {
      stdio: 'inherit',
    })
    const usersBackup = path.join(dumpRoot, TARGET_DB, 'users.bson')
    if (result.error || result.status !== 0 || !fs.existsSync(usersBackup)) {
      fail('backup failed or users.bson missing. Database untouched.')
    }

    const manifest = {
      createdAt: new Date().toISOString(), database: TARGET_DB,
      protectedAdmins: admins.map((u) => ({ id: String(u._id), email: u.email, firebaseUid: u.firebaseUid })),
      removedAccounts: removed.map((u) => ({ id: String(u._id), email: u.email ?? '', firebaseUid: u.firebaseUid ?? '' })),
      collections: counts, note: 'Firebase Auth and Cloudinary are NOT deleted by this command.',
    }
    const manifestFile = path.join(folder, 'reset-manifest.json')
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), { mode: 0o600 })
    console.log(`Backup verified; manifest: ${manifestFile}`)

    for (const x of counts) {
      const c = db.collection(x.name)
      if (x.action === 'KEEP') continue
      let result
      if (x.name === 'users') {
        result = await c.deleteMany({ superAdminEnabled: { $ne: true }, _id: { $nin: protectedIds } })
      } else if (lower(x.name) === 'adminassignments') {
        result = await c.deleteMany({ userId: { $nin: protectedIds } })
      } else {
        result = await c.deleteMany({})
      }
      console.log(`CLEARED ${x.name}: ${result.deletedCount}`)
    }
    const protectedAgain = await db.collection('users').findOne({ _id: chosen._id, superAdminEnabled: true })
    if (!protectedAgain || protectedAgain.firebaseUid !== chosen.firebaseUid) {
      fail(`protected Super Admin verification failed; restore from ${dumpRoot}`)
    }
    console.log(`\nDONE: Super Admin preserved. Backup: ${dumpRoot}`)
    console.log(`MANIFEST FOR FIREBASE/CLOUDINARY CLEANUP: ${manifestFile}`)
    console.log('Firebase and Cloudinary have NOT been modified.')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await disconnectDatabase().catch(() => {})
}
