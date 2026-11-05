import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  IdCard,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Save,
  Store,
  UserRound,
  Warehouse,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getAccountProfile,
  updateAccountProfile,
  uploadAccountProfilePhoto,
} from '../services/account.service'

import { getCatalogProducts } from '../../grocery/services/catalog.service'
import { listPublicRecipes } from '../../recipes/services/recipe.service'
import { listHostListingPackets } from '../../host/services/hostUnifiedListing.service'
import { getHospitalityContext } from '../../hospitality/services/hospitality.service'

import {
  createDeliveryAddress,
  getDeliveryAddressErrorMessage,
  listDeliveryAddresses,
  updateDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

import {
  getHostOperationalOrganization,
  getHostOperationsErrorMessage,
  updateHostOperationalProfile,
} from '../../hostOperations/services/hostOperations.service'

import {
  createInventoryNode,
  createServiceArea,
  listInventoryNodes,
  listServiceAreas,
  updateInventoryNode,
  updateServiceArea,
} from '../../marketplace/services/marketplace.service'

const inputClassName =
  'focus-ring w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-950 outline-none transition focus:border-emerald-500'

const ADDRESS_LABELS = [
  'home',
  'office',
  'family',
  'friend',
  'other',
]

const hostInputClassName =
  'focus-ring w-full min-w-0 rounded-[12px] border border-stone-200 bg-white px-3 py-2.5 text-[14px] font-medium text-stone-950 outline-none transition focus:border-emerald-500 sm:rounded-[14px] sm:px-4 sm:py-3'

function getInitialHostBusinessForm(
  organization,
  operationalProfile,
) {
  const address =
    operationalProfile?.registeredAddress ||
    {}

  return {
    legalEntityName:
      operationalProfile?.legalEntityName ||
      organization?.displayName ||
      '',
    businessType:
      operationalProfile?.businessType ||
      'other',
    line1:
      address.line1 ||
      '',
    line2:
      address.line2 ||
      '',
    city:
      address.city ||
      '',
    state:
      address.state ||
      '',
    postalCode:
      address.postalCode ||
      '',
    countryCode:
      address.countryCode ||
      'IN',
    supportEmail:
      operationalProfile?.supportEmail ||
      '',
    supportPhone:
      operationalProfile?.supportPhone ||
      '',
  }
}

function getInitialInventoryNodeForm(
  node = null,
) {
  return {
    id:
      node?.id ||
      '',
    name:
      node?.name ||
      '',
    nodeType:
      node?.nodeType ||
      'warehouse',
    line1:
      node?.address?.line1 ||
      '',
    line2:
      node?.address?.line2 ||
      '',
    city:
      node?.address?.city ||
      '',
    state:
      node?.address?.state ||
      '',
    postalCode:
      node?.address?.postalCode ||
      '',
    countryCode:
      node?.address?.countryCode ||
      'IN',
  }
}

function getInitialServiceAreaForm(
  area = null,
) {
  return {
    id:
      area?.id ||
      '',
    name:
      area?.name ||
      '',
    inventoryNodeId:
      area?.inventoryNodeId ||
      '',
    postalCodes:
      Array.isArray(
        area?.postalCodes,
      )
        ? area.postalCodes.join(', ')
        : '',
    fulfillmentTypes:
      area?.fulfillmentTypes?.length
        ? area.fulfillmentTypes
        : [
            'delivery',
          ],
  }
}

function formatNodeType(
  value,
) {
  return String(
    value ||
      'location',
  )
    .replaceAll(
      '_',
      ' ',
    )
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function formatBusinessAddress(
  form,
) {
  return [
    form?.line1,
    form?.line2,
    form?.city,
    form?.state,
    form?.postalCode,
  ]
    .map((value) =>
      String(
        value ||
          '',
      ).trim(),
    )
    .filter(Boolean)
    .join(', ')
}

function normalizeLocationLabel(value) {
  return String(value || '').trim().toLowerCase()
}

// This is a display choice only; it never changes inventory or service-area records.
function chooseFeaturedStockNode(nodes, business) {
  if (!Array.isArray(nodes) || !nodes.length) return null
  const city = normalizeLocationLabel(business?.city)
  const postalCode = String(business?.postalCode || '').trim()
  return nodes
    .map((node, index) => {
      const label = normalizeLocationLabel(node?.name)
      const nodeCity = normalizeLocationLabel(node?.address?.city)
      const nodePostal = String(node?.address?.postalCode || '').trim()
      const score =
        (node?.status === 'active' ? 10 : 0) +
        (city && (label.includes(city) || nodeCity === city) ? 60 : 0) +
        (postalCode && nodePostal === postalCode ? 40 : 0) +
        (node?.nodeType === 'warehouse' ? 4 : 0)
      return { node, index, score }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].node
}

function chooseFeaturedServiceArea(areas, business) {
  if (!Array.isArray(areas) || !areas.length) return null
  const city = normalizeLocationLabel(business?.city)
  const postalCode = String(business?.postalCode || '').trim()
  return areas
    .map((area, index) => {
      const label = normalizeLocationLabel(area?.name)
      const codes = Array.isArray(area?.postalCodes) ? area.postalCodes.map(String) : []
      const score =
        (area?.status === 'active' ? 10 : 0) +
        (city && label.includes(city) ? 70 : 0) +
        (postalCode && label.includes(postalCode) ? 90 : 0) +
        (postalCode && codes.includes(postalCode) ? 35 : 0)
      return { area, index, score }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].area
}

// Inventory nodes and delivery areas have no image fields in their APIs.
// Only display a real image when its saved item title matches a listing/catalog item.
function locationItemKey(value) {
  return String(value || '')
    .replace(/^Delivery\s*[-–—:]\s*/i, '')
    .replace(/^Host stock\s*[-–—:]\s*/i, '')
    .replace(/^EPANTRY Test Kitchen\s*[-–—:]\s*[^–—-]+\s*[-–—:]\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function savedItemImage(value) {
  const image = typeof value === 'string'
    ? value
    : value?.url || value?.secureUrl || value?.src || ''
  return typeof image === 'string' && /^(https?:\/\/|\/)/i.test(image)
    ? image
    : ''
}

function locationPhotoMap(listings, products, recipes) {
  const imageByName = Object.create(null)
  const addImage = (title, image) => {
    const key = locationItemKey(title)
    const url = savedItemImage(image)
    if (key && url && !imageByName[key]) imageByName[key] = url
  }

  // Host-created listings have their actual uploaded item images.
  for (const listing of listings || []) {
    const packet = listing?.packet || {}
    addImage(
      listing?.title || packet?.title || packet?.name,
      packet?.images?.[0] || listing?.publishedPacket?.images?.[0],
    )
  }

  // Public catalog photos cover packaged goods without a Host listing packet.
  for (const product of products || []) {
    addImage(
      product?.displayName || product?.name || product?.pack?.name,
      product?.image || product?.images?.[0],
    )
  }
  // Published recipe photos provide authentic thumbnails for matching dishes.
  for (const item of recipes || []) {
    addImage(
      item?.dish?.name || item?.recipe?.title,
      item?.dish?.heroImageUrl || item?.recipe?.heroImageUrl,
    )
  }
  return imageByName
}

function LocationItemThumbnail({ photo, kind = 'stock' }) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [photo])
  const isDelivery = kind === 'delivery'
  const frameClass = isDelivery
    ? 'border-[#DED4EC] bg-[#F2EDF8] text-[#685985]'
    : 'border-[#CEE0D2] bg-[#E7F0E8] text-[#426D58]'
  return (
    <span className={`grid size-12 shrink-0 place-items-center overflow-hidden rounded-[11px] border ${frameClass}`} aria-hidden="true">
      {photo && !imageFailed ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : isDelivery ? (
        <MapPin size={21} strokeWidth={1.8} />
      ) : (
        <Warehouse size={21} strokeWidth={1.8} />
      )}
    </span>
  )
}

function getInitialAddressForm(
  profile,
  address = null,
) {
  return {
    id:
      address?.id ||
      '',
    recipientType:
      address?.recipientType ||
      'self',
    recipientName:
      address?.recipientName ||
      profile?.name ||
      '',
    phone:
      address?.phone ||
      profile?.phone ||
      '',
    label:
      address?.label ||
      'home',
    customLabel:
      address?.customLabel ||
      '',
    addressLine1:
      address?.addressLine1 ||
      '',
    addressLine2:
      address?.addressLine2 ||
      '',
    area:
      address?.area ||
      '',
    landmark:
      address?.landmark ||
      '',
    city:
      address?.city ||
      '',
    state:
      address?.state ||
      '',
    postalCode:
      address?.postalCode ||
      '',
    country:
      address?.country ||
      'India',
    deliveryInstructions:
      address?.deliveryInstructions ||
      '',
    source:
      address?.source ||
      'manual',
    isDefault:
      address?.isDefault ===
      true,
  }
}

function Field({
  label,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-stone-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function formatAddressTitle(
  address,
) {
  if (
    address?.label ===
      'other'
  ) {
    return (
      address.customLabel ||
      'Other'
    )
  }

  const value =
    String(
      address?.label ||
        'Address',
    )

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  )
}

export default function EditProfilePage({
  audience =
    'customer',
}) {
  const isCustomer =
    audience ===
    'customer'

  const {
    currentUser,
    refreshSession,
  } = useAuth()

  const [
    profile,
    setProfile,
  ] = useState(null)

  const [
    name,
    setName,
  ] = useState('')

  const [
    phone,
    setPhone,
  ] = useState('')

  const [
    addresses,
    setAddresses,
  ] = useState([])

  const [
    addressForm,
    setAddressForm,
  ] = useState(null)


  const [
    hostOrganization,
    setHostOrganization,
  ] = useState(null)

  const [
    hostOperationalProfile,
    setHostOperationalProfile,
  ] = useState(null)

  const [
    hostBusinessForm,
    setHostBusinessForm,
  ] = useState(() =>
    getInitialHostBusinessForm(
      null,
      null,
    ),
  )

  const [
    editingBusiness,
    setEditingBusiness,
  ] = useState(false)

  const [
    inventoryNodes,
    setInventoryNodes,
  ] = useState([])

  const [
    inventoryNodeForm,
    setInventoryNodeForm,
  ] = useState(null)

  const [
    serviceAreas,
    setServiceAreas,
  ] = useState([])

  const [
    serviceAreaForm,
    setServiceAreaForm,
  ] = useState(null)

  const [
    savingBusiness,
    setSavingBusiness,
  ] = useState(false)

  const [
    savingLocation,
    setSavingLocation,
  ] = useState(false)

  const [
    savingServiceArea,
    setSavingServiceArea,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    savingProfile,
    setSavingProfile,
  ] = useState(false)

  const [
    uploadingPhoto,
    setUploadingPhoto,
  ] = useState(false)

  const [
    savingAddress,
    setSavingAddress,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    success,
    setSuccess,
  ] = useState('')

  const [
    hostIdCopyStatus,
    setHostIdCopyStatus,
  ] = useState('')

  const [businessWorkspace, setBusinessWorkspace] = useState(null)
  const [businessWorkspaceLoadState, setBusinessWorkspaceLoadState] = useState('loading')
  const [businessWorkspaceCopyStatus, setBusinessWorkspaceCopyStatus] = useState('')

  const [locationItemPhotos, setLocationItemPhotos] = useState({})

  useEffect(() => {
    if (isCustomer) return undefined
    let active = true

    Promise.allSettled([
      listHostListingPackets(),
      getCatalogProducts({ page: 1, limit: 100 }),
      listPublicRecipes({ page: 1, limit: 100, sourceScope: 'standard' }),
    ]).then(([listingResult, catalogResult, recipeResult]) => {
      if (!active) return
      const listings = listingResult.status === 'fulfilled'
        ? listingResult.value?.listings || []
        : []
      const products = catalogResult.status === 'fulfilled'
        ? catalogResult.value?.products || []
        : []
      const recipes = recipeResult.status === 'fulfilled'
        ? recipeResult.value?.recipes || []
        : []
      setLocationItemPhotos(locationPhotoMap(listings, products, recipes))
    })

    return () => { active = false }
  }, [isCustomer, currentUser?.id])

  // Hospitality resolves the selected, authorized business (including workspace switching).
  // Load independently so a Hospitality access error never blocks the Host profile.
  useEffect(() => {
    if (isCustomer) return undefined
    let active = true
    setBusinessWorkspace(null)
    setBusinessWorkspaceLoadState('loading')
    setBusinessWorkspaceCopyStatus('')

    getHospitalityContext()
      .then((result) => {
        if (!active) return
        const organization = result?.context?.organization || null
        setBusinessWorkspace(organization?.id ? organization : null)
        setBusinessWorkspaceLoadState(organization?.id ? 'ready' : 'unavailable')
      })
      .catch(() => {
        if (!active) return
        setBusinessWorkspace(null)
        setBusinessWorkspaceLoadState('unavailable')
      })

    return () => { active = false }
  }, [isCustomer, currentUser?.id])

  const identityInitial =
    useMemo(
      () =>
        String(
          profile?.name ||
            currentUser?.name ||
            'E',
        )
          .trim()
          .charAt(0)
          .toUpperCase() ||
        'E',
      [
        currentUser?.name,
        profile?.name,
      ],
    )

  async function loadHostWorkspaceData() {
    const [
      organizationResult,
      nodesResult,
      areasResult,
    ] = await Promise.all([
      getHostOperationalOrganization(),
      listInventoryNodes({
        status: 'all',
        limit: 100,
      }),
      listServiceAreas({
        status: 'all',
        limit: 100,
      }),
    ])

    const organization =
      organizationResult?.organization ||
      null
    const operationalProfile =
      organizationResult?.operationalProfile ||
      null

    setHostOrganization(
      organization,
    )
    setHostOperationalProfile(
      operationalProfile,
    )
    setHostBusinessForm(
      getInitialHostBusinessForm(
        organization,
        operationalProfile,
      ),
    )
    setInventoryNodes(
      Array.isArray(
        nodesResult?.inventoryNodes,
      )
        ? nodesResult.inventoryNodes
        : [],
    )
    setServiceAreas(
      Array.isArray(
        areasResult?.serviceAreas,
      )
        ? areasResult.serviceAreas
        : [],
    )
  }

  async function loadAddresses() {
    if (!isCustomer) {
      return
    }

    const result =
      await listDeliveryAddresses()

    setAddresses(
      Array.isArray(
        result?.addresses,
      )
        ? result.addresses
        : [],
    )
  }

  useEffect(
    () => {
      let active =
        true

      async function load() {
        setLoading(
          true,
        )
        setError(
          '',
        )

        try {
          const loadedProfile =
            await getAccountProfile()

          if (!active) {
            return
          }

          setProfile(
            loadedProfile,
          )
          setName(
            loadedProfile?.name ||
              '',
          )
          setPhone(
            loadedProfile?.phone ||
              '',
          )

          if (isCustomer) {
            const addressResult =
              await listDeliveryAddresses()

            if (!active) {
              return
            }

            setAddresses(
              Array.isArray(
                addressResult?.addresses,
              )
                ? addressResult.addresses
                : [],
            )
          }
          else {
            const [
              organizationResult,
              nodesResult,
              areasResult,
            ] = await Promise.all([
              getHostOperationalOrganization(),
              listInventoryNodes({
                status: 'all',
                limit: 100,
              }),
              listServiceAreas({
                status: 'all',
                limit: 100,
              }),
            ])

            if (!active) {
              return
            }

            const organization =
              organizationResult?.organization ||
              null
            const operationalProfile =
              organizationResult?.operationalProfile ||
              null

            setHostOrganization(
              organization,
            )
            setHostOperationalProfile(
              operationalProfile,
            )
            setHostBusinessForm(
              getInitialHostBusinessForm(
                organization,
                operationalProfile,
              ),
            )
            setInventoryNodes(
              Array.isArray(
                nodesResult?.inventoryNodes,
              )
                ? nodesResult.inventoryNodes
                : [],
            )
            setServiceAreas(
              Array.isArray(
                areasResult?.serviceAreas,
              )
                ? areasResult.serviceAreas
                : [],
            )
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError?.response
                ?.data?.message ||
                loadError?.message ||
                'Unable to load your profile.',
            )
          }
        } finally {
          if (active) {
            setLoading(
              false,
            )
          }
        }
      }

      load()

      return () => {
        active =
          false
      }
    },
    [
      isCustomer,
    ],
  )

  async function handleProfileSubmit(
    event,
  ) {
    event.preventDefault()

    setSavingProfile(
      true,
    )
    setError(
      '',
    )
    setSuccess(
      '',
    )

    try {
      const payload = {
        name,
      }

      if (isCustomer) {
        payload.phone =
          phone ||
          null
      }

      const updated =
        await updateAccountProfile(
          payload,
        )

      setProfile(
        updated,
      )
      setName(
        updated?.name ||
          '',
      )
      setPhone(
        updated?.phone ||
          '',
      )

      await refreshSession()

      setSuccess(
        'Profile updated successfully.',
      )
    } catch (saveError) {
      setError(
        saveError?.response
          ?.data?.message ||
          saveError?.message ||
          'Unable to update your profile.',
      )
    } finally {
      setSavingProfile(
        false,
      )
    }
  }

  async function handlePhotoChange(
    event,
  ) {
    const file =
      event.target.files?.[0]

    event.target.value =
      ''

    if (!file) {
      return
    }

    setUploadingPhoto(
      true,
    )
    setError(
      '',
    )
    setSuccess(
      '',
    )

    try {
      const uploaded =
        await uploadAccountProfilePhoto(
          file,
        )

      const updated =
        await updateAccountProfile({
          profilePhotoUrl:
            uploaded.profilePhotoUrl,
        })

      setProfile(
        updated,
      )

      await refreshSession()

      setSuccess(
        'Profile photo updated successfully.',
      )
    } catch (uploadError) {
      setError(
        uploadError?.response
          ?.data?.message ||
          uploadError?.message ||
          'Unable to update your profile photo.',
      )
    } finally {
      setUploadingPhoto(
        false,
      )
    }
  }

  function beginAddAddress() {
    setError(
      '',
    )
    setSuccess(
      '',
    )
    setAddressForm(
      getInitialAddressForm(
        profile,
      ),
    )
  }

  function beginEditAddress(
    address,
  ) {
    setError(
      '',
    )
    setSuccess(
      '',
    )
    setAddressForm(
      getInitialAddressForm(
        profile,
        address,
      ),
    )
  }

  function updateAddressField(
    field,
    value,
  ) {
    setAddressForm(
      (current) => ({
        ...current,
        [field]:
          value,
      }),
    )
  }

  async function handleAddressSubmit(
    event,
  ) {
    event.preventDefault()

    if (!addressForm) {
      return
    }

    setSavingAddress(
      true,
    )
    setError(
      '',
    )
    setSuccess(
      '',
    )

    const payload = {
      recipientType:
        addressForm.recipientType,
      recipientName:
        addressForm.recipientName,
      phone:
        addressForm.phone,
      label:
        addressForm.label,
      customLabel:
        addressForm.customLabel,
      addressLine1:
        addressForm.addressLine1,
      addressLine2:
        addressForm.addressLine2,
      area:
        addressForm.area,
      landmark:
        addressForm.landmark,
      city:
        addressForm.city,
      state:
        addressForm.state,
      postalCode:
        addressForm.postalCode,
      country:
        addressForm.country,
      deliveryInstructions:
        addressForm.deliveryInstructions,
      source:
        addressForm.source,
      isDefault:
        addressForm.id
          ? addressForm.isDefault
          : addresses.length ===
            0,
    }

    try {
      if (addressForm.id) {
        await updateDeliveryAddress(
          addressForm.id,
          payload,
        )
      } else {
        await createDeliveryAddress(
          payload,
        )
      }

      await loadAddresses()

      setAddressForm(
        null,
      )
      setSuccess(
        addressForm.id
          ? 'Address updated successfully.'
          : 'Address added successfully.',
      )
    } catch (saveError) {
      setError(
        getDeliveryAddressErrorMessage(
          saveError,
          'Unable to save this address.',
        ),
      )
    } finally {
      setSavingAddress(
        false,
      )
    }
  }

  function hostErrorMessage(
    requestError,
    fallback,
  ) {
    return getHostOperationsErrorMessage(
      requestError,
      fallback,
    )
  }

  async function handleHostBusinessSubmit(
    event,
  ) {
    event.preventDefault()
    setSavingBusiness(true)
    setError('')
    setSuccess('')

    try {
      const currentCommercial =
        hostOperationalProfile?.commercial ||
        {}

      const result =
        await updateHostOperationalProfile({
          legalEntityName:
            hostBusinessForm.legalEntityName.trim(),
          businessType:
            hostBusinessForm.businessType,
          jurisdictionCountryCode:
            hostBusinessForm.countryCode ||
            'IN',
          registeredAddress: {
            line1:
              hostBusinessForm.line1.trim(),
            line2:
              hostBusinessForm.line2.trim(),
            city:
              hostBusinessForm.city.trim(),
            state:
              hostBusinessForm.state.trim(),
            postalCode:
              hostBusinessForm.postalCode.trim(),
            countryCode:
              hostBusinessForm.countryCode ||
              'IN',
          },
          supportEmail:
            hostBusinessForm.supportEmail.trim(),
          supportPhone:
            hostBusinessForm.supportPhone.trim(),
          commercial: {
            settlementCurrency:
              currentCommercial.settlementCurrency ||
              'INR',
            fulfillmentTypes:
              Array.isArray(
                currentCommercial.fulfillmentTypes,
              )
                ? currentCommercial.fulfillmentTypes
                : [],
            cancellationPolicySummary:
              currentCommercial.cancellationPolicySummary ||
              '',
            returnPolicySummary:
              currentCommercial.returnPolicySummary ||
              '',
          },
        })

      setHostOperationalProfile(
        result?.operationalProfile ||
          hostOperationalProfile,
      )
      setEditingBusiness(false)
      setSuccess(
        'Business location updated.',
      )
      await loadHostWorkspaceData()
    } catch (saveError) {
      setError(
        hostErrorMessage(
          saveError,
          'Unable to update the business location.',
        ),
      )
    } finally {
      setSavingBusiness(false)
    }
  }

  async function handleInventoryNodeSubmit(
    event,
  ) {
    event.preventDefault()

    if (!inventoryNodeForm) {
      return
    }

    setSavingLocation(true)
    setError('')
    setSuccess('')

    const payload = {
      name:
        inventoryNodeForm.name.trim(),
      nodeType:
        inventoryNodeForm.nodeType,
      address: {
        line1:
          inventoryNodeForm.line1.trim(),
        line2:
          inventoryNodeForm.line2.trim(),
        city:
          inventoryNodeForm.city.trim(),
        state:
          inventoryNodeForm.state.trim(),
        postalCode:
          inventoryNodeForm.postalCode.trim(),
        countryCode:
          inventoryNodeForm.countryCode ||
          'IN',
      },
    }

    try {
      if (inventoryNodeForm.id) {
        await updateInventoryNode(
          inventoryNodeForm.id,
          payload,
        )
      } else {
        await createInventoryNode(
          payload,
        )
      }

      setInventoryNodeForm(null)
      setSuccess(
        inventoryNodeForm.id
          ? 'Stock location updated.'
          : 'Stock location added.',
      )
      await loadHostWorkspaceData()
    } catch (saveError) {
      setError(
        hostErrorMessage(
          saveError,
          'Unable to save this stock location.',
        ),
      )
    } finally {
      setSavingLocation(false)
    }
  }

  async function handleServiceAreaSubmit(
    event,
  ) {
    event.preventDefault()

    if (!serviceAreaForm) {
      return
    }

    const postalCodes =
      serviceAreaForm.postalCodes
        .split(/[\s,]+/)
        .map((value) =>
          value.trim(),
        )
        .filter(Boolean)

    setSavingServiceArea(true)
    setError('')
    setSuccess('')

    const payload = {
      name:
        serviceAreaForm.name.trim(),
      inventoryNodeId:
        serviceAreaForm.inventoryNodeId ||
        null,
      postalCodes,
      fulfillmentTypes:
        serviceAreaForm.fulfillmentTypes?.length
          ? serviceAreaForm.fulfillmentTypes
          : [
              'delivery',
            ],
    }

    try {
      if (serviceAreaForm.id) {
        await updateServiceArea(
          serviceAreaForm.id,
          payload,
        )
      } else {
        await createServiceArea(
          payload,
        )
      }

      setServiceAreaForm(null)
      setSuccess(
        serviceAreaForm.id
          ? 'Delivery area updated.'
          : 'Delivery area added.',
      )
      await loadHostWorkspaceData()
    } catch (saveError) {
      setError(
        hostErrorMessage(
          saveError,
          'Unable to save this delivery area.',
        ),
      )
    } finally {
      setSavingServiceArea(false)
    }
  }

  const hostAccountId =
    String(
      profile?.id ||
        currentUser?.id ||
        '',
    ).trim()

  const businessWorkspaceId = String(businessWorkspace?.id || '').trim()

  async function handleCopyBusinessWorkspaceId() {
    if (!businessWorkspaceId) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(businessWorkspaceId)
      setBusinessWorkspaceCopyStatus('copied')
    } catch {
      setBusinessWorkspaceCopyStatus('unavailable')
    }
  }

  async function handleCopyHostAccountId() {
    if (!hostAccountId) {
      return
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }

      await navigator.clipboard.writeText(hostAccountId)
      setHostIdCopyStatus('copied')
    } catch {
      setHostIdCopyStatus('unavailable')
    }
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="rounded-[24px] border border-stone-200 bg-white p-6 text-sm font-bold text-stone-500 shadow-sm">
          Loading your profile…
        </div>
      </div>
    )
  }

  if (!isCustomer) {
    const businessAddress =
      formatBusinessAddress(
        hostBusinessForm,
      )
    const featuredStock = chooseFeaturedStockNode(inventoryNodes, hostBusinessForm)
    const otherStock = inventoryNodes.filter((node) => node.id !== featuredStock?.id)
    const featuredArea = chooseFeaturedServiceArea(serviceAreas, hostBusinessForm)
    const otherAreas = serviceAreas.filter((area) => area.id !== featuredArea?.id)
    const featuredCodes = Array.isArray(featuredArea?.postalCodes) ? featuredArea.postalCodes.map(String) : []
    const namedPostal = String(featuredArea?.name || '').match(/\b\d{6}\b/)?.[0] || ''
    const featuredPostal = namedPostal && featuredCodes.includes(namedPostal) ? namedPostal : featuredCodes[0] || ''

    return (
      <div className="px-2.5 pb-3 pt-0 sm:px-5 sm:pb-6 lg:px-6 lg:pb-7">
        <header className="overflow-hidden rounded-[22px] border border-[#173F35] bg-[#173F35] text-white sm:rounded-[26px]">
          <div className="px-4 py-4 sm:px-8 sm:py-8">
            <div className="hidden items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-[#BCD6C8] sm:flex">
              <UserRound size={16} aria-hidden="true" /> HOST / PROFILE
            </div>
            <h1 className="text-[24px] font-semibold leading-[1.2] tracking-[-0.025em] sm:mt-3 sm:text-[38px] sm:leading-[1.15] sm:tracking-[-0.03em]">Profile & locations</h1>
            <p className="mt-2 hidden max-w-xl text-[14px] leading-6 text-[#E0ECE5] sm:block sm:text-[15px]">
              Manage your public account, business address and delivery coverage.
            </p>
            <div className="mt-5 hidden flex-wrap gap-x-5 gap-y-2 border-t border-white/20 pt-4 text-[13px] text-[#F0F5F0] sm:flex">
              <span>01&nbsp; Account</span><span>02&nbsp; Business</span><span>03&nbsp; Stock & delivery</span>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-bold text-red-700 sm:mt-4 sm:px-4 sm:py-3 sm:text-sm">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-bold text-emerald-800 sm:mt-4 sm:px-4 sm:py-3 sm:text-sm">
            <CheckCircle2 size={16} aria-hidden="true" />
            {success}
          </div>
        ) : null}

        <section className="mt-3 overflow-hidden rounded-[18px] border border-[#C9DDEB] bg-[#F1F7FB] sm:mt-5 sm:rounded-[24px]">
          <div className="flex items-center gap-2.5 border-b border-[#C9DDEB] bg-[#DCEAF7] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-[#173F35] text-white sm:size-9"><UserRound size={19} /></span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold leading-6 text-[#173F35] sm:text-[21px] sm:leading-7">Account details</h2>
              <p className="hidden text-[13px] text-[#526359] sm:block">Your name, photo and Host ID.</p>
            </div>
          </div>
          <div className="grid gap-0 lg:grid-cols-[255px_minmax(0,1fr)]">
            <div className="border-b border-[#C9DDEB] px-3 py-3 sm:px-6 sm:py-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-4 lg:flex-col lg:text-center">
                <div className="relative shrink-0">
                  {profile?.profilePhotoUrl ? (
                    <img src={profile.profilePhotoUrl} alt="Profile" className="size-[58px] rounded-full border-[3px] border-white object-cover shadow-sm sm:size-24" />
                  ) : (
                    <div className="grid size-[58px] place-items-center rounded-full border-[3px] border-white bg-[#173F35] text-[23px] font-semibold text-white shadow-sm sm:size-24 sm:text-[28px]">{identityInitial}</div>
                  )}
                  <label className="focus-ring absolute -bottom-1 -right-1 grid size-9 cursor-pointer place-items-center rounded-full border-[3px] border-white bg-[#C86C42] text-white hover:bg-[#AF5734]">
                    <Camera size={15} aria-hidden="true" />
                    <span className="sr-only">Change profile photo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingPhoto} onChange={handlePhotoChange} />
                  </label>
                </div>
                <div className="min-w-0">
                  <p className="break-words text-[16px] font-semibold text-[#173F35]">{profile?.name || currentUser?.name || 'Host'}</p>
                  <p title={profile?.email || currentUser?.email || ''} className="mt-1 max-w-full overflow-x-auto whitespace-nowrap text-[12px] leading-5 tracking-[-0.02em] text-[#53675F] sm:text-[13px]">{profile?.email || currentUser?.email || ''}</p>
                  <p className="mt-0 text-[12px] text-[#53675F] sm:mt-2">{uploadingPhoto ? 'Uploading photo…' : <span className="hidden sm:inline">Tap the camera to change photo</span>}</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleProfileSubmit} className="min-w-0 px-3 py-3 sm:px-6 sm:py-5">
              <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="host-account-name-field" className="mb-1.5 block text-[13px] font-semibold text-[#173F35]">Name</label>
                  <input id="host-account-name-field" value={name} onChange={(event) => setName(event.target.value)} className={hostInputClassName} required minLength={2} maxLength={120} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="host-account-id-field" className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#173F35]">
                    <IdCard size={15} aria-hidden="true" /> Your Host account ID
                  </label>
                  <div className="flex min-w-0 items-stretch gap-2">
                    <input id="host-account-id-field" aria-label="Your Host account ID" readOnly value={hostAccountId} placeholder="ID unavailable" onFocus={(event) => event.currentTarget.select()} className="focus-ring min-w-0 flex-1 rounded-[12px] border border-[#C9DDEB] bg-white px-3 py-2.5 font-mono text-[13px] text-[#173F35]" />
                    <button type="button" onClick={handleCopyHostAccountId} disabled={!hostAccountId} className="focus-ring inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-[#173F35] px-3.5 text-[13px] font-semibold text-white hover:bg-[#245B4B] disabled:opacity-50">
                      {hostIdCopyStatus === 'copied' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      {hostIdCopyStatus === 'copied' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-1.5 hidden text-[12px] leading-4 text-[#526359] sm:block">Share this ID when joining another business team.</p>
                  <p aria-live="polite" className="text-[12px] text-[#173F35]">
                    {hostIdCopyStatus === 'unavailable' ? 'Copy unavailable. Select the ID to copy manually.' : hostIdCopyStatus === 'copied' ? 'Host account ID copied.' : null}
                  </p>
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <label htmlFor="host-business-workspace-id-field" className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#173F35]">
                    <Building2 size={15} aria-hidden="true" /> Business workspace ID
                    {businessWorkspace?.displayName ? (
                      <span className="hidden truncate text-[12px] font-medium text-[#526359] sm:inline">· {businessWorkspace.displayName}</span>
                    ) : null}
                  </label>
                  <div className="flex min-w-0 items-stretch gap-2">
                    <input
                      id="host-business-workspace-id-field"
                      aria-label="Business workspace ID"
                      readOnly
                      value={businessWorkspaceId}
                      placeholder={businessWorkspaceLoadState === 'loading' ? 'Loading business ID…' : 'Business ID unavailable'}
                      onFocus={(event) => event.currentTarget.select()}
                      className="focus-ring min-w-0 flex-1 rounded-[12px] border border-[#DCE0CF] bg-white px-3 py-2.5 font-mono text-[13px] text-[#173F35]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyBusinessWorkspaceId}
                      disabled={!businessWorkspaceId}
                      className="focus-ring inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-[#173F35] px-3.5 text-[13px] font-semibold text-white hover:bg-[#245B4B] disabled:opacity-50"
                    >
                      {businessWorkspaceCopyStatus === 'copied' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      {businessWorkspaceCopyStatus === 'copied' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-1.5 hidden text-[12px] leading-4 text-[#526359] sm:block">
                    Use this ID to switch to a Hospitality workspace you are authorized to access.
                  </p>
                  <p aria-live="polite" className="text-[12px] text-[#173F35]">
                    {businessWorkspaceCopyStatus === 'unavailable'
                      ? 'Copy unavailable. Select the ID to copy manually.'
                      : businessWorkspaceCopyStatus === 'copied'
                        ? 'Business workspace ID copied.'
                        : businessWorkspaceLoadState === 'unavailable'
                          ? 'Business ID could not be loaded. Confirm your Hospitality access.'
                          : null}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end border-t border-[#C9DDEB] pt-3 sm:mt-4 sm:pt-4">
                <button type="submit" disabled={savingProfile} className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#173F35] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#245B4B] disabled:opacity-60 sm:w-auto">
                  <Save size={16} /> {savingProfile ? 'Saving…' : 'Save account'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="mt-3 rounded-[18px] border border-[#D5D9CB] bg-[#F7F6F2] p-3 sm:mt-5 sm:rounded-[24px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-sky-700 shadow-sm sm:size-10 sm:rounded-2xl">
                <Building2 size={17} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold leading-6 text-[#173F35] sm:text-[21px]">Business address & contact</h2>
                <p className="mt-1 hidden text-[13px] leading-5 text-[#526359] sm:block">Registered business information and contact details.</p>
              </div>
            </div>
            {!editingBusiness ? (
              <button
                type="button"
                onClick={() => setEditingBusiness(true)}
                className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#D5D9CB] bg-white px-3 py-2 text-[13px] font-semibold text-[#173F35]"
              >
                <Pencil size={13} aria-hidden="true" />
                Edit
              </button>
            ) : null}
          </div>

          {!editingBusiness ? (
            <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-[12px] border border-[#E2E4DA] bg-white/90 p-3 sm:rounded-[18px] sm:p-3.5">
                <p className="text-[12px] font-semibold text-[#526359]">Business</p>
                <p className="mt-1 text-[15px] font-semibold text-[#173F35]">{hostBusinessForm.legalEntityName || hostOrganization?.displayName || 'Add business name'}</p>
                <p className="mt-1 text-[12px] capitalize text-[#526359]">{String(hostBusinessForm.businessType || 'other').replaceAll('_', ' ')}</p>
              </div>
              <div className="rounded-[12px] border border-[#E2E4DA] bg-white/90 p-3 sm:rounded-[18px] sm:p-3.5">
                <p className="text-[12px] font-semibold text-[#526359]">Main location</p>
                <p className="mt-1 text-[14px] leading-5 text-[#173F35]">{businessAddress || 'Add your business address'}</p>
              </div>
              <div className="rounded-[12px] border border-[#E2E4DA] bg-white/90 p-3 sm:rounded-[18px] sm:p-3.5">
                <p className="text-[12px] font-semibold text-[#526359]">Business contact</p>
                <p className="mt-1 break-all text-[14px] text-[#173F35]">{hostBusinessForm.supportEmail || 'Add support email'}</p>
                <p className="mt-1 text-[13px] text-[#526359]">{hostBusinessForm.supportPhone || 'Add support phone'}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleHostBusinessSubmit} className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Business name">
                <input required minLength={2} value={hostBusinessForm.legalEntityName} onChange={(event) => setHostBusinessForm((current) => ({ ...current, legalEntityName: event.target.value }))} className={hostInputClassName} />
              </Field>
              <Field label="Business type">
                <select value={hostBusinessForm.businessType} onChange={(event) => setHostBusinessForm((current) => ({ ...current, businessType: event.target.value }))} className={hostInputClassName}>
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="private_limited">Private limited</option>
                  <option value="public_limited">Public limited</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Address line 1"><input value={hostBusinessForm.line1} onChange={(event) => setHostBusinessForm((current) => ({ ...current, line1: event.target.value }))} className={hostInputClassName} /></Field>
              <Field label="Address line 2"><input value={hostBusinessForm.line2} onChange={(event) => setHostBusinessForm((current) => ({ ...current, line2: event.target.value }))} className={hostInputClassName} /></Field>
              <Field label="City"><input value={hostBusinessForm.city} onChange={(event) => setHostBusinessForm((current) => ({ ...current, city: event.target.value }))} className={hostInputClassName} /></Field>
              <Field label="State"><input value={hostBusinessForm.state} onChange={(event) => setHostBusinessForm((current) => ({ ...current, state: event.target.value }))} className={hostInputClassName} /></Field>
              <Field label="Business pincode"><input value={hostBusinessForm.postalCode} onChange={(event) => setHostBusinessForm((current) => ({ ...current, postalCode: event.target.value }))} className={hostInputClassName} inputMode="numeric" /></Field>
              <Field label="Support email"><input type="email" value={hostBusinessForm.supportEmail} onChange={(event) => setHostBusinessForm((current) => ({ ...current, supportEmail: event.target.value }))} className={hostInputClassName} /></Field>
              <Field label="Support phone"><input value={hostBusinessForm.supportPhone} onChange={(event) => setHostBusinessForm((current) => ({ ...current, supportPhone: event.target.value }))} className={hostInputClassName} /></Field>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
                <button type="button" onClick={() => { setHostBusinessForm(getInitialHostBusinessForm(hostOrganization, hostOperationalProfile)); setEditingBusiness(false) }} className="focus-ring flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[11px] font-black text-stone-700 sm:flex-none sm:text-xs">Cancel</button>
                <button disabled={savingBusiness} className="focus-ring flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-black text-white disabled:opacity-60 sm:flex-none sm:text-xs">{savingBusiness ? 'Saving…' : 'Save business details'}</button>
              </div>
            </form>
          )}
        </section>

        <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
          <section className="overflow-hidden rounded-[22px] border border-[#C8D9C8] bg-[#EDF3EB] sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-2.5 border-b border-[#C8D9C8] bg-[#DCE8D9] px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-[#173F35] text-white sm:size-10"><Warehouse size={19} /></span>
                <div className="min-w-0"><h2 className="text-[18px] font-semibold text-[#173F35] sm:text-[21px]">Stock locations</h2></div>
              </div>
              <button type="button" onClick={() => setInventoryNodeForm(getInitialInventoryNodeForm())} className="focus-ring inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[11px] bg-[#173F35] px-3 text-[13px] font-semibold text-white hover:bg-[#245B4B] sm:min-h-[42px] sm:px-3.5"><Plus size={15} /> Add</button>
            </div>
            <div className="p-3 sm:p-5">
              {featuredStock ? (
                <div className="rounded-[14px] border border-[#C4D6C8] bg-white px-3 py-3 sm:rounded-[16px] sm:px-5 sm:py-4">
                  <p className="mb-2 hidden text-[12px] font-semibold uppercase tracking-[0.07em] text-[#567362] sm:block">Main stock location</p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-[15px] font-semibold leading-5 text-[#173F35] sm:text-[17px] sm:leading-6">{featuredStock.name}</h3>
                      <p className="mt-1 text-[13px] text-[#596760]">{formatNodeType(featuredStock.nodeType)}{featuredStock.address?.city ? ` · ${featuredStock.address.city}` : ''}{featuredStock.address?.postalCode ? ` · ${featuredStock.address.postalCode}` : ''}</p>
                      {featuredStock.address?.line1 ? <p className="mt-1 text-[13px] leading-5 text-[#596760]">{featuredStock.address.line1}</p> : null}
                    </div>
                    <button type="button" onClick={() => setInventoryNodeForm(getInitialInventoryNodeForm(featuredStock))} className="focus-ring inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[10px] border border-[#C4D6C8] bg-[#F0F6F0] px-3 text-[13px] font-semibold text-[#173F35]"><Pencil size={14} /> Edit</button>
                  </div>
                </div>
              ) : <p className="rounded-[14px] bg-white px-4 py-4 text-[14px] text-[#526359]">No stock locations yet. Select Add to create one.</p>}
              {otherStock.length > 0 ? (
                <details className="group mt-2.5 overflow-hidden rounded-[14px] border border-[#C4D6C8] bg-white sm:mt-3">
                  <summary className="focus-ring flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[14px] font-semibold text-[#173F35] sm:min-h-[48px] sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
                    <span>Other stock locations <span className="ml-1 text-[#5D7166]">({otherStock.length})</span></span>
                    <ChevronDown size={19} className="shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-[#DFE7DF]">
                    {otherStock.map((node) => (
                      <div key={node.id} className="flex items-center gap-3 border-b border-[#EDF0ED] px-3 py-3 last:border-b-0 sm:px-4">
                        <LocationItemThumbnail photo={locationItemPhotos[locationItemKey(node.name)]} kind="stock" />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[14px] font-semibold leading-5 text-[#173F35]">{node.name}</p>
                          <p className="mt-0.5 text-[12px] leading-4 text-[#596760]">{formatNodeType(node.nodeType)}{node.address?.city ? ` · ${node.address.city}` : ''}{node.address?.postalCode ? ` · ${node.address.postalCode}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => setInventoryNodeForm(getInitialInventoryNodeForm(node))} className="focus-ring inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-[9px] border border-[#D5E2D8] px-2.5 text-[13px] font-semibold text-[#173F35]"><Pencil size={13} /> Edit</button>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              {inventoryNodeForm ? (
              <form onSubmit={handleInventoryNodeSubmit} className="mt-4 rounded-[16px] border border-[#C4D6C8] bg-white p-4 sm:rounded-[20px]">
                <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black text-stone-950 sm:text-sm">{inventoryNodeForm.id ? 'Edit stock location' : 'Add stock location'}</h3><button type="button" onClick={() => setInventoryNodeForm(null)} className="focus-ring grid size-8 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600"><X size={14} /></button></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Location name"><input required value={inventoryNodeForm.name} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, name: event.target.value }))} className={hostInputClassName} placeholder="Main warehouse" /></Field>
                  <Field label="Location type"><select value={inventoryNodeForm.nodeType} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, nodeType: event.target.value }))} className={hostInputClassName}><option value="warehouse">Warehouse</option><option value="store">Store</option><option value="dark_store">Dark store</option><option value="distribution_center">Distribution center</option><option value="other">Other</option></select></Field>
                  <Field label="Address line 1"><input value={inventoryNodeForm.line1} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, line1: event.target.value }))} className={hostInputClassName} /></Field>
                  <Field label="Address line 2"><input value={inventoryNodeForm.line2} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, line2: event.target.value }))} className={hostInputClassName} /></Field>
                  <Field label="City"><input value={inventoryNodeForm.city} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, city: event.target.value }))} className={hostInputClassName} /></Field>
                  <Field label="State"><input value={inventoryNodeForm.state} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, state: event.target.value }))} className={hostInputClassName} /></Field>
                  <Field label="Pincode"><input value={inventoryNodeForm.postalCode} onChange={(event) => setInventoryNodeForm((current) => ({ ...current, postalCode: event.target.value }))} className={hostInputClassName} inputMode="numeric" /></Field>
                </div>
                <button disabled={savingLocation} className="focus-ring mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-black text-white disabled:opacity-60 sm:text-xs">{savingLocation ? 'Saving…' : inventoryNodeForm.id ? 'Save location' : 'Add location'}</button>
              </form>
            ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-[22px] border border-[#DACFEB] bg-[#F5F1FA] sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-2.5 border-b border-[#DACFEB] bg-[#E8E0F3] px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-[#173F35] text-white sm:size-10"><MapPinned size={19} /></span>
                <div className="min-w-0"><h2 className="text-[18px] font-semibold text-[#173F35] sm:text-[21px]">Delivery areas</h2></div>
              </div>
              <button type="button" onClick={() => setServiceAreaForm(getInitialServiceAreaForm())} className="focus-ring inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[11px] bg-[#173F35] px-3 text-[13px] font-semibold text-white hover:bg-[#245B4B] sm:min-h-[42px] sm:px-3.5"><Plus size={15} /> Add</button>
            </div>
            <div className="p-3 sm:p-5">
              {featuredArea ? (
                <div className="rounded-[14px] border border-[#DAD0E8] bg-white px-3 py-3 sm:rounded-[16px] sm:px-5 sm:py-4">
                  <p className="mb-2 hidden text-[12px] font-semibold uppercase tracking-[0.07em] text-[#76648E] sm:block">Main delivery area</p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-[15px] font-semibold leading-5 text-[#173F35] sm:text-[17px] sm:leading-6">{featuredArea.name}</h3>
                      <p className="mt-1 text-[13px] text-[#596760]">
                        <span className="sm:hidden">{featuredPostal ? `${featuredPostal} · ` : ''}{(featuredArea.postalCodes || []).length} pincodes</span>
                        <span className="hidden sm:inline">{featuredPostal ? `Main pincode ${featuredPostal} · ` : ''}{(featuredArea.postalCodes || []).length} service pincodes</span>
                      </p>
                      <p className="mt-1 hidden text-[13px] leading-5 text-[#596760] sm:block">
                        {inventoryNodes.find((node) => String(node.id) === String(featuredArea.inventoryNodeId))?.name || 'All active stock locations'}
                      </p>
                    </div>
                    <button type="button" onClick={() => setServiceAreaForm(getInitialServiceAreaForm(featuredArea))} className="focus-ring inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[10px] border border-[#DAD0E8] bg-[#F5F1FA] px-3 text-[13px] font-semibold text-[#173F35]"><Pencil size={14} /> Edit</button>
                  </div>
                </div>
              ) : <p className="rounded-[14px] bg-white px-4 py-4 text-[14px] text-[#526359]">No delivery areas yet. Select Add to create one.</p>}
              {otherAreas.length > 0 ? (
                <details className="group mt-2.5 overflow-hidden rounded-[14px] border border-[#DAD0E8] bg-white sm:mt-3">
                  <summary className="focus-ring flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[14px] font-semibold text-[#173F35] sm:min-h-[48px] sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
                    <span>Other delivery areas <span className="ml-1 text-[#776989]">({otherAreas.length})</span></span>
                    <ChevronDown size={19} className="shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-[#E8E0F3]">
                    {otherAreas.map((area) => {
                      const linkedNode = inventoryNodes.find((node) => String(node.id) === String(area.inventoryNodeId))
                      return (
                        <div key={area.id} className="flex items-center gap-3 border-b border-[#EFEAF4] px-3 py-3 last:border-b-0 sm:px-4">
                          <LocationItemThumbnail photo={locationItemPhotos[locationItemKey(area.name)] || locationItemPhotos[locationItemKey(linkedNode?.name)]} kind="delivery" />
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-[14px] font-semibold leading-5 text-[#173F35]">{area.name}</p>
                            <p className="mt-0.5 text-[12px] leading-4 text-[#596760]">{(area.postalCodes || []).length} pincodes · {linkedNode?.name || 'All active stock locations'}</p>
                          </div>
                          <button type="button" onClick={() => setServiceAreaForm(getInitialServiceAreaForm(area))} className="focus-ring inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-[9px] border border-[#E0D8EC] px-2.5 text-[13px] font-semibold text-[#173F35]"><Pencil size={13} /> Edit</button>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
              {serviceAreaForm ? (
              <form onSubmit={handleServiceAreaSubmit} className="mt-4 rounded-[16px] border border-[#DAD0E8] bg-white p-4 sm:rounded-[20px]">
                <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black text-stone-950 sm:text-sm">{serviceAreaForm.id ? 'Edit delivery area' : 'Add delivery area'}</h3><button type="button" onClick={() => setServiceAreaForm(null)} className="focus-ring grid size-8 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600"><X size={14} /></button></div>
                <div className="mt-3 grid gap-3">
                  <Field label="Area name"><input required value={serviceAreaForm.name} onChange={(event) => setServiceAreaForm((current) => ({ ...current, name: event.target.value }))} className={hostInputClassName} placeholder="Delhi Central" /></Field>
                  <Field label="Use stock location"><select value={serviceAreaForm.inventoryNodeId} onChange={(event) => setServiceAreaForm((current) => ({ ...current, inventoryNodeId: event.target.value }))} className={hostInputClassName}><option value="">All active locations</option>{inventoryNodes.filter((node) => node.status === 'active').map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></Field>
                  <Field label="Delivery pincodes"><textarea required rows={3} value={serviceAreaForm.postalCodes} onChange={(event) => setServiceAreaForm((current) => ({ ...current, postalCodes: event.target.value }))} className={`${hostInputClassName} resize-y`} placeholder="110001, 110002, 110003" /></Field>
                </div>
                <button disabled={savingServiceArea} className="focus-ring mt-3 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-[11px] font-black text-white disabled:opacity-60 sm:text-xs">{savingServiceArea ? 'Saving…' : serviceAreaForm.id ? 'Save delivery area' : 'Add delivery area'}</button>
              </form>
            ) : null}
            </div>
          </section>
        </div>

        <section className="mt-3 flex items-center justify-between gap-2 rounded-[16px] border border-[#C5D6C7] bg-[#DFE9DC] px-3 py-3 sm:mt-5 sm:gap-3 sm:rounded-[18px] sm:p-5">
          <div className="flex min-w-0 items-center gap-2.5 sm:items-start">
            <div className="hidden size-8 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 sm:grid sm:size-10 sm:rounded-2xl"><Store size={17} aria-hidden="true" /></div>
            <div className="min-w-0"><h2 className="text-[15px] font-semibold leading-5 text-[#173F35] sm:text-[17px]"><span className="sm:hidden">Operations setup</span><span className="hidden sm:inline">Review operations setup</span></h2><p className="mt-1 hidden text-[13px] text-[#526359] sm:block">Check readiness and delivery coverage.</p></div>
          </div>
          <Link to="/host/operations-center" className="focus-ring inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[11px] bg-[#173F35] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#245B4B] sm:gap-2 sm:rounded-[12px] sm:px-4 sm:py-2.5 sm:text-[14px]"><span className="sm:hidden">Review</span><span className="hidden sm:inline">Open Operations Center</span><ArrowRight size={16} /></Link>
        </section>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-7">
      <div className="rounded-[26px] bg-stone-950 px-6 py-7 text-white sm:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-400">
          Account profile
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Edit My Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
          {isCustomer
            ? 'Update your personal details, profile photo and saved delivery addresses.'
            : 'Update your Host account name and profile photo.'}
        </p>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          <CheckCircle2
            size={17}
            aria-hidden="true"
          />
          {success}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {profile?.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt="Profile"
                  className="h-32 w-32 rounded-full border-4 border-emerald-50 object-cover shadow-sm"
                />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-full border-4 border-emerald-50 bg-emerald-700 text-4xl font-black text-white shadow-sm">
                  {identityInitial}
                </div>
              )}

              <label className="focus-ring absolute bottom-0 right-0 grid h-10 w-10 cursor-pointer place-items-center rounded-full border-4 border-white bg-stone-950 text-white shadow-sm transition hover:bg-emerald-700">
                <Camera
                  size={17}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  Change profile photo
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploadingPhoto}
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            <p className="mt-4 text-lg font-black text-stone-950">
              {profile?.name ||
                currentUser?.name ||
                'EPANTRY user'}
            </p>
            <p className="mt-1 max-w-full truncate text-xs font-semibold text-stone-500">
              {profile?.email ||
                currentUser?.email ||
                ''}
            </p>
            <p className="mt-3 text-xs font-bold text-stone-400">
              {uploadingPhoto
                ? 'Uploading photo…'
                : 'JPEG, PNG or WebP'}
            </p>
          </div>
        </section>

        <form
          onSubmit={handleProfileSubmit}
          className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <UserRound
                size={19}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-950">
                Personal details
              </h2>
              <p className="text-xs font-semibold text-stone-500">
                Keep your visible account information up to date.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                className={inputClassName}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>

            {isCustomer ? (
              <Field label="Phone number">
                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                  inputMode="tel"
                  placeholder="+91…"
                />
              </Field>
            ) : null}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save
                size={17}
                aria-hidden="true"
              />
              {savingProfile
                ? 'Saving…'
                : 'Save profile'}
            </button>
          </div>
        </form>
      </div>

      {isCustomer ? (
        <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <MapPin
                  size={19}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-950">
                  Saved addresses
                </h2>
                <p className="text-xs font-semibold text-stone-500">
                  Add a new delivery address or edit an existing one.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={beginAddAddress}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              <Plus
                size={16}
                aria-hidden="true"
              />
              Add address
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {addresses.length >
            0 ? (
              addresses.map(
                (address) => (
                  <article
                    key={address.id}
                    className="rounded-[20px] border border-stone-200 bg-stone-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-stone-950">
                            {formatAddressTitle(
                              address,
                            )}
                          </p>
                          {address.isDefault ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                          {address.addressLine1}
                          {address.addressLine2
                            ? `, ${address.addressLine2}`
                            : ''}
                          {`, ${address.area}, ${address.city}, ${address.state} ${address.postalCode}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          beginEditAddress(
                            address,
                          )
                        }
                        className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:border-emerald-300 hover:text-emerald-700"
                        aria-label={`Edit ${formatAddressTitle(
                          address,
                        )} address`}
                      >
                        <Pencil
                          size={15}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </article>
                ),
              )
            ) : (
              <div className="lg:col-span-2 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm font-semibold text-stone-500">
                No delivery address saved yet.
              </div>
            )}
          </div>

          {addressForm ? (
            <form
              onSubmit={handleAddressSubmit}
              className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-stone-950">
                  {addressForm.id
                    ? 'Edit address'
                    : 'Add address'}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setAddressForm(
                      null,
                    )
                  }
                  className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600"
                  aria-label="Close address form"
                >
                  <X
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Recipient name">
                  <input
                    value={addressForm.recipientName}
                    onChange={(event) =>
                      updateAddressField(
                        'recipientName',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                  />
                </Field>

                <Field label="Recipient phone">
                  <input
                    value={addressForm.phone}
                    onChange={(event) =>
                      updateAddressField(
                        'phone',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                    inputMode="tel"
                  />
                </Field>

                <Field label="Label">
                  <select
                    value={addressForm.label}
                    onChange={(event) =>
                      updateAddressField(
                        'label',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                  >
                    {ADDRESS_LABELS.map(
                      (label) => (
                        <option
                          key={label}
                          value={label}
                        >
                          {label.charAt(0).toUpperCase() +
                            label.slice(1)}
                        </option>
                      ),
                    )}
                  </select>
                </Field>

                {addressForm.label ===
                'other' ? (
                  <Field label="Custom label">
                    <input
                      value={addressForm.customLabel}
                      onChange={(event) =>
                        updateAddressField(
                          'customLabel',
                          event.target.value,
                        )
                      }
                      className={inputClassName}
                      required
                    />
                  </Field>
                ) : null}

                <div className="sm:col-span-2">
                  <Field label="Address line 1">
                    <input
                      value={addressForm.addressLine1}
                      onChange={(event) =>
                        updateAddressField(
                          'addressLine1',
                          event.target.value,
                        )
                      }
                      className={inputClassName}
                      required
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Address line 2">
                    <input
                      value={addressForm.addressLine2}
                      onChange={(event) =>
                        updateAddressField(
                          'addressLine2',
                          event.target.value,
                        )
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>

                <Field label="Area / locality">
                  <input
                    value={addressForm.area}
                    onChange={(event) =>
                      updateAddressField(
                        'area',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                  />
                </Field>

                <Field label="Landmark">
                  <input
                    value={addressForm.landmark}
                    onChange={(event) =>
                      updateAddressField(
                        'landmark',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="City">
                  <input
                    value={addressForm.city}
                    onChange={(event) =>
                      updateAddressField(
                        'city',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                  />
                </Field>

                <Field label="State">
                  <input
                    value={addressForm.state}
                    onChange={(event) =>
                      updateAddressField(
                        'state',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                  />
                </Field>

                <Field label="Pincode">
                  <input
                    value={addressForm.postalCode}
                    onChange={(event) =>
                      updateAddressField(
                        'postalCode',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                    inputMode="numeric"
                    maxLength={6}
                  />
                </Field>

                <Field label="Country">
                  <input
                    value={addressForm.country}
                    onChange={(event) =>
                      updateAddressField(
                        'country',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    required
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Delivery instructions">
                    <textarea
                      value={addressForm.deliveryInstructions}
                      onChange={(event) =>
                        updateAddressField(
                          'deliveryInstructions',
                          event.target.value,
                        )
                      }
                      className={`${inputClassName} min-h-24 resize-y`}
                      maxLength={240}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save
                    size={16}
                    aria-hidden="true"
                  />
                  {savingAddress
                    ? 'Saving…'
                    : addressForm.id
                      ? 'Save address'
                      : 'Add address'}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
