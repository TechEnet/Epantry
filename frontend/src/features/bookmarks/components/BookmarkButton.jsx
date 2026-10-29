import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { bookmarkKey, listBookmarks, removeBookmark, saveBookmark } from '../services/bookmark.service'

export default function BookmarkButton({ kind, slug, title = 'this item', className = '' }) {
  const navigate = useNavigate()
  const { isAuthenticated, isBootstrapping, customerEnabled, superAdminEnabled, activeMode, currentUser } = useAuth()
  const userId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loginPrompt, setLoginPrompt] = useState(false)
  const [error, setError] = useState('')
  const canBookmark = !isAuthenticated || (customerEnabled && !superAdminEnabled && activeMode !== 'host')

  useEffect(() => {
    if (!isAuthenticated || !canBookmark || isBootstrapping) {
      setSaved(false)
      return undefined
    }
    let active = true
    const refresh = () => {
      listBookmarks(userId).then(items => {
        if (active) setSaved(items.some(item => bookmarkKey(item.kind, item.slug) === bookmarkKey(kind, slug)))
      }).catch(() => { if (active) setError('Unable to load saved items.') })
    }
    refresh()
    window.addEventListener('epantry:bookmarks-changed', refresh)
    return () => { active = false; window.removeEventListener('epantry:bookmarks-changed', refresh) }
  }, [isAuthenticated, canBookmark, isBootstrapping, userId, kind, slug])

  if (!canBookmark || isBootstrapping || !slug || !['recipe', 'grocery'].includes(kind)) return null

  const toggle = async event => {
    event.preventDefault()
    event.stopPropagation()
    if (!isAuthenticated) { setLoginPrompt(true); return }
    if (busy) return
    setError('')
    setBusy(true)
    try {
      if (saved) await removeBookmark(kind, slug, userId)
      else await saveBookmark(kind, slug, userId)
      setSaved(!saved)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not update bookmark.')
    } finally { setBusy(false) }
  }

  const loginTarget = `/saved-items?saveKind=${encodeURIComponent(kind)}&saveSlug=${encodeURIComponent(slug)}`
  return (
    <>
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} title={saved ? `Remove ${title} from saved items` : `Save ${title}`} aria-label={saved ? `Remove ${title} from saved items` : `Bookmark ${title}`} className={`focus-ring relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-[#DCE0CF] bg-[#F7F6F2]/95 text-[#173F35] shadow-[0_4px_14px_rgba(23,63,53,.15)] transition hover:border-[#C86C42] hover:bg-[#F6D9CA] disabled:opacity-60 ${className}`}>
        <Bookmark size={19} strokeWidth={1.9} fill={saved ? '#C86C42' : 'none'} aria-hidden="true" />
      </button>
      {error && <span role="alert" className="absolute right-2 top-14 z-30 max-w-56 rounded-lg bg-[#F7F6F2] px-3 py-2 text-xs font-semibold text-[#A34B32] shadow-md">{error}</span>}
      {loginPrompt && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#102B22]/65 px-4 py-5"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget) setLoginPrompt(false) }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookmark-login-title"
            aria-describedby="bookmark-login-description"
            className="relative overflow-hidden rounded-[20px] border border-[#D6DDD3] bg-[#F4F5F0] shadow-[0_24px_70px_rgba(16,43,34,0.28)]"
            style={{ boxSizing: 'border-box', width: '100%', maxWidth: '440px', flex: '0 1 440px' }}
          >
            <div className="h-[4px] bg-[#C86C42]" aria-hidden="true" />
            <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pb-7">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLoginPrompt(false)}
                className="focus-ring absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-[#D6DDD3] bg-[#F7F6F2] text-[#173F35] transition hover:bg-[#E4EAE1]"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 pr-10">
                <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[#F5D9C9] text-[#173F35]">
                  <Bookmark size={20} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[12px] font-bold uppercase tracking-[0.10em] text-[#AF5637]">YOUR SAVED ITEMS</span>
                  <div
                    id="bookmark-login-title"
                    role="heading"
                    aria-level="2"
                    className="mt-0.5 font-bold text-[#173F35]"
                    style={{ fontSize: '24px', lineHeight: '1.24' }}
                  >
                    Save this {kind === 'recipe' ? 'recipe' : 'product'}
                  </div>
                </div>
              </div>

              <p id="bookmark-login-description" className="mt-4 text-[15px] leading-[1.6] text-[#496056]">
                Sign in as a Customer to bookmark <strong className="font-semibold text-[#173F35]">{title}</strong> and find it anytime in Saved items.
              </p>

              <div className="mt-5 flex gap-3 border-t border-[#D7DFD6] pt-5">
                <button
                  type="button"
                  onClick={() => setLoginPrompt(false)}
                  className="focus-ring min-h-11 flex-1 rounded-[11px] border border-[#C9D5CA] bg-[#F7F6F2] px-3 py-2.5 text-[15px] font-semibold text-[#173F35] transition hover:bg-[#E5EBE2]"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginPrompt(false); navigate(`/login?returnTo=${encodeURIComponent(loginTarget)}`) }}
                  className="focus-ring min-h-11 flex-1 rounded-[11px] bg-[#173F35] px-3 py-2.5 text-[15px] font-semibold text-[#F7F6F2] transition hover:bg-[#225744]"
                >
                  Sign in
                </button>
              </div>
            </div>
          </section>
        </div>, document.body,
      )}
    </>
  )
}
