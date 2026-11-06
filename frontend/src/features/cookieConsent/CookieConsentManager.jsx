import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, Cookie, LoaderCircle, Settings2, ShieldCheck, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'

import { useAuth } from '../auth/context/AuthContext'
import {
  COOKIE_SETTINGS_EVENT,
  clearRuntimeCookieConsent,
  isConsentSyncStorageEvent,
  loadCookieConsent,
  notifyOtherConsentTabs,
  saveCookieConsent,
  setRuntimeCookieConsent,
} from './cookieConsent.service'

const BASE = 'font-["Plus_Jakarta_Sans",Inter,sans-serif]'
const PRIMARY = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#245c49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60'
const OUTLINE = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#9FB1A4] bg-[#F7F6F2] px-5 py-2.5 text-[15px] font-semibold text-[#173F35] transition-colors hover:bg-[#E9EDE6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60'

function ConsentOption({ title, description, checked, disabled, onChange, required = false }) {
  return (
    <label className={`flex min-w-0 items-start justify-between gap-3 border-b border-[#D9DFD6] py-4 last:border-0 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[16px] font-bold text-[#173F35]">
          {title}
          {required && <span className="rounded-full bg-[#DCE0CF] px-2.5 py-0.5 text-[12px] font-semibold text-[#173F35]">Always active</span>}
        </span>
        <span className="mt-1 block text-[14px] leading-[1.5] text-[#444E48]">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-[#173F35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        aria-label={`${title}${required ? ' (always active)' : ''}`}
      />
    </label>
  )
}

export default function CookieConsentManager() {
  const { user, isAuthenticated, isBootstrapping } = useAuth()
  const accountKey = isAuthenticated
    ? `user:${user?.firebaseUid || user?._id || user?.id || 'authenticated'}`
    : 'guest'
  const [loaded, setLoaded] = useState(false)
  const [choice, setChoice] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState({ preferences: false, analytics: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)
  const requestSequence = useRef(0)
  const savingRef = useRef(false)
  savingRef.current = saving

  const refresh = useCallback(async ({ signal } = {}) => {
    const sequence = ++requestSequence.current
    clearRuntimeCookieConsent()
    setLoaded(false)
    setError('')
    try {
      const result = await loadCookieConsent(signal)
      if (signal?.aborted || sequence !== requestSequence.current) return
      setChoice(result)
      setDraft({
        preferences: result.categories.preferences,
        analytics: result.categories.analytics,
      })
      setRuntimeCookieConsent(result)
      setLoaded(true)
    } catch (caught) {
      if (signal?.aborted || sequence !== requestSequence.current) return
      setChoice(null)
      setLoaded(true)
      setError('Cookie choices could not be loaded. Optional tracking remains off. Please retry.')
    }
  }, [])

  useEffect(() => {
    clearRuntimeCookieConsent()
    setLoaded(false)
    setModalOpen(false)
    setNotice('')
    if (isBootstrapping) return undefined
    const controller = new AbortController()
    void refresh({ signal: controller.signal })
    return () => {
      ++requestSequence.current
      controller.abort()
      clearRuntimeCookieConsent()
    }
  }, [accountKey, isBootstrapping, refresh])

  useEffect(() => {
    const openSettings = () => {
      setNotice('')
      setDraft({
        preferences: choice?.categories?.preferences === true,
        analytics: choice?.categories?.analytics === true,
      })
      setModalOpen(true)
    }
    const handleStorage = (event) => {
      if (isConsentSyncStorageEvent(event) && !saving && !isBootstrapping) {
        void refresh()
      }
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings)
      window.removeEventListener('storage', handleStorage)
    }
  }, [choice, isBootstrapping, refresh, saving])

  useEffect(() => {
    if (!modalOpen) return undefined
    previouslyFocused.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const initialFocus = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector('button[aria-label="Close cookie settings"]')?.focus()
    })
    const handleKey = (event) => {
      if (event.key === 'Escape' && !savingRef.current) {
        setModalOpen(false)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const elements = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')]
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(initialFocus)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      previouslyFocused.current?.focus?.()
    }
  }, [modalOpen])

  const save = async (categories, source) => {
    if (saving || isBootstrapping) return
    const identitySequence = requestSequence.current
    setSaving(true)
    setError('')
    setNotice('')
    // Withdrawal immediately closes M1-B's future tracking gate, even if
    // the server or network takes time to process the change.
    clearRuntimeCookieConsent()
    try {
      const result = await saveCookieConsent({
        ...categories,
        source,
        isUpdate: choice?.hasDecision === true,
      })
      if (identitySequence !== requestSequence.current) return
      setChoice(result)
      setDraft({ preferences: result.categories.preferences, analytics: result.categories.analytics })
      setRuntimeCookieConsent(result)
      notifyOtherConsentTabs()
      setLoaded(true)
      setModalOpen(false)
      setNotice('Cookie preferences saved.')
    } catch (caught) {
      if (identitySequence !== requestSequence.current) return
      setError(caught?.response?.data?.message || 'Could not save cookie choices. Please try again.')
      // Do not claim success or resume optional events when the API failed.
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined' || isBootstrapping || !loaded) return null
  const showBanner = choice?.hasDecision !== true && !modalOpen

  return createPortal(
    <div className={`${BASE} text-[#202421]`}>
      {showBanner && (
        <section aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-[1400] mx-auto max-w-[900px] overflow-hidden rounded-[20px] border border-[#B7C5B8] bg-[#F7F6F2] shadow-[0_20px_70px_rgba(19,44,34,.24)] sm:inset-x-6 sm:bottom-6">
          <div className="h-1 bg-[#C86C42]" aria-hidden="true" />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DCE0CF] text-[#173F35]"><Cookie size={20} aria-hidden="true" /></span>
                <h2 className="text-[19px] font-bold leading-6 tracking-[-0.025em] text-[#173F35]">Your cookies, your choice</h2>
              </div>
              <p className="mt-2 text-[14px] leading-[1.5] text-[#394840] sm:text-[15px]">
                Essential cookies keep EPANTRY secure. With your permission, optional cookies can remember preferences and support website analytics.
              </p>
              {error && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#A6422D]"><span>{error}</span><button type="button" onClick={() => void refresh()} className="rounded-md border border-[#A6422D] px-2.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Retry</button></div>}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-[308px]">
              <button type="button" disabled={saving} onClick={() => void save({ preferences: false, analytics: false }, 'banner')} className={OUTLINE}>
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}Reject optional
              </button>
              <button type="button" disabled={saving} onClick={() => void save({ preferences: true, analytics: true }, 'banner')} className={PRIMARY}>
                <Check size={17} aria-hidden="true" />Accept all
              </button>
              <button type="button" disabled={saving} onClick={() => { setError(''); setDraft({ preferences: false, analytics: false }); setModalOpen(true) }} className={`${OUTLINE} col-span-2`}>
                <Settings2 size={17} aria-hidden="true" />Customize
              </button>
            </div>
          </div>
        </section>
      )}

      {notice && !modalOpen && !showBanner && (
        <div role="status" className="fixed bottom-4 right-4 z-[1400] flex max-w-[330px] items-center gap-2 rounded-xl border border-[#A7B6A6] bg-[#F7F6F2] px-4 py-3 text-[14px] font-semibold text-[#173F35] shadow-lg">
          <Check size={18} aria-hidden="true" />{notice}
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')} className="ml-2 rounded-md p-1 hover:bg-[#DCE0CF]"><X size={15} /></button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-[#122D25]/65 px-3 py-3 backdrop-blur-[5px] sm:items-center sm:px-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title" aria-describedby="cookie-dialog-description" className="max-h-[calc(100dvh-24px)] w-full max-w-[580px] overflow-y-auto rounded-[20px] border border-[#CED8CE] bg-[#F7F6F2] shadow-[0_25px_100px_rgba(5,25,17,.3)]">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#D6DDD2] bg-[#F7F6F2] px-5 pb-4 pt-5 sm:px-7">
              <div>
                <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#C86C42]">Privacy settings</span>
                <h2 id="cookie-dialog-title" className="mt-1 text-[25px] font-bold leading-8 tracking-[-0.035em] text-[#173F35]">Choose your cookies</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)} aria-label="Close cookie settings" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#CDD7CA] text-[#173F35] transition hover:bg-[#E8EDE5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C86C42]"><X size={20} /></button>
            </header>
            <div className="px-5 py-4 sm:px-7">
              <p id="cookie-dialog-description" className="text-[15px] leading-[1.6] text-[#3F4943]">Manage how EPANTRY uses cookies. Optional categories are off unless you allow them. You can change this choice later in the footer.</p>
              <div className="mt-4 border-y border-[#D9DFD6]">
                <ConsentOption title="Essential" required disabled checked description="Needed for login security, session handling and remembering this cookie decision." />
                <ConsentOption title="Preferences" checked={draft.preferences} onChange={(value) => setDraft((current) => ({ ...current, preferences: value }))} description="Allow optional browser preferences. This does not change your account settings or marketing emails." />
                <ConsentOption title="Analytics" checked={draft.analytics} onChange={(value) => setDraft((current) => ({ ...current, analytics: value }))} description="Allow privacy-limited visits and activity measurement when EPANTRY's website tracker is connected." />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#E8EDE5] p-3 text-[13px] leading-[1.55] text-[#344A3C]">
                <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>No advertising tracker is connected here. Cookie choices are saved securely; analytics tracking itself is scheduled for M1-B.</p>
              </div>
              {error && <p role="alert" className="mt-3 text-[14px] font-semibold text-[#A6422D]">{error}</p>}
            </div>
            <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#D6DDD2] bg-[#F7F6F2] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" disabled={saving} onClick={() => void save({ preferences: false, analytics: false }, 'settings')} className={OUTLINE}>Reject optional</button>
              <button type="button" disabled={saving} onClick={() => void save(draft, 'settings')} className={PRIMARY}>
                {saving && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}
                Save my choices
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>,
    document.body,
  )
}
