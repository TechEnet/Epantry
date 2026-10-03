import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
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

const HOST_PROFILE_STEPS = [
  {
    number: '01',
    title: 'Account details',
    description: 'Keep your name and photo current.',
    className: 'border-emerald-200 bg-emerald-100/75',
  },
  {
    number: '02',
    title: 'Business address',
    description: 'Save where your business operates from.',
    className: 'border-sky-200 bg-sky-100/75',
  },
  {
    number: '03',
    title: 'Stock & delivery',
    description: 'Add stores, warehouses and delivery pincodes.',
    className: 'border-violet-200 bg-violet-100/70',
  },
  {
    number: '04',
    title: 'Review operations',
    description: 'Continue to Operations Center when details are ready.',
    className: 'border-emerald-200 bg-emerald-50',
  },
]

const hostInputClassName =
  'focus-ring w-full rounded-[14px] border border-stone-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-stone-950 outline-none transition focus:border-emerald-500 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm'

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

    return (
      <div className="px-2.5 pb-4 pt-0 sm:px-5 sm:pb-6 lg:px-6 lg:pb-7">
        <header className="rounded-[22px] border border-emerald-200 bg-[linear-gradient(135deg,#dcf7e9_0%,#e9f6fb_58%,#f1ecff_100%)] p-3.5 shadow-[0_10px_28px_rgba(23,72,59,0.08)] sm:rounded-[28px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700 sm:text-[10px]">
                Host profile
              </p>
              <h1 className="mt-1 text-[21px] font-black tracking-[-0.035em] text-stone-950 sm:mt-2 sm:text-3xl">
                Profile & business locations
              </h1>
              <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
                Keep your account, business address, stock locations and delivery pincodes up to date.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {HOST_PROFILE_STEPS.map((step) => (
              <div
                key={step.number}
                className={`rounded-[15px] border p-2.5 sm:rounded-[20px] sm:p-4 ${step.className}`}
              >
                <div className="flex items-start gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[13px] text-stone-950 sm:text-xs sm:leading-4">
                      {step.title}
                    </p>
                    <p className="mt-1 text-[9px] font-semibold leading-[13px] text-stone-600 sm:text-[11px] sm:leading-4">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
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

        <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm sm:rounded-[24px] sm:p-5">
            <div className="flex items-center gap-3 xl:flex-col xl:text-center">
              <div className="relative shrink-0">
                {profile?.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt="Profile"
                    className="size-[76px] rounded-full border-[3px] border-white object-cover shadow-sm sm:size-24 xl:size-28"
                  />
                ) : (
                  <div className="grid size-[76px] place-items-center rounded-full border-[3px] border-white bg-emerald-700 text-2xl font-black text-white shadow-sm sm:size-24 sm:text-3xl xl:size-28">
                    {identityInitial}
                  </div>
                )}

                <label className="focus-ring absolute bottom-0 right-0 grid size-8 cursor-pointer place-items-center rounded-full border-[3px] border-white bg-stone-950 text-white shadow-sm transition hover:bg-emerald-700 sm:size-9">
                  <Camera size={14} aria-hidden="true" />
                  <span className="sr-only">Change profile photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>

              <div className="min-w-0 xl:mt-3">
                <p className="truncate text-sm font-black text-stone-950 sm:text-base">
                  {profile?.name || currentUser?.name || 'Host'}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-stone-500 sm:text-xs">
                  {profile?.email || currentUser?.email || ''}
                </p>
                <p className="mt-1 text-[9px] font-bold text-stone-400 sm:text-[10px]">
                  {uploadingPhoto ? 'Uploading photo…' : 'Tap the camera to change photo'}
                </p>
              </div>
            </div>
          </section>

          <form
            onSubmit={handleProfileSubmit}
            className="rounded-[20px] border border-sky-200 bg-sky-50/80 p-3 shadow-sm sm:rounded-[24px] sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-xl bg-white text-sky-700 shadow-sm sm:size-10 sm:rounded-2xl">
                <UserRound size={17} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-black text-stone-950 sm:text-lg">Account details</h2>
                <p className="text-[9px] font-semibold text-stone-500 sm:text-xs">This name is visible across your Host workspace.</p>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 sm:max-w-xl">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={hostInputClassName}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </Field>
            </div>

            <div className="mt-3 flex justify-end sm:mt-4">
              <button
                type="submit"
                disabled={savingProfile}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-[14px] bg-emerald-700 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-emerald-800 disabled:opacity-60 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
              >
                <Save size={15} aria-hidden="true" />
                {savingProfile ? 'Saving…' : 'Save account'}
              </button>
            </div>
          </form>
        </div>

        <section className="mt-3 rounded-[20px] border border-sky-200 bg-[linear-gradient(135deg,#e8f5fb_0%,#eef9f4_100%)] p-3 shadow-sm sm:mt-4 sm:rounded-[24px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-sky-700 shadow-sm sm:size-10 sm:rounded-2xl">
                <Building2 size={17} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-stone-950 sm:text-lg">Business address & contact</h2>
                <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-xs">Keep the main address and contact details for your business current.</p>
              </div>
            </div>
            {!editingBusiness ? (
              <button
                type="button"
                onClick={() => setEditingBusiness(true)}
                className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-[10px] font-black text-sky-800 sm:text-xs"
              >
                <Pencil size={13} aria-hidden="true" />
                Edit
              </button>
            ) : null}
          </div>

          {!editingBusiness ? (
            <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-[14px] border border-white/80 bg-white/75 p-3 sm:rounded-[18px]">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-700">Business</p>
                <p className="mt-1 text-[11px] font-black text-stone-950 sm:text-sm">{hostBusinessForm.legalEntityName || hostOrganization?.displayName || 'Add business name'}</p>
                <p className="mt-0.5 text-[9px] font-semibold capitalize text-stone-500 sm:text-[11px]">{String(hostBusinessForm.businessType || 'other').replaceAll('_', ' ')}</p>
              </div>
              <div className="rounded-[14px] border border-white/80 bg-white/75 p-3 sm:rounded-[18px]">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-700">Main location</p>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-700 sm:text-xs">{businessAddress || 'Add your business address'}</p>
              </div>
              <div className="rounded-[14px] border border-white/80 bg-white/75 p-3 sm:rounded-[18px]">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-700">Business contact</p>
                <p className="mt-1 truncate text-[10px] font-semibold text-stone-700 sm:text-xs">{hostBusinessForm.supportEmail || 'Add support email'}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-stone-500 sm:text-xs">{hostBusinessForm.supportPhone || 'Add support phone'}</p>
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
          <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/75 p-3 shadow-sm sm:rounded-[24px] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm sm:size-10 sm:rounded-2xl"><Warehouse size={17} aria-hidden="true" /></div>
                <div className="min-w-0"><h2 className="text-sm font-black text-stone-950 sm:text-lg">Stock locations</h2><p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-xs">Add or edit the stores, warehouses or dispatch locations where you keep stock.</p></div>
              </div>
              <button type="button" onClick={() => setInventoryNodeForm(getInitialInventoryNodeForm())} className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-700 px-2.5 py-2 text-[10px] font-black text-white sm:px-3 sm:text-xs"><Plus size={13} /> Add</button>
            </div>

            <div className="mt-3 space-y-2">
              {inventoryNodes.length ? inventoryNodes.map((node) => (
                <article key={node.id} className="rounded-[14px] border border-emerald-100 bg-white/85 p-3 sm:rounded-[18px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5"><p className="text-[11px] font-black text-stone-950 sm:text-sm">{node.name}</p><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-700">{formatNodeType(node.nodeType)}</span></div>
                      <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-500 sm:text-[11px]">{[node.address?.line1, node.address?.city, node.address?.state, node.address?.postalCode].filter(Boolean).join(', ') || 'Address not added yet'}</p>
                    </div>
                    <button type="button" onClick={() => setInventoryNodeForm(getInitialInventoryNodeForm(node))} className="focus-ring grid size-8 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-white text-emerald-700" aria-label={`Edit ${node.name}`}><Pencil size={13} /></button>
                  </div>
                </article>
              )) : (
                <div className="rounded-[14px] border border-dashed border-emerald-200 bg-white/60 p-4 text-center text-[10px] font-semibold text-stone-500 sm:text-xs">No stock location added yet.</div>
              )}
            </div>

            {inventoryNodeForm ? (
              <form onSubmit={handleInventoryNodeSubmit} className="mt-3 rounded-[16px] border border-emerald-200 bg-white/90 p-3 sm:mt-4 sm:rounded-[20px] sm:p-4">
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
          </section>

          <section className="rounded-[20px] border border-violet-200 bg-violet-50/75 p-3 shadow-sm sm:rounded-[24px] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm sm:size-10 sm:rounded-2xl"><MapPinned size={17} aria-hidden="true" /></div>
                <div className="min-w-0"><h2 className="text-sm font-black text-stone-950 sm:text-lg">Delivery areas</h2><p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-xs">Choose the customer pincodes you serve. These are the same delivery areas used in Operations Center and Pricing & Stock.</p></div>
              </div>
              <button type="button" onClick={() => setServiceAreaForm(getInitialServiceAreaForm())} className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xl bg-violet-700 px-2.5 py-2 text-[10px] font-black text-white sm:px-3 sm:text-xs"><Plus size={13} /> Add</button>
            </div>

            <div className="mt-3 space-y-2">
              {serviceAreas.length ? serviceAreas.map((area) => {
                const linkedNode = inventoryNodes.find((node) => String(node.id) === String(area.inventoryNodeId))
                return (
                  <article key={area.id} className="rounded-[14px] border border-violet-100 bg-white/85 p-3 sm:rounded-[18px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-stone-950 sm:text-sm">{area.name}</p>
                        <p className="mt-1 text-[9px] font-semibold text-stone-500 sm:text-[11px]">{linkedNode ? `From ${linkedNode.name}` : 'All active stock locations'}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">{(area.postalCodes || []).slice(0, 6).map((code) => <span key={code} className="rounded-full bg-violet-100 px-2 py-0.5 text-[8px] font-black text-violet-700">{code}</span>)}{(area.postalCodes || []).length > 6 ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[8px] font-black text-stone-600">+{area.postalCodes.length - 6}</span> : null}</div>
                      </div>
                      <button type="button" onClick={() => setServiceAreaForm(getInitialServiceAreaForm(area))} className="focus-ring grid size-8 shrink-0 place-items-center rounded-xl border border-violet-200 bg-white text-violet-700" aria-label={`Edit ${area.name}`}><Pencil size={13} /></button>
                    </div>
                  </article>
                )
              }) : (
                <div className="rounded-[14px] border border-dashed border-violet-200 bg-white/60 p-4 text-center text-[10px] font-semibold text-stone-500 sm:text-xs">No delivery area added yet.</div>
              )}
            </div>

            {serviceAreaForm ? (
              <form onSubmit={handleServiceAreaSubmit} className="mt-3 rounded-[16px] border border-violet-200 bg-white/90 p-3 sm:mt-4 sm:rounded-[20px] sm:p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black text-stone-950 sm:text-sm">{serviceAreaForm.id ? 'Edit delivery area' : 'Add delivery area'}</h3><button type="button" onClick={() => setServiceAreaForm(null)} className="focus-ring grid size-8 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600"><X size={14} /></button></div>
                <div className="mt-3 grid gap-3">
                  <Field label="Area name"><input required value={serviceAreaForm.name} onChange={(event) => setServiceAreaForm((current) => ({ ...current, name: event.target.value }))} className={hostInputClassName} placeholder="Delhi Central" /></Field>
                  <Field label="Use stock location"><select value={serviceAreaForm.inventoryNodeId} onChange={(event) => setServiceAreaForm((current) => ({ ...current, inventoryNodeId: event.target.value }))} className={hostInputClassName}><option value="">All active locations</option>{inventoryNodes.filter((node) => node.status === 'active').map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></Field>
                  <Field label="Delivery pincodes"><textarea required rows={3} value={serviceAreaForm.postalCodes} onChange={(event) => setServiceAreaForm((current) => ({ ...current, postalCodes: event.target.value }))} className={`${hostInputClassName} resize-y`} placeholder="110001, 110002, 110003" /></Field>
                </div>
                <button disabled={savingServiceArea} className="focus-ring mt-3 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-[11px] font-black text-white disabled:opacity-60 sm:text-xs">{savingServiceArea ? 'Saving…' : serviceAreaForm.id ? 'Save delivery area' : 'Add delivery area'}</button>
              </form>
            ) : null}
          </section>
        </div>

        <section className="mt-3 flex flex-col gap-3 rounded-[20px] border border-emerald-200 bg-emerald-100/65 p-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[24px] sm:p-5">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 sm:size-10 sm:rounded-2xl"><Store size={17} aria-hidden="true" /></div>
            <div><h2 className="text-sm font-black text-stone-950 sm:text-base">Next: review your operations setup</h2><p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-600 sm:text-xs">Check delivery coverage, business readiness and other Host setup details in Operations Center.</p></div>
          </div>
          <Link to="/host/operations-center" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-[11px] font-black text-white sm:text-xs">Open Operations Center <ArrowRight size={14} /></Link>
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
