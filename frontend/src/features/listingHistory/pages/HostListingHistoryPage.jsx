import {
  ArrowUpRight,
  ChefHat,
  CircleAlert,
  History,
  LoaderCircle,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteHostOffer,
  listHostOffers,
} from '../../marketplace/services/marketplace.service'
import {
  deleteHostRecipeListing,
  getHostOperationsErrorMessage,
  listHostRecipeListingHistory,
} from '../../hostOperations/services/hostOperations.service'
import { getHostListingPacket, listHostListingPackets } from '../../host/services/hostUnifiedListing.service'

// EPANTRY Listing History — full-width display and safe product identity enrichment.
// Exact approved Host listing ID joins marketplace offers to their saved titles/photos.
// Existing marketplace/recipe CRUD routes and permissions are preserved.
const theme = String.raw`
  .elh-page { --clay:#C56C42;--forest:#173F35;--charcoal:#202421;--porcelain:#F7F6F2;--sage:#D7DDCF;
    --line:#DDDCD3;--muted:#68716B; min-width:0; width:100%; box-sizing:border-box; min-height:calc(100svh - 72px);
    padding:clamp(15px,2vw,28px) clamp(12px,1.9vw,28px) 48px;
    background:var(--porcelain);color:var(--charcoal);font-family:inherit;font-size:15px;line-height:1.5 }
  .elh-page *{box-sizing:border-box}
  .elh-page button,.elh-page input,.elh-page select{font:inherit}
  .elh-page button{cursor:pointer}
  .elh-page button:disabled{cursor:not-allowed;opacity:.55}
  .elh-page button:focus-visible,.elh-page input:focus-visible,.elh-page select:focus-visible{
    outline:3px solid var(--clay);outline-offset:3px }
  .elh-shell{width:100%;max-width:none;margin:0;min-width:0}
  .elh-back{display:inline-flex;align-items:center;gap:8px;background:none;border:0;color:var(--forest);
    font-size:14px;font-weight:730;padding:4px 0;margin-bottom:17px}
  .elh-back:hover{color:var(--clay)}
  .elh-hero{background:var(--clay);color:white;display:grid;grid-template-columns:minmax(0,1fr) auto;
    gap:28px;align-items:end;border-radius:15px;padding:clamp(22px,3vw,42px) clamp(21px,3vw,44px)}
  .elh-kicker{display:inline-flex;align-items:center;gap:9px;font-size:11px;font-weight:800;
    letter-spacing:.14em;text-transform:uppercase;opacity:.94;margin:0 0 13px}
  .elh-hero h1{font-size:clamp(30px,3.3vw,50px);font-weight:820;line-height:1.06;letter-spacing:-.055em;
    margin:0 0 10px;color:white}
  .elh-hero p{font-size:15px;color:#FFF7F1;max-width:620px;line-height:1.6;margin:0}
  .elh-hero-side{display:flex;align-items:center;gap:26px;border-left:1px solid #FFFFFF65;padding-left:28px}
  .elh-stat{display:flex;flex-direction:column;gap:3px;min-width:82px}
  .elh-stat strong{font-size:clamp(26px,3vw,40px);line-height:1;letter-spacing:-.05em;font-weight:820}
  .elh-stat span{font-size:12px;font-weight:680;color:#FFF2EA}
  .elh-refresh{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;
    background:#FFF9F4;border:1px solid #FFF9F4;color:var(--forest);font-size:13px;font-weight:790;
    min-height:42px;padding:10px 16px;border-radius:8px}
  .elh-refresh:hover{background:#F7E9DD;border-color:#F7E9DD}
  .elh-toolbar{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;
    padding:25px 0 19px;border-bottom:1px solid var(--line)}
  .elh-switch{display:inline-flex;align-items:center;gap:5px;padding:5px;background:#E8E9E0;border-radius:10px}
  .elh-switch button{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:var(--forest);
    border-radius:7px;min-height:42px;padding:9px 15px;font-size:14px;font-weight:760;white-space:nowrap}
  .elh-switch button[aria-selected='true']{background:var(--forest);color:white;box-shadow:0 3px 10px #173F3526}
  .elh-switch button:hover:not([aria-selected='true']){background:#D9DFD5}
  .elh-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;
    border-radius:6px;padding:0 5px;background:#FFFFFF25;font-size:11px;font-weight:770}
  .elh-switch button:not([aria-selected='true']) .elh-count{background:#FFFFFFB5;color:var(--forest)}
  .elh-actions{display:flex;align-items:center;gap:11px;flex:1 1 400px;justify-content:flex-end;min-width:0}
  .elh-search{position:relative;min-width:min(100%,240px);max-width:420px;width:100%}
  .elh-search svg{position:absolute;top:50%;left:13px;transform:translateY(-50%);color:#647168;pointer-events:none}
  .elh-search input{width:100%;min-height:45px;background:#FFFDF9;color:var(--charcoal);
    border:1px solid #CBD2C9;border-radius:8px;padding:10px 34px 10px 40px;font-size:14px}
  .elh-search input::placeholder{color:#7B847D}
  .elh-clear{position:absolute;right:7px;top:50%;transform:translateY(-50%);background:transparent;
    border:0;color:var(--muted);width:29px;height:29px;display:grid;place-items:center}
  .elh-status-select{min-height:45px;max-width:190px;width:160px;padding:9px 29px 9px 12px;
    background:#FFFDF9;border:1px solid #CBD2C9;border-radius:8px;color:var(--forest);font-size:14px;font-weight:680}
  .elh-subnote{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;
    margin:14px 0 20px;color:#59665E;font-size:13px}
  .elh-subnote strong{color:var(--forest)}
  .elh-message{display:flex;align-items:flex-start;gap:10px;margin:16px 0;padding:14px 16px;
    border-left:4px solid var(--clay);background:#F9EBE4;color:#743F2A;font-size:14px}
  .elh-message--success{border-left-color:var(--forest);background:#E7EEE7;color:var(--forest)}
  .elh-loading{display:flex;align-items:center;gap:12px;justify-content:center;min-height:260px;
    color:var(--forest);font-size:15px}
  .elh-group{margin-top:20px;border-top:2px solid var(--forest);padding-top:21px}
  .elh-group + .elh-group{margin-top:33px}
  .elh-group-header{display:flex;justify-content:space-between;align-items:center;gap:16px;
    margin:0 0 18px;flex-wrap:wrap}
  .elh-group-title{display:flex;align-items:center;gap:13px}
  .elh-group-icon{width:42px;height:42px;border-radius:10px;background:var(--sage);
    color:var(--forest);display:grid;place-items:center;flex:none}
  .elh-group h2{font-size:clamp(22px,2.2vw,29px);line-height:1.14;letter-spacing:-.035em;
    font-weight:810;color:var(--forest);margin:0 0 4px}
  .elh-group-desc{font-size:13px;color:#647168;margin:0}
  .elh-group-count{font-size:13px;font-weight:760;color:var(--forest);background:#E8ECE5;
    padding:8px 11px;border-radius:6px}
  .elh-table{background:transparent;border-top:1px solid var(--line)}
  .elh-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(112px,145px) auto;align-items:center;
    column-gap:18px;row-gap:9px;padding:14px 5px;border-bottom:1px solid var(--line);min-width:0}
  .elh-row:hover{background:#F0F1EA}
  .elh-identity{min-width:0;display:flex;align-items:center;gap:13px}
  .elh-row-icon{height:66px;width:68px;flex:none;border-radius:9px;background:#E8ECE5;
    border:1px solid #D7DCD2;color:var(--forest);display:grid;place-items:center;overflow:hidden}
  .elh-row-icon img{display:block;width:100%;height:100%;object-fit:cover;background:#F7F6F2}
  .elh-row-icon svg{opacity:.72}
  .elh-row-title{font-size:16px;line-height:1.4;font-weight:780;color:var(--charcoal);margin:0;
    overflow-wrap:anywhere}
  .elh-row-meta{font-size:12px;line-height:1.55;color:#68746C;margin:4px 0 0;overflow-wrap:anywhere}
  .elh-row-date{font-size:12px;line-height:1.4;color:#596960;margin:0}
  .elh-row-date span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;
    font-weight:780;color:#758177;margin-bottom:4px}
  .elh-row-right{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
  .elh-status{display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;
    font-size:11px;letter-spacing:.02em;font-weight:790;border-radius:5px;padding:6px 9px;
    background:#E5E7E1;color:#4E5B53}
  .elh-status:before{content:'';height:6px;width:6px;border-radius:50%;background:currentColor}
  .elh-status[data-kind='live']{color:var(--forest);background:#DBE8DC}
  .elh-status[data-kind='review']{color:#A95432;background:#FAE5DA}
  .elh-status[data-kind='draft']{color:#4F6255;background:#E5EBDD}
  .elh-control{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:35px;
    font-size:12px;font-weight:790;white-space:nowrap;padding:7px 10px;border-radius:7px}
  .elh-control--edit{border:1px solid #C1D0C5;background:#FFFDF9;color:var(--forest)}
  .elh-control--edit:hover{background:#E4EDE2;border-color:var(--forest)}
  .elh-control--delete{border:1px solid #E5C6B8;background:#FFF8F4;color:#99482F}
  .elh-control--delete:hover{background:#F8E4D9;border-color:var(--clay)}
  .elh-history-only{font-size:12px;color:#788078;font-weight:720}
  .elh-empty{border-bottom:1px solid var(--line);padding:22px 10px 25px;color:#66726A;font-size:14px}
  .elh-view-all{display:inline-flex;align-items:center;gap:8px;border:0;border-bottom:1px solid var(--clay);
    background:transparent;border-radius:0;color:var(--clay);font-size:14px;font-weight:810;
    margin-top:14px;padding:4px 2px 6px}
  .elh-view-all:hover{color:var(--forest);border-bottom-color:var(--forest)}
  .elh-bottom-note{font-size:12px;color:#768176;margin:30px 0 0}
  .elh-overlay{position:fixed;inset:0;z-index:170;display:flex;align-items:center;justify-content:center;
    padding:15px;background:#101A16A8;backdrop-filter:blur(8px)}
  .elh-dialog{width:min(100%,1050px);max-height:min(90svh,920px);display:flex;flex-direction:column;overflow:hidden;
    background:var(--porcelain);border-radius:15px;box-shadow:0 20px 65px #0F1B1659}
  .elh-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;
    padding:21px 24px;border-bottom:1px solid var(--line);border-top:5px solid var(--clay)}
  .elh-dialog-head h2{font-size:26px;font-weight:820;line-height:1.15;letter-spacing:-.04em;margin:2px 0;color:var(--forest)}
  .elh-dialog-head p{font-size:13px;color:var(--muted);margin:0}
  .elh-close{flex:none;width:38px;height:38px;border:1px solid #CCD5CC;border-radius:8px;
    background:white;display:grid;place-items:center;color:var(--forest)}
  .elh-close:hover{background:#E5EBE1}
  .elh-dialog-body{padding:8px 24px 24px;overflow-y:auto;min-height:0;overscroll-behavior:contain}
  @media(max-width:1100px){.elh-hero-side{gap:17px;padding-left:18px}.elh-actions{flex-basis:320px}}
  @media(max-width:780px){
    .elh-hero{grid-template-columns:1fr;gap:18px}
    .elh-hero-side{border-left:0;border-top:1px solid #FFFFFF6A;padding:16px 0 0;flex-wrap:wrap}
    .elh-toolbar{align-items:stretch}
    .elh-switch{width:100%;justify-content:space-between}
    .elh-switch button{flex:1;justify-content:center;padding:9px 8px}
    .elh-actions{flex:1 1 100%;justify-content:stretch}
    .elh-search{max-width:none;flex:1}
    .elh-row{grid-template-columns:minmax(0,1fr) auto;column-gap:10px}
    .elh-row-date{grid-column:1}
    .elh-row-right{grid-column:2;grid-row:1/span 2;max-width:200px}
  }
  @media(max-width:530px){
    .elh-page{padding:14px 12px 38px}
    .elh-hero{padding:21px 18px;border-radius:11px}
    .elh-hero-side{gap:18px}
    .elh-stat strong{font-size:27px}
    .elh-refresh{margin-left:auto}
    .elh-toolbar{padding:17px 0 15px}
    .elh-actions{flex-wrap:wrap}
    .elh-status-select{width:100%;max-width:none}
    .elh-search{flex-basis:100%}
    .elh-switch button{font-size:12px;gap:5px}
    .elh-group-header{align-items:flex-start}
    .elh-row{grid-template-columns:1fr;gap:10px;padding:14px 2px}
    .elh-row-right{grid-row:auto;grid-column:1;justify-content:flex-start;gap:8px;max-width:none}
    .elh-row-date{grid-column:1;padding-left:82px}
    .elh-row-icon{width:62px;height:62px}
    .elh-dialog-head{padding:17px}
    .elh-dialog-body{padding:6px 14px 18px}
  }
  @media(prefers-reduced-motion:reduce){.elh-page *{scroll-behavior:auto!important;transition:none!important}}
`

