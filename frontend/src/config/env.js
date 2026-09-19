import { z } from 'zod'

/*
|--------------------------------------------------------------------------
| Frontend Environment Schema
|--------------------------------------------------------------------------
|
| Only browser-safe configuration belongs here.
|
| IMPORTANT:
| Every VITE_* variable is exposed to the browser by Vite.
| Never place Firebase Admin credentials, Brevo secrets, database secrets
| or other private server credentials here.
|
*/

const envSchema = z.object({
  VITE_API_URL:
    z.string().url(),

  VITE_FIREBASE_API_KEY:
    z.string().trim().min(1),

  VITE_FIREBASE_AUTH_DOMAIN:
    z.string().trim().min(1),

  VITE_FIREBASE_PROJECT_ID:
    z.string().trim().min(1),

  VITE_FIREBASE_STORAGE_BUCKET:
    z.string().trim().min(1),

  VITE_FIREBASE_MESSAGING_SENDER_ID:
    z.string().trim().min(1),

  VITE_FIREBASE_APP_ID:
    z.string().trim().min(1),
})

/*
|--------------------------------------------------------------------------
| Validate Environment
|--------------------------------------------------------------------------
|
| Fail immediately when required configuration is missing instead of
| allowing Firebase to fail later with a confusing runtime error.
|
*/

const parsed =
  envSchema.safeParse(
    import.meta.env,
  )

if (!parsed.success) {
  throw new Error(
    'Invalid frontend environment. Check frontend/.env against frontend/.env.example.',
  )
}

/*
|--------------------------------------------------------------------------
| Browser-Safe Environment
|--------------------------------------------------------------------------
*/

export const clientEnv =
  parsed.data