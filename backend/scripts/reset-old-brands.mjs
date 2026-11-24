/**
 * EPANTRY: remove ONLY old MongoDB brand records for a fresh test cycle.
 *
 * Usage (from the backend directory):
 *   node scripts/reset-old-brands.mjs
 *   node scripts/reset-old-brands.mjs --apply
 *
 * No source file, MongoDB collection/index, Cloudinary/Firebase asset, local
 * image or Super Admin record is modified except the specifically identified
 * old documents in the `brands` collection when --apply is confirmed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const DATABASE = 'epantry';
const ADMIN_EMAIL = 'alokgkp8@gmail.com';
const CONFIRMATION = 'DELETE OLD BRANDS KEEP ADMIN AND IMAGES';
const APPLY = process.argv.includes('--apply');
const normalize = (value) => String(value ?? '').trim().toLowerCase();
const fail = (message) => { throw new Error(`STOP: ${message}`); };

const MUST_BE_EMPTY = [
  'organizations',
  'hostUnifiedListingPackets',
  'productFamilies',
  'productVariants',
  'packs',
  'productVersions',
  'sellerOffers',
  'brandAuthorities',
  'brandClaims',
  'brandRecipeSubmissions',
];

function verifyBackupFile(location) {
  if (!fs.existsSync(location) || fs.statSync(location).size === 0) {
    fail(`Backup verification failed: ${location}. Nothing was deleted.`);
  }
}

let connected = false;
try {
  if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production') {
    fail('This cleanup cannot run in production mode.');
  }
  await connectDatabase();
  connected = true;

  const db = mongoose.connection.db;
  if (db.databaseName !== DATABASE) {
    fail(`Connected to unexpected MongoDB database: ${db.databaseName}`);
  }

  const users = await db.collection('users').find({}, {
    projection: { _id: 1, email: 1, firebaseUid: 1, superAdminEnabled: 1 },
  }).toArray();
  const admin = users.find((item) =>
    normalize(item.email) === ADMIN_EMAIL && item.superAdminEnabled === true);
  if (!admin || !admin.firebaseUid || users.length !== 1) {
    fail('The one-account Super Admin baseline changed. Nothing was deleted.');
  }

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name));
  for (const name of MUST_BE_EMPTY) {
    if (existing.has(name)) {
      const count = await db.collection(name).countDocuments({});
      if (count !== 0) {
        fail(`${name} contains ${count} record(s). Brand relations need review before deletion.`);
      }
    }
  }

  if (!existing.has('brands')) {
    console.log('\nThe brands collection is absent. Nothing to delete.');
  } else {
    const brands = await db.collection('brands').find({}).sort({ name: 1, _id: 1 }).toArray();
    console.log(`\nDATABASE: ${DATABASE}`);
    console.log(`PROTECTED SUPER ADMIN: ${admin.email}`);
    console.log(`BRAND DOCUMENTS TO REMOVE: ${brands.length}`);
    console.log('ONLY COLLECTION TARGETED: brands');
    console.log('Cloudinary, Firebase, developer hero/page images and all other collections: untouched.');
    console.table(brands.map((brand) => ({
      name: brand.name || '(unnamed)',
      slug: brand.slug || '',
      status: brand.status || '',
      id: String(brand._id),
      action: 'DELETE',
    })));

    if (!APPLY) {
      console.log('\nPREVIEW ONLY. No data changed.');
      console.log('After checking the names and stopping the backend, run:');
      console.log('node scripts/reset-old-brands.mjs --apply');
    } else if (brands.length === 0) {
      console.log('\nAlready clean. No brand records were deleted.');
    } else {
      console.log('\nWARNING: The listed MongoDB brand documents will be deleted.');
      console.log('Stop your running EPANTRY backend before confirming.');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      let answer;
      try {
        answer = await rl.question(`Type ${CONFIRMATION}: `);
      } finally {
        rl.close();
      }
      if (answer !== CONFIRMATION) fail('Confirmation did not match. Nothing deleted.');

      const folder = path.join(os.homedir(), 'EPANTRY_RESET_BACKUPS',
        `brands-only-${new Date().toISOString().replace(/[:.]/g, '-')}`);
      const dumpRoot = path.join(folder, 'mongodb');
      fs.mkdirSync(folder, { recursive: true, mode: 0o700 });

      console.log(`\nBacking up ALL brand documents: ${dumpRoot}`);
      const dump = spawnSync('mongodump', [
        '--uri', env.mongodbUri,
        '--db', DATABASE,
        '--collection', 'brands',
        '--out', dumpRoot,
      ], { stdio: 'inherit' });
      if (dump.error || dump.status !== 0) {
        fail('MongoDB backup failed. Nothing deleted.');
      }
      verifyBackupFile(path.join(dumpRoot, DATABASE, 'brands.bson'));

      const manifest = {
        date: new Date().toISOString(),
        database: DATABASE,
        collection: 'brands',
        protectedAdmin: { id: String(admin._id), email: admin.email },
        count: brands.length,
        brandMetadata: brands.map((brand) => ({
          id: String(brand._id),
          name: brand.name || '',
          slug: brand.slug || '',
          logoUrl: brand.logoUrl || '',
        })),
        imageStorageDeleted: false,
      };
      fs.writeFileSync(path.join(folder, 'brand-cleanup-manifest.json'),
        JSON.stringify(manifest, null, 2), { mode: 0o600 });
      console.log('Brand backup verified. Brand names and logo URLs saved to manifest.');

      const result = await db.collection('brands').deleteMany({
        _id: { $in: brands.map((brand) => brand._id) },
      });
      const remaining = await db.collection('brands').countDocuments({});
      const adminAfter = await db.collection('users').findOne({ _id: admin._id });
      if (!adminAfter || normalize(adminAfter.email) !== ADMIN_EMAIL ||
          adminAfter.firebaseUid !== admin.firebaseUid ||
          adminAfter.superAdminEnabled !== true) {
        fail(`Super Admin verification failed. Backup saved at ${dumpRoot}`);
      }
      if (result.deletedCount !== brands.length || remaining !== 0) {
        fail(`Brand cleanup incomplete: deleted ${result.deletedCount}/${brands.length}, remaining ${remaining}. Backup: ${dumpRoot}`);
      }

      console.log(`\nSUCCESS: Removed ${result.deletedCount} old brand records.`);
      console.log('REMAINING BRANDS: 0');
      console.log('SUPER ADMIN: PRESERVED');
      console.log('DEVELOPER IMAGES / CLOUDINARY / FIREBASE: NOT TOUCHED');
      console.log(`BACKUP: ${dumpRoot}`);
      console.log('Restart backend and hard-refresh the website (Cmd+Shift+R).');
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (connected) await disconnectDatabase().catch(() => {});
}
