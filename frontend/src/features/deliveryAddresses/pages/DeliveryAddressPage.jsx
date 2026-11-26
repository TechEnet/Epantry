import {
  Building2,
  Check,
  Clock3,
  HeartHandshake,
  Home,
  LocateFixed,
  MapPin,
  Pencil,
  Save,
  Tag,
  Truck,
  UserRound,
  UsersRound,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  useCurrentLocation,
} from '../../location/hooks/useCurrentLocation'

import {
  useLocationStore,
} from '../../location/store/location.store'

import {
  getMarketplaceCartDeliveryEta,
} from '../../commerce/services/commerce.service'

import {
  createDeliveryAddress,
  getDeliveryAddressErrorMessage,
  listDeliveryAddresses,
  setDefaultDeliveryAddress,
  updateDeliveryAddress,
} from '../services/deliveryAddress.service'

const ADDRESS_LABELS = [
  {
    value:
      'home',
    label:
      'Home',
    icon:
      Home,
  },
  {
    value:
      'office',
    label:
      'Office',
    icon:
      Building2,
  },
  {
    value:
      'family',
    label:
      'Family',
    icon:
      UsersRound,
  },
  {
    value:
      'friend',
    label:
      'Friend',
    icon:
      HeartHandshake,
  },
  {
    value:
      'other',
    label:
      'Other',
    icon:
      Tag,
  },
]

function createInitialForm(
  currentUser,
) {
  return {
    recipientType:
      'self',
    recipientName:
      currentUser?.name ||
      '',
    phone:
      currentUser?.phone ||
      '',
    label:
      'home',
    customLabel:
      '',
    addressLine1:
      '',
    addressLine2:
      '',
    area:
      '',
    landmark:
      '',
    city:
      '',
    state:
      '',
    postalCode:
      '',
    country:
      'India',
    deliveryInstructions:
      '',
    source:
      'manual',
  }
}

function createFormFromSavedAddress(address) {
  return {
    recipientType: address.recipientType || 'self',
    recipientName: address.recipientName || '',
    phone: address.phone || '',
    label: address.label || 'home',
    customLabel: address.customLabel || '',
    addressLine1: address.addressLine1 || '',
    addressLine2: address.addressLine2 || '',
    area: address.area || '',
    landmark: address.landmark || '',
    city: address.city || '',
    state: address.state || '',
    postalCode: address.postalCode || '',
    country: address.country || 'India',
    deliveryInstructions: address.deliveryInstructions || '',
    source: address.source || 'manual',
  }
}

function getSafeReturnTo(
  value,
) {
  const path =
    String(
      value ||
        '',
    ).trim()

  if (
    !path.startsWith(
      '/',
    ) ||
    path.startsWith(
      '//',
    )
  ) {
    return '/recipes'
  }

  return path
}

function getAddressTitle(
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

  const label =
    ADDRESS_LABELS.find(
      (item) =>
        item.value ===
        address?.label,
    )

  return label?.label ||
    'Delivery address'
}

