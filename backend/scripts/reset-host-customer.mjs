import mongoose from 'mongoose';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const DB = 'epantry';
const ADMIN_EMAIL = 'alokgkp8@gmail.com';
const APPLY = process.argv.includes('--apply');
const SAVE_DIR = path.join(os.homedir(), 'EPANTRY_RESET_BACKUPS');
const PLAN_FILE = path.join(SAVE_DIR, 'host-customer-plan.json');

const stop = message => { throw new Error('STOP: ' + message); };
const norm = value => String(value ?? '').trim().toLowerCase();
const uniqueValues = list => [...new Set(
  list.flatMap(v => v == null ? [] : [v, String(v)])
)];
const fieldMatch = (fields, values) => values.length
  ? { $or: fields.map(field => ({ [field]: { $in: values } })) }
  : { _id: { $exists: false } };
const digest = value =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Explicit allowlist: nothing outside this list can be deleted.
// Developer media, admin audit, roles, canonical products and
// shared food/reference content are deliberately excluded.
const COLLECTIONS = `users organizations hostUnifiedListingPackets communityProductDrafts
sellerOffers dishes recipeVersions recipeIngredients recipeSteps recipes
catalogIngestJobs catalogIngestRows npiBulkBatches npiJobs
hospitalityProfiles hospitalityMenus hospitalityMenuItems hospitalityOutlets
hospitalitySuppliers hospitalitySupplierProducts hospitalityProductionPlans
hospitalityProductionRecipeVersions hospitalityProductionRecipeIngredients
hospitalityProcurementPlans hospitalityRecipeCosts hospitalityStockObservations
hostOperationalProfiles hostCommercialProfileRequests hostCommercePolicies
hostCampaignBriefs organizationDocuments kybCases serviceAreas
inventoryNodes inventoryReservations inventoryReservationStates inventorySnapshots
sellerOrders parentOrders sellerPromiseSnapshots orderEvents payments
paymentWebhookEvents carts basketQuotes outcomePlans plannedMeals mealPlans
households household_memberships household_invitations pantryItems
pantryObservations pantryReservations requirementLines requirementDecisions
productMatches priceRules availabilityWatches deliveryAddresses customerBookmarks
notificationPreferences notificationActions notifications searchSessions
searchDemandEvents connected_purchase_sources privacyRightsRequests
campaigns greyBookSnapshots dishPassportSnapshots consumptionEvents
courseProgress courseEntitlements nextBasketPredictions`
  .trim().split(/\s+/);

const USER_FIELDS = [
  'userId', 'ownerUserId', 'customerUserId', 'hostUserId',
  'buyerUserId', 'sellerUserId', 'submittedByUserId',
  'requestedByUserId', 'firebaseUid', 'createdByUserId'
];

const ORG_FIELDS = [
  'organizationId', 'hostOrganizationId',
  'sellerOrganizationId', 'supplierOrganizationId',
  'ownerOrganizationId'
];

const PARENT_FIELDS = {
  householdId: 'households',
  pantryItemId: 'pantryItems',
  cartId: 'carts',
  basketQuoteId: 'basketQuotes',
  outcomePlanId: 'outcomePlans',
  sourceOutcomePlanId: 'outcomePlans',
  plannedMealId: 'plannedMeals',
  mealPlanId: 'mealPlans',
  requirementLineId: 'requirementLines',
  dishId: 'dishes',
  sourceDishId: 'dishes',
  recipeVersionId: 'recipeVersions',
  sourceRecipeVersionId: 'recipeVersions',
  sellerOfferId: 'sellerOffers',
  offerId: 'sellerOffers',
  sellerOrderId: 'sellerOrders',
  parentOrderId: 'parentOrders',
  paymentId: 'payments',
  listingPacketId: 'hostUnifiedListingPackets',
  hostListingPacketId: 'hostUnifiedListingPackets',
  catalogIngestJobId: 'catalogIngestJobs',
  ingestJobId: 'catalogIngestJobs',
  communityProductDraftId: 'communityProductDrafts',
  draftId: 'communityProductDrafts',
  notificationId: 'notifications',
  productMatchId: 'productMatches',
  campaignId: 'campaigns'
};

const asMongoId = value =>
  /^[a-f0-9]{24}$/.test(value)
    ? new mongoose.Types.ObjectId(value)
    : value;

