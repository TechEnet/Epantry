import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, BookOpen, ChefHat, ShoppingBasket, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { listBookmarks, removeBookmark, saveBookmark } from '../services/bookmark.service'

const COLLECTION_STYLES = {
  recipe: {
    number: '01',
    title: 'Recipes',
    surface: 'bg-[#E5EDF8]',
    border: 'border-[#CEDCED]',
    rule: 'border-[#C7D8EB]',
    iconSurface: 'bg-[#CBDBF1]',
    iconColor: 'text-[#28517B]',
    countSurface: 'bg-[#F3F7FD]',
    emptySurface: 'bg-[#F2F6FC]',
    action: 'bg-[#254E76] hover:bg-[#183B60]',
    browseLabel: 'Explore recipes',
    browsePath: '/recipes',
    emptyTitle: 'Your recipe shelf is ready.',
    emptyHint: 'Bookmark a recipe you like and it will appear here.',
    Icon: ChefHat,
  },
  grocery: {
    number: '02',
    title: 'Grocery',
    surface: 'bg-[#FCE8DA]',
    border: 'border-[#F0D1BC]',
    rule: 'border-[#ECC9B3]',
    iconSurface: 'bg-[#F7D1B7]',
    iconColor: 'text-[#985039]',
    countSurface: 'bg-[#FFF5ED]',
    emptySurface: 'bg-[#FFF4EB]',
    action: 'bg-[#874A36] hover:bg-[#693729]',
    browseLabel: 'Browse grocery',
    browsePath: '/grocery',
    emptyTitle: 'Keep your favourites close.',
    emptyHint: 'Bookmark grocery items to find them here again.',
    Icon: ShoppingBasket,
  },
}

