import {
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app'

import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
} from 'firebase/auth'

import {
  clientEnv,
} from '../config/env'

/*
|--------------------------------------------------------------------------
| Firebase Web Configuration
|--------------------------------------------------------------------------
|
| These values identify the Firebase Web App.
|
| They are browser configuration values, not Firebase Admin secrets.
|
*/

const firebaseConfig = {
  apiKey:
    clientEnv
      .VITE_FIREBASE_API_KEY,

  authDomain:
    clientEnv
      .VITE_FIREBASE_AUTH_DOMAIN,

  projectId:
    clientEnv
      .VITE_FIREBASE_PROJECT_ID,

  storageBucket:
    clientEnv
      .VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    clientEnv
      .VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    clientEnv
      .VITE_FIREBASE_APP_ID,
}

/*
|--------------------------------------------------------------------------
| Firebase App
|--------------------------------------------------------------------------
|
| getApps() prevents Firebase from being initialized more than once.
|
| This is especially useful during Vite development / hot reload.
|
*/

export const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig,
      )

/*
|--------------------------------------------------------------------------
| Firebase Authentication
|--------------------------------------------------------------------------
*/

export const firebaseAuth =
  getAuth(
    firebaseApp,
  )

/*
|--------------------------------------------------------------------------
| Authentication Persistence
|--------------------------------------------------------------------------
|
| EPANTRY's final authentication architecture uses:
|
| Firebase credentials
|       ↓
| Firebase ID Token
|       ↓
| Express Backend
|       ↓
| Secure HttpOnly Firebase Session Cookie
|
| Because the long-lived application session will belong to the backend
| cookie, Firebase authentication itself should not leave another long-lived
| session inside browser localStorage.
|
| Later authentication operations will await this promise before signing in
| or creating an authenticated Firebase session.
|
*/

export const firebaseAuthReady =
  setPersistence(
    firebaseAuth,
    inMemoryPersistence,
  )