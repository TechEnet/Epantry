import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { firebaseAdminAuth } from '../src/config/firebaseAdmin.js';

const ADMIN_EMAIL = 'alokgkp8@gmail.com';
const APPLY = process.argv.includes('--apply');

const base = path.join(
  os.homedir(),
  'EPANTRY_RESET_BACKUPS'
);

const folders = fs.readdirSync(base)
  .filter(n => n.startsWith('targeted-apply-'))
  .sort();

if (!folders.length) {
  throw new Error('No completed targeted MongoDB apply manifest found');
}

const filename = path.join(
  base,
  folders.at(-1),
  'delete-manifest.json'
);

if (!fs.existsSync(filename)) {
  throw new Error('Latest manifest missing');
}

const manifest = JSON.parse(
  fs.readFileSync(filename, 'utf8')
);

const users = manifest.roots?.oldUsers ?? [];

if (
  manifest.database !== 'epantry' ||
  users.length !== 4 ||
  !manifest.roots?.adminUid ||
  !manifest.checksum ||
  users.some(u =>
    !u.uid ||
    u.uid === manifest.roots.adminUid ||
    u.email.toLowerCase() === ADMIN_EMAIL
  )
) {
  throw new Error('STOP: Firebase target manifest is invalid');
}

const norm = v => String(v ?? '').trim().toLowerCase();

const protectedUser = await firebaseAdminAuth.getUser(
  manifest.roots.adminUid
);

if (norm(protectedUser.email) !== ADMIN_EMAIL) {
  throw new Error(
    'STOP: Protected Super Admin Firebase UID/email mismatch'
  );
}

console.log('KEEP Super Admin:', protectedUser.email);

const present = [];

for (const u of users) {
  try {
    const f = await firebaseAdminAuth.getUser(u.uid);

    if (
      norm(f.email) !== norm(u.email) ||
      norm(f.email) === ADMIN_EMAIL
    ) {
      throw new Error(
        'STOP: UID/email mismatch for old account; no deletion'
      );
    }

    present.push(u);
    console.log('OLD FIREBASE USER:', f.email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.log('ALREADY ABSENT:', u.email);
    } else {
      throw e;
    }
  }
}

if (!APPLY) {
  console.log(
    'PREVIEW ONLY:',
    present.length,
    'Firebase users eligible; NOTHING DELETED'
  );
} else {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answer;

  try {
    answer = await rl.question(
      'Type DELETE OLD FIREBASE USERS: '
    );
  } finally {
    rl.close();
  }

  if (answer !== 'DELETE OLD FIREBASE USERS') {
    throw new Error('Cancelled');
  }

  for (const u of present) {
    await firebaseAdminAuth.deleteUser(u.uid);
    console.log('DELETED FIREBASE USER:', u.email);
  }

  const check = await firebaseAdminAuth.getUser(
    manifest.roots.adminUid
  );

  if (norm(check.email) !== ADMIN_EMAIL) {
    throw new Error('Super Admin final check failed');
  }

  console.log(
    'Firebase cleanup complete. Super Admin preserved.'
  );
}
