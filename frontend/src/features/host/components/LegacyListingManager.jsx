import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react'
import { searchHostListingIngredients } from '../services/hostUnifiedListing.service'
import { uploadRecipeImage } from '../../recipes/services/recipe.service'
import {
  getHostRecipeListing, updateHostRecipeListing, deleteHostRecipeListing, getHostBrandRecipeSubmission,
} from '../../hostOperations/services/hostOperations.service'
import {
  getHospitalityRestaurantRecipe, updateHospitalityRestaurantRecipe,
} from '../../hospitality/services/hospitality.service'
import {
  getHostNpiDraft, createHostNpiFromImages, uploadProductEvidenceBatch,
} from '../../universalProduct/services/universalProduct.service'

const input = 'w-full min-w-0 rounded-lg border border-[#CBD4C8] bg-white px-3 py-2.5 text-[15px] text-[#202421] focus-visible:outline-[#C86C42]'
const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#173F35] px-4 py-2 text-[15px] font-semibold text-white disabled:opacity-50'
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9BAE9D] px-4 py-2 text-[15px] font-semibold text-[#173F35] disabled:opacity-50'
const field = (name, control) => <label className="block min-w-0 space-y-1.5"><span className="block text-sm font-semibold">{name}</span>{control}</label>
const errorText = (error) => error?.response?.data?.message || error?.message || 'Unable to save your changes.'
const createRow = () => ({ canonicalIngredientId: '', name: '', quantity: 1, unit: 'g', role: 'main', preparationState: '' })
const createStep = () => ({ instruction: '', timerMinutes: '' })
const asArray = (value) => Array.isArray(value) ? value : []
const validId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ''))
const numerical = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

