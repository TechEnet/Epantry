import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Factory,
  Globe2,
  Images,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
  ZoomIn,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import EmptyState from '../../../components/common/EmptyState'

import {
  createCommerceIdempotencyKey,
  createDirectMarketplaceCart,
  getCommerceErrorMessage,
  updateDirectMarketplaceCartItem,
} from '../../commerce/services/commerce.service'

import {
  getPublicPackOffers,
} from '../../marketplace/services/marketplace.service'

import useProductDetail from '../hooks/useProductDetail'

import {
  getCatalogCategoryProducts,
  getCatalogProducts,
} from '../services/catalog.service'

import {
  listPublicRecipes,
} from '../../recipes/services/recipe.service'

function formatQuantity(
  quantity,
) {
  if (
    !quantity ||
    quantity.value ===
      undefined ||
    quantity.value ===
      null
  ) {
    return 'Not declared'
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222',
  '122213', '122312', '132212', '221213', '221312', '231212',
  '112232', '122132', '122231', '113222', '123122', '123221',
  '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311',
  '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131',
  '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124',
  '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111',
  '241112', '134111', '111242', '121142', '121241', '114212',
  '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141',
  '411131', '211412', '211214', '211232', '2331112',
]

function normalizeBarcodeValue(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .trim()
}

function buildCode128Bars(value) {
  const digits = normalizeBarcodeValue(value)

  if (!digits) {
    return null
  }

  const startCode = 104
  const values = Array.from(digits).map(
    (character) => character.charCodeAt(0) - 32,
  )

  const checksum =
    (
      startCode +
      values.reduce(
        (sum, code, index) =>
          sum + code * (index + 1),
        0,
      )
    ) % 103

  const encodedValues = [
    startCode,
    ...values,
    checksum,
    106,
  ]

  const quietZone = 10
  let x = quietZone
  const bars = []

  encodedValues.forEach((code) => {
    const pattern = CODE128_PATTERNS[code]

    if (!pattern) {
      return
    }

    Array.from(pattern).forEach((moduleWidth, index) => {
      const width = Number(moduleWidth)

      if (index % 2 === 0) {
        bars.push({
          x,
          width,
        })
      }

      x += width
    })
  })

  return {
    digits,
    bars,
    width: x + quietZone,
  }
}

function ProductBarcode({
  value,
  compact = false,
}) {
  const barcode =
    buildCode128Bars(value)

  if (!barcode) {
    return (
      <span className="text-xs font-bold text-stone-500">
        Not declared
      </span>
    )
  }

  const barHeight =
    compact ? 42 : 56

  const textY =
    barHeight + 15

  return (
    <div className="w-full max-w-[320px]">
      <svg
        viewBox={`0 0 ${barcode.width} ${barHeight + 22}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Barcode ${barcode.digits}`}
        preserveAspectRatio="xMinYMid meet"
        shapeRendering="crispEdges"
      >
        <rect
          width={barcode.width}
          height={barHeight + 22}
          fill="white"
        />

        {barcode.bars.map((bar, index) => (
          <rect
            key={`${bar.x}-${index}`}
            x={bar.x}
            y="2"
            width={bar.width}
            height={barHeight}
            fill="#111827"
          />
        ))}

        <text
          x={barcode.width / 2}
          y={textY}
          textAnchor="middle"
          fontSize={compact ? 8 : 10}
          fontWeight="700"
          letterSpacing="1.4"
          fill="#292524"
        >
          {barcode.digits}
        </text>
      </svg>
    </div>
  )
}

const COUNTRY_META = {
  india: { code: 'IN', cuisine: 'Indian' },
  japan: { code: 'JP', cuisine: 'Japanese' },
  china: { code: 'CN', cuisine: 'Chinese' },
  italy: { code: 'IT', cuisine: 'Italian' },
  mexico: { code: 'MX', cuisine: 'Mexican' },
  thailand: { code: 'TH', cuisine: 'Thai' },
  france: { code: 'FR', cuisine: 'French' },
  spain: { code: 'ES', cuisine: 'Spanish' },
  greece: { code: 'GR', cuisine: 'Greek' },
  turkey: { code: 'TR', cuisine: 'Turkish' },
  vietnam: { code: 'VN', cuisine: 'Vietnamese' },
  indonesia: { code: 'ID', cuisine: 'Indonesian' },
  malaysia: { code: 'MY', cuisine: 'Malaysian' },
  singapore: { code: 'SG', cuisine: 'Singaporean' },
  'south korea': { code: 'KR', cuisine: 'Korean' },
  korea: { code: 'KR', cuisine: 'Korean' },
  'united states': { code: 'US', cuisine: 'American' },
  'united states of america': { code: 'US', cuisine: 'American' },
  usa: { code: 'US', cuisine: 'American' },
  canada: { code: 'CA', cuisine: 'Canadian' },
  brazil: { code: 'BR', cuisine: 'Brazilian' },
  argentina: { code: 'AR', cuisine: 'Argentinian' },
  peru: { code: 'PE', cuisine: 'Peruvian' },
  australia: { code: 'AU', cuisine: 'Australian' },
  'new zealand': { code: 'NZ', cuisine: 'New Zealand' },
  germany: { code: 'DE', cuisine: 'German' },
  portugal: { code: 'PT', cuisine: 'Portuguese' },
  netherlands: { code: 'NL', cuisine: 'Dutch' },
  belgium: { code: 'BE', cuisine: 'Belgian' },
  switzerland: { code: 'CH', cuisine: 'Swiss' },
  austria: { code: 'AT', cuisine: 'Austrian' },
  ireland: { code: 'IE', cuisine: 'Irish' },
  'united kingdom': { code: 'GB', cuisine: 'British' },
  uk: { code: 'GB', cuisine: 'British' },
  egypt: { code: 'EG', cuisine: 'Egyptian' },
  morocco: { code: 'MA', cuisine: 'Moroccan' },
  lebanon: { code: 'LB', cuisine: 'Lebanese' },
  israel: { code: 'IL', cuisine: 'Israeli' },
  'saudi arabia': { code: 'SA', cuisine: 'Saudi Arabian' },
  'united arab emirates': { code: 'AE', cuisine: 'Emirati' },
  uae: { code: 'AE', cuisine: 'Emirati' },
  pakistan: { code: 'PK', cuisine: 'Pakistani' },
  bangladesh: { code: 'BD', cuisine: 'Bangladeshi' },
  'sri lanka': { code: 'LK', cuisine: 'Sri Lankan' },
  nepal: { code: 'NP', cuisine: 'Nepalese' },
}

function normalizeCountryKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const ISO_ALPHA2_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ')

function findCountryCodeByDisplayName(value) {
  const key = normalizeCountryKey(value)

  if (
    !key ||
    typeof Intl === 'undefined' ||
    typeof Intl.DisplayNames !== 'function'
  ) {
    return ''
  }

  try {
    const displayNames =
      new Intl.DisplayNames(
        ['en'],
        { type: 'region' },
      )

    return (
      ISO_ALPHA2_CODES.find(
        (code) =>
          normalizeCountryKey(
            displayNames.of(code),
          ) === key,
      ) ||
      ''
    )
  } catch {
    return ''
  }
}

function resolveCountryMeta(value) {
  const raw = String(value || '').trim()
  const key = normalizeCountryKey(raw)

  if (!raw) {
    return {
      name: '',
      code: '',
      cuisine: '',
      flag: '🌍',
    }
  }

  const directCode =
    /^[a-z]{2}$/i.test(raw)
      ? raw.toUpperCase()
      : ''

  const known =
    COUNTRY_META[key] ||
    null

  const code =
    directCode ||
    known?.code ||
    findCountryCodeByDisplayName(raw) ||
    ''

  const flag =
    code.length === 2
      ? String.fromCodePoint(
          ...Array.from(code).map(
            (character) =>
              127397 + character.charCodeAt(0),
          ),
        )
      : '🌍'

  return {
    name: raw,
    code,
    cuisine:
      known?.cuisine ||
      '',
    flag,
  }
}

function countryDescription(countryName) {
  const country =
    String(countryName || '').trim()

  if (!country) {
    return []
  }

  return [
    `${country} has its own regional food traditions, ingredients, and production practices.`,
    `Foods grown, prepared, or packed there can vary significantly by region and producer.`,
    `EPANTRY shows the published country-of-origin record and connects other listings from the same country when they are available.`,
  ]
}

function recipeCountryCuisine(item) {
  return String(
    item?.dish?.cuisine ||
      item?.recipe?.cuisine ||
      '',
  ).trim()
}

function getCountryRecipeName(item) {
  return (
    item?.dish?.name ||
    item?.recipe?.title ||
    'Recipe'
  )
}

function getCountryRecipePath(item) {
  return (
    item?.path ||
    `/recipes/${encodeURIComponent(
      item?.dish?.slug ||
        item?.recipe?.slug ||
        '',
    )}`
  )
}

function getCountryRecipeImage(item) {
  return (
    item?.dish?.heroImageUrl ||
    item?.recipe?.heroImageUrl ||
    ''
  )
}


const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

function readFloatingMarketplaceCart() {
  try {
    const raw =
      window.sessionStorage.getItem(
        FLOATING_MARKETPLACE_CART_KEY,
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw)

    if (
      !parsed?.cartId ||
      !Array.isArray(parsed?.items)
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function mapMarketplaceCartItems(
  result,
) {
  return (
    Array.isArray(
      result?.items,
    )
      ? result.items
      : []
  ).map(
    (
      item,
    ) => ({
      id:
        item.id ||
        item.packId ||
        item.displayName,
      packId:
        item.packId ||
        '',
      offerId:
        item.offerId ||
        '',
      organizationId:
        item.organizationId ||
        '',
      sellerName:
        item.sellerName ||
        'Marketplace Host',
      name:
        item.displayName ||
        'Product',
      quantity:
        Number(
          item.packCount ||
          1,
        ),
    }),
  )
}

function saveFloatingMarketplaceCart({
  cartId,
  items,
  pincode =
    '',
  fulfillmentType =
    'delivery',
}) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        pincode:
          String(
            pincode ||
            '',
          ).trim(),
        fulfillmentType:
          fulfillmentType ||
          'delivery',
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

function notifyFloatingCartFly({
  name,
  sourceElement,
}) {
  const rect =
    sourceElement
      ?.getBoundingClientRect?.()

  window.dispatchEvent(
    new CustomEvent(
      'epantry-cart-fly',
      {
        detail: {
          name,
          startRect:
            rect
              ? {
                  left:
                    rect.left +
                    rect.width /
                      2,
                  top:
                    rect.top +
                    rect.height /
                      2,
                }
              : null,
        },
      },
    ),
  )
}

function formatMoney(
  amountMinor,
  currency = 'INR',
) {
  if (
    amountMinor ===
      null ||
    amountMinor ===
      undefined
  ) {
    return 'Price unavailable'
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

function DetailCard({
  title,
  children,
  accent =
    false,
  description =
    '',
  icon: Icon =
    null,
}) {
  if (
    !Icon &&
    !description
  ) {
    return (
      <details className="group border-b border-stone-200 last:border-b-0">

        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:px-6">

          <div>

            <h3
              className={[
                'text-sm font-black transition-colors duration-200',
                accent
                  ? 'text-emerald-800'
                  : 'text-stone-950',
                'group-open:text-emerald-900',
              ].join(' ')}
            >
              {title}
            </h3>

            <p className="mt-1 text-xs text-stone-500 group-open:hidden">
              Click to view details
            </p>

          </div>

          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition duration-200 group-hover:border-emerald-200 group-hover:text-emerald-800 group-open:border-emerald-300 group-open:bg-emerald-700 group-open:text-white">
            <ChevronDown
              size={17}
              className="transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </span>

        </summary>

        <div className="border-t border-emerald-100 bg-white px-5 py-5 sm:px-6">
          {children}
        </div>

      </details>
    )
  }

  return (
    <details className="group border-b border-stone-200 last:border-b-0">

      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:px-6">

        <div className="flex min-w-0 items-center gap-3">

          {Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
              <Icon
                size={17}
                aria-hidden="true"
              />
            </span>
          )}

          <div className="min-w-0">

            <h3
              className={[
                'text-sm font-black transition-colors duration-200',
                accent
                  ? 'text-emerald-800'
                  : 'text-stone-950',
                'group-open:text-emerald-900',
              ].join(' ')}
            >
              {title}
            </h3>

            <p className="mt-1 text-xs leading-5 text-stone-500 group-open:hidden">
              {description || 'Click to view details'}
            </p>

          </div>

        </div>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition duration-200 group-hover:border-emerald-200 group-hover:text-emerald-800 group-open:border-emerald-300 group-open:bg-emerald-700 group-open:text-white">
          <ChevronDown
            size={17}
            className="transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </span>

      </summary>

      <div className="border-t border-emerald-100 bg-white px-5 py-5 sm:px-6">
        {children}
      </div>

    </details>
  )
}

function MarketplaceOffers({
  product,
  onOffersResolved,
}) {
  const [
    pincode,
    setPincode,
  ] =
    useState(
      '',
    )

  const [
    offers,
    setOffers,
  ] =
    useState(
      [],
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    )

  const [
    checked,
    setChecked,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      null,
    )

  const [
    addingOfferId,
    setAddingOfferId,
  ] =
    useState(
      '',
    )

  const [
    quantityByOfferId,
    setQuantityByOfferId,
  ] =
    useState(
      {},
    )

  function getOfferQuantityBounds(
    offer,
  ) {
    const minimum =
      Math.max(
        1,
        Number(
          offer?.minimumOrderQuantity ||
            1,
        ),
      )

    const providerMaximum =
      offer?.maximumOrderQuantity ===
        null ||
      offer?.maximumOrderQuantity ===
        undefined
        ? 100000
        : Number(
            offer.maximumOrderQuantity,
          )

    const maximum =
      Math.max(
        minimum,
        Number.isFinite(
          providerMaximum,
        )
          ? Math.floor(
              providerMaximum,
            )
          : 100000,
      )

    return {
      minimum,
      maximum,
    }
  }

  function getOfferQuantity(
    offer,
  ) {
    const {
      minimum,
      maximum,
    } =
      getOfferQuantityBounds(
        offer,
      )

    const current =
      Number(
        quantityByOfferId[
          offer?.id
        ],
      )

    if (
      !Number.isInteger(
        current,
      )
    ) {
      return minimum
    }

    return Math.min(
      maximum,
      Math.max(
        minimum,
        current,
      ),
    )
  }

  function setOfferQuantity(
    offer,
    nextQuantity,
  ) {
    const offerId =
      offer?.id

    if (!offerId) {
      return
    }

    const {
      minimum,
      maximum,
    } =
      getOfferQuantityBounds(
        offer,
      )

    const parsed =
      Number(
        nextQuantity,
      )

    const normalized =
      Number.isFinite(
        parsed,
      )
        ? Math.min(
            maximum,
            Math.max(
              minimum,
              Math.floor(
                parsed,
              ),
            ),
          )
        : minimum

    setQuantityByOfferId(
      (current) => ({
        ...current,
        [offerId]:
          normalized,
      }),
    )

    return normalized
  }

  const packId =
    useMemo(
      () =>
        product?.pack
          ?.id ||
        product?.pack
          ?._id ||
        product?.packId ||
        product?.canonicalPackId ||
        null,
      [
        product,
      ],
    )

  async function syncExistingCartQuantity(
    offer,
    nextQuantity,
  ) {
    const floatingCart =
      readFloatingMarketplaceCart()

    if (
      !floatingCart?.cartId ||
      !packId
    ) {
      return
    }

    const existingItem =
      floatingCart.items.find(
        (
          item,
        ) =>
          String(
            item?.packId ||
            '',
          ) ===
            String(
              packId,
            ) &&
          (
            !item?.offerId ||
            String(
              item.offerId,
            ) ===
              String(
                offer?.id ||
                '',
              )
          ),
      )

    if (
      !existingItem?.id ||
      Number(
        existingItem.quantity ||
        0,
      ) ===
        Number(
          nextQuantity,
        )
    ) {
      return
    }

    setError(
      null,
    )

    try {
      const result =
        await updateDirectMarketplaceCartItem({
          cartId:
            floatingCart.cartId,
          itemId:
            existingItem.id,
          operation:
            'set_quantity',
          quantity:
            nextQuantity,
        })

      const nextItems =
        mapMarketplaceCartItems(
          result,
        )

      saveFloatingMarketplaceCart({
        cartId:
          result?.cart?.id ||
          floatingCart.cartId,
        items:
          nextItems.length >
          0
            ? nextItems
            : floatingCart.items,
        pincode:
          result?.cart?.pincode ||
          floatingCart.pincode ||
          pincode.trim(),
        fulfillmentType:
          result?.cart?.fulfillmentType ||
          floatingCart.fulfillmentType ||
          'delivery',
      })
    } catch (
      quantityError
    ) {
      setError(
        getCommerceErrorMessage(
          quantityError,
          'Unable to update the Marketplace Cart quantity.',
        ),
      )
    }
  }

  function handleQuantityStep(
    offer,
    nextQuantity,
  ) {
    const normalized =
      setOfferQuantity(
        offer,
        nextQuantity,
      )

    if (
      normalized !==
      undefined
    ) {
      void syncExistingCartQuantity(
        offer,
        normalized,
      )
    }
  }

  async function handleCheckOffers(
    event,
  ) {
    event.preventDefault()

    if (
      !packId
    ) {
      setError(
        'Marketplace Pack identity is unavailable for this Product.',
      )

      return
    }

    setLoading(
      true,
    )

    setChecked(
      false,
    )

    setError(
      null,
    )

    try {
      const result =
        await getPublicPackOffers({
          packId,

          pincode:
            pincode.trim(),

          fulfillmentType:
            'delivery',
        })

      const nextOffers =
        result?.offers ||
        []

      setOffers(
        nextOffers,
      )

      onOffersResolved?.({
        offer:
          nextOffers[0] ||
          null,

        pincode:
          pincode.trim(),
      })

      setQuantityByOfferId(
        (current) => {
          const next =
            {}

          const floatingCart =
            readFloatingMarketplaceCart()

          const floatingItem =
            floatingCart?.items?.find(
              (
                item,
              ) =>
                String(
                  item?.packId ||
                  '',
                ) ===
                String(
                  packId ||
                  '',
                ),
            )

          for (
            const offer
            of nextOffers
          ) {
            const {
              minimum,
              maximum,
            } =
              getOfferQuantityBounds(
                offer,
              )

            const cartQuantity =
              Number(
                floatingItem?.quantity,
              )

            const existing =
              Number.isInteger(
                cartQuantity,
              )
                ? cartQuantity
                : Number(
                    current[
                      offer.id
                    ],
                  )

            next[offer.id] =
              Number.isInteger(
                existing,
              )
                ? Math.min(
                    maximum,
                    Math.max(
                      minimum,
                      existing,
                    ),
                  )
                : minimum
          }

          return next
        },
      )

      setChecked(
        true,
      )
    } catch (nextError) {
      setOffers(
        [],
      )

      onOffersResolved?.({
        offer:
          null,

        pincode:
          pincode.trim(),
      })

      setChecked(
        true,
      )

      setError(
        nextError?.message ||
        'Unable to check Marketplace Offers.',
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  async function handleAddToCart(
    offer,
    sourceElement,
  ) {
    if (
      !packId ||
      !offer?.id ||
      !pincode.trim() ||
      addingOfferId
    ) {
      return
    }

    const quantity =
      getOfferQuantity(
        offer,
      )

    setAddingOfferId(
      offer.id,
    )

    setError(
      null,
    )

    try {
      const existingFloatingCart =
        readFloatingMarketplaceCart()

      const result =
        await createDirectMarketplaceCart({
          cartId:
            existingFloatingCart?.cartId ||
            null,

          packId,

          offerId:
            offer.id,

          quantity,

          pincode:
            pincode.trim(),

          fulfillmentType:
            'delivery',

          idempotencyKey:
            createCommerceIdempotencyKey(
              'direct-product-cart',
            ),
        })

      const cartId =
        result?.cart?.id

      if (
        !cartId
      ) {
        throw new Error(
          'Marketplace Cart identity was not returned.',
        )
      }

      const cartItemName =
        product?.displayName ||
        product?.name ||
        'Product'

      const mappedItems =
        mapMarketplaceCartItems(
          result,
        )

      const floatingItems =
        mappedItems.length >
          0
          ? mappedItems
          : [
              {
                id:
                  packId,
                packId,
                name:
                  cartItemName,
                quantity,
              },
            ]

      saveFloatingMarketplaceCart({
        cartId,
        items:
          floatingItems,
        pincode:
          result?.cart?.pincode ||
          pincode.trim(),
        fulfillmentType:
          result?.cart?.fulfillmentType ||
          'delivery',
      })

      notifyFloatingCartFly({
        name:
          cartItemName,
        sourceElement,
      })

    } catch (
      cartError
    ) {
      setError(
        getCommerceErrorMessage(
          cartError,
          'Unable to add this Offer to the Marketplace Cart.',
        ),
      )
    } finally {
      setAddingOfferId(
        '',
      )
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white shadow-[0_12px_34px_rgba(4,120,87,0.08)]">

      <div className="flex items-center gap-3 px-4 pb-2 pt-4">

        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
          <Store
            size={19}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-black text-stone-950">
            Check price by pincode
          </h2>
          <p className="mt-0.5 text-[11px] leading-4 text-stone-500">
            See live Host price and delivery availability.
          </p>
        </div>

      </div>

      <form
        onSubmit={handleCheckOffers}
        className="grid gap-2 px-4 pb-4 pt-2 sm:grid-cols-[minmax(0,1fr)_auto]"
      >

        <div className="relative min-w-0">
          <MapPin
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />

          <input
            required
            inputMode="numeric"
            pattern="[0-9 ]{6,7}"
            value={pincode}
            onChange={(event) => setPincode(event.target.value)}
            className="focus-ring h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-sm font-bold text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="Enter 6-digit pincode"
          />
        </div>

        <button
          disabled={loading}
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(4,120,87,0.18)] transition hover:bg-emerald-800 disabled:opacity-50"
        >
          <Search
            size={15}
            aria-hidden="true"
          />
          {loading ? 'Checking...' : 'Check'}
        </button>

      </form>

      {error && (
        <p className="mx-4 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {checked && !error && offers.length === 0 && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
          <p className="text-xs font-black text-stone-800">
            No eligible Offers for this pincode.
          </p>
          <p className="mt-1 text-[11px] leading-4 text-stone-500">
            Availability can depend on serviceability, current price and inventory.
          </p>
        </div>
      )}

      {offers.length === 0 && (
        <div className="border-t border-emerald-100 px-4 py-3">
          <button
            type="button"
            disabled
            className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-100 px-4 text-xs font-black text-stone-500"
          >
            <ShoppingCart
              size={15}
              aria-hidden="true"
            />
            {checked
              ? 'Add to Cart unavailable for this pincode'
              : 'Check pincode to unlock Add to Cart'}
          </button>
        </div>
      )}

      {offers.length > 0 && (
        <div className="space-y-3 border-t border-emerald-100 px-4 py-4">
          {offers.map((offer) => (
            <article
              key={offer.id}
              className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_10px_28px_rgba(4,120,87,0.08)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                    {offer.seller?.name || 'Marketplace Host'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold capitalize text-stone-500">
                    {offer.fulfillmentTypes?.join(' · ') || 'Delivery'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-800">
                  In stock
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Your price
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-3xl font-black tracking-tight text-stone-950">
                        {formatMoney(
                          offer.price?.effectiveAmountMinor,
                          offer.price?.currency || 'INR',
                        )}
                      </p>

                      {offer.price?.saleAmountMinor !== null &&
                        offer.price?.saleAmountMinor !== undefined &&
                        offer.price?.listAmountMinor !== offer.price?.saleAmountMinor && (
                          <p className="text-xs font-bold text-stone-400 line-through">
                            {formatMoney(
                              offer.price?.listAmountMinor,
                              offer.price?.currency || 'INR',
                            )}
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Quantity
                    </p>
                    <div className="inline-flex items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-inner">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={
                          Boolean(addingOfferId) ||
                          getOfferQuantity(offer) <= getOfferQuantityBounds(offer).minimum
                        }
                        onClick={() =>
                          handleQuantityStep(offer, getOfferQuantity(offer) - 1)
                        }
                        className="focus-ring grid h-10 w-10 place-items-center text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus size={15} aria-hidden="true" />
                      </button>

                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label="Quantity"
                        min={getOfferQuantityBounds(offer).minimum}
                        max={getOfferQuantityBounds(offer).maximum}
                        value={getOfferQuantity(offer)}
                        disabled={Boolean(addingOfferId)}
                        onChange={(event) =>
                          setOfferQuantity(offer, event.target.value)
                        }
                        onBlur={() =>
                          void syncExistingCartQuantity(
                            offer,
                            getOfferQuantity(offer),
                          )
                        }
                        className="h-10 w-12 border-x border-stone-200 bg-white text-center text-sm font-black text-stone-950 outline-none disabled:opacity-50"
                      />

                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={
                          Boolean(addingOfferId) ||
                          getOfferQuantity(offer) >= getOfferQuantityBounds(offer).maximum
                        }
                        onClick={() =>
                          handleQuantityStep(offer, getOfferQuantity(offer) + 1)
                        }
                        className="focus-ring grid h-10 w-10 place-items-center text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(addingOfferId)}
                  onClick={(event) =>
                    handleAddToCart(
                      offer,
                      event.currentTarget,
                    )
                  }
                  className="focus-ring mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 px-5 text-sm font-black text-white shadow-[0_10px_22px_rgba(4,120,87,0.22)] transition hover:from-emerald-900 hover:to-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart size={17} aria-hidden="true" />
                  {addingOfferId === offer.id
                    ? 'Adding...'
                    : `Add ${getOfferQuantity(offer)} to Cart`}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

    </section>
  )

}

function productDetailLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function ProductDetailsSheet({
  product,
}) {
  const nutrients =
    Array.isArray(
      product?.nutrition
        ?.nutrients,
    )
      ? product.nutrition.nutrients
      : []

  const allergens =
    Array.isArray(
      product?.allergens,
    )
      ? product.allergens
      : []

  const detailRows = [
    [
      'Brand',
      product?.brand?.name ||
        'Not declared',
    ],
    [
      'Category',
      product?.category?.name ||
        'Not declared',
    ],
    [
      'Net quantity',
      formatQuantity(
        product?.netQuantity,
      ),
    ],
    [
      'Pack',
      product?.pack?.name ||
        product?.pack?.type ||
        'Not declared',
    ],
    [
      'Barcode',
      <ProductBarcode
        key="product-barcode"
        value={
          product?.gtin ||
          product?.barcode
        }
        compact
      />,
    ],
    [
      'Country of origin',
      product?.countryOfOrigin ||
        'Not declared',
    ],
    [
      'Manufacturer / supplier',
      product?.manufacturerName ||
        'Not declared',
    ],
    [
      'Serving size',
      product?.nutrition
        ?.servingSize
        ? formatQuantity(
            product.nutrition.servingSize,
          )
        : 'Not declared',
    ],
  ]

  return (
    <div className="flex h-full w-full items-stretch justify-center bg-[#f4f7f2] p-4 sm:p-6 xl:p-8">
      <div className="flex h-full w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-[0_18px_42px_rgba(4,120,87,0.10)]">
        <div className="border-b border-emerald-800 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-5 py-5 text-white sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
            EPANTRY · Product details sheet
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
            {product?.displayName ||
              'Product'}
          </h2>
          <p className="mt-1 text-xs font-semibold text-emerald-100/80">
            Published listing details · generated from governed product data
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {detailRows.map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={label}
                  className="border-b border-stone-100 pb-2"
                >
                  <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-400">
                    {label}
                  </dt>
                  <dd className="mt-1 min-w-0 break-words text-xs font-black text-stone-900">
                    {value}
                  </dd>
                </div>
              ),
            )}
          </dl>

          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Ingredients
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
              {product?.ingredientDeclarationText ||
                (product?.ingredients
                  ?.length
                  ? product.ingredients
                      .map(
                        (
                          ingredient,
                        ) =>
                          ingredient?.displayName,
                      )
                      .filter(
                        Boolean,
                      )
                      .join(
                        ', ',
                      )
                  : 'Not declared')}
            </p>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Allergens
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
              {product?.allergenStatement ||
                (allergens.length
                  ? allergens
                      .map(
                        (
                          allergen,
                        ) =>
                          `${productDetailLabel(
                            allergen?.allergenKey,
                          )} (${productDetailLabel(
                            allergen?.relationType,
                          )})`,
                      )
                      .join(
                        ', ',
                      )
                  : 'Not declared')}
            </p>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Nutrition
              </p>
              <span className="text-[10px] font-black text-stone-500">
                {product?.nutrition
                  ?.basis
                  ? productDetailLabel(
                      product.nutrition.basis,
                    )
                  : 'Declared basis'}
              </span>
            </div>

            {nutrients.length ? (
              <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
                {nutrients.map(
                  (
                    nutrient,
                    index,
                  ) => (
                    <div
                      key={`${nutrient?.nutrientKey ||
                        'nutrient'}-${index}`}
                      className="flex items-center justify-between gap-2 border-b border-stone-100 py-1.5 text-[11px]"
                    >
                      <span className="font-bold text-stone-500">
                        {productDetailLabel(
                          nutrient?.nutrientKey,
                        )}
                      </span>
                      <span className="font-black text-stone-950">
                        {nutrient?.amount ??
                          '—'}{' '}
                        {nutrient?.unit ||
                          ''}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-stone-500">
                Nutrition not declared.
              </p>
            )}
          </div>

          {product?.claims
            ?.length ||
          product?.certifications
            ?.length ? (
            <div className="mt-4 border-t border-stone-200 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Claims & certifications
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ...(product?.claims ||
                    []),
                  ...(product?.certifications ||
                    []),
                ].map(
                  (
                    item,
                    index,
                  ) => (
                    <span
                      key={`${item?.key ||
                        item?.label ||
                        'detail'}-${index}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800"
                    >
                      {item?.label ||
                        productDetailLabel(
                          item?.key,
                        )}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}



const PRODUCT_RECOMMENDATION_LIMIT = 5

const PRODUCT_BROWSE_CATEGORY_RULES = [
  {
    slug: 'vegetables',
    pattern: /(tomato|okra|bhindi|bottle gourd|lauki|broccoli|bell pepper|capsicum|potato|onion|garlic|carrot|cabbage|cauliflower|spinach|cucumber|brinjal|eggplant|green beans|peas|vegetable)/i,
  },
  {
    slug: 'fruits',
    pattern: /(banana|mango|pomegranate|avocado|kiwi|apple|orange|grape|guava|papaya|pineapple|pear|peach|plum|berry|berries|watermelon|melon|fruit)/i,
  },
  {
    slug: 'beverages',
    pattern: /(energy drink|soft drink|beverage|juice|soda|sparkling water|tonic water)/i,
  },
  {
    slug: 'rice-grains',
    pattern: /(rice|basmati|jasmine rice|grain|quinoa|oats|wheat|cereal)/i,
  },
  {
    slug: 'spices-condiments',
    pattern: /(spice|masala|turmeric|chilli|pepper|sauce|condiment|paste)/i,
  },
  {
    slug: 'tea-coffee',
    pattern: /(tea|coffee|matcha)/i,
  },
  {
    slug: 'oils-fats',
    pattern: /(oil|ghee|butter|fat)/i,
  },
  {
    slug: 'sweeteners-syrups',
    pattern: /(honey|sugar|sweetener|syrup|jaggery)/i,
  },
]

function getProductRecommendationKey(product) {
  return String(
    product?.productVersionId ||
      product?.id ||
      product?.slug ||
      '',
  ).trim()
}

function inferProductRecommendationCategory(product) {
  const categorySlug = String(
    product?.category?.slug ||
      '',
  ).trim()

  const knownBrowseCategory =
    PRODUCT_BROWSE_CATEGORY_RULES.find(
      (rule) =>
        rule.slug === categorySlug,
    )

  if (knownBrowseCategory) {
    return categorySlug
  }

  const searchableText = [
    product?.displayName,
    product?.family?.name,
    product?.variant?.name,
    product?.category?.name,
  ]
    .filter(Boolean)
    .join(' ')

  const matchedRule =
    PRODUCT_BROWSE_CATEGORY_RULES.find(
      (rule) =>
        rule.pattern.test(searchableText),
    )

  return matchedRule?.slug || categorySlug
}

function RecommendationProductCard({
  product,
}) {
  const path =
    `/grocery/product/${encodeURIComponent(
      product?.slug || '',
    )}`

  const imageUrl =
    product?.image?.url ||
    ''

  const quantity =
    product?.netQuantity?.value !== undefined &&
    product?.netQuantity?.value !== null
      ? `${product.netQuantity.value} ${product.netQuantity.unit || ''}`.trim()
      : ''

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#dfe7dc] bg-white shadow-[0_10px_30px_rgba(23,60,45,0.06)] transition duration-300 hover:-translate-y-1.5 hover:border-[#9fbea8] hover:shadow-[0_22px_44px_rgba(23,60,45,0.14)] motion-reduce:transform-none motion-reduce:transition-none">
      <Link
        to={path}
        className="focus-ring relative block aspect-[1.08/1] overflow-hidden bg-[linear-gradient(145deg,#f7f7f1,#eef4eb)]"
        aria-label={`View ${product?.displayName || 'product'}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.image?.alt || product?.displayName || 'Product'}
            className="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-emerald-700/35">
            <Package
              size={42}
              strokeWidth={1.4}
              aria-hidden="true"
            />
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 shadow-sm backdrop-blur">
          {product?.category?.name || 'EPANTRY pick'}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product?.brand?.name ? (
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">
            {product.brand.name}
          </p>
        ) : null}

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.7em] text-[16px] font-black leading-[1.35] tracking-[-0.02em] text-[#173c2d]">
          {product?.displayName || 'Grocery product'}
        </h3>

        <div className="mt-2 min-h-5 text-[11px] font-semibold text-stone-500">
          {quantity || product?.pack?.name || 'Published product'}
        </div>

        <Link
          to={path}
          className="focus-ring mt-4 inline-flex items-center justify-between gap-3 rounded-xl bg-[#edf5e9] px-3.5 py-2.5 text-xs font-black text-[#1b5a3d] transition group-hover:bg-[#175339] group-hover:text-white"
        >
          View product
          <ArrowRight
            size={15}
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  )
}

function CountryListingCard({
  listing,
}) {
  const isRecipe =
    listing?.type === 'recipe'

  const item =
    listing?.item || {}

  const path =
    isRecipe
      ? getCountryRecipePath(item)
      : `/grocery/product/${encodeURIComponent(
          item?.slug || '',
        )}`

  const title =
    isRecipe
      ? getCountryRecipeName(item)
      : item?.displayName ||
        'Grocery product'

  const imageUrl =
    isRecipe
      ? getCountryRecipeImage(item)
      : item?.image?.url ||
        ''

  const meta =
    isRecipe
      ? recipeCountryCuisine(item) ||
        'Recipe'
      : item?.category?.name ||
        item?.brand?.name ||
        'Grocery'

  return (
    <Link
      to={path}
      className="focus-ring group flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(28,25,23,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_28px_rgba(4,120,87,0.10)] motion-reduce:transform-none"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f3f6f1]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package
            size={24}
            className="text-emerald-700/40"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-800">
            {isRecipe ? 'Recipe' : 'Grocery'}
          </span>
          <span className="truncate text-[9px] font-bold text-stone-400">
            {meta}
          </span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs font-black leading-4 text-stone-900">
          {title}
        </p>
      </div>

      <ArrowRight
        size={15}
        className="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700"
        aria-hidden="true"
      />
    </Link>
  )
}

function ProductRecommendationShelf({
  eyebrow,
  title,
  description,
  items,
  loading,
  viewAllTo,
}) {
  if (!loading && items.length === 0) {
    return null
  }

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-2xl font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-500">
            {description}
          </p>
        </div>

        <Link
          to={viewAllTo}
          className="focus-ring inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
        >
          View all
          <ArrowRight
            size={16}
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: PRODUCT_RECOMMENDATION_LIMIT }).map((_, index) => (
              <div
                key={index}
                className="aspect-[0.76/1] animate-pulse rounded-[24px] border border-stone-200 bg-white"
              />
            ))
          : items.map((item) => (
              <RecommendationProductCard
                key={getProductRecommendationKey(item)}
                product={item}
              />
            ))}
      </div>
    </section>
  )
}

export default function ProductDetailPage() {
  const {
    slug,
  } =
    useParams()

  const {
    product,
    loading,
    error,
  } =
    useProductDetail(
      slug,
    )

  const [
    zoomPreview,
    setZoomPreview,
  ] =
    useState(
      null,
    )

  const [
    showAllImages,
    setShowAllImages,
  ] =
    useState(
      false,
    )

  const [
    frequentlyBought,
    setFrequentlyBought,
  ] =
    useState(
      [],
    )

  const [
    similarProducts,
    setSimilarProducts,
  ] =
    useState(
      [],
    )

  const [
    recommendationsLoading,
    setRecommendationsLoading,
  ] =
    useState(
      false,
    )

  const [
    similarCategorySlug,
    setSimilarCategorySlug,
  ] =
    useState(
      '',
    )

  const [
    countryPanelOpen,
    setCountryPanelOpen,
  ] =
    useState(
      false,
    )

  const [
    countryListings,
    setCountryListings,
  ] =
    useState(
      [],
    )

  const [
    countryListingsLoading,
    setCountryListingsLoading,
  ] =
    useState(
      false,
    )

  useEffect(
    () => {
      setCountryPanelOpen(false)
      setCountryListings([])
    },
    [product?.slug],
  )

  useEffect(
    () => {
      if (!countryPanelOpen) {
        return undefined
      }

      const previousOverflow =
        document.body.style.overflow

      const handleKeyDown =
        (event) => {
          if (event.key === 'Escape') {
            setCountryPanelOpen(false)
          }
        }

      document.body.style.overflow =
        'hidden'

      window.addEventListener(
        'keydown',
        handleKeyDown,
      )

      return () => {
        document.body.style.overflow =
          previousOverflow

        window.removeEventListener(
          'keydown',
          handleKeyDown,
        )
      }
    },
    [countryPanelOpen],
  )

  useEffect(
    () => {
      const origin =
        String(
          product?.countryOfOrigin ||
            '',
        ).trim()

      if (
        !countryPanelOpen ||
        !origin
      ) {
        if (!origin) {
          setCountryListings([])
        }

        return undefined
      }

      let active = true

      async function loadCountryListings() {
        setCountryListingsLoading(true)

        const countryMeta =
          resolveCountryMeta(origin)

        try {
          const [productsSettled, recipesSettled] =
            await Promise.allSettled([
              getCatalogProducts({
                page: 1,
                limit: 100,
              }),
              listPublicRecipes({
                page: 1,
                limit: countryMeta.cuisine
                  ? 18
                  : 50,
                ...(countryMeta.cuisine
                  ? {
                      cuisine:
                        countryMeta.cuisine,
                    }
                  : {}),
              }),
            ])

          if (!active) {
            return
          }

          const currentProductKey =
            getProductRecommendationKey(product)

          const originKey =
            normalizeCountryKey(origin)

          const productItems =
            productsSettled.status === 'fulfilled'
              ? productsSettled.value?.products || []
              : []

          const matchingProducts =
            productItems
              .filter(
                (item) =>
                  getProductRecommendationKey(item) !==
                    currentProductKey &&
                  normalizeCountryKey(
                    item?.countryOfOrigin,
                  ) === originKey,
              )
              .slice(0, 4)
              .map((item) => ({
                type: 'product',
                item,
              }))

          const recipeItems =
            recipesSettled.status === 'fulfilled'
              ? recipesSettled.value?.recipes || []
              : []

          const cuisineKey =
            normalizeCountryKey(
              countryMeta.cuisine,
            )

          const matchingRecipes =
            recipeItems
              .filter((item) => {
                const recipeCuisine =
                  normalizeCountryKey(
                    recipeCountryCuisine(item),
                  )

                if (!recipeCuisine) {
                  return false
                }

                if (cuisineKey) {
                  return (
                    recipeCuisine === cuisineKey ||
                    recipeCuisine.includes(cuisineKey) ||
                    cuisineKey.includes(recipeCuisine)
                  )
                }

                return (
                  recipeCuisine === originKey ||
                  recipeCuisine.includes(originKey) ||
                  originKey.includes(recipeCuisine)
                )
              })
              .slice(0, 4)
              .map((item) => ({
                type: 'recipe',
                item,
              }))

          const combined = []
          const maxLength = Math.max(
            matchingProducts.length,
            matchingRecipes.length,
          )

          for (
            let index = 0;
            index < maxLength;
            index += 1
          ) {
            if (matchingProducts[index]) {
              combined.push(
                matchingProducts[index],
              )
            }

            if (matchingRecipes[index]) {
              combined.push(
                matchingRecipes[index],
              )
            }
          }

          setCountryListings(
            combined.slice(0, 6),
          )
        } catch {
          if (active) {
            setCountryListings([])
          }
        } finally {
          if (active) {
            setCountryListingsLoading(false)
          }
        }
      }

      loadCountryListings()

      return () => {
        active = false
      }
    },
    [
      countryPanelOpen,
      product?.slug,
      product?.countryOfOrigin,
    ],
  )

  useEffect(
    () => {
      if (!product?.slug) {
        setFrequentlyBought([])
        setSimilarProducts([])
        setSimilarCategorySlug('')
        return undefined
      }

      let active = true

      async function loadProductRecommendations() {
        setRecommendationsLoading(true)

        const recommendationCategory =
          inferProductRecommendationCategory(product)

        try {
          const [catalogSettled, categorySettled] =
            await Promise.allSettled([
              getCatalogProducts({
                page: 1,
                limit: 24,
              }),
              recommendationCategory
                ? getCatalogCategoryProducts({
                    categorySlug: recommendationCategory,
                    page: 1,
                    limit: 18,
                  })
                : Promise.resolve({
                    products: [],
                  }),
            ])

          if (!active) {
            return
          }

          const catalogResult =
            catalogSettled.status === 'fulfilled'
              ? catalogSettled.value
              : { products: [] }

          const categoryResult =
            categorySettled.status === 'fulfilled'
              ? categorySettled.value
              : { products: [] }

          const currentKey =
            getProductRecommendationKey(product)

          const uniqueProducts =
            (items) => {
              const seen = new Set()

              return (items || []).filter(
                (item) => {
                  const key =
                    getProductRecommendationKey(item)

                  if (
                    !key ||
                    key === currentKey ||
                    seen.has(key)
                  ) {
                    return false
                  }

                  seen.add(key)
                  return true
                },
              )
            }

          const catalogProducts =
            uniqueProducts(
              catalogResult?.products,
            )

          const categoryProducts =
            uniqueProducts(
              categoryResult?.products,
            )

          const inferredCategoryMatches =
            recommendationCategory
              ? catalogProducts.filter(
                  (item) =>
                    inferProductRecommendationCategory(item) ===
                    recommendationCategory,
                )
              : []

          // Similar products must stay visible even when the category endpoint
          // has fewer than five published items. Prefer the same category, then
          // fill the row from the live catalog without repeating the current item.
          const nextSimilar =
            uniqueProducts([
              ...categoryProducts,
              ...inferredCategoryMatches,
              ...catalogProducts,
            ]).slice(0, PRODUCT_RECOMMENDATION_LIMIT)

          // Frequently bought is a separate discovery shelf. It may overlap with
          // Similar products when the published catalog is small; hiding an entire
          // section is worse than repeating a useful product.
          const nextFrequent =
            catalogProducts.slice(0, PRODUCT_RECOMMENDATION_LIMIT)

          setFrequentlyBought(nextFrequent)
          setSimilarProducts(nextSimilar)
          setSimilarCategorySlug(recommendationCategory)
        } catch {
          if (active) {
            setFrequentlyBought([])
            setSimilarProducts([])
            setSimilarCategorySlug('')
          }
        } finally {
          if (active) {
            setRecommendationsLoading(false)
          }
        }
      }

      loadProductRecommendations()

      return () => {
        active = false
      }
    },
    [
      product?.slug,
      product?.displayName,
      product?.category?.name,
      product?.category?.slug,
      product?.family?.name,
      product?.variant?.name,
    ],
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f4ef]">

        <div className="page-shell py-10">

          <div className="h-[560px] animate-pulse rounded-[24px] border border-stone-200 bg-white" />

        </div>

      </main>
    )
  }

  if (
    error ||
    !product
  ) {
    return (
      <main className="min-h-screen bg-[#f5f4ef]">

        <div className="page-shell py-12">

          <EmptyState
            title="Product unavailable"
            description={
              error ||
              'This published product could not be found.'
            }
          />

        </div>

      </main>
    )
  }

  const productImages =
    (
      product.images
        ?.length
        ? product.images
        : product.image
          ?.url
          ? [
              product.image,
            ]
          : []
    ).filter(
      (image) =>
        Boolean(
          image?.url,
        ),
    )

  const productGalleryItems =
    productImages.length
      ? [
          {
            type:
              'image',

            image:
              productImages[0],
          },
          {
            type:
              'details',
          },
          ...productImages
            .slice(
              1,
            )
            .map(
              (
                image,
              ) => ({
                type:
                  'image',

                image,
              }),
            ),
        ]
      : [
          {
            type:
              'details',
          },
        ]

  const imageCount =
    productGalleryItems.length

  const visibleProductImages =
    productGalleryItems.slice(
      0,
      4,
    )

  const hasClaimsOrCertifications =
    product.claims
      ?.length >
      0 ||
    product.certifications
      ?.length >
      0

  const countryMeta =
    resolveCountryMeta(
      product.countryOfOrigin,
    )

  const countryCopy =
    countryDescription(
      product.countryOfOrigin,
    )

  return (
    <main className="min-h-screen bg-[#f5f4ef]">

      <div className="page-shell pb-10 pt-3 sm:pt-4">

        <Link
          to="/grocery"
          className="focus-ring inline-flex items-center gap-2 text-sm font-black text-emerald-800 transition hover:text-emerald-950"
        >
          <ArrowLeft
            size={16}
            aria-hidden="true"
          />

          Back to Grocery
        </Link>

        <section className="mt-3 rounded-[24px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.08)]">

          <div className="grid items-start xl:grid-cols-[minmax(0,1.04fr)_minmax(430px,0.96fr)]">

            <div className="overflow-hidden rounded-t-[24px] border-b border-stone-200 bg-[#fafafa] xl:rounded-l-[24px] xl:rounded-tr-none xl:border-b-0 xl:border-r">

              {imageCount >
              0 ? (
                <div className="bg-white">

                  {visibleProductImages.map(
                    (
                      item,
                      index,
                    ) => {
                      if (
                        item.type ===
                        'details'
                      ) {
                        return (
                          <div
                            key="product-details-sheet"
                            className="relative h-[480px] overflow-hidden bg-white sm:h-[580px] lg:h-[660px] xl:h-[720px]"
                          >
                            <ProductDetailsSheet
                              product={
                                product
                              }
                            />

                            {imageCount >
                              4 &&
                              index ===
                                3 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllImages(
                                    true,
                                  )
                                }
                                className="focus-ring absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-4 py-2.5 text-xs font-black text-stone-900 shadow-lg backdrop-blur-md transition hover:border-emerald-300 hover:text-emerald-800"
                              >
                                <Images
                                  size={16}
                                  aria-hidden="true"
                                />
                                View all images ({imageCount})
                              </button>
                            ) : null}
                          </div>
                        )
                      }

                      const image =
                        item.image

                      return (
                        <div
                          key={`${image.url}-${index}`}
                          className="relative flex h-[480px] items-center justify-center overflow-hidden bg-white sm:h-[580px] lg:h-[660px] xl:h-[720px]"
                          onMouseMove={(
                            event,
                          ) => {
                            const bounds =
                              event.currentTarget.getBoundingClientRect()

                            const x =
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  ((event.clientX - bounds.left) / bounds.width) * 100,
                                ),
                              )

                            const y =
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  ((event.clientY - bounds.top) / bounds.height) * 100,
                                ),
                              )

                            setZoomPreview({
                              url:
                                image.url,
                              alt:
                                image.alt ||
                                product.displayName,
                              x,
                              y,
                            })
                          }}
                          onMouseLeave={() =>
                            setZoomPreview(
                              null,
                            )
                          }
                        >

                          <img
                            src={
                              image.url
                            }
                            alt={
                              image.alt ||
                              product.displayName
                            }
                            className="h-full w-full object-contain p-5 sm:p-8 xl:p-10"
                          />

                          {zoomPreview?.url ===
                            image.url && (
                            <div
                              className="pointer-events-none absolute hidden h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-emerald-600 bg-emerald-100/15 shadow-[0_10px_30px_rgba(5,150,105,0.2)] backdrop-blur-[1px] xl:block"
                              style={{
                                left: `${zoomPreview.x}%`,
                                top: `${zoomPreview.y}%`,
                              }}
                              aria-hidden="true"
                            />
                          )}

                          {imageCount >
                            4 &&
                            index ===
                              3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllImages(
                                    true,
                                  )
                                }
                                className="focus-ring absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-4 py-2.5 text-xs font-black text-stone-900 shadow-lg backdrop-blur-md transition hover:border-emerald-300 hover:text-emerald-800"
                              >
                                <Images
                                  size={16}
                                  aria-hidden="true"
                                />
                                View all images ({imageCount})
                              </button>
                            )}

                        </div>
                      )
                    },
                  )}

                </div>
              ) : (
                <div className="grid h-[480px] place-items-center bg-white text-stone-300 sm:h-[580px] lg:h-[660px] xl:h-[720px]">

                  <Package
                    size={64}
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />

                </div>
              )}

            </div>

            <div className="relative bg-white p-6 sm:p-8 xl:sticky xl:top-24 xl:min-h-[720px] xl:rounded-r-[24px] xl:p-8">

              {zoomPreview && (
                <div
                  className="pointer-events-none absolute inset-x-4 top-4 z-40 hidden h-[520px] overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_26px_70px_rgba(28,25,23,0.24)] xl:block"
                  aria-label={`Zoomed preview of ${zoomPreview.alt}`}
                >
                  <div
                    className="h-full w-full bg-white bg-no-repeat"
                    style={{
                      backgroundImage: `url(${zoomPreview.url})`,
                      backgroundPosition: `${zoomPreview.x}% ${zoomPreview.y}%`,
                      backgroundSize:
                        '255%',
                    }}
                  />

                  <div className="absolute left-3 top-3 rounded-full bg-stone-950/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                    Zoom preview
                  </div>
                </div>
              )}

              <p className="text-sm font-black text-emerald-700">
                {
                  product.brand
                    ?.name
                }
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-stone-950 sm:text-4xl xl:text-[42px] xl:leading-[1.02]">
                {
                  product.displayName
                }
              </h1>

              <p className="mt-4 text-sm font-bold text-stone-600">
                Net quantity{' '}
                <span className="font-black text-stone-950">
                  {
                    formatQuantity(
                      product.netQuantity,
                    )
                  }
                </span>
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                  Country of origin
                </span>

                {product.countryOfOrigin ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCountryPanelOpen(true)
                    }
                    className="focus-ring group inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50"
                    aria-label={`Learn about ${product.countryOfOrigin}`}
                  >
                    <span
                      className="text-[28px] leading-none"
                      aria-hidden="true"
                    >
                      {countryMeta.flag}
                    </span>
                    <span className="text-xs font-black text-emerald-950">
                      {product.countryOfOrigin}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-emerald-700 transition group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <span className="text-xs font-bold text-stone-400">
                    Not declared
                  </span>
                )}
              </div>

              <details className="group mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">

                <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 bg-stone-50/80 px-4 py-4 text-sm font-black text-stone-950 transition hover:bg-stone-100">
                  <span>
                    Product details
                  </span>

                  <ChevronDown
                    size={18}
                    className="transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <dl className="divide-y divide-stone-200 border-t border-stone-200">

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Net quantity
                    </dt>
                    <dd className="text-sm font-black text-stone-950">
                      {
                        formatQuantity(
                          product.netQuantity,
                        )
                      }
                    </dd>
                  </div>

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Pack
                    </dt>
                    <dd className="overflow-x-auto whitespace-nowrap pb-0.5 text-sm font-black capitalize text-stone-950">
                      {
                        product.pack
                          ?.name ||
                        product.pack
                          ?.type ||
                        'Not declared'
                      }
                    </dd>
                  </div>

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Category
                    </dt>
                    <dd className="text-sm font-black text-stone-950">
                      {
                        product.category
                          ?.name ||
                        'Not declared'
                      }
                    </dd>
                  </div>

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Barcode
                    </dt>
                    <dd className="break-all text-sm font-black text-stone-950">
                      {
                        product.gtin ||
                        product.barcode ||
                        'Not declared'
                      }
                    </dd>
                  </div>

                </dl>

              </details>

              <div className="mt-5">
                <MarketplaceOffers
                  product={
                    product
                  }
                />
              </div>

            </div>

          </div>

        </section>

        {showAllImages && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/65 p-4 backdrop-blur-sm sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="All product images"
            onClick={() =>
              setShowAllImages(
                false,
              )
            }
          >
            <div
              className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-[#f7f7f5] shadow-2xl"
              onClick={(
                event,
              ) =>
                event.stopPropagation()
              }
            >

              <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Product gallery
                  </p>
                  <h2 className="mt-1 text-lg font-black text-stone-950">
                    All images ({imageCount})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAllImages(
                      false,
                    )
                  }
                  className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100"
                  aria-label="Close product gallery"
                >
                  <X
                    size={19}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="max-h-[calc(90vh-76px)] overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {productGalleryItems.map(
                    (
                      item,
                      index,
                    ) =>
                      item.type ===
                      'details' ? (
                        <div
                          key="all-product-details-sheet"
                          className="min-h-[430px] overflow-hidden rounded-2xl border border-emerald-200 bg-white"
                        >
                          <ProductDetailsSheet
                            product={
                              product
                            }
                          />
                        </div>
                      ) : (
                        <div
                          key={`all-${item.image.url}-${index}`}
                          className="flex min-h-[330px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white sm:min-h-[430px]"
                        >
                          <img
                            src={
                              item.image.url
                            }
                            alt={
                              item.image.alt ||
                              product.displayName
                            }
                            className="h-full max-h-[520px] w-full object-contain p-5"
                          />
                        </div>
                      ),
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {countryPanelOpen && product.countryOfOrigin ? (
          <div
            className="fixed inset-0 z-[140] bg-stone-950/10 backdrop-blur-[1px]"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCountryPanelOpen(false)
              }
            }}
          >
            <aside
              className="absolute right-4 top-[96px] flex max-h-[72vh] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-emerald-100 bg-[#fbfcf8] shadow-[0_24px_70px_rgba(28,25,23,0.22)] sm:right-6 sm:top-[104px]"
              role="dialog"
              aria-modal="true"
              aria-label={`About ${product.countryOfOrigin}`}
            >
              <div className="relative shrink-0 overflow-hidden border-b border-emerald-100 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_44%),linear-gradient(145deg,#0b3d2f,#145c43)] px-5 pb-4 pt-5 text-white">
                <button
                  type="button"
                  onClick={() =>
                    setCountryPanelOpen(false)
                  }
                  className="focus-ring absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white hover:text-emerald-950"
                  aria-label="Close country panel"
                >
                  <X
                    size={18}
                    aria-hidden="true"
                  />
                </button>

                <div className="flex items-center gap-3 pr-11">
                  <span
                    className="text-[42px] leading-none drop-shadow-sm"
                    aria-hidden="true"
                  >
                    {countryMeta.flag}
                  </span>

                  <div className="min-w-0 pb-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200">
                      Country of origin
                    </p>
                    <h2 className="mt-0.5 break-words text-2xl font-black tracking-[-0.035em]">
                      {product.countryOfOrigin}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
                <section>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    About the origin
                  </p>

                  <div className="mt-2.5 space-y-2 text-[13px] font-semibold leading-5 text-stone-600">
                    {countryCopy.map((paragraph) => (
                      <p key={paragraph}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>

                <section className="mt-5 border-t border-stone-200 pt-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      More from {product.countryOfOrigin}
                    </p>
                    <h3 className="mt-1 text-lg font-black tracking-[-0.025em] text-stone-950">
                      Grocery & recipes on EPANTRY
                    </h3>
                  </div>

                  {countryListingsLoading ? (
                    <div className="mt-3 grid gap-2.5">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-[74px] animate-pulse rounded-2xl border border-stone-200 bg-white"
                        />
                      ))}
                    </div>
                  ) : countryListings.length > 0 ? (
                    <div className="mt-3 grid gap-2.5">
                      {countryListings.map((listing, index) => (
                        <CountryListingCard
                          key={`${listing.type}-${
                            listing.type === 'recipe'
                              ? getCountryRecipePath(listing.item)
                              : getProductRecommendationKey(listing.item)
                          }-${index}`}
                          listing={listing}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-[13px] font-semibold leading-5 text-stone-500">
                      No other published grocery or recipe listing from this country is available yet.
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 xl:grid-cols-2 xl:items-stretch">

          <section className="h-full overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_12px_34px_rgba(28,25,23,0.06)]">

            <div className="border-b border-stone-200 bg-stone-50/70 px-5 py-5 sm:px-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                Product information
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">
                About this product
              </h2>
            </div>

            <div className="divide-y divide-stone-200">

              <DetailCard
                title="Ingredients"
                icon={Package}
                description="Reviewed ingredient declaration and recognized ingredients"
              >
                <div className="space-y-4">
                  {product.ingredientDeclarationText && (
                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-4 shadow-[0_8px_20px_rgba(4,120,87,0.06)]">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-white">
                          <Package
                            size={15}
                            aria-hidden="true"
                          />
                        </span>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            Reviewed ingredient declaration
                          </p>
                          <p className="mt-0.5 text-[10px] text-stone-500">
                            Published from the approved product record
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm font-semibold leading-6 text-stone-800">
                        {product.ingredientDeclarationText}
                      </p>
                    </div>
                  )}

                  {product.ingredients?.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                          Recognized ingredients
                        </p>
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                          {product.ingredients.length} mapped
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {product.ingredients.map((ingredient, index) => (
                          <span
                            key={`${ingredient.ingredientId || 'ingredient'}-${index}`}
                            className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm"
                          >
                            {ingredient.displayName || 'Canonical ingredient'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                      <p className="text-xs leading-5 text-stone-500">
                        {product.ingredientDeclarationText
                          ? 'Canonical ingredient mapping is still pending. The reviewed package declaration is shown above.'
                          : 'Ingredient information has not been published for this product.'}
                      </p>
                    </div>
                  )}
                </div>
              </DetailCard>

              <div id="product-dietary-intelligence-slot" />

              <DetailCard
                title="Product origin"
                icon={Globe2}
                description="Where this product comes from and who made or packed it"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-4 shadow-[0_8px_20px_rgba(4,120,87,0.05)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
                        <Globe2
                          size={18}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Country of origin
                        </p>
                        <p className="mt-1.5 break-words text-sm font-black leading-5 text-stone-900">
                          {product.countryOfOrigin || 'Not declared'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 via-white to-white p-4 shadow-[0_8px_20px_rgba(28,25,23,0.04)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-900 text-white shadow-sm">
                        <Factory
                          size={18}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-500">
                          Manufacturer / packer
                        </p>
                        <p className="mt-1.5 break-words text-sm font-black leading-5 text-stone-900">
                          {product.manufacturerName || 'Not declared'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DetailCard>

              {hasClaimsOrCertifications && (
                <DetailCard title="Published claims & certifications">
                  <div className="flex flex-wrap gap-2">
                    {product.claims?.map((claim, index) => (
                      <span
                        key={`${claim.key}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800"
                      >
                        <ShieldCheck size={13} aria-hidden="true" />
                        {claim.label || claim.key}
                      </span>
                    ))}

                    {product.certifications?.map((certification, index) => (
                      <span
                        key={`${certification.key}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-700"
                      >
                        <BadgeCheck
                          size={13}
                          className="text-emerald-700"
                          aria-hidden="true"
                        />
                        {certification.label || certification.key}
                      </span>
                    ))}
                  </div>
                </DetailCard>
              )}

              <DetailCard
                title="Allergens"
                icon={ShieldCheck}
                description="Reviewed allergen declaration and governed relationships"
              >
                <div className="space-y-4">
                  {product.allergenStatement ? (
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-4 shadow-[0_8px_20px_rgba(180,83,9,0.05)]">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                          <ShieldCheck
                            size={16}
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
                            Reviewed package declaration
                          </p>
                          <p className="mt-1.5 text-sm font-bold leading-5 text-stone-900">
                            {product.allergenStatement}
                          </p>
                          <p className="mt-2 text-[10px] leading-4 text-stone-500">
                            A missing positive allergen relationship is not treated as an allergen-free claim.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {product.allergens?.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                          Published allergen relationships
                        </p>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[9px] font-black text-stone-600">
                          {product.allergens.length} recorded
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {product.allergens.map((allergen, index) => (
                          <div
                            key={`${allergen.allergenKey}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-3"
                          >
                            <span className="text-xs font-black capitalize text-stone-800">
                              {allergen.allergenKey}
                            </span>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-500 shadow-sm">
                              {allergen.relationType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                      <p className="text-xs leading-5 text-stone-500">
                        {product.allergenStatement
                          ? 'No positive governed allergen relationship is published beyond the reviewed package declaration above.'
                          : 'Allergen data is currently unknown or not published. EPANTRY does not infer missing safety facts.'}
                      </p>
                    </div>
                  )}

                  <div id="product-allergen-intelligence-slot" />
                </div>
              </DetailCard>

              <div id="product-lineage-intelligence-slot" />

              <div id="product-food-intelligence-slot" />


            </div>

          </section>

          <section className="h-full overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-[0_14px_38px_rgba(4,120,87,0.09)] ring-1 ring-emerald-100">

            <div className="border-b border-emerald-800 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-5 py-5 text-white sm:px-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Governed nutrition
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Nutrition
              </h2>
              <p className="mt-1 text-xs leading-5 text-emerald-50/80">
                Published values from the current approved product record.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              {product.nutrition?.nutrients?.length > 0 ? (
                <div className="divide-y divide-stone-200">
                  {product.nutrition.nutrients.map((nutrient, index) => (
                    <div
                      key={`${nutrient.nutrientKey}-${index}`}
                      className="flex items-center justify-between gap-4 py-3.5 text-sm"
                    >
                      <span className="font-bold capitalize text-stone-600">
                        {nutrient.nutrientKey}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-black text-emerald-950">
                        {nutrient.amount} {nutrient.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  Nutrition facts are not currently published.
                </p>
              )}

              <div id="product-nutrition-intelligence-slot" className="mt-5" />
            </div>

          </section>

        </section>

        <div className="mt-12 space-y-12 border-t border-stone-200/80 pt-10 sm:mt-14 sm:pt-12">
          <ProductRecommendationShelf
            eyebrow="More for your basket"
            title="Frequently bought"
            description="Useful picks from the live EPANTRY grocery catalog that work well alongside everyday shopping."
            items={frequentlyBought}
            loading={recommendationsLoading}
            viewAllTo="/grocery"
          />

          <ProductRecommendationShelf
            eyebrow="Same shelf"
            title="Similar products"
            description={
              similarCategorySlug
                ? `More choices from the same ${similarCategorySlug.replace(/-/g, ' ')} collection.`
                : 'More published products from the same grocery category.'
            }
            items={similarProducts}
            loading={recommendationsLoading}
            viewAllTo={
              similarCategorySlug
                ? `/grocery/category/${encodeURIComponent(similarCategorySlug)}`
                : '/grocery'
            }
          />
        </div>

      </div>

    </main>
  )
}
