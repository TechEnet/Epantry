import {
  Camera,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Save,
  UserRound,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

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

const inputClassName =
  'focus-ring w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-950 outline-none transition focus:border-emerald-500'

const ADDRESS_LABELS = [
  'home',
  'office',
  'family',
  'friend',
  'other',
]

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

  if (loading) {
    return (
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="rounded-[24px] border border-stone-200 bg-white p-6 text-sm font-bold text-stone-500 shadow-sm">
          Loading your profile…
        </div>
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
