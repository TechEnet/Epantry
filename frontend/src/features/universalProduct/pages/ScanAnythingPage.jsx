import {
  ArrowRight,
  Barcode,
  Camera,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  ImagePlus,
  LoaderCircle,
  PackagePlus,
  ScanLine,
  Search,
  ShieldCheck,
  Store,
  Upload,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import MediaPrivacyHoldPanel from '../../mediaPrivacy/components/MediaPrivacyHoldPanel'

import {
  extractMediaPrivacyHolds,
} from '../../mediaPrivacy/services/mediaPrivacy.service'

import {
  createHostNpiFromImages,
  getUniversalProductErrorMessage,
  resolveHostUniversalBarcode,
  resolveUniversalBarcode,
  uploadProductEvidenceBatch,
} from '../services/universalProduct.service'

const EVIDENCE_PURPOSES = [
  {
    value:
      'front_pack',

    label:
      'Front of pack',
  },
  {
    value:
      'ingredient_panel',

    label:
      'Ingredients panel',
  },
  {
    value:
      'allergen_statement',

    label:
      'Allergen statement',
  },
  {
    value:
      'nutrition_panel',

    label:
      'Nutrition panel',
  },
  {
    value:
      'barcode',

    label:
      'Barcode / GTIN',
  },
  {
    value:
      'back_pack',

    label:
      'Back of pack / manufacturer',
  },
  {
    value:
      'certification_mark',

    label:
      'Certification mark',
  },
  {
    value:
      'other',

    label:
      'Other useful panel',
  },
]

const ACCEPTED_IMAGE_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ])

const REVIEW_NUTRIENTS = [
  ['energy', 'Energy', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbohydrate', 'Carbohydrate', 'g'],
  ['total_fat', 'Total fat', 'g'],
  ['saturated_fat', 'Saturated fat', 'g'],
  ['dietary_fibre', 'Dietary fibre', 'g'],
  ['total_sugars', 'Total sugars', 'g'],
  ['sodium', 'Sodium', 'mg'],
]

function createReviewDetails() {
  return {
    ingredientDeclarationText: '',
    containsAllergens: '',
    mayContainAllergens: '',
    allergenStatement: '',
    countryOfOrigin: '',
    manufacturerName: '',
    nutritionBasis: 'per_100g',
    servingSizeValue: '',
    servingSizeUnit: 'g',
    nutrients: Object.fromEntries(
      REVIEW_NUTRIENTS.map(([key]) => [key, '']),
    ),
    dietaryType: 'not_declared',
    glutenFree: false,
  }
}

function splitReviewList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildReviewDeclarations(details) {
  const allergens = [
    ...splitReviewList(details.containsAllergens).map((name) => ({
      name,
      relationType: 'contains',
    })),
    ...splitReviewList(details.mayContainAllergens).map((name) => ({
      name,
      relationType: 'may_contain',
    })),
  ]

  const nutrients = REVIEW_NUTRIENTS.map(([key, label, unit]) => {
    const raw = details.nutrients?.[key]

    if (raw === '' || raw === null || raw === undefined) {
      return null
    }

    const amount = Number(raw)

    return Number.isFinite(amount) && amount >= 0
      ? { name: label, amount, unit }
      : null
  }).filter(Boolean)

  const servingValue = Number(details.servingSizeValue)
  const hasServingSize =
    details.servingSizeValue !== '' &&
    Number.isFinite(servingValue) &&
    servingValue >= 0

  const claims = []

  if (details.dietaryType === 'vegetarian') {
    claims.push('Vegetarian')
  } else if (details.dietaryType === 'vegan') {
    claims.push('Vegan')
  } else if (details.dietaryType === 'non_vegetarian') {
    claims.push('Non Vegetarian')
  }

  if (details.glutenFree) {
    claims.push('Gluten Free')
  }

  const hasNutrition = nutrients.length > 0 || hasServingSize

  return {
    ingredientDeclarationText: details.ingredientDeclarationText.trim(),
    allergenStatement: details.allergenStatement.trim(),
    allergens,
    ...(hasNutrition
      ? {
          nutrition: {
            basis: details.nutritionBasis || null,
            servingSize: hasServingSize
              ? {
                  value: servingValue,
                  unit: details.servingSizeUnit,
                }
              : null,
            nutrients,
          },
        }
      : {}),
    countryOfOrigin: details.countryOfOrigin.trim(),
    manufacturerName: details.manufacturerName.trim(),
    claims,
  }
}

function createLocalId() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function compactText(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

function confidenceLabel(
  value,
) {
  const parsed =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 'Confidence unknown'
  }

  return `${Math.round(
    parsed *
      100,
  )}% confidence`
}

function nutritionLabel(
  nutrition,
) {
  const values =
    Array.isArray(
      nutrition,
    )
      ? nutrition
      : []

  if (
    values.length ===
    0
  ) {
    return 'Not available'
  }

  return `${values.length} nutrition values available`
}

function ProductFact({
  label,
  value,
  mobileWide = false,
}) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      '' ||
    (
      Array.isArray(
        value,
      ) &&
      value.length ===
        0
    )
  ) {
    return null
  }

  return (
    <div
      className={[
        'rounded-[12px] border border-stone-200 bg-white/90 p-2 sm:rounded-2xl sm:p-4',
        mobileWide
          ? 'col-span-2 sm:col-span-1'
          : '',
      ].join(' ')}
    >
      <p className="text-[7.5px] font-black uppercase tracking-[0.09em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
        {label}
      </p>

      <p className="mt-1 break-words text-[10px] font-bold leading-[14px] text-stone-800 sm:mt-2 sm:text-sm sm:leading-6">
        {Array.isArray(
          value,
        )
          ? value.join(
              ', ',
            )
          : String(
              value,
            )}
      </p>
    </div>
  )
}