function getCheckoutCartId(
  returnTo,
) {
  const match =
    String(
      returnTo ||
        '',
    ).match(
      /^\/checkout\/([a-f\d]{24})(?:[/?#]|$)/i,
    )

  return match?.[1] ||
    ''
}

function Field({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#35483F]">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

const inputClassName =
  'focus-ring w-full min-h-12 rounded-xl border border-[#CBD4C6] bg-white px-4 py-3 text-[15px] font-medium text-[#202421] outline-none transition placeholder:text-[#8C948C] focus:border-[#C56C42] focus:ring-2 focus:ring-[#C56C42]/15'

export default function DeliveryAddressPage() {
  const navigate =
    useNavigate()

  const location =
    useLocation()

  const [
    searchParams,
  ] =
    useSearchParams()

  const {
    currentUser,
  } =
    useAuth()

  const {
    currentLocation,
    status:
      locationStatus,
    error:
      locationError,
    requestCurrentLocation,
  } =
    useCurrentLocation()

  const setDeliveryContext =
    useLocationStore(
      (state) =>
        state.setDeliveryContext,
    )

  const returnTo =
    useMemo(
      () =>
        getSafeReturnTo(
          searchParams.get(
            'returnTo',
          ),
        ),
      [
        searchParams,
      ],
    )

  const checkoutCartId =
    useMemo(
      () =>
        getCheckoutCartId(
          returnTo,
        ),
      [
        returnTo,
      ],
    )

  const [
    deliveryEta,
    setDeliveryEta,
  ] =
    useState(null)

  const [
    deliveryEtaLoading,
    setDeliveryEtaLoading,
  ] =
    useState(false)

  const [
    etaNowMs,
    setEtaNowMs,
  ] =
    useState(
      () => Date.now(),
    )

  const [
    addresses,
    setAddresses,
  ] =
    useState([])

  const [
    form,
    setForm,
  ] =
    useState(
      () =>
        createInitialForm(
          currentUser,
        ),
    )

  const addressFormRef = useRef(null)

  const [
    editingAddressId,
    setEditingAddressId,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    saving,
    setSaving,
  ] =
    useState(false)

  const [
    selectingId,
    setSelectingId,
  ] =
    useState('')

  const [
    locationRequested,
    setLocationRequested,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    success,
    setSuccess,
  ] =
    useState('')

  useEffect(
    () => {
      if (
        !checkoutCartId
      ) {
        setDeliveryEta(
          null,
        )

        return undefined
      }

      let active =
        true

      setDeliveryEtaLoading(
        true,
      )

      getMarketplaceCartDeliveryEta(
        checkoutCartId,
      )
        .then(
          (result) => {
            if (
              !active
            ) {
              return
            }

            setDeliveryEta(
              result,
            )

            if (
              result?.available
            ) {
              setDeliveryContext({
                city:
                  result.destination?.city ||
                  '',

                state:
                  result.destination?.state ||
                  '',

                country:
                  result.destination?.country ||
                  'India',

                label:
                  result.destination?.label ||
                  `PIN ${result.destination?.postalCode || ''}`,

                estimatedDeliveryMinutes:
                  result.estimatedDeliveryMinutes,

                estimatedArrivalAt:
                  result.estimatedArrivalAt,

                estimatedRoadDistanceKm:
                  result.estimatedRoadDistanceKm,

                averageSpeedKmh:
                  result.averageSpeedKmh,

                calculationMethod:
                  result.calculationMethod,

                targetPath:
                  `${location.pathname}${location.search}`,
              })
            }
          },
        )
        .catch(
          () => {
            if (
              active
            ) {
              setDeliveryEta(
                null,
              )
            }
          },
        )
        .finally(
          () => {
            if (
              active
            ) {
              setDeliveryEtaLoading(
                false,
              )
            }
          },
        )

      return () => {
        active =
          false
      }
    },
    [
      checkoutCartId,
      location.pathname,
      location.search,
      setDeliveryContext,
    ],
  )

  useEffect(
    () => {
      if (
        !deliveryEta?.estimatedArrivalAt
      ) {
        return undefined
      }

      const intervalId =
        window.setInterval(
          () => {
            setEtaNowMs(
              Date.now(),
            )
          },
          5000,
        )

      return () =>
        window.clearInterval(
          intervalId,
        )
    },
    [
      deliveryEta?.estimatedArrivalAt,
    ],
  )

  const remainingDeliveryMinutes =
    useMemo(() => {
      const arrivalAtMs =
        Date.parse(
          deliveryEta?.estimatedArrivalAt ||
            '',
        )

      if (
        !Number.isFinite(
          arrivalAtMs,
        )
      ) {
        return Number.isFinite(
          deliveryEta?.estimatedDeliveryMinutes,
        )
          ? deliveryEta.estimatedDeliveryMinutes
          : null
      }

      return Math.max(
        0,
        Math.ceil(
          (
            arrivalAtMs -
            etaNowMs
          ) /
            60000,
        ),
      )
    }, [
      deliveryEta?.estimatedArrivalAt,
      deliveryEta?.estimatedDeliveryMinutes,
      etaNowMs,
    ])

  useEffect(
    () => {
      let active =
        true

      async function load() {
        try {
          const result =
            await listDeliveryAddresses()

          if (active) {
            setAddresses(
              Array.isArray(
                result?.addresses,
              )
                ? result.addresses
                : [],
            )
          }
        } catch (
          loadError
        ) {
          if (active) {
            setError(
              getDeliveryAddressErrorMessage(
                loadError,
                'Unable to load saved delivery addresses.',
              ),
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
    [],
  )

  useEffect(
    () => {
      if (
        form.recipientType ===
          'self'
      ) {
        setForm(
          (current) => ({
            ...current,
            recipientName:
              current.recipientName ||
              currentUser?.name ||
              '',
            phone:
              current.phone ||
              currentUser?.phone ||
              '',
          }),
        )
      }
    },
    [
      currentUser?.name,
      currentUser?.phone,
      form.recipientType,
    ],
  )

  useEffect(
    () => {
      if (
        !locationRequested ||
        !currentLocation
      ) {
        return
      }

      setForm(
        (current) => ({
          ...current,
          addressLine1:
            [
              currentLocation.houseNumber,
              currentLocation.road,
            ]
              .filter(
                Boolean,
              )
              .join(' ') ||
            current.addressLine1,
          addressLine2:
            currentLocation.neighbourhood ||
            currentLocation.suburb ||
            current.addressLine2,
          area:
            currentLocation.suburb ||
            currentLocation.neighbourhood ||
            currentLocation.district ||
            current.area,
          city:
            currentLocation.city ||
            current.city,
          state:
            currentLocation.state ||
            current.state,
          postalCode:
            currentLocation.postcode ||
            current.postalCode,
          country:
            currentLocation.country ||
            current.country,
          source:
            'current_location',
        }),
      )
    },
    [
      currentLocation,
      locationRequested,
    ],
  )

  function updateForm(
    key,
    value,
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]:
          value,
        source:
          key ===
            'recipientType' ||
          key ===
            'recipientName' ||
          key ===
            'phone' ||
          key ===
            'label' ||
          key ===
            'customLabel'
            ? current.source
            : 'manual',
      }),
    )
  }

  function handleEditSavedAddress(address) {
    if (saving || selectingId) {
      return
    }

    setEditingAddressId(address.id)
    setLocationRequested(false)
    setForm(createFormFromSavedAddress(address))
    setError('')
    setSuccess('')

    window.requestAnimationFrame(() => {
      addressFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  function handleCancelEdit() {
    setEditingAddressId('')
    setLocationRequested(false)
    setForm(createInitialForm(currentUser))
    setError('')
    setSuccess('')
  }

  function returnAfterSelection() {
    navigate(
      returnTo,
      {
        replace:
          true,

        state: {
          ...location.state,
          resumeRecipeCart:
            true,
          deliveryAddressSaved:
            true,
        },
      },
    )
  }

  async function handleUseSavedAddress(
    address,
  ) {
    if (
      selectingId ||
      saving
    ) {
      return
    }

    setSelectingId(
      address.id,
    )
    setError('')

    try {
      if (
        address.isDefault !==
        true
      ) {
        await setDefaultDeliveryAddress(
          address.id,
        )
      }

      returnAfterSelection()
    } catch (
      selectError
    ) {
      setError(
        getDeliveryAddressErrorMessage(
          selectError,
          'Unable to select this delivery address.',
        ),
      )
    } finally {
      setSelectingId('')
    }
  }

  async function handleSubmit(
    event,
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const existingAddress = editingAddressId
        ? addresses.find((item) => item.id === editingAddressId)
        : null

      if (editingAddressId && !existingAddress) {
        throw new Error('The saved address is no longer available. Please reload and try again.')
      }

      const input = {
        ...form,
        postalCode: String(form.postalCode || '')
          .replace(/\D/g, '')
          .slice(0, 6),
        isDefault: existingAddress ? existingAddress.isDefault === true : true,
      }

      if (existingAddress) {
        const result = await updateDeliveryAddress(existingAddress.id, input)

        setAddresses((current) =>
          current.map((item) =>
            item.id === existingAddress.id ? result.address : item,
          ),
        )
        setForm(createFormFromSavedAddress(result.address))
        setSuccess('Address updated successfully. You can select Deliver here when ready.')
      } else {
        const result = await createDeliveryAddress(input)

        setSuccess(
          returnTo.startsWith('/checkout/')
            ? 'Delivery address saved. Returning to checkout.'
            : 'Delivery address saved. Returning to your Recipe.',
        )

        setAddresses((current) => [
          result.address,
          ...current.filter((item) => item.id !== result.address?.id),
        ])

        window.setTimeout(returnAfterSelection, 450)
      }
    } catch (
      saveError
    ) {
      setError(
        getDeliveryAddressErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100svh-84px)] bg-[#F7F6F2] px-3 pb-12 pt-5 text-[#202421] sm:px-6 lg:pt-7">
      <div className="mx-auto w-full max-w-[1480px]">
        <header className="relative overflow-hidden rounded-[22px] bg-[#C56C42] px-5 py-7 text-white sm:px-8 sm:py-8 lg:px-10">
          <div className="pointer-events-none absolute -right-12 -top-32 h-80 w-80 rounded-full border-[38px] border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 right-[17%] h-20 w-px rotate-[32deg] bg-white/20" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
                <MapPin size={16} aria-hidden="true" />
                Delivery address
              </div>
              <h1 className="max-w-2xl text-[30px] font-extrabold leading-[1.08] tracking-[-0.045em] sm:text-[38px] lg:text-[44px]">
                Where should we deliver?
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-6 text-white/90">
                Select a saved address or add a new one.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 border-l border-white/35 pl-6 lg:flex">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
                <Truck size={23} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold leading-5 text-white/95">
                Your delivery,
                <br />
                your choice.
              </span>
            </div>
          </div>
        </header>

        {checkoutCartId && (
          <section className="mt-3 flex flex-wrap items-center gap-3 border-b border-[#D7DDCF] bg-[#E7EDE8] px-4 py-3 sm:px-6" aria-live="polite">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173F35] text-white">
              <Clock3 size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-[#456459]">Delivery estimate</p>
              <p className="mt-0.5 text-sm font-semibold text-[#173F35] sm:text-base">
                {deliveryEtaLoading
                  ? 'Checking delivery time...'
                  : deliveryEta?.available && Number.isFinite(remainingDeliveryMinutes)
                    ? remainingDeliveryMinutes <= 0
                      ? 'Estimated arrival: now'
                      : `About ${remainingDeliveryMinutes} minutes`
                    : 'Estimate appears when delivery is available.'}
              </p>
            </div>
            {deliveryEta?.available && Number.isFinite(deliveryEta.estimatedRoadDistanceKm) && (
              <span className="rounded-full border border-[#BBCFC1] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#173F35]">
                Approx. {deliveryEta.estimatedRoadDistanceKm} km
              </span>
            )}
          </section>
        )}

        {addresses.length > 0 && (
          <section className="mt-8" aria-label="Saved delivery addresses">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-[#D7DDCF] pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#C56C42]">Your places</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#173F35]">Saved addresses</h2>
              </div>
              <span className="text-sm text-[#5C6961]">Choose one to continue</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-4 sm:p-5 ${
                    editingAddressId === address.id
                      ? 'border-[#C56C42] bg-[#F8E8DF]'
                      : 'border-[#D7DDCF] bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8EDE6] text-[#173F35]">
                      <MapPin size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#202421]">{getAddressTitle(address)}</h3>
                        {address.isDefault && (
                          <span className="rounded-full bg-[#D7DDCF] px-2.5 py-1 text-[11px] font-bold text-[#173F35]">Default</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#35483F]">{address.recipientName}</p>
                      <p className="mt-1 break-words text-sm leading-5 text-[#657067]">
                        {[address.addressLine1, address.addressLine2, address.area, address.city, address.state, address.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E5E9E0] pt-3">
                    <button
                      type="button"
                      onClick={() => handleEditSavedAddress(address)}
                      disabled={Boolean(selectingId) || saving}
                      aria-label={`Edit ${getAddressTitle(address)} address`}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D7DDCF] bg-white px-4 py-2 text-sm font-semibold text-[#173F35] transition hover:bg-[#F2F5EE] disabled:opacity-50"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseSavedAddress(address)}
                      disabled={Boolean(selectingId) || saving}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C56C42] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#B95E36] disabled:opacity-50"
                    >
                      {selectingId === address.id ? 'Selecting...' : 'Deliver here'}
                      {!selectingId && <Check size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section ref={addressFormRef} className="mt-8 scroll-mt-24 overflow-hidden rounded-[20px] border border-[#D7DDCF] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7DDCF] bg-[#E8EDE6] px-5 py-5 sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#C56C42]">
                {editingAddressId ? 'Update your place' : 'New delivery address'}
              </p>
              <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[#173F35] sm:text-[28px]">
                {editingAddressId ? 'Edit address' : 'Add your address'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setLocationRequested(true)
                requestCurrentLocation()
              }}
              disabled={locationStatus === 'requesting'}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#173F35] bg-white px-4 py-2.5 text-sm font-bold text-[#173F35] transition hover:bg-[#F7F6F2] disabled:opacity-50"
            >
              <LocateFixed
                size={18}
                className={locationStatus === 'requesting' ? 'animate-pulse' : ''}
                aria-hidden="true"
              />
              {locationStatus === 'requesting' ? 'Finding location...' : 'Use current location'}
            </button>
          </div>

          {(locationError || (locationRequested && currentLocation)) && (
            <div className="px-5 pt-4 sm:px-8" aria-live="polite">
              {locationError && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  {locationError}
                </p>
              )}
              {locationRequested && currentLocation && (
                <p className="rounded-xl border border-[#D7DDCF] bg-[#F4F6F1] px-4 py-3 text-sm font-medium text-[#173F35]">
                  Location found: {currentLocation.label}. Check the address before saving.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="border-b border-[#E5E9E0] px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4E5DC] text-sm font-extrabold text-[#C56C42]">01</span>
                <div>
                  <h3 className="text-xl font-bold text-[#173F35]">Who's receiving?</h3>
                  <p className="mt-0.5 text-sm text-[#687169]">Choose the recipient.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { value: 'self', label: 'For me', Icon: UserRound },
                  { value: 'other', label: 'Someone else', Icon: UsersRound },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.recipientType === value}
                    onClick={() => updateForm('recipientType', value)}
                    className={`focus-ring flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      form.recipientType === value
                        ? 'border-[#C56C42] bg-[#C56C42] text-white'
                        : 'border-[#D7DDCF] bg-[#F7F6F2] text-[#173F35] hover:border-[#C56C42]'
                    }`}
                  >
                    <span className="flex items-center gap-3 text-base font-bold">
                      <Icon size={20} aria-hidden="true" />
                      {label}
                    </span>
                    {form.recipientType === value && <Check size={18} aria-hidden="true" />}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Recipient name" required>
                  <input
                    required
                    autoComplete="name"
                    value={form.recipientName}
                    onChange={(event) => updateForm('recipientName', event.target.value)}
                    className={inputClassName}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Phone number" required>
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(event) => updateForm('phone', event.target.value)}
                    className={inputClassName}
                    placeholder="Mobile number"
                  />
                </Field>
              </div>
            </div>

            <div className="border-b border-[#E5E9E0] px-5 py-6 sm:px-8 sm:py-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4E5DC] text-sm font-extrabold text-[#C56C42]">02</span>
                <div>
                  <h3 className="text-xl font-bold text-[#173F35]">Delivery location</h3>
                  <p className="mt-0.5 text-sm text-[#687169]">Enter the delivery details.</p>
                </div>
              </div>
              <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Flat / house / building / street" required>
                    <input
                      required
                      autoComplete="address-line1"
                      value={form.addressLine1}
                      onChange={(event) => updateForm('addressLine1', event.target.value)}
                      className={inputClassName}
                      placeholder="Flat, building and street"
                    />
                  </Field>
                </div>
                <Field label="Additional address line">
                  <input
                    autoComplete="address-line2"
                    value={form.addressLine2}
                    onChange={(event) => updateForm('addressLine2', event.target.value)}
                    className={inputClassName}
                    placeholder="Society, block or apartment"
                  />
                </Field>
                <Field label="Area / locality" required>
                  <input
                    required
                    value={form.area}
                    onChange={(event) => updateForm('area', event.target.value)}
                    className={inputClassName}
                    placeholder="Area or neighbourhood"
                  />
                </Field>
                <Field label="Landmark">
                  <input
                    value={form.landmark}
                    onChange={(event) => updateForm('landmark', event.target.value)}
                    className={inputClassName}
                    placeholder="Nearby landmark (optional)"
                  />
                </Field>
                <Field label="City" required>
                  <input
                    required
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(event) => updateForm('city', event.target.value)}
                    className={inputClassName}
                    placeholder="City"
                  />
                </Field>
                <Field label="State" required>
                  <input
                    required
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={(event) => updateForm('state', event.target.value)}
                    className={inputClassName}
                    placeholder="State"
                  />
                </Field>
                <Field label="PIN code" required>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    value={form.postalCode}
                    onChange={(event) => updateForm('postalCode', event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={inputClassName}
                    placeholder="6-digit PIN"
                  />
                </Field>
                <Field label="Country" required>
                  <input
                    required
                    autoComplete="country-name"
                    value={form.country}
                    onChange={(event) => updateForm('country', event.target.value)}
                    className={inputClassName}
                    placeholder="Country"
                  />
                </Field>
              </div>
            </div>

            <div className="bg-[#F3F5F0] px-5 py-6 sm:px-8 sm:py-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4E5DC] text-sm font-extrabold text-[#C56C42]">03</span>
                <div>
                  <h3 className="text-xl font-bold text-[#173F35]">Save this place</h3>
                  <p className="mt-0.5 text-sm text-[#687169]">Label it for next time.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ADDRESS_LABELS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.label === value}
                    onClick={() => updateForm('label', value)}
                    className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      form.label === value
                        ? 'border-[#173F35] bg-[#173F35] text-white'
                        : 'border-[#D7DDCF] bg-white text-[#173F35] hover:border-[#C56C42]'
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              {form.label === 'other' && (
                <div className="mt-4 max-w-md">
                  <Field label="Custom label" required>
                    <input
                      required
                      value={form.customLabel}
                      onChange={(event) => updateForm('customLabel', event.target.value)}
                      className={inputClassName}
                      placeholder="e.g. Parents, Studio"
                    />
                  </Field>
                </div>
              )}
              <div className="mt-5">
                <Field label="Delivery instructions (optional)">
                  <textarea
                    rows={2}
                    value={form.deliveryInstructions}
                    onChange={(event) => updateForm('deliveryInstructions', event.target.value)}
                    className={inputClassName}
                    placeholder="Gate number, floor, call on arrival..."
                  />
                </Field>
              </div>
            </div>

            {(error || success) && (
              <div className="space-y-3 border-t border-[#D7DDCF] px-5 pt-5 sm:px-8" aria-live="polite">
                {error && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="flex items-center gap-2 rounded-xl border border-[#D7DDCF] bg-[#E8EDE6] px-4 py-3 text-sm font-semibold text-[#173F35]">
                    <Check size={18} aria-hidden="true" />
                    {success}
                  </p>
                )}
              </div>
            )}
            <footer className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-[#D7DDCF] bg-[#F3F5F0] px-5 py-5 sm:flex-row sm:items-center sm:px-8">
              <button
                type="button"
                onClick={() => {
                  if (editingAddressId) {
                    handleCancelEdit()
                  } else {
                    navigate(returnTo)
                  }
                }}
                className="focus-ring min-h-12 rounded-xl border border-[#CBD4C6] bg-white px-5 py-3 text-sm font-bold text-[#173F35] transition hover:bg-[#E8EDE6]"
              >
                {editingAddressId ? 'Cancel editing' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C56C42] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#B75F38] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={18} aria-hidden="true" />
                {saving ? 'Saving address...' : editingAddressId ? 'Save changes' : 'Save & deliver here'}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  )
}
