import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Globe2, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { apiClient } from '../../../api/apiClient'
import { countryFlag } from '../utils/country.utils'

// A live API response from an older backend may still contain the obsolete
// NCHM PDF link. Never render that URL on the customer page.
const safeReference = (input) => {
  try {
    const url = new URL(String(input || ''))
    if (url.protocol !== 'https:') return ''
    if (/(^|\.)nchm\.nic\.in$/i.test(url.hostname) && /Indian_Food_Heritage\.pdf/i.test(url.pathname)) return ''
    return url.href
  } catch {
    return ''
  }
}

// Source-grounded editorial summary: Press Information Bureau, 5 Nov 2017,
// and the Ministry of Culture, 27 Mar 2017. Both are official HTML pages.
// This also protects the UI while a cached/older API is still being served.
const INDIA_FOOD = {
  summary: 'Indian cooking changes from region to region, shaped by local crops, climate and generations of family traditions. Lentils, grains, vegetables and spices take different forms across the country. Official accounts describe the many regional versions of biryani and khichri, along with sarson da saag in Punjab, dhokla in Gujarat and dosa in southern India. Trade and cultural exchange have also influenced dishes and cooking techniques over time.',
  dishes: [
    { name: 'Sarson da saag', region: 'Punjab' },
    { name: 'Dhokla', region: 'Gujarat' },
    { name: 'Dosa', region: 'Tamil Nadu and southern India' },
    { name: 'Biryani', region: 'Regional preparations across India' },
  ],
  sources: [
    { label: 'Indian food traditions | Press Information Bureau', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1508300&lang=2&reg=48' },
    { label: 'Regional cuisines | Ministry of Culture', url: 'https://www.pib.gov.in/newsite/PrintRelease.aspx?lang=2&reg=48&relid=159991' },
  ],
}

const countryKey = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function PublicationTile({ item, type }) {
  return (
    <Link
      to={item.path}
      className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B45B37]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] bg-[#E4E9E2]">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title || ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#6C857A]" aria-hidden="true">
            {type === 'recipe' ? <UtensilsCrossed size={30} strokeWidth={1.35} /> : <ShoppingBag size={30} strokeWidth={1.35} />}
          </div>
        )}
        <span aria-hidden="true" className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[#F8F7F3] text-[#173F35] shadow-sm">
          <ArrowUpRight size={17} />
        </span>
      </div>
      <div className="pt-3">
        {item.caption ? <p className="text-[13px] font-medium leading-5 text-[#9A5135]">{item.caption}</p> : null}
        <h3 className="mt-0.5 text-[16px] font-semibold leading-[1.4] text-[#173F35] group-hover:underline group-hover:decoration-[#B45B37] group-hover:underline-offset-4">{item.title}</h3>
      </div>
    </Link>
  )
}

function CollectionSection({ index, type, country, items }) {
  const isRecipe = type === 'recipe'
  const title = isRecipe ? `Recipes from ${country}` : `Grocery from ${country}`
  const hint = isRecipe
    ? 'Published EPANTRY recipes and approved Host recipes associated with this country.'
    : 'Published grocery items and approved Host products with this country of origin.'

  return (
    <section
      id={`country-${type}`}
      aria-labelledby={`country-${type}-title`}
      className={`scroll-mt-24 border-t border-[#D8DED7] px-5 py-9 sm:px-8 sm:py-10 lg:px-11 ${isRecipe ? 'bg-[#E8F0EB]' : 'bg-[#F9EADD]'}`}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#D3DCD3] pb-5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#AD5537]">{index} / {isRecipe ? 'Recipe collection' : 'Grocery collection'}</p>
          <h2 id={`country-${type}-title`} className="mt-1 text-[25px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[28px]">{title}</h2>
          <p className="mt-2 max-w-[67ch] text-[15px] leading-6 text-[#4E6256]">{hint}</p>
        </div>
        <p className="shrink-0 text-[14px] font-semibold text-[#173F35]">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
      </div>

      {items.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item, i) => <PublicationTile key={`${type}-${item.path}-${i}`} item={item} type={type} />)}
        </div>
      ) : (
        <p className="border-l-[3px] border-[#B96646] bg-[#FAF8F4] px-4 py-4 text-[15px] text-[#536459]">No published {isRecipe ? 'recipes' : 'grocery products'} from this country in EPANTRY yet.</p>
      )}
    </section>
  )
}

