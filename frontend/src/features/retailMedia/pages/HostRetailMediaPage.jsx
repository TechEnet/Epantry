import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  Eye,
  ImagePlus,
  IndianRupee,
  MapPinned,
  Megaphone,
  Pause,
  PencilLine,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Undo2,
  X,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'react-router-dom'

import {
  createHostCampaign,
  listHostCampaigns,
  submitHostCampaign,
} from '../../hostOperations/services/hostOperations.service'

import {
  getCatalogProducts,
} from '../../grocery/services/catalog.service'


import {
  createRetailMediaCampaignFromBrief,
  createRetailMediaCampaignPaymentIntent,
  getHostRetailMediaPlacementAvailability,
  getHostRetailMediaPricing,
  getRetailMediaErrorMessage,
  listHostRetailMediaCampaigns,
  transitionRetailMediaCampaign,
  updateHostRetailMediaCampaign,
  uploadRetailMediaImage,
  verifyRetailMediaCampaignPayment,
} from '../services/retailMedia.service'

const RAZORPAY_CHECKOUT_URL =
  'https://checkout.razorpay.com/v1/checkout.js'

const inputClass =
  'focus-ring w-full rounded-[13px] border border-stone-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-stone-900 outline-none placeholder:text-stone-400 sm:px-3.5 sm:text-sm'

const primaryButtonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#176b57] px-3.5 py-2.5 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(23,107,87,0.16)] transition hover:bg-[#125846] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm'

const PLACEMENTS = [
  'home',
  'search',
  'recipe',
  'product_detail',
  'pantry_replenishment',
  'basket_compare',
  'post_purchase',
]

const TEST_PLACEMENT_PRICING_MINOR = Object.freeze({
  home: 250000,
  search: 200000,
  recipe: 120000,
  product_detail: 150000,
  pantry_replenishment: 100000,
  basket_compare: 180000,
  post_purchase: 80000,
})

const DEFAULT_DURATION_MINUTES = 1440

const FALLBACK_DURATION_OPTIONS = Object.freeze([
  { durationMinutes: 240, label: '4 hours' },
  { durationMinutes: 720, label: '12 hours' },
  { durationMinutes: 1440, label: '1 day' },
  { durationMinutes: 4320, label: '3 days' },
  { durationMinutes: 10080, label: '7 days' },
  { durationMinutes: 20160, label: '14 days' },
  { durationMinutes: 43200, label: '30 days' },
])

const FALLBACK_PLACEMENT_SLOTS = Object.freeze({
  home: [
    { key: 'hero', label: 'Hero section' },
    { key: 'explore_epantry', label: 'Explore EPANTRY' },
    { key: 'featured_content', label: 'Featured content' },
  ],
  search: [
    { key: 'search_top', label: 'Top of search results' },
    { key: 'search_best_match', label: 'After best match' },
    { key: 'search_more_options', label: 'Before more options' },
  ],
  recipe: [
    { key: 'recipe_hero', label: 'Recipe hero' },
    { key: 'recipe_collection', label: 'Recipe collection' },
    { key: 'recipe_restaurants', label: 'Restaurant recipes' },
  ],
  product_detail: [
    { key: 'product_overview', label: 'Product overview' },
    { key: 'product_details', label: 'Product details' },
    { key: 'product_recommendations', label: 'Product recommendations' },
  ],
  pantry_replenishment: [
    { key: 'pantry_header', label: 'Next Basket header' },
    { key: 'pantry_steps', label: 'How this page works' },
    { key: 'pantry_suggestions', label: 'Shopping suggestions' },
  ],
  basket_compare: [
    { key: 'basket_compare_header', label: 'Compare header' },
    { key: 'basket_compare_results', label: 'Comparison results' },
    { key: 'basket_compare_checkout', label: 'Before checkout options' },
  ],
  post_purchase: [
    { key: 'post_purchase_summary', label: 'Order summary' },
    { key: 'post_purchase_items', label: 'Order items' },
    { key: 'post_purchase_follow_up', label: 'After-order actions' },
  ],
})

const PLACEMENT_META = Object.freeze({
  home: {
    label: 'Home',
    description: 'Choose a visible section on the EPANTRY homepage.',
    previewTitle: 'EPANTRY Home',
  },
  search: {
    label: 'Search',
    description: 'Place the promotion around customer search results.',
    previewTitle: 'Search results',
  },
  recipe: {
    label: 'Recipes',
    description: 'Choose where the promotion appears in recipe discovery.',
    previewTitle: 'Recipes',
  },
  product_detail: {
    label: 'Product Detail',
    description: 'Choose a position on product detail pages.',
    previewTitle: 'Product detail',
  },
  pantry_replenishment: {
    label: 'Pantry Replenishment',
    description: 'Choose a position around Next Basket recommendations.',
    previewTitle: 'Next Basket',
  },
  basket_compare: {
    label: 'Basket Compare',
    description: 'Choose a position inside the basket comparison flow.',
    previewTitle: 'Basket comparison',
  },
  post_purchase: {
    label: 'Post Purchase',
    description: 'Choose where the promotion appears after an order.',
    previewTitle: 'Order details',
  },
})