function titleize(value) {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function statusKind(status) {
  const s = String(status || '').toLowerCase()
  if (['active', 'published', 'approved'].includes(s)) return 'live'
  if (['pending', 'in_review', 'submitted', 'needs_changes'].includes(s)) return 'review'
  if (['draft'].includes(s)) return 'draft'
  return 'neutral'
}

function Status({ status }) {
  return <span className="elh-status" data-kind={statusKind(status)}>{titleize(status)}</span>
}

// The unified Host listing API stores the real Host-entered title and image.
// Auto-published marketplace offers use merchantSku = `epantry-${listingId}`.
// Join on that exact ID, never on similar-looking product names.
function asImageUrl(value) {
  const raw = typeof value === 'string' ? value
    : value && typeof value === 'object' ? (value.secure_url || value.secureUrl || value.url || value.src) : ''
  const url = String(raw || '').trim()
  return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : ''
}

function firstImage(...values) {
  for (const value of values) {
    const list = Array.isArray(value) ? value : [value]
    for (const item of list) {
      const url = asImageUrl(item)
      if (url) return url
    }
  }
  return ''
}

// An EPANTRY-created marketplace offer keeps the original approved Host
// packet ID in its generated merchant SKU. Never match records by similar names.
function hostPacketIdForOffer(offer) {
  const sku = String(offer?.merchantSku || '').trim()
  return /^epantry-([a-f0-9]{24})$/i.exec(sku)?.[1]?.toLowerCase() || ''
}
function listingForOffer(offer, byId) {
  const packetId = hostPacketIdForOffer(offer)
  return packetId ? byId.get(packetId) || null : null
}

// If the list endpoint omits an older record, try the existing Host-owned
// single-listing endpoint using the EXACT ID from merchantSku. Five concurrent
// lookups at a time avoids flooding the backend for large Host histories.
async function fetchMissingOwnedPackets(offers, packetRows) {
  const ownedIds = new Set(packetRows.map((row) => String(row?.id || row?._id || '').toLowerCase()))
  const ids = [...new Set(offers.map(hostPacketIdForOffer).filter((id) => id && !ownedIds.has(id)))].slice(0, 100)
  const found = []
  let failed = 0
  for (let index = 0; index < ids.length; index += 5) {
    const group = await Promise.allSettled(ids.slice(index, index + 5).map((id) => getHostListingPacket(id)))
    for (const result of group) {
      const row = result.status === 'fulfilled' ? (result.value?.listing || result.value?.record || null) : null
      if (row?.id || row?._id) found.push(row)
      else failed += 1
    }
  }
  return { records: found, failed, attempted: ids.length }
}

function ListingPhoto({ image, recipe = false }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [image])
  return (
    <span className="elh-row-icon" aria-hidden="true">
      {image && !broken
        ? <img src={image} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
        : recipe ? <ChefHat size={23} /> : <Package size={23} />}
    </span>
  )
}

