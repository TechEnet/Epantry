/**
 * EPANTRY - guarded cleanup of remaining old test catalog and customer/host records.
 * Usage: node scripts/reset-remaining-test-data.mjs [--apply]
 * This script NEVER deletes Cloudinary assets, Firebase accounts, uploaded media
 * evidence, admin/security/audit/config data, canonical ingredients, or brands.
 * It NEVER drops a collection or an index.
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
const APPLY = process.argv.includes('--apply');
const CONFIRM = 'DELETE OLD TEST DATA KEEP ADMIN AND IMAGES';
const norm = (value) => String(value ?? '').trim().toLowerCase();
const stop = (message) => { throw new Error(`STOP: ${message}`); };

// Exact, reviewed allowlist; unknown collections are always preserved.
// Media/image/landing/brand/role/audit/config collections are intentionally absent.
const GROUPS = {
  'PUBLIC GROCERY + SELLING': [
    'products', 'productVersions', 'packs', 'productVariants', 'productFamilies',
    'sellerOffers', 'priceRules', 'inventoryNodes', 'inventorySnapshots',
    'inventoryReservations', 'inventoryReservationStates', 'serviceAreas',
    'productMatches', 'availabilityWatches', 'communityProductDrafts',
    'hostUnifiedListingPackets', 'catalogIngestJobs', 'catalogIngestRows',
    'npiBulkBatches', 'npiJobs',
  ],
  'PUBLIC RECIPES + COOKING': [
    'recipes', 'dishes', 'recipeVersions', 'recipeIngredients', 'recipeSteps',
    'recipeSubstitutions', 'recipeReviews', 'dishPassportSnapshots',
    'requirementLines', 'requirementDecisions', 'outcomePlans', 'plannedMeals',
    'mealPlans', 'basketQuotes', 'nextBasketPredictions',
  ],
  'OLD HOST + HOSPITALITY': [
    'organizations', 'hostOperationalProfiles', 'hostCommercialProfileRequests',
    'hostCommercePolicies', 'hostCampaignBriefs', 'organizationDocuments',
    'kybCases', 'hospitalityProfiles', 'hospitalityMenus', 'hospitalityMenuItems',
    'hospitalityOutlets', 'hospitalitySuppliers', 'hospitalitySupplierProducts',
    'hospitalityProductionPlans', 'hospitalityProductionRecipeVersions',
    'hospitalityProductionRecipeIngredients', 'hospitalityProcurementPlans',
    'hospitalityRecipeCosts', 'hospitalityStockObservations',
    'greyBookSnapshots',
  ],
  'OLD CUSTOMER + ORDERS': [
    'households', 'household_memberships', 'household_invitations',
    'pantryItems', 'pantryObservations', 'pantryReservations',
    'carts', 'deliveryAddresses', 'customerBookmarks', 'sellerOrders',
    'parentOrders', 'sellerPromiseSnapshots', 'orderEvents',
    'payments', 'paymentWebhookEvents', 'consumptionEvents',
    'connected_purchase_sources', 'purchaseSources',
    'courseProgress', 'courseEntitlements',
  ],
  'OLD SEARCH ACTIVITY': [
    'searchSessions', 'searchDemandEvents', 'website_analytics_events',
  ],
};

const entries = Object.entries(GROUPS).flatMap(([group, names]) =>
  names.map((name) => ({ group, name })));
const uniqueNames = new Set(entries.map((e) => e.name));
if (uniqueNames.size !== entries.length) stop('duplicate collection in allowlist');

// Never allow a future edit to this script to clear protected storage.
const PROTECTED = [
  'users', 'adminAssignments', 'adminroles', 'roles', 'featureflags',
  'brands', 'categories', 'ingredients', 'allergens', 'nutrients',
  'evidenceSources', 'imageEvidence', 'courseMediaAssets',
  'mediaSafetyAssessments', 'privacyReviewCases', 'retentionRecords',
  'redactionJobs', 'admin_audit_events', 'auditevents', 'securityevents',
  'learningCourses', 'campaigns',
];
const protectedSet = new Set(PROTECTED.map(norm));
for (const name of uniqueNames) {
  const lower = norm(name);
  if (protectedSet.has(lower) || /(?:image|asset|media|hero|banner|audit|admin|role|setting|config|policy|consent)/i.test(name)) {
    stop(`unsafe allowlisted collection: ${name}`);
  }
}

let connected = false;
try {
  if (env.nodeEnv === 'production' || process.env.NODE_ENV === 'production') {
    stop('production environment is not eligible');
  }
  await connectDatabase();
  connected = true;
  const db = mongoose.connection.db;
  if (db.databaseName !== DATABASE) stop(`wrong DB: ${db.databaseName}`);

  const users = await db.collection('users').find({}, {
    projection: { _id: 1, email: 1, firebaseUid: 1, superAdminEnabled: 1 },
  }).toArray();
  const admin = users.find((user) =>
    norm(user.email) === ADMIN_EMAIL && user.superAdminEnabled === true);
  if (!admin?.firebaseUid || users.length !== 1 ||
      users.filter((user) => user.superAdminEnabled === true).length !== 1) {
    stop('Expected ONLY the protected Super Admin in MongoDB. No deletion performed.');
  }
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name));
  for (const name of ['organizations', 'hostUnifiedListingPackets']) {
    if (existing.has(name) && await db.collection(name).countDocuments({}) !== 0) {
      stop(`${name} not empty; old Host reset baseline changed. No deletion performed.`);
    }
  }

  const plan = [];
  let plannedCount = 0;
  console.log(`\nDATABASE: ${db.databaseName} | KEEP SUPER ADMIN: ${admin.email}`);
  for (const group of Object.keys(GROUPS)) {
    console.log(`\n${group}`);
    for (const name of GROUPS[group]) {
      if (!existing.has(name)) continue;
      const count = await db.collection(name).countDocuments({});
      plan.push({ group, name, count });
      plannedCount += count;
      console.log(`  ${name.padEnd(39)} ${String(count).padStart(7)}`);
    }
  }
  const untouched = [...existing].filter((name) =>
    !uniqueNames.has(name) && !name.startsWith('system.')).sort();
  console.log(`\nTOTAL OLD TEST RECORDS TARGETED: ${plannedCount}`);
  console.log(`KEPT: ${untouched.join(', ') || '(none)'}`);
  console.log('ALWAYS KEPT: MongoDB Super Admin; all developer images and image/media storage;');
  console.log('Firebase, Cloudinary, references, admin roles, audits, site configuration.');

  if (!APPLY) {
    console.log('\nPREVIEW ONLY. NO RECORDS DELETED.');
    console.log('Review this list, then run: node scripts/reset-remaining-test-data.mjs --apply');
  } else {
    console.log('\nWARNING: The listed test records will be permanently removed from MongoDB.');
    console.log('Stop the running EPANTRY backend before confirming this reset.');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let reply;
    try {
      reply = await rl.question(`Type ${CONFIRM}: `);
    } finally {
      rl.close();
    }
    if (reply !== CONFIRM) stop('confirmation mismatch; no deletion');

    const folder = path.join(os.homedir(), 'EPANTRY_RESET_BACKUPS',
      `remaining-test-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    const dumpRoot = path.join(folder, 'mongodb');
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    console.log(`\nBACKING UP FULL DATABASE to ${dumpRoot}`);
    const dump = spawnSync('mongodump',
      ['--uri', env.mongodbUri, '--db', DATABASE, '--out', dumpRoot],
      { stdio: 'inherit' });
    if (dump.error || dump.status !== 0) stop('mongodump failed; nothing deleted');
    const dumpDb = path.join(dumpRoot, DATABASE);
    const needBackups = new Set(['users', ...plan.filter((p) => p.count > 0).map((p) => p.name)]);
    for (const name of needBackups) {
      const file = path.join(dumpDb, `${name}.bson`);
      if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
        stop(`Backup verification failed for ${name}; nothing deleted`);
      }
    }
    const manifest = {
      date: new Date().toISOString(), database: DATABASE,
      protectedAdminEmail: admin.email, protectedAdminId: String(admin._id),
      protectedFirebaseUid: admin.firebaseUid,
      plannedDeletions: plan, preservedCollections: untouched,
      cloudinaryOrFirebaseDeleted: false,
    };
    fs.writeFileSync(path.join(folder, 'reset-manifest.json'),
      JSON.stringify(manifest, null, 2), { mode: 0o600 });
    console.log(`BACKUP VERIFIED: ${dumpRoot}`);

    let deleted = 0;
    for (const { name, count } of plan) {
      if (count === 0) continue;
      const result = await db.collection(name).deleteMany({});
      deleted += result.deletedCount;
      console.log(`REMOVED ${String(result.deletedCount).padStart(6)} ${name}`);
    }
    const checkAdmin = await db.collection('users').findOne({ _id: admin._id });
    if (!checkAdmin || checkAdmin.firebaseUid !== admin.firebaseUid ||
        checkAdmin.superAdminEnabled !== true || norm(checkAdmin.email) !== ADMIN_EMAIL) {
      stop(`Super Admin verification failed! Backup: ${dumpRoot}`);
    }
    for (const { name } of plan) {
      if (await db.collection(name).countDocuments({}) !== 0) {
        stop(`${name} received new records during cleanup; stop backend and inspect.`);
      }
    }
    console.log(`\nSUCCESS. Deleted ${deleted} test records; Super Admin preserved.`);
    console.log(`BACKUP: ${dumpRoot}`);
    console.log('Cloudinary / Firebase / developer page media NOT touched.');
    console.log('Restart backend, then hard-refresh browser (Cmd+Shift+R).');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (connected) await disconnectDatabase().catch(() => {});
}
