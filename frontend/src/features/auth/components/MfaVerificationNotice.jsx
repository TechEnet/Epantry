import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, LockKeyhole, ShieldAlert, X } from 'lucide-react'

import { API_MFA_VERIFICATION_REQUIRED_EVENT } from '../../../api/apiClient'
import {
  AUTH_SESSION_ESTABLISHED_EVENT,
  AUTH_SESSION_CLEARED_EVENT,
} from '../services/auth.service'

const MFA_NOTICE_STYLE = `
.ep-mfa-overlay, .ep-mfa-overlay * { box-sizing:border-box; }
.ep-mfa-overlay {
  position:fixed !important; inset:0 !important; z-index:2147483000 !important;
  display:grid !important; place-items:center !important;
  width:100vw !important; height:100svh !important; min-height:100svh !important;
  padding:20px !important; margin:0 !important; overflow-y:auto !important;
  background:rgba(15,25,21,.62) !important;
  -webkit-backdrop-filter:blur(10px) !important; backdrop-filter:blur(10px) !important;
}
.ep-mfa-overlay .ep-mfa-dialog {
  position:relative !important; margin:auto !important; padding:0 !important;
  width:min(100%,500px) !important; min-width:0 !important; max-width:500px !important;
  max-height:calc(100svh - 40px) !important; overflow-y:auto !important;
  border:1px solid #E2CFC2 !important; border-radius:19px !important;
  background:#FFFDFC !important; color:#202421 !important;
  box-shadow:0 32px 90px rgba(5,20,14,.34) !important;
  font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;
}
.ep-mfa-dialog .ep-mfa-accent {height:7px;background:#C86C42;}
.ep-mfa-dialog .ep-mfa-body {padding:28px 30px 30px;}
.ep-mfa-dialog .ep-mfa-top {display:flex;align-items:center;justify-content:space-between;gap:15px;}
.ep-mfa-dialog .ep-mfa-icon {
  width:45px;height:45px;display:grid;place-items:center;border-radius:12px;
  border:1px solid #E7BFA9;background:#FBEDE4;color:#AD5936;flex-shrink:0;
}
.ep-mfa-dialog .ep-mfa-close {
  display:grid;place-items:center;width:41px;height:41px;padding:0;
  border:0;border-radius:11px;color:#536058;background:#F7F6F2;cursor:pointer;
}
.ep-mfa-dialog .ep-mfa-close:hover {background:#F1D8C9;color:#202421;}
.ep-mfa-dialog .ep-mfa-eyebrow {margin:22px 0 9px;color:#A95330;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;line-height:1.5;}
.ep-mfa-dialog .ep-mfa-title {margin:0;color:#202421;font-size:29px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:-.03em;}
.ep-mfa-dialog .ep-mfa-copy {margin:12px 0 0;color:#4C5C53;font-size:15px;line-height:1.6;}
.ep-mfa-dialog .ep-mfa-note {
  display:flex;gap:10px;align-items:flex-start;margin:19px 0 0;padding:12px 13px;
  background:#F7F6F2;border:1px solid #E6E3DA;border-radius:10px;
  color:#4E5953;font-size:14px;line-height:1.5;
}
.ep-mfa-dialog .ep-mfa-actions {display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:22px;}
.ep-mfa-dialog .ep-mfa-verify {
  display:inline-flex;align-items:center;justify-content:center;gap:10px;
  min-height:47px;padding:11px 20px;border:0;border-radius:11px;
  color:#FFFFFF !important;background:#173F35 !important;font-size:15px;font-weight:700;
  text-decoration:none;white-space:nowrap;cursor:pointer;
}
.ep-mfa-dialog .ep-mfa-verify:hover {background:#245849 !important;}
.ep-mfa-dialog .ep-mfa-cancel {
  min-height:47px;padding:10px 15px;border:1px solid #DDC0AE;border-radius:11px;
  background:#FFFDFC;color:#86503B;font-size:14px;font-weight:700;cursor:pointer;
}
.ep-mfa-dialog .ep-mfa-cancel:hover {background:#FBEDE4;}
.ep-mfa-dialog :where(a,button):focus-visible {outline:2px solid #C86C42!important;outline-offset:3px;}
@media(max-width:520px) {
  .ep-mfa-overlay {padding:15px !important;}
  .ep-mfa-overlay .ep-mfa-dialog {max-height:calc(100svh - 30px) !important;border-radius:16px !important;}
  .ep-mfa-dialog .ep-mfa-body {padding:22px 21px 24px;}
  .ep-mfa-dialog .ep-mfa-title {font-size:25px !important;}
  .ep-mfa-dialog .ep-mfa-actions {flex-direction:column;align-items:stretch;}
  .ep-mfa-dialog .ep-mfa-verify,.ep-mfa-dialog .ep-mfa-cancel {width:100%;}
}
@media(prefers-reduced-motion:reduce) { .ep-mfa-overlay * {transition:none !important;animation-duration:.01ms !important;} }
`