// Keep all source-only fields in memory so updating one value never silently
// strips approved recipe steps, ingredient restrictions or operational costs.
function unpackRecipe(result, source) {
  const recipe = result?.recipe || {}
  const version = recipe.recipeVersion || {}
  const dish = recipe.dish || {}
  const operational = result?.operationalRecipe || {}
  const opByIngredient = new Map(asArray(operational.ingredients).map((row) => [String(row.canonicalIngredientId), row]))
  return {
    outletId: result?.listing?.outletId || '',
    customerVisibility: result?.listing?.customerVisibility || 'public_candidate',
    title: version.title || dish.name || '',
    description: version.description || dish.description || '',
    cuisine: dish.cuisine || '', course: dish.course || '', heroImageUrl: dish.heroImageUrl || '',
    baseServings: numerical(version.baseServings, 4), preparationTimeMinutes: numerical(version.preparationTimeMinutes),
    cookingTimeMinutes: numerical(version.cookingTimeMinutes), difficulty: version.difficulty || 'easy',
    kitchenNote: operational.changeReason || '',
    ingredients: asArray(recipe.ingredients).map((row) => {
      const ops = opByIngredient.get(String(row.canonicalIngredientId)) || {}
      return {
        ...row,
        canonicalIngredientId: String(row.canonicalIngredientId || ''),
        name: row.canonicalIngredient?.canonicalName || row.proposedIngredientName || '',
        quantity: numerical(row.quantity, 1),
        unit: row.unit || 'g', role: row.role || 'main', preparationState: row.preparationState || '',
        expectedWastePercentage: numerical(ops.expectedWastePercentage),
        preferredSupplierProductId: ops.preferredSupplierProductId || '',
        operationalNote: ops.notes || '',
      }
    }),
    steps: asArray(recipe.steps).map((step) => ({
      ...step, instruction: step.instruction || '',
      timerMinutes: step.timerSeconds === null || step.timerSeconds === undefined ? '' : numerical(step.timerSeconds) / 60,
    })),
    // Hold the canonical detail untouched; edit only fields explicitly exposed below.
    source: { recipe, version, dish, operational, foodIntelligence: result?.foodIntelligence?.latest?.declaration || result?.foodIntelligence?.latestApproved?.declaration || null },
    sourceKind: source,
  }
}
function serializeRecipe(form, source) {
  const original = form.source || {}
  const base = original.version || {}
  const dish = original.dish || {}
  const ingredients = form.ingredients.map((row, index) => ({
    lineNumber: index + 1,
    canonicalIngredientId: row.canonicalIngredientId || '',
    proposedIngredientName: row.canonicalIngredientId ? '' : (row.name || '').trim(),
    quantity: numerical(row.quantity), unit: row.unit,
    preparationState: (row.preparationState || '').trim(),
    optional: Boolean(row.optional), role: row.role || 'main', notes: row.notes || '',
    substitutionGroupKey: row.substitutionGroupKey || '',
    productConstraints: asArray(row.productConstraints),
    scalingRule: row.scalingRule || { type: 'linear', exponent: 1, minMultiplier: null, maxMultiplier: null },
  }))
  const steps = form.steps.map((row, index) => ({
    stepNumber: index + 1, instruction: (row.instruction || '').trim(),
    timerSeconds: row.timerMinutes === '' ? null : Math.round(numerical(row.timerMinutes) * 60),
    temperatureValue: row.temperatureValue ?? null, temperatureUnit: row.temperatureUnit ?? null,
    equipment: asArray(row.equipment), parallelizable: Boolean(row.parallelizable), prepAhead: Boolean(row.prepAhead),
  }))
  const payload = {
    name: form.title.trim(), title: form.title.trim(),
    description: form.description.trim(), recipeDescription: form.description.trim(),
    cuisine: form.cuisine.trim(), course: form.course.trim(),
    tags: asArray(dish.tags).length ? dish.tags : source === 'restaurant-recipe' ? ['restaurant-recipe'] : ['host-recipe'],
    language: dish.language || 'en', heroImageUrl: form.heroImageUrl.trim(),
    baseServings: numerical(form.baseServings, 4),
    servingSizeAmount: base.servingSizeAmount ?? null, servingSizeUnit: base.servingSizeUnit ?? null,
    finishedYieldAmount: base.finishedYieldAmount ?? null, finishedYieldUnit: base.finishedYieldUnit ?? null,
    scalingMethod: base.scalingMethod || 'linear',
    minRecommendedServings: base.minRecommendedServings ?? null, maxRecommendedServings: base.maxRecommendedServings ?? null,
    preparationTimeMinutes: numerical(form.preparationTimeMinutes), cookingTimeMinutes: numerical(form.cookingTimeMinutes),
    difficulty: form.difficulty, unsafeIncomplete: Boolean(base.unsafeIncomplete),
    unsafeIncompleteReason: base.unsafeIncompleteReason || '', ingredients, steps,
    substitutions: asArray(original.recipe?.substitutions),
  }
  if (original.foodIntelligence) {
    const declaration = original.foodIntelligence
    payload.foodIntelligence = {
      jurisdictionCode: declaration.jurisdictionCode || 'IN',
      nutrition: asArray(declaration.nutrition), allergens: asArray(declaration.allergens),
      dietaryClassification: declaration.dietaryClassification || 'not_declared',
      basis: declaration.basis || 'Per serving, Host declaration',
      reason: declaration.reason || 'Existing reviewed recipe declaration retained during update.',
    }
  }
  if (source !== 'restaurant-recipe') return payload
  return {
    outletId: form.outletId, customerVisibility: form.customerVisibility,
    kitchenNote: form.kitchenNote,
    operationalIngredients: form.ingredients.map((row) => ({
      canonicalIngredientId: row.canonicalIngredientId,
      expectedWastePercentage: numerical(row.expectedWastePercentage),
      preferredSupplierProductId: row.preferredSupplierProductId || null,
      note: row.operationalNote || '',
    })),
    recipe: payload,
  }
}

function IngredientPicker({ value, onChange }) {
  const [matches, setMatches] = useState([])
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if ((value.name || '').trim().length < 2 || value.canonicalIngredientId) { setMatches([]); return undefined }
    let live = true
    const timer = setTimeout(async () => {
      setPending(true)
      try {
        const response = await searchHostListingIngredients({ search: value.name, limit: 6 })
        if (live) setMatches(asArray(response?.ingredients))
      } catch { if (live) setMatches([]) }
      finally { if (live) setPending(false) }
    }, 250)
    return () => { live = false; clearTimeout(timer) }
  }, [value.name, value.canonicalIngredientId])
  return <div className="relative">
    <input className={input} value={value.name} onChange={(e) => onChange({ name: e.target.value, canonicalIngredientId: '' })} aria-label="Ingredient name" placeholder="Find an ingredient"/>
    {value.canonicalIngredientId && <p className="text-sm text-[#24714D]">Matched ingredient</p>}
    {pending && <p className="text-sm text-[#526353]">Searching…</p>}
    {!!matches.length && <div className="absolute z-30 max-h-52 w-full overflow-auto rounded-lg border border-[#D4DED2] bg-white shadow-lg">
      {matches.map((item) => <button className="block w-full px-3 py-2 text-left hover:bg-[#E6F4ED]" type="button" key={item.id} onClick={() => { onChange({ name: item.canonicalName, canonicalIngredientId: item.id }); setMatches([]) }}>{item.canonicalName}</button>)}
    </div>}
  </div>
}