function VerificationBanner({
  resolution,
  hostMode,
}) {
  if (
    !resolution
  ) {
    return null
  }

  const verified =
    resolution.verificationStatus ===
    'verified'

  return (
    <div
      className={[
        'rounded-[16px] border p-3 sm:rounded-[22px] sm:p-4',

        verified
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-amber-200 bg-amber-50 text-amber-900',
      ].join(
        ' ',
      )}
    >
      <div className="flex items-start gap-3">
        {verified ? (
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <CircleAlert
            size={20}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
        )}

        <div>
          <p className="text-[12px] font-black sm:text-sm">
            {hostMode
              ? verified
                ? 'Product match found'
                : 'New product needs a quick review'
              : verified
                ? resolution.state ===
                  'verified_historical'
                  ? 'Verified historical pack'
                  : 'Verified EPANTRY product'
                : resolution.state ===
                    'provisional_external'
                  ? 'External product details found'
                  : 'Product is not yet verified in EPANTRY'}
          </p>

          <p className="mt-1 text-[10px] font-semibold leading-4 opacity-80 sm:text-xs sm:font-normal sm:leading-5">
            {hostMode
              ? verified
                ? 'This barcode matches an existing EPANTRY product. Continue to pricing and stock when you are ready.'
                : 'Add clear pack photos and complete the details below. EPANTRY checks them before this product can be listed.'
              : verified
                ? 'This result is backed by a published EPANTRY canonical Product Version.'
                : 'These details can help you identify the pack, but they are not EPANTRY-verified catalog truth.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function ExternalProductDetails({
  candidate,
}) {
  if (
    !candidate
  ) {
    return null
  }

  const imageUrl =
    candidate.referenceImages
      ?.front ||
    candidate.referenceImages
      ?.ingredients ||
    candidate.referenceImages
      ?.nutrition ||
    ''

  return (
    <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2.5 sm:mt-5 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-5">
      <div className="self-start overflow-hidden rounded-[14px] border border-amber-200 bg-amber-50 sm:rounded-[24px]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={
              candidate.title ||
              'Scanned product'
            }
            className="aspect-[3/4] w-full object-cover sm:aspect-square"
          />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-stone-400 sm:aspect-square">
            <Barcode
              size={30}
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 self-center sm:self-start">
        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-amber-700 sm:text-xs sm:tracking-[0.12em]">
          {candidate.brandName ||
            'External product match'}
        </p>

        <h2 className="mt-0.5 text-[15px] font-black leading-[18px] text-stone-950 sm:mt-1 sm:text-2xl sm:leading-normal">
          {candidate.title ||
            candidate.genericName ||
            'Scanned product'}
        </h2>

        <div className="mt-1.5 flex flex-wrap gap-1 text-[8px] font-bold sm:mt-3 sm:gap-2 sm:text-[11px]">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 sm:px-2.5">
            {confidenceLabel(
              candidate.confidence,
            )}
          </span>

          <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-600 sm:px-2.5">
            {candidate.source
              ?.sourceName ||
              'External data'}
          </span>
        </div>
      </div>

      <div className="col-span-2 grid grid-cols-2 gap-1.5 sm:col-span-1 sm:col-start-2 sm:mt-1 sm:gap-3">
        <ProductFact
          label="Barcode"
          value={
            candidate.barcode
          }
        />

        <ProductFact
          label="Pack size"
          value={
            candidate.netQuantityText
          }
        />

        <ProductFact
          label="Category"
          value={
            candidate.categoryText
          }
        />

        <ProductFact
          label="Country of origin"
          value={
            candidate.originText ||
            candidate.countryText
          }
        />

        <ProductFact
          label="Ingredients"
          value={
            candidate.ingredientDeclarationText
          }
          mobileWide
        />

        <ProductFact
          label="Allergens"
          value={
            candidate.allergenText
          }
        />

        <ProductFact
          label="May contain"
          value={
            candidate.traceTags
          }
        />

        <ProductFact
          label="Nutrition"
          value={
            nutritionLabel(
              candidate.nutrition,
            )
          }
        />
      </div>
    </div>
  )
}

