import { useEffect, useRef, useState } from 'react'
import { Bookmark, ArrowUpRight, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { listBookmarks, removeBookmark, saveBookmark } from '../services/bookmark.service'

function SavedSection({ title, items, onRemove, busyKey }) {
  return (
    <section className="border-t border-[#D9E0D5] py-8" aria-label={title}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-[25px] font-semibold text-[#173F35]">{title}</h2><span className="text-sm font-semibold text-[#63786B]">{items.length} saved</span></div>
      {items.length === 0 ? <p className="border-l-[3px] border-[#C86C42] bg-[#F3F1EB] px-4 py-4 text-[15px] text-[#53655A]">No saved {title.toLowerCase()} yet. Browse EPANTRY and use the bookmark icon on an item.</p> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(item => {
            const path = item.kind === 'recipe' ? `/recipes/${encodeURIComponent(item.slug)}` : `/grocery/product/${encodeURIComponent(item.slug)}`
            const key = `${item.kind}:${item.slug}`
            return <article key={key} className="relative flex min-w-0 flex-col overflow-hidden rounded-[15px] border border-[#DCE0CF] bg-[#F7F6F2]">
              <Link to={path} className="focus-ring group block">
                <div className="aspect-[4/3] overflow-hidden bg-[#E4E9DF]">{item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"/> : <div className="grid h-full place-items-center text-[#718678]"><Bookmark size={32}/></div>}</div>
                <div className="px-4 pb-3 pt-4"><p className="text-xs font-medium text-[#B15B3D]">{item.subtitle || (item.kind === 'recipe' ? 'Recipe' : 'Grocery')}</p><h3 className="mt-1 line-clamp-2 min-h-12 text-[17px] font-semibold leading-6 text-[#173F35]">{item.title}</h3></div>
              </Link>
              <div className="mt-auto flex items-center justify-between border-t border-[#DCE0CF] px-4 py-2">
                <Link to={path} className="focus-ring inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#173F35]">View item <ArrowUpRight size={16}/></Link>
                <button type="button" disabled={busyKey === key} onClick={() => onRemove(item)} className="focus-ring inline-flex min-h-10 items-center gap-1 text-sm font-medium text-[#A55036] disabled:opacity-50" aria-label={`Remove ${item.title} bookmark`}><Trash2 size={15}/> Remove</button>
              </div>
            </article>
          })}
        </div>
      }
    </section>
  )
}

export default function SavedItemsPage() {
  const { currentUser } = useAuth()
  const userId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '')
  const [params, setParams] = useSearchParams()
  const pendingKey = [params.get('saveKind'), params.get('saveSlug')].join(':')
  const appliedRef = useRef('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const refresh = async () => { setItems(await listBookmarks(userId)) }

  useEffect(() => {
    let live = true
    if (params.get('saveKind') && params.get('saveSlug')) return undefined
    setLoading(true)
    listBookmarks(userId).then(rows => { if (live) setItems(rows) }).catch(() => { if (live) setMessage('Could not load saved items. Please refresh.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [userId, pendingKey])

  useEffect(() => {
    const kind = params.get('saveKind')
    const slug = params.get('saveSlug')
    if (!kind || !slug || appliedRef.current === pendingKey) return
    appliedRef.current = pendingKey
    const finish = () => setParams(old => { const next = new URLSearchParams(old); next.delete('saveKind'); next.delete('saveSlug'); return next }, { replace: true })
    if (!['recipe', 'grocery'].includes(kind) || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) { finish(); return }
    saveBookmark(kind, slug, userId).then(() => refresh()).then(() => setMessage('Item added to your saved list.')).catch(error => setMessage(error?.response?.data?.message || 'Unable to save the requested item.')).finally(finish)
  }, [pendingKey, params, setParams, userId])

  const onRemove = async item => {
    const key = `${item.kind}:${item.slug}`
    setBusyKey(key)
    setMessage('')
    try { await removeBookmark(item.kind, item.slug, userId); await refresh() }
    catch (error) { setMessage(error?.response?.data?.message || 'Unable to remove this bookmark.') }
    finally { setBusyKey('') }
  }

  return <main className="min-w-0 bg-[#F7F6F2] px-4 py-7 sm:px-8 lg:px-10">
    <header className="border-b border-[#D6DDD4] pb-7">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[.12em] text-[#B35C3E]"><Bookmark size={17}/> Your collection</div>
      <h1 className="text-[34px] font-semibold tracking-[-.035em] text-[#173F35] sm:text-[43px]">Saved items</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#53665B]">Recipes you want to cook and groceries you want to revisit. Saved to your EPANTRY Customer account.</p>
      <div className="mt-5 flex gap-3"><Link to="/recipes" className="focus-ring rounded-full bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-white">Explore recipes</Link><Link to="/grocery" className="focus-ring rounded-full border border-[#D0D8CD] px-5 py-2.5 text-sm font-semibold text-[#173F35]">Browse grocery</Link></div>
    </header>
    {message && <p role="status" className="mt-5 border-l-[3px] border-[#C86C42] bg-[#F3E8DF] px-4 py-3 text-sm text-[#173F35]">{message}</p>}
    {loading ? <p className="py-10 text-[#53665B]">Loading saved items…</p> : <>
      <SavedSection title="Recipes" items={items.filter(item => item.kind === 'recipe')} onRemove={onRemove} busyKey={busyKey}/>
      <SavedSection title="Grocery" items={items.filter(item => item.kind === 'grocery')} onRemove={onRemove} busyKey={busyKey}/>
    </>}
  </main>
}