async function select(db) {
  const users = await db.collection('users').find({}, {
    projection: {
      _id: 1, email: 1, firebaseUid: 1,
      superAdminEnabled: 1
    }
  }).toArray();

  const admins = users.filter(u => u.superAdminEnabled === true);

  if (
    admins.length !== 1 ||
    norm(admins[0].email) !== ADMIN_EMAIL ||
    !admins[0].firebaseUid
  ) stop('Super Admin identity/UID mismatch');

  const admin = admins[0];
  const old = users.filter(u => u.superAdminEnabled !== true);

  if (old.length !== 4)
    stop(`Expected 4 old users; found ${old.length}`);

  if (old.some(u =>
    String(u._id) === String(admin._id) ||
    u.firebaseUid === admin.firebaseUid
  )) stop('Super Admin overlaps old users');

  const userRefs = uniqueValues(
    old.flatMap(u => [u._id, u.firebaseUid])
  );

  const orgs = await db.collection('organizations').find({
    ownerUserId: {
      $in: uniqueValues(old.map(u => u._id))
    }
  }, {
    projection: { _id: 1 }
  }).toArray();

  if (orgs.length !== 2)
    stop(`Expected 2 Host organisations; found ${orgs.length}`);

  const orgRefs = uniqueValues(orgs.map(o => o._id));

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray())
      .map(c => c.name)
  );

  const chosen = new Map(
    COLLECTIONS.map(name => [name, new Map()])
  );

  function add(name, docs) {
    let changed = false;
    for (const doc of docs) {
      const key = String(doc._id);
      if (!chosen.get(name).has(key)) {
        chosen.get(name).set(key, doc._id);
        changed = true;
      }
    }
    return changed;
  }

  add('users', old);
  add('organizations', orgs);

  // Resolve child records only through verified user/org
  // ownership or an already-selected parent record.
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;

    for (const name of COLLECTIONS) {
      if (
        name === 'users' ||
        name === 'organizations' ||
        !existing.has(name)
      ) continue;

      const queries = [
        fieldMatch(USER_FIELDS, userRefs),
        fieldMatch(ORG_FIELDS, orgRefs)
      ];

      for (const [field, parent] of Object.entries(PARENT_FIELDS)) {
        const selectedIds = chosen.get(parent);

        if (selectedIds?.size) {
          queries.push({
            [field]: {
              $in: uniqueValues([...selectedIds.values()])
            }
          });
        }
      }

      if (name === 'notifications') {
        const related = [
          'organizations',
          'hostUnifiedListingPackets',
          'communityProductDrafts',
          'sellerOffers',
          'dishes'
        ].flatMap(p => [...chosen.get(p).keys()]);

        if (related.length) {
          queries.push({
            relatedEntityId: { $in: related }
          });
        }
      }

      const docs = await db.collection(name).find({
        $or: queries
      }, {
        projection: {
          _id: 1,
          userId: 1,
          ownerUserId: 1,
          hostUserId: 1,
          customerUserId: 1,
          createdByUserId: 1
        }
      }).toArray();

      if (docs.length > 20000)
        stop(`Unexpected match size in ${name}`);

      const adminRefs = new Set([
        String(admin._id),
        String(admin.firebaseUid)
      ]);

      const safe = docs.filter(d =>
        ![
          d.userId,
          d.ownerUserId,
          d.hostUserId,
          d.customerUserId,
          d.createdByUserId
        ].some(v =>
          v != null && adminRefs.has(String(v))
        )
      );

      if (add(name, safe)) changed = true;
    }

    if (!changed) break;

    if (pass === 9)
      stop('Linked-record scan did not converge');
  }

  const targets = Object.fromEntries(
    COLLECTIONS.map(name => [
      name,
      [...chosen.get(name).keys()].sort()
    ])
  );

  if (
    targets.users.length !== 4 ||
    targets.organizations.length !== 2 ||
    targets.users.includes(String(admin._id))
  ) stop('Root safety check failed');

  const roots = {
    adminId: String(admin._id),
    adminUid: admin.firebaseUid,
    oldUsers: old.map(u => ({
      id: String(u._id),
      uid: u.firebaseUid ?? '',
      email: u.email ?? ''
    })),
    orgIds: orgs.map(o => String(o._id)).sort()
  };

  return {
    roots,
    targets,
    checksum: digest({ roots, targets })
  };
}

let connected = false;

