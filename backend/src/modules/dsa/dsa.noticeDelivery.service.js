// Transactional reporter notices. Never include the secret report access key.
// Provider delivery is independently tracked; a saved moderation decision is not an email receipt.
import { env } from '../../config/env.js'
import { DsaNotice } from './dsa.models.js'

function clean(value, max = 1800) {
  return String(value || '').replace(/[\r\n\u0000-\u001f]+/g, ' ').trim().slice(0, max)
}

export async function notifyReporterForDecision(record, phase = 'decision') {
  if (!['decision', 'appeal'].includes(phase)) throw new Error('Invalid notice type')
  const field = phase === 'decision' ? 'reporterDecisionNotice' : 'reporterAppealNotice'
  const email = String(record.reporterContact || '').trim()
  let status = 'not_requested', errorCode = ''
  if (email && (!env.brevoApiKey || !env.brevoSenderEmail)) {
    status = 'configuration_missing'
    errorCode = 'BREVO_SENDER_OR_API_KEY_MISSING'
  } else if (email) {
    const subject = phase === 'decision'
      ? `EPANTRY report decision ${clean(record.reference, 90)}`
      : `EPANTRY appeal review ${clean(record.reference, 90)}`
    const decision = phase === 'decision' ? record.decisionReason : record.appealDecisionReason
    const textContent = [
      'EPANTRY Trust & Safety update', '',
      `Reference: ${clean(record.reference, 90)}`,
      `Status: ${phase === 'decision' ? 'Initial decision recorded' : 'Appeal review recorded'}`,
      `Decision summary: ${clean(decision)}`,
      '',
      'Use your previously issued private access key on the Report Listing page to check the case status or available appeal options.',
      'EPANTRY will never request your private report key by email.',
    ].join('\n')
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { accept: 'application/json', 'api-key': env.brevoApiKey,
          'content-type': 'application/json' },
        body: JSON.stringify({ sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
          to: [{ email }], subject, textContent }),
        signal: AbortSignal.timeout(6500),
      })
      status = response.ok ? 'provider_accepted' : 'failed'
      if (!response.ok) errorCode = `BREVO_HTTP_${response.status}`
    } catch (error) {
      status = 'failed'
      errorCode = error?.name === 'TimeoutError' ? 'BREVO_TIMEOUT' : 'BREVO_DELIVERY_ERROR'
    }
  }
  // A failure to persist notification metadata must not roll back the original moderation decision.
  await DsaNotice.updateOne({ _id: record._id }, {
    $set: { [`${field}.status`]: status, [`${field}.errorCode`]: errorCode,
      [`${field}.lastAttemptAt`]: new Date(),
      ...(status === 'provider_accepted' ? { [`${field}.acceptedAt`]: new Date() } : {}) },
    $inc: { [`${field}.attemptCount`]: 1 },
  }).catch(() => {})
  return { status, errorCode }
}