function RecipeEditor({ kind, id, onComplete }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [policy, setPolicy] = useState({})
  const isRestaurant = kind === 'restaurant-recipe'
  useEffect(() => {
    let live = true
    setLoading(true); setError(''); setNotice(''); setForm(null)
    const fetch = isRestaurant ? getHospitalityRestaurantRecipe : getHostRecipeListing
    fetch(id).then((result) => {
      if (!live) return
      setForm(unpackRecipe(result, kind))
      setPolicy(result.policy || { hostCanEdit: true })
    }).catch((cause) => { if (live) setError(errorText(cause)) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [id, kind, isRestaurant])
  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const changeRow = (key, index, changes) => setForm((prev) => ({ ...prev, [key]: prev[key].map((row, i) => i === index ? { ...row, ...changes } : row) }))
  const canSave = form && form.title.trim() && Number(form.baseServings) > 0 && form.ingredients.length > 0 && form.steps.length > 0 && form.ingredients.every((row) => Number(row.quantity) > 0 && (row.canonicalIngredientId || (!isRestaurant && row.name.trim()))) && form.steps.every((step) => step.instruction.trim()) && (!isRestaurant || form.outletId)
  async function save() {
    if (!canSave || saving || policy.hostCanEdit === false) return
    setSaving(true); setError(''); setNotice('')
    try {
      const payload = serializeRecipe(form, kind)
      const result = isRestaurant ? await updateHospitalityRestaurantRecipe(id, payload) : await updateHostRecipeListing(id, payload)
      setNotice('Changes saved and submitted for Super Admin review.')
      const nextId = isRestaurant ? (result?.recipe?.recipeVersion?.id || result?.listing?.id) : (result?.listing?.id || result?.recipe?.recipeVersion?.id)
      if (validId(nextId) && nextId !== id) {
        navigate(`/host/listings/new?manage=legacy&source=${kind}&id=${encodeURIComponent(nextId)}`, { replace: true })
      }
      onComplete?.(result)
    } catch (cause) { setError(errorText(cause)) }
    finally { setSaving(false) }
  }
  async function uploadPhoto(file) {
    if (!file || uploading) return
    setUploading(true); setError('')
    try { const result = await uploadRecipeImage({ file, scope: 'host' }); if (result?.heroImageUrl) patch('heroImageUrl', result.heroImageUrl) }
    catch (cause) { setError(errorText(cause)) }
    finally { setUploading(false) }
  }
  async function withdraw() {
    if (saving || isRestaurant || policy.hostCanDelete === false || !window.confirm('Withdraw this recipe? It will no longer be available for new customer discovery. Existing records and review history will be retained.')) return
    setSaving(true); setError('')
    try { await deleteHostRecipeListing(id); onComplete?.({ withdrawn: true }); setNotice('Recipe withdrawn. Its history has been preserved.') }
    catch (cause) { setError(errorText(cause)) }
    finally { setSaving(false) }
  }
  if (loading) return <p role="status">Loading recipe…</p>
  if (!form) return <p role="alert" className="text-red-700">{error || 'Recipe not found.'}</p>
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-2">
      {field('Recipe name', <input className={input} value={form.title} onChange={(e) => patch('title', e.target.value)} />)}
      {field('Cuisine', <input className={input} value={form.cuisine} onChange={(e) => patch('cuisine', e.target.value)} />)}
      {field('Description', <textarea rows={3} className={input} value={form.description} onChange={(e) => patch('description', e.target.value)} />)}
      {field('Recipe photo', <><input className={input} value={form.heroImageUrl} onChange={(e) => patch('heroImageUrl', e.target.value)} placeholder="Saved image URL"/><input className={`${input} mt-2`} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = '' }}/></>)}
      {field('Meal type', <input className={input} value={form.course} onChange={(e) => patch('course', e.target.value)} />)}
      {field('Difficulty', <select className={input} value={form.difficulty} onChange={(e) => patch('difficulty', e.target.value)}>{['easy','medium','hard'].map((value) => <option key={value} value={value}>{value}</option>)}</select>)}
      {field('Servings', <input className={input} type="number" min="1" value={form.baseServings} onChange={(e) => patch('baseServings', e.target.value)} />)}
      {field('Preparation minutes', <input className={input} type="number" min="0" value={form.preparationTimeMinutes} onChange={(e) => patch('preparationTimeMinutes', e.target.value)} />)}
      {field('Cooking minutes', <input className={input} type="number" min="0" value={form.cookingTimeMinutes} onChange={(e) => patch('cookingTimeMinutes', e.target.value)} />)}
    </div>
    <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">Ingredients</h3><button type="button" className={secondary} onClick={() => patch('ingredients', [...form.ingredients, createRow()])}><Plus size={16}/> Add ingredient</button></div>
      {form.ingredients.map((row, index) => <div key={index} className="grid gap-2 border-b border-[#D5DFD3] pb-3 sm:grid-cols-[minmax(0,2fr)_85px_90px_1fr_44px]">
        <IngredientPicker value={row} onChange={(changes) => changeRow('ingredients', index, changes)}/>
        <input className={input} type="number" min="0.001" step="any" aria-label="Quantity" value={row.quantity} onChange={(e) => changeRow('ingredients', index, { quantity: e.target.value })}/>
        <select className={input} aria-label="Unit" value={row.unit} onChange={(e) => changeRow('ingredients', index, { unit: e.target.value })}>{['mg','g','kg','ml','l','piece','tsp','tbsp','cup','slice','clove','bunch','pinch'].map((u) => <option key={u}>{u}</option>)}</select>
        <div className="min-w-0"><input className={input} aria-label="Preparation" placeholder="Preparation" value={row.preparationState} onChange={(e) => changeRow('ingredients', index, { preparationState: e.target.value })}/><select className={`${input} mt-2`} aria-label="Ingredient role" value={row.role} onChange={(e) => changeRow('ingredients', index, { role: e.target.value })}>{['main','base','seasoning','garnish','liquid','fat','binder','leavening','sauce','other'].map((value) => <option key={value}>{value}</option>)}</select></div>
        <button type="button" className={secondary} aria-label="Remove ingredient" disabled={form.ingredients.length === 1} onClick={() => patch('ingredients', form.ingredients.filter((_, i) => i !== index))}><X size={16}/></button>
      </div>)}
    </section>
    <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">Preparation steps</h3><button type="button" className={secondary} onClick={() => patch('steps', [...form.steps, createStep()])}><Plus size={16}/> Add step</button></div>
      {form.steps.map((step, index) => <div key={index} className="flex gap-2"><textarea className={input} rows={2} aria-label={`Step ${index+1}`} value={step.instruction} onChange={(e) => changeRow('steps', index, { instruction: e.target.value })}/><input className={`${input} max-w-24`} type="number" min="0" aria-label="Step minutes" placeholder="Minutes" value={step.timerMinutes} onChange={(e) => changeRow('steps', index, { timerMinutes: e.target.value })}/><button type="button" className={secondary} aria-label="Remove step" disabled={form.steps.length === 1} onClick={() => patch('steps', form.steps.filter((_, i) => i !== index))}><X size={16}/></button></div>)}
    </section>
    {isRestaurant && <p className="text-sm text-[#526353]">The existing restaurant outlet and preparation-cost settings remain unchanged.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-[#196145]">{notice}</p>}
    <div className="flex flex-wrap gap-3"><button type="button" disabled={!canSave || saving || uploading || policy.hostCanEdit === false} className={action} onClick={save}><Save size={16}/> {saving ? 'Saving…' : 'Save changes for review'}</button>
      {!isRestaurant && policy.hostCanDelete !== false && <button type="button" className={secondary} disabled={saving} onClick={withdraw}><Trash2 size={16}/> Withdraw recipe</button>}
    </div>
  </div>
}

function ProductEvidenceManager({ id }) {
  const [detail, setDetail] = useState(null)
  const [files, setFiles] = useState([])
  const [purpose, setPurpose] = useState('front_pack')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { const result = await getHostNpiDraft(id); setDetail(result) }
  useEffect(() => { let live = true; getHostNpiDraft(id).then((data) => { if (live) setDetail(data) }).catch((e) => { if (live) setError(errorText(e)) }); return () => { live = false } }, [id])
  async function addEvidence() {
    if (busy || !files.length || !detail?.draft) return
    setBusy(true); setError(''); setNotice('')
    try {
      const assets = await uploadProductEvidenceBatch({ evidenceFiles: files.map((file) => ({ purpose: detail.draft.listingType === 'packaged' ? purpose : 'front_pack', file })), scope: 'host' })
      await createHostNpiFromImages({ draftId: id, assets, market: detail.draft.market || 'IN', hints: {} })
      await refresh(); setFiles([]); setNotice('Product evidence saved for review.')
    } catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }
  async function recheck() {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await createHostNpiFromImages({ draftId: id, assets: [], market: detail?.draft?.market || 'IN', hints: {} }); await refresh(); setNotice('Product review status refreshed.') }
    catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }
  return <div className="space-y-4">
    {detail?.draft ? <><p className="text-base"><strong>Product:</strong> {detail.draft.candidateFields?.displayName?.value || detail.draft.candidateFields?.productName?.value || detail.draft.title || 'Saved product'}</p>
      <p className="text-sm text-[#526353]">Review status: {String(detail.draft.status || 'saved').replace(/_/g,' ')}</p>
      <p className="text-sm text-[#526353]">Product identity and approved claims are kept under Super Admin review. Existing records are not overwritten.</p>
      {detail.draft.listingType === 'packaged' && field('Photo type', <select className={input} value={purpose} onChange={(e) => setPurpose(e.target.value)}>{[['front_pack','Front of pack'],['ingredient_panel','Ingredients panel'],['allergen_statement','Allergen statement'],['nutrition_panel','Nutrition panel'],['barcode','Barcode'],['back_pack','Back / manufacturer panel'],['certification_mark','Certification mark'],['other','Other panel']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>)}
      <label className="block space-y-2"><span className="font-semibold">Add product or packaging photos</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple className={input} onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))}/></label>
      <div className="flex flex-wrap gap-2"><button type="button" className={action} disabled={!files.length || busy} onClick={addEvidence}><ImagePlus size={17}/> Add evidence</button><button type="button" className={secondary} disabled={busy || !detail?.draft} onClick={recheck}>Recheck saved evidence</button></div>
    </> : <p role="status">Loading existing product…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status" className="text-[#196145]">{notice}</p>}
  </div>
}

function BrandSubmissionView({ id }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    getHostBrandRecipeSubmission(id).then((value) => { if (live) setDetail(value) }).catch((cause) => { if (live) setError(errorText(cause)) })
    return () => { live = false }
  }, [id])
  if (error) return <p role="alert" className="text-red-700">{error}</p>
  if (!detail) return <p role="status">Loading recipe submission…</p>
  const recipe = detail.recipe || {}
  const submission = detail.submission || {}
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold">{recipe.recipeVersion?.title || recipe.dish?.name || 'Brand recipe'}</h2>
    <p>Review status: {String(submission.status || 'submitted').replace(/_/g, ' ')}</p>
    {submission.reviewReason && <p className="text-[#835137]">Review note: {submission.reviewReason}</p>}
    <p className="text-[15px] text-[#526353]">This brand submission has its own approval and version history. A new recipe submission is required for content changes; the existing version will not be overwritten.</p>
    <Link className={secondary} to="/host/listings/new?type=brand_recipe">Create an updated brand recipe</Link>
  </section>
}

export default function LegacyListingManager() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const kind = params.get('source') || ''
  const id = params.get('id') || ''

  if (!validId(id) || !['host-recipe','restaurant-recipe','product-evidence','brand-recipe'].includes(kind)) return <p role="alert" className="p-6">This listing link is invalid.</p>
  return <main className="min-w-0 bg-[#F7F6F2] px-4 py-6 text-[#202421] sm:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <Link to="/host/listings/new" className="inline-flex items-center gap-2 font-semibold text-[#173F35]"><ArrowLeft size={18}/> Back to listings</Link>
      <h1 className="text-2xl font-bold text-[#173F35]">Manage existing {kind === 'product-evidence' ? 'product' : 'recipe'}</h1>
      {kind === 'product-evidence' && <ProductEvidenceManager id={id}/>}
      {(kind === 'host-recipe' || kind === 'restaurant-recipe') && <RecipeEditor kind={kind} id={id} onComplete={(data) => { if (data?.withdrawn) navigate('/host/listings/new', { replace: true }) }}/>} 
      {kind === 'brand-recipe' && <BrandSubmissionView id={id}/>}
      
    </div>
  </main>
}
