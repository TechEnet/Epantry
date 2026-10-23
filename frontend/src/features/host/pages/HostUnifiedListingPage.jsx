import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ClipboardList, Download, FileSpreadsheet, ImagePlus, Plus, Save, Send, Trash2, UploadCloud } from 'lucide-react'
import { useAuth } from '../../auth/context/AuthContext'
import { searchCommunityIngredients } from '../../community/services/community.service'
import { listHospitalityOutlets, listHospitalityMenus } from '../../hospitality/services/hospitality.service'
import { normalizeHostWorkspaceType } from '../hostWorkspace.config'
import { parseHostBulkWorkbook, ingestWorkbookImages } from '../utils/hostBulkWorkbook'
import {
  createHostListingPacket, getHostListingPacket, importHostListingPackets,
  listHostListingPackets, submitHostListingPacket, updateHostListingPacket,
  uploadHostListingImage, uploadHostListingVideo, importHostListingRemoteImage,
} from '../services/hostUnifiedListing.service'

const styles = {
  field: 'min-w-0 w-full rounded-lg border border-[#CBD4C8] bg-white px-3 py-2.5 text-[15px] text-[#202421] focus:outline-2 focus:outline-offset-1 focus:outline-[#173F35]',
  label: 'block text-sm font-semibold text-[#202421]',
  section: 'border-t border-[#D7DDCF] py-6 sm:py-8',
  button: 'rounded-lg bg-[#173F35] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50',
  secondary: 'rounded-lg border border-[#BAC7B8] px-4 py-2.5 text-sm font-semibold text-[#173F35] disabled:opacity-50',
}
const fields = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg']
const allergenNames = ['milk', 'egg', 'peanut', 'tree_nut', 'soy', 'wheat', 'sesame', 'fish', 'shellfish']
const units = ['g', 'kg', 'ml', 'l', 'piece', 'tsp', 'tbsp', 'cup']
const categoryOptions = [
  ['grocery', 'Grocery'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'],
  ['snacks', 'Snacks'], ['drinks', 'Drinks'], ['sweets', 'Sweets'], ['desserts', 'Desserts'],
  ['bakery', 'Bakery'], ['main_course', 'Main course'], ['side_dish', 'Side dish'], ['other', 'Other food'],
]
const types = [
  { value: 'grocery', label: 'Grocery / packaged food', allowed: ['b2b', 'brand_seller', 'hybrid', 'legacy'] },
  { value: 'brand_recipe', label: 'Brand recipe', allowed: ['brand_seller', 'hybrid', 'legacy'] },
  { value: 'kitchen_recipe', label: 'Kitchen recipe / drinks / sweets', allowed: ['b2b', 'chef_restaurant', 'hybrid', 'legacy'] },
  { value: 'prepared_food', label: 'Ready-made food / menu item', allowed: ['b2b', 'chef_restaurant', 'hybrid', 'legacy'] },
]
// Each template maps to one existing permitted Host listing type; special food
// categories reuse kitchen_recipe rather than creating parallel databases.
const bulkTemplates = [
  { key: 'grocery', label: 'Grocery / packaged food', type: 'grocery' },
  { key: 'brand_recipe', label: 'Brand recipe', type: 'brand_recipe' },
  { key: 'kitchen_recipe', label: 'Kitchen recipe', type: 'kitchen_recipe' },
  { key: 'prepared_food', label: 'Ready-made food / menu', type: 'prepared_food' },
  { key: 'drinks', label: 'Drinks & beverages', type: 'kitchen_recipe' },
  { key: 'sweets', label: 'Sweets', type: 'kitchen_recipe' },
  { key: 'desserts', label: 'Desserts', type: 'kitchen_recipe' },
  { key: 'bakery', label: 'Bakery', type: 'kitchen_recipe' },
]
const emptyIngredient = () => ({ name: '', canonicalIngredientId: '', imageUrl: '', quantity: 1, unit: 'g', unitPrice: '', priceQuantity: 1, priceUnit: 'g', note: '' })
const emptyStep = () => ({ instruction: '', timerMinutes: '', imageUrl: '' })
function newPacket(type = 'grocery') {
  return {
    type, title: '', description: '', category: type === 'grocery' ? 'grocery' : 'other', images: [], videoUrl: '',
    brandName: '', sku: '', baseServings: 4, ingredients: [emptyIngredient()], steps: [emptyStep()],
    nutrition: { basis: 'Per serving', evidenceNote: '' }, allergens: [], dietary: 'not_declared',
    shareRecipe: type === 'brand_recipe' || type === 'kitchen_recipe', sellReadyMade: type === 'prepared_food',
    selling: { listPrice: '', salePrice: '', stockQuantity: '', stockUnit: 'piece', packQuantity: '', packUnit: 'piece', minimumOrderQuantity: 1, maximumOrderQuantity: '', barcode: '', packagingCost: '', labourCost: '', outletId: '', menuId: '' },
    delivery: { fulfillment: 'delivery', postalCodes: [], preparationMinutes: '', note: '' }, sourceNotes: '',
  }
}
function formatMoney(value) { return value === null || value === undefined ? 'Not available' : `Rs ${Number(value).toFixed(2)}` }
function estimateCost(ingredient) {
  const mass = { g: 1, kg: 1000 }
  const volume = { ml: 1, l: 1000 }
  const group = mass[ingredient.unit] && mass[ingredient.priceUnit] ? mass :
    volume[ingredient.unit] && volume[ingredient.priceUnit] ? volume : null
  const converted = group ? Number(ingredient.quantity) * group[ingredient.unit] / group[ingredient.priceUnit] :
    ingredient.unit === ingredient.priceUnit ? Number(ingredient.quantity) : NaN
  if (ingredient.unitPrice === '' || ingredient.unitPrice == null || ingredient.priceQuantity === '' || ingredient.priceQuantity == null || !Number(ingredient.priceQuantity) ||
      !Number.isFinite(converted) || Number(ingredient.unitPrice) < 0) return null
  return Math.round(converted / Number(ingredient.priceQuantity) * Number(ingredient.unitPrice) * 100) / 100
}
function EditorField({ title, children }) {
  return <label className="block min-w-0"><span className={`${styles.label} mb-1.5`}>{title}</span>{children}</label>
}
function IngredientNameInput({ ingredient, onChange, className }) {
  const [matches, setMatches] = useState([])
  const [searchError, setSearchError] = useState('')
  useEffect(() => {
    const query = String(ingredient.name || '').trim()
    if (query.length < 2 || ingredient.canonicalIngredientId) { setMatches([]); return undefined }
    let alive = true
    const timer = setTimeout(async () => {
      try {
        const result = await searchCommunityIngredients({ search: query, limit: 6 })
        if (alive) { setMatches(result?.ingredients || []); setSearchError('') }
      } catch { if (alive) { setMatches([]); setSearchError('Catalog search is unavailable; enter the name manually for review.') } }
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [ingredient.name, ingredient.canonicalIngredientId])
  return <div className="relative">
    <input aria-label="Ingredient name" className={className} value={ingredient.name || ''} onChange={(event) => onChange({ name: event.target.value, canonicalIngredientId: '' })} placeholder="Search an EPANTRY ingredient" autoComplete="off"/>
    {matches.length > 0 && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#CBD4C8] bg-white shadow-lg">{matches.map((match) => <button type="button" key={match.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#EDF1E9]" onClick={() => { onChange({ name: match.canonicalName, canonicalIngredientId: match.id }); setMatches([]) }}>{match.canonicalName}</button>)}</div>}
    {ingredient.canonicalIngredientId && <p className="mt-1 text-xs text-[#173F35]">Matched with EPANTRY ingredient</p>}
    {searchError && <p className="mt-1 text-xs text-[#9A4F31]">{searchError}</p>}
  </div>
}

export default function HostUnifiedListingPage() {
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const workspace = normalizeHostWorkspaceType(currentUser)
  const allowed = types.filter((item) => item.allowed.includes(workspace))
  const visibleTemplates = bulkTemplates.filter((item) => allowed.some((choice) => choice.value === item.type))
  const requestedType = params.get('type')
  const initialType = allowed.some((item) => item.value === requestedType) ? requestedType : allowed[0]?.value || 'grocery'
  const [form, setForm] = useState(() => newPacket(initialType))
  const [editingId, setEditingId] = useState('')
  const [existing, setExisting] = useState([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkProgress, setBulkProgress] = useState('')
  const [pincodeText, setPincodeText] = useState('')
  const [outlets, setOutlets] = useState([])
  const [menus, setMenus] = useState([])
  const [activeTab, setActiveTab] = useState('single')
  const fieldRef = useRef(null)
  const activeListing = existing.find((item) => item.id === editingId)
  const locked = ['submitted_for_review', 'approved', 'rejected'].includes(activeListing?.status)
  const correctionSection = activeListing?.status === 'changes_requested' ? activeListing?.correctionSection : ''
  const isRecipe = form.type !== 'grocery'
  const canSell = form.type === 'grocery' || form.type === 'prepared_food' || (form.type === 'kitchen_recipe' && form.sellReadyMade)
  const costs = useMemo(() => (isRecipe ? form.ingredients.map(estimateCost) : []), [isRecipe, form.ingredients])
  const knownCosts = costs.filter((cost) => cost !== null)
  const costingComplete = isRecipe && costs.length > 0 && knownCosts.length === costs.length
  const ingredientCost = knownCosts.length ? knownCosts.reduce((sum, value) => sum + value, 0) : null
  const completeCost = costingComplete ? ingredientCost + Number(form.selling.packagingCost || 0) + Number(form.selling.labourCost || 0) : null
  const errorMessage = (value) => value?.response?.data?.message || value?.message || 'Unable to complete this listing action.'

  const load = useCallback(async () => {
    try {
      const response = await listHostListingPackets()
      setExisting(response?.listings || [])
    } catch (cause) { setError(errorMessage(cause)) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!['b2b', 'chef_restaurant', 'hybrid', 'legacy'].includes(workspace)) return
    let cancelled = false
    Promise.allSettled([listHospitalityOutlets(), listHospitalityMenus()]).then(([outletResult, menuResult]) => {
      if (cancelled) return
      if (outletResult.status === 'fulfilled') setOutlets(outletResult.value?.outlets || [])
      if (menuResult.status === 'fulfilled') setMenus(menuResult.value?.menus || [])
    })
    return () => { cancelled = true }
  }, [workspace])
  useEffect(() => {
    const id = params.get('edit')
    if (!id || id === editingId) return
    let cancelled = false
    setLoading(true)
    getHostListingPacket(id).then((data) => {
      if (cancelled) return
      setForm({ ...newPacket(data.listing.packet.type), ...data.listing.packet })
      setPincodeText((data.listing.packet.delivery?.postalCodes || []).join(', '))
      setEditingId(data.listing.id)
      setActiveTab('single')
    }).catch((cause) => { if (!cancelled) setError(errorMessage(cause)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [params, editingId])
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const nested = (key, sub, value) => setForm((current) => ({ ...current, [key]: { ...current[key], [sub]: value } }))
  const updateRow = (key, index, patchValue) => setForm((current) => ({
    ...current, [key]: current[key].map((item, offset) => offset === index ? { ...item, ...patchValue } : item),
  }))
  const removeRow = (key, index) => setForm((current) => ({ ...current, [key]: current[key].filter((_, offset) => offset !== index) }))
  function startNew(type) {
    setForm(newPacket(type)); setPincodeText(''); setEditingId(''); setError(''); setNotice('')
    setParams({ type }); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function uploadImage(file, target, index = -1) {
    if (!file) return
    setUploading(`${target}-${index}`); setError('')
    try {
      const url = await uploadHostListingImage(file)
      if (target === 'images') setForm((current) => ({ ...current, images: [...current.images, url].slice(0, 12) }))
      else updateRow(target, index, { imageUrl: url })
      setNotice('Image uploaded. Save this listing to keep it.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setUploading('') }
  }
  async function uploadVideo(file) {
    if (!file) return
    setUploading('video'); setError('')
    try {
      const url = await uploadHostListingVideo(file)
      patch('videoUrl', url)
      setNotice('Video uploaded. Save this listing to keep it.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setUploading('') }
  }
  async function save(submit = false) {
    if (busy || locked || uploading) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = editingId ? await updateHostListingPacket(editingId, form) : await createHostListingPacket(form)
      const id = result?.listing?.id
      if (submit) await submitHostListingPacket(id)
      setEditingId(id)
      setParams({ edit: id })
      setNotice(submit ? 'Listing submitted to Super Admin for review. You will be notified after a decision.' : 'Draft saved. You can continue editing here.')
      await load()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  async function bulkImport() {
    if (busy) return
    let packets
    try {
      packets = JSON.parse(bulkText)
      if (!Array.isArray(packets)) throw new Error('Bulk file must contain an array of listings.')
    } catch (cause) { setError(cause.message); return }
    if (!packets.length || packets.length > 25) { setError('Import between 1 and 25 listings at once.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await importHostListingPackets(packets)
      setNotice(`${result?.listings?.length || 0} draft listings imported. Open each to check and submit.`)
      setBulkText(''); await load()
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  async function previewExcel(file) {
    if (!file) return
    setError(''); setNotice(''); setBulkPreview(null); setBulkProgress('')
    setBulkFileName(file.name)
    try {
      const preview = await parseHostBulkWorkbook(file, allowed.map((type) => type.value))
      setBulkPreview(preview)
      setNotice(`${preview.packets.length} listings ready for review. Import creates drafts only, never public listings.`)
    } catch (cause) { setError(cause?.message || 'Unable to read this EPANTRY Excel template.') }
  }
  async function importExcelDrafts() {
    if (busy || !bulkPreview?.packets?.length) return
    setBusy(true); setError(''); setNotice(''); setBulkProgress('')
    try {
      const packets = await ingestWorkbookImages(bulkPreview.packets, importHostListingRemoteImage, (done, total) => {
        setBulkProgress(`Importing real images into EPANTRY: ${done} of ${total}`)
      })
      setBulkProgress('Saving approved-format drafts to EPANTRY...')
      const result = await importHostListingPackets(packets)
      setNotice(`${result?.listings?.length || 0} listings saved as drafts. Open each item, verify details and submit for Super Admin review.`)
      setBulkPreview(null); setBulkFileName(''); setBulkProgress('')
      await load()
    } catch (cause) {
      setError(`${errorMessage(cause)} Nothing has been added to your draft listings. Check your Excel links or values and retry.`)
      setBulkProgress('')
    } finally { setBusy(false) }
  }
  const field = styles.field
  const section = styles.section
  return (
    <main ref={fieldRef} className="min-h-screen bg-[#F7F6F2] px-3 py-5 text-[#202421] sm:px-7 sm:py-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <Link to="/host/listings" className="inline-flex items-center gap-2 text-sm font-semibold text-[#173F35]"><ArrowLeft size={17}/> All listing options</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#D7DDCF] pb-5">
          <div><p className="text-sm font-semibold text-[#C86C42]">Host listing workspace</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Create once. Review once.</h1>
            <p className="mt-2 max-w-3xl text-base text-[#4A5850]">Keep item details, photos, ingredients, costing, food information and selling terms in one place. Super Admin decides when a listing may go public.</p></div>
          <button type="button" className={styles.secondary} onClick={() => startNew(initialType)}>Start new listing</button>
        </div>
        {error && <div role="alert" className="my-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {activeListing?.reviewNote && <div role="status" className="my-4 border-l-4 border-[#C86C42] bg-[#F7E7DA] px-4 py-3 text-sm"><strong>Super Admin note:</strong> {activeListing.reviewNote} {correctionSection && <a className="ml-2 font-semibold underline" href={`#listing-${correctionSection}`}>Go to {correctionSection}</a>}</div>}
        {notice && <div role="status" className="my-4 flex items-center gap-2 border-l-4 border-[#173F35] bg-[#E0ECE1] px-4 py-3 text-sm text-[#173F35]"><CheckCircle2 size={18}/>{notice}</div>}
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Listing mode">
          <button className={activeTab === 'single' ? styles.button : styles.secondary} type="button" onClick={() => setActiveTab('single')}>Single listing</button>
          <button className={activeTab === 'bulk' ? styles.button : styles.secondary} type="button" onClick={() => setActiveTab('bulk')}>Bulk listing</button>
        </div>
        {activeTab === 'bulk' ? (
          <div className="mt-6 space-y-6">
            <section className="border-t border-[#D7DDCF] pt-5">
              <h2 className="text-2xl font-bold">01 / Download your Excel template</h2>
              <p className="mt-2 text-sm text-[#4A5850]">Choose the template for your listing. Grocery uses product details and photos only; recipe and drink templates also include individual ingredients, their photos, preparation steps and costing.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {visibleTemplates.map((item) => (
                  <a key={item.key} href={`/templates/EPANTRY_Bulk_${item.key}.xlsx`} download className="flex items-center justify-between gap-3 border border-[#CBD4C8] bg-white p-3 text-sm font-semibold text-[#173F35] hover:bg-[#E4EBDD] focus-visible:outline-2 focus-visible:outline-[#C86C42]">
                    <span className="flex items-center gap-2"><FileSpreadsheet size={17}/>{item.label}</span><Download size={16}/>
                  </a>
                ))}
              </div>
            </section>
            <section className="grid gap-6 border-t border-[#D7DDCF] pt-5 lg:grid-cols-[minmax(0,1fr)_310px]">
              <div>
                <h2 className="text-2xl font-bold">02 / Fill the sheets and upload</h2>
                <p className="mt-2 text-sm leading-6 text-[#4A5850]">Open the Excel file and follow <strong>Start Here</strong>. Give each listing a unique <strong>listing_key</strong>. Use the same key in Photos, Ingredients, Steps and Allergens so every photo and detail attaches to the correct item. The sample sheet is for guidance only.</p>
                <label htmlFor="epantry-bulk-excel" className="mt-4 block text-sm font-semibold">Choose your completed Excel (.xlsx)</label>
                <input id="epantry-bulk-excel" type="file" disabled={busy} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-2 block w-full rounded-lg border border-[#CBD4C8] bg-white p-3 text-sm" onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (file) await previewExcel(file)
                  event.target.value = ''
                }}/>
                {bulkFileName && <p className="mt-2 text-sm text-[#173F35]">Selected: {bulkFileName}</p>}
                {bulkPreview && <div className="mt-5 border border-[#B7C6B8] bg-[#F0F4ED] p-4">
                  <h3 className="font-bold">03 / Review before importing</h3>
                  <p className="mt-1 text-sm">{bulkPreview.packets.length} draft listings · {bulkPreview.mediaCount} unique images · {bulkPreview.template.replaceAll('_', ' ')} template</p>
                  <div className="mt-3 max-h-72 overflow-auto border-t border-[#CBD4C8]">
                    {bulkPreview.packets.map((packet, index) => <div key={index} className="flex flex-wrap justify-between gap-2 border-b border-[#CBD4C8] py-2 text-sm"><span><strong>{index + 1}. {packet.title}</strong><br/>{packet.category.replaceAll('_', ' ')}</span><span className="text-[#53635B]">{packet.images.length} photos · {packet.ingredients.length} ingredients · {packet.steps.length} steps</span></div>)}
                  </div>
                  {bulkPreview.issues.length > 0 && <div className="mt-3 border-l-4 border-[#C86C42] bg-[#FFF1E8] p-3 text-sm"><strong>Complete these fields before final submission:</strong><ul className="mt-1 list-disc space-y-1 pl-4">{bulkPreview.issues.slice(0, 15).map((issue, index) => <li key={index}>{issue.key}: {issue.message}</li>)}</ul>{bulkPreview.issues.length > 15 && <p>And {bulkPreview.issues.length - 15} more notices. All records will remain drafts.</p>}</div>}
                  {bulkProgress && <p role="status" className="mt-3 text-sm font-semibold text-[#173F35]">{bulkProgress}</p>}
                  <button type="button" disabled={busy} onClick={importExcelDrafts} className={`${styles.button} mt-4`}><UploadCloud size={16} className="mr-2 inline"/>{busy ? 'Importing...' : 'Import images & save draft listings'}</button>
                </div>}
              </div>
              <aside className="bg-[#E2EBDD] p-5 text-sm leading-6">
                <h3 className="font-bold">Public Google Drive images</h3>
                <p className="mt-2">Upload each image as a <strong>file</strong> to Google Drive → Share → General access → <strong>Anyone with the link</strong> → Viewer. Paste the copied <strong>file link</strong> into Excel. Folder links and private files will fail.</p>
                <p className="mt-3">During import, EPANTRY attempts to copy each accessible JPG, PNG or WebP into its own Cloudinary storage. The real uploaded photo is then attached to the corresponding item/ingredient, not a random placeholder.</p>
                <p className="mt-3 font-semibold">Up to 25 listings and 120 different images per workbook. Uploaded records remain drafts for review; delivery pincodes, stock and selling prices are never auto-published.</p>
              </aside>
            </section>
            <details className="border-t border-[#D7DDCF] pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#173F35]">Advanced: import existing JSON bulk file (unchanged)</summary>
              <p className="mt-2 text-sm leading-6 text-[#4A5850]">Existing JSON import stays available for automated Host workflows. For normal bulk listing, use the Excel template above.</p>
              <input type="file" accept=".json,application/json" className="mt-3 block w-full text-sm" onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.size > 1000000) { setError('Bulk JSON file must be under 1 MB.'); return }
                setBulkText(await file.text())
              }}/>
              <textarea rows={5} value={bulkText} onChange={(event) => setBulkText(event.target.value)} className={`${field} mt-3 font-mono text-xs`} placeholder={'[\n  { "type": "grocery", "title": "Example product", "category": "grocery", "images": [] }\n]'}/>
              <button type="button" disabled={busy || !bulkText.trim()} onClick={bulkImport} className={`${styles.secondary} mt-3`}>Import JSON as drafts</button>
            </details>
          </div>
        ) : (
          <fieldset disabled={locked || busy || loading} className="mt-5 min-w-0 disabled:opacity-85">
            <section id="listing-details" className={section}>
              <h2 className="text-2xl font-bold">01 / Item details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <EditorField title="Listing type"><select value={form.type} className={field} onChange={(event) => startNew(event.target.value)}>{allowed.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></EditorField>
                <EditorField title="Item / recipe name"><input className={field} value={form.title} maxLength={180} onChange={(event) => patch('title', event.target.value)}/></EditorField>
                <EditorField title="Customer category"><select className={field} value={form.category} onChange={(event) => patch('category', event.target.value)}>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></EditorField>
                <EditorField title="Brand name (if applicable)"><input className={field} value={form.brandName || ''} onChange={(event) => patch('brandName', event.target.value)}/></EditorField>
                <EditorField title="Your SKU (if applicable)"><input className={field} value={form.sku || ''} onChange={(event) => patch('sku', event.target.value)}/></EditorField>
                {isRecipe && <EditorField title="Servings / batch yield"><input type="number" min="1" className={field} value={form.baseServings ?? ''} onChange={(event) => patch('baseServings', event.target.value)}/></EditorField>}
              </div>
              <EditorField title="Description"><textarea rows={2} maxLength={3000} className={`${field} mt-4`} value={form.description} onChange={(event) => patch('description', event.target.value)}/></EditorField>
              {isRecipe && ['kitchen_recipe', 'prepared_food'].includes(form.type) && <div className="mt-4 flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.shareRecipe} onChange={(event) => patch('shareRecipe', event.target.checked)}/> Share recipe</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.sellReadyMade} disabled={form.type === 'prepared_food'} onChange={(event) => patch('sellReadyMade', event.target.checked)}/> Sell ready-made item</label></div>}
            </section>
            <section id="listing-media" className={section}>
              <h2 className="text-2xl font-bold">02 / Photos {isRecipe ? '& video' : ''}</h2>
              <p className="mt-1 text-sm text-[#4A5850]">Upload real product or recipe photos. Each ingredient can have its own image below.</p>
              <div className="mt-4 flex flex-wrap gap-3">{form.images.map((url, index) => <div key={`${url}-${index}`} className="relative"><img alt={`Listing photo ${index + 1}`} src={url} className="h-24 w-28 rounded-lg object-cover"/><button type="button" className="absolute right-1 top-1 rounded bg-white p-1" aria-label={`Remove photo ${index + 1}`} onClick={() => patch('images', form.images.filter((_, i) => i !== index))}><Trash2 size={15}/></button></div>)}</div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#173F35] px-4 py-3 text-sm font-semibold text-[#173F35]"><ImagePlus size={18}/>{uploading.startsWith('images') ? 'Uploading...' : 'Upload listing photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={Boolean(uploading) || form.images.length >= 12} onChange={(event) => { uploadImage(event.target.files?.[0], 'images'); event.target.value = '' }}/></label>
              {isRecipe && <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><EditorField title="Recipe video (uploaded or HTTPS URL)"><input className={field} type="url" value={form.videoUrl || ''} onChange={(event) => patch('videoUrl', event.target.value)} placeholder="https://..."/></EditorField><label className="mt-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#173F35] px-4 py-3 text-sm font-semibold"><UploadCloud size={18}/>{uploading === 'video' ? 'Uploading...' : 'Upload video (50 MB max)'}<input className="sr-only" type="file" accept="video/mp4,video/webm" disabled={Boolean(uploading)} onChange={(event) => { uploadVideo(event.target.files?.[0]); event.target.value = '' }}/></label></div>}
            </section>
            {isRecipe && <section id="listing-ingredients" className={section}>
              <div className="flex items-center justify-between gap-2"><h2 className="text-2xl font-bold">03 / Ingredients and their cost</h2><button className={styles.secondary} type="button" onClick={() => patch('ingredients', [...form.ingredients, emptyIngredient()])}><Plus size={16} className="mr-1 inline"/>Add ingredient</button></div>
              <p className="mt-2 text-sm leading-6 text-[#4A5850]">Each price is your own input for the specified purchase quantity. These are estimates, not verified marketplace prices. Different mass/volume units are converted when possible.</p>
              <div className="mt-4 space-y-4">{form.ingredients.map((item, index) => <div key={index} className="border-b border-[#D7DDCF] bg-[#EDF1E9] p-3 sm:p-4">
                <div className="flex justify-between"><h3 className="font-semibold">Ingredient {index + 1}</h3><button type="button" disabled={form.ingredients.length === 1} onClick={() => removeRow('ingredients', index)} aria-label={`Remove ingredient ${index + 1}`}><Trash2 size={17}/></button></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <EditorField title="Ingredient name"><IngredientNameInput className={field} ingredient={item} onChange={(value) => updateRow('ingredients', index, value)}/></EditorField>
                  <EditorField title="Amount used"><input className={field} type="number" min="0" step="any" value={item.quantity ?? ''} onChange={(event) => updateRow('ingredients', index, { quantity: event.target.value })}/></EditorField>
                  <EditorField title="Unit"><select className={field} value={item.unit} onChange={(event) => updateRow('ingredients', index, { unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></EditorField>
                  <EditorField title="Purchased pack price (Rs)"><input className={field} type="number" min="0" step="0.01" value={item.unitPrice ?? ''} onChange={(event) => updateRow('ingredients', index, { unitPrice: event.target.value })}/></EditorField>
                  <EditorField title="Pack quantity"><input className={field} type="number" min="0" step="any" value={item.priceQuantity ?? ''} onChange={(event) => updateRow('ingredients', index, { priceQuantity: event.target.value })}/></EditorField>
                  <EditorField title="Pack unit"><select className={field} value={item.priceUnit} onChange={(event) => updateRow('ingredients', index, { priceUnit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></EditorField>
                  <EditorField title="Ingredient photo"><div className="flex items-center gap-2">{item.imageUrl && <img src={item.imageUrl} alt={item.name || 'Ingredient'} className="h-11 w-12 rounded object-cover"/>}<label className="cursor-pointer rounded-lg border border-[#A3B5A4] bg-white px-3 py-3 text-xs font-semibold"><ImagePlus size={15} className="mr-1 inline"/>Upload<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={(event) => { uploadImage(event.target.files?.[0], 'ingredients', index); event.target.value = '' }}/></label></div></EditorField>
                  <div className="self-end pb-3 text-sm font-semibold text-[#173F35]">Estimated usage: {formatMoney(costs[index])}</div>
                </div>
                <EditorField title="Preparation / purchasing note"><input className={`${field} mt-2`} value={item.note || ''} onChange={(event) => updateRow('ingredients', index, { note: event.target.value })}/></EditorField>
              </div>)}</div>
              <div className="mt-4 flex flex-wrap gap-8 bg-[#D7DDCF] p-4 text-sm"><span><strong>Ingredient estimate:</strong> {formatMoney(ingredientCost)}</span><span><strong>Complete cost:</strong> {formatMoney(completeCost)}</span><span><strong>Per serving:</strong> {completeCost !== null && Number(form.baseServings) > 0 ? formatMoney(completeCost / Number(form.baseServings)) : 'Not available'}</span><span className="font-semibold text-[#9A4F31]">{costingComplete ? 'All ingredient estimates entered' : 'Some ingredient costs are missing'}</span></div>
            </section>}
            {isRecipe && <section id="listing-steps" className={section}><div className="flex items-center justify-between gap-2"><h2 className="text-2xl font-bold">04 / Preparation steps</h2><button type="button" className={styles.secondary} onClick={() => patch('steps', [...form.steps, emptyStep()])}><Plus size={16} className="mr-1 inline"/>Add step</button></div>
              <div className="mt-4 space-y-3">{form.steps.map((step, index) => <div key={index} className="grid items-start gap-3 border-b border-[#D7DDCF] pb-3 sm:grid-cols-[50px_minmax(0,1fr)_150px_36px]"><strong className="py-3 text-[#C86C42]">{String(index + 1).padStart(2, '0')}</strong><textarea className={field} rows={2} value={step.instruction || ''} onChange={(event) => updateRow('steps', index, { instruction: event.target.value })} placeholder="What should the customer do?"/><input className={field} type="number" min="0" value={step.timerMinutes ?? ''} onChange={(event) => updateRow('steps', index, { timerMinutes: event.target.value })} placeholder="Minutes"/><button type="button" aria-label={`Remove step ${index + 1}`} disabled={form.steps.length === 1} onClick={() => removeRow('steps', index)}><Trash2 size={17}/></button></div>)}</div>
            </section>}
            <section id="listing-nutrition" className={section}><h2 className="text-2xl font-bold">{isRecipe ? '05' : '03'} / Nutrition, allergens & dietary</h2>
              <p className="mt-2 text-sm text-[#4A5850]">Enter only supported values. Missing values are not treated as zero or certified claims.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><EditorField title="Nutrition basis"><input className={field} value={form.nutrition?.basis || ''} onChange={(event) => nested('nutrition', 'basis', event.target.value)}/></EditorField>
                {fields.map((item) => <EditorField key={item} title={item.replace(/([A-Z])/g, ' $1')}><input type="number" min="0" step="any" className={field} value={form.nutrition?.[item] ?? ''} onChange={(event) => nested('nutrition', item, event.target.value)}/></EditorField>)}
                <EditorField title="Dietary declaration"><select value={form.dietary} className={field} onChange={(event) => patch('dietary', event.target.value)}>{['not_declared', 'vegetarian', 'vegan', 'non_vegetarian', 'other'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></EditorField></div>
              <h3 className="mt-5 text-lg font-semibold">Allergen information</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{allergenNames.map((key) => <EditorField key={key} title={key.replaceAll('_', ' ')}><select className={field} value={form.allergens.find((item) => item.key === key)?.relationship || ''} onChange={(event) => patch('allergens', [...form.allergens.filter((item) => item.key !== key), ...(event.target.value ? [{ key, relationship: event.target.value }] : [])])}><option value="">Not declared</option><option value="contains">Contains</option><option value="may_contain">May contain</option><option value="does_not_contain">Does not contain</option><option value="unknown">Unknown / not verified</option></select></EditorField>)}</div>
              <EditorField title="Evidence / calculation note"><textarea rows={2} className={`${field} mt-4`} value={form.nutrition?.evidenceNote || ''} onChange={(event) => nested('nutrition', 'evidenceNote', event.target.value)}/></EditorField>
            </section>
            {canSell && <section id="listing-selling" className={section}><span id="listing-delivery" /><h2 className="text-2xl font-bold">{isRecipe ? '06' : '04'} / Price, stock & delivery</h2>
              <p className="mt-1 text-sm text-[#4A5850]">Enter these details once for review. Your existing Marketplace delivery and service-area rules remain authoritative. Approval of this packet does not create an orderable offer.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[['listPrice', 'List price (Rs)'], ['salePrice', 'Selling price (Rs)'], ['stockQuantity', 'Available stock'], ['packagingCost', 'Packaging cost (Rs)'], ['labourCost', 'Labour cost (Rs)']].map(([key, title]) => <EditorField key={key} title={title}><input type="number" min="0" step="any" className={field} value={form.selling?.[key] ?? ''} onChange={(event) => nested('selling', key, event.target.value)}/></EditorField>)}
                <EditorField title="Stock unit"><input className={field} value={form.selling?.stockUnit || 'piece'} onChange={(event) => nested('selling', 'stockUnit', event.target.value)}/></EditorField>
                <EditorField title="Pack / portion quantity"><input className={field} type="number" min="0" step="any" value={form.selling?.packQuantity ?? ''} onChange={(event) => nested('selling', 'packQuantity', event.target.value)}/></EditorField>
                <EditorField title="Pack / portion unit"><select className={field} value={form.selling?.packUnit || 'piece'} onChange={(event) => nested('selling', 'packUnit', event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></EditorField>
                <EditorField title="Minimum order quantity"><input className={field} type="number" min="1" step="1" value={form.selling?.minimumOrderQuantity ?? ''} onChange={(event) => nested('selling', 'minimumOrderQuantity', event.target.value)}/></EditorField>
                <EditorField title="Maximum order quantity (optional)"><input className={field} type="number" min="1" step="1" value={form.selling?.maximumOrderQuantity ?? ''} onChange={(event) => nested('selling', 'maximumOrderQuantity', event.target.value)}/></EditorField>
                {form.type === 'grocery' && <EditorField title="Barcode (optional)"><input className={field} value={form.selling?.barcode || ''} onChange={(event) => nested('selling', 'barcode', event.target.value)}/></EditorField>}
                {isRecipe && <EditorField title="Restaurant / kitchen outlet (if available)"><select className={field} value={form.selling?.outletId || ''} onChange={(event) => setForm((current) => ({ ...current, selling: { ...current.selling, outletId: event.target.value, menuId: '' } }))}><option value="">Select an existing outlet later</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name || outlet.outletCode}</option>)}</select></EditorField>}
                {isRecipe && <EditorField title="Restaurant menu (if available)"><select className={field} value={form.selling?.menuId || ''} onChange={(event) => nested('selling', 'menuId', event.target.value)}><option value="">No menu selected</option>{menus.filter((menu) => !form.selling?.outletId || menu.outletId === form.selling.outletId).map((menu) => <option key={menu.id} value={menu.id}>{menu.name || menu.menuCode}</option>)}</select></EditorField>}
                <EditorField title="Fulfilment"><select className={field} value={form.delivery?.fulfillment || 'delivery'} onChange={(event) => nested('delivery', 'fulfillment', event.target.value)}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></EditorField>
                <EditorField title="Preparation time (minutes)"><input type="number" min="0" className={field} value={form.delivery?.preparationMinutes ?? ''} onChange={(event) => nested('delivery', 'preparationMinutes', event.target.value)}/></EditorField>
              </div>
              {form.delivery?.fulfillment === 'delivery' && <EditorField title="Delivery pincodes (comma-separated)"><textarea rows={2} className={`${field} mt-3`} value={pincodeText} onChange={(event) => { setPincodeText(event.target.value); nested('delivery', 'postalCodes', event.target.value.split(/[\s,;]+/).filter(Boolean)) }} placeholder="110001, 110002"/></EditorField>}
              <EditorField title="Delivery / pickup notes"><textarea rows={2} className={`${field} mt-3`} value={form.delivery?.note || ''} onChange={(event) => nested('delivery', 'note', event.target.value)}/></EditorField>
            </section>}
            <section className={section}><h2 className="text-xl font-bold">Review & submit</h2>
              <p className="mt-2 text-sm text-[#4A5850]">All data is saved together in one draft. Submitted packets are locked until Super Admin requests changes. Super Admin will review this packet. Approval adds it to the curated public Host collection; marketplace sales remain subject to separate existing eligibility rules.</p>
              {locked && <p className="mt-3 font-semibold text-[#173F35]">This listing has been submitted and is read-only.</p>}
              <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy || uploading || locked} onClick={() => save(false)} className={styles.secondary}><Save size={17} className="mr-2 inline"/>Save full draft</button><button type="button" disabled={busy || uploading || locked} onClick={() => save(true)} className={styles.button}><Send size={17} className="mr-2 inline"/>Save & submit for review</button></div>
            </section>
          </fieldset>
        )}
        <section className="mt-6 border-t-2 border-[#173F35] pt-6"><h2 className="text-2xl font-bold">Your listing packets</h2>
          <p className="mt-1 text-sm text-[#4A5850]">Drafts and submissions created in this workspace. Existing Host Catalog, recipes, marketplace and Hospitality records remain available in their original pages.</p>
          <div className="mt-4 divide-y divide-[#D7DDCF] border-y border-[#D7DDCF]">{existing.length ? existing.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-semibold">{item.title || 'Untitled draft'}</p><p className="text-sm text-[#556358]">{item.type.replaceAll('_', ' ')} / {item.status.replaceAll('_', ' ')}</p></div><button type="button" className={styles.secondary} onClick={() => { setParams({ edit: item.id }); setActiveTab('single') }}>{['submitted_for_review', 'approved', 'rejected'].includes(item.status) ? 'View listing' : 'Continue editing'}</button></div>) : <p className="py-4 text-sm text-[#556358]">No unified listings yet.</p>}</div>
        </section>
        <p className="mt-6 text-sm text-[#556358]"><ClipboardList size={16} className="mr-1 inline"/>Non-food brand categories (cosmetics, clothes) are on hold pending senior approval.</p>
      </div>
    </main>
  )
}