// Uses the existing MFA step-up route; no security decision is made client-side.
export default function MfaVerificationNotice() {
  const location = useLocation()
  const [required, setRequired] = useState(false)
  const [returnTo, setReturnTo] = useState('')
  const dialogRef = useRef(null)
  const verifyRef = useRef(null)

  useEffect(() => {
    const onRequired = (event) => {
      setReturnTo(event.detail?.returnTo || '')
      setRequired(true)
    }
    const onClear = () => {
      setRequired(false)
      setReturnTo('')
    }
    window.addEventListener(API_MFA_VERIFICATION_REQUIRED_EVENT, onRequired)
    window.addEventListener(AUTH_SESSION_ESTABLISHED_EVENT, onClear)
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onClear)
    return () => {
      window.removeEventListener(API_MFA_VERIFICATION_REQUIRED_EVENT, onRequired)
      window.removeEventListener(AUTH_SESSION_ESTABLISHED_EVENT, onClear)
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onClear)
    }
  }, [])

  const visible = required && location.pathname !== '/account/security/verify'

  useEffect(() => {
    if (!visible) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    verifyRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setRequired(false)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll('a[href], button:not([disabled])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [visible])

  if (!visible || typeof document === 'undefined') return null
  const previousPage = returnTo || `${location.pathname}${location.search}${location.hash}`

  return createPortal(
    <>
      <style>{MFA_NOTICE_STYLE}</style>
      <div className="ep-mfa-overlay" role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, display: 'grid', placeItems: 'center', backgroundColor: 'rgba(15,25,21,.62)', backdropFilter: 'blur(10px)' }}>
        <section
          ref={dialogRef} className="ep-mfa-dialog" role="dialog" aria-modal="true"
          aria-labelledby="mfa-required-title" aria-describedby="mfa-required-description"
          style={{ width: 'min(100%, 500px)', margin: 'auto', backgroundColor: '#FFFDFC', borderRadius: 19 }}
        >
          <div className="ep-mfa-accent" aria-hidden="true" />
          <div className="ep-mfa-body">
            <div className="ep-mfa-top">
              <span className="ep-mfa-icon"><ShieldAlert aria-hidden="true" size={24} /></span>
              <button type="button" aria-label="Close verification prompt" onClick={() => setRequired(false)} className="ep-mfa-close"><X aria-hidden="true" size={19} /></button>
            </div>
            <p className="ep-mfa-eyebrow">Account protection</p>
            <h2 id="mfa-required-title" className="ep-mfa-title">Confirm your identity</h2>
            <p id="mfa-required-description" className="ep-mfa-copy">
              You need to verify your account before you can complete this protected action.
            </p>
            <p className="ep-mfa-note"><LockKeyhole aria-hidden="true" size={18} style={{ flexShrink: 0, color: '#A95330', marginTop: 1 }} /> Enter your account password and authenticator code to continue.</p>
            <div className="ep-mfa-actions">
              <Link
                ref={verifyRef} to="/account/security/verify" state={{ returnTo: previousPage }}
                onClick={() => setRequired(false)} className="ep-mfa-verify"
              >
                Verify now <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <button type="button" onClick={() => setRequired(false)} className="ep-mfa-cancel">Not now</button>
            </div>
          </div>
        </section>
      </div>
    </>,
    document.body,
  )
}