try {
  if (process.argv.slice(2).some(a => a !== '--apply'))
    stop('Unknown argument');

  if (
    norm(env.nodeEnv) === 'production' ||
    norm(process.env.NODE_ENV) === 'production'
  ) stop('Production environment blocked');

  await connectDatabase();
  connected = true;

  const db = mongoose.connection.db;

  if (db.databaseName !== DB)
    stop(`Wrong DB: ${db.databaseName}`);

  const plan = await select(db);

  console.log(
    `\nDB ${DB} | KEEP ADMIN ${ADMIN_EMAIL} | DELETE 4 USERS / 2 HOST ORGS`
  );

  for (const name of COLLECTIONS) {
    const n = plan.targets[name].length;
    if (n) {
      console.log(
        name.padEnd(37),
        String(n).padStart(5),
        '/',
        await db.collection(name).countDocuments({})
      );
    }
  }

  console.log(
    '\nNOT TOUCHED: Super Admin, shared catalog, developer images, Cloudinary, Firebase, admin roles/audits.'
  );
  console.log(
    'CAUTION: Unlinked/legacy catalog entries may remain; no shared records deleted by guesswork.'
  );

  fs.mkdirSync(SAVE_DIR, {
    recursive: true,
    mode: 0o700
  });

  if (!APPLY) {
    fs.writeFileSync(
      PLAN_FILE,
      JSON.stringify({ database: DB, ...plan }, null, 2),
      { mode: 0o600 }
    );

    console.log(
      '\nPREVIEW SAVED:', PLAN_FILE,
      '\nNO RECORDS DELETED'
    );
  } else {
    if (!fs.existsSync(PLAN_FILE))
      stop('Preview missing; run without --apply first');

    const before = JSON.parse(
      fs.readFileSync(PLAN_FILE, 'utf8')
    );

    if (
      before.database !== DB ||
      before.checksum !== plan.checksum
    ) stop('Data changed since preview; run preview again');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let typed;

    try {
      typed = await rl.question(
        'Type DELETE OLD USERS KEEP ADMIN: '
      );
    } finally {
      rl.close();
    }

    if (typed !== 'DELETE OLD USERS KEEP ADMIN')
      stop('Confirmation mismatch');

    const dir = path.join(
      SAVE_DIR,
      'targeted-apply-' +
      new Date().toISOString().replace(/[:.]/g, '-')
    );

    const dump = path.join(dir, 'mongo');

    fs.mkdirSync(dir, {
      recursive: true,
      mode: 0o700
    });

    console.log(
      'Backing up ALL MongoDB data before deleting...'
    );

    const result = spawnSync('mongodump', [
      '--uri', env.mongodbUri,
      '--db', DB,
      '--out', dump
    ], {
      encoding: 'utf8',
      timeout: 240000,
      maxBuffer: 8 * 1024 * 1024
    });

    const bson = path.join(
      dump, DB, 'users.bson'
    );

    if (
      result.error ||
      result.status !== 0 ||
      !fs.existsSync(bson) ||
      fs.statSync(bson).size === 0
    ) stop('Fresh backup FAILED. NO DELETION PERFORMED');

    console.log('BACKUP VERIFIED:', dir);

    fs.writeFileSync(
      path.join(dir, 'delete-manifest.json'),
      JSON.stringify({ database: DB, ...plan }, null, 2),
      { mode: 0o600 }
    );

    const last = [
      'recipeVersions',
      'dishes',
      'sellerOffers',
      'parentOrders',
      'households',
      'organizations',
      'users'
    ];

    const order = [
      ...COLLECTIONS.filter(n => !last.includes(n)),
      ...last
    ];

    // Delete only the explicitly selected document IDs.
    // No dropDatabase, dropCollection or deleteMany({}).
    for (const name of order) {
      const selectedIds = plan.targets[name];

      if (!selectedIds.length) continue;

      const query = {
        _id: { $in: selectedIds.map(asMongoId) }
      };

      if (name === 'users') {
        query.superAdminEnabled = { $ne: true };
      }

      const found = await db.collection(name)
        .countDocuments(query);

      if (found !== selectedIds.length) {
        stop(`${name}: selection changed; see backup`);
      }

      const removed = await db.collection(name)
        .deleteMany(query);

      if (removed.deletedCount !== selectedIds.length) {
        stop(`${name}: unexpected delete count; see backup`);
      }

      console.log('REMOVED', removed.deletedCount, name);
    }

    const admin = await db.collection('users').findOne({
      _id: asMongoId(plan.roots.adminId),
      superAdminEnabled: true
    });

    if (
      !admin ||
      norm(admin.email) !== ADMIN_EMAIL ||
      admin.firebaseUid !== plan.roots.adminUid
    ) stop('Admin post-check FAILED; see backup');

    console.log(
      'SUCCESS. Admin preserved. Non-admin users:',
      await db.collection('users').countDocuments({
        superAdminEnabled: { $ne: true }
      })
    );

    console.log(
      'MANIFEST:',
      path.join(dir, 'delete-manifest.json')
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (connected) {
    await disconnectDatabase().catch(() => {});
  }
}
