import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Trash2,
  Truck,
} from 'lucide-react'

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  createCommerceIdempotencyKey,
  createMarketplaceCart,
  getCommerceErrorMessage,
  getMarketplaceCart,
  mergeRecipeMarketplaceCart,
  optimizeBasket,
  updateDirectMarketplaceCartItem,
} from '../services/commerce.service'

import {
  getDefaultDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

import {
  useLocationStore,
} from '../../location/store/location.store'

import {
  createOutcomePlanIdempotencyKey,
  createRecipeOutcomePlan,
  getOutcomePlanErrorMessage,
} from '../../outcomes/services/outcomePlan.service'

import { attachRecipeCart, getCookingReturnPath } from '../../recipes/utils/cookingJourney'
import { getCatalogProducts } from '../../grocery/services/catalog.service'

const RECIPE_CART_PENDING_KEY =
  'epantry-pending-recipe-cart'

const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

const RECIPE_CHECKOUT_CART_KEY =
  'epantry-recipe-checkout-cart'

const RECIPE_PENDING_MERGE_KEY =
  'epantry-recipe-pending-merge'

function notifyFloatingCartUpdated() {
  window.dispatchEvent(
    new CustomEvent(
      'epantry-cart-updated',
      {
        detail: {
          show: true,
        },
      },
    ),
  )
}

function saveFloatingMarketplaceCart({
  cartId,
  items,
  pincode = '',
  fulfillmentType = 'delivery',
}) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        pincode,
        fulfillmentType,
        updatedAt:
          new Date().toISOString(),
      }),
    )
    window.sessionStorage.removeItem(
      'epantry-floating-cart-hidden',
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }
}

function readFloatingMarketplaceCart() {
  try {
    const raw = window.sessionStorage.getItem(
      FLOATING_MARKETPLACE_CART_KEY,
    )
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.cartId && Array.isArray(parsed?.items)
      ? parsed
      : null
  } catch {
    return null
  }
}

function mapDirectCartItems(data) {
  return (Array.isArray(data?.items) ? data.items : []).map((item) => ({
    id: item.id || item.packId || item.displayName,
    packId: item.packId || '',
    offerId: item.offerId || '',
    organizationId: item.organizationId || '',
    sellerName: item.sellerName || 'Marketplace Host',
    name: item.displayName || 'Product',
    quantity: Number(item.packCount || 1),
  }))
}

function readRecipeCart() {
  try {
    const raw =
      window.sessionStorage.getItem(
        RECIPE_CART_PENDING_KEY,
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw)

    if (
      Array.isArray(
        parsed?.items,
      )
    ) {
      return parsed
    }

    const ingredientIds =
      Array.isArray(
        parsed?.ingredientIds,
      )
        ? parsed.ingredientIds
        : []

    const displayNames =
      Array.isArray(
        parsed?.displayNames,
      )
        ? parsed.displayNames
        : []

    if (
      ingredientIds.length >
      0
    ) {
      return {
        ...parsed,
        items:
          ingredientIds.map(
            (canonicalIngredientId, index) => ({
              canonicalIngredientId,
              name:
                displayNames[index] ||
                'Ingredient',
              quantity:
                null,
              unit:
                '',
            }),
          ),
      }
    }

    return parsed
  } catch {
    return null
  }
}

function clearRecipeCart() {
  try {
    window.sessionStorage.removeItem(
      RECIPE_CART_PENDING_KEY,
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }
}

function writeRecipeCart(
  cart,
) {
  try {
    if (
      !cart ||
      !Array.isArray(cart.items) ||
      cart.items.length === 0
    ) {
      window.sessionStorage.removeItem(
        RECIPE_CART_PENDING_KEY,
      )
      return
    }

    window.sessionStorage.setItem(
      RECIPE_CART_PENDING_KEY,
      JSON.stringify(cart),
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }
}

function formatRecipeQuantity(
  item,
) {
  const quantity =
    item?.quantity

  const unit =
    String(
      item?.unit ||
        '',
    ).trim()

  if (
    quantity ===
      null ||
    quantity ===
      undefined ||
    quantity ===
      ''
  ) {
    return 'Selected ingredient'
  }

  return `${quantity}${unit ? ` ${unit}` : ''}`
}

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isInteger(
      Number(
        amountMinor,
      ),
    )
  ) {
    return 'Not available'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )
}