function offerTitle(offer) {
  const readable = [
    offer._matchedListing?.title,
    offer._matchedListing?.packet?.title,
    offer._matchedListing?.publishedPacket?.title,
    offer.productName,
    offer.productTitle,
    offer.displayName,
    offer.packName,
    offer.title,
    offer.product?.name,
    offer.pack?.name,
  ].find((value) => typeof value === 'string' && value.trim())
  if (readable) return readable
  const sku = String(offer.merchantSku || offer.offerKey || '').trim()
  return sku && !/^epantry[-_][0-9a-f-]{10,}$/i.test(sku) ? sku : 'Grocery listing'
}

function GroceryRow({ offer, busyId, onEdit, onDelete }) {
  const locked = offer.status === 'retired'
  const image = firstImage(offer._matchedListing?.packet?.images, offer._matchedListing?.publishedPacket?.images, offer.images,
    offer.product?.images, offer.pack?.images, offer.imageUrl)
  return (
    <article className="elh-row">
      <div className="elh-identity">
        <ListingPhoto image={image} />
        <div style={{ minWidth:0 }}>
          <p className="elh-row-title">{offerTitle(offer)}</p>
          <p className="elh-row-meta">
            {offer.merchantSku || offer.offerKey ? `SKU: ${offer.merchantSku || offer.offerKey}` : 'Grocery offer'}
            {' · '}Pack reference: {offer.packId || '—'}
          </p>
        </div>
      </div>
      <p className="elh-row-date"><span>Last updated</span>{formatDate(offer.updatedAt || offer.createdAt)}</p>
      <div className="elh-row-right">
        <Status status={offer.status} />
        {!locked ? (
          <>
            <button type="button" className="elh-control elh-control--edit" onClick={() => onEdit(offer)}>
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
            <button type="button" className="elh-control elh-control--delete"
              disabled={Boolean(busyId)} onClick={() => onDelete(offer)}>
              {busyId === `offer:${offer.id}` ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
          </>
        ) : <span className="elh-history-only">History only</span>}
      </div>
    </article>
  )
}

function RecipeRow({ recipe, busyId, onEdit, onDelete }) {
  const image = firstImage(recipe.packet?.images, recipe.images, recipe.imageUrl,
    recipe.photoUrl, recipe.coverImage)
  return (
    <article className="elh-row">
      <div className="elh-identity">
        <ListingPhoto image={image} recipe />
        <div style={{ minWidth:0 }}>
          <p className="elh-row-title">{recipe.title || 'Untitled recipe'}</p>
          <p className="elh-row-meta">Version {recipe.versionNumber || 1} · Reference: {recipe.id || '—'}</p>
        </div>
      </div>
      <p className="elh-row-date"><span>Submitted</span>{formatDate(recipe.submittedAt || recipe.createdAt)}</p>
      <div className="elh-row-right">
        <Status status={recipe.status} />
        {recipe.canEdit ? (
          <button type="button" className="elh-control elh-control--edit" onClick={() => onEdit(recipe)}>
            <Pencil size={13} aria-hidden="true" /> {recipe.source === 'unified' ? 'View / Edit' : 'Edit'}
          </button>
        ) : null}
        {recipe.canDelete ? (
          <button type="button" className="elh-control elh-control--delete"
            disabled={Boolean(busyId)} onClick={() => onDelete(recipe)}>
            {busyId === `recipe:${recipe.id}` ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        ) : null}
        {!recipe.canEdit && !recipe.canDelete ? <span className="elh-history-only">History only</span> : null}
      </div>
    </article>
  )
}

export default function HostListingHistoryPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [offers, setOffers] = useState([])
  const [recipes, setRecipes] = useState([])
  const [hostPackets, setHostPackets] = useState([])
  const [viewAllType, setViewAllType] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Keep each source independent. An unavailable legacy endpoint must not
      // hide approved Host packets or working Marketplace offers.
      const results = await Promise.allSettled([
        listHostOffers({ page:1, limit:100, status:'all' }),
        listHostRecipeListingHistory(),
        listHostListingPackets(),
      ])
      const [offersResult, recipesResult, packetsResult] = results
      const successful = results.filter((result) => result.status === 'fulfilled').length
      if (!successful) {
        throw offersResult.reason || new Error('Listing history is currently unavailable.')
      }
      const offerRows = offersResult.status === 'fulfilled'
        ? (offersResult.value?.offers || offersResult.value?.hostOffers || []) : []
      const packetRows = packetsResult.status === 'fulfilled'
        ? (packetsResult.value?.listings || []) : []
      const recovery = await fetchMissingOwnedPackets(offerRows, packetRows)
      // Merge without changing or deleting any marketplace offer records.
      const mergedPackets = new Map()
      for (const row of [...packetRows, ...recovery.records]) {
        const id = String(row?.id || row?._id || '').toLowerCase()
        if (id) mergedPackets.set(id, row)
      }
      setOffers(offerRows)
      setRecipes(recipesResult.status === 'fulfilled' ? (recipesResult.value?.recipes || []) : [])
      setHostPackets([...mergedPackets.values()])
      if (packetsResult.status === 'rejected') {
        setError('Approved Host listing details could not load. Grocery offers are shown, but names/photos and unified recipes may be missing. Please refresh or check the Host listing API.')
      } else if (recovery.failed && recovery.attempted) {
        setError(`${recovery.failed} older grocery ${recovery.failed === 1 ? 'listing' : 'listings'} could not be matched to saved Host data. Their SKU and pack references are still shown.`)
      } else if (successful !== results.length) {
        setError('Some listing details could not load. Available records are shown; refresh to retry.')
      }
    } catch (loadError) {
      setError(getHostOperationsErrorMessage(loadError, 'Unable to load your listing history.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    if (!viewAllType) return undefined
    const onEscape = (event) => { if (event.key === 'Escape') setViewAllType('') }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [viewAllType])

  const packetById = useMemo(() => new Map(hostPackets
    .filter((row) => row?.id || row?._id)
    .map((row) => [String(row.id || row._id).toLowerCase(), row])), [hostPackets])
  const enrichedOffers = useMemo(() => offers.map((offer) => ({
    ...offer, _matchedListing: listingForOffer(offer, packetById),
  })), [offers, packetById])
  const allRecipes = useMemo(() => {
    const seen = new Set(recipes.map((row) => String(row.id || '')))
    const unified = hostPackets.filter((row) => row?.type && row.type !== 'grocery')
      .filter((row) => row?.id && !seen.has(String(row.id)))
      .map((row) => ({
        id: row.id, title: row.title || row.packet?.title || 'Untitled recipe',
        status: row.status, source: 'unified', packet: row.packet,
        createdAt: row.createdAt, submittedAt: row.submittedAt,
        canEdit: true, canDelete: false,
      }))
    return [...recipes, ...unified]
  }, [recipes, hostPackets])

  const normalizedSearch = search.trim().toLowerCase()
  const statusOptions = useMemo(() =>
    [...new Set([...enrichedOffers, ...allRecipes].map((item) => item?.status).filter(Boolean))].sort(),
  [enrichedOffers, allRecipes])

  const filteredOffers = useMemo(() => enrichedOffers.filter((offer) => {
    if (statusFilter !== 'all' && offer.status !== statusFilter) return false
    if (!normalizedSearch) return true
    return [offer.merchantSku, offer.offerKey, offer.packId, offer.status,
      offerTitle(offer), offer.productName, offer.productTitle, offer.displayName]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch))
  }), [enrichedOffers, normalizedSearch, statusFilter])

  const filteredRecipes = useMemo(() => allRecipes.filter((recipe) => {
    if (statusFilter !== 'all' && recipe.status !== statusFilter) return false
    if (!normalizedSearch) return true
    return [recipe.title, recipe.id, recipe.dishId, recipe.status]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch))
  }), [allRecipes, normalizedSearch, statusFilter])

  async function deleteOffer(offer) {
    if (!offer?.id || offer.status === 'retired' || busyId) return
    const confirmed = window.confirm(
      `Delete grocery listing "${offer.merchantSku || offer.offerKey || 'this listing'}"? It will stop being active, but its history will remain available here.`,
    )
    if (!confirmed) return
    setBusyId(`offer:${offer.id}`)
    setError('')
    setNotice('')
    try {
      await deleteHostOffer(offer.id)
      setNotice('Grocery listing removed from active use. Its history is still available.')
      await loadHistory()
    } catch (deleteError) {
      setError(getHostOperationsErrorMessage(deleteError, 'Unable to delete this grocery listing.'))
    } finally {
      setBusyId('')
    }
  }

  async function deleteRecipe(recipe) {
    if (!recipe?.id || !recipe.canDelete || busyId) return
    const confirmed = window.confirm(
      recipe.status === 'published'
        ? `Delete "${recipe.title || 'this recipe'}"? The published listing will stop being active, but its history will remain available here.`
        : `Delete "${recipe.title || 'this recipe'}"? It will be removed from the active review flow, but its history will remain available here.`,
    )
    if (!confirmed) return
    setBusyId(`recipe:${recipe.id}`)
    setError('')
    setNotice('')
    try {
      await deleteHostRecipeListing(recipe.id)
      setNotice('Recipe listing removed from active use. Its history is still available.')
      await loadHistory()
    } catch (deleteError) {
      setError(getHostOperationsErrorMessage(deleteError, 'Unable to delete this recipe listing.'))
    } finally {
      setBusyId('')
    }
  }

  function editOffer(offer) {
    navigate(`/host/marketplace?editOffer=${encodeURIComponent(offer.id)}`)
  }

  function editRecipe(recipe) {
    if (recipe?.source === 'unified' && recipe?.id) {
      navigate(`/host/listings/new?edit=${encodeURIComponent(recipe.id)}`)
      return
    }
    const sourceType = String(recipe?.sourceType || '').toLowerCase()
    if (['host', 'community'].includes(sourceType) && recipe?.id) {
      navigate(`/host/listings/new?manage=legacy&source=host-recipe&id=${encodeURIComponent(recipe.id)}`)
      return
    }
    navigate('/host/listings/new')
  }

  const totalResults = (activeType === 'recipe' ? 0 : filteredOffers.length)
    + (activeType === 'grocery' ? 0 : filteredRecipes.length)
  const modalRows = viewAllType === 'grocery' ? filteredOffers : filteredRecipes

  return (
    <main className="elh-page">
      <style>{theme}</style>
      <div className="elh-shell">
        <header className="elh-hero">
          <div>
            <p className="elh-kicker"><History size={14} aria-hidden="true" /> Your Host workspace</p>
            <h1>Listing history</h1>
            <p>Find your grocery and recipe listings, check their status, and make updates from the right workspace.</p>
          </div>
          <div className="elh-hero-side">
            <div className="elh-stat"><strong>{offers.length}</strong><span>Grocery listings</span></div>
            <div className="elh-stat"><strong>{allRecipes.length}</strong><span>Recipe listings</span></div>
            <button type="button" className="elh-refresh" onClick={loadHistory} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
            </button>
          </div>
        </header>

        <div className="elh-toolbar">
          <div className="elh-switch" role="tablist" aria-label="Listing type">
            {[
              ['all', 'All', offers.length + allRecipes.length],
              ['grocery', 'Grocery', offers.length],
              ['recipe', 'Recipes', allRecipes.length],
            ].map(([value, label, count]) => (
              <button key={value} type="button" role="tab" aria-selected={activeType === value}
                onClick={() => setActiveType(value)}>
                {label}<span className="elh-count">{count}</span>
              </button>
            ))}
          </div>
          <div className="elh-actions">
            <div className="elh-search">
              <Search size={17} aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, SKU or reference" aria-label="Search listings" />
              {search ? (
                <button type="button" className="elh-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={15} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <select className="elh-status-select" value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{titleize(status)}</option>)}
            </select>
          </div>
        </div>

        <div className="elh-subnote">
          <span><strong>{totalResults}</strong> matching {totalResults === 1 ? 'record' : 'records'}</span>
          <span>Edits open in the existing Grocery or Recipe workspace.</span>
        </div>

        {error ? <div className="elh-message" role="alert"><CircleAlert size={19} /> {error}</div> : null}
        {notice ? <div className="elh-message elh-message--success" role="status">{notice}</div> : null}

        {loading ? (
          <div className="elh-loading"><LoaderCircle size={24} className="animate-spin" /> Loading listing history…</div>
        ) : (
          <>
            {activeType !== 'recipe' ? (
              <section className="elh-group" aria-labelledby="elh-grocery-heading">
                <div className="elh-group-header">
                  <div className="elh-group-title">
                    <span className="elh-group-icon"><Package size={21} aria-hidden="true" /></span>
                    <div>
                      <h2 id="elh-grocery-heading">Grocery listings</h2>
                      <p className="elh-group-desc">Manage price, stock and offer details.</p>
                    </div>
                  </div>
                  <span className="elh-group-count">{filteredOffers.length} records</span>
                </div>
                {filteredOffers.length > 0 ? (
                  <>
                    <div className="elh-table">
                      {filteredOffers.slice(0, 8).map((offer) => (
                        <GroceryRow key={offer.id} offer={offer} busyId={busyId}
                          onEdit={editOffer} onDelete={deleteOffer} />
                      ))}
                    </div>
                    {filteredOffers.length > 8 ? (
                      <button type="button" className="elh-view-all" onClick={() => setViewAllType('grocery')}>
                        View all {filteredOffers.length} grocery listings <ArrowUpRight size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </>
                ) : <div className="elh-empty">{offers.length ? 'No grocery listings match your filters.' : 'No grocery listings yet.'}</div>}
              </section>
            ) : null}

            {activeType !== 'grocery' ? (
              <section className="elh-group" aria-labelledby="elh-recipe-heading">
                <div className="elh-group-header">
                  <div className="elh-group-title">
                    <span className="elh-group-icon"><ChefHat size={21} aria-hidden="true" /></span>
                    <div>
                      <h2 id="elh-recipe-heading">Recipe listings</h2>
                      <p className="elh-group-desc">Follow review status and manage eligible recipe submissions.</p>
                    </div>
                  </div>
                  <span className="elh-group-count">{filteredRecipes.length} records</span>
                </div>
                {filteredRecipes.length > 0 ? (
                  <>
                    <div className="elh-table">
                      {filteredRecipes.slice(0, 8).map((recipe) => (
                        <RecipeRow key={recipe.id} recipe={recipe} busyId={busyId}
                          onEdit={editRecipe} onDelete={deleteRecipe} />
                      ))}
                    </div>
                    {filteredRecipes.length > 8 ? (
                      <button type="button" className="elh-view-all" onClick={() => setViewAllType('recipe')}>
                        View all {filteredRecipes.length} recipe listings <ArrowUpRight size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </>
                ) : <div className="elh-empty">{allRecipes.length ? 'No recipe listings match your filters.' : 'No recipe listings yet.'}</div>}
              </section>
            ) : null}
          </>
        )}

        <p className="elh-bottom-note">Deleting a listing uses the existing removal rules. Its historical record may remain available.</p>
      </div>

      {viewAllType ? (
        <div className="elh-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setViewAllType('')
        }}>
          <section className="elh-dialog" role="dialog" aria-modal="true" aria-label="All listing records">
            <div className="elh-dialog-head">
              <div>
                <p className="elh-kicker" style={{ color:'#A75B35',marginBottom:6 }}>ALL RECORDS</p>
                <h2>{viewAllType === 'grocery' ? 'Grocery listings' : 'Recipe listings'}</h2>
                <p>{modalRows.length} listings match the current search and status filter.</p>
              </div>
              <button type="button" className="elh-close" aria-label="Close listing history" onClick={() => setViewAllType('')}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="elh-dialog-body">
              <div className="elh-table">
                {viewAllType === 'grocery'
                  ? filteredOffers.map((offer) => (
                    <GroceryRow key={offer.id} offer={offer} busyId={busyId}
                      onEdit={(item) => { setViewAllType(''); editOffer(item) }} onDelete={deleteOffer} />
                  ))
                  : filteredRecipes.map((recipe) => (
                    <RecipeRow key={recipe.id} recipe={recipe} busyId={busyId}
                      onEdit={(item) => { setViewAllType(''); editRecipe(item) }} onDelete={deleteRecipe} />
                  ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