const STEP_CARDS = [
  {
    number: '01',
    title: 'Campaign basics',
    text: 'Name the promotion and explain the offer.',
    className: 'border-[#b9e9d8] bg-[#e6f8f1]',
  },
  {
    number: '02',
    title: 'Pick exact positions',
    text: 'Open each page preview and choose the section.',
    className: 'border-[#bddff2] bg-[#e9f5fb]',
  },
  {
    number: '03',
    title: 'Creative & payment',
    text: 'Add the ad content, image and complete payment.',
    className: 'border-[#d8cff2] bg-[#f1edfb]',
  },
  {
    number: '04',
    title: 'Approval & start',
    text: 'Super Admin reviews it before customers can see it.',
    className: 'border-[#b9e9d8] bg-[#edf9f4]',
  },
]

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatMoneyMinor(
  amountMinor,
  currency = 'INR',
) {
  const amount = Number(amountMinor || 0) / 100

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

function formatDurationMinutes(value) {
  const minutes = Number(value || DEFAULT_DURATION_MINUTES)

  if (minutes < 1440) {
    const hours = minutes / 60
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }

  const days = minutes / 1440
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function formatDateTime(value) {
  if (!value) return 'Starts when ready'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Starts when ready'
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function newBriefForm() {
  return {
    title: '',
    objective: 'awareness',
    commercialDisclosure: '',
  }
}

function newCampaignForm() {
  return {
    briefId: '',
    placementSelections: [],
    durationMinutes: DEFAULT_DURATION_MINUTES,
    scheduledStartAt: null,
    contextualTags: '',
    headline: '',
    body: '',
    landingRef: '',
    sponsorLabel: 'Sponsored',
    imageUrl: '',
  }
}

let razorpayScriptPromise = null

function loadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return Promise.resolve(false)
  }

  if (window.Razorpay) {
    return Promise.resolve(true)
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise
  }

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      `script[src="${RAZORPAY_CHECKOUT_URL}"]`,
    )

    if (existing) {
      existing.addEventListener(
        'load',
        () => resolve(Boolean(window.Razorpay)),
        { once: true },
      )
      existing.addEventListener(
        'error',
        () => resolve(false),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_CHECKOUT_URL
    script.async = true
    script.dataset.epantryRetailMediaRazorpay = 'true'
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}

export default function HostRetailMediaPage() {
  const [searchParams] = useSearchParams()
  const focusCampaignId = searchParams.get('focusCampaign') || ''

  const [briefs, setBriefs] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [pricing, setPricing] = useState(null)
  const [briefForm, setBriefForm] = useState(newBriefForm())
  const [campaignForm, setCampaignForm] = useState(newCampaignForm())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payingCampaignId, setPayingCampaignId] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [placementModal, setPlacementModal] = useState(null)
  const [placementPreviewUrl, setPlacementPreviewUrl] = useState('')
  const [placementPreviewLoading, setPlacementPreviewLoading] = useState(false)
  const [placementPreviewError, setPlacementPreviewError] = useState('')
  const [availabilityBySlot, setAvailabilityBySlot] = useState({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [briefResult, campaignResult, pricingResult] =
        await Promise.allSettled([
          listHostCampaigns(),
          listHostRetailMediaCampaigns(),
          getHostRetailMediaPricing(),
        ])

      let criticalError = ''

      if (briefResult.status === 'fulfilled') {
        setBriefs(briefResult.value?.campaignBriefs || [])
      } else {
        criticalError = getRetailMediaErrorMessage(
          briefResult.reason,
          'Unable to load campaign basics right now.',
        )
      }

      if (campaignResult.status === 'fulfilled') {
        setCampaigns(campaignResult.value?.campaigns || [])
      } else if (!criticalError) {
        criticalError = getRetailMediaErrorMessage(
          campaignResult.reason,
          'Unable to load your campaigns right now.',
        )
      }

      if (pricingResult.status === 'fulfilled') {
        setPricing(pricingResult.value || null)
      } else {
        setPricing(null)
      }

      if (criticalError) {
        setError(criticalError)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!focusCampaignId || loading) return undefined

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`host-retail-media-campaign-${focusCampaignId}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [focusCampaignId, campaigns, loading])

  const submittedBriefs = useMemo(
    () =>
      briefs.filter(
        (brief) =>
          brief.status === 'submitted_for_future_media_review',
      ),
    [briefs],
  )

  const selectedBrief = useMemo(
    () =>
      submittedBriefs.find(
        (brief) => brief.id === campaignForm.briefId,
      ) || null,
    [campaignForm.briefId, submittedBriefs],
  )

  const editingCampaign = useMemo(
    () =>
      campaigns.find(
        (campaign) => campaign.id === editingCampaignId,
      ) || null,
    [campaigns, editingCampaignId],
  )

  const editingPaidCampaign =
    editingCampaign?.payment?.status === 'paid'

  const editingPaidBookingIncomplete =
    editingPaidCampaign &&
    (editingCampaign?.placementSelections || []).length <
      (editingCampaign?.placements || []).length

  const editingBookingLocked =
    editingPaidCampaign &&
    !editingPaidBookingIncomplete

  const pricingByPlacement = useMemo(() => {
    const map = new Map(
      PLACEMENTS.map((placement) => [
        placement,
        TEST_PLACEMENT_PRICING_MINOR[placement] || 0,
      ]),
    )

    for (const item of pricing?.placementPricing || []) {
      const amountMinor = Number(item.amountMinor || 0)
      if (amountMinor > 0) {
        map.set(item.placement, amountMinor)
      }
    }

    return map
  }, [pricing])

  const durationOptions = useMemo(() => {
    const options =
      Array.isArray(pricing?.durationOptions) && pricing.durationOptions.length
        ? pricing.durationOptions
        : FALLBACK_DURATION_OPTIONS

    return options.map((option) => ({
      durationMinutes:
        Number(option.durationMinutes) || DEFAULT_DURATION_MINUTES,
      label:
        option.label || formatDurationMinutes(option.durationMinutes),
    }))
  }, [pricing])

  const placementSlots =
    pricing?.placementSlots || FALLBACK_PLACEMENT_SLOTS

  const selectedDurationMinutes =
    Number(campaignForm.durationMinutes) || DEFAULT_DURATION_MINUTES

  const baseDurationMinutes =
    Number(pricing?.baseDurationMinutes) || DEFAULT_DURATION_MINUTES

  const selectedPlacements = useMemo(
    () =>
      campaignForm.placementSelections.map(
        (selection) => selection.placement,
      ),
    [campaignForm.placementSelections],
  )

  const paidLegacyPlacementComplete =
    !editingPaidBookingIncomplete ||
    (editingCampaign?.placements || []).every(
      (placement) => selectedPlacements.includes(placement),
    )

  const selectedPlacementTotalMinor = useMemo(
    () =>
      selectedPlacements.reduce((total, placement) => {
        const baseAmount = Number(pricingByPlacement.get(placement) || 0)
        return (
          total +
          Math.max(
            1,
            Math.round(
              (baseAmount * selectedDurationMinutes) /
                baseDurationMinutes,
            ),
          )
        )
      }, 0),
    [
      selectedPlacements,
      pricingByPlacement,
      selectedDurationMinutes,
      baseDurationMinutes,
    ],
  )

  async function run(task, successMessage) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await task()
      setNotice(successMessage)
      await load()
    } catch (requestError) {
      setError(getRetailMediaErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function createBrief() {
    await run(
      async () => {
        await createHostCampaign({
          brandId: null,
          authorityGrantId: null,
          title: briefForm.title,
          objective: briefForm.objective,
          marketCodes: ['IN'],
          requestedPlacements: [],
          startsAt: null,
          endsAt: null,
          budgetAmountMinor: 0,
          currency: 'INR',
          promotedEntityType: 'generic',
          promotedEntityId: '',
          commercialDisclosure: briefForm.commercialDisclosure,
        })
        setBriefForm(newBriefForm())
      },
      'Campaign basics saved. Click Continue on the campaign you want to set up.',
    )
  }

  async function submitBrief(briefId) {
    await run(
      async () => {
        await submitHostCampaign(briefId)
        setCampaignForm((current) => ({
          ...current,
          briefId,
        }))
      },
      'Campaign basics are ready. Now choose the exact page positions, duration and ad content.',
    )
  }

  async function saveCampaign() {
    const tags = campaignForm.contextualTags
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    const sharedInput = {
      placements: selectedPlacements,
      placementSelections:
        campaignForm.placementSelections.map((selection) => ({
          placement: selection.placement,
          slotKey: selection.slotKey,
        })),
      durationMinutes: selectedDurationMinutes,
      startsAt: campaignForm.scheduledStartAt || null,
      contextualTags: tags,
      frequencyCapPerContext: 3,
      headline: campaignForm.headline,
      body: campaignForm.body,
      landingRef: campaignForm.landingRef,
      sponsorLabel: campaignForm.sponsorLabel,
      imageUrl: campaignForm.imageUrl,
    }

    await run(
      async () => {
        if (editingCampaignId) {
          await updateHostRetailMediaCampaign({
            campaignId: editingCampaignId,
            input: sharedInput,
          })
          setEditingCampaignId('')
        } else {
          await createRetailMediaCampaignFromBrief({
            briefId: campaignForm.briefId,
            input: {
              ...sharedInput,
              endsAt: null,
              dailyBudgetMinor: 0,
              lifetimeBudgetMinor: selectedPlacementTotalMinor,
              bidMinor: 0,
              qualityScore: 50,
            },
          })
        }

        setCampaignForm(newCampaignForm())
      },
      editingCampaignId
        ? 'Campaign changes saved. Super Admin will review the updated creative before it can run.'
        : 'Campaign created with its final positions. Complete payment from Your campaigns to send it for Super Admin review.',
    )
  }

  function beginEditCampaign(campaign) {
    if (!campaign?.id) return

    if (['active', 'paused', 'ended'].includes(campaign.status)) {
      setError('Running or ended campaigns cannot be edited from here.')
      return
    }

    const paidBookingIncomplete =
      campaign.payment?.status === 'paid' &&
      (campaign.placementSelections || []).length <
        (campaign.placements || []).length

    setError('')
    setNotice(
      campaign.payment?.status === 'paid'
        ? paidBookingIncomplete
          ? 'This paid campaign was created before exact page sections were added. Choose the exact section for each already-paid placement, then update the creative.'
          : 'Editing paid campaign creative. Its booked page positions, duration and start time stay locked.'
        : 'Campaign loaded for editing. You can update the creative, image, duration and exact positions before payment.',
    )

    setEditingCampaignId(campaign.id)
    setCampaignForm({
      briefId: campaign.sourceHostCampaignBriefId || '',
      placementSelections: (campaign.placementSelections || []).map(
        (selection) => ({
          placement: selection.placement,
          slotKey: selection.slotKey,
          slotLabel:
            selection.slotLabel || titleize(selection.slotKey),
        }),
      ),
      durationMinutes:
        Number(campaign.durationMinutes) || DEFAULT_DURATION_MINUTES,
      scheduledStartAt:
        campaign.scheduledStartsAt || null,
      contextualTags:
        (campaign.contextualTags || []).join(', '),
      headline:
        campaign.creative?.headline || '',
      body:
        campaign.creative?.body || '',
      landingRef:
        campaign.creative?.landingRef || '',
      sponsorLabel:
        campaign.creative?.sponsorLabel || 'Sponsored',
      imageUrl:
        campaign.creative?.imageUrl || '',
    })

    window.requestAnimationFrame(() => {
      document
        .getElementById('host-retail-media-editor')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    })
  }

  function cancelCampaignEdit() {
    setEditingCampaignId('')
    setCampaignForm(newCampaignForm())
    setNotice('Campaign edit cancelled.')
  }

  async function transition(campaignId, action) {
    await run(
      () =>
        transitionRetailMediaCampaign({
          campaignId,
          action,
        }),
      action === 'activate'
        ? 'Campaign activated. It will appear only inside its booked window.'
        : action === 'pause'
          ? 'Campaign paused.'
          : 'Campaign resumed.',
    )
  }

  async function handleImageUpload(file) {
    if (!file) return

    setUploadingImage(true)
    setError('')
    setNotice('')

    try {
      const result = await uploadRetailMediaImage({ file })
      setCampaignForm((current) => ({
        ...current,
        imageUrl: result.imageUrl,
      }))
      setNotice('Campaign image uploaded. It will be shown to Super Admin and customers with the approved ad.')
    } catch (requestError) {
      setError(
        getRetailMediaErrorMessage(
          requestError,
          'Unable to upload the campaign image.',
        ),
      )
    } finally {
      setUploadingImage(false)
    }
  }

  async function resolvePlacementPreviewPath(placement) {
    if (placement === 'home') {
      return '/'
    }

    if (placement === 'search') {
      return '/grocery/search-results?q=milk'
    }

    if (placement === 'recipe') {
      return '/recipes'
    }

    if (placement === 'product_detail') {
      const result = await getCatalogProducts({
        page: 1,
        limit: 1,
        listedOnly: true,
      })

      const product = result?.products?.[0] || null
      const slug = String(product?.slug || '').trim()

      if (!slug) {
        throw new Error('No listed product is available for the live Product Detail preview yet.')
      }

      return `/grocery/product/${encodeURIComponent(slug)}`
    }

    if (placement === 'pantry_replenishment') {
      return '/next-basket'
    }

    if (placement === 'basket_compare') {
      return '/outcome-plans/000000000000000000000001/compare'
    }

    if (placement === 'post_purchase') {
      return '/orders/retail-media-preview'
    }

    return '/'
  }

  function appendPreviewQuery(path, placement) {
    const separator = path.includes('?') ? '&' : '?'
    const selectedSlotKey =
      campaignForm.placementSelections.find(
        (item) => item.placement === placement,
      )?.slotKey || ''

    const query = new URLSearchParams({
      retailMediaPreview: '1',
      retailMediaPlacement: placement,
      ...(selectedSlotKey
        ? { retailMediaSelectedSlot: selectedSlotKey }
        : {}),
    })

    return `${path}${separator}${query.toString()}`
  }

  async function openPlacementChooser(placement) {
    if (!campaignForm.briefId) {
      setError('Choose the campaign you want to promote first.')
      return
    }

    if (editingBookingLocked) {
      setError('Page position and duration stay locked after campaign payment. You can still edit the image, headline, message and landing destination.')
      return
    }

    if (
      editingPaidBookingIncomplete &&
      !(editingCampaign?.placements || []).includes(placement)
    ) {
      setError('This older paid campaign can choose an exact section only inside the page placements that were already paid for.')
      return
    }

    setPlacementModal(placement)
    setPlacementPreviewUrl('')
    setPlacementPreviewError('')
    setPlacementPreviewLoading(true)
    setAvailabilityBySlot({})
    setAvailabilityLoading(true)

    const slots = placementSlots[placement] || []

    try {
      const [previewResult, availabilityResults] = await Promise.all([
        resolvePlacementPreviewPath(placement)
          .then((path) => ({ path }))
          .catch((previewError) => ({ error: previewError })),
        Promise.all(
          slots.map(async (slot) => {
            try {
              const result = await getHostRetailMediaPlacementAvailability({
                placement,
                slotKey: slot.key,
                durationMinutes: selectedDurationMinutes,
                requestedStartAt: campaignForm.scheduledStartAt,
              })

              return [slot.key, result?.availability || null]
            } catch {
              return [slot.key, null]
            }
          }),
        ),
      ])

      setAvailabilityBySlot(Object.fromEntries(availabilityResults))

      if (previewResult?.path) {
        setPlacementPreviewUrl(
          appendPreviewQuery(previewResult.path, placement),
        )
      } else {
        setPlacementPreviewError(
          previewResult?.error?.message ||
            'The live page preview could not be opened.',
        )
      }
    } finally {
      setPlacementPreviewLoading(false)
      setAvailabilityLoading(false)
    }
  }

  function choosePlacementSlot(slot, availability) {
    if (!placementModal) return

    const nextStart =
      availability?.available === false
        ? availability.nextAvailableAt
        : campaignForm.scheduledStartAt

    setCampaignForm((current) => ({
      ...current,
      scheduledStartAt: nextStart || null,
      placementSelections: [
        ...current.placementSelections.filter(
          (item) => item.placement !== placementModal,
        ),
        {
          placement: placementModal,
          slotKey: slot.key,
          slotLabel: slot.label,
        },
      ],
    }))

    setPlacementModal(null)
  }

  function removePlacement(placement) {
    setCampaignForm((current) => ({
      ...current,
      placementSelections: current.placementSelections.filter(
        (item) => item.placement !== placement,
      ),
    }))
  }

  useEffect(() => {
    if (!placementModal) {
      return undefined
    }

    function handlePreviewMessage(event) {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== 'epantry-retail-media-placement-select' ||
        event.data?.placement !== placementModal
      ) {
        return
      }

      const slot =
        (placementSlots[placementModal] || []).find(
          (item) => item.key === event.data?.slotKey,
        ) || null

      if (!slot) {
        return
      }

      const availability =
        availabilityBySlot[slot.key]

      if (!availability) {
        setNotice('Checking this page position. Select it again when availability is ready.')
        return
      }

      choosePlacementSlot(
        slot,
        availability,
      )
    }

    window.addEventListener(
      'message',
      handlePreviewMessage,
    )

    return () => {
      window.removeEventListener(
        'message',
        handlePreviewMessage,
      )
    }
  }, [
    availabilityBySlot,
    placementModal,
    placementSlots,
  ])

  async function payCampaign(campaign) {
    setPayingCampaignId(campaign.id)
    setError('')
    setNotice('')

    try {
      const payment =
        await createRetailMediaCampaignPaymentIntent({
          campaignId: campaign.id,
        })

      if (payment?.alreadyPaid) {
        setNotice('Campaign payment is already complete.')
        await load()
        return
      }

      const checkout = payment?.checkout

      if (
        !checkout?.configured ||
        !checkout?.keyId ||
        !checkout?.providerOrderId
      ) {
        throw new Error('Razorpay test payment is not configured.')
      }

      if (checkout.mode !== 'test') {
        throw new Error(
          'Campaign payments are restricted to Razorpay test mode right now.',
        )
      }

      const loaded = await loadRazorpayCheckout()

      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay test checkout.')
      }

      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountMinor,
        currency: checkout.currency,
        name: 'EPANTRY',
        description: `Sponsored campaign: ${campaign.title}`,
        order_id: checkout.providerOrderId,
        handler: async (response) => {
          try {
            await verifyRetailMediaCampaignPayment({
              campaignId: campaign.id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            })

            setNotice(
              'Payment received. The selected page positions are reserved and the campaign is waiting for Super Admin review.',
            )
            await load()
          } catch (verifyError) {
            setError(
              getRetailMediaErrorMessage(
                verifyError,
                'Payment returned but verification failed.',
              ),
            )
          } finally {
            setPayingCampaignId('')
          }
        },
        modal: {
          ondismiss: () => setPayingCampaignId(''),
        },
        theme: {
          color: '#176b57',
        },
      })

      razorpay.on('payment.failed', () => {
        setError(
          'Payment was not completed. The campaign has not been sent for approval.',
        )
        setPayingCampaignId('')
      })

      razorpay.open()
    } catch (paymentError) {
      setError(
        getRetailMediaErrorMessage(
          paymentError,
          'Unable to start campaign payment.',
        ),
      )
      setPayingCampaignId('')
    }
  }

  return (
    <div className="p-2.5 sm:p-5 lg:p-6">
      <section className="border-b border-[#c9ded6] bg-[linear-gradient(120deg,#e7f6ef_0%,#edf5fb_52%,#f2edfb_100%)] px-3 py-4 sm:rounded-[24px] sm:border sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#176b57] sm:text-[10px]">
              Sponsored campaigns
            </p>
            <h1 className="mt-1 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
              Build your promotion, choose the exact space, then go live after approval.
            </h1>
            <p className="mt-2 max-w-4xl text-[11px] font-semibold leading-5 text-stone-600 sm:text-sm sm:leading-6">
              Start with the campaign details, pick the exact section where customers should see the ad, choose the run time, add the creative, and pay only after the positions are final.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading || busy || Boolean(payingCampaignId)}
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#acdcca] bg-white/90 px-3 py-2 text-[10px] font-black text-[#176b57] shadow-sm disabled:opacity-40 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 xl:grid-cols-4">
          {STEP_CARDS.map((step) => (
            <div
              key={step.number}
              className={`min-w-0 rounded-[14px] border p-2.5 sm:rounded-[18px] sm:p-4 ${step.className}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-8 sm:text-[10px]">
                  {step.number}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black leading-tight text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[8px] font-semibold leading-[1.4] text-stone-600 sm:text-[10px] sm:leading-4">
                    {step.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 min-h-5 text-[10px] font-bold sm:text-sm" aria-live="polite">
          {error ? (
            <p className="text-red-700">{error}</p>
          ) : notice ? (
            <p className="text-[#176b57]">{notice}</p>
          ) : loading ? (
            <p className="text-stone-500">Loading campaign workspace…</p>
          ) : null}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(250px,1fr)] lg:items-start">
        <section id="host-retail-media-editor" className="scroll-mt-24 overflow-hidden rounded-[24px] border border-stone-200 bg-[#f9f8f4] shadow-[0_14px_36px_rgba(28,25,23,0.06)]">
          <div className="px-3 py-4 sm:px-6 sm:py-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#dff3ea] text-[#176b57] sm:size-10">
                <Megaphone size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#176b57]">
                  Step 1
                </p>
                <h2 className="mt-0.5 text-lg font-black text-stone-950 sm:text-2xl">
                  Campaign basics
                </h2>
                <p className="mt-1 max-w-2xl text-[10px] font-semibold leading-5 text-stone-600 sm:text-sm">
                  Give the campaign a clear name, choose what you want it to achieve, and explain the offer customers should understand.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                value={briefForm.title}
                onChange={(event) =>
                  setBriefForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Campaign name"
              />

              <select
                className={inputClass}
                value={briefForm.objective}
                onChange={(event) =>
                  setBriefForm((current) => ({
                    ...current,
                    objective: event.target.value,
                  }))
                }
              >
                <option value="awareness">Build awareness</option>
                <option value="consideration">Get consideration</option>
                <option value="conversion">Drive purchases</option>
                <option value="sampling">Promote sampling</option>
                <option value="promotion">Promote an offer</option>
              </select>

              <textarea
                rows={2}
                className={`${inputClass} sm:col-span-2`}
                value={briefForm.commercialDisclosure}
                onChange={(event) =>
                  setBriefForm((current) => ({
                    ...current,
                    commercialDisclosure: event.target.value,
                  }))
                }
                placeholder="Explain what you are promoting and any offer customers should know about."
              />
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !briefForm.title.trim() ||
                briefForm.commercialDisclosure.trim().length < 5
              }
              onClick={createBrief}
              className={`${primaryButtonClass} mt-3`}
            >
              <Megaphone size={15} aria-hidden="true" />
              Save campaign basics
            </button>

            {briefs.length ? (
              <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200 bg-white/70">
                {briefs.map((brief) => (
                  <div
                    key={brief.id}
                    className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black text-stone-900 sm:text-sm">
                        {brief.title}
                      </p>
                      <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
                        {titleize(brief.objective)} · {brief.status === 'draft' ? 'Basics saved' : 'Ready for ad setup'}
                      </p>
                    </div>

                    {brief.status === 'draft' ? (
                      <button
                        type="button"
                        disabled={busy || Boolean(editingCampaignId)}
                        onClick={() => submitBrief(brief.id)}
                        className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#b8dccf] bg-white px-2.5 py-1.5 text-[9px] font-black text-[#176b57] sm:px-3 sm:py-2 sm:text-xs"
                      >
                        <Send size={12} aria-hidden="true" />
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(editingCampaignId)}
                        onClick={() =>
                          setCampaignForm((current) => ({
                            ...current,
                            briefId: brief.id,
                          }))
                        }
                        className={`focus-ring rounded-full px-2.5 py-1.5 text-[9px] font-black disabled:cursor-not-allowed disabled:opacity-45 ${
                          campaignForm.briefId === brief.id
                            ? 'bg-[#176b57] text-white'
                            : 'bg-[#e2f5ed] text-[#176b57]'
                        }`}
                      >
                        {campaignForm.briefId === brief.id ? 'Selected' : 'Use campaign'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-stone-200 bg-[#edf5fb]/55 px-3 py-4 sm:px-6 sm:py-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#dcecf6] text-[#2c789d] sm:size-10">
                <MapPinned size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#2c789d]">
                  Step 2 & 3
                </p>
                <h2 className="mt-0.5 text-lg font-black text-stone-950 sm:text-2xl">
                  Placement & sponsored content
                </h2>
                <p className="mt-1 max-w-2xl text-[10px] font-semibold leading-5 text-stone-600 sm:text-sm">
                  Choose the campaign, pick the exact page sections, set how long it should run, then add the ad customers will see.
                </p>
              </div>
            </div>

            {editingCampaign ? (
              <div className="mt-4 flex flex-col gap-3 border-y border-[#d9d0ee] bg-[#f4f0fb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#6c52a4]">
                    Editing existing campaign
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-stone-950">
                    {editingCampaign.title}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-600 sm:text-[10px]">
                    {editingPaidCampaign
                      ? editingPaidBookingIncomplete
                        ? 'This older paid campaign still needs its exact page section selected. The paid placement type and duration stay fixed; after saving, Super Admin reviews the updated campaign again.'
                        : 'Payment is complete, so the booked page positions, duration and start time are locked. Creative changes will return this campaign to Super Admin review.'
                      : 'Update the exact positions, duration, image and sponsored content, then save the changes.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelCampaignEdit}
                  className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-[11px] border border-[#d3cae8] bg-white px-3 py-2 text-[10px] font-black text-[#5f4a95]"
                >
                  <Undo2 size={14} aria-hidden="true" />
                  Cancel edit
                </button>
              </div>
            ) : null}

            {!selectedBrief ? (
              <div className="mt-4 border-l-4 border-[#67b89e] bg-[#e6f7f0] px-3 py-3 text-[10px] font-semibold leading-5 text-stone-700 sm:text-xs">
                Select a campaign from Campaign basics above before choosing positions.
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-3 border-y border-[#cbdfe9] bg-white/70 px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-500">
                    Campaign being promoted
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-stone-950">
                    {selectedBrief.title}
                  </p>
                </div>
                <BadgeCheck size={18} className="shrink-0 text-[#176b57]" aria-hidden="true" />
              </div>
            )}

            <div className="mt-4 border border-[#cfe1eb] bg-white/80">
              <div className="flex flex-col gap-3 border-b border-[#d7e5ec] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <p className="text-[10px] font-black text-stone-950 sm:text-sm">
                    Choose placements and duration
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-[10px]">
                    Click a page below to open its visual preview and choose the exact section.
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:shrink-0">
                  <div className="min-w-0">
                    <p className="mb-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#315f7a]">
                      Campaign duration
                    </p>
                    <select
                      className={`${inputClass} min-w-[145px]`}
                      disabled={!campaignForm.briefId || editingPaidCampaign}
                      value={campaignForm.durationMinutes}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          durationMinutes: Number(event.target.value),
                          scheduledStartAt: null,
                        }))
                      }
                    >
                      {durationOptions.map((option) => (
                        <option
                          key={option.durationMinutes}
                          value={option.durationMinutes}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="self-end rounded-xl bg-[#e5f7f0] px-3 py-2.5 text-sm font-black text-[#176b57]">
                    {formatMoneyMinor(
                      selectedPlacementTotalMinor,
                      pricing?.currency || 'INR',
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-stone-200 sm:grid-cols-3 lg:grid-cols-4">
                {PLACEMENTS.map((placement) => {
                  const selected = campaignForm.placementSelections.find(
                    (item) => item.placement === placement,
                  )
                  const amountMinor = Number(pricingByPlacement.get(placement) || 0)
                  const durationPrice = Math.max(
                    1,
                    Math.round(
                      (amountMinor * selectedDurationMinutes) /
                        baseDurationMinutes,
                    ),
                  )

                  return (
                    <div key={placement} className="min-w-0 bg-white p-2.5 sm:p-3">
                      <button
                        type="button"
                        disabled={
                          !campaignForm.briefId ||
                          editingBookingLocked ||
                          (
                            editingPaidBookingIncomplete &&
                            !(editingCampaign?.placements || []).includes(placement)
                          )
                        }
                        onClick={() => openPlacementChooser(placement)}
                        className={`focus-ring block w-full text-left disabled:cursor-not-allowed disabled:opacity-45 ${
                          selected ? 'text-[#176b57]' : 'text-stone-900'
                        }`}
                      >
                        <span className="block truncate text-[10px] font-black sm:text-xs">
                          {PLACEMENT_META[placement]?.label || titleize(placement)}
                        </span>
                        <span className="mt-1 block text-[8px] font-bold text-stone-500 sm:text-[9px]">
                          {formatMoneyMinor(durationPrice, pricing?.currency || 'INR')}
                        </span>
                        <span className={`mt-1.5 block min-h-[28px] text-[8px] font-black leading-4 sm:text-[9px] ${selected ? 'text-[#176b57]' : 'text-[#2c789d]'}`}>
                          {selected ? selected.slotLabel : 'Choose exact section →'}
                        </span>
                      </button>

                      {selected && !editingPaidCampaign ? (
                        <button
                          type="button"
                          onClick={() => removePlacement(placement)}
                          className="mt-1 text-[8px] font-black text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 border-l-4 border-[#8dbbd2] bg-[#edf6fb] px-3 py-2.5 text-[9px] font-semibold leading-4 text-[#315f7a] sm:text-[10px]">
              <Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                The ad can run only after Super Admin approval and activation. If a chosen section is already booked, EPANTRY shows when it becomes free so you can pre-book the next available window.
              </p>
            </div>

            {campaignForm.scheduledStartAt ? (
              <div className="mt-3 flex items-center gap-2 bg-[#fff3dc] px-3 py-2.5 text-[9px] font-bold text-[#7b571e] sm:text-[10px]">
                <CalendarClock size={14} aria-hidden="true" />
                Pre-booked start: {formatDateTime(campaignForm.scheduledStartAt)}. Final availability is checked again before payment.
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 border-t border-[#cfdfe7] pt-4">
              <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden border border-stone-200 bg-white">
                  {campaignForm.imageUrl ? (
                    <div className="relative h-[150px]">
                      <img
                        src={campaignForm.imageUrl}
                        alt="Campaign creative preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCampaignForm((current) => ({
                            ...current,
                            imageUrl: '',
                          }))
                        }
                        className="focus-ring absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-stone-700 shadow"
                        aria-label="Remove campaign image"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <label className="focus-ring flex h-[150px] cursor-pointer flex-col items-center justify-center gap-2 bg-[#f6f5f1] px-4 text-center">
                      <ImagePlus size={26} className="text-[#176b57]" aria-hidden="true" />
                      <span className="text-[10px] font-black text-stone-900 sm:text-xs">
                        Add campaign image
                      </span>
                      <span className="text-[8px] font-semibold text-stone-500 sm:text-[9px]">
                        JPEG, PNG or WebP
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={!campaignForm.briefId || uploadingImage}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          handleImageUpload(file)
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="grid gap-2.5">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <input
                      className={inputClass}
                      disabled={!campaignForm.briefId}
                      value={campaignForm.headline}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          headline: event.target.value,
                        }))
                      }
                      placeholder="Ad headline customers will see"
                    />

                    <div>
                      <select
                        className={inputClass}
                        disabled={!campaignForm.briefId}
                        value={campaignForm.sponsorLabel}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            sponsorLabel: event.target.value,
                          }))
                        }
                      >
                        <option value="Sponsored">Sponsored</option>
                        <option value="Ad">Ad</option>
                        <option value="Paid placement">Paid placement</option>
                      </select>
                      <p className="mt-1 text-[8px] font-semibold text-stone-500">
                        Customer label: Sponsored / Ad / Paid placement
                      </p>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    className={inputClass}
                    disabled={!campaignForm.briefId}
                    value={campaignForm.body}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Short message explaining the promotion"
                  />

                  <input
                    className={inputClass}
                    disabled={!campaignForm.briefId}
                    value={campaignForm.landingRef}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        landingRef: event.target.value,
                      }))
                    }
                    placeholder="Where should customers land after clicking the ad?"
                  />

                  <input
                    className={inputClass}
                    disabled={!campaignForm.briefId}
                    value={campaignForm.contextualTags}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        contextualTags: event.target.value,
                      }))
                    }
                    placeholder="Optional context: cuisine, occasion, ingredient family"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-y border-[#d8d0ef] bg-[#f3effb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-stone-950 sm:text-sm">
                    Final amount before payment
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-[10px]">
                    {selectedPlacements.length} selected page {selectedPlacements.length === 1 ? 'position' : 'positions'} · {formatDurationMinutes(selectedDurationMinutes)}. Payment becomes available after this setup is saved.
                  </p>
                </div>
                <p className="shrink-0 text-xl font-black text-[#5f4a95] sm:text-2xl">
                  {formatMoneyMinor(
                    selectedPlacementTotalMinor,
                    pricing?.currency || 'INR',
                  )}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busy ||
                  !campaignForm.briefId ||
                  !campaignForm.placementSelections.length ||
                  !paidLegacyPlacementComplete ||
                  selectedPlacementTotalMinor <= 0 ||
                  !campaignForm.headline.trim() ||
                  !campaignForm.landingRef.trim()
                }
                onClick={saveCampaign}
                className={primaryButtonClass}
              >
                <ShieldCheck size={15} aria-hidden="true" />
                {editingCampaignId
                  ? 'Save campaign changes'
                  : 'Finalize positions & create campaign'}
              </button>
            </div>
          </div>
        </section>

        <aside className="self-start rounded-[22px] border border-[#d7d0ee] bg-[linear-gradient(160deg,#f4f1fb_0%,#fbf9ff_100%)] p-3 shadow-[0_12px_28px_rgba(95,74,149,0.07)] sm:p-4 lg:sticky lg:top-24">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-white text-[#6c52a4] shadow-sm">
              <BadgeCheck size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-black text-stone-950 sm:text-lg">
                  Your campaigns
                </h2>
                <span className="rounded-full border border-[#ddd4ef] bg-white px-2 py-1 text-[8px] font-black text-[#6c52a4]">
                  {campaigns.length}
                </span>
              </div>
              <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-600 sm:text-[10px]">
                Pay after the page positions are final. Super Admin then reviews the exact creative, duration and booked sections.
              </p>
            </div>
          </div>

          <div className="mt-3 max-h-[72vh] space-y-3 overflow-y-auto pr-1">
            {campaigns.length ? (
              campaigns.map((campaign) => {
                const payment = campaign.payment || {}
                const isPaid = payment.status === 'paid'
                const isPaying = payingCampaignId === campaign.id

                return (
                  <article
                    id={`host-retail-media-campaign-${campaign.id}`}
                    key={campaign.id}
                    className={`scroll-mt-28 overflow-hidden rounded-[16px] border bg-white p-3 shadow-[0_7px_18px_rgba(95,74,149,0.06)] ${
                      focusCampaignId === campaign.id
                        ? 'border-[#3fb98a] ring-4 ring-[#dff5ec]'
                        : 'border-[#ded7f0]'
                    }`}
                  >
                    {campaign.creative?.imageUrl ? (
                      <img
                        src={campaign.creative.imageUrl}
                        alt=""
                        className="mb-3 h-28 w-full rounded-[12px] object-cover"
                      />
                    ) : null}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black text-stone-950 sm:text-sm">
                          {campaign.title}
                        </p>
                        <p className="mt-0.5 text-[8px] font-bold text-stone-500 sm:text-[9px]">
                          {formatDurationMinutes(campaign.durationMinutes)} · {titleize(campaign.status)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#e6f7f0] px-2 py-1 text-[7px] font-black uppercase text-[#176b57]">
                        {campaign.creative?.sponsorLabel || 'Sponsored'}
                      </span>
                    </div>

                    <div className="mt-2 divide-y divide-stone-100 border-y border-stone-100">
                      {(campaign.placementSelections || []).map((selection) => (
                        <div
                          key={`${selection.placement}-${selection.slotKey}`}
                          className="py-2"
                        >
                          <p className="text-[8px] font-black text-stone-900">
                            {PLACEMENT_META[selection.placement]?.label || titleize(selection.placement)}
                          </p>
                          <p className="mt-0.5 text-[8px] font-semibold text-[#315f7a]">
                            {selection.slotLabel || titleize(selection.slotKey)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex items-start gap-2 text-[8px] font-semibold leading-4 text-stone-500">
                      <CalendarClock size={13} className="mt-0.5 shrink-0 text-[#6c52a4]" aria-hidden="true" />
                      <span>
                        Booked: {formatDateTime(campaign.scheduledStartsAt || campaign.startsAt)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3 bg-[#edf9f4] px-2.5 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isPaid ? (
                            <CheckCircle2 size={13} className="text-[#176b57]" aria-hidden="true" />
                          ) : (
                            <CreditCard size={13} className="text-[#6c52a4]" aria-hidden="true" />
                          )}
                          <p className="text-[9px] font-black text-stone-950">
                            {isPaid ? 'Payment received' : 'Payment required'}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-[12px] font-black text-stone-950">
                        {formatMoneyMinor(
                          payment.requiredAmountMinor,
                          payment.currency || pricing?.currency || 'INR',
                        )}
                      </p>
                    </div>

                    {campaign.status === 'pending_review' && !isPaid ? (
                      <button
                        type="button"
                        disabled={
                          busy ||
                          isPaying ||
                          pricing?.paymentProvider?.mode !== 'test'
                        }
                        onClick={() => payCampaign(campaign)}
                        className={`${primaryButtonClass} mt-2 w-full`}
                      >
                        <IndianRupee size={14} aria-hidden="true" />
                        {isPaying
                          ? 'Opening payment…'
                          : `Pay ${formatMoneyMinor(
                              payment.requiredAmountMinor,
                              payment.currency || 'INR',
                            )}`}
                      </button>
                    ) : null}

                    {campaign.status === 'pending_review' && isPaid ? (
                      <div className="mt-2 flex items-start gap-2 bg-[#edf6fb] px-2.5 py-2 text-[8px] font-semibold leading-4 text-[#275f7c]">
                        <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        Waiting for Super Admin approval.
                      </div>
                    ) : null}

                    {campaign.review?.reason ? (
                      <div className="mt-2 flex items-start gap-2 bg-stone-50 px-2.5 py-2 text-[8px] font-semibold leading-4 text-stone-600">
                        <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        Review note: {campaign.review.reason}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-2">
                      {!['active', 'paused', 'ended'].includes(campaign.status) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => beginEditCampaign(campaign)}
                          className="focus-ring inline-flex items-center gap-2 rounded-[12px] border border-[#d3cae8] bg-white px-3 py-2 text-[10px] font-black text-[#5f4a95] transition hover:bg-[#f4f0fb] disabled:opacity-40"
                        >
                          <PencilLine size={14} aria-hidden="true" />
                          Edit
                        </button>
                      ) : null}

                      {campaign.status === 'approved' && isPaid ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => transition(campaign.id, 'activate')}
                          className={primaryButtonClass}
                        >
                          <Play size={14} aria-hidden="true" />
                          Activate
                        </button>
                      ) : null}

                      {campaign.status === 'active' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => transition(campaign.id, 'pause')}
                          className="focus-ring inline-flex items-center gap-2 rounded-[12px] border border-stone-200 bg-white px-3 py-2 text-[10px] font-black text-stone-700"
                        >
                          <Pause size={14} aria-hidden="true" />
                          Pause
                        </button>
                      ) : null}

                      {campaign.status === 'paused' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => transition(campaign.id, 'resume')}
                          className={primaryButtonClass}
                        >
                          <Play size={14} aria-hidden="true" />
                          Resume
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="border border-dashed border-[#d9d2ea] bg-white/70 p-3 text-[10px] font-semibold leading-5 text-stone-500">
                No campaigns yet. Complete the setup on the left and your campaign will appear here for payment and activation.
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="flex items-start gap-2 rounded-[16px] border border-[#c7e4d8] bg-[#eef9f4] p-3 text-[9px] font-semibold leading-[1.5] text-stone-600 sm:text-[10px]">
          <Eye size={15} className="mt-0.5 shrink-0 text-[#176b57]" aria-hidden="true" />
          Promotions stay clearly labelled. Paid ranking never changes organic results, so normal results remain separate from paid placement.
        </div>
        <div className="flex items-start gap-2 rounded-[16px] border border-[#cbdfea] bg-[#eef7fb] p-3 text-[9px] font-semibold leading-[1.5] text-stone-600 sm:text-[10px]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#2c789d]" aria-hidden="true" />
          Sensitive health information and allergy inferences are never advertising targeting segments.
        </div>
      </div>

      {placementModal ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-stone-950/45 p-2 backdrop-blur-md sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="placement-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPlacementModal(null)
            }
          }}
        >
          <div className="flex h-[94vh] max-h-[94vh] w-full max-w-[1380px] flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[#f8f7f2] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#176b57]">
                  Choose exact ad position
                </p>
                <h2 id="placement-preview-title" className="mt-1 text-xl font-black text-stone-950 sm:text-2xl">
                  {PLACEMENT_META[placementModal]?.label || titleize(placementModal)} page preview
                </h2>
                <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-5 text-stone-600 sm:text-xs">
                  This is the current EPANTRY page, not a mockup. Scroll through it and click a highlighted ad position. If the page UI or live data changes later, this preview changes with it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlacementModal(null)}
                className="focus-ring grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-stone-50 text-stone-700"
                aria-label="Close placement preview"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="relative min-h-0 overflow-hidden bg-[#e8ebe7]">
                {placementPreviewLoading ? (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4f3ee]">
                    <div className="text-center">
                      <RefreshCw
                        size={24}
                        className="mx-auto animate-spin text-[#176b57]"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-xs font-black text-stone-900">
                        Opening the live EPANTRY page…
                      </p>
                    </div>
                  </div>
                ) : null}

                {placementPreviewError ? (
                  <div className="grid h-full min-h-[420px] place-items-center p-6">
                    <div className="max-w-md border-l-4 border-amber-400 bg-white px-4 py-4 text-sm font-semibold leading-6 text-stone-700 shadow-sm">
                      {placementPreviewError}
                    </div>
                  </div>
                ) : placementPreviewUrl ? (
                  <iframe
                    src={placementPreviewUrl}
                    title={`${PLACEMENT_META[placementModal]?.label || titleize(placementModal)} live page preview`}
                    className="h-full min-h-[640px] w-full bg-white"
                    onLoad={(event) => {
                      const frame = event.currentTarget
                      const documentRef = frame.contentDocument

                      if (!documentRef) return

                      if (frame.__epantryPreviewBlocker) {
                        documentRef.removeEventListener(
                          'click',
                          frame.__epantryPreviewBlocker,
                          true,
                        )
                      }

                      const blocker = (previewEvent) => {
                        const target = previewEvent.target
                        const selectable =
                          target?.closest?.('[data-retail-media-preview-slot="true"]')

                        if (selectable) return

                        previewEvent.preventDefault()
                        previewEvent.stopPropagation()
                      }

                      frame.__epantryPreviewBlocker = blocker
                      documentRef.addEventListener('click', blocker, true)
                    }}
                  />
                ) : null}
              </div>

              <aside className="border-t border-stone-200 bg-white p-4 lg:border-l lg:border-t-0 sm:p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#315f7a]">
                  Page positions
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-stone-500">
                  {PLACEMENT_META[placementModal]?.description}
                </p>

                <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                  {(placementSlots[placementModal] || []).map((slot) => {
                    const availability = availabilityBySlot[slot.key]
                    const selected = campaignForm.placementSelections.find(
                      (item) =>
                        item.placement === placementModal &&
                        item.slotKey === slot.key,
                    )

                    return (
                      <button
                        key={slot.key}
                        type="button"
                        disabled={availabilityLoading && !availability}
                        onClick={() => choosePlacementSlot(slot, availability)}
                        className="focus-ring block w-full py-3 text-left disabled:opacity-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                              {slot.label}
                            </p>
                            <p className="mt-1 text-[8px] font-semibold leading-4 text-stone-500 sm:text-[9px]">
                              {!availability
                                ? 'Checking availability…'
                                : availability.available
                                  ? 'Available for the selected duration.'
                                  : `Booked now. Pre-book from ${formatDateTime(
                                      availability.nextAvailableAt,
                                    )}.`}
                            </p>
                          </div>
                          {selected ? (
                            <CheckCircle2 size={16} className="shrink-0 text-[#176b57]" aria-hidden="true" />
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 bg-[#edf6fb] p-3 text-[9px] font-semibold leading-4 text-[#315f7a]">
                  Payment is not opened from this preview. First choose all final positions and create the campaign; payment happens afterwards from Your campaigns.
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