// Display public catalog images without placing external media URLs in cart storage.
function basketImageUrl(record) {
  const candidates = [
    record?.imageUrl,
    record?.thumbnailUrl,
    record?.photoUrl,
    typeof record?.image === 'string' ? record.image : record?.image?.url,
    record?.images?.[0]?.url,
    record?.photos?.[0]?.url,
    record?.media?.[0]?.url,
  ]
  return candidates.find((url) =>
    typeof url === 'string' && (/^https?:\/\//i.test(url) || url.startsWith('/')),
  ) || ''
}

function basketImageLookupKey(item) {
  return String(item?.productVersionId || item?.packId || item?.id || item?.displayName || item?.name || '').trim()
}

function basketItemCount(item) {
  return Math.max(1, Math.floor(Number(item?.packCount ?? item?.quantity ?? 1) || 1))
}

// All choices are server-issued quote matches for the selected delivery PIN.
function recipePackGroups(quoteData) {
  return Object.entries(quoteData?.candidatesByRequirement || {}).map(([id, candidates]) => {
    const exact = candidates.find(candidate => candidate.packCount === 1 &&
      Math.abs(candidate.packQuantityInRequirementUnit - candidate.requirementQuantity) < 0.0000005)
    const suggested = exact || candidates[0]
    return { id, candidates, exact, suggested }
  }).filter(group => group.suggested)
}

function findSavedRecipePack(candidates, saved, normalizedPincode) {
  if (!saved) return undefined
  return candidates.find(row =>
              String(row.offerId) === String(saved.offerId) && String(row.packId) === String(saved.packId) &&
              String(row.productVersionId) === String(saved.productVersionId) &&
              row.packQuantity === saved.packQuantity && row.packUnit === saved.packUnit &&
              row.requirementQuantity === saved.requirementQuantity && row.requirementUnit === saved.requirementUnit &&
              row.unitPrice?.amountMinor === saved.unitPrice?.amountMinor && row.unitPrice?.currency === saved.unitPrice?.currency &&
              Number.isSafeInteger(saved.packCount) && saved.packCount >= row.packCount && saved.packCount <= row.maximumPackCount &&
              saved.pincode === normalizedPincode)
}

function RecipePackPicker({ groups, pincode, onFinish }) {
  const dialogRef = useRef(null)
  const [choices, setChoices] = useState(() => Object.fromEntries(groups.map(group => [group.id, {
    productMatchId: group.suggested.id, packCount: group.initialCount ?? group.suggested.packCount,
  }])))
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  const selected = groups.map(group => {
    const choice = choices[group.id]
    const candidate = group.candidates.find(row => row.id === choice.productMatchId)
    return { ...choice, candidate }
  })
  const valid = selected.every(({ candidate, packCount }) => candidate && packCount >= candidate.packCount && packCount <= candidate.maximumPackCount)
  const currency = selected[0]?.candidate?.unitPrice?.currency || 'INR'
  const sameCurrency = selected.every(row => (row.candidate?.unitPrice?.currency || 'INR') === currency)
  const subtotal = selected.reduce((total, row) => total + row.packCount * (row.candidate?.unitPrice?.amountMinor || 0), 0)
  function change(groupId, candidate, count) {
    setChoices(current => ({ ...current, [groupId]: { productMatchId: candidate.id, packCount: count } }))
  }
  const round = value => Math.round(value * 1000000) / 1000000
  return (
    <dialog ref={dialogRef} aria-labelledby="recipe-pack-heading" onCancel={event => { event.preventDefault(); onFinish(null) }}
      style={{ position:'fixed', inset:0, margin:'auto', width:'min(720px, calc(100% - 24px))', maxHeight:'88dvh', border:'1px solid #D7DDCF', borderRadius:16, background:'#F7F6F2', color:'#202421', padding:0, overflow:'hidden', boxShadow:'0 24px 80px #20242155' }}>
      <style>{`dialog[aria-labelledby="recipe-pack-heading"]::backdrop { background: #20242199; }`}</style>
      <div style={{display:'flex', flexDirection:'column', maxHeight:'88dvh'}}>
        <header style={{background:'#C56C42', color:'#202421', padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
          <div><h2 id="recipe-pack-heading" style={{fontSize:24, fontWeight:750, color:'#202421', margin:0}}>Choose ingredient packs</h2><p style={{fontSize:14, color:'#202421', marginTop:4}}>Available for delivery to PIN {pincode}</p></div>
          <button type="button" onClick={() => onFinish(null)} aria-label="Close pack selection" style={{background:'#F7F6F2', color:'#202421', borderRadius:8, width:40, height:40, fontSize:24, flexShrink:0}}>×</button>
        </header>
        <div style={{overflowY:'auto', padding:'4px 20px 16px'}}>
          {groups.map(group => {
            const choice = choices[group.id]
            const chosen = group.candidates.find(row => row.id === choice.productMatchId)
            const supplied = round(chosen.packQuantityInRequirementUnit * choice.packCount)
            const surplus = round(supplied - chosen.requirementQuantity)
            return <section key={group.id} style={{padding:'18px 0', borderBottom:'1px solid #D7DDCF'}}>
              <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12}}><h3 style={{fontSize:19,fontWeight:700,color:'#202421'}}>{chosen.requirementLabel || 'Ingredient'}</h3><strong style={{color:'#173F35'}}>Need {chosen.requirementQuantity} {chosen.requirementUnit}</strong></div>
              {group.savedChanged && <p role="status" style={{color:'#8F3226',marginBottom:10}}>Availability, price or delivery PIN changed. Please choose packs again.</p>}
              {group.exact && !group.allowChoice ? <p style={{background:'#D7DDCF',padding:12,borderRadius:8,color:'#173F35',fontWeight:600}}>Exact pack selected: {group.exact.packQuantity} {group.exact.packUnit} · {group.exact.sellerName} · {formatMoney(group.exact.unitPrice.amountMinor, group.exact.unitPrice.currency)}</p> :
                <div style={{display:'grid',gap:8}}>{group.candidates.map(candidate => {
                  const active = choice.productMatchId === candidate.id
                  return <div key={candidate.id} style={{border:active?'2px solid #C56C42':'1px solid #D7DDCF', background:active?'#C56C421A':'#F7F6F2',borderRadius:9,padding:12}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',color:'#202421'}}><input type="radio" name={`recipe-pack-${group.id}`} checked={active} onChange={() => change(group.id,candidate,candidate.packCount)} style={{accentColor:'#173F35'}}/><div style={{flex:1,minWidth:0}}><strong style={{fontSize:17,color:'#202421'}}>{candidate.packQuantity} {candidate.packUnit} pack</strong><p style={{fontSize:14,color:'#173F35',overflowWrap:'anywhere'}}>{candidate.productDisplayName ? `${candidate.productDisplayName} · ` : ''}{candidate.sellerName} · {candidate.maximumPackCount} max orderable</p></div><strong style={{color:'#173F35',whiteSpace:'nowrap'}}>{formatMoney(candidate.unitPrice.amountMinor,candidate.unitPrice.currency)} / pack</strong></label>
                    {active && <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginTop:12,paddingLeft:24}}><div style={{display:'flex',alignItems:'center',gap:12}}><button type="button" aria-label="Decrease pack quantity" disabled={choice.packCount <= 1} onClick={() => change(group.id,candidate,choice.packCount-1)} style={{border:'1px solid #D7DDCF',background:'#F7F6F2',color:'#173F35',width:38,height:38,borderRadius:8,opacity:choice.packCount <= 1 ? 0.45 : 1}}><Minus size={16} style={{margin:'auto'}}/></button><output style={{fontWeight:700,minWidth:24,textAlign:'center'}}>{choice.packCount}</output><button type="button" aria-label="Increase pack quantity" disabled={choice.packCount >= candidate.maximumPackCount} onClick={() => change(group.id,candidate,choice.packCount+1)} style={{border:'1px solid #D7DDCF',background:'#F7F6F2',color:'#173F35',width:38,height:38,borderRadius:8,opacity:choice.packCount >= candidate.maximumPackCount ? 0.45 : 1}}><Plus size={16} style={{margin:'auto'}}/></button></div><strong style={{color:'#202421'}}>{formatMoney(choice.packCount*candidate.unitPrice.amountMinor,candidate.unitPrice.currency)}</strong></div>}
                  </div>
                })}</div>}
              <p aria-live="polite" style={{marginTop:10,fontSize:14,color:surplus<0?'#8F3226':'#173F35'}}>Selected: {supplied} {chosen.requirementUnit}{surplus>0?` · ${surplus} ${chosen.requirementUnit} extra`:surplus<0?` · ${Math.abs(surplus)} ${chosen.requirementUnit} still needed`:' · exact quantity'}{choice.packCount<chosen.packCount?' · Increase packs to meet the minimum requirement.':''}</p>
            </section>
          })}
        </div>
        <footer style={{background:'#D7DDCF',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
          <div><p style={{fontSize:14,color:'#173F35'}}>Items subtotal</p><strong style={{fontSize:22,color:'#202421'}}>{sameCurrency?formatMoney(subtotal,currency):'Mixed currencies'}</strong></div>
          <button type="button" disabled={!valid || !sameCurrency} onClick={() => onFinish(selected.map(({productMatchId,packCount}) => ({productMatchId,packCount})))} style={{background:'#C56C42',color:'#202421',fontWeight:750,padding:'12px 18px',borderRadius:8,opacity:valid&&sameCurrency?1:.5}}>Confirm packs &amp; continue</button>
        </footer>
      </div>
    </dialog>
  )
}

export default function MarketplaceCartPage() {
  const {
    cartId,
  } =
    useParams()

  const navigate =
    useNavigate()

  const location =
    useLocation()

  const isRecipeCart =
    cartId ===
    'recipe'

  const recipeCheckoutHandledRef =
    useRef(false)

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    recipeCart,
    setRecipeCart,
  ] =
    useState(
      () => readRecipeCart(),
    )

  // Recipe ingredients live in session state, while Grocery products belong to
  // an actual Marketplace Cart. Keep both sources visible and independently
  // mutable; never replace an existing direct cart with a recipe quote cart.
  const [
    grocerySnapshot,
    setGrocerySnapshot,
  ] = useState(() => readFloatingMarketplaceCart())

  const [
    groceryCartData,
    setGroceryCartData,
  ] = useState(null)

  const [
    groceryLoading,
    setGroceryLoading,
  ] = useState(false)

  const [
    groceryError,
    setGroceryError,
  ] = useState('')

  const [
    updatingGroceryItemId,
    setUpdatingGroceryItemId,
  ] = useState('')
  const [basketProductImages, setBasketProductImages] = useState({})

  const currentLocation = useLocationStore((state) => state.currentLocation)
  const detectedPincode = /^\d{6}$/.test(String(currentLocation?.postcode || '').trim())
    ? String(currentLocation.postcode).trim()
    : ''
  const [savedAddressPincode, setSavedAddressPincode] = useState('')
  const [manualRecipePincode, setManualRecipePincode] = useState(null)
  const [recipePincodeDraft, setRecipePincodeDraft] = useState('')
  const [recipePinEditorOpen, setRecipePinEditorOpen] = useState(false)
  const [recipePinError, setRecipePinError] = useState('')
  const [recipePinCoverage, setRecipePinCoverage] = useState({
    status: 'idle',
    pincode: '',
    unmatchedNames: [],
  })
  const recipeCheckSequence = useRef(0)
  const [packPicker, setPackPicker] = useState(null)
  const packPickerResolve = useRef(null)
  useEffect(() => () => {
    if (packPickerResolve.current) packPickerResolve.current(null)
    packPickerResolve.current = null
  }, [])
  const finishPackPicker = useCallback((selection) => {
    const resolve = packPickerResolve.current
    packPickerResolve.current = null
    setPackPicker(null)
    resolve?.(selection)
  }, [])


  const [
    placingRecipeOrder,
    setPlacingRecipeOrder,
  ] =
    useState(
      false,
    )

  const [
    recipeCoverageIssue,
    setRecipeCoverageIssue,
  ] =
    useState(
      null,
    )

  const [
    updatingCartItemId,
    setUpdatingCartItemId,
  ] =
    useState(
      '',
    )

  const loadCart =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (
          isRecipeCart
        ) {
          setRecipeCart(
            readRecipeCart(),
          )
          setLoading(false)
          setRefreshing(false)
          return
        }

        if (
          !cartId
        ) {
          setError(
            'Marketplace Cart ID is missing.',
          )

          setLoading(
            false,
          )

          return
        }

        if (
          refresh
        ) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(
            true,
          )
        }

        setError(
          '',
        )

        try {
          setData(
            await getMarketplaceCart(
              cartId,
            ),
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load this Marketplace Cart.',
            ),
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },
      [
        cartId,
        isRecipeCart,
      ],
    )

  useEffect(
    () => {
      loadCart()
      setRecipeCart(readRecipeCart())
    },
    [
      loadCart,
    ],
  )

  useEffect(
    () => {
      if (
        isRecipeCart ||
        !cartId
      ) {
        return undefined
      }

      const handleFloatingCartUpdated =
        () => {
          setRecipeCart(readRecipeCart())
          loadCart({
            refresh: true,
          })
        }

      window.addEventListener(
        'epantry-cart-updated',
        handleFloatingCartUpdated,
      )

      return () => {
        window.removeEventListener(
          'epantry-cart-updated',
          handleFloatingCartUpdated,
        )
      }
    },
    [
      cartId,
      isRecipeCart,
      loadCart,
    ],
  )

  useEffect(() => {
    if (!isRecipeCart) return undefined

    let alive = true
    const refreshGrocery = async () => {
      const snapshot = readFloatingMarketplaceCart()
      if (!alive) return
      setGrocerySnapshot(snapshot)
      setGroceryCartData(null)
      setGroceryError('')
      if (!snapshot?.cartId) {
        setGroceryLoading(false)
        return
      }

      setGroceryLoading(true)
      try {
        const response = await getMarketplaceCart(snapshot.cartId)
        if (alive) setGroceryCartData(response)
      } catch (loadError) {
        if (alive) {
          setGroceryError(getCommerceErrorMessage(
            loadError,
            'Grocery Cart could not be refreshed. Your saved items are still shown.',
          ))
        }
      } finally {
        if (alive) setGroceryLoading(false)
      }
    }

    void refreshGrocery()
    window.addEventListener('epantry-cart-updated', refreshGrocery)
    window.addEventListener('storage', refreshGrocery)
    return () => {
      alive = false
      window.removeEventListener('epantry-cart-updated', refreshGrocery)
      window.removeEventListener('storage', refreshGrocery)
    }
  }, [isRecipeCart])

  useEffect(() => {
    if (!isRecipeCart || detectedPincode) return undefined
    let cancelled = false
    getDefaultDeliveryAddress()
      .then((result) => {
        const value = String(result?.address?.postalCode || '').trim()
        if (!cancelled && /^\d{6}$/.test(value)) setSavedAddressPincode(value)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isRecipeCart, detectedPincode])

  // A live Grocery cart belongs in the same customer basket as Recipe items.
  // Keep unrelated/historic and prepared-restaurant carts on their own ID routes.
  useEffect(() => {
    if (isRecipeCart || data?.cart?.sourceType !== 'direct_product') return
    const activeGrocery = readFloatingMarketplaceCart()
    if (activeGrocery?.cartId && String(activeGrocery.cartId) === String(cartId)) {
      navigate('/cart/recipe', { replace: true })
    }
  }, [cartId, data?.cart?.sourceType, isRecipeCart, navigate])

  const sellerGroups =
    useMemo(
      () => {
        const groups =
          new Map()

        for (
          const item
          of data?.items ||
          []
        ) {
          const key =
            String(
              item.organizationId ||
                '',
            )

          if (
            !groups.has(
              key,
            )
          ) {
            groups.set(
              key,
              {
                organizationId:
                  item.organizationId,

                sellerName:
                  item.sellerName,

                items:
                  [],

                subtotalMinor:
                  0,
              },
            )
          }

          const group =
            groups.get(
              key,
            )

          group.items.push(
            item,
          )

          group.subtotalMinor +=
            Number(
              item.lineTotal?.amountMinor ||
                0,
            )
        }

        return [
          ...groups.values(),
        ]
      },
      [
        data?.items,
      ],
    )

  const recipeItems =
    Array.isArray(
      recipeCart?.items,
    )
      ? recipeCart.items
      : []

  const groceryItems = isRecipeCart
    ? (Array.isArray(groceryCartData?.items)
        ? groceryCartData.items
        : grocerySnapshot?.items || [])
    : []
  const groceryCartId = groceryCartData?.cart?.id || grocerySnapshot?.cartId || ''
  const totalBasketItems = recipeItems.length + groceryItems.length
  const groceryImageSignature = groceryItems.map((item) =>
    [basketImageLookupKey(item), item?.displayName || item?.name || ''].join(':'),
  ).join('|')

  // The Cart API supplies productVersionId, but does not currently serialize
  // thumbnails. Enrich against the PUBLIC catalog using that exact identity.
  // The catalog request is for decoration only; price/stock/cart mutations
  // continue to use the authoritative Commerce Cart API.
  useEffect(() => {
    if (!isRecipeCart || !groceryImageSignature) return undefined
    let active = true
    const eligible = groceryItems.filter((item) =>
      !basketImageUrl(item) && basketImageLookupKey(item) &&
      !basketProductImages[basketImageLookupKey(item)],
    )
    if (!eligible.length) return undefined

    const loadImages = async () => {
      const resolved = {}
      const unique = [...new Map(eligible.map((item) =>
        [basketImageLookupKey(item), item],
      )).values()]
      // Bounded parallel requests, with a strict product-version / pack match.
      for (let index = 0; index < unique.length; index += 4) {
        const batch = unique.slice(index, index + 4)
        const results = await Promise.all(batch.map(async (item) => {
          const name = String(item.displayName || item.name || '').trim()
          if (!name) return null
          try {
            const response = await getCatalogProducts({
              search: name,
              limit: 50,
            })
            const published = Array.isArray(response?.products) ? response.products : []
            const exact = published.find((product) =>
              (item?.productVersionId && String(product.productVersionId || product.id) === String(item.productVersionId)) ||
              (item?.packId && String(product.packId) === String(item.packId)),
            )
            const normalizedName = name.toLowerCase().replace(/\s+/g, ' ')
            const nameMatches = published.filter((product) =>
              String(product.displayName || '').trim().toLowerCase().replace(/\s+/g, ' ') === normalizedName,
            )
            const product = exact || (nameMatches.length === 1 ? nameMatches[0] : null)
            const imageUrl = basketImageUrl(product)
            return imageUrl ? [basketImageLookupKey(item), imageUrl] : null
          } catch {
            return null
          }
        }))
        results.filter(Boolean).forEach(([key, url]) => { resolved[key] = url })
      }
      if (active && Object.keys(resolved).length) {
        setBasketProductImages((current) => ({ ...current, ...resolved }))
      }
    }
    void loadImages()
    return () => { active = false }
    // The signature changes when the user adds a different product; image
    // fetch results do not trigger the fetch again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecipeCart, groceryImageSignature])
  const selectedRecipePincode = manualRecipePincode === null
    ? detectedPincode || savedAddressPincode
    : manualRecipePincode
  const recipeIngredientSignature = recipeItems
    .map((item) => String(item?.canonicalIngredientId || '').trim())
    .filter(Boolean)
    .sort()
    .join('|')

  // Use the same server-side Host-coverage optimizer as Recipe checkout.
  // It validates serviceable ZIP/PIN, current offers and inventory; a PIN
  // string match alone must never be treated as delivery availability.
  useEffect(() => {
    if (!isRecipeCart) return undefined
    const sequence = ++recipeCheckSequence.current
    const pin = selectedRecipePincode.trim()
    if (!/^\d{6}$/.test(pin) || !recipeCart?.slug || !recipeIngredientSignature) {
      setRecipePinCoverage({ status: 'idle', pincode: pin, unmatchedNames: [] })
      return undefined
    }

    let cancelled = false
    setRecipePinCoverage({ status: 'checking', pincode: pin, unmatchedNames: [] })
    const check = async () => {
      try {
        const selectedIds = [...new Set(recipeIngredientSignature.split('|'))]
        const outcome = await createRecipeOutcomePlan(recipeCart.slug, {
          targetServings: Number(recipeCart.servings || 1),
          purchaseMode: /(?:^host--[a-f0-9]{24}$|-[a-f0-9]{10}$)/i.test(String(recipeCart.slug || '')) ? 'full_recipe' : 'missing_only',
          selectedCanonicalIngredientIds: selectedIds,
          idempotencyKey: createOutcomePlanIdempotencyKey('recipe-pin-availability'),
        })
        if (!outcome?.plan?.id) throw new Error('Unable to resolve recipe ingredients.')
        const quoteData = await optimizeBasket({
          outcomePlanId: outcome.plan.id,
          pincode: pin,
          objective: 'best_value',
          fulfillmentType: 'delivery',
          idempotencyKey: createCommerceIdempotencyKey('recipe-pin-availability'),
        })
        if (cancelled || sequence !== recipeCheckSequence.current) return
        const preferred = quoteData?.quote?.recommendedOptionKey || 'best_value'
        const options = Array.isArray(quoteData?.options) ? quoteData.options : []
        const option = options.find((item) => item.optionKey === preferred)
          || options.find((item) => item.optionKey === 'best_value')
          || null
        const required = Number(option?.totalRequirementCount || 0)
        const matched = Number(option?.matchedRequirementCount || 0)
        const unmatchedIds = new Set(
          (quoteData?.unmatchedRequirementLineIds || []).map((id) => String(id)),
        )
        const unmatchedNames = [...new Set((outcome?.requirements || [])
          .filter((item) => unmatchedIds.has(String(item?.id || '')))
          .map((item) => String(item?.label || '').trim())
          .filter(Boolean))]
        setRecipePinCoverage({
          status: required > 0
            ? (option && matched === required ? 'available' : 'unavailable')
            : 'covered',
          pincode: pin,
          unmatchedNames,
        })
      } catch (checkError) {
        if (cancelled || sequence !== recipeCheckSequence.current) return
        setRecipePinCoverage({
          status: 'error',
          pincode: pin,
          unmatchedNames: [],
          message: getCommerceErrorMessage(checkError, 'Unable to check delivery right now.'),
        })
      }
    }
    void check()
    return () => { cancelled = true }
  }, [
    isRecipeCart,
    recipeCart?.slug,
    recipeCart?.servings,
    recipeIngredientSignature,
    selectedRecipePincode,
  ])

  function handleCheckRecipePincode(event) {
    event.preventDefault()
    const pin = recipePincodeDraft.replace(/\s/g, '')
    if (!/^\d{6}$/.test(pin)) {
      setRecipePinError('Enter a valid 6-digit PIN code.')
      return
    }
    setRecipePinError('')
    setManualRecipePincode(pin)
    setRecipePinEditorOpen(false)
    setRecipeCoverageIssue(null)
  }

  async function handleRemoveGroceryItem(item) {
    const itemId = String(item?.id || item?.packId || '').trim()
    if (!groceryCartId || !itemId || updatingGroceryItemId || groceryLoading || groceryError) return
    setUpdatingGroceryItemId(itemId)
    setError('')
    try {
      const result = await updateDirectMarketplaceCartItem({
        cartId: groceryCartId,
        itemId,
        operation: 'remove',
      })
      const items = mapDirectCartItems(result)
      setGroceryCartData(result)
      if (items.length) {
        saveFloatingMarketplaceCart({
          cartId: result?.cart?.id || groceryCartId,
          items,
          pincode: result?.cart?.pincode || grocerySnapshot?.pincode || '',
          fulfillmentType: result?.cart?.fulfillmentType || grocerySnapshot?.fulfillmentType || 'delivery',
        })
      } else {
        window.sessionStorage.removeItem(FLOATING_MARKETPLACE_CART_KEY)
      }
      notifyFloatingCartUpdated()
    } catch (removeError) {
      setError(getCommerceErrorMessage(removeError, 'Unable to remove this Grocery item.'))
    } finally {
      setUpdatingGroceryItemId('')
    }
  }

  async function handleChangeGroceryQuantity(item, adjustment) {
    const itemId = String(item?.id || item?.packId || '').trim()
    if (!groceryCartId || !itemId || updatingGroceryItemId || groceryLoading || groceryError ||
        groceryCartData?.cart?.sourceType !== 'direct_product') return
    const nextQuantity = basketItemCount(item) + adjustment
    if (nextQuantity < 1) return
    setUpdatingGroceryItemId(itemId)
    setError('')
    try {
      const result = await updateDirectMarketplaceCartItem({
        cartId: groceryCartId,
        itemId,
        operation: 'set_quantity',
        quantity: nextQuantity,
      })
      setGroceryCartData(result)
      const items = mapDirectCartItems(result)
      if (items.length) {
        saveFloatingMarketplaceCart({
          cartId: result?.cart?.id || groceryCartId,
          items,
          pincode: result?.cart?.pincode || grocerySnapshot?.pincode || '',
          fulfillmentType: result?.cart?.fulfillmentType || grocerySnapshot?.fulfillmentType || 'delivery',
        })
      } else {
        window.sessionStorage.removeItem(FLOATING_MARKETPLACE_CART_KEY)
      }
      notifyFloatingCartUpdated()
    } catch (updateError) {
      setError(getCommerceErrorMessage(updateError, 'Unable to change this quantity.'))
    } finally {
      setUpdatingGroceryItemId('')
    }
  }

  const finalizeRecipeOrder =
    useCallback(
      async (targetCartId = '') => {
        if (
          (!isRecipeCart && !targetCartId) ||
          placingRecipeOrder ||
          recipeItems.length ===
            0
        ) {
          return
        }

        setPlacingRecipeOrder(true)
        setError('')
        setRecipeCoverageIssue(null)

        try {
          const mergeIntoCartId = targetCartId || (isRecipeCart ? groceryCartId : '')
          // Do not merge the same pending recipe selection again after a
          // customer returns from an unfinished combined order.
          let previousCheckout = null
          try {
            previousCheckout = JSON.parse(window.sessionStorage.getItem(RECIPE_CHECKOUT_CART_KEY) || 'null')
          } catch {
            previousCheckout = null
          }
          if (
            mergeIntoCartId &&
            String(previousCheckout?.cartId || '') === String(mergeIntoCartId)
          ) {
            if (JSON.stringify(previousCheckout?.items || []) !== JSON.stringify(recipeItems)) {
              throw new Error('This order already contains an earlier recipe selection. Review or remove those priced items from your order before adding a changed recipe selection.')
            }
            navigate(`/checkout/${mergeIntoCartId}`)
            return
          }

          const addressResult =
            await getDefaultDeliveryAddress()

          const address =
            addressResult?.address ||
            null

          const normalizedPincode =
            String(
              address?.postalCode ||
                '',
            )
              .trim()
              .toUpperCase()

          if (mergeIntoCartId && !isRecipeCart &&
              String(data?.cart?.pincode || '') !== normalizedPincode) {
            throw new Error('Your saved delivery address must match this cart PIN. Please choose an address for the same PIN before placing the order.')
          }

          // Reuse a previously created quote cart if the merge response was
          // lost. The server also marks the source cart as merged exactly once.
          let pendingMerge = null
          try {
            pendingMerge = JSON.parse(window.sessionStorage.getItem(RECIPE_PENDING_MERGE_KEY) || 'null')
          } catch {
            pendingMerge = null
          }
          if (mergeIntoCartId && pendingMerge &&
              String(pendingMerge.cartId) === String(mergeIntoCartId) &&
              pendingMerge.pincode === normalizedPincode &&
              JSON.stringify(pendingMerge.items || []) === JSON.stringify(recipeItems) &&
              pendingMerge.recipeCartId) {
            const previouslyMerged = await mergeRecipeMarketplaceCart({
              cartId: mergeIntoCartId,
              recipeCartId: pendingMerge.recipeCartId,
            })
            const readyId = previouslyMerged?.cart?.id
            if (!readyId) throw new Error('Unable to confirm this combined order.')
            window.sessionStorage.setItem(RECIPE_CHECKOUT_CART_KEY,
              JSON.stringify({ cartId: readyId, items: recipeItems }))
            window.sessionStorage.removeItem(RECIPE_PENDING_MERGE_KEY)
            navigate(`/checkout/${readyId}`, { replace: true })
            return
          }

          if (
            !/^\d{6}$/.test(
              normalizedPincode,
            )
          ) {
            if (mergeIntoCartId) {
              navigate(`/delivery-addresses?returnTo=${encodeURIComponent(`/cart/${mergeIntoCartId}`)}`)
              return
            }
            throw new Error(
              'Your selected delivery address does not contain a valid 6-digit pincode. Please update the address and try again.',
            )
          }

          const selectedIngredientIds =
            [
              ...new Set(
                recipeItems
                  .map(
                    (item) =>
                      String(
                        item?.canonicalIngredientId ||
                          '',
                      ).trim(),
                  )
                  .filter(Boolean),
              ),
            ]

          if (
            selectedIngredientIds.length ===
            0
          ) {
            throw new Error(
              'This Recipe Cart does not contain Marketplace-matchable ingredients yet.',
            )
          }

          const outcome =
            await createRecipeOutcomePlan(
              recipeCart.slug,
              {
                targetServings:
                  Number(
                    recipeCart.servings ||
                      1,
                  ),

                purchaseMode:
                  /(?:^host--[a-f0-9]{24}$|-[a-f0-9]{10}$)/i.test(String(recipeCart.slug || '')) ? 'full_recipe' : 'missing_only',

                selectedCanonicalIngredientIds:
                  selectedIngredientIds,

                idempotencyKey:
                  createOutcomePlanIdempotencyKey(
                    'recipe-cart-place-order',
                  ),
              },
            )

          const planId =
            outcome?.plan?.id

          if (!planId) {
            throw new Error(
              'Recipe shopping plan identity was not returned.',
            )
          }

          const quoteData =
            await optimizeBasket({
              outcomePlanId:
                planId,

              pincode:
                normalizedPincode,

              objective:
                'best_value',

              fulfillmentType:
                'delivery',

              idempotencyKey:
                createCommerceIdempotencyKey(
                  'recipe-cart-place-order-compare',
                ),
            })

          const preferredOptionKey =
            quoteData?.quote
              ?.recommendedOptionKey ||
            'best_value'

          const selectedOption =
            (
              quoteData?.options ||
              []
            ).find(
              (option) =>
                option.optionKey ===
                preferredOptionKey,
            ) ||
            (
              quoteData?.options ||
              []
            ).find(
              (option) =>
                option.optionKey ===
                'best_value',
            ) ||
            null

          const totalRequirementCount =
            Number(
              selectedOption
                ?.totalRequirementCount ||
                0,
            )

          const matchedRequirementCount =
            Number(
              selectedOption
                ?.matchedRequirementCount ||
                0,
            )

          const hasFullCoverage =
            totalRequirementCount >
              0 &&
            matchedRequirementCount ===
              totalRequirementCount

          if (totalRequirementCount === 0) {
            setRecipeCoverageIssue(null)
            setError('Your confirmed Pantry now covers these ingredients. No purchase is needed. Return to your recipe or update your basket if you want other items.')
            return
          }

          if (
            !selectedOption ||
            !hasFullCoverage
          ) {
            const unmatchedLineIds =
              new Set(
                (
                  quoteData
                    ?.unmatchedRequirementLineIds ||
                  []
                ).map(
                  (value) =>
                    String(
                      value || '',
                    ),
                ),
              )

            const unmatchedRequirements =
              (
                outcome?.requirements ||
                []
              ).filter(
                (requirement) =>
                  unmatchedLineIds.has(
                    String(
                      requirement?.id ||
                        '',
                    ),
                  ),
              )

            const unmatchedCanonicalIngredientIds =
              [
                ...new Set(
                  unmatchedRequirements
                    .map(
                      (requirement) =>
                        String(
                          requirement
                            ?.canonicalIngredientId ||
                            '',
                        ),
                    )
                    .filter(Boolean),
                ),
              ]

            const unmatchedNames =
              [
                ...new Set(
                  unmatchedRequirements
                    .map(
                      (requirement) =>
                        String(
                          requirement?.label ||
                            '',
                        ).trim(),
                    )
                    .filter(Boolean),
                ),
              ]

            if (
              unmatchedNames.length ===
                0
            ) {
              for (
                const item
                of recipeItems
              ) {
                if (
                  unmatchedCanonicalIngredientIds.includes(
                    String(
                      item?.canonicalIngredientId ||
                        '',
                    ),
                  )
                ) {
                  unmatchedNames.push(
                    item?.name ||
                      'Recipe ingredient',
                  )
                }
              }
            }

            setRecipeCoverageIssue({
              pincode:
                normalizedPincode,
              matchedRequirementCount,
              totalRequirementCount,
              unmatchedCanonicalIngredientIds,
              unmatchedNames,
            })

            if (!isRecipeCart) {
              setError(`One order cannot be prepared yet. ${unmatchedNames.length ? `${unmatchedNames.join(', ')} ${unmatchedNames.length === 1 ? 'is' : 'are'} unavailable or unpriced for PIN ${normalizedPincode}.` : 'Some recipe ingredients do not have an available Host offer and verified price.'} Please update the items or delivery PIN before continuing.`)
            }
            return
          }

          const groups = recipePackGroups(quoteData)
          if (groups.length !== totalRequirementCount) throw new Error('Pack options are incomplete. Refresh delivery availability and try again.')
          // Match a customer's saved offer to a fresh server-issued quote. Quote match
          // IDs change on each quote, so never reuse the old match ID or client price.
          for (const group of groups) {
            const canonicalId = String(group.suggested.canonicalIngredientId || '')
            const saved = recipeItems.find(item => String(item.canonicalIngredientId) === canonicalId)?.packSelection
            if (!saved) continue
            group.allowChoice = true
            const same = findSavedRecipePack(group.candidates, saved, normalizedPincode)
            if (same) { group.suggested = same; group.initialCount = saved.packCount; group.savedValid = true }
            else { group.savedChanged = true; group.exact = null }
          }
          let packSelections = groups.map(group => ({ productMatchId: group.suggested.id, packCount: group.initialCount ?? group.suggested.packCount }))
          if (groups.some(group => group.savedChanged || (!group.savedValid && !group.exact))) {
            packSelections = await new Promise(resolve => {
              packPickerResolve.current = resolve
              setPackPicker({ groups, pincode: normalizedPincode })
            })
            if (!packSelections) return
          }
          const cartResult =
            await createMarketplaceCart({
              packSelections,
              basketQuoteId:
                quoteData.quote.id,

              optionKey:
                selectedOption.optionKey,

              idempotencyKey:
                createCommerceIdempotencyKey(
                  'recipe-marketplace-cart',
                ),
            })

          const marketplaceCartId =
            cartResult?.cart?.id

          if (!marketplaceCartId) {
            throw new Error(
              'Marketplace Cart identity was not returned.',
            )
          }

          // Merge the server-priced Recipe Cart into the existing Grocery/
          // Brand cart. Only ONE Marketplace Cart proceeds to order payment.
          // The backend checks ownership, PIN, currency, prices and draft state.
          if (mergeIntoCartId) {
            try {
              window.sessionStorage.setItem(RECIPE_PENDING_MERGE_KEY,
                JSON.stringify({ cartId: mergeIntoCartId, recipeCartId: marketplaceCartId,
                  pincode: normalizedPincode, items: recipeItems }))
            } catch {
              // The server still enforces one-time merge using source cart state.
            }
          }
          const finalCartId = mergeIntoCartId
            ? (await mergeRecipeMarketplaceCart({
                cartId: mergeIntoCartId,
                recipeCartId: marketplaceCartId,
              }))?.cart?.id
            : marketplaceCartId
          if (!finalCartId) {
            throw new Error('Unable to prepare one complete order for all items.')
          }
          try {
            window.sessionStorage.removeItem(RECIPE_PENDING_MERGE_KEY)
          } catch {
            // Storage is best effort.
          }

          // Do not discard the pending ingredient selection until this EXACT
          // combined cart is verified paid by CheckoutPage.
          try {
            window.sessionStorage.setItem(
              RECIPE_CHECKOUT_CART_KEY,
              JSON.stringify({ cartId: String(finalCartId), items: recipeItems }),
            )
          } catch {
            // Server checkout remains authoritative if browser storage fails.
          }

          attachRecipeCart(recipeCart?.slug, finalCartId)
          navigate(
            `/checkout/${finalCartId}`,
            {
              replace:
                true,
            },
          )
        } catch (
          recipeOrderError
        ) {
          setError(
            getCommerceErrorMessage(
              recipeOrderError,
              getOutcomePlanErrorMessage(
                recipeOrderError,
                'Unable to prepare this Recipe Cart for checkout.',
              ),
            ),
          )
        } finally {
          setPlacingRecipeOrder(false)
        }
      },
      [
        isRecipeCart,
        navigate,
        placingRecipeOrder,
        recipeCart,
        recipeItems,
        groceryCartId,
        data?.cart?.pincode,
      ],
    )

  useEffect(
    () => {
      if (
        !isRecipeCart ||
        location.state
          ?.recipeCartCheckout !==
          true ||
        location.state
          ?.deliveryAddressSaved !==
          true ||
        recipeCheckoutHandledRef.current
      ) {
        return
      }

      recipeCheckoutHandledRef.current =
        true

      finalizeRecipeOrder()
    },
    [
      finalizeRecipeOrder,
      isRecipeCart,
      location.state,
    ],
  )

  function handlePlaceRecipeOrder() {
    if (
      placingRecipeOrder ||
      recipeItems.length ===
        0
    ) {
      return
    }

    setError('')
    setRecipeCoverageIssue(null)

    navigate(
      `/delivery-addresses?returnTo=${encodeURIComponent(
        '/cart/recipe',
      )}`,
      {
        state: {
          recipeCartCheckout:
            true,
        },
      },
    )
  }

  function handleRemoveRecipeItem(
    canonicalIngredientId,
  ) {
    if (!canonicalIngredientId) {
      return
    }

    setError('')
    setRecipeCoverageIssue(null)

    setRecipeCart(
      (currentCart) => {
        if (!currentCart) {
          return currentCart
        }

        const nextCart = {
          ...currentCart,
          items: (
            currentCart.items ||
            []
          ).filter(
            (item) =>
              String(
                item?.canonicalIngredientId ||
                  '',
              ) !==
              String(
                canonicalIngredientId,
              ),
          ),
        }

        writeRecipeCart(
          nextCart,
        )

        notifyFloatingCartUpdated()

        return nextCart
      },
    )
  }

  if (isRecipeCart) {
    const grocerySubtotal = groceryItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.lineTotal?.amountMinor || 0)),
      0,
    )
    const groceryCurrency = groceryCartData?.cart?.currency || groceryItems.find((item) => item?.lineTotal?.currency)?.lineTotal?.currency || 'INR'
    const hasRecipe = recipeItems.length > 0
    const hasGroceries = groceryItems.length > 0
    const canReviewGroceries = Boolean(groceryCartId) && hasGroceries && !groceryLoading && !groceryError
    const recipeDeliveryBusy = Boolean(selectedRecipePincode) && (
      recipePinCoverage.pincode !== selectedRecipePincode ||
      recipePinCoverage.status === 'checking' ||
      recipePinCoverage.status === 'unavailable'
    )
    const hasAnyItems = hasRecipe || hasGroceries
    const canEditGrocery = !groceryLoading && !groceryError && groceryCartData?.cart?.sourceType === 'direct_product'

    return (
      <main className="ep-unified-basket ep-cart-v2">
      {packPicker && <RecipePackPicker groups={packPicker.groups} pincode={packPicker.pincode} onFinish={finishPackPicker} />}
        <style>{`
          .ep-cart-v2 { --clay:#C56C42;--forest:#173F35;--charcoal:#202421;--sage:#D7DDCF;--porcelain:#F7F6F2; background:var(--porcelain);color:var(--charcoal);font-family:'Plus Jakarta Sans',Inter,sans-serif;min-width:0; }
          .ep-cart-v2 * { box-sizing:border-box; }
          .ep-cart-v2 .ep-cart-layout { padding:24px clamp(16px,3vw,44px) 52px; }
          .ep-cart-v2 .ep-cart-topline { display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px; }
          .ep-cart-v2 .ep-cart-return { display:inline-flex;align-items:center;gap:8px;font-weight:750;color:var(--forest);text-decoration:none;font-size:14px;min-height:42px; }
          .ep-cart-v2 .ep-cart-return:hover { text-decoration:underline; }
          .ep-cart-v2 .ep-cart-top-shop { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }
          .ep-cart-v2 .ep-cart-top-shop a { color:var(--forest);text-decoration:none;font-size:13px;font-weight:750; }
          .ep-cart-v2 .ep-cart-hero { display:flex;justify-content:space-between;gap:26px;align-items:center;background:var(--clay);color:#fff;border-radius:18px;padding:28px 34px;position:relative;overflow:hidden; }
          .ep-cart-v2 .ep-cart-hero:after { content:'';position:absolute;width:230px;height:230px;border:1px solid rgba(255,255,255,.17);border-radius:50%;right:140px;top:-160px;pointer-events:none; }
          .ep-cart-v2 .ep-cart-kicker { font-size:11px;text-transform:uppercase;letter-spacing:.13em;font-weight:850;color:#FFEBE1; }
          .ep-cart-v2 .ep-cart-hero h1 { font-size:clamp(28px,3.1vw,46px);line-height:1.08;letter-spacing:-.045em;font-weight:800;color:#fff;margin:7px 0 0; }
          .ep-cart-v2 .ep-cart-hero p { font-size:14px;margin:9px 0 0;color:#FFEEE5; }
          .ep-cart-v2 .ep-cart-hero-count { min-width:164px;position:relative;display:flex;align-items:center;gap:12px;border-left:1px solid rgba(255,255,255,.32);padding-left:25px; }
          .ep-cart-v2 .ep-cart-hero-count strong { font-size:54px;line-height:.9;letter-spacing:-.06em;font-variant-numeric:tabular-nums; }
          .ep-cart-v2 .ep-cart-hero-count span { font-size:12px;line-height:1.3;font-weight:700;color:#FFF4EF; }
          .ep-cart-v2 .ep-cart-progress { display:flex;gap:9px;align-items:center;border-bottom:1px solid #DFE2DA;padding:17px 0 18px;color:#758078;font-weight:700;font-size:12px; }
          .ep-cart-v2 .ep-cart-progress .current { color:var(--clay); }
          .ep-cart-v2 .ep-cart-progress .dot { width:5px;height:5px;border-radius:50%;background:#BFC8BF; }
          .ep-cart-v2 .ep-cart-content { display:grid;grid-template-columns:minmax(0,1fr) minmax(275px,330px);gap:clamp(22px,2.4vw,38px);align-items:start;margin-top:28px; }
          .ep-cart-v2 .ep-cart-items { min-width:0; }
          .ep-cart-v2 .ep-cart-section { border-top:3px solid var(--clay);margin-bottom:30px; }
          .ep-cart-v2 .ep-cart-section.recipe-section { border-top-color:var(--forest); }
          .ep-cart-v2 .ep-cart-section-head { display:flex;justify-content:space-between;align-items:end;gap:16px;padding:19px 0 16px; }
          .ep-cart-v2 .ep-cart-section-head small { display:block;text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.095em;color:var(--clay);margin-bottom:5px; }
          .ep-cart-v2 .ep-cart-section-head h2 { font-size:clamp(22px,2vw,29px);line-height:1.16;letter-spacing:-.045em;margin:0;color:var(--charcoal);font-weight:830; }
          .ep-cart-v2 .ep-cart-section-head .count { background:#E6E9DF;color:var(--forest);border-radius:999px;padding:8px 11px;font-size:12px;font-weight:750;white-space:nowrap; }
          .ep-cart-v2 .ep-cart-list { border-top:1px solid #DFE1D9; }
          .ep-cart-v2 .ep-cart-row { display:grid;grid-template-columns:76px minmax(0,1fr) 112px 105px 85px;align-items:center;column-gap:17px;min-height:112px;padding:16px 4px;border-bottom:1px solid #DFE1D9;transition:background .15s ease; }
          .ep-cart-v2 .ep-cart-row:hover { background:#FBFAF7; }
          .ep-cart-v2 .ep-cart-thumb { position:relative;width:76px;height:78px;overflow:hidden;display:grid;place-items:center;background:#EBEEE7;border:1px solid #E3E6DF;border-radius:12px;color:var(--forest); }
          .ep-cart-v2 .ep-cart-thumb img { position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:contain;background:#fff;display:block; }
          .ep-cart-v2 .ep-cart-name { min-width:0;font-size:15px;line-height:1.45;font-weight:800;overflow-wrap:anywhere; }
          .ep-cart-v2 .ep-cart-subline { margin-top:5px;font-size:12px;color:#65746D;font-weight:570; }
          .ep-cart-v2 .ep-cart-price { font-size:16px;font-weight:850;color:var(--forest);text-align:right;white-space:nowrap; }
          .ep-cart-v2 .ep-cart-qty { display:inline-flex;align-items:center;justify-self:center;border:1px solid #CCD4CB;border-radius:11px;overflow:hidden;background:white;height:39px; }
          .ep-cart-v2 .ep-cart-qty button { border:0;background:white;color:var(--forest);height:38px;width:31px;display:grid;place-items:center;cursor:pointer; }
          .ep-cart-v2 .ep-cart-qty button:hover:not(:disabled) { background:#DDE9DE; }
          .ep-cart-v2 .ep-cart-qty button:disabled { opacity:.35;cursor:not-allowed; }
          .ep-cart-v2 .ep-cart-qty output { min-width:31px;text-align:center;font-size:14px;font-weight:850;font-variant-numeric:tabular-nums; }
          .ep-cart-v2 .ep-cart-remove { display:inline-flex;align-items:center;justify-content:center;gap:6px;color:#A64531;border:1px solid #ECCDBF;border-radius:10px;background:transparent;padding:9px 10px;min-height:39px;font-size:12px;font-weight:800;cursor:pointer; }
          .ep-cart-v2 .ep-cart-remove:hover:not(:disabled) { background:#FFEDE6; }
          .ep-cart-v2 .ep-cart-remove:disabled { opacity:.4;cursor:not-allowed; }
          .ep-cart-v2 .ep-cart-empty { border:1px dashed #D3C8BA;background:#FEFCF8;border-radius:15px;padding:32px 20px;text-align:center; }
          .ep-cart-v2 .ep-cart-empty h2 { font-size:22px;margin:10px 0 5px; }
          .ep-cart-v2 .ep-cart-empty a { display:inline-flex;margin-top:14px;align-items:center;gap:8px;text-decoration:none;font-weight:800;color:var(--clay); }
          .ep-cart-v2 .ep-cart-actions { display:flex;gap:16px;flex-wrap:wrap;border-top:1px solid #DFE1D9;padding-top:16px; }
          .ep-cart-v2 .ep-cart-actions a { display:inline-flex;align-items:center;gap:8px;color:var(--forest);font-size:13px;font-weight:800;text-decoration:none;min-height:38px; }
          .ep-cart-v2 .ep-cart-actions a:hover { text-decoration:underline; }
          .ep-cart-v2 .ep-cart-summary { position:sticky;top:100px;background:#FFFEFC;border:1px solid #E2DFD7;border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(29,38,31,.04); }
          .ep-cart-v2 .ep-cart-summary-title { padding:22px 23px;background:#D7DDCF;border-bottom:1px solid #CBD3C3; }
          .ep-cart-v2 .ep-cart-summary-title small { display:block;color:var(--forest);font-weight:850;letter-spacing:.1em;font-size:11px;text-transform:uppercase; }
          .ep-cart-v2 .ep-cart-summary-title h2 { font-size:24px;letter-spacing:-.045em;margin:5px 0 0;color:var(--charcoal); }
          .ep-cart-v2 .ep-cart-summary-body { padding:20px 23px 23px; }
          .ep-cart-v2 .ep-cart-summary-line { display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px;color:#617067; }
          .ep-cart-v2 .ep-cart-summary-line strong { color:var(--charcoal);font-size:17px; }
          .ep-cart-v2 .ep-cart-summary-total { border-top:1px solid #E5E6DF;margin-top:15px;padding-top:17px; }
          .ep-cart-v2 .ep-cart-summary-total strong { font-size:30px;color:var(--forest);letter-spacing:-.04em; }
          .ep-cart-v2 .ep-cart-summary-note { margin:6px 0 0;color:#6A746B;font-size:12px; }
          .ep-cart-v2 .ep-cart-summary-pin { padding:15px 0;margin-top:17px;border-top:1px solid #E5E6DF; }
          .ep-cart-v2 .ep-cart-summary-pin-label { display:flex;align-items:center;justify-content:space-between;gap:14px; }
          .ep-cart-v2 .ep-cart-summary-pin-label strong { color:var(--forest);font-weight:850; }
          .ep-cart-v2 .ep-cart-summary-pin-label button { font-size:12px;font-weight:800;background:none;border:0;color:var(--clay);cursor:pointer; }
          .ep-cart-v2 .ep-cart-pin-form { display:flex;gap:8px;margin-top:12px; }
          .ep-cart-v2 .ep-cart-pin-form input { flex:1;min-width:0;height:42px;border:1px solid #C5CEC3;padding:0 12px;border-radius:8px; }
          .ep-cart-v2 .ep-cart-pin-form button { border:0;border-radius:8px;background:var(--forest);color:white;font-weight:750;padding:0 16px; }
          .ep-cart-v2 .ep-cart-checkout { width:100%;min-height:52px;border:0;border-radius:11px;background:var(--clay);color:#fff;font-weight:850;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;margin-top:20px; }
          .ep-cart-v2 .ep-cart-checkout:hover:not(:disabled) { background:#AC5833; }
          .ep-cart-v2 .ep-cart-checkout:disabled { opacity:.5;cursor:not-allowed; }
          .ep-cart-v2 .ep-cart-alert { display:flex;gap:12px;align-items:start;margin-top:18px;padding:15px 17px;background:#FFF1ED;color:#8C392B;border-left:4px solid #C9473C;border-radius:8px;font-size:14px; }
          .ep-cart-v2 .ep-cart-alert button { margin-top:12px;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:8px;padding:10px 14px;background:var(--forest);color:white;font-weight:700; }
          .ep-cart-v2 button:focus-visible,.ep-cart-v2 a:focus-visible,.ep-cart-v2 input:focus-visible { outline:3px solid var(--clay);outline-offset:3px; }
          @media(max-width:1100px){ .ep-cart-v2 .ep-cart-content { grid-template-columns:minmax(0,1fr) 280px;gap:20px; } .ep-cart-v2 .ep-cart-row{grid-template-columns:66px minmax(0,1fr) 100px 90px 74px;gap:9px;} .ep-cart-v2 .ep-cart-thumb{width:66px;height:70px;} }
          @media(max-width:900px){ .ep-cart-v2 .ep-cart-content{grid-template-columns:1fr;} .ep-cart-v2 .ep-cart-summary{position:static;} }
          @media(max-width:620px){
            .ep-cart-v2 .ep-cart-layout{padding:10px 12px 30px;}
            .ep-cart-v2 .ep-cart-topline{margin-bottom:10px;gap:8px;}
            .ep-cart-v2 .ep-cart-top-shop{gap:10px;}
            .ep-cart-v2 .ep-cart-top-shop a{font-size:12px;}
            .ep-cart-v2 .ep-cart-hero{padding:21px 19px;border-radius:14px;gap:12px;}
            .ep-cart-v2 .ep-cart-hero h1{font-size:28px;}
            .ep-cart-v2 .ep-cart-hero p{font-size:12px;margin-top:5px;}
            .ep-cart-v2 .ep-cart-hero-count{min-width:auto;display:block;padding-left:13px;}
            .ep-cart-v2 .ep-cart-hero-count strong{font-size:35px;display:block;}
            .ep-cart-v2 .ep-cart-hero-count span{font-size:10px;}
            .ep-cart-v2 .ep-cart-progress{padding:11px 0;font-size:11px;}
            .ep-cart-v2 .ep-cart-content{margin-top:18px;gap:16px;}
            .ep-cart-v2 .ep-cart-section-head{padding:14px 0;}
            .ep-cart-v2 .ep-cart-section-head h2{font-size:22px;}
            .ep-cart-v2 .ep-cart-row{grid-template-columns:64px minmax(0,1fr) 77px;gap:7px 11px;min-height:0;padding:14px 0;}
            .ep-cart-v2 .ep-cart-thumb{width:64px;height:68px;grid-column:1;grid-row:1/3;}
            .ep-cart-v2 .ep-cart-info{grid-column:2;grid-row:1;}
            .ep-cart-v2 .ep-cart-name{font-size:13px;line-height:1.4;}
            .ep-cart-v2 .ep-cart-subline{font-size:11px;margin-top:4px;}
            .ep-cart-v2 .ep-cart-qty{grid-column:2;grid-row:2;justify-self:start;}
            .ep-cart-v2 .ep-cart-price{grid-column:3;grid-row:2;font-size:14px;text-align:right;}
            .ep-cart-v2 .ep-cart-remove{grid-column:3;grid-row:1;justify-self:end;align-self:start;padding:7px;min-height:32px;font-size:11px;}
            .ep-cart-v2 .ep-cart-remove span{display:none;}
            .ep-cart-v2 .ep-cart-summary-title{padding:16px 17px;}
            .ep-cart-v2 .ep-cart-summary-title h2{font-size:21px;}
            .ep-cart-v2 .ep-cart-summary-body{padding:16px 17px;}
          }
          @media(prefers-reduced-motion:reduce){.ep-cart-v2 *{transition:none!important;}}
        `}</style>
        <div className="ep-cart-layout">
          <nav className="ep-cart-topline" aria-label="Basket navigation">
            <Link className="ep-cart-return" to={recipeCart?.slug && hasRecipe ? `/recipes/${recipeCart.slug}` : '/grocery'}>
              <ArrowLeft size={17} aria-hidden="true"/> Continue shopping
            </Link>
            <div className="ep-cart-top-shop">
              {hasRecipe && getCookingReturnPath({ slug: recipeCart?.slug }) && (
                <Link to={getCookingReturnPath({ slug: recipeCart?.slug })}>Continue cooking</Link>
              )}
              <Link to="/grocery">Browse grocery <ArrowRight size={15} aria-hidden="true"/></Link>
            </div>
          </nav>

          <header className="ep-cart-hero">
            <div>
              <span className="ep-cart-kicker">EPANTRY / YOUR BASKET</span>
              <h1>Your shopping basket.</h1>
              <p>{hasAnyItems ? 'Review your items before checkout.' : 'Add something good to get started.'}</p>
            </div>
            <div className="ep-cart-hero-count">
              <strong>{totalBasketItems}</strong>
              <span>{totalBasketItems === 1 ? 'item' : 'items'} in your basket</span>
            </div>
          </header>
          {hasAnyItems && (
            <div className="ep-cart-progress" aria-label="Checkout steps">
              <span className="current">Basket</span><span className="dot" aria-hidden="true"/>
              <span>Delivery</span><span className="dot" aria-hidden="true"/><span>Checkout</span>
            </div>
          )}

          {error && (
            <div role="alert" className="ep-cart-alert"><AlertTriangle size={18} aria-hidden="true"/><span>{error}</span></div>
          )}
          {recipeCoverageIssue && (
            <div className="ep-cart-alert" role="alert">
              <AlertTriangle size={19} aria-hidden="true"/>
              <div>
                <strong>Delivery needs attention</strong>
                <p>{recipeCoverageIssue.unmatchedNames?.length
                  ? `${recipeCoverageIssue.unmatchedNames.join(', ')} unavailable for PIN ${recipeCoverageIssue.pincode}.`
                  : `Some ingredients cannot be delivered to PIN ${recipeCoverageIssue.pincode}.`}</p>
                <button type="button" onClick={handlePlaceRecipeOrder}>Change delivery address <ArrowRight size={15}/></button>
              </div>
            </div>
          )}

          <div className="ep-cart-content">
            <div className="ep-cart-items">
              {hasGroceries && (
                <section className="ep-cart-section" aria-labelledby="ep-cart-grocery-heading">
                  <div className="ep-cart-section-head">
                    <div><small>Grocery & Brands</small><h2 id="ep-cart-grocery-heading">Your products</h2></div>
                    <span className="count">{groceryItems.length} {groceryItems.length === 1 ? 'product' : 'products'}</span>
                  </div>
                  {groceryLoading && <p role="status">Refreshing your basket…</p>}
                  {groceryError && <p role="alert" style={{color:'#9C3226',marginBottom:12}}>{groceryError}</p>}
                  <div className="ep-cart-list">
                    {groceryItems.map((item,index) => {
                      const key = basketImageLookupKey(item)
                      const photo = basketImageUrl(item) || basketProductImages[key] || ''
                      const quantity = basketItemCount(item)
                      const busy = Boolean(updatingGroceryItemId) || !canEditGrocery
                      const title = item.displayName || item.name || 'Grocery product'
                      return (
                        <article className="ep-cart-row" key={item.id || item.packId || index}>
                          <div className="ep-cart-thumb">
                            <ShoppingBasket size={26} aria-hidden="true"/>{photo && <img src={photo} alt={title} loading="lazy" onError={(event) => { event.currentTarget.style.display='none' }} />}
                          </div>
                          <div className="ep-cart-info">
                            <div className="ep-cart-name">{title}</div>
                            <div className="ep-cart-subline">{item.sellerName || 'EPANTRY seller'} · {item.packQuantity && item.packUnit ? `${item.packQuantity} ${item.packUnit}` : 'Per pack'}</div>
                          </div>
                          <div className="ep-cart-qty" aria-label={`Quantity for ${title}`}>
                            <button type="button" onClick={() => handleChangeGroceryQuantity(item, -1)} disabled={busy || quantity <= 1} aria-label={`Decrease quantity of ${title}`}><Minus size={14}/></button>
                            <output aria-live="polite">{quantity}</output>
                            <button type="button" onClick={() => handleChangeGroceryQuantity(item, 1)} disabled={busy} aria-label={`Increase quantity of ${title}`}><Plus size={14}/></button>
                          </div>
                          <strong className="ep-cart-price">{item.lineTotal?.amountMinor != null ? formatMoney(item.lineTotal.amountMinor, item.lineTotal.currency || groceryCurrency) : '—'}</strong>
                          <button type="button" className="ep-cart-remove" disabled={busy} onClick={() => handleRemoveGroceryItem(item)} aria-label={`Remove ${title} from basket`}><Trash2 size={15} aria-hidden="true"/><span>Remove</span></button>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )}

              {hasRecipe && (
                <section className="ep-cart-section recipe-section" aria-labelledby="ep-cart-recipe-heading">
                  <div className="ep-cart-section-head">
                    <div><small style={{color:'var(--forest)'}}>From your recipes</small><h2 id="ep-cart-recipe-heading">Recipe ingredients</h2></div>
                    <span className="count">{recipeItems.length} {recipeItems.length === 1 ? 'ingredient' : 'ingredients'}</span>
                  </div>
                  <div className="ep-cart-list">
                    {recipeItems.map((item,index) => {
                      const title = item.name || 'Ingredient'
                      const photo = basketImageUrl(item)
                      return (
                        <article className="ep-cart-row" key={item.canonicalIngredientId || index}>
                          <div className="ep-cart-thumb"><Package size={24} aria-hidden="true"/>{photo && <img src={photo} alt={title} loading="lazy" onError={(event) => {event.currentTarget.style.display='none'}}/>}</div>
                          <div className="ep-cart-info">
                            <div className="ep-cart-name">{title}</div>
                            <div className="ep-cart-subline">{formatRecipeQuantity(item)} required</div>
                            {item.packSelection && <div className="ep-cart-subline">{item.packSelection.sellerName} · {item.packSelection.packCount} × {item.packSelection.packQuantity} {item.packSelection.packUnit}</div>}
                          </div>
                          <span className="ep-cart-subline" style={{textAlign:'center'}}>{item.packSelection ? `${item.packSelection.packCount} packs` : 'Recipe item'}</span>
                          <span className="ep-cart-price" title="Price is rechecked at checkout">{item.packSelection ? formatMoney(item.packSelection.packCount * item.packSelection.unitPrice.amountMinor,item.packSelection.unitPrice.currency) : '—'}</span>
                          <button type="button" className="ep-cart-remove" onClick={() => handleRemoveRecipeItem(item.canonicalIngredientId)} aria-label={`Remove ${title} from basket`}><Trash2 size={15}/><span>Remove</span></button>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )}

              {!hasAnyItems && (
                <div className="ep-cart-empty">
                  <ShoppingBasket size={28} color="#C56C42" aria-hidden="true"/>
                  <h2>Your basket is empty</h2>
                  <p>Browse products or choose ingredients from a recipe.</p>
                  <Link to="/grocery">Explore grocery <ArrowRight size={16}/></Link>
                </div>
              )}
              <div className="ep-cart-actions">
                <Link to="/grocery">+ Add more groceries <ArrowRight size={16}/></Link>
                <Link to="/recipes">+ Add from recipes <ArrowRight size={16}/></Link>
              </div>
            </div>

            <aside className="ep-cart-summary" aria-label="Basket checkout summary">
              <div className="ep-cart-summary-title"><small>Order summary</small><h2>Ready for checkout</h2></div>
              <div className="ep-cart-summary-body">
                <div className="ep-cart-summary-line"><span>Items</span><strong>{totalBasketItems}</strong></div>
                {hasGroceries && groceryCartData?.items?.length > 0 && (
                  <div className="ep-cart-summary-total">
                    <span className="ep-cart-summary-line">Grocery subtotal</span>
                    <strong>{formatMoney(grocerySubtotal,groceryCurrency)}</strong>
                    {hasRecipe && <p className="ep-cart-summary-note">Recipe pack prices shown are estimates until verified at checkout.</p>}
                  </div>
                )}
                {hasRecipe && (
                  <div className="ep-cart-summary-pin">
                    <div className="ep-cart-summary-pin-label">
                      <span>Delivery PIN<br/><strong>{selectedRecipePincode || 'Not set'}</strong></span>
                      <button type="button" onClick={() => {setRecipePincodeDraft(selectedRecipePincode);setRecipePinError('');setRecipePinEditorOpen((open)=>!open)}}>{recipePinEditorOpen ? 'Cancel' : 'Change'}</button>
                    </div>
                    {(recipePinEditorOpen || !selectedRecipePincode) && (
                      <form className="ep-cart-pin-form" onSubmit={handleCheckRecipePincode}>
                        <input inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[0-9]{6}" value={recipePincodeDraft} onChange={(event) => setRecipePincodeDraft(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit PIN" aria-label="Delivery PIN"/>
                        <button type="submit">Check</button>
                      </form>
                    )}
                    {recipePinError && <p style={{color:'#9C3226',fontSize:12}} role="alert">{recipePinError}</p>}
                    {recipePinEditorOpen && detectedPincode && (
                      <button type="button" style={{border:0,background:'none',textDecoration:'underline',fontWeight:700,color:'var(--forest)',marginTop:8,cursor:'pointer'}} onClick={() => {setManualRecipePincode(null);setRecipePinEditorOpen(false);setRecipePinError('')}}>Use current PIN {detectedPincode}</button>
                    )}
                    {selectedRecipePincode && <p style={{fontSize:12,lineHeight:1.5,marginTop:10,color:recipePinCoverage.status==='unavailable'?'#9C3226':'var(--forest)'}} role="status">
                      {recipePinCoverage.pincode!==selectedRecipePincode || recipePinCoverage.status==='checking'
                        ? 'Checking ingredient delivery…'
                        : recipePinCoverage.status==='available'
                          ? 'Ingredients available for delivery'
                          : recipePinCoverage.status==='unavailable'
                            ? `Some ingredients unavailable for PIN ${selectedRecipePincode}`
                            : recipePinCoverage.status==='covered' ? 'Ingredients already in your Pantry'
                            : recipePinCoverage.status==='error' ? (recipePinCoverage.message || 'Availability check failed')
                            : 'Enter a PIN to check delivery'}
                    </p>}
                  </div>
                )}
                <button type="button" className="ep-cart-checkout" onClick={() => hasRecipe ? handlePlaceRecipeOrder() : navigate(`/checkout/${groceryCartId}`)} disabled={hasRecipe ? (placingRecipeOrder || recipeDeliveryBusy) : !canReviewGroceries}>
                  {placingRecipeOrder ? 'Checking availability…' : hasRecipe ? 'Review delivery & checkout' : 'Continue to checkout'}
                  <ArrowRight size={18} aria-hidden="true"/>
                </button>
                {!hasAnyItems && <p className="ep-cart-summary-note" style={{textAlign:'center'}}>Add an item to continue.</p>}
              </div>
            </aside>
          </div>
        </div>
      </main>
    )
  }

  async function mutateDirectCartItem(
    item,
    operation,
    quantity,
  ) {
    const itemId =
      String(
        item?.id ||
          item?.packId ||
          '',
      ).trim()

    if (
      !cartId ||
      !itemId ||
      updatingCartItemId
    ) {
      return
    }

    setError('')
    setUpdatingCartItemId(
      itemId,
    )

    try {
      const result =
        await updateDirectMarketplaceCartItem({
          cartId,
          itemId,
          operation,
          ...(quantity === undefined
            ? {}
            : {
                quantity,
              }),
        })

      setData(
        result,
      )

      const nextItems =
        Array.isArray(
          result?.items,
        )
          ? result.items.map(
              (
                cartItem,
              ) => ({
                id:
                  cartItem.id ||
                  cartItem.packId ||
                  cartItem.displayName,

                packId:
                  cartItem.packId ||
                  '',

                name:
                  cartItem.displayName ||
                  'Product',

                quantity:
                  Number(
                    cartItem.packCount ||
                      1,
                  ),
              }),
            )
          : []

      try {
        if (
          nextItems.length ===
          0
        ) {
          window.sessionStorage.removeItem(
            FLOATING_MARKETPLACE_CART_KEY,
          )
        } else {
          window.sessionStorage.setItem(
            FLOATING_MARKETPLACE_CART_KEY,
            JSON.stringify({
              cartId:
                result?.cart?.id ||
                cartId,
              items:
                nextItems,
              updatedAt:
                new Date().toISOString(),
            }),
          )
        }
      } catch {
        // Session persistence is best-effort UX state only.
      }

      window.dispatchEvent(
        new CustomEvent(
          'epantry-cart-updated',
          {
            detail: {
              show: false,
            },
          },
        ),
      )
    } catch (
      mutationError
    ) {
      setError(
        getCommerceErrorMessage(
          mutationError,
          'Unable to update this Cart item.',
        ),
      )
    } finally {
      setUpdatingCartItemId(
        '',
      )
    }
  }

  if (
    loading
  ) {
    return (
      <main className="min-w-0 bg-[#F7F6F2]">
        <div className="w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="h-[560px] animate-pulse rounded-[30px] border border-stone-200 bg-white" />
        </div>
      </main>
    )
  }

  const cart =
    data?.cart ||
    {}

  const isDirectProductCart =
    cart.sourceType ===
    'direct_product'

  const isRestaurantRecipeCart =
    cart.sourceType ===
    'restaurant_recipe'

  if (
    isRestaurantRecipeCart
  ) {
    const restaurantOrder =
      cart.restaurantOrder ||
      {}

    return (
      <main className="min-w-0 bg-[#fff5e8]">
        <div className="w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <Link
            to={
              restaurantOrder.recipeSlug
                ? `/recipes/${restaurantOrder.recipeSlug}`
                : '/recipes'
            }
            className="focus-ring inline-flex items-center gap-2 rounded-full px-1 py-2 text-sm font-black text-stone-600 transition hover:text-orange-900"
          >
            <ArrowLeft
              size={17}
              aria-hidden="true"
            />
            Back to Restaurant Recipe
          </Link>

          <section className="mt-3 overflow-hidden rounded-[30px] border border-orange-900/15 bg-[linear-gradient(135deg,#ffe1bc_0%,#fff7ea_50%,#ffd8c2_100%)] shadow-[0_18px_55px_rgba(126,63,22,0.10)]">
            <div className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-900/15 bg-white/70 px-3 py-1.5 text-orange-900 shadow-sm">
                  <Store
                    size={15}
                    aria-hidden="true"
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.15em]">
                    Prepared dish order
                  </p>
                </div>

                <h1 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#4b2412] sm:text-5xl">
                  {restaurantOrder.displayName || 'Restaurant dish'}
                </h1>

                <p className="mt-3 text-sm font-black text-orange-900">
                  From {restaurantOrder.restaurantName || 'Restaurant'}
                </p>

                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#76523f]">
                  <MapPin
                    size={16}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span>
                    {restaurantOrder.outletName || 'Restaurant outlet'}
                  </span>
                </div>
              </div>

              <div className="rounded-[24px] border border-orange-900/12 bg-white/78 p-4 shadow-sm backdrop-blur">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-orange-50 px-3 py-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-400">
                      People
                    </p>
                    <p className="mt-1 text-lg font-black text-stone-950">
                      {restaurantOrder.servings || 1}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-50 px-3 py-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Per serving
                    </p>
                    <p className="mt-1 text-lg font-black text-stone-950">
                      {formatMoney(
                        restaurantOrder.pricePerServing?.amountMinor,
                        restaurantOrder.pricePerServing?.currency || cart.currency,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-4 rounded-2xl bg-[#9a3412] px-4 py-4 text-white">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.13em] text-orange-100">
                      Prepared dish total
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {formatMoney(
                        restaurantOrder.lineTotal?.amountMinor,
                        restaurantOrder.lineTotal?.currency || cart.currency,
                      )}
                    </p>
                  </div>
                  <ReceiptText
                    size={24}
                    aria-hidden="true"
                    className="text-orange-100"
                  />
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section className="rounded-[26px] border border-orange-900/10 bg-white p-5 shadow-[0_10px_35px_rgba(126,63,22,0.06)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-900">
                  <ShieldCheck
                    size={19}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-800">
                    Restaurant order saved
                  </p>
                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    Your servings and active menu price are locked into this Cart.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                    This prepared-dish Cart is separate from grocery ingredient shopping. Restaurant fulfillment and final payment will continue through EPANTRY Commerce once that restaurant checkout path is enabled.
                  </p>
                </div>
              </div>
            </section>

            <aside className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-[0_10px_35px_rgba(28,25,23,0.05)]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                Delivery context
              </p>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="font-semibold text-stone-500">Pincode</span>
                  <span className="font-black text-stone-950">{cart.pincode || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="font-semibold text-stone-500">Fulfillment</span>
                  <span className="font-black capitalize text-stone-950">{cart.fulfillmentType || 'delivery'}</span>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-500"
              >
                <ArrowRight
                  size={17}
                  aria-hidden="true"
                />
                Restaurant checkout pending
              </button>
            </aside>
          </div>
        </div>
      </main>
    )
  }

  let recipeIncludedInThisCart = false
  try {
    const previousCheckout = JSON.parse(window.sessionStorage.getItem(RECIPE_CHECKOUT_CART_KEY) || 'null')
    recipeIncludedInThisCart =
      String(previousCheckout?.cartId || '') === String(cartId) &&
      JSON.stringify(previousCheckout?.items || []) === JSON.stringify(recipeCart?.items || [])
  } catch {
    recipeIncludedInThisCart = false
  }
  const pendingRecipeItems = recipeIncludedInThisCart
    ? []
    : (Array.isArray(recipeCart?.items) ? recipeCart.items : [])
  const pendingRecipeCount = pendingRecipeItems.length

  const itemCount =
    (data?.items ||
      []).reduce(
      (
        total,
        item,
      ) =>
        total +
        Number(
          item.packCount ||
            0,
        ),
      0,
    )

  return (
    <main className="relative min-w-0 overflow-hidden bg-[#F7F6F2] text-stone-950">
      {packPicker && <RecipePackPicker groups={packPicker.groups} pincode={packPicker.pincode} onFinish={finishPackPicker} />}
      <style>{`
        @keyframes epCartRise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes epCartDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, 14px, 0) scale(1.05); }
        }

        @keyframes epCartSheen {
          0% { transform: translateX(-140%) skewX(-18deg); }
          55%, 100% { transform: translateX(240%) skewX(-18deg); }
        }

        .ep-cart-rise {
          animation: epCartRise 560ms cubic-bezier(.2,.7,.2,1) both;
        }

        .ep-cart-drift {
          animation: epCartDrift 8s ease-in-out infinite;
        }

        .ep-cart-sheen::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 34%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          animation: epCartSheen 4.8s ease-in-out infinite;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .ep-cart-rise,
          .ep-cart-drift,
          .ep-cart-sheen::after {
            animation: none !important;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ep-cart-drift absolute -left-24 top-40 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="ep-cart-drift absolute -right-28 top-[34rem] h-96 w-96 rounded-full bg-lime-200/20 blur-3xl [animation-delay:-3s]" />
      </div>

      <div className="relative w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="ep-cart-rise flex flex-wrap items-center justify-between gap-3">
          <Link
            to={
              isDirectProductCart
                ? '/grocery'
                : `/outcome-plans/${cart.outcomePlanId}/compare`
            }
            className="focus-ring group inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-2 text-sm font-black text-stone-600 transition duration-300 hover:border-emerald-200 hover:bg-white/75 hover:text-emerald-900"
          >
            <ArrowLeft
              size={17}
              className="transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />

            {isDirectProductCart
              ? 'Back to Grocery'
              : 'Back to Fulfillment Compare'}
          </Link>

          <button
            type="button"
            onClick={() =>
              loadCart({
                refresh:
                  true,
              })
            }
            disabled={
              refreshing
            }
            className="focus-ring group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/85 px-4 py-2.5 text-sm font-black text-stone-700 shadow-[0_8px_24px_rgba(28,25,23,0.07)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-800 hover:shadow-[0_12px_28px_rgba(6,78,59,0.10)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? 'animate-spin'
                  : 'transition-transform duration-500 group-hover:rotate-180'
              }
              aria-hidden="true"
            />

            {refreshing
              ? 'Refreshing…'
              : 'Refresh cart'}
          </button>
        </div>

        <section className="ep-cart-rise relative mt-4 overflow-hidden rounded-[34px] border border-emerald-800/20 bg-[linear-gradient(135deg,#062e25_0%,#0a4b3a_52%,#0f6a52_100%)] text-white shadow-[0_28px_80px_rgba(6,78,59,0.18)] [animation-delay:70ms]">
          <div className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-[28%] h-64 w-64 rounded-full bg-lime-200/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_38%)]" />

          <div className="relative px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-white/10 px-3 py-1.5 text-emerald-50 backdrop-blur-xl">
                  <ShoppingBasket
                    size={15}
                    aria-hidden="true"
                  />

                  <p className="text-[11px] font-black uppercase tracking-[0.18em]">
                    Marketplace Cart
                  </p>
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl lg:text-[44px]">
                  Review your cart
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/75 sm:text-base">
                  {isDirectProductCart
                    ? 'Your selected product and Host Offer are ready for review. Price, inventory and serviceability are checked again before payment.'
                    : 'Review your selected Marketplace items and seller splits before moving to checkout.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
                <div className="group rounded-[22px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/15">
                  <div className="flex items-center gap-2 text-emerald-100/75">
                    <Store
                      size={15}
                      aria-hidden="true"
                    />

                    <p className="text-[10px] font-black uppercase tracking-[0.13em]">
                      Sellers
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-black text-white">
                    {sellerGroups.length}
                  </p>
                </div>

                <div className="group rounded-[22px] border border-emerald-200/40 bg-emerald-100 px-4 py-4 text-emerald-950 shadow-[0_14px_32px_rgba(0,0,0,0.15)] transition duration-300 hover:-translate-y-1 hover:bg-white">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Package
                      size={15}
                      aria-hidden="true"
                    />

                    <p className="text-[10px] font-black uppercase tracking-[0.13em]">
                      Packs
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-black">
                    {itemCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {[
                ['01', 'Review', true],
                ['02', 'Order details', false],
                ['03', 'Payment', false],
              ].map(([step, label, active]) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl transition duration-300 ${
                    active
                      ? 'border-emerald-200/45 bg-white/14 text-white'
                      : 'border-white/10 bg-black/5 text-emerald-100/55'
                  }`}
                >
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black ${
                    active
                      ? 'bg-emerald-100 text-emerald-950'
                      : 'bg-white/10 text-emerald-100/70'
                  }`}>
                    {step}
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.12em]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="ep-cart-rise mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm [animation-delay:100ms]">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {error}
            </span>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="ep-cart-rise space-y-4 [animation-delay:140ms]">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Cart items
                </p>

                <h2 className="mt-1 text-xl font-black tracking-tight text-stone-950 sm:text-2xl">
                  Items grouped by seller
                </h2>
                {pendingRecipeCount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-emerald-800">
                    {itemCount} grocery pack{itemCount === 1 ? '' : 's'} + {pendingRecipeCount} recipe ingredient{pendingRecipeCount === 1 ? '' : 's'} in your basket
                  </p>
                )}
              </div>

              <div className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-black text-stone-500 shadow-sm backdrop-blur-lg">
                {itemCount} pack
                {itemCount ===
                1
                  ? ''
                  : 's'}
              </div>
            </div>

            {pendingRecipeCount > 0 && (
              <section aria-label="Recipe ingredients in your basket" className="overflow-hidden rounded-[26px] border border-emerald-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Recipe Cart</p>
                    <h3 className="mt-1 text-lg font-black text-stone-950">{pendingRecipeCount} recipe ingredient{pendingRecipeCount === 1 ? '' : 's'}</h3>
                  </div>
                  <Link to="/cart/recipe" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-900">
                    Review recipe items <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                <div className="divide-y divide-stone-100 px-4 sm:px-5">
                  {pendingRecipeItems.map((item, index) => (
                    <div key={`${item.canonicalIngredientId || item.id || item.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0 text-sm font-bold text-stone-900">{item.name || 'Ingredient'}</span>
                      <span className="shrink-0 text-xs font-semibold text-stone-600">{formatRecipeQuantity(item)}</span>
                    </div>
                  ))}
                </div>
                <p className="border-t border-emerald-100 px-4 py-3 text-xs leading-5 text-stone-600 sm:px-5">
                  Recipe ingredients will be priced using available Host offers and added to the same order before payment. Unpriced or unavailable ingredients will pause the order.
                </p>
              </section>
            )}

            {sellerGroups.map(
              (
                group,
              ) => (
                <article
                  key={
                    group.organizationId
                  }
                  className="overflow-hidden rounded-[30px] border border-stone-200/90 bg-white shadow-[0_14px_45px_rgba(28,25,23,0.06)]"
                >
                  <header className="relative overflow-hidden bg-[linear-gradient(120deg,#064e3b_0%,#065f46_55%,#047857_100%)] p-5 text-white sm:p-6">
                    <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-emerald-300/15 blur-3xl" />

                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/12 text-emerald-50 shadow-sm">
                          <Store
                            size={20}
                            aria-hidden="true"
                          />
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-emerald-200">
                            Seller / Host
                          </p>

                          <h3 className="mt-0.5 text-lg font-black text-white sm:text-xl">
                            {group.sellerName}
                          </h3>

                          <p className="mt-1 text-xs font-semibold text-emerald-100/75">
                            Fulfilling {group.items.length} product
                            {group.items.length ===
                            1
                              ? ''
                              : 's'} in this order
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm sm:min-w-[178px] sm:text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/70">
                          Seller subtotal
                        </p>

                        <p className="mt-1 text-lg font-black text-white">
                          {formatMoney(
                            group.subtotalMinor,
                            cart.currency,
                          )}
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="bg-stone-50/80 p-3 sm:p-4">
                    <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                      Products from this seller
                    </div>

                    <div className="space-y-3">
                      {group.items.map(
                        (
                          item,
                        ) => {
                          const itemId =
                            String(
                              item.id ||
                                item.packId ||
                                '',
                            )

                          const itemUpdating =
                            updatingCartItemId ===
                            itemId

                          const quantity =
                            Number(
                              item.packCount ||
                                1,
                            )

                          return (
                            <div
                              key={
                                item.id
                              }
                              className="grid gap-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm transition duration-300 hover:border-emerald-200 hover:shadow-[0_10px_28px_rgba(6,78,59,0.07)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5"
                            >
                              <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 sm:grid">
                                <Package
                                  size={19}
                                  aria-hidden="true"
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-black leading-5 text-stone-950 sm:text-base">
                                  {item.displayName ||
                                    (isDirectProductCart
                                      ? `Pack ${String(
                                          item.packId ||
                                            '',
                                        ).slice(-8)}`
                                      : `Requirement ${String(
                                          item.requirementLineId ||
                                            '',
                                        ).slice(-8)}`)}
                                </p>

                                {isDirectProductCart ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                    <div className="inline-flex h-9 items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateDirectCartItem(
                                            item,
                                            'decrement',
                                          )
                                        }
                                        disabled={
                                          quantity <=
                                            1 ||
                                          itemUpdating
                                        }
                                        className="focus-ring grid h-full w-9 place-items-center text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={`Decrease ${item.displayName || 'item'} quantity`}
                                      >
                                        <Minus
                                          size={15}
                                          strokeWidth={2.6}
                                          aria-hidden="true"
                                        />
                                      </button>

                                      <span className="grid h-full min-w-[42px] place-items-center border-x border-stone-200 bg-white px-2 text-sm font-black text-stone-950">
                                        {quantity}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateDirectCartItem(
                                            item,
                                            'set_quantity',
                                            quantity +
                                              1,
                                          )
                                        }
                                        disabled={
                                          itemUpdating
                                        }
                                        className="focus-ring grid h-full w-9 place-items-center text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={`Increase ${item.displayName || 'item'} quantity`}
                                      >
                                        <Plus
                                          size={15}
                                          strokeWidth={2.6}
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        mutateDirectCartItem(
                                          item,
                                          'remove',
                                        )
                                      }
                                      disabled={
                                        itemUpdating
                                      }
                                      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2
                                        size={13}
                                        aria-hidden="true"
                                      />
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-black text-stone-600">
                                    <Package
                                      size={12}
                                      aria-hidden="true"
                                    />

                                    {item.packCount} pack
                                    {Number(
                                      item.packCount,
                                    ) ===
                                    1
                                      ? ''
                                      : 's'}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 sm:min-w-[145px] sm:text-right">
                                <p className="text-[10px] font-black uppercase tracking-[0.11em] text-stone-400">
                                  Line total
                                </p>

                                <p className="mt-1 text-lg font-black text-stone-950">
                                  {formatMoney(
                                    item.lineTotal?.amountMinor,
                                    item.lineTotal?.currency,
                                  )}
                                </p>
                              </div>
                            </div>
                          )
                        },
                      )}
                    </div>
                  </div>
                </article>
              ),
            )}
          </section>

          <aside className="ep-cart-rise space-y-4 lg:sticky lg:top-24 [animation-delay:190ms]">
            <section className="overflow-hidden rounded-[30px] border border-emerald-200/80 bg-white/95 shadow-[0_20px_55px_rgba(6,78,59,0.10)] backdrop-blur-xl">
              <div className="bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_75%)] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-900 text-white shadow-lg shadow-emerald-950/15">
                    <ReceiptText
                      size={18}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                      Order summary
                    </p>

                    <h2 className="mt-0.5 text-lg font-black text-stone-950">
                      Cart subtotal
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-emerald-100/80 p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.11em] text-stone-500">
                      Items
                    </p>
                    <p className="mt-1.5 text-base font-black text-stone-950">
                      {itemCount} grocery pack{itemCount === 1 ? '' : 's'}
                      {pendingRecipeCount > 0 ? ` + ${pendingRecipeCount} recipe` : ''}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.11em] text-stone-500">
                      Seller splits
                    </p>
                    <p className="mt-1.5 text-base font-black text-stone-950">
                      {sellerGroups.length}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-800">
                        {pendingRecipeCount > 0 ? 'Priced products so far' : 'Item subtotal'}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold leading-4 text-emerald-900/55">
                        {pendingRecipeCount > 0 ? 'Recipe item prices are added after Host verification' : 'Before delivery fees and final order validation'}
                      </p>
                    </div>

                    <p className="shrink-0 text-2xl font-black tracking-tight text-emerald-950">
                      {formatMoney(
                        cart.itemSubtotalMinor,
                        cart.currency,
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (pendingRecipeCount > 0) {
                      void finalizeRecipeOrder(cartId)
                    } else {
                      navigate(`/checkout/${cartId}`)
                    }
                  }}
                  disabled={placingRecipeOrder}
                  className="ep-cart-sheen focus-ring group relative inline-flex w-full overflow-hidden items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#065f46_0%,#047857_100%)] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_26px_rgba(6,95,70,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(6,95,70,0.28)] disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="relative z-10">
                    {placingRecipeOrder ? 'Checking all items…' : 'Review & place order'}
                  </span>
                  <ArrowRight
                    size={17}
                    className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </button>

                <div className="grid gap-2.5 pt-1 text-xs font-semibold text-stone-600">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <ShieldCheck
                        size={14}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="pt-0.5">
                      Price and inventory revalidated at checkout
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <Truck
                        size={14}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="pt-0.5">
                      Delivery fee is calculated before payment
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-amber-200/90 bg-[linear-gradient(135deg,#fffbeb_0%,#fff7ed_100%)] p-4 shadow-[0_10px_28px_rgba(120,53,15,0.05)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <AlertTriangle
                    size={17}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="text-sm font-black text-amber-950">
                    Final total comes at checkout
                  </h2>

                  <p className="mt-1.5 text-xs font-semibold leading-5 text-amber-900/70">
                    Delivery fees, cancellation terms and return terms are confirmed before payment becomes available.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/70 bg-white/75 px-4 py-3 text-xs font-black text-emerald-800 shadow-sm backdrop-blur-xl">
              <CheckCircle2
                size={15}
                aria-hidden="true"
              />

              Marketplace selections remain seller-specific
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
