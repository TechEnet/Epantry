import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const adminEmail = 'alokgkp8@gmail.com';
const backup = process.argv.includes('--backup');
let connected = false;

try {
  if (process.argv.some(a =>
    a.includes('--apply') || a.includes('--delete')
  )) {
    throw Error('This audit has no deletion mode.');
  }

  await connectDatabase();
  connected = true;

  const db = mongoose.connection.db;

  if (db.databaseName !== 'epantry') {
    throw Error('Wrong database: ' + db.databaseName);
  }

  const users = await db.collection('users').find({}, {
    projection: {
      _id: 1,
      email: 1,
      firebaseUid: 1,
      superAdminEnabled: 1
    }
  }).toArray();

  const admins = users.filter(u => u.superAdminEnabled === true);

  if (
    admins.length !== 1 ||
    admins[0].email?.toLowerCase() !== adminEmail ||
    !admins[0].firebaseUid
  ) {
    throw Error('Protected Super Admin identity mismatch. STOP.');
  }

  const oldUsers = users.filter(u => u.superAdminEnabled !== true);

  const userValues = [...new Set(oldUsers.flatMap(u =>
    [u._id, String(u._id), u.firebaseUid].filter(Boolean)
  ))];

  const orgs = await db.collection('organizations').find({
    ownerUserId: { $in: userValues }
  }, {
    projection: { _id: 1 }
  }).toArray();

  const orgValues = [...new Set(orgs.flatMap(o =>
    [o._id, String(o._id)]
  ))];

  const userFields = [
    'userId', 'ownerUserId', 'customerUserId',
    'hostUserId', 'buyerUserId', 'sellerUserId',
    'submittedByUserId', 'createdByUserId',
    'uploadedByUserId', 'recipientUserId',
    'ownerId', 'customerId', 'hostId',
    'createdBy', 'firebaseUid'
  ];

  const orgFields = [
    'organizationId', 'hostOrganizationId',
    'sellerOrganizationId', 'supplierOrganizationId',
    'ownerOrganizationId'
  ];

  console.log(`\nDB: ${db.databaseName}`);
  console.log(`KEEP ADMIN: ${admins[0].email}`);
  console.log(`OLD ACCOUNTS: ${oldUsers.length}`);
  console.log(`DIRECTLY OWNED HOST ORGS: ${orgs.length}`);

  console.log('\nCOLLECTION                    TOTAL  USER-LINK  ORG-LINK');

  const collections = await db.listCollections(
    {}, { nameOnly: true }
  ).toArray();

  for (const { name } of collections.sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    if (name.startsWith('system.')) continue;

    const c = db.collection(name);
    const total = await c.countDocuments({});

    if (!total) continue;

    const linkedUsers = userValues.length
      ? await c.countDocuments({
          $or: userFields.map(f => ({
            [f]: { $in: userValues }
          }))
        })
      : 0;

    const linkedOrgs = orgValues.length
      ? await c.countDocuments({
          $or: orgFields.map(f => ({
            [f]: { $in: orgValues }
          }))
        })
      : 0;

    console.log(
      name.padEnd(30),
      String(total).padStart(5),
      String(name === 'users'
        ? oldUsers.length
        : linkedUsers).padStart(9),
      String(linkedOrgs).padStart(9)
    );
  }

  console.log('\nCounts are possible ownership links, NOT approved deletions.');
  console.log('Firebase, Cloudinary and developer images are untouched.');

  if (backup) {
    if (
      process.env.NODE_ENV === 'production' ||
      env.nodeEnv === 'production'
    ) {
      throw Error('Backup mode blocked for production environment.');
    }

    const folder = path.join(
      homedir(),
      'EPANTRY_RESET_BACKUPS',
      'before-customer-host-reset-' +
        new Date().toISOString().replace(/[:.]/g, '-')
    );

    mkdirSync(folder, { recursive: true, mode: 0o700 });

    console.log('\nStarting MongoDB backup:', folder);

    const result = spawnSync('mongodump', [
      '--uri', env.mongodbUri,
      '--db', 'epantry',
      '--out', folder
    ], { stdio: 'inherit' });

    const file = path.join(folder, 'epantry', 'users.bson');

    if (
      result.error ||
      result.status !== 0 ||
      !existsSync(file) ||
      statSync(file).size === 0
    ) {
      throw Error('Backup failed. No data changed.');
    }

    console.log('BACKUP VERIFIED:', folder);
  }

  console.log('\nREAD-ONLY AUDIT COMPLETE. NO DATA DELETED.');

} catch (error) {
  console.error('STOP:', error.message);
  process.exitCode = 1;
} finally {
  if (connected) {
    await disconnectDatabase().catch(() => {});
  }
}