export default function ScanAnythingPage({
  mode =
    'customer',
}) {
  const hostMode =
    mode ===
    'host'

  const videoRef =
    useRef(
      null,
    )

  const streamRef =
    useRef(
      null,
    )

  const timerRef =
    useRef(
      null,
    )

  const [
    barcodeInput,
    setBarcodeInput,
  ] =
    useState(
      '',
    )

  const [
    market,
    setMarket,
  ] =
    useState(
      'IN',
    )

  const [
    barcodeResolution,
    setBarcodeResolution,
  ] =
    useState(
      null,
    )

  const [
    isResolvingBarcode,
    setIsResolvingBarcode,
  ] =
    useState(
      false,
    )

  const [
    isCameraRunning,
    setIsCameraRunning,
  ] =
    useState(
      false,
    )

  const [
    cameraNotice,
    setCameraNotice,
  ] =
    useState(
      '',
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const [
    privacyHolds,
    setPrivacyHolds,
  ] =
    useState(
      [],
    )

  const [
    evidencePurpose,
    setEvidencePurpose,
  ] =
    useState(
      'front_pack',
    )

  const [
    evidenceFiles,
    setEvidenceFiles,
  ] =
    useState(
      [],
    )

  const [
    uploadProgress,
    setUploadProgress,
  ] =
    useState(
      null,
    )

  const [
    isCreatingNpi,
    setIsCreatingNpi,
  ] =
    useState(
      false,
    )

  const [
    hostNpiResult,
    setHostNpiResult,
  ] =
    useState(
      null,
    )

  const [
    hints,
    setHints,
  ] =
    useState({
      title:
        '',

      brandName:
        '',

      netQuantityText:
        '',
    })

  const [
    reviewDetails,
    setReviewDetails,
  ] =
    useState(
      createReviewDetails,
    )

  const canonicalProduct =
    barcodeResolution
      ?.product ||
    null

  const externalCandidate =
    barcodeResolution
      ?.externalCandidate ||
    null

  const searchQuery =
    useMemo(
      () => {
        const parts = [
          canonicalProduct
            ?.brand?.name ||
            externalCandidate
              ?.brandName ||
            '',

          canonicalProduct
            ?.displayName ||
            externalCandidate
              ?.title ||
            externalCandidate
              ?.genericName ||
            '',
        ]
          .map(
            compactText,
          )
          .filter(
            Boolean,
          )

        return [
          ...new Set(
            parts,
          ),
        ].join(
          ' ',
        )
      },
      [
        canonicalProduct,
        externalCandidate,
      ],
    )

  const stopCamera =
    () => {
      if (
        timerRef.current
      ) {
        window.clearInterval(
          timerRef.current,
        )

        timerRef.current =
          null
      }

      if (
        streamRef.current
      ) {
        for (
          const track
          of streamRef.current.getTracks()
        ) {
          track.stop()
        }

        streamRef.current =
          null
      }

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null
      }

      setIsCameraRunning(
        false,
      )
    }

  useEffect(
    () =>
      () => {
        if (
          timerRef.current
        ) {
          window.clearInterval(
            timerRef.current,
          )
        }

        if (
          streamRef.current
        ) {
          for (
            const track
            of streamRef.current.getTracks()
          ) {
            track.stop()
          }
        }
      },
    [],
  )

  async function resolveCode(
    code,
    source,
    decodedFormat =
      'UNKNOWN',
  ) {
    const normalized =
      compactText(
        code,
      )

    if (
      !normalized
    ) {
      setError(
        'Enter or scan a barcode first.',
      )

      return
    }

    setError(
      '',
    )
    setSuccess(
      '',
    )
    setHostNpiResult(
      null,
    )
    setReviewDetails(
      createReviewDetails(),
    )
    setPrivacyHolds(
      [],
    )
    setCameraNotice(
      '',
    )
    setIsResolvingBarcode(
      true,
    )

    try {
      const resolver =
        hostMode
          ? resolveHostUniversalBarcode
          : resolveUniversalBarcode

      const result =
        await resolver({
          code:
            normalized,

          decodedFormat,

          source,

          market,
        })

      const resolution =
        result?.resolution ||
        null

      setBarcodeInput(
        normalized,
      )

      setBarcodeResolution(
        resolution,
      )

      if (
        hostMode &&
        resolution?.externalCandidate
      ) {
        const candidate =
          resolution.externalCandidate

        setHints({
          title:
            candidate.title ||
            candidate.genericName ||
            '',

          brandName:
            candidate.brandName ||
            '',

          netQuantityText:
            candidate.netQuantityText ||
            '',
        })

        setReviewDetails({
          ...createReviewDetails(),
          ingredientDeclarationText:
            candidate.ingredientDeclarationText ||
            '',
          allergenStatement:
            candidate.allergenText ||
            '',
          mayContainAllergens:
            Array.isArray(candidate.traceTags)
              ? candidate.traceTags.join(', ')
              : '',
          countryOfOrigin:
            candidate.originText ||
            candidate.countryText ||
            '',
          nutritionBasis:
            candidate.nutritionBasis ||
            'per_100g',
        })
      }
    } catch (
      requestError
    ) {
      setError(
        getUniversalProductErrorMessage(
          requestError,
          'Unable to resolve this barcode.',
        ),
      )
    } finally {
      setIsResolvingBarcode(
        false,
      )
    }
  }

  async function startCamera() {
    setError(
      '',
    )
    setCameraNotice(
      '',
    )

    if (
      typeof window ===
        'undefined' ||
      !navigator.mediaDevices
        ?.getUserMedia
    ) {
      setCameraNotice(
        'Camera access is not supported here. Enter the barcode manually.',
      )

      return
    }

    if (
      !(
        'BarcodeDetector' in
        window
      )
    ) {
      setCameraNotice(
        'Live barcode detection is not supported by this browser. Enter the barcode manually.',
      )

      return
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal:
                'environment',
            },
          },

          audio:
            false,
        })

      streamRef.current =
        stream

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          stream

        await videoRef.current.play()
      }

      const Detector =
        window.BarcodeDetector

      const detector =
        new Detector({
          formats: [
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
          ],
        })

      setIsCameraRunning(
        true,
      )

      setCameraNotice(
        'Hold the barcode steady inside the camera view.',
      )

      timerRef.current =
        window.setInterval(
          async () => {
            if (
              !videoRef.current ||
              videoRef.current.readyState <
                2
            ) {
              return
            }

            try {
              const detected =
                await detector.detect(
                  videoRef.current,
                )

              const first =
                detected?.[0]

              if (
                first?.rawValue
              ) {
                stopCamera()

                await resolveCode(
                  first.rawValue,
                  'camera',
                  first.format ||
                    'UNKNOWN',
                )
              }
            } catch {
              // A single unreadable camera frame is not an application error.
            }
          },
          650,
        )
    } catch (
      cameraError
    ) {
      stopCamera()

      setCameraNotice(
        cameraError?.name ===
          'NotAllowedError'
          ? 'Camera permission was not granted. Enter the barcode manually.'
          : 'Camera could not be started. Enter the barcode manually.',
      )
    }
  }

  function addEvidenceFiles(
    event,
  ) {
    const files =
      Array.from(
        event.target.files ||
          [],
      )

    event.target.value =
      ''

    if (
      !files.length
    ) {
      return
    }

    const supported =
      files.filter(
        (
          file,
        ) =>
          ACCEPTED_IMAGE_TYPES.has(
            file.type,
          ),
      )

    if (
      supported.length !==
      files.length
    ) {
      setError(
        'Only JPEG, PNG, and WebP product images are accepted.',
      )
    } else {
      setError(
        '',
      )
    }

    setEvidenceFiles(
      (
        current,
      ) =>
        [
          ...current,

          ...supported.map(
            (
              file,
            ) => ({
              id:
                createLocalId(),

              purpose:
                evidencePurpose,

              file,
            }),
          ),
        ].slice(
          0,
          8,
        ),
    )
  }

  function removeEvidence(
    evidenceId,
  ) {
    setEvidenceFiles(
      (
        current,
      ) =>
        current.filter(
          (
            item,
          ) =>
            item.id !==
            evidenceId,
        ),
    )
  }

  async function createHostDraft() {
    if (
      !hostMode ||
      !evidenceFiles.length
    ) {
      setError(
        'Add at least one clear pack photo before sending this product for review.',
      )

      return
    }

    setError(
      '',
    )
    setSuccess(
      '',
    )
    setPrivacyHolds(
      [],
    )
    setIsCreatingNpi(
      true,
    )
    setUploadProgress({
      completed:
        0,

      total:
        evidenceFiles.length,
    })

    try {
      const assets =
        await uploadProductEvidenceBatch({
          evidenceFiles,

          scope:
            'host',

          onProgress:
            setUploadProgress,
        })

      const result =
        await createHostNpiFromImages({
          assets,

          market,

          hints: {
            title:
              hints.title,

            brandName:
              hints.brandName,

            barcode:
              barcodeInput.trim(),

            netQuantityText:
              hints.netQuantityText,
          },

          hostDeclarations:
            buildReviewDeclarations(
              reviewDetails,
            ),
        })

      setHostNpiResult(
        result,
      )
      setEvidenceFiles(
        [],
      )

      const status =
        result?.resolution
          ?.draft?.status ||
        ''

      setSuccess(
        status ===
          'ready_for_review'
          ? 'Product details are ready for review.'
          : 'Product review draft created. Open Add / Edit Products to continue.',
      )
    } catch (
      requestError
    ) {
      const holds =
        extractMediaPrivacyHolds(
          requestError,
        )

      setPrivacyHolds(
        holds,
      )

      setError(
        getUniversalProductErrorMessage(
          requestError,
          'Unable to prepare this product for review.',
        ),
      )
    } finally {
      setIsCreatingNpi(
        false,
      )
      setUploadProgress(
        null,
      )
    }
  }

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-hidden bg-[#F7FBFF] px-5 pb-0 pt-0 sm:left-auto sm:w-auto sm:translate-x-0 sm:overflow-visible sm:bg-transparent sm:px-7 sm:pb-7 sm:pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      {hostMode ? (
        <section className="overflow-hidden rounded-[22px] border border-emerald-200 bg-[#F4FBF8] shadow-[0_18px_45px_-32px_rgba(5,150,105,0.28)] sm:rounded-[28px]">
          <div className="border-b border-emerald-200 bg-[linear-gradient(135deg,#DDF8EC_0%,#E8F5FF_52%,#F1EDFF_100%)] p-3 sm:p-6 lg:p-7">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl">
                <Store
                  size={23}
                  className="h-5 w-5 sm:h-[23px] sm:w-[23px]"
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-700 sm:text-[11px] sm:tracking-[0.17em]">
                  PRODUCT SCAN
                </p>

                <h1 className="mt-0.5 text-[21px] font-black leading-6 tracking-tight text-stone-950 sm:mt-1 sm:text-3xl sm:leading-tight">
                  Scan a product to list
                </h1>

                <p className="mt-1.5 max-w-3xl text-[10.5px] font-semibold leading-[15px] text-stone-600 sm:mt-3 sm:text-sm sm:font-medium sm:leading-6">
                  <span className="sm:hidden">
                    Scan the barcode to find a match. New products need pack photos before review.
                  </span>
                  <span className="hidden sm:inline">
                    Scan the pack barcode. Existing EPANTRY products can move to pricing and stock; new products will ask for pack photos before review.
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
              {[
                {
                  number: '1',
                  title: 'Scan barcode',
                  text: 'Enter the code or use your camera.',
                  tone: 'border-emerald-200 bg-emerald-50',
                  numberTone: 'bg-emerald-600',
                },
                {
                  number: '2',
                  title: 'Check match',
                  text: 'EPANTRY looks for an existing product.',
                  tone: 'border-sky-200 bg-sky-50',
                  numberTone: 'bg-sky-600',
                },
                {
                  number: '3',
                  title: 'Review if new',
                  text: 'Add clear pack photos for a new product.',
                  tone: 'border-violet-200 bg-violet-50',
                  numberTone: 'bg-violet-600',
                },
                {
                  number: '4',
                  title: 'Continue listing',
                  text: 'Move to Pricing & Stock or Add / Edit Products.',
                  tone: 'border-cyan-200 bg-cyan-50',
                  numberTone: 'bg-cyan-700',
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className={`rounded-xl border p-2 sm:rounded-2xl sm:p-3 ${step.tone}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black text-white sm:h-6 sm:w-6 sm:text-[10px] ${step.numberTone}`}>
                      {step.number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black leading-3 text-stone-900 sm:text-xs sm:leading-4">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[8.5px] font-semibold leading-[12px] text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 grid gap-2 sm:mt-0 sm:gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="bg-[#EAF6FF] p-3 sm:p-7 lg:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-sky-700 sm:text-[10px]">
                    BARCODE CHECK
                  </p>
                  <h2 className="mt-0.5 text-sm font-black text-stone-950 sm:text-lg">
                    Find the product
                  </h2>
                </div>
                <div className="rounded-xl border border-sky-200 bg-white/80 px-2.5 py-1.5 text-[9px] font-black text-sky-700 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-[10px]">
                  Host listing
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] gap-2 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_100px] sm:gap-4">
                <label className="block min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-[0.11em] text-stone-500 sm:text-xs sm:tracking-[0.12em]">
                    Barcode number
                  </span>

                  <div className="mt-1 flex min-h-10 rounded-xl border border-sky-200 bg-white/90 p-1 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100 sm:mt-2 sm:min-h-0 sm:rounded-2xl sm:p-1.5 sm:focus-within:ring-4">
                    <div className="grid w-8 shrink-0 place-items-center text-stone-400 sm:w-11">
                      <Barcode
                        size={17}
                        aria-hidden="true"
                      />
                    </div>

                    <input
                      value={barcodeInput}
                      onChange={(event) =>
                        setBarcodeInput(
                          event.target.value,
                        )
                      }
                      inputMode="numeric"
                      placeholder="8901234567890"
                      className="min-w-0 flex-1 bg-transparent px-0.5 py-1.5 text-[11px] font-bold outline-none sm:px-1 sm:py-2.5 sm:text-sm"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-[8px] font-black uppercase tracking-[0.11em] text-stone-500 sm:text-xs sm:tracking-[0.12em]">
                    Market
                  </span>

                  <input
                    value={market}
                    onChange={(event) =>
                      setMarket(
                        event.target.value
                          .toUpperCase()
                          .slice(
                            0,
                            10,
                          ),
                      )
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-sky-200 bg-white/90 px-2 text-center text-[11px] font-black outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm sm:focus:ring-4"
                  />
                </label>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  disabled={isResolvingBarcode}
                  onClick={() =>
                    resolveCode(
                      barcodeInput,
                      'manual',
                    )
                  }
                  className="focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-2.5 py-2 text-[10px] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  {isResolvingBarcode ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileSearch
                      size={15}
                      aria-hidden="true"
                    />
                  )}

                  Check barcode
                </button>

                <button
                  type="button"
                  onClick={
                    isCameraRunning
                      ? stopCamera
                      : startCamera
                  }
                  className="focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-[10px] font-black text-violet-800 transition hover:border-violet-300 hover:bg-violet-100 sm:min-h-0 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  <Camera
                    size={15}
                    aria-hidden="true"
                  />

                  {isCameraRunning
                    ? 'Stop camera'
                    : 'Use camera'}
                </button>
              </div>

              <div
                className={[
                  'mt-3 overflow-hidden rounded-xl bg-stone-950 sm:mt-5 sm:rounded-[24px]',
                  isCameraRunning
                    ? 'block'
                    : 'hidden',
                ].join(' ')}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-[180px] w-full object-cover sm:h-auto sm:aspect-video"
                />
              </div>

              {cameraNotice ? (
                <p className="mt-2 text-[9px] font-semibold leading-4 text-stone-500 sm:mt-3 sm:text-xs sm:leading-5">
                  {cameraNotice}
                </p>
              ) : null}

              {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-[10px] font-semibold leading-4 text-red-700 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                  <CircleAlert
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}

              {success ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-[10px] font-semibold leading-4 text-emerald-800 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{success}</span>
                </div>
              ) : null}

              {privacyHolds.length ? (
                <div className="mt-3 sm:mt-5">
                  <MediaPrivacyHoldPanel
                    holds={privacyHolds}
                    scope="host"
                  />
                </div>
              ) : null}
            </div>

            <aside className="border-t border-violet-200 bg-[#F1EDFF] p-3 sm:p-6 xl:border-l xl:border-t-0 xl:p-7">
              <div className="flex items-center gap-2 text-stone-950">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-600 text-white sm:h-10 sm:w-10 sm:rounded-2xl">
                  <ShieldCheck
                    size={17}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-violet-700 sm:text-[10px]">
                    AFTER THE SCAN
                  </p>
                  <h2 className="text-sm font-black text-stone-950 sm:text-base">
                    What happens next
                  </h2>
                </div>
              </div>

              <p className="mt-2 text-[9.5px] font-semibold leading-[14px] text-stone-600 sm:mt-3 sm:text-sm sm:font-medium sm:leading-6">
                <span className="sm:hidden">
                  EPANTRY checks the barcode first. New products need clear pack photos before listing.
                </span>
                <span className="hidden sm:inline">
                  EPANTRY checks whether the barcode already matches a product. New products need clear pack photos and review before they can be listed.
                </span>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 xl:grid-cols-1 xl:gap-3">
                {[
                  {
                    title: 'Existing product',
                    text: 'Continue to Pricing & Stock.',
                    tone: 'border-emerald-200 bg-emerald-50',
                  },
                  {
                    title: 'New product',
                    text: 'Add clear product and pack photos.',
                    tone: 'border-sky-200 bg-sky-50',
                  },
                  {
                    title: 'Product review',
                    text: 'EPANTRY checks new product details before listing.',
                    tone: 'border-violet-200 bg-violet-50',
                  },
                  {
                    title: 'Next workspace',
                    text: 'Continue in Add / Edit Products when review is needed.',
                    tone: 'border-cyan-200 bg-cyan-50',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={`flex gap-2 rounded-xl border p-2 sm:gap-3 sm:rounded-2xl sm:p-3 ${item.tone}`}
                  >
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-emerald-700 sm:h-[17px] sm:w-[17px]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-black leading-3 text-stone-900 sm:text-xs sm:leading-4">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[8.5px] font-semibold leading-[12px] text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section
          className={`-ml-1 -mr-7 w-[calc(100%+2rem)] rounded-none border border-sky-200 bg-[#F7FBFF] shadow-[0_24px_60px_-30px_rgba(15,23,42,0.18)] ${
            isCameraRunning
              ? 'h-auto min-h-[100svh] overflow-visible'
              : 'h-[100svh] overflow-hidden'
          } sm:mx-0 sm:h-auto sm:w-auto sm:overflow-hidden sm:rounded-[32px] sm:border-sky-200 sm:bg-[#F7FBFF] sm:shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)]`}
        >
          <div
            className={`grid min-h-0 gap-0 ${
              isCameraRunning
                ? 'h-auto grid-rows-[50svh_auto]'
                : 'h-full grid-rows-2'
            } sm:h-auto sm:min-h-[410px] sm:grid-rows-none xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]`}
          >
            <div
              className={`order-2 relative flex min-h-0 flex-col border-t border-sky-200 bg-[radial-gradient(circle_at_12%_8%,rgba(45,180,169,0.16),transparent_28%),linear-gradient(135deg,#DFF8F1_0%,#DDF3FF_52%,#E9E7FF_100%)] p-3 ${
                isCameraRunning ? 'overflow-visible' : 'overflow-hidden'
              } sm:order-1 sm:block sm:min-h-0 sm:overflow-hidden sm:border-t-0 sm:bg-[radial-gradient(circle_at_12%_8%,rgba(45,180,169,0.16),transparent_28%),linear-gradient(135deg,#DFF8F1_0%,#DDF3FF_52%,#E9E7FF_100%)] sm:p-7 lg:p-9`}
            >
              <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl sm:bg-teal-200/35" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rounded-tl-[90px] border-l border-t border-white/10 bg-white/[0.03] sm:border-sky-200/80 sm:bg-sky-200/30" />

              <div className="relative flex h-full w-full max-w-3xl flex-col justify-start sm:block sm:h-auto">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#007E68] text-white shadow-[0_14px_30px_-18px_rgba(0,126,104,0.65)] sm:h-14 sm:w-14 sm:rounded-[20px]">
                    <ScanLine
                      size={22}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#006B5A] sm:text-[11px] sm:tracking-[0.2em] sm:text-[#006B5A]">
                      Quick product finder
                    </p>

                    <h1 className="mt-0.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:mt-1 sm:text-4xl sm:text-stone-950">
                      Scan a product
                    </h1>

                    <p className="mt-1 whitespace-nowrap text-[10px] font-semibold leading-4 text-stone-500 sm:hidden">
                      Scan a barcode to find matching EPANTRY products.
                    </p>
                    <p className="mt-3 hidden max-w-2xl text-[15px] font-medium leading-6 text-stone-600 sm:block">
                      Scan the barcode to identify a product and find matching items available on EPANTRY.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-none border-0 bg-transparent p-0 shadow-none sm:mt-7 sm:block sm:rounded-[28px] sm:border sm:border-sky-200 sm:bg-[#EAF6FF] sm:p-5 sm:shadow-[0_22px_50px_-34px_rgba(37,99,235,0.20)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-stone-500 sm:text-[11px] sm:tracking-[0.16em] sm:text-stone-500">
                        Enter or scan barcode
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold leading-4 text-stone-500 sm:hidden">
                        Enter barcode digits or use the camera.
                      </p>
                      <p className="mt-1 hidden text-xs font-semibold leading-5 text-stone-400 sm:block">
                        Type the numbers printed below the barcode, or use your camera.
                      </p>
                    </div>

                    <label className="hidden items-center gap-2 rounded-2xl border border-violet-200 bg-[#EEEAFE] px-3 py-2 sm:flex">
                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-stone-400">
                        Market
                      </span>

                      <input
                        value={market}
                        onChange={(event) =>
                          setMarket(
                            event.target.value
                              .toUpperCase()
                              .slice(0, 10),
                          )
                        }
                        className="w-12 bg-transparent text-center text-sm font-black text-stone-800 outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-2 grid grid-cols-[82px_minmax(0,1fr)] gap-2 sm:mt-4 sm:block">
                    <label className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-violet-200 bg-[#EEEAFE] px-2 sm:hidden">
                      <span className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-400">
                        Market
                      </span>
                      <input
                        value={market}
                        onChange={(event) =>
                          setMarket(
                            event.target.value
                              .toUpperCase()
                              .slice(0, 10),
                          )
                        }
                        className="w-7 bg-transparent text-center text-[11px] font-black text-stone-800 outline-none"
                      />
                    </label>

                    <label className="block">
                      <div className="flex min-h-11 items-center rounded-xl border border-sky-200 bg-[#F9FCFF] px-2 shadow-inner shadow-sky-100/80 transition focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100 sm:min-h-[62px] sm:rounded-[20px] sm:px-3 sm:focus-within:ring-4">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#E5F4FF] text-[#1769E0] shadow-sm ring-1 ring-sky-200 sm:h-11 sm:w-11 sm:rounded-2xl">
                          <Barcode
                            size={18}
                            aria-hidden="true"
                          />
                        </div>

                        <input
                          value={barcodeInput}
                          onChange={(event) =>
                            setBarcodeInput(
                              event.target.value,
                            )
                          }
                          inputMode="numeric"
                          placeholder="8901234567890"
                          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[12px] font-bold tracking-[0.03em] text-stone-900 outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-stone-400 sm:px-4 sm:py-3 sm:text-base sm:tracking-[0.04em]"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <button
                      type="button"
                      disabled={isResolvingBarcode}
                      onClick={() =>
                        resolveCode(
                          barcodeInput,
                          'manual',
                        )
                      }
                      className="focus-ring order-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#007E68] px-3 py-2 text-[11px] font-black text-white shadow-[0_12px_25px_-16px_rgba(0,126,104,0.8)] transition hover:-translate-y-0.5 hover:bg-[#006A59] disabled:cursor-not-allowed disabled:opacity-60 sm:order-1 sm:min-h-12 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                    >
                      {isResolvingBarcode ? (
                        <LoaderCircle
                          size={16}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <FileSearch
                          size={16}
                          aria-hidden="true"
                        />
                      )}

                      Find product
                    </button>

                    <button
                      type="button"
                      onClick={
                        isCameraRunning
                          ? stopCamera
                          : startCamera
                      }
                      className="focus-ring order-1 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-[#E4F7F2] px-3 py-2 text-[11px] font-black text-[#1D4F91] shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-[#D7F2EC] hover:text-[#143B73] sm:order-2 sm:min-h-12 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                    >
                      <Camera
                        size={16}
                        aria-hidden="true"
                      />

                      {isCameraRunning
                        ? 'Stop camera'
                        : 'Use camera'}
                    </button>
                  </div>
                </div>

                <div
                  className={[
                    'mt-5 overflow-hidden rounded-[24px] bg-stone-950 ring-1 ring-stone-900/10',
                    isCameraRunning
                      ? 'block'
                      : 'hidden',
                  ].join(' ')}
                >
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="h-[180px] w-full object-cover sm:h-auto sm:aspect-video"
                  />
                </div>

                {cameraNotice ? (
                  <p className="mt-3 text-xs font-semibold leading-5 text-stone-500">
                    {cameraNotice}
                  </p>
                ) : null}

                {error ? (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    <CircleAlert
                      size={19}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />

                    <span>{error}</span>
                  </div>
                ) : null}

                {success ? (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                    <CheckCircle2
                      size={19}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />

                    <span>{success}</span>
                  </div>
                ) : null}

                {privacyHolds.length ? (
                  <div className="mt-5">
                    <MediaPrivacyHoldPanel
                      holds={privacyHolds}
                      scope="customer"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="order-1 relative flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(160deg,#ECE9FF_0%,#E2F2FF_55%,#E4F7F1_100%)] p-3 sm:order-2 sm:block sm:min-h-0 sm:border-t sm:border-violet-200 sm:bg-[linear-gradient(160deg,#ECE9FF_0%,#E2F2FF_55%,#E4F7F1_100%)] sm:p-7 lg:p-8 xl:border-l xl:border-t-0">
              <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full border border-white/10 bg-white/[0.03] sm:border-violet-300/60 sm:bg-[#DFF0FF]/70" />

              <div className="relative flex h-full flex-col sm:block sm:h-auto">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#6D4AFF] text-white shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
                    <ShieldCheck
                      size={21}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#6246C7] sm:text-[10px] sm:tracking-[0.18em] sm:text-[#6246C7]">
                      Scan guide
                    </p>
                    <h2 className="text-[16px] font-black tracking-tight text-stone-950 sm:mt-0.5 sm:text-xl sm:text-stone-950">
                      What you&apos;ll see
                    </h2>
                  </div>
                </div>

                <div className="mt-2 grid flex-1 auto-rows-fr grid-cols-2 gap-2 sm:mt-6 sm:block sm:space-y-3">
                  {[
                    {
                      title: 'Verified on EPANTRY',
                      mobileTitle: 'Verified match',
                      text: 'If the barcode matches our catalog, we show the verified product details.',
                      mobileText: 'See verified EPANTRY product details.',
                    },
                    {
                      title: 'Other product matches',
                      mobileTitle: 'Reference match',
                      text: 'If the product is not verified yet, any external match is shown only as reference information.',
                      mobileText: 'Unverified matches stay reference-only.',
                    },
                    {
                      title: 'Find what is available',
                      mobileTitle: 'Find available',
                      text: 'Use EPANTRY search to find matching products you can browse or buy.',
                      mobileText: 'Search matching products to browse or buy.',
                    },
                    {
                      title: 'Simple product lookup',
                      mobileTitle: 'Quick lookup',
                      text: 'Scanning helps you identify a product quickly and continue to the right product page.',
                      mobileText: 'Identify the product and open its page.',
                    },
                  ].map((item, index) => (
                    <div
                      key={item.title}
                      className="group rounded-xl border border-violet-200 bg-[#EAF3FF] p-2 shadow-[0_10px_24px_-22px_rgba(37,99,235,0.20)] transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-[#E2EDFF] sm:rounded-[20px] sm:border-violet-200 sm:bg-[#EAF3FF] sm:p-4 sm:hover:border-violet-300 sm:hover:bg-[#E2EDFF]"
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500 text-[10px] font-black text-white shadow-sm sm:h-7 sm:w-7 sm:bg-[#6D4AFF] sm:text-[11px]">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[12px] font-black leading-4 text-stone-900 sm:hidden">
                            {item.mobileTitle}
                          </p>
                          <p className="hidden text-sm font-black text-stone-900 sm:block">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[10.5px] font-semibold leading-[15px] text-stone-500 sm:hidden">
                            {item.mobileText}
                          </p>
                          <p className="mt-1 hidden text-xs font-semibold leading-5 text-stone-500 sm:block">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#5267C9] bg-[#5D70D6] px-3 py-2 text-white shadow-[0_14px_28px_-22px_rgba(37,99,235,0.35)] sm:mt-5 sm:block sm:rounded-[20px] sm:border-[#5267C9] sm:bg-[#5D70D6] sm:px-4 sm:py-4">
                  <p className="shrink-0 text-[8px] font-black uppercase tracking-[0.12em] text-violet-100 sm:text-xs sm:tracking-[0.14em]">
                    Quick tip
                  </p>
                  <p className="text-[9px] font-semibold leading-3 text-white/90 sm:mt-1 sm:text-sm sm:leading-6">
                    Keep the barcode clear and centered for the fastest match.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      {barcodeResolution ? (
        <section className={`mt-3 rounded-[20px] border p-3 shadow-sm sm:mt-5 sm:rounded-[28px] sm:p-7 ${hostMode && !canonicalProduct ? 'border-amber-200 bg-[#FFF9EE]' : 'border-stone-200 bg-white'}`}> 
          <VerificationBanner
            resolution={
              barcodeResolution
            }
            hostMode={
              hostMode
            }
          />

          {canonicalProduct ? (
            <div className="mt-5 grid gap-5 md:grid-cols-[140px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-2xl bg-stone-100">
                {canonicalProduct.image
                  ?.url ? (
                  <img
                    src={
                      canonicalProduct.image.url
                    }
                    alt={
                      canonicalProduct.image.alt ||
                      canonicalProduct.displayName
                    }
                    className="aspect-square h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-square place-items-center text-stone-400">
                    <Barcode
                      size={30}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                  {canonicalProduct.brand
                    ?.name ||
                    'Canonical product'}
                </p>

                <h2 className="mt-1 text-2xl font-black text-stone-950">
                  {canonicalProduct.displayName}
                </h2>

                <p className="mt-2 text-sm text-stone-500">
                  GTIN{' '}
                  {canonicalProduct.gtin ||
                    'not displayed'}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/products/${encodeURIComponent(
                      canonicalProduct.productVersionId ||
                        canonicalProduct.id,
                    )}/passport`}
                    className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
                  >
                    Open Product Passport
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                    />
                  </Link>

                  {hostMode ? (
                    <Link
                      to={`/host/marketplace?packId=${encodeURIComponent(
                        canonicalProduct.packId ||
                          '',
                      )}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      <PackagePlus
                        size={17}
                        aria-hidden="true"
                      />
                      Continue to pricing & stock
                    </Link>
                  ) : searchQuery ? (
                    <Link
                      to={`/search?q=${encodeURIComponent(
                        searchQuery,
                      )}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      <Search
                        size={17}
                        aria-hidden="true"
                      />
                      Search EPANTRY
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : externalCandidate ? (
            <>
              <ExternalProductDetails
                candidate={
                  externalCandidate
                }
              />

              {!hostMode &&
              searchQuery ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="font-black text-emerald-950">
                      Want to buy this on EPANTRY?
                    </p>

                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      Search the marketplace for this product or close matches. External scan data does not mean an EPANTRY listing already exists.
                    </p>
                  </div>

                  <Link
                    to={`/search?q=${encodeURIComponent(
                      searchQuery,
                    )}`}
                    className="focus-ring mt-3 inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 sm:mt-0"
                  >
                    <Search
                      size={17}
                      aria-hidden="true"
                    />
                    Search EPANTRY
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="font-black text-stone-900">
                No product details were found for this barcode.
              </p>

              <p className="mt-2 text-sm leading-6 text-stone-600">
                {hostMode
                  ? 'Add clear pack photos below so EPANTRY can review this new product.'
                  : 'Try searching EPANTRY using the product or brand name printed on the pack.'}
              </p>
            </div>
          )}
        </section>
      ) : null}

      {hostMode &&
      barcodeResolution &&
      !canonicalProduct ? (
        <section className="mt-3 rounded-[20px] border border-emerald-200 bg-[#EAFBF3] p-3 shadow-sm sm:mt-5 sm:rounded-[28px] sm:p-7">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white sm:h-10 sm:w-10 sm:rounded-2xl">
              <ImagePlus
                size={18}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-xs">
                COMPLETE NEW PRODUCT
              </p>

              <h2 className="mt-0.5 text-[17px] font-black leading-5 text-stone-950 sm:mt-1 sm:text-xl sm:leading-normal">
                Add the details needed for review
              </h2>

              <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:font-normal sm:leading-6">
                Add clear pack photos and copy the label details below. EPANTRY checks them before this product can be listed.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {[
              {
                number: '1',
                title: 'Add photos',
                text: 'Upload clear pack and label photos.',
                tone: 'border-sky-200 bg-sky-50',
                numberTone: 'bg-sky-600',
              },
              {
                number: '2',
                title: 'Check details',
                text: 'Confirm the name, pack and label facts.',
                tone: 'border-violet-200 bg-violet-50',
                numberTone: 'bg-violet-600',
              },
              {
                number: '3',
                title: 'Add food info',
                text: 'Fill nutrition, allergens and Veg / Non-veg.',
                tone: 'border-cyan-200 bg-cyan-50',
                numberTone: 'bg-cyan-700',
              },
              {
                number: '4',
                title: 'Send for review',
                text: 'Then continue in Add / Edit Products.',
                tone: 'border-emerald-200 bg-emerald-50',
                numberTone: 'bg-emerald-700',
              },
            ].map((step) => (
              <div
                key={step.number}
                className={`rounded-xl border p-2 sm:rounded-2xl sm:p-3 ${step.tone}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black text-white sm:h-6 sm:w-6 sm:text-[10px] ${step.numberTone}`}>
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[14px] text-stone-900 sm:text-xs sm:leading-4">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[8.5px] font-semibold leading-3 text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                      {step.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 xl:mt-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:gap-5">
            <div className="rounded-[18px] border border-sky-200 bg-[#EAF5FF] p-3 sm:rounded-[24px] sm:p-5">
              <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                Product photos
              </p>
              <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                Add the clearest pack panels so the review team can verify the label.
              </p>

              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:mt-4 sm:gap-3">
                <select
                  value={evidencePurpose}
                  onChange={(event) =>
                    setEvidencePurpose(
                      event.target.value,
                    )
                  }
                  className="min-w-0 rounded-xl border border-sky-200 bg-white px-2.5 py-2 text-[10px] font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                >
                  {EVIDENCE_PURPOSES.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>

                <label className="focus-ring inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-[10px] font-black text-white hover:bg-sky-800 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                  <Upload
                    size={15}
                    aria-hidden="true"
                  />
                  Add photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    onChange={addEvidenceFiles}
                    className="sr-only"
                  />
                </label>
              </div>

              {evidenceFiles.length ? (
                <div className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2">
                  {evidenceFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white/90 p-2 sm:gap-3 sm:rounded-2xl sm:p-3"
                    >
                      <ImagePlus
                        size={15}
                        className="shrink-0 text-sky-700"
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-black text-stone-800 sm:text-xs">
                          {item.file.name}
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[11px]">
                          {EVIDENCE_PURPOSES.find(
                            (purpose) =>
                              purpose.value === item.purpose,
                          )?.label || item.purpose}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeEvidence(
                            item.id,
                          )
                        }
                        className="focus-ring grid h-7 w-7 place-items-center rounded-full text-stone-400 hover:bg-white hover:text-red-600 sm:h-8 sm:w-8"
                        aria-label="Remove image"
                      >
                        <X
                          size={15}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[18px] border border-violet-200 bg-[#F2EEFF] p-3 sm:rounded-[24px] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                    Product details
                  </p>
                  <p className="mt-0.5 max-w-2xl text-[9px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                    Check the scan and complete the information printed on the pack before review.
                  </p>
                </div>
                <span className="rounded-full border border-violet-200 bg-white/80 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-violet-700 sm:text-[9px]">
                  Pack details
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Product name
                  </span>
                  <input
                    value={hints.title}
                    onChange={(event) =>
                      setHints((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Brand name
                  </span>
                  <input
                    value={hints.brandName}
                    onChange={(event) =>
                      setHints((current) => ({
                        ...current,
                        brandName: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Printed pack size
                  </span>
                  <input
                    value={hints.netQuantityText}
                    onChange={(event) =>
                      setHints((current) => ({
                        ...current,
                        netQuantityText: event.target.value,
                      }))
                    }
                    placeholder="250 ml"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Country of origin
                  </span>
                  <input
                    value={reviewDetails.countryOfOrigin}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        countryOfOrigin: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Manufacturer / Packer
                  </span>
                  <input
                    value={reviewDetails.manufacturerName}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        manufacturerName: event.target.value,
                      }))
                    }
                    placeholder="Printed manufacturer or packer"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="col-span-2 min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Ingredients
                  </span>
                  <textarea
                    rows={2}
                    maxLength={10000}
                    value={reviewDetails.ingredientDeclarationText}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        ingredientDeclarationText: event.target.value,
                      }))
                    }
                    placeholder="Copy the ingredients from the pack"
                    className="mt-1.5 w-full resize-y rounded-xl border border-violet-200 bg-white px-2.5 py-2 text-[10px] font-semibold leading-4 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm sm:leading-5"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Contains allergens
                  </span>
                  <input
                    value={reviewDetails.containsAllergens}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        containsAllergens: event.target.value,
                      }))
                    }
                    placeholder="Milk, Soy"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    May contain
                  </span>
                  <input
                    value={reviewDetails.mayContainAllergens}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        mayContainAllergens: event.target.value,
                      }))
                    }
                    placeholder="Nuts, Gluten"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>

                <label className="col-span-2 min-w-0">
                  <span className="text-[9px] font-black text-stone-500 sm:text-xs">
                    Printed allergen statement
                  </span>
                  <input
                    value={reviewDetails.allergenStatement}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        allergenStatement: event.target.value,
                      }))
                    }
                    placeholder="Example: Contains milk and soy"
                    className="mt-1.5 h-9 w-full min-w-0 rounded-xl border border-violet-200 bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 rounded-[16px] border border-cyan-200 bg-[#EAFBFD] p-2.5 sm:mt-5 sm:rounded-2xl sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black text-stone-900 sm:text-xs">
                      Nutrition
                    </p>
                    <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
                      Enter only values printed on the pack.
                    </p>
                  </div>

                  <select
                    value={reviewDetails.nutritionBasis}
                    onChange={(event) =>
                      setReviewDetails((current) => ({
                        ...current,
                        nutritionBasis: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-[9px] font-black outline-none sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                  >
                    <option value="per_100g">Per 100 g</option>
                    <option value="per_100ml">Per 100 ml</option>
                    <option value="per_serving">Per serving</option>
                    <option value="per_pack">Per pack</option>
                  </select>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
                  {REVIEW_NUTRIENTS.map(([key, label, unit]) => (
                    <label key={key} className="min-w-0">
                      <span className="block truncate text-[7.5px] font-black uppercase tracking-[0.04em] text-stone-500 sm:text-[9px]">
                        {label} ({unit})
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={reviewDetails.nutrients[key]}
                        onChange={(event) =>
                          setReviewDetails((current) => ({
                            ...current,
                            nutrients: {
                              ...current.nutrients,
                              [key]: event.target.value,
                            },
                          }))
                        }
                        className="mt-1 h-8 w-full min-w-0 rounded-lg border border-cyan-200 bg-white px-2 text-[9px] font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
                  <label className="min-w-0">
                    <span className="text-[8px] font-black text-stone-500 sm:text-[10px]">
                      Serving size
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={reviewDetails.servingSizeValue}
                      onChange={(event) =>
                        setReviewDetails((current) => ({
                          ...current,
                          servingSizeValue: event.target.value,
                        }))
                      }
                      className="mt-1 h-8 w-full rounded-lg border border-cyan-200 bg-white px-2 text-[9px] font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                    />
                  </label>

                  <label className="min-w-0">
                    <span className="text-[8px] font-black text-stone-500 sm:text-[10px]">
                      Serving unit
                    </span>
                    <select
                      value={reviewDetails.servingSizeUnit}
                      onChange={(event) =>
                        setReviewDetails((current) => ({
                          ...current,
                          servingSizeUnit: event.target.value,
                        }))
                      }
                      className="mt-1 h-8 w-full rounded-lg border border-cyan-200 bg-white px-2 text-[9px] font-bold outline-none sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="piece">piece</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-3 rounded-[16px] border border-emerald-200 bg-[#ECF9F2] p-2.5 sm:mt-4 sm:rounded-2xl sm:p-4">
                <p className="text-[10px] font-black text-stone-900 sm:text-xs">
                  Dietary details
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3">
                  <label className="min-w-0">
                    <span className="text-[8px] font-black text-stone-500 sm:text-[10px]">
                      Veg / Non-veg
                    </span>
                    <select
                      value={reviewDetails.dietaryType}
                      onChange={(event) =>
                        setReviewDetails((current) => ({
                          ...current,
                          dietaryType: event.target.value,
                        }))
                      }
                      className="mt-1 h-8 w-full rounded-lg border border-emerald-200 bg-white px-2 text-[9px] font-bold outline-none sm:mt-2 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      <option value="not_declared">Not declared</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="non_vegetarian">Non-vegetarian</option>
                    </select>
                  </label>

                  <label className="flex min-w-0 items-end">
                    <span className="flex h-8 w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2 text-[9px] font-black text-stone-600 sm:h-auto sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs">
                      <input
                        type="checkbox"
                        checked={reviewDetails.glutenFree}
                        onChange={(event) =>
                          setReviewDetails((current) => ({
                            ...current,
                            glutenFree: event.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 accent-emerald-700 sm:h-4 sm:w-4"
                      />
                      Gluten free
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  isCreatingNpi ||
                  !evidenceFiles.length
                }
                onClick={createHostDraft}
                className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3.5 sm:text-sm"
              >
                {isCreatingNpi ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <PackagePlus
                    size={17}
                    aria-hidden="true"
                  />
                )}

                {isCreatingNpi
                  ? uploadProgress
                    ? `Uploading ${uploadProgress.completed}/${uploadProgress.total} photos…`
                    : 'Preparing review…'
                  : 'Send product for review'}
              </button>

              {hostNpiResult ? (
                <Link
                  to="/host/product-intelligence"
                  className="focus-ring mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-[10px] font-black text-emerald-800 hover:bg-emerald-50 sm:mt-3 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  Continue to Add / Edit Products
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                  />
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
