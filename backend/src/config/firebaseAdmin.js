import {
  existsSync,
} from 'node:fs'

import path from 'node:path'

import {
  fileURLToPath,
} from 'node:url'

import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app'

import {
  getAuth,
} from 'firebase-admin/auth'

import {
  env,
} from './env.js'

/*
|--------------------------------------------------------------------------
| Validate Firebase Configuration
|--------------------------------------------------------------------------
*/

if (
  !env.firebaseProjectId
) {
  throw new Error(
    'Missing Firebase Admin configuration: FIREBASE_PROJECT_ID',
  )
}

if (
  !env.googleApplicationCredentials
) {
  throw new Error(
    'Missing Firebase Admin configuration: GOOGLE_APPLICATION_CREDENTIALS',
  )
}

/*
|--------------------------------------------------------------------------
| Resolve Backend Root
|--------------------------------------------------------------------------
|
| firebaseAdmin.js:
|
| backend/src/config/firebaseAdmin.js
|
| Going two levels upward gives:
|
| backend/
|
*/

const currentFile =
  fileURLToPath(
    import.meta.url,
  )

const currentDirectory =
  path.dirname(
    currentFile,
  )

const backendRoot =
  path.resolve(
    currentDirectory,
    '../..',
  )

/*
|--------------------------------------------------------------------------
| Resolve Firebase Credential File
|--------------------------------------------------------------------------
|
| backend/.env contains:
|
| GOOGLE_APPLICATION_CREDENTIALS=secrets/firebase-admin-service-account.json
|
| We convert it into an absolute path so Firebase behaves correctly whether
| the backend is launched directly or through the root npm workspace.
|
*/

const firebaseCredentialsPath =
  path.isAbsolute(
    env.googleApplicationCredentials,
  )
    ? env.googleApplicationCredentials
    : path.resolve(
        backendRoot,
        env.googleApplicationCredentials,
      )

/*
|--------------------------------------------------------------------------
| Fail Early If Credential File Does Not Exist
|--------------------------------------------------------------------------
*/

if (
  !existsSync(
    firebaseCredentialsPath,
  )
) {
  throw new Error(
    `Firebase Admin credential file not found at: ${firebaseCredentialsPath}`,
  )
}

/*
|--------------------------------------------------------------------------
| Google Application Credentials
|--------------------------------------------------------------------------
|
| Firebase Admin's applicationDefault() reads this standard environment
| variable.
|
| The private key itself never needs to be copied into application source
| code or into a VITE_* environment variable.
|
*/

process.env.GOOGLE_APPLICATION_CREDENTIALS =
  firebaseCredentialsPath

/*
|--------------------------------------------------------------------------
| Firebase Admin Application
|--------------------------------------------------------------------------
|
| Prevent duplicate Firebase app initialization during development,
| testing or future server tooling.
|
*/

export const firebaseAdminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        credential:
          applicationDefault(),

        projectId:
          env.firebaseProjectId,
      })

/*
|--------------------------------------------------------------------------
| Firebase Admin Authentication
|--------------------------------------------------------------------------
|
| Trusted SERVER-SIDE Firebase Auth instance.
|
| Future responsibilities:
|
| - verifyIdToken()
| - createSessionCookie()
| - verifySessionCookie()
| - revokeRefreshTokens()
| - updateUser()
|
*/

export const firebaseAdminAuth =
  getAuth(
    firebaseAdminApp,
  )