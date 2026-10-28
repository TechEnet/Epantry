import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, Globe2, Leaf, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { apiClient } from '../../../api/apiClient'
import { countryFlag } from '../utils/country.utils'

function CountryItem({ item, type }) {
  return (
    <Link to={item.path} className="group min-w-0 overflow-hidden rounded-[14px] border border-[#D7DED2] bg-[#F9F8F4] transition-colors duration-200 hover:border-[#BC8064] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C86C42]">
      <div className="relative aspect-[5/4] overflow-hidden bg-[#E2E7DC]">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" /> : <div className="flex h-full items-center justify-center text-[#668575]">{type === 'recipe' ? <UtensilsCrossed size={30} strokeWidth={1.3} /> : <ShoppingBag size={30} strokeWidth={1.3} />}</div>}
        <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#F9F8F4] text-[#173F35]" aria-hidden="true"><ArrowUpRight size={17} /></span>
      </div>
      <div className="px-3 py-3.5 sm:px-4">
        <p className="text-[13px] font-medium text-[#A15938]">{item.sourceLabel}</p>
        <h3 className="mt-1 text-[16px] font-bold leading-snug text-[#173F35]">{item.title}</h3>
        {item.caption ? <p className="mt-1 text-[13px] leading-5 text-[#5B695D]">{item.caption}</p> : null}
      </div>
    </Link>
  )
}

function CountryCollection({ number, heading, intro, items, type }) {
  return (
    <section className={`border-t border-[#D4DDD1] px-4 py-8 sm:px-8 sm:py-10 ${type === 'grocery' ? 'bg-[#F1EDE6]' : 'bg-[#E9F0E8]'}`} aria-label={heading}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#D4DDD1] pb-5">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[.11em] text-[#AE603F]">{number} / EPANTRY collection</p>
          <h2 className="mt-2 text-[25px] font-semibold tracking-[-.035em] text-[#173F35] sm:text-[30px]">{heading}</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-6 text-[#526358]">{intro}</p>
        </div>
        <span className="text-[14px] font-semibold text-[#173F35]">{items.length} {items.length === 1 ? 'listing' : 'listings'}</span>
      </div>
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {items.map(item => <CountryItem key={`${type}-${item.path}`} item={item} type={type} />)}
        </div>
      ) : (
        <p className="flex items-center gap-3 py-5 text-[15px] text-[#526358]"><Leaf size={19} aria-hidden="true" /> No published EPANTRY {type === 'recipe' ? 'recipes' : 'grocery items'} associated with this country yet.</p>
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
      .catch(cause => { if (active) setError(cause?.response?.data?.message || 'Country information is unavailable. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [name])

  const title = data?.country?.name || name
  const history = data?.history
  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#202421]">
      <div className="page-shell py-5 sm:py-7">
        <Link to="/recipes" className="inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-[#173F35] hover:underline"><ArrowLeft size={17} /> Back to recipes</Link>
        {loading ? <div className="space-y-4 py-8" role="status" aria-live="polite"><div className="h-14 w-64 animate-pulse rounded bg-[#DFE7DA]" /><div className="h-44 animate-pulse rounded bg-[#DFE7DA]" /></div> : error ? (
          <div role="alert" className="my-8 border-l-4 border-[#A95F3C] bg-[#F7EAE2] p-5 text-[15px]">{error}</div>
        ) : data ? (
          <div className="mt-5 overflow-hidden rounded-[16px] border border-[#DCE2D6]">
            <header className="bg-[#E8EFE7] px-5 py-8 sm:px-9 sm:py-11">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.12em] text-[#AE603F]"><Globe2 size={16} /> EPANTRY · Food around the world</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {flag ? <span role="img" aria-label={`${title} flag`} className="text-[52px] leading-none sm:text-[64px]">{flag}</span> : <Globe2 className="text-[#173F35]" size={46} />}
                <h1 className="text-[36px] font-semibold leading-tight tracking-[-.045em] text-[#173F35] sm:text-[54px]">{title}</h1>
              </div>
              <p className="mt-3 max-w-[72ch] text-[16px] leading-7 text-[#526358]">Discover the country’s history and explore published EPANTRY recipes and grocery products connected to it.</p>
            </header>
            <section className="bg-[#F9F7F2] px-5 py-8 sm:px-9 sm:py-10" aria-label={`${title} history`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#D4DDD1] pb-4">
                <div>
                  <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.11em] text-[#AE603F]"><BookOpen size={15} /> 01 / Country story</p>
                  <h2 className="mt-2 text-[26px] font-semibold tracking-[-.035em] text-[#173F35] sm:text-[30px]">A brief history of {title}</h2>
                </div>
                {history?.url ? <a href={history.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#173F35] underline decoration-[#C86C42] underline-offset-4">Wikipedia source <ArrowUpRight size={15} /></a> : null}
              </div>
              {history?.summary ? <p className="max-w-[91ch] whitespace-pre-line text-[16px] leading-[1.8] text-[#344C40]">{history.summary}</p> : (
                <p className="text-[15px] leading-7 text-[#53665B]">A sourced history summary is not available right now. We don’t substitute invented historical claims.</p>
              )}
              <p className="mt-5 text-[13px] leading-5 text-[#607266]">Historical information is from Wikipedia, not an EPANTRY historical certification. Food associations below use EPANTRY’s own published records.</p>
            </section>
            <CountryCollection number="02" heading={`Recipes associated with ${title}`} intro="Published recipes only. EPANTRY catalog cuisines are grouped by their declared cuisine; Host recipes use the submitted country." items={data.recipes || []} type="recipe" />
            <CountryCollection number="03" heading={`Grocery from ${title}`} intro="Publicly published catalog products with this declared country of origin, plus approved Host grocery submissions." items={data.grocery || []} type="grocery" />
          </div>
        ) : null}
      </div>
    </main>
  )
}