export default function CountryExplorePage() {
  const { countryName } = useParams()
  const name = String(countryName || '').trim()
  const flag = useMemo(() => countryFlag(name), [name])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    setData(null)
    apiClient.get(`/public/country-discovery/${encodeURIComponent(name)}`)
      .then((response) => { if (current) setData(response?.data?.data || response?.data || null) })
      .catch((cause) => { if (current) setError(cause?.response?.data?.message || 'Country information is temporarily unavailable. Try again shortly.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [name])

  const title = data?.country?.name || name
  const isIndia = countryKey(title) === 'india'
  const story = isIndia ? INDIA_FOOD : data?.history
  const foods = Array.isArray(story?.dishes)
    ? story.dishes.map((dish) => typeof dish === 'string' ? { name: dish } : dish).filter((dish) => dish?.name)
    : []
  const candidateReferences = Array.isArray(story?.sources) && story.sources.length
    ? story.sources
    : story?.url ? [{ label: story?.source || 'Culinary background', url: story.url }] : []
  const references = candidateReferences
    .map((entry) => ({ label: entry?.label || 'Read source', url: safeReference(entry?.url) }))
    .filter((entry) => entry.url)
  const recipes = Array.isArray(data?.recipes) ? data.recipes : []
  const grocery = Array.isArray(data?.grocery) ? data.grocery : []

  return (
    <main className="min-h-screen bg-[#F6F4EF] text-[#173F35]">
      <div className="page-shell pb-8 pt-5 sm:pt-7">
        <Link to="/recipes" className="mb-5 inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-[#173F35] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B45B37]">
          <ArrowLeft size={17} /> Back to recipes
        </Link>

        {loading ? (
          <div role="status" aria-live="polite" className="space-y-4 py-6">
            <div className="h-20 w-full animate-pulse rounded bg-[#E5EBE3]" />
            <div className="h-56 w-full animate-pulse rounded bg-[#E5EBE3]" />
          </div>
        ) : error ? (
          <p role="alert" className="border-l-4 border-[#B45B37] bg-[#FFF0E6] p-5 text-[15px]">{error}</p>
        ) : data ? (
          <div className="overflow-hidden rounded-[9px] border border-[#DCE2D9]">
            {/* Country-first editorial masthead: no randomly selected recipe/product hero. */}
            <header className="bg-[#E8EEE8] px-5 pb-7 pt-8 sm:px-8 sm:pb-9 sm:pt-9 lg:px-11">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-[#A75235]"><Globe2 size={16} /> EPANTRY / Food cultures</p>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0 max-w-3xl">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {flag ? <span role="img" aria-label={`${title} flag`} className="text-[37px] leading-none sm:text-[43px]">{flag}</span> : null}
                    <h1 className="text-[38px] font-bold leading-[1.1] tracking-[-0.04em] text-[#173F35] sm:text-[46px]">{title}</h1>
                  </div>
                  <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.6] text-[#425B4D]">A closer look at the cooking traditions of {title}, and the food you can explore in EPANTRY.</p>
                </div>
                <nav aria-label="Jump to country collections" className="flex flex-wrap items-center gap-0 border-y border-[#B9CCBE]">
                  <a href="#country-recipe" className="group flex min-h-16 items-center gap-3 border-r border-[#B9CCBE] py-2 pr-5 sm:pr-6">
                    <span className="text-[26px] font-semibold tabular-nums text-[#173F35]">{recipes.length}</span>
                    <span className="flex items-center gap-1 text-[14px] font-medium text-[#4D6755] group-hover:text-[#A75235]">Recipes <ArrowRight size={15} /></span>
                  </a>
                  <a href="#country-grocery" className="group flex min-h-16 items-center gap-3 py-2 pl-5 sm:pl-6">
                    <span className="text-[26px] font-semibold tabular-nums text-[#173F35]">{grocery.length}</span>
                    <span className="flex items-center gap-1 text-[14px] font-medium text-[#4D6755] group-hover:text-[#A75235]">Grocery <ArrowRight size={15} /></span>
                  </a>
                </nav>
              </div>
            </header>

            <section aria-labelledby="country-food-title" className="px-5 py-9 sm:px-8 sm:py-10 lg:px-11">
              <div className="grid gap-6 lg:grid-cols-[minmax(230px,.42fr)_minmax(0,1fr)] lg:gap-10">
                <div className="border-l-[3px] border-[#B86141] pl-4 sm:pl-5">
                  <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#A75235]">01 / Food culture</p>
                  <h2 id="country-food-title" className="mt-2 text-[25px] font-bold leading-[1.18] tracking-[-0.03em] text-[#173F35] sm:text-[29px]">Flavours and traditions</h2>
                  <p className="mt-3 text-[14px] leading-6 text-[#5B6E60]">Food traditions and regional cooking, documented in culinary sources.</p>
                </div>
                <div className="min-w-0">
                  <p className="max-w-[74ch] text-[16px] leading-[1.75] text-[#374C40]">{story?.summary || `A sourced culinary overview for ${title} is not available yet. Explore the published EPANTRY collections below.`}</p>
                </div>
              </div>

              {foods.length ? (
                <div className="mt-8 border-y border-[#D9DED6] py-5 sm:mt-9">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[18px] font-semibold text-[#173F35]">Regional dishes mentioned in the sources</h3>
                    <p className="text-[13px] text-[#667568]">Documented examples, not a popularity ranking</p>
                  </div>
                  <div className="mt-4 grid gap-x-6 gap-y-0 sm:grid-cols-2 lg:grid-cols-4">
                    {foods.map((dish, index) => (
                      <div key={`${dish.name}-${index}`} className="flex gap-3 border-t border-[#DEE2DA] py-3.5">
                        <span className="text-[13px] font-semibold tabular-nums text-[#AE6040]">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <p className="text-[16px] font-semibold leading-6 text-[#173F35]">{dish.name}</p>
                          {dish.region ? <p className="mt-0.5 text-[14px] leading-5 text-[#617465]">{dish.region}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {references.length ? (
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-l-[3px] border-[#C7D8CF] pl-4">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-[#173F35]"><BookOpen size={16} /> Read the sources</span>
                  {references.map((source, index) => (
                    <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-medium leading-5 text-[#225445] underline decoration-[#B86141] underline-offset-4 hover:text-[#A75235]">
                      {source.label} <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              ) : null}
            </section>

            <CollectionSection index="02" type="recipe" country={title} items={recipes} />
            <CollectionSection index="03" type="grocery" country={title} items={grocery} />
          </div>
        ) : null}
      </div>
    </main>
  )
}
