import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, Globe2, Leaf, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { apiClient } from '../../../api/apiClient'
import { countryFlag } from '../utils/country.utils'

const COLORS = { dark: '#173F35', clay: '#A95839', muted: '#52665A' }
function CollectionItem({ item, type }) {
  return (
    <Link to={item.path} className="group block min-w-0 overflow-hidden rounded-[12px] border border-[#D8DED4] bg-[#FAF9F5] transition-colors hover:border-[#B87556] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A95839]">
      <div className="relative aspect-[5/4] overflow-hidden bg-[#E6EBE3]">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" /> : <div className="flex h-full items-center justify-center text-[#668575]">{type === 'recipe' ? <UtensilsCrossed size={28} strokeWidth={1.4} /> : <ShoppingBag size={28} strokeWidth={1.4} />}</div>}
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[#FAF9F5] text-[#173F35]" aria-hidden="true"><ArrowUpRight size={16} /></span>
      </div>
      <div className="min-w-0 px-3 py-3.5 sm:px-4">
        <p className="text-[13px] font-medium text-[#A25839]">{item.sourceLabel?.includes('Host') ? 'From an EPANTRY Host' : 'EPANTRY collection'}</p>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug text-[#173F35]">{item.title}</h3>
        {item.caption ? <p className="mt-1 text-[14px] text-[#607164]">{item.caption}</p> : null}
      </div>
    </Link>
  )
}
function CountryCollection({ number, title, hint, items, type }) {
  return (
    <section aria-label={title} className={`border-t border-[#D7DED6] px-5 py-8 sm:px-9 sm:py-10 ${type === 'grocery' ? 'bg-[#F7EEDF]' : 'bg-[#E8F1EB]'}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#C8D9CF] pb-5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[.12em] text-[#A95839]">{number} / {type === 'recipe' ? 'Recipes' : 'Grocery'}</p>
          <h2 className="mt-1.5 text-[25px] font-semibold tracking-[-.03em] text-[#173F35] sm:text-[30px]">{title}</h2>
          <p className="mt-1 text-[15px] leading-6 text-[#52665A]">{hint}</p>
        </div>
        <span className="border-l-[3px] border-[#C86C42] pl-3 text-[15px] font-semibold text-[#173F35]">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {items.map(item => <CollectionItem key={`${type}-${item.path}`} item={item} type={type} />)}
        </div>
      ) : (
        <div className="flex items-center gap-3 border-l-[3px] border-[#C86C42] bg-white/65 px-5 py-4 text-[15px] text-[#52665A]"><Leaf size={18} aria-hidden="true" /> No published {type === 'recipe' ? 'recipes' : 'grocery products'} from this country on EPANTRY yet.</div>
      )}
    </section>
  )
}
export default function CountryExplorePage() {
  const { countryName } = useParams()
  const name = String(countryName || '').trim()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const flag = useMemo(() => countryFlag(name), [name])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setData(null)
    apiClient.get(`/public/country-discovery/${encodeURIComponent(name)}`)
      .then(response => { if (active) setData(response?.data?.data || response?.data || null) })
      .catch(cause => { if (active) setError(cause?.response?.data?.message || 'Food information is unavailable. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [name])
  const title = data?.country?.name || name
  const food = data?.history
  const dishes = food?.dishes || []
  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#202421]">
      <div className="page-shell py-5 sm:py-7">
        <Link to="/recipes" className="inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-[#173F35] hover:underline"><ArrowLeft size={17}/> Back to recipes</Link>
        {loading ? <div role="status" aria-live="polite" className="space-y-3 py-8"><div className="h-12 w-64 animate-pulse rounded bg-[#DFE7DA]"/><div className="h-40 animate-pulse rounded bg-[#DFE7DA]"/></div> : error ? (
          <div role="alert" className="my-7 border-l-4 border-[#A95839] bg-[#FFF0E6] p-5 text-[15px]">{error}</div>
        ) : data ? (
          <div className="mt-4 overflow-hidden rounded-[14px] border border-[#D9E1D7]">
            <header className="grid gap-5 bg-[#E8F0E9] px-5 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.13em] text-[#A95839]"><Globe2 size={15}/> EPANTRY · Food around the world</p>
                <div className="mt-3 flex items-center gap-3">
                  {flag ? <span className="text-[46px] leading-none sm:text-[56px]" role="img" aria-label={`${title} flag`}>{flag}</span> : <Globe2 className="text-[#173F35]" size={43}/>} 
                  <h1 className="text-[38px] font-semibold leading-[1.07] tracking-[-.04em] text-[#173F35] sm:text-[50px]">{title}</h1>
                </div>
                <p className="mt-3 max-w-[66ch] text-[16px] leading-7 text-[#496253]">Explore this country's food culture and discover recipes and grocery products published on EPANTRY.</p>
              </div>
              <div className="flex items-center gap-7 border-t border-[#C9D8CE] pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                <div><p className="text-[26px] font-semibold text-[#173F35]">{data.recipes?.length || 0}</p><p className="text-[14px] text-[#52665A]">Recipes</p></div>
                <div><p className="text-[26px] font-semibold text-[#173F35]">{data.grocery?.length || 0}</p><p className="text-[14px] text-[#52665A]">Grocery</p></div>
              </div>
            </header>
            <section aria-label={`${title} food culture`} className="grid gap-6 bg-[#FAF9F5] px-5 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-10">
              <div className="border-l-[3px] border-[#C86C42] pl-4 sm:pl-5">
                <p className="text-[13px] font-bold uppercase tracking-[.12em] text-[#A95839]">01 / Food culture</p>
                <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.035em] text-[#173F35] sm:text-[32px]">The food story of {title}</h2>
                <p className="mt-3 text-[15px] leading-7 text-[#52665A]">Food traditions change across regions and generations. Explore their ingredients, flavours and culinary influences.</p>
              </div>
              <div className="min-w-0">
                {food?.summary ? <p className="text-[16px] leading-[1.8] text-[#34483D]">{food.summary}</p> : (
                  <p className="text-[16px] leading-7 text-[#34483D]">Discover the recipes and grocery ingredients associated with {title} in EPANTRY's published collection. A sourced culinary overview is not available for this country right now.</p>
                )}
                {dishes.length ? <div className="mt-5 border-t border-[#D6DDD4] pt-4"><p className="text-[13px] font-semibold uppercase tracking-[.1em] text-[#A95839]">Well-known foods</p><div className="mt-2 flex flex-wrap gap-2">{dishes.map(dish => <span key={dish} className="rounded-full border border-[#D2DFD2] bg-[#EAF2EA] px-3 py-1.5 text-[14px] font-semibold text-[#173F35]">{dish}</span>)}</div></div> : null}
                {food?.url ? <a href={food.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#173F35] underline decoration-[#C86C42] underline-offset-4"><BookOpen size={15}/>{food.source || 'Read food history source'}<ArrowUpRight size={15}/></a> : null}
              </div>
            </section>
            <CountryCollection number="02" title={`Recipes from ${title}`} hint="Explore published EPANTRY recipes, including approved Host creations." items={data.recipes || []} type="recipe" />
            <CountryCollection number="03" title={`Grocery from ${title}`} hint="Browse published products associated with this country." items={data.grocery || []} type="grocery" />
          </div>
        ) : null}
      </div>
    </main>
  )
}
