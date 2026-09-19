import {
  Building2,
  Check,
  HeartHandshake,
  Home,
  LocateFixed,
  MapPin,
  Save,
  Tag,
  UserRound,
  UsersRound,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
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
  createDeliveryAddress,
  getDeliveryAddressErrorMessage,
  listDeliveryAddresses,
  setDefaultDeliveryAddress,
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

function Field({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.11em] text-stone-500">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

const inputClassName =
  'focus-ring w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-950 outline-none transition focus:border-emerald-500'

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
      const result =
        await createDeliveryAddress({
          ...form,
          postalCode:
            String(
              form.postalCode ||
                '',
            )
              .replace(
                /\D/g,
                '',
              )
              .slice(
                0,
                6,
              ),
          isDefault:
            true,
        })

      setSuccess(
        returnTo.startsWith(
          '/checkout/',
        )
          ? 'Delivery address saved. Returning to checkout.'
          : 'Delivery address saved. Returning to your Recipe.',
      )

      setAddresses(
        (current) => [
          result.address,
          ...current.filter(
            (item) =>
              item.id !==
              result.address?.id,
          ),
        ],
      )

      window.setTimeout(
        returnAfterSelection,
        450,
      )
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
    <main className="min-h-screen bg-[#f7f5ef] pb-8 pt-0 sm:pb-10 sm:pt-0">
      <div className="page-shell max-w-5xl">
        <div className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
          <header className="border-b border-stone-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white">
                <MapPin
                  size={23}
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Delivery address
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">
                  Where should we deliver?
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  {returnTo.startsWith(
                    '/checkout/',
                  )
                    ? 'Choose the address EPANTRY should lock to this order before payment.'
                    : 'EPANTRY needs a delivery address before a missing Recipe ingredient can enter the Marketplace cart flow.'}
                </p>
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-8">
            {addresses.length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                      Saved addresses
                    </p>
                    <h2 className="mt-1 text-xl font-black text-stone-950">
                      Choose an existing address
                    </h2>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {addresses.map(
                    (address) => (
                      <button
                        key={
                          address.id
                        }
                        type="button"
                        onClick={() =>
                          handleUseSavedAddress(
                            address,
                          )
                        }
                        disabled={
                          Boolean(
                            selectingId,
                          ) ||
                          saving
                        }
                        className="focus-ring rounded-2xl border border-stone-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:opacity-60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-stone-950">
                              {getAddressTitle(
                                address,
                              )}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-700">
                              {address.recipientName}
                            </p>
                          </div>

                          {address.isDefault && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-800">
                              Default
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-xs leading-5 text-stone-500">
                          {[
                            address.addressLine1,
                            address.area,
                            address.city,
                            address.state,
                            address.postalCode,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(', ')}
                        </p>

                        <p className="mt-3 text-xs font-black text-emerald-700">
                          {selectingId ===
                          address.id
                            ? 'Selecting...'
                            : 'Deliver here →'}
                        </p>
                      </button>
                    ),
                  )}
                </div>

                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                    or add another
                  </span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>
              </section>
            )}

            <section>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                    Address details
                  </p>
                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    Add a delivery location
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLocationRequested(
                      true,
                    )
                    requestCurrentLocation()
                  }}
                  disabled={
                    locationStatus ===
                    'requesting'
                  }
                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  <LocateFixed
                    size={17}
                    className={
                      locationStatus ===
                      'requesting'
                        ? 'animate-pulse'
                        : ''
                    }
                    aria-hidden="true"
                  />
                  {locationStatus ===
                  'requesting'
                    ? 'Finding location...'
                    : 'Use my current location'}
                </button>
              </div>

              {locationError && (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  {locationError}
                </p>
              )}

              {locationRequested &&
              currentLocation && (
                <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  Location found: {currentLocation.label}. Please verify the address fields before saving.
                </p>
              )}

              <form
                onSubmit={
                  handleSubmit
                }
                className="mt-6 space-y-6"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.11em] text-stone-500">
                    Who is this order for?
                  </p>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value:
                          'self',
                        label:
                          'For me',
                        hint:
                          'I am receiving this order',
                        Icon:
                          UserRound,
                      },
                      {
                        value:
                          'other',
                        label:
                          'Someone else',
                        hint:
                          'Deliver to another person',
                        Icon:
                          UsersRound,
                      },
                    ].map(
                      ({
                        value,
                        label,
                        hint,
                        Icon,
                      }) => (
                        <button
                          key={
                            value
                          }
                          type="button"
                          onClick={() =>
                            updateForm(
                              'recipientType',
                              value,
                            )
                          }
                          className={`focus-ring flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                            form.recipientType ===
                            value
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <Icon
                            size={20}
                            className="text-emerald-700"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="block text-sm font-black text-stone-950">
                              {label}
                            </span>
                            <span className="mt-0.5 block text-xs text-stone-500">
                              {hint}
                            </span>
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Recipient name"
                    required
                  >
                    <input
                      required
                      value={
                        form.recipientName
                      }
                      onChange={(event) =>
                        updateForm(
                          'recipientName',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Full name"
                    />
                  </Field>

                  <Field
                    label="Phone number"
                    required
                  >
                    <input
                      required
                      type="tel"
                      value={
                        form.phone
                      }
                      onChange={(event) =>
                        updateForm(
                          'phone',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="9876543210"
                    />
                  </Field>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.11em] text-stone-500">
                    Save address as
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ADDRESS_LABELS.map(
                      ({
                        value,
                        label,
                        icon:
                          Icon,
                      }) => (
                        <button
                          key={
                            value
                          }
                          type="button"
                          onClick={() =>
                            updateForm(
                              'label',
                              value,
                            )
                          }
                          className={`focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black transition ${
                            form.label ===
                            value
                              ? 'border-stone-950 bg-stone-950 text-white'
                              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <Icon
                            size={14}
                            aria-hidden="true"
                          />
                          {label}
                        </button>
                      ),
                    )}
                  </div>

                  {form.label ===
                    'other' && (
                    <div className="mt-3 max-w-sm">
                      <Field
                        label="Custom label"
                        required
                      >
                        <input
                          required
                          value={
                            form.customLabel
                          }
                          onChange={(event) =>
                            updateForm(
                              'customLabel',
                              event.target.value,
                            )
                          }
                          className={
                            inputClassName
                          }
                          placeholder="e.g. Parents, Studio"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Flat / house / building / street"
                    required
                  >
                    <input
                      required
                      value={
                        form.addressLine1
                      }
                      onChange={(event) =>
                        updateForm(
                          'addressLine1',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Flat 402, Tower B"
                    />
                  </Field>

                  <Field label="Additional address line">
                    <input
                      value={
                        form.addressLine2
                      }
                      onChange={(event) =>
                        updateForm(
                          'addressLine2',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Street / society / block"
                    />
                  </Field>

                  <Field
                    label="Area / locality"
                    required
                  >
                    <input
                      required
                      value={
                        form.area
                      }
                      onChange={(event) =>
                        updateForm(
                          'area',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Sector 62"
                    />
                  </Field>

                  <Field label="Landmark">
                    <input
                      value={
                        form.landmark
                      }
                      onChange={(event) =>
                        updateForm(
                          'landmark',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Near metro station"
                    />
                  </Field>

                  <Field
                    label="City"
                    required
                  >
                    <input
                      required
                      value={
                        form.city
                      }
                      onChange={(event) =>
                        updateForm(
                          'city',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Noida"
                    />
                  </Field>

                  <Field
                    label="State"
                    required
                  >
                    <input
                      required
                      value={
                        form.state
                      }
                      onChange={(event) =>
                        updateForm(
                          'state',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="Uttar Pradesh"
                    />
                  </Field>

                  <Field
                    label="Postal code"
                    required
                  >
                    <input
                      required
                      inputMode="numeric"
                      maxLength={6}
                      value={
                        form.postalCode
                      }
                      onChange={(event) =>
                        updateForm(
                          'postalCode',
                          event.target.value
                            .replace(
                              /\D/g,
                              '',
                            )
                            .slice(
                              0,
                              6,
                            ),
                        )
                      }
                      className={
                        inputClassName
                      }
                      placeholder="201301"
                    />
                  </Field>

                  <Field
                    label="Country"
                    required
                  >
                    <input
                      required
                      value={
                        form.country
                      }
                      onChange={(event) =>
                        updateForm(
                          'country',
                          event.target.value,
                        )
                      }
                      className={
                        inputClassName
                      }
                    />
                  </Field>
                </div>

                <Field label="Delivery instructions">
                  <textarea
                    rows={3}
                    value={
                      form.deliveryInstructions
                    }
                    onChange={(event) =>
                      updateForm(
                        'deliveryInstructions',
                        event.target.value,
                      )
                    }
                    className={
                      inputClassName
                    }
                    placeholder="Gate number, floor, call on arrival, etc."
                  />
                </Field>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"
                  >
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                    <Check
                      size={17}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    {success}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        returnTo,
                      )
                    }
                    className="focus-ring rounded-2xl border border-stone-200 px-5 py-3 text-sm font-black text-stone-700 hover:bg-stone-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      loading
                    }
                    className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <Save
                      size={17}
                      aria-hidden="true"
                    />
                    {saving
                      ? 'Saving address...'
                      : 'Save & deliver here'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
