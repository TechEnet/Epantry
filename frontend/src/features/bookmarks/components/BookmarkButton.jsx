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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#122921]/65 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setLoginPrompt(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="bookmark-login-title" className="relative w-full max-w-[430px] rounded-[22px] border border-[#DCE0CF] bg-[#F0F2EB] p-6 shadow-2xl sm:p-7">
            <button type="button" aria-label="Close" onClick={() => setLoginPrompt(false)} className="focus-ring absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-[#DCE0CF] bg-white"><X size={18}/></button>
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[#F5DCCD] text-[#173F35]"><Bookmark size={22}/></span>
            <h2 id="bookmark-login-title" className="mt-4 text-[25px] font-bold leading-tight text-[#173F35]">Save it for later</h2>
            <p className="mt-2 text-[15px] leading-6 text-[#53665B]">Sign in as a Customer to bookmark {title}. Your saved recipes and groceries stay together in one place.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setLoginPrompt(false)} className="focus-ring flex-1 rounded-xl border border-[#D3D9CF] px-4 py-3 text-sm font-semibold text-[#173F35]">Not now</button>
              <button type="button" onClick={() => { setLoginPrompt(false); navigate(`/login?returnTo=${encodeURIComponent(loginTarget)}`) }} className="focus-ring flex-1 rounded-xl bg-[#173F35] px-4 py-3 text-sm font-semibold text-white">Sign in</button>
            </div>
          </section>
        </div>, document.body,
      )}
    </>
  )
}
