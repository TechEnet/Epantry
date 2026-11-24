/**
 * EPANTRY Brevo email OTP diagnostics.
 * Default: read-only Brevo configuration checks. No database/Firebase access.
 * Optional --send-test: explicitly sends ONE test email after confirmation.
 * Run from backend/: node scripts/diagnose-brevo-otp.mjs [--send-test]
 */
import dotenv from 'dotenv'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readSecretFromBoundary } from '../src/integrations/secrets/secretsBoundary.service.js'

dotenv.config()

const API = 'https://api.brevo.com/v3'
const senderEmail = String(process.env.BREVO_SENDER_EMAIL || '').trim().toLowerCase()
const senderName = String(process.env.BREVO_SENDER_NAME || 'EPANTRY').trim()
const testMode = process.argv.includes('--send-test')
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--send-test')

if (unknownArgs.length) {
  console.error('Usage: node scripts/diagnose-brevo-otp.mjs [--send-test]')
  process.exit(2)
}

let apiKey = ''
let otpSecret = ''
try {
  apiKey = readSecretFromBoundary('BREVO_API_KEY')
} catch (error) {
  console.log('BREVO_API_KEY: cannot read key/file (' + (error.code || 'READ_ERROR') + ')')
}
try {
  otpSecret = readSecretFromBoundary('AUTH_EMAIL_OTP_HMAC_SECRET')
} catch (error) {
  console.log('AUTH_EMAIL_OTP_HMAC_SECRET: cannot read secret/file (' + (error.code || 'READ_ERROR') + ')')
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const redacted = (value) => String(value || '')
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email-redacted]')
  .replace(apiKey || /(?!)\b/g, '[secret-redacted]')
  .slice(0, 300)

function statusMeaning(status) {
  if (status === 400 || status === 422) return 'Bad email payload/sender; check Brevo sender verification and message format.'
  if (status === 401) return 'Brevo API key missing/invalid; use a REST API v3 key (not SMTP password).'
  if (status === 403) return 'Brevo account/sending permission or IP authorization restriction.'
  if (status === 429) return 'Brevo API rate limit reached.'
  if (status >= 500) return 'Brevo server/network service failure; check Brevo status.'
  return 'Consult the Brevo dashboard or support using the HTTP status and error code.'
}

async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(API + path, {
      ...options,
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    const code = error?.cause?.code || error?.code || error?.name || 'NETWORK_ERROR'
    return { ok: false, networkError: String(code) }
  }
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

function printFailure(result) {
  if (result.networkError) {
    console.log('  Network failure:', result.networkError)
    console.log('  Check internet/DNS/firewall connection to api.brevo.com:443.')
    return
  }
  console.log('  HTTP status:', result.status)
  const safeCode = typeof result.body?.code === 'string' ? redacted(result.body.code) : ''
  const safeMessage = typeof result.body?.message === 'string' ? redacted(result.body.message) : ''
  if (safeCode) console.log('  Brevo error code:', safeCode)
  if (safeMessage) console.log('  Brevo reason:', safeMessage)
  console.log('  Next check:', statusMeaning(result.status))
}

console.log('\nEPANTRY REGISTRATION EMAIL DIAGNOSTICS')
console.log('------------------------------------------------')
console.log('BREVO_API_KEY:', apiKey ? 'configured' : 'MISSING')
console.log('BREVO_SENDER_EMAIL:', emailPattern.test(senderEmail) ? 'valid format' : 'MISSING / INVALID')
console.log('BREVO_SENDER_NAME:', senderName ? 'configured' : 'MISSING')
console.log('OTP security secret:', otpSecret.length >= 32 ? 'configured (>=32 chars)' : 'MISSING / TOO SHORT')
console.log('Mode:', testMode ? 'diagnostics + optional single email' : 'read-only (no emails sent)')

if (!apiKey || !emailPattern.test(senderEmail)) {
  console.log('\nSTOP: Set BREVO_API_KEY and BREVO_SENDER_EMAIL in backend/.env, then rerun.')
  process.exit(1)
}

console.log('\n[1/2] Checking Brevo API key/account...')
const account = await apiRequest('/account')
if (!account.ok) {
  printFailure(account)
} else {
  console.log('  Account API: OK (HTTP ' + account.status + ')')
  if (typeof account.body?.relay?.enabled === 'boolean') {
    console.log('  Transactional relay enabled:', account.body.relay.enabled ? 'YES' : 'NO')
    if (!account.body.relay.enabled) console.log('  Action: request transactional sending activation from Brevo.')
  } else {
    console.log('  Transactional relay status: not returned by account endpoint')
  }
}

console.log('\n[2/2] Checking configured sender in Brevo...')
const senders = await apiRequest('/senders')
if (!senders.ok) {
  printFailure(senders)
} else {
  const list = Array.isArray(senders.body?.senders) ? senders.body.senders : []
  const match = list.find((sender) => String(sender.email || '').toLowerCase() === senderEmail)
  console.log('  Senders API: OK (HTTP ' + senders.status + ')')
  console.log('  Configured email explicitly listed:', match ? 'YES' : 'NO')
  if (match) {
    console.log('  Listed sender active:', match.active === true ? 'YES' : match.active === false ? 'NO' : 'UNKNOWN')
    if (match.active === false) console.log('  Action: verify/activate the sender in Brevo.')
  } else {
    console.log('  Action: check sender authorization OR authenticated sending domain in Brevo dashboard.')
  }
}

if (testMode) {
  console.log('\nOPTIONAL TEST: one email to a mailbox you control.')
  const rl = createInterface({ input, output })
  try {
    const recipient = (await rl.question('Test recipient email (not printed): ')).trim()
    if (!emailPattern.test(recipient)) {
      console.log('Invalid recipient. No email sent.')
      process.exitCode = 1
    } else {
      const confirmation = (await rl.question('Type SEND to authorize exactly one test email: ')).trim()
      if (confirmation !== 'SEND') {
        console.log('Cancelled. No email sent.')
      } else {
        const result = await apiRequest('/smtp/email', {
          method: 'POST',
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: recipient }],
            subject: 'EPANTRY email delivery diagnostic',
            textContent: 'This is one manual EPANTRY Brevo delivery test. No registration code is contained in this message.',
          }),
        })
        if (!result.ok) {
          console.log('  TEST SEND: FAILED')
          printFailure(result)
          process.exitCode = 1
        } else {
          console.log('  TEST SEND: ACCEPTED (HTTP ' + result.status + ')')
          console.log('  Check recipient inbox/spam and Brevo Transactional > Logs for delivery.')
        }
      }
    }
  } finally {
    rl.close()
  }
}
console.log('\nSafety: No OTPs, API keys or database records were printed or changed.')
console.log('Share only this diagnostic output, never your .env or API key.\n')