function SavedSection({ kind, items, onRemove, busyKey }) {
  const style = COLLECTION_STYLES[kind]
  const Icon = style.Icon

  return (
    <section className={`min-w-0 overflow-hidden rounded-[22px] border ${style.border} ${style.surface}`} aria-label={style.title}>
      <div className={`flex items-start justify-between gap-3 border-b ${style.rule} px-5 py-5 sm:px-7 sm:py-6`}>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] ${style.iconSurface} ${style.iconColor}`} aria-hidden="true">
            <Icon size={23} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.11em] text-[#506657]">{style.number} / YOUR COLLECTION</p>
            <h2 className="mt-0.5 text-[25px] font-bold tracking-[-.035em] text-[#163F32] sm:text-[29px]">{style.title}</h2>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border ${style.border} ${style.countSurface} px-3 py-1.5 text-[13px] font-bold text-[#244E40]`}>
          {items.length} saved
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-5 sm:px-7 sm:py-7">
          <div className={`flex min-h-[150px] flex-col justify-center rounded-[16px] border ${style.border} ${style.emptySurface} px-5 py-5 sm:min-h-[170px] sm:px-7`}>
            <Icon className={`mb-3 ${style.iconColor}`} size={26} strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[19px] font-bold leading-6 text-[#193F32]">{style.emptyTitle}</p>
            <p className="mt-2 max-w-md text-[14px] leading-[1.55] text-[#56695F]">{style.emptyHint}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-7 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(item => {
            const path = item.kind === 'recipe' ? `/recipes/${encodeURIComponent(item.slug)}` : `/grocery/product/${encodeURIComponent(item.slug)}`
            const key = `${item.kind}:${item.slug}`

            return (
              <article key={key} className="relative flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#DEE3DA] bg-[#FFFEFB] shadow-[0_8px_22px_rgba(20,59,43,.055)]">
                <Link to={path} className="focus-ring group block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#DDE7DD]">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="grid h-full place-items-center text-[#789487]"><Bookmark size={36} strokeWidth={1.6} /></div>
                    )}
                    <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[#FCFFFA] text-[#18503B] shadow-sm" aria-hidden="true"><Bookmark size={17} fill="currentColor" /></span>
                  </div>
                  <div className="px-4 pb-4 pt-3.5">
                    <p className="text-[12px] font-semibold text-[#956047]">{item.subtitle || (item.kind === 'recipe' ? 'Recipe' : 'Grocery')}</p>
                    <h3 className="mt-1 line-clamp-2 min-h-12 text-[17px] font-bold leading-6 text-[#173F35]">{item.title}</h3>
                  </div>
                </Link>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#E6E7DD] px-4 py-2.5">
                  <Link to={path} className="focus-ring inline-flex min-h-10 items-center gap-1.5 text-[14px] font-bold text-[#174936]">View item <ArrowUpRight size={17} /></Link>
                  <button
                    type="button"
                    disabled={busyKey === key}
                    onClick={() => onRemove(item)}
                    className="focus-ring inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-[#A04E3D] disabled:opacity-50"
                    aria-label={`Remove ${item.title} bookmark`}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className={`flex justify-end border-t ${style.rule} px-5 py-3.5 sm:px-7`}>
        <Link to={style.browsePath} className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 py-2 text-[14px] font-bold text-white transition-colors ${style.action}`}>
          {style.browseLabel} <ArrowUpRight size={16} />
        </Link>
      </div>
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

  const recipeItems = items.filter(item => item.kind === 'recipe')
  const groceryItems = items.filter(item => item.kind === 'grocery')
  const bothEmpty = !loading && recipeItems.length === 0 && groceryItems.length === 0

  return (
    <main className="min-h-[70svh] min-w-0 bg-[#F6F5F0] px-4 pb-9 pt-5 sm:px-7 sm:pb-12 sm:pt-7 lg:px-9">
      <header className="overflow-hidden rounded-[22px] bg-[#174A39] text-white">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(245px,0.37fr)]">
          <div className="px-5 py-6 sm:px-9 sm:py-8 lg:py-10">
            <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.12em] text-[#F8C8AE]"><Bookmark size={16} /> Your collection</p>
            <h1 className="mt-3 text-[35px] font-extrabold leading-[1.08] tracking-[-.045em] sm:text-[44px] lg:text-[49px]">Saved <span className="text-[#F8C8AE]">items.</span></h1>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-px border-t border-[#4A765F] bg-[#CDE2D1] text-[#174A39] lg:border-l lg:border-t-0">
            <div className="flex flex-col justify-center bg-[#DDF0E4] px-5 py-5 sm:px-7">
              <BookOpen size={21} strokeWidth={1.8} aria-hidden="true" />
              <span className="mt-2 text-[35px] font-extrabold leading-none tracking-[-.045em] sm:text-[43px]">{recipeItems.length}</span>
              <span className="mt-2 text-[13px] font-semibold">Recipes</span>
            </div>
            <div className="flex flex-col justify-center bg-[#E8F3D9] px-5 py-5 sm:px-7">
              <ShoppingBasket size={21} strokeWidth={1.8} aria-hidden="true" />
              <span className="mt-2 text-[35px] font-extrabold leading-none tracking-[-.045em] sm:text-[43px]">{groceryItems.length}</span>
              <span className="mt-2 text-[13px] font-semibold">Grocery</span>
            </div>
          </div>
        </div>
      </header>

      {message && <p role="status" className="mt-5 rounded-[12px] border-l-4 border-[#BF6B48] bg-[#FFF0E3] px-4 py-3 text-[14px] font-medium text-[#23483A]">{message}</p>}

      {loading ? (
        <p role="status" className="py-12 text-[15px] font-medium text-[#53665B]">Loading saved items…</p>
      ) : (
        <div className={`mt-5 gap-5 sm:mt-7 ${bothEmpty ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex flex-col'}`}>
          <SavedSection kind="recipe" items={recipeItems} onRemove={onRemove} busyKey={busyKey} />
          <SavedSection kind="grocery" items={groceryItems} onRemove={onRemove} busyKey={busyKey} />
        </div>
      )}
    </main>
  )
}
