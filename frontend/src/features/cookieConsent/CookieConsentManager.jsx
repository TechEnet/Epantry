import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, ChartNoAxesCombined, LoaderCircle, LockKeyhole, Settings2, ShieldCheck, X,
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

// SVG artwork is supplied by the EPANTRY project in frontend/public/cookies/.
// Vite serves public assets from the site root, so the paths begin with /cookies/.
const COOKIE_ICON_IMAGES = [
  '/cookies/1.svg',
  '/cookies/2.svg',
  '/cookies/3.svg',
  '/cookies/4.svg',
  '/cookies/5.svg',
  '/cookies/6.svg',
]

const BASE = 'font-["Plus_Jakarta_Sans",Inter,sans-serif]'
const PRIMARY = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#245c49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60'
const OUTLINE = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#9FB1A4] bg-[#F7F6F2] px-5 py-2.5 text-[15px] font-semibold text-[#173F35] transition-colors hover:bg-[#E9EDE6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60'

function ConsentOption({ title, description, checked, disabled, onChange, required = false, icon: Icon }) {
  return (
    <label className={`group flex min-w-0 items-center gap-3 border-b border-[#D9DFD6] px-3 py-3.5 last:border-0 sm:gap-4 sm:px-4 sm:py-4 ${disabled ? 'cursor-default bg-[#EBEEE5]' : 'cursor-pointer bg-[#F7F6F2] transition-colors hover:bg-[#F0F2EA]'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#DCE0CF] text-[#173F35] sm:h-11 sm:w-11" aria-hidden="true">
        <Icon size={21} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-bold leading-5 text-[#173F35] sm:text-[16px]">{title}</span>
          {required && <span className="rounded-full bg-[#DCE0CF] px-2 py-0.5 text-[11px] font-bold text-[#173F35]">Always on</span>}
        </span>
        <span className="mt-1 block text-[13px] leading-[1.45] text-[#46534B] sm:text-[14px]">{description}</span>
      </span>
      <span className="relative flex h-11 w-[54px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          aria-label={`${title}${required ? ' (always active)' : ''}`}
        />
        <span className={`relative h-[27px] w-[47px] rounded-full border transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#C86C42] ${checked ? 'border-[#173F35] bg-[#173F35]' : 'border-[#A6B8AA] bg-[#E2E8DE]'}`}>
          <span className={`absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-[#F7F6F2] shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-0'}`} />
        </span>
      </span>
    </label>
  )
}

export default function CookieConsentManager() {
  const { user, isAuthenticated, isBootstrapping } = useAuth()
  const accountKey = isAuthenticated
    ? `user:${user?.firebaseUid || user?._id || user?.id || 'authenticated'}`
    : 'guest'
  const [cookieIconIndex, setCookieIconIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [choice, setChoice] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [draft, setDraft] = useState({ preferences: false, analytics: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const previousAccountKeyRef = useRef(null)
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)
  const requestSequence = useRef(0)
  const savingRef = useRef(false)
  savingRef.current = saving

  // Same gentle 3-second icon rotation as EPANTRY's illustrated hamburger.
  // Run while the banner or settings modal is visible and respect reduced-motion settings.
  useEffect(() => {
    const bannerVisible = choice?.hasDecision !== true && !bannerDismissed
    if (!loaded || isBootstrapping || (!bannerVisible && !modalOpen)) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timerId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      setCookieIconIndex((current) => (current + 1) % COOKIE_ICON_IMAGES.length)
    }, 3000)
    return () => window.clearInterval(timerId)
  }, [loaded, isBootstrapping, choice?.hasDecision, modalOpen, bannerDismissed])

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
    // Authentication bootstrap may temporarily render a guest account.
    // Do not treat that as a real account switch or erase returning-visitor
    // identity during an ordinary signed-in page refresh.
    if (!isBootstrapping) {
      if (previousAccountKeyRef.current !== null && previousAccountKeyRef.current !== accountKey) {
        window.dispatchEvent(new Event('epantry:website-identity-changed'))
      }
      previousAccountKeyRef.current = accountKey
    }
    clearRuntimeCookieConsent()
    setLoaded(false)
    setModalOpen(false)
    setBannerDismissed(false)
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
  // Dismissing does not save a consent choice; a full browser reload remounts
  // this component and shows the banner again if no choice was recorded.
  const showBanner = choice?.hasDecision !== true && !modalOpen && !bannerDismissed

  return createPortal(
    <div className={`${BASE} text-[#202421]`}>
      {showBanner && (
        <div className="fixed inset-x-3 bottom-3 z-[1400] sm:inset-x-5 sm:bottom-5">
          <section
            aria-label="EPANTRY cookie preferences"
            className="relative max-h-[calc(100dvh-3.5rem)] w-full overflow-y-auto rounded-[18px] border border-[#B8C7BA] bg-[#F7F6F2] shadow-[0_22px_60px_rgba(9,33,24,0.24)]"
          >
            <div className="absolute inset-y-0 left-0 w-[5px] bg-[#C86C42]" aria-hidden="true" />
          <div className="flex flex-col gap-2 px-3.5 py-3 pl-4 sm:gap-3 sm:px-5 sm:pl-6 sm:py-3.5 md:flex-row md:items-center md:gap-5 md:py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4 md:items-center">
              <div className="flex min-w-0 items-center gap-2.5 sm:shrink-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#DCE0CF] sm:h-[62px] sm:w-[62px] sm:rounded-[15px]" aria-hidden="true">
                  <span className="relative block h-9 w-9 sm:h-12 sm:w-12">
                    {COOKIE_ICON_IMAGES.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ease-in-out motion-reduce:transition-none ${index === cookieIconIndex ? 'opacity-100' : 'opacity-0'}`}
                      />
                    ))}
                  </span>
                </div>
                <h2 className="min-w-0 text-[20px] font-bold leading-[1.2] tracking-[-0.035em] text-[#173F35] sm:hidden">
                  Cookies, your choice.
                </h2>
              </div>
              <div className="min-w-0">
                <p className="hidden text-[12px] font-bold uppercase tracking-[0.055em] text-[#173F35] sm:block">
                  EPANTRY
                </p>
                <h2 className="mt-0.5 hidden text-[25px] font-bold leading-[1.18] tracking-[-0.035em] text-[#173F35] sm:block">
                  Cookies, served your way.
                </h2>
                <p className="max-w-[630px] text-[14px] leading-[1.4] text-[#3D4941] sm:mt-1 sm:text-[15px] sm:leading-[1.5]">
                  <span className="sm:hidden">Stay signed in securely. Optional cookies help us improve recipes and shopping.</span>
                  <span className="hidden sm:inline">Stay signed in securely. Allow optional cookies to help us make recipes and shopping easier for you.</span>
                </p>
                {error && (
                  <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#A6422D]">
                    <span>{error}</span>
                    <button type="button" onClick={() => void refresh()} className="rounded-md border border-[#A6422D] px-2.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Retry</button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid w-full shrink-0 grid-cols-2 gap-1.5 sm:gap-2 md:ml-auto md:w-[370px] md:border-l md:border-[#D6DED2] md:pl-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ preferences: false, analytics: false }, 'banner')}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] border border-[#B6C7B7] bg-[#EBEFE7] px-2 py-1.5 sm:min-h-[46px] sm:gap-2 sm:px-3 sm:py-2 text-[14px] font-semibold text-[#173F35] transition-colors hover:border-[#729682] hover:bg-[#E0E9DD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60 sm:text-[14px]"
              >
                {saving ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />}
                Essential only
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ preferences: true, analytics: true }, 'banner')}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] border border-[#173F35] bg-[#173F35] px-2 py-1.5 sm:min-h-[46px] sm:gap-2 sm:px-3 sm:py-2 text-[14px] font-semibold text-[#F7F6F2] transition-colors hover:bg-[#245C49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60 sm:text-[14px]"
              >
                <Check size={17} strokeWidth={2} aria-hidden="true" />
                Accept all
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setError('')
                  setDraft({ preferences: false, analytics: false })
                  setModalOpen(true)
                }}
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] border border-[#D6DFD2] bg-[#F1F3EC] px-3 py-1.5 sm:min-h-[42px] sm:px-4 sm:py-2 text-[14px] font-semibold text-[#173F35] transition-colors hover:border-[#A4BBA6] hover:bg-[#E7EDE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60"
              >
                <Settings2 size={17} strokeWidth={1.8} aria-hidden="true" />
                Customize my choices
              </button>
            </div>
          </div>
          </section>
          <button
            type="button"
            aria-label="Close cookie banner for now"
            title="Close for now"
            disabled={saving}
            onClick={() => setBannerDismissed(true)}
            className="group absolute -right-2 -top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#B8C7BA] bg-[#DCE0CF] text-[#173F35] shadow-[0_4px_12px_rgba(9,33,24,0.16)] transition-colors group-hover:bg-[#CED8C4]">
              <X size={15} strokeWidth={2.2} aria-hidden="true" />
            </span>
          </button>
        </div>
      )}

      {notice && !modalOpen && !showBanner && (
        <div role="status" className="fixed bottom-4 right-4 z-[1400] flex max-w-[330px] items-center gap-2 rounded-xl border border-[#A7B6A6] bg-[#F7F6F2] px-4 py-3 text-[14px] font-semibold text-[#173F35] shadow-lg">
          <Check size={18} aria-hidden="true" />{notice}
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')} className="ml-2 rounded-md p-1 hover:bg-[#DCE0CF]"><X size={15} /></button>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[1500] flex items-end justify-center bg-[#122D25]/65 p-2 backdrop-blur-[5px] sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-dialog-title"
            aria-describedby="cookie-dialog-description"
            className="flex w-full flex-col overflow-hidden rounded-[18px] border border-[#C8D5C8] bg-[#F7F6F2] shadow-[0_24px_80px_rgba(5,25,17,0.28)] sm:rounded-[22px]"
            style={{ maxWidth: '780px', maxHeight: 'calc(100dvh - 24px)' }}
          >
            <header className="relative shrink-0 border-b border-[#D5DED2] bg-[#F0F1EA] px-4 py-4 sm:px-6 sm:py-5">
              <div className="absolute inset-y-0 left-0 w-1 bg-[#C86C42]" aria-hidden="true" />
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[15px] bg-[#DCE0CF] sm:h-[68px] sm:w-[68px]" aria-hidden="true">
                  <span className="relative block h-12 w-12 sm:h-[56px] sm:w-[56px]">
                    {COOKIE_ICON_IMAGES.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ease-in-out motion-reduce:transition-none ${index === cookieIconIndex ? 'opacity-100' : 'opacity-0'}`}
                      />
                    ))}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pr-8 sm:pr-11">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#C86C42] sm:text-[12px]">EPANTRY / Cookie settings</span>
                  <h2 id="cookie-dialog-title" className="mt-1 text-[23px] font-bold leading-[1.2] tracking-[-0.025em] text-[#173F35] sm:text-[28px]">
                    Make cookies work for you
                  </h2>
                  <p id="cookie-dialog-description" className="mt-1.5 text-[13px] leading-[1.5] text-[#405047] sm:text-[14px]">
                    Keep essentials on. Choose what else you want to allow.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  aria-label="Close cookie settings"
                  className="absolute right-3 top-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C7D5C7] bg-[#F7F6F2] text-[#173F35] transition-colors hover:bg-[#DCE0CF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] disabled:cursor-wait disabled:opacity-60 sm:right-5 sm:top-5"
                >
                  <X size={18} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 sm:mb-3">
                <h3 className="text-[15px] font-bold text-[#173F35] sm:text-[17px]">Your preferences</h3>
                <span className="text-[12px] text-[#59645C] sm:text-[13px]">You can update these anytime.</span>
              </div>
              <div className="overflow-hidden rounded-[14px] border border-[#D0DBCF]">
                <ConsentOption
                  title="Essential"
                  required
                  disabled
                  checked
                  icon={LockKeyhole}
                  description="Keeps sign-in secure and remembers your cookie choice."
                />
                <ConsentOption
                  title="Preferences"
                  checked={draft.preferences}
                  onChange={(value) => setDraft((current) => ({ ...current, preferences: value }))}
                  icon={Settings2}
                  description="Allow optional browser preferences. Your account settings stay unchanged."
                />
                <ConsentOption
                  title="Analytics"
                  checked={draft.analytics}
                  onChange={(value) => setDraft((current) => ({ ...current, analytics: value }))}
                  icon={ChartNoAxesCombined}
                  description="Help us improve recipes and shopping through limited usage insights."
                />
              </div>
              {error && <p role="alert" className="mt-3 text-[14px] font-semibold text-[#A6422D]">{error}</p>}
            </div>
            <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#D6DDD2] bg-[#F7F6F2] px-3 py-3 sm:flex sm:items-center sm:justify-end sm:px-6 sm:py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ preferences: false, analytics: false }, 'settings')}
                className={`${OUTLINE} px-2.5 text-[13px] sm:px-5 sm:text-[15px]`}
              >
                Essential only
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(draft, 'settings')}
                className={`${PRIMARY} px-2.5 text-[13px] sm:px-5 sm:text-[15px]`}
              >
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
