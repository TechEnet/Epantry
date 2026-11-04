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
  'focus-ring min-h-[46px] w-full rounded-[9px] border border-[#d8ddd4] bg-white px-3.5 py-2.5 text-[14px] font-normal leading-6 text-[#202421] outline-none placeholder:text-[#79847a] focus:border-[#173f35] focus:ring-2 focus:ring-[#dce8dd] disabled:bg-[#f0f1ec] disabled:text-[#67716a] sm:text-[15px]'

const primaryButtonClass =
  'focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[9px] bg-[#173f35] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#245547] disabled:cursor-not-allowed disabled:opacity-40'

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
  { number: '01', title: 'Campaign', text: 'Name & goal' },
  { number: '02', title: 'Placement', text: 'Page & duration' },
  { number: '03', title: 'Creative', text: 'Image & message' },
  { number: '04', title: 'Review', text: 'Pay & approval' },
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
    <main className="host-campaigns-page mx-auto w-full max-w-[1480px] px-3 pb-8 pt-3 text-[#202421] sm:px-5 sm:pb-10 sm:pt-5 lg:px-7">
      <style>{`
        .host-campaigns-page .host-campaigns-title { font-size: 32px !important; line-height: 1.17 !important; }
        .host-campaigns-page .host-campaigns-section-title { font-size: 23px !important; line-height: 1.3 !important; }
        .host-campaigns-page .host-campaigns-creative-title { font-size: 23px !important; line-height: 1.3 !important; }
        .host-campaigns-page .host-campaigns-sidebar-title { font-size: 21px !important; line-height: 1.3 !important; }
        @media (max-width: 639px) {
          .host-campaigns-page .host-campaigns-title { font-size: 27px !important; line-height: 1.2 !important; }
          .host-campaigns-page .host-campaigns-section-title { font-size: 21px !important; line-height: 1.3 !important; }
          .host-campaigns-page .host-campaigns-creative-title { font-size: 21px !important; line-height: 1.3 !important; }
        }
      `}</style>
      <header className="overflow-hidden rounded-[18px] border border-[#d7e2d8] bg-[#eaf1eb]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 px-5 py-5 sm:px-7 sm:py-7 lg:px-8">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-[#965039]">
              <span className="h-[2px] w-6 bg-[#c86c42]" aria-hidden="true" />
              Host / Advertising
            </p>
            <h1 className="host-campaigns-title mt-2 text-[27px] font-semibold leading-[1.16] tracking-[-0.025em] text-[#173f35] sm:text-[32px]">
              Sponsored campaigns
            </h1>
            <p className="mt-2 max-w-[650px] text-[14px] leading-[1.6] text-[#435b4d] sm:text-[15px]">
              Create your ad, choose its placement and submit it for approval.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-[#c6d8ca] bg-white/80 px-3 text-[13px] font-medium text-[#284b3a]">
                <ShieldCheck size={15} aria-hidden="true" /> Approval before launch
              </span>
              <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-[#d1ded5] bg-white/60 px-3 text-[13px] text-[#526558]">
                <Clock3 size={15} aria-hidden="true" /> 4 simple steps
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-5 bg-[#173f35] px-5 py-5 text-white sm:px-7 sm:py-6 lg:px-6">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#c9dfd1]">Your advertising</p>
              <div className="mt-2 flex items-end gap-3">
                <strong className="text-[42px] font-semibold leading-none tracking-[-0.04em] text-white">{campaigns.length}</strong>
                <span className="pb-1 text-[14px] text-[#e0eee5]">{campaigns.length === 1 ? 'campaign' : 'campaigns'}</span>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-[#c9dfd1]">
                {campaigns.filter((campaign) => campaign.status === 'active').length} currently active
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading || busy || Boolean(payingCampaignId)}
              className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#9cb6a6] bg-white px-4 text-[14px] font-semibold text-[#173f35] transition-colors hover:bg-[#eaf4ec] disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
              Refresh campaigns
            </button>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-px border-t border-[#d0ddd2] bg-[#d0ddd2] lg:grid-cols-4" aria-label="Campaign setup stages">
          {STEP_CARDS.map((step, index) => (
            <div key={step.number} className={`flex min-w-0 items-center gap-3 px-3.5 py-3 sm:px-5 ${index === 0 ? 'bg-[#e0eee5]' : index === 1 ? 'bg-[#e9f2f5]' : index === 2 ? 'bg-[#f6e9e1]' : 'bg-[#f1edf8]'}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] text-[13px] font-semibold ${index === 0 ? 'bg-[#173f35] text-white' : 'bg-white text-[#173f35]'}`}>
                {step.number}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-5 text-[#203b30]">{step.title}</p>
                <p className="text-[12.5px] leading-[19px] text-[#526457]">{step.text}</p>
              </div>
            </div>
          ))}
        </nav>
      </header>

      {error || notice || loading ? (
        <div className={`mt-4 flex items-start gap-2 rounded-[10px] border px-4 py-3 text-[14px] leading-[1.55] ${error ? 'border-[#e6bdb4] bg-[#fff0ec] text-[#91392f]' : 'border-[#bddac7] bg-[#e9f3ea] text-[#173f35]'}`} role="status" aria-live="polite">
          {error ? <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>{error || notice || 'Loading campaigns…'}</span>
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-start">
        <section id="host-retail-media-editor" aria-label="Create sponsored campaign" className="flex min-w-0 scroll-mt-24 flex-col gap-5">
          <div className="min-w-0 rounded-[16px] border border-[#d3dfd5] bg-[#f0f4ec] px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
            <div className="flex items-start gap-3 sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#173f35] text-white">
                <span className="text-[15px] font-semibold">01</span>
              </span>
              <div className="min-w-0">
                <h2 className="host-campaigns-section-title text-[21px] font-semibold leading-7 tracking-[-0.015em] text-[#173f35] sm:text-[23px]">Campaign brief</h2>
                <p className="mt-0.5 text-[14px] leading-[1.5] text-[#526357]">Start with a name, goal and offer.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344c40]">Campaign name</span>
                <input
                className={inputClass}
                value={briefForm.title}
                onChange={(event) =>
                  setBriefForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Summer specials"
                />
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344c40]">Campaign goal</span>
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
              </label>

              <label className="block min-w-0 sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#344c40]">Offer details</span>
                <textarea
                rows={2}
                className={inputClass}
                value={briefForm.commercialDisclosure}
                onChange={(event) =>
                  setBriefForm((current) => ({
                    ...current,
                    commercialDisclosure: event.target.value,
                  }))
                }
                placeholder="Tell customers what this promotion offers."
                />
              </label>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !briefForm.title.trim() ||
                briefForm.commercialDisclosure.trim().length < 5
              }
              onClick={createBrief}
              className={`${primaryButtonClass} mt-4 w-full sm:w-auto`}
            >
              <Megaphone size={15} aria-hidden="true" />
              Save campaign details
            </button>

            {briefs.length ? (
              <div className="mt-5 divide-y divide-[#d4dfd5] overflow-hidden rounded-[12px] border border-[#cadacd] bg-white">
                {briefs.map((brief) => (
                  <div
                    key={brief.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-stone-900 sm:text-sm">
                        {brief.title}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-stone-500 sm:text-[13px]">
                        {titleize(brief.objective)} · {brief.status === 'draft' ? 'Basics saved' : 'Ready for ad setup'}
                      </p>
                    </div>

                    {brief.status === 'draft' ? (
                      <button
                        type="button"
                        disabled={busy || Boolean(editingCampaignId)}
                        onClick={() => submitBrief(brief.id)}
                        className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#b8dccf] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#173f35] sm:px-3 sm:py-2 sm:text-xs"
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
                        className={`focus-ring rounded-full px-2.5 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                          campaignForm.briefId === brief.id
                            ? 'bg-[#173f35] text-white'
                            : 'border border-[#2b6750] bg-white text-[#173f35] hover:bg-[#e9f1e9]'
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

          <div className="min-w-0 rounded-[16px] border border-[#d4e1e8] bg-[#eaf2f6] px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
            <div className="flex items-start gap-3 sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#315f72] text-white">
                <span className="text-[15px] font-semibold">02</span>
              </span>
              <div className="min-w-0">
                <h2 className="host-campaigns-section-title text-[21px] font-semibold leading-7 tracking-[-0.015em] text-[#173f35] sm:text-[23px]">Where should it appear?</h2>
                <p className="mt-0.5 text-[14px] leading-[1.5] text-[#526371]">Choose a page, exact position and duration.</p>
              </div>
            </div>

            {editingCampaign ? (
              <div className="mt-4 flex flex-col gap-3 border-y border-[#d9d0ee] bg-[#f4f0fb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6c52a4]">
                    Editing existing campaign
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#202421]">
                    {editingCampaign.title}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-stone-600 sm:text-[13px]">
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
                  className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-[11px] border border-[#d4ddd4] bg-white px-3 py-2 text-[13px] font-semibold text-[#665c82]"
                >
                  <Undo2 size={14} aria-hidden="true" />
                  Cancel edit
                </button>
              </div>
            ) : null}

            {!selectedBrief ? (
              <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-[#c4d6cc] bg-[#f9fcf9] px-3.5 py-3 text-[14px] leading-[1.5] text-[#315844]">
                Save or choose a campaign above to unlock placement and creative settings.
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-[#bfd8c9] bg-[#f7fcf9] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    Campaign being promoted
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#202421]">
                    {selectedBrief.title}
                  </p>
                </div>
                <BadgeCheck size={18} className="shrink-0 text-[#173f35]" aria-hidden="true" />
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-[12px] border border-[#cfdae0] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#dce5e9] bg-[#f9fcfd] px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-[#202421]">Available pages</p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-5 text-stone-500 sm:text-[13px]">
                    Select a page to preview its available spaces.
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:shrink-0">
                  <div className="min-w-0">
                    <p className="mb-1 text-[13px] font-semibold text-[#315f72]">
                      Duration
                    </p>
                    <select
                      className={`${inputClass} min-w-[130px]`}
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
                  <div className="self-end rounded-[8px] border border-[#dbe5d9] bg-[#edf3e9] px-3 py-3 text-[14px] font-semibold text-[#173f35]">
                    {formatMoneyMinor(
                      selectedPlacementTotalMinor,
                      pricing?.currency || 'INR',
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 bg-[#f6f9f9] p-3 sm:grid-cols-3 sm:p-4 lg:grid-cols-4">
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
                    <div key={placement} className={`min-w-0 rounded-[10px] border p-3 transition-colors sm:p-3.5 ${selected ? 'border-[#6a9880] bg-[#e2efe5] shadow-[0_0_0_1px_#6a9880]' : 'border-[#d5e0e3] bg-white hover:border-[#98b9c7] hover:bg-[#f5fbfc]'}`}>
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
                        className={`focus-ring block w-full text-left disabled:cursor-not-allowed disabled:opacity-70 ${
                          selected ? 'text-[#173f35]' : 'text-[#263b39]'
                        }`}
                      >
                        <span className="block text-[14px] font-semibold leading-5">
                          {PLACEMENT_META[placement]?.label || titleize(placement)}
                        </span>
                        <span className="mt-1 block text-[14px] font-semibold text-[#173f35]">
                          {formatMoneyMinor(durationPrice, pricing?.currency || 'INR')}
                        </span>
                        <span className={`mt-2 block min-h-[28px] text-[13px] font-medium leading-[1.45] ${selected ? 'text-[#245c42]' : 'text-[#316e80]'}`}>
                          {selected ? selected.slotLabel : 'Choose exact section →'}
                        </span>
                      </button>

                      {selected && !editingPaidCampaign ? (
                        <button
                          type="button"
                          onClick={() => removePlacement(placement)}
                          className="mt-1 text-[12px] font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-[9px] border border-[#cedfe5] bg-[#f8fbfc] px-3.5 py-3 text-[13px] leading-[1.55] text-[#345b62]">
              <Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Your ad goes live after Super Admin approval. If a spot is booked, you can select its next available date.
              </p>
            </div>

            {campaignForm.scheduledStartAt ? (
              <div className="mt-3 flex items-center gap-2 bg-[#fff3dc] px-3 py-2.5 text-[12px] font-bold text-[#7b571e] sm:text-[13px]">
                <CalendarClock size={14} aria-hidden="true" />
                Pre-booked start: {formatDateTime(campaignForm.scheduledStartAt)}. Final availability is checked again before payment.
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 rounded-[13px] border border-[#ead3c6] bg-[#fff8f3] p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#aa6245] text-white">
                  <span className="text-[15px] font-semibold">03</span>
                </span>
                <div>
                  <h3 className="host-campaigns-creative-title text-[21px] font-semibold leading-7 text-[#173f35] sm:text-[23px]">Build your ad</h3>
                  <p className="text-[14px] leading-[1.5] text-[#6e584d]">Image, message and destination.</p>
                </div>
              </div>
              <div className="grid min-w-0 gap-4 md:grid-cols-[225px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[11px] border border-[#e8d4c8] bg-white">
                  {campaignForm.imageUrl ? (
                    <div className="relative h-[170px]">
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
                    <label className="focus-ring flex h-[170px] cursor-pointer flex-col items-center justify-center gap-2 bg-[#f3e8df] px-4 text-center transition-colors hover:bg-[#efded3]">
                      <ImagePlus size={26} className="text-[#173f35]" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-stone-900 sm:text-xs">
                        Add campaign image
                      </span>
                      <span className="text-[12px] font-semibold text-stone-500 sm:text-[12px]">
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
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
                    <input
                      className={inputClass}
                      disabled={!campaignForm.briefId}
                      aria-label="Ad headline"
                      value={campaignForm.headline}
                      onChange={(event) =>
                        setCampaignForm((current) => ({
                          ...current,
                          headline: event.target.value,
                        }))
                      }
                      placeholder="Headline shown on the ad"
                    />

                    <div>
                      <select
                        className={inputClass}
                        disabled={!campaignForm.briefId}
                        aria-label="Customer-visible ad label"
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
                      <p className="mt-1 text-[12px] font-semibold text-stone-500">
                        Label shown to customers
                      </p>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    className={inputClass}
                    disabled={!campaignForm.briefId}
                    aria-label="Ad description"
                    value={campaignForm.body}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Short message about your offer"
                  />

                  <input
                    className={inputClass}
                    disabled={!campaignForm.briefId}
                    aria-label="Ad destination URL or page"
                    value={campaignForm.landingRef}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        landingRef: event.target.value,
                      }))
                    }
                    placeholder="Landing page URL or path"
                  />

                  <input
                    className={inputClass}
                    disabled={!campaignForm.briefId}
                    aria-label="Optional campaign tags"
                    value={campaignForm.contextualTags}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        contextualTags: event.target.value,
                      }))
                    }
                    placeholder="Optional tags: cuisine, occasion, ingredients"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[10px] border border-[#ccdcd0] bg-[#edf4ed] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#202421] sm:text-sm">
                    Estimated placement total
                  </p>
                  <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#516759]">
                    {selectedPlacements.length} {selectedPlacements.length === 1 ? 'placement' : 'placements'} · {formatDurationMinutes(selectedDurationMinutes)} · Pay after saving.
                  </p>
                </div>
                <p className="shrink-0 text-[23px] font-semibold tracking-[-0.02em] text-[#173f35] sm:text-[26px]">
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
                className={`${primaryButtonClass} w-full sm:w-auto sm:min-w-[190px] sm:justify-self-start`}
              >
                <ShieldCheck size={15} aria-hidden="true" />
                {editingCampaignId
                  ? 'Save campaign changes'
                  : 'Create campaign'}
              </button>
            </div>
          </div>
        </section>

        <aside className="min-w-0 self-start overflow-hidden rounded-[16px] border border-[#ddd7e4] bg-white xl:sticky xl:top-24" aria-label="Your sponsored campaigns">
          <div className="border-b border-[#ddd4e5] bg-[#ece7f3] px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BadgeCheck size={20} className="text-[#6e5b8e]" aria-hidden="true" />
                <h2 className="host-campaigns-sidebar-title text-[21px] font-semibold text-[#173f35]">Your campaigns</h2>
              </div>
              <span className="grid min-w-8 place-items-center rounded-full border border-[#d8cfe4] bg-white px-2 py-1 text-[13px] font-semibold text-[#4a3f5d]">
                {campaigns.length}
              </span>
            </div>
            <p className="mt-1 text-[14px] leading-5 text-[#5e5967]">Your ads, payments and review status.</p>
          </div>

          <div className="max-h-[78vh] divide-y divide-[#e1e5de] overflow-y-auto">
            {campaigns.length ? campaigns.map((campaign) => {
              const payment = campaign.payment || {}
              const isPaid = payment.status === 'paid'
              const isPaying = payingCampaignId === campaign.id

              return (
                <article
                  id={`host-retail-media-campaign-${campaign.id}`}
                  key={campaign.id}
                  className={`scroll-mt-28 bg-white px-5 py-5 sm:px-6 ${focusCampaignId === campaign.id ? 'ring-2 ring-inset ring-[#6d9b80]' : ''}`}
                >
                  {campaign.creative?.imageUrl ? (
                    <img src={campaign.creative.imageUrl} alt="" className="h-[148px] w-full rounded-[11px] border border-[#e1e5df] object-cover" />
                  ) : (
                    <div className="grid h-[118px] w-full place-items-center rounded-[11px] bg-[#eaf1eb] text-[#486b59]">
                      <Megaphone size={27} aria-hidden="true" />
                    </div>
                  )}
                  <div className="mt-3 flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[16px] font-semibold leading-6 text-[#173f35]">{campaign.title}</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#5b695f]">{formatDurationMinutes(campaign.durationMinutes)}</p>
                    </div>
                    <span className={`shrink-0 rounded-[7px] px-2 py-1.5 text-[12px] font-semibold ${campaign.status === 'active' ? 'bg-[#dcefe3] text-[#1d643e]' : campaign.status === 'rejected' ? 'bg-[#ffe8e2] text-[#9b3e31]' : campaign.status === 'ended' ? 'bg-[#eaebe8] text-[#5d655e]' : 'bg-[#f1e9f6] text-[#685581]'}`}>
                      {titleize(campaign.status)}
                    </span>
                  </div>

                  {(campaign.placementSelections || []).length ? (
                    <div className="mt-3 border-t border-[#e2e7df] pt-3">
                      {(campaign.placementSelections || []).map((selection) => (
                        <p key={`${selection.placement}-${selection.slotKey}`} className="py-0.5 text-[13px] leading-5 text-[#59665c]">
                          <span className="font-semibold text-[#263d32]">{PLACEMENT_META[selection.placement]?.label || titleize(selection.placement)}</span>
                          <span className="mx-1.5 text-[#a5aea3]">/</span>
                          {selection.slotLabel || titleize(selection.slotKey)}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-2 flex items-start gap-2 text-[12px] leading-[1.5] text-[#68746b]">
                    <CalendarClock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>Booked: {formatDateTime(campaign.scheduledStartsAt || campaign.startsAt)}</span>
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3 border-y border-[#dfe5db] py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {isPaid ? <CheckCircle2 size={16} className="shrink-0 text-[#316e52]" aria-hidden="true" /> : <CreditCard size={16} className="shrink-0 text-[#ad6748]" aria-hidden="true" />}
                      <span className="text-[14px] font-medium text-[#405548]">{isPaid ? 'Paid' : 'Payment due'}</span>
                    </div>
                    <strong className="shrink-0 text-[15px] font-semibold text-[#173f35]">
                      {formatMoneyMinor(payment.requiredAmountMinor, payment.currency || pricing?.currency || 'INR')}
                    </strong>
                  </div>

                  {campaign.status === 'pending_review' && !isPaid ? (
                    <button
                      type="button"
                      disabled={busy || isPaying || pricing?.paymentProvider?.mode !== 'test'}
                      onClick={() => payCampaign(campaign)}
                      className={`${primaryButtonClass} mt-3 w-full`}
                    >
                      <IndianRupee size={15} aria-hidden="true" />
                      {isPaying ? 'Opening payment…' : `Pay ${formatMoneyMinor(payment.requiredAmountMinor, payment.currency || 'INR')}`}
                    </button>
                  ) : null}
                  {campaign.status === 'pending_review' && isPaid ? (
                    <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-[#e8f0f3] px-3 py-2.5 text-[13px] leading-5 text-[#315f70]">
                      <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      Awaiting Super Admin approval.
                    </div>
                  ) : null}
                  {campaign.review?.reason ? (
                    <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-[#f7ece7] px-3 py-2.5 text-[13px] leading-5 text-[#775442]">
                      <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>Review note: {campaign.review.reason}</span>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!['active', 'paused', 'ended'].includes(campaign.status) ? (
                      <button type="button" disabled={busy} onClick={() => beginEditCampaign(campaign)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#cbd8cc] bg-white px-3 py-2 text-[13px] font-semibold text-[#173f35] hover:bg-[#eef4ea] disabled:opacity-40">
                        <PencilLine size={14} aria-hidden="true" /> Edit
                      </button>
                    ) : null}
                    {campaign.status === 'approved' && isPaid ? (
                      <button type="button" disabled={busy} onClick={() => transition(campaign.id, 'activate')} className={primaryButtonClass}>
                        <Play size={14} aria-hidden="true" /> Activate
                      </button>
                    ) : null}
                    {campaign.status === 'active' ? (
                      <button type="button" disabled={busy} onClick={() => transition(campaign.id, 'pause')} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#cbd8cc] bg-white px-3 py-2 text-[13px] font-semibold text-[#173f35] hover:bg-[#eef4ea]">
                        <Pause size={14} aria-hidden="true" /> Pause
                      </button>
                    ) : null}
                    {campaign.status === 'paused' ? (
                      <button type="button" disabled={busy} onClick={() => transition(campaign.id, 'resume')} className={primaryButtonClass}>
                        <Play size={14} aria-hidden="true" /> Resume
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            }) : (
              <div className="px-5 py-8 text-center">
                <Megaphone size={25} className="mx-auto text-[#7e9b82]" aria-hidden="true" />
                <p className="mt-3 text-[15px] font-semibold text-[#173f35]">No campaigns yet</p>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#677469]">Your campaigns will appear here after creation.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-5 grid gap-2 rounded-[12px] border border-[#dce6df] bg-[#f0f4ee] px-4 py-3 text-[13px] leading-[1.6] text-[#496154] sm:grid-cols-2 sm:gap-6 sm:px-5">
        <p className="flex items-start gap-2">
          <Eye size={15} className="mt-0.5 shrink-0 text-[#446e5b]" aria-hidden="true" />
          Paid ads stay labelled and do not change organic search ranking.
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#446e5b]" aria-hidden="true" />
          Health and allergy information is never used to target ads.
        </p>
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
          <div className="flex h-[94vh] max-h-[94vh] w-full max-w-[1380px] flex-col overflow-hidden rounded-[14px] border border-white/70 bg-[#f8f7f2] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#173f35]">
                  Choose exact ad position
                </p>
                <h2 id="placement-preview-title" className="mt-1 text-xl font-semibold text-[#202421] sm:text-[22px]">
                  {PLACEMENT_META[placementModal]?.label || titleize(placementModal)} page preview
                </h2>
                <p className="mt-1 max-w-3xl text-[13px] font-semibold leading-5 text-stone-600 sm:text-[13px]">
                  Preview the current EPANTRY page and select a highlighted ad position.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlacementModal(null)}
                className="focus-ring grid size-9 shrink-0 place-items-center rounded-[9px] border border-stone-200 bg-stone-50 text-stone-700"
                aria-label="Close placement preview"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="relative h-[48%] min-h-[220px] shrink-0 overflow-hidden bg-[#e8ebe7] sm:h-[55%] lg:h-auto lg:min-h-0 lg:shrink">
                {placementPreviewLoading ? (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[#f4f3ee]">
                    <div className="text-center">
                      <RefreshCw
                        size={24}
                        className="mx-auto animate-spin text-[#173f35]"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-[13px] font-semibold text-stone-900">
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
                    className="h-full min-h-0 w-full bg-white"
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

              <aside className="min-h-0 flex-1 overflow-y-auto border-t border-stone-200 bg-white p-4 lg:flex-none lg:border-l lg:border-t-0 sm:p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#315f7a]">
                  Page positions
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-stone-500">
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
                            <p className="text-[13px] font-semibold text-[#202421] sm:text-[13px]">
                              {slot.label}
                            </p>
                            <p className="mt-1 text-[12px] font-semibold leading-4 text-stone-500 sm:text-[12px]">
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
                            <CheckCircle2 size={16} className="shrink-0 text-[#173f35]" aria-hidden="true" />
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 bg-[#edf6fb] p-3 text-[12px] font-semibold leading-4 text-[#315f7a]">
                  Choose your positions and create the campaign first. Complete payment from Your campaigns.
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
