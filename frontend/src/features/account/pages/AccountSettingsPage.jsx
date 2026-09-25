import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Camera,
  Check,
  CircleAlert,
  Home,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  useHousehold,
} from '../../households/context/HouseholdContext'

import {
  getAccountConsents,
  getAccountPreferences,
  getAccountProfile,
  recordAccountConsent,
  updateAccountPreferences,
  updateAccountProfile,
  uploadAccountProfilePhoto,
} from '../services/account.service'

import {
  createDeliveryAddress,
  getDeliveryAddressErrorMessage,
  listDeliveryAddresses,
  updateDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

const DIETARY_OPTIONS = [
  {
    value:
      'vegetarian',

    label:
      'Vegetarian',
  },

  {
    value:
      'vegan',

    label:
      'Vegan',
  },

  {
    value:
      'pescatarian',

    label:
      'Pescatarian',
  },

  {
    value:
      'halal',

    label:
      'Halal',
  },

  {
    value:
      'kosher',

    label:
      'Kosher',
  },

  {
    value:
      'gluten_free',

    label:
      'Gluten free',
  },

  {
    value:
      'dairy_free',

    label:
      'Dairy free',
  },
]

const ALLERGEN_OPTIONS = [
  {
    value:
      'milk',

    label:
      'Milk',
  },

  {
    value:
      'egg',

    label:
      'Egg',
  },

  {
    value:
      'fish',

    label:
      'Fish',
  },

  {
    value:
      'shellfish',

    label:
      'Shellfish',
  },

  {
    value:
      'tree_nuts',

    label:
      'Tree nuts',
  },

  {
    value:
      'peanuts',

    label:
      'Peanuts',
  },

  {
    value:
      'wheat',

    label:
      'Wheat',
  },

  {
    value:
      'soy',

    label:
      'Soy',
  },

  {
    value:
      'sesame',

    label:
      'Sesame',
  },
]

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
    id: address?.id || '',
    recipientType: address?.recipientType || 'self',
    recipientName: address?.recipientName || profile?.name || '',
    phone: address?.phone || profile?.phone || '',
    label: address?.label || 'home',
    customLabel: address?.customLabel || '',
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    area: address?.area || '',
    landmark: address?.landmark || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'India',
    deliveryInstructions: address?.deliveryInstructions || '',
    source: address?.source || 'manual',
    isDefault: address?.isDefault === true,
  }
}

function formatAddressTitle(
  address,
) {
  if (
    address?.label ===
    'other'
  ) {
    return address.customLabel || 'Other'
  }

  const value = String(
    address?.label || 'Address',
  )

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  )
}

const LOCALE_OPTIONS = [
  {
    value:
      'en-IN',

    label:
      'English — India',
  },

  {
    value:
      'hi-IN',

    label:
      'Hindi — India',
  },

  {
    value:
      'en-GB',

    label:
      'English — United Kingdom',
  },

  {
    value:
      'en-US',

    label:
      'English — United States',
  },
]

function splitCommaList(
  value,
) {
  return String(
    value ||
      '',
  )
    .split(',')
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean)
}

function formatConsentName(
  type,
) {
  switch (
    type
  ) {
    case 'terms_of_service':
      return 'Terms of Service'

    case 'privacy_policy':
      return 'Privacy Policy'

    case 'marketing_email':
      return 'Marketing Email'

    case 'personalization':
      return 'Personalization'

    default:
      return type
  }
}

function ConsentStatus({
  granted,
}) {
  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'gap-1.5',
        'rounded-full',
        'px-2.5',
        'py-1',
        'text-xs',
        'font-black',

        granted
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-stone-100 text-stone-600',
      ].join(
        ' ',
      )}
    >

      {granted && (
        <Check
          size={13}
          aria-hidden="true"
        />
      )}

      {granted
        ? 'Accepted'
        : 'Not accepted'}

    </span>
  )
}

export default function AccountSettingsPage() {
  const {
    refreshSession,
  } = useAuth()

  const {
    household,

    hasHousehold,

    isLoadingHousehold,
  } = useHousehold()

  const [
    profile,
    setProfile,
  ] = useState(null)

  const [
    profileForm,
    setProfileForm,
  ] = useState({
    name:
      '',

    phone:
      '',
  })

  const [
    addresses,
    setAddresses,
  ] = useState([])

  const [
    addressForm,
    setAddressForm,
  ] = useState(null)

  const [
    preferenceForm,
    setPreferenceForm,
  ] = useState({
    dietaryLifestyles:
      [],

    allergens:
      [],

    preferredCuisines:
      '',

    dislikedIngredients:
      '',

    measurementSystem:
      'metric',

    locale:
      'en-IN',

    personalizationEnabled:
      false,
  })

  const [
    consents,
    setConsents,
  ] = useState(null)

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    isSavingProfile,
    setIsSavingProfile,
  ] = useState(false)

  const [
    isUploadingPhoto,
    setIsUploadingPhoto,
  ] = useState(false)

  const [
    isSavingAddress,
    setIsSavingAddress,
  ] = useState(false)

  const [
    isSavingPreferences,
    setIsSavingPreferences,
  ] = useState(false)

  const [
    activeConsentType,
    setActiveConsentType,
  ] = useState('')

  const [
    pageError,
    setPageError,
  ] = useState('')

  const [
    profileMessage,
    setProfileMessage,
  ] = useState('')

  const [
    preferenceMessage,
    setPreferenceMessage,
  ] = useState('')

  const [
    addressMessage,
    setAddressMessage,
  ] = useState('')

  /*
  |--------------------------------------------------------------------------
  | Consent Lookup
  |--------------------------------------------------------------------------
  */

  const consentByType =
    useMemo(
      () =>
        new Map(
          (
            consents?.items ||
            []
          ).map(
            (item) => [
              item.consentType,
              item,
            ],
          ),
        ),
      [
        consents,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Apply Preference Data
  |--------------------------------------------------------------------------
  */

  const applyPreferences =
    (
      preferences,
    ) => {
      setPreferenceForm({
        dietaryLifestyles:
          Array.isArray(
            preferences
              ?.dietaryLifestyles,
          )
            ? preferences
                .dietaryLifestyles
            : [],

        allergens:
          Array.isArray(
            preferences
              ?.allergens,
          )
            ? preferences
                .allergens
            : [],

        preferredCuisines:
          (
            preferences
              ?.preferredCuisines ||
            []
          ).join(
            ', ',
          ),

        dislikedIngredients:
          (
            preferences
              ?.dislikedIngredients ||
            []
          ).join(
            ', ',
          ),

        measurementSystem:
          preferences
            ?.measurementSystem ||
          'metric',

        locale:
          preferences
            ?.locale ||
          'en-IN',

        personalizationEnabled:
          preferences
            ?.personalizationEnabled ===
          true,
      })
    }

  /*
  |--------------------------------------------------------------------------
  | Initial Load
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let isActive =
      true

    const load =
      async () => {
        setIsLoading(
          true,
        )

        setPageError('')

        try {
          const [
            nextProfile,
            nextPreferences,
            nextConsents,
            nextAddresses,
          ] =
            await Promise.all([
              getAccountProfile(),

              getAccountPreferences(),

              getAccountConsents(),

              listDeliveryAddresses(),
            ])

          if (!isActive) {
            return
          }

          setProfile(
            nextProfile,
          )

          setProfileForm({
            name:
              nextProfile
                ?.name ||
              '',

            phone:
              nextProfile
                ?.phone ||
              '',
          })

          applyPreferences(
            nextPreferences,
          )

          setConsents(
            nextConsents,
          )

          setAddresses(
            Array.isArray(
              nextAddresses?.addresses,
            )
              ? nextAddresses.addresses
              : [],
          )
        } catch (error) {
          if (!isActive) {
            return
          }

          setPageError(
            error?.message ||
              'Unable to load account settings.',
          )
        } finally {
          if (isActive) {
            setIsLoading(
              false,
            )
          }
        }
      }

    void load()

    return () => {
      isActive =
        false
    }
  }, [])

  /*
  |--------------------------------------------------------------------------
  | Profile
  |--------------------------------------------------------------------------
  */

  const handleProfileSave =
    async (
      event,
    ) => {
      event.preventDefault()

      setIsSavingProfile(
        true,
      )

      setProfileMessage('')

      setPageError('')

      try {
        const updatedProfile =
          await updateAccountProfile({
            name:
              profileForm
                .name,

            phone:
              profileForm
                .phone,
          })

        setProfile(
          updatedProfile,
        )

        setProfileForm({
          name:
            updatedProfile
              ?.name ||
            '',

          phone:
            updatedProfile
              ?.phone ||
            '',
        })

        /*
        |--------------------------------------------------------------------------
        | Refresh AuthContext User
        |--------------------------------------------------------------------------
        |
        | Navbar and other identity UI can immediately reflect a changed name.
        |
        */

        await refreshSession()

        setProfileMessage(
          'Profile updated successfully.',
        )
      } catch (error) {
        setPageError(
          error?.message ||
            'Unable to update profile.',
        )
      } finally {
        setIsSavingProfile(
          false,
        )
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Profile Photo + Delivery Addresses
  |--------------------------------------------------------------------------
  */

  const handlePhotoChange =
    async (
      event,
    ) => {
      const file =
        event.target.files?.[0]

      event.target.value =
        ''

      if (!file) {
        return
      }

      setIsUploadingPhoto(
        true,
      )

      setProfileMessage('')
      setPageError('')

      try {
        const uploaded =
          await uploadAccountProfilePhoto(
            file,
          )

        const updatedProfile =
          await updateAccountProfile({
            profilePhotoUrl:
              uploaded.profilePhotoUrl,
          })

        setProfile(
          updatedProfile,
        )

        await refreshSession()

        setProfileMessage(
          'Profile photo updated successfully.',
        )
      } catch (error) {
        setPageError(
          error?.message ||
            'Unable to update profile photo.',
        )
      } finally {
        setIsUploadingPhoto(
          false,
        )
      }
    }

  const reloadAddresses =
    async () => {
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

  const beginAddAddress =
    () => {
      setPageError('')
      setAddressMessage('')
      setAddressForm(
        getInitialAddressForm(
          profile,
        ),
      )
    }

  const beginEditAddress =
    (
      address,
    ) => {
      setPageError('')
      setAddressMessage('')
      setAddressForm(
        getInitialAddressForm(
          profile,
          address,
        ),
      )
    }

  const updateAddressField =
    (
      field,
      value,
    ) => {
      setAddressForm(
        (
          current,
        ) => ({
          ...current,
          [field]: value,
        }),
      )
    }

  const handleAddressSubmit =
    async (
      event,
    ) => {
      event.preventDefault()

      if (!addressForm) {
        return
      }

      setIsSavingAddress(
        true,
      )
      setPageError('')
      setAddressMessage('')

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
            : addresses.length === 0,
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

        await reloadAddresses()

        setAddressForm(
          null,
        )

        setAddressMessage(
          addressForm.id
            ? 'Address updated successfully.'
            : 'Address added successfully.',
        )
      } catch (error) {
        setPageError(
          getDeliveryAddressErrorMessage(
            error,
            'Unable to save this address.',
          ),
        )
      } finally {
        setIsSavingAddress(
          false,
        )
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Preference Checkbox
  |--------------------------------------------------------------------------
  */

  const togglePreferenceValue =
    (
      key,
      value,
    ) => {
      setPreferenceForm(
        (
          current,
        ) => {
          const values =
            Array.isArray(
              current[key],
            )
              ? current[key]
              : []

          const exists =
            values.includes(
              value,
            )

          return {
            ...current,

            [key]:
              exists
                ? values.filter(
                    (item) =>
                      item !==
                      value,
                  )
                : [
                    ...values,
                    value,
                  ],
          }
        },
      )

      setPreferenceMessage('')
    }

  /*
  |--------------------------------------------------------------------------
  | Save Preferences
  |--------------------------------------------------------------------------
  */

  const handlePreferencesSave =
    async (
      event,
    ) => {
      event.preventDefault()

      setIsSavingPreferences(
        true,
      )

      setPreferenceMessage('')

      setPageError('')

      try {
        const preferences =
          await updateAccountPreferences({
            dietaryLifestyles:
              preferenceForm
                .dietaryLifestyles,

            allergens:
              preferenceForm
                .allergens,

            preferredCuisines:
              splitCommaList(
                preferenceForm
                  .preferredCuisines,
              ),

            dislikedIngredients:
              splitCommaList(
                preferenceForm
                  .dislikedIngredients,
              ),

            measurementSystem:
              preferenceForm
                .measurementSystem,

            locale:
              preferenceForm
                .locale,
          })

        applyPreferences(
          preferences,
        )

        setPreferenceMessage(
          'Preferences updated successfully.',
        )
      } catch (error) {
        setPageError(
          error?.message ||
            'Unable to update preferences.',
        )
      } finally {
        setIsSavingPreferences(
          false,
        )
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Consent Decision
  |--------------------------------------------------------------------------
  */

  const handleConsentDecision =
    async (
      consentType,
      decision,
    ) => {
      setActiveConsentType(
        consentType,
      )

      setPageError('')

      try {
        const nextConsents =
          await recordAccountConsent({
            consentType,

            decision,
          })

        setConsents(
          nextConsents,
        )

        /*
        |--------------------------------------------------------------------------
        | Personalization Consent Also Changes Preference Runtime Flag
        |--------------------------------------------------------------------------
        */

        if (
          consentType ===
          'personalization'
        ) {
          const nextPreferences =
            await getAccountPreferences()

          applyPreferences(
            nextPreferences,
          )
        }
      } catch (error) {
        setPageError(
          error?.message ||
            'Unable to update consent.',
        )
      } finally {
        setActiveConsentType('')
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (
    isLoading
  ) {
    return (
      <main className="w-full px-4 pb-8 pt-0 sm:px-6 lg:px-8">

        <div className="flex min-h-[360px] items-center justify-center">

          <div className="text-center">

            <LoaderCircle
              size={30}
              className="mx-auto animate-spin text-emerald-700"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-bold text-stone-600">
              Loading account settings...
            </p>

          </div>

        </div>

      </main>
    )
  }

  return (
    <main className="w-full px-3 pb-5 pt-3 sm:px-6 sm:pb-10 sm:pt-5 lg:px-8 lg:pb-12">

      <div className="w-full max-w-none">


        {/* =========================================================
            HEADER
        ========================================================= */}

        <div>

          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 sm:text-xs sm:tracking-[0.18em]">
            Account
          </p>

          <h1 className="mt-1.5 text-[24px] font-black tracking-tight text-stone-950 sm:mt-3 sm:text-4xl">
            Profile & preferences
          </h1>

          <p className="hidden mt-3 max-w-3xl text-sm leading-7 text-stone-600 sm:block">
            Manage your EPANTRY identity, food preferences and consent settings.
          </p>

        </div>


        {/* =========================================================
            GLOBAL ERROR
        ========================================================= */}

        {pageError && (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
            role="alert"
          >

            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <p className="text-sm font-semibold leading-6">
              {pageError}
            </p>

          </div>
        )}


        {/* =========================================================
            PROFILE
        ========================================================= */}

        <section className="mt-4 rounded-[1.5rem] border border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-emerald-50/40 p-3.5 shadow-lg shadow-stone-900/5 sm:mt-8 sm:rounded-[2rem] sm:border-stone-200 sm:bg-white sm:p-8 sm:shadow-xl">

          <div className="flex items-center gap-3 sm:items-start sm:gap-4">

            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 sm:size-11 sm:rounded-2xl">

              <UserRound
                size={21}
                aria-hidden="true"
              />

            </div>

            <div>

              <h2 className="text-[19px] font-black text-stone-950 sm:text-2xl">
                Profile
              </h2>

              <p className="hidden mt-1 text-sm leading-6 text-stone-500 sm:block">
                Your basic EPANTRY account identity.
              </p>

            </div>

          </div>


          <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-emerald-100 bg-white/80 p-3 sm:mt-7 sm:flex sm:flex-row sm:gap-4 sm:border-stone-200 sm:bg-stone-50 sm:p-4">

            <div className="relative w-fit shrink-0">
              {profile?.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt="Profile"
                  className="h-14 w-14 rounded-full border-3 border-white object-cover shadow-sm sm:h-20 sm:w-20 sm:border-4"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-full border-3 border-white bg-emerald-700 text-lg font-black text-white shadow-sm sm:h-20 sm:w-20 sm:border-4 sm:text-2xl">
                  {String(
                    profile?.name || 'E',
                  )
                    .trim()
                    .charAt(0)
                    .toUpperCase() || 'E'}
                </div>
              )}

              <label className="focus-ring absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-stone-50 bg-stone-950 text-white transition hover:bg-emerald-700 sm:h-9 sm:w-9 sm:border-4">
                <Camera
                  size={15}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  Change profile photo
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isUploadingPhoto}
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            <div className="min-w-0">
              <div className="sm:hidden">
                <label
                  htmlFor="account-name-mobile"
                  className="mb-1 block text-[10px] font-black uppercase tracking-[0.08em] text-stone-600"
                >
                  Name
                </label>
                <input
                  id="account-name-mobile"
                  type="text"
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="focus-ring min-h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[12px] font-bold"
                />
                <p className="mt-1 text-[9px] font-semibold text-stone-400">
                  {isUploadingPhoto ? 'Uploading photo...' : 'Tap photo to change'}
                </p>
              </div>

              <div className="hidden sm:block">
                <p className="font-black text-stone-950">
                  Profile photo
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {isUploadingPhoto
                    ? 'Uploading photo...'
                    : 'JPEG, PNG or WebP.'}
                </p>
              </div>
            </div>

          </div>

          <form
            onSubmit={
              handleProfileSave
            }
            className="mt-3 grid grid-cols-2 gap-3 sm:mt-7 sm:gap-5"
          >

            <div className="hidden sm:block">

              <label
                htmlFor="account-name"
                className="mb-2 block text-sm font-bold text-stone-800"
              >
                Name
              </label>

              <input
                id="account-name"
                type="text"
                value={
                  profileForm.name
                }
                onChange={(
                  event,
                ) =>
                  setProfileForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      name:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-semibold"
              />

            </div>


            <div>

              <label
                htmlFor="account-phone"
                className="mb-1 block text-[10px] font-black uppercase tracking-[0.08em] text-stone-600 sm:mb-2 sm:text-sm sm:font-bold sm:normal-case sm:tracking-normal sm:text-stone-800"
              >
                Phone
              </label>

              <input
                id="account-phone"
                type="tel"
                value={
                  profileForm.phone
                }
                onChange={(
                  event,
                ) =>
                  setProfileForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      phone:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="focus-ring min-h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[11px] font-semibold sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-sm"
                placeholder="+91 98765 43210"
              />

              {profile
                ?.phoneVerified && (
                <p className="mt-2 text-xs font-bold text-emerald-700">
                  Verified phone
                </p>
              )}

            </div>


            <div className="min-w-0 sm:col-span-2">

              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.08em] text-stone-600 sm:mb-2 sm:text-sm sm:font-bold sm:normal-case sm:tracking-normal sm:text-stone-800">
                Email
              </p>

              <div className="min-h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">

                <p className="truncate text-[11px] font-black text-stone-900 sm:text-sm">
                  {profile?.email}
                </p>

                <p className="hidden mt-1 text-xs leading-5 text-stone-500 sm:block">
                  Firebase identity email cannot be changed from this basic profile form.
                </p>

              </div>

            </div>


            <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:gap-3">

              <button
                type="submit"
                disabled={
                  isSavingProfile
                }
                className="focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-[11px] font-black text-white disabled:opacity-50 sm:min-h-11 sm:gap-2 sm:bg-stone-950 sm:px-5 sm:text-sm"
              >

                {isSavingProfile ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save
                    size={17}
                    aria-hidden="true"
                  />
                )}

                Save profile

              </button>

              {profileMessage && (
                <p className="text-sm font-bold text-emerald-700">
                  {profileMessage}
                </p>
              )}

            </div>

          </form>

        </section>


        {/* =========================================================
            SAVED ADDRESSES
        ========================================================= */}

        <section className="mt-4 rounded-[1.5rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-sky-50/40 p-3.5 shadow-lg shadow-stone-900/5 sm:mt-8 sm:rounded-[2rem] sm:border-stone-200 sm:bg-white sm:p-8 sm:shadow-xl">

          <div className="flex items-center justify-between gap-3 sm:items-start">

            <div className="flex items-center gap-3 sm:items-start sm:gap-4">

              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 sm:size-11 sm:rounded-2xl sm:bg-emerald-100 sm:text-emerald-700">
                <MapPin
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-[19px] font-black text-stone-950 sm:text-2xl">
                  Saved addresses
                </h2>
                <p className="hidden mt-1 text-sm leading-6 text-stone-500 sm:block">
                  Add a delivery address or edit an existing one.
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={beginAddAddress}
              className="focus-ring hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-black text-white transition hover:bg-emerald-700 sm:inline-flex"
            >
              <Plus
                size={16}
                aria-hidden="true"
              />
              Add address
            </button>

          </div>

          {addressMessage && (
            <p className="mt-5 text-sm font-bold text-emerald-700">
              {addressMessage}
            </p>
          )}

          <div className="mt-3 grid gap-2.5 sm:mt-6 sm:gap-3 sm:grid-cols-2">
            {addresses.length > 0 ? (
              addresses.map(
                (
                  address,
                ) => (
                  <article
                    key={address.id}
                    className="rounded-2xl border border-sky-100 bg-white/80 p-3 sm:border-stone-200 sm:bg-stone-50 sm:p-4"
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
              <div className="sm:col-span-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm font-semibold text-stone-500">
                No delivery address saved yet.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={beginAddAddress}
            className="focus-ring mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-100/80 px-3 text-[11px] font-black text-sky-900 sm:hidden"
          >
            <Plus size={14} aria-hidden="true" />
            Add address
          </button>

          {addressForm ? (
            <form
              onSubmit={handleAddressSubmit}
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5"
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

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Recipient name
                  </label>
                  <input
                    value={addressForm.recipientName}
                    onChange={(event) =>
                      updateAddressField(
                        'recipientName',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Recipient phone
                  </label>
                  <input
                    value={addressForm.phone}
                    onChange={(event) =>
                      updateAddressField(
                        'phone',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                    inputMode="tel"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Label
                  </label>
                  <select
                    value={addressForm.label}
                    onChange={(event) =>
                      updateAddressField(
                        'label',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                  >
                    {ADDRESS_LABELS.map(
                      (
                        label,
                      ) => (
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
                </div>

                {addressForm.label === 'other' ? (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-stone-800">
                      Custom label
                    </label>
                    <input
                      value={addressForm.customLabel}
                      onChange={(event) =>
                        updateAddressField(
                          'customLabel',
                          event.target.value,
                        )
                      }
                      className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                      required
                    />
                  </div>
                ) : null}

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Address line 1
                  </label>
                  <input
                    value={addressForm.addressLine1}
                    onChange={(event) =>
                      updateAddressField(
                        'addressLine1',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Address line 2
                  </label>
                  <input
                    value={addressForm.addressLine2}
                    onChange={(event) =>
                      updateAddressField(
                        'addressLine2',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Area / locality
                  </label>
                  <input
                    value={addressForm.area}
                    onChange={(event) =>
                      updateAddressField(
                        'area',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Landmark
                  </label>
                  <input
                    value={addressForm.landmark}
                    onChange={(event) =>
                      updateAddressField(
                        'landmark',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    City
                  </label>
                  <input
                    value={addressForm.city}
                    onChange={(event) =>
                      updateAddressField(
                        'city',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    State
                  </label>
                  <input
                    value={addressForm.state}
                    onChange={(event) =>
                      updateAddressField(
                        'state',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Pincode
                  </label>
                  <input
                    value={addressForm.postalCode}
                    onChange={(event) =>
                      updateAddressField(
                        'postalCode',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Country
                  </label>
                  <input
                    value={addressForm.country}
                    onChange={(event) =>
                      updateAddressField(
                        'country',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-stone-800">
                    Delivery instructions
                  </label>
                  <textarea
                    value={addressForm.deliveryInstructions}
                    onChange={(event) =>
                      updateAddressField(
                        'deliveryInstructions',
                        event.target.value,
                      )
                    }
                    className="focus-ring min-h-24 w-full resize-y rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold"
                    maxLength={240}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-50"
                >
                  {isSavingAddress ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save
                      size={16}
                      aria-hidden="true"
                    />
                  )}
                  {addressForm.id
                    ? 'Save address'
                    : 'Add address'}
                </button>
              </div>
            </form>
          ) : null}

        </section>


        {/* =========================================================
            FOOD PREFERENCES
        ========================================================= */}

        <section className="mt-4 rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/50 p-3.5 shadow-lg shadow-amber-900/5 sm:mt-8 sm:rounded-[2rem] sm:border-stone-200 sm:bg-white sm:p-8 sm:shadow-xl sm:shadow-stone-900/5">

          <div className="flex items-center gap-3 sm:items-start sm:gap-4">

            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 sm:size-11 sm:rounded-2xl sm:bg-emerald-100 sm:text-emerald-700">

              <SlidersHorizontal
                size={21}
                aria-hidden="true"
              />

            </div>

            <div>

              <h2 className="text-[19px] font-black text-stone-950 sm:text-2xl">
                Food preferences
              </h2>

              <p className="mt-1 text-sm leading-6 text-stone-500">
                Explicit preferences EPANTRY can use when personalization is enabled.
              </p>

            </div>

          </div>


          <form
            onSubmit={
              handlePreferencesSave
            }
            className="mt-4 space-y-5 sm:mt-8 sm:space-y-8"
          >


            {/* DIET */}

            <fieldset>

              <legend className="text-sm font-black text-stone-900">
                Dietary preferences
              </legend>

              <div className="mt-3 flex flex-wrap gap-2">

                {DIETARY_OPTIONS.map(
                  (
                    option,
                  ) => {
                    const selected =
                      preferenceForm
                        .dietaryLifestyles
                        .includes(
                          option.value,
                        )

                    return (
                      <label
                        key={
                          option.value
                        }
                        className={[
                          'cursor-pointer',
                          'rounded-full',
                          'border',
                          'px-2.5',
                          'py-1.5',
                          'text-[11px]',
                          'sm:px-3',
                          'sm:py-2',
                          'sm:text-sm',
                          'font-bold',
                          'transition',

                          selected
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                            : 'border-stone-200 bg-white text-stone-600',
                        ].join(
                          ' ',
                        )}
                      >

                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={
                            selected
                          }
                          onChange={() =>
                            togglePreferenceValue(
                              'dietaryLifestyles',
                              option.value,
                            )
                          }
                        />

                        {option.label}

                      </label>
                    )
                  },
                )}

              </div>

            </fieldset>


            {/* ALLERGENS */}

            <fieldset>

              <legend className="text-sm font-black text-stone-900">
                Allergens to avoid
              </legend>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                These are user-selected filtering preferences and are not a medical safety guarantee.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                {ALLERGEN_OPTIONS.map(
                  (
                    option,
                  ) => {
                    const selected =
                      preferenceForm
                        .allergens
                        .includes(
                          option.value,
                        )

                    return (
                      <label
                        key={
                          option.value
                        }
                        className={[
                          'cursor-pointer',
                          'rounded-full',
                          'border',
                          'px-2.5',
                          'py-1.5',
                          'text-[11px]',
                          'sm:px-3',
                          'sm:py-2',
                          'sm:text-sm',
                          'font-bold',

                          selected
                            ? 'border-amber-300 bg-amber-100 text-amber-950'
                            : 'border-stone-200 bg-white text-stone-600',
                        ].join(
                          ' ',
                        )}
                      >

                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={
                            selected
                          }
                          onChange={() =>
                            togglePreferenceValue(
                              'allergens',
                              option.value,
                            )
                          }
                        />

                        {option.label}

                      </label>
                    )
                  },
                )}

              </div>

            </fieldset>


            {/* FREEFORM */}

            <div className="grid gap-5 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="preferred-cuisines"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Preferred cuisines
                </label>

                <input
                  id="preferred-cuisines"
                  type="text"
                  value={
                    preferenceForm
                      .preferredCuisines
                  }
                  onChange={(
                    event,
                  ) =>
                    setPreferenceForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        preferredCuisines:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-semibold"
                  placeholder="Indian, Italian, Thai"
                />

                <p className="mt-2 text-xs text-stone-500">
                  Separate values with commas.
                </p>

              </div>


              <div>

                <label
                  htmlFor="disliked-ingredients"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Disliked ingredients
                </label>

                <input
                  id="disliked-ingredients"
                  type="text"
                  value={
                    preferenceForm
                      .dislikedIngredients
                  }
                  onChange={(
                    event,
                  ) =>
                    setPreferenceForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        dislikedIngredients:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-sm font-semibold"
                  placeholder="Olives, coriander"
                />

                <p className="mt-2 text-xs text-stone-500">
                  Separate values with commas.
                </p>

              </div>

            </div>


            {/* DISPLAY */}

            <div className="grid gap-5 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="measurement-system"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Measurement system
                </label>

                <select
                  id="measurement-system"
                  value={
                    preferenceForm
                      .measurementSystem
                  }
                  onChange={(
                    event,
                  ) =>
                    setPreferenceForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        measurementSystem:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                >

                  <option value="metric">
                    Metric
                  </option>

                  <option value="imperial">
                    Imperial
                  </option>

                </select>

              </div>


              <div>

                <label
                  htmlFor="account-locale"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Locale
                </label>

                <select
                  id="account-locale"
                  value={
                    preferenceForm
                      .locale
                  }
                  onChange={(
                    event,
                  ) =>
                    setPreferenceForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        locale:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"
                >

                  {LOCALE_OPTIONS.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}

                </select>

              </div>

            </div>


            <div className="flex flex-wrap items-center gap-3">

              <button
                type="submit"
                disabled={
                  isSavingPreferences
                }
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white disabled:opacity-50"
              >

                {isSavingPreferences ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save
                    size={17}
                    aria-hidden="true"
                  />
                )}

                Save preferences

              </button>

              {preferenceMessage && (
                <p className="text-sm font-bold text-emerald-700">
                  {preferenceMessage}
                </p>
              )}

            </div>

          </form>

        </section>


        {/* =========================================================
            HOUSEHOLD PERSONALIZATION CONTEXT
        ========================================================= */}

        <section className="mt-4 rounded-[1.5rem] border border-violet-100 bg-violet-50/50 p-3.5 sm:mt-8 sm:rounded-[2rem] sm:border-stone-200 sm:bg-stone-50 sm:p-8">

          <div className="flex items-start gap-4">

            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700">

              <Home
                size={21}
                aria-hidden="true"
              />

            </div>

            <div>

              <h2 className="text-xl font-black text-stone-950">
                Household personalization context
              </h2>

              {isLoadingHousehold ? (
                <p className="mt-2 text-sm text-stone-500">
                  Loading household context...
                </p>
              ) : hasHousehold ? (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Your individual preferences can later be combined with{' '}
                  <strong>
                    {household.name}
                  </strong>
                  {' '}context for shared planning. This household usually represents{' '}
                  <strong>
                    {household.usualPeopleCount}
                  </strong>
                  {' '}people.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  You currently have no household. EPANTRY can still retain your individual preferences; household personalization remains optional.
                </p>
              )}

            </div>

          </div>

        </section>


        {/* =========================================================
            CONSENT
        ========================================================= */}

        <section className="mt-4 rounded-[1.5rem] border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-sky-50/60 p-3.5 shadow-lg shadow-violet-900/5 sm:mt-8 sm:rounded-[2rem] sm:border-stone-200 sm:bg-white sm:p-8 sm:shadow-xl sm:shadow-stone-900/5">

          <div className="flex items-center gap-3 sm:items-start sm:gap-4">

            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 sm:size-11 sm:rounded-2xl sm:bg-emerald-100 sm:text-emerald-700">

              <ShieldCheck
                size={21}
                aria-hidden="true"
              />

            </div>

            <div>

              <h2 className="text-[19px] font-black text-stone-950 sm:text-2xl">
                Consent & privacy
              </h2>

              <p className="mt-1 text-sm leading-6 text-stone-500">
                Consent decisions are versioned and recorded as immutable audit events.
              </p>

            </div>

          </div>


          <div className="mt-4 grid gap-2.5 sm:mt-7 sm:gap-4">


            {/* TERMS + PRIVACY */}

            {[
              'terms_of_service',
              'privacy_policy',
            ].map(
              (
                consentType,
              ) => {
                const item =
                  consentByType.get(
                    consentType,
                  )

                return (
                  <div
                    key={
                      consentType
                    }
                    className="rounded-2xl border border-violet-100 bg-white/80 p-3.5 sm:border-stone-200 sm:bg-stone-50 sm:p-5"
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <p className="font-black text-stone-950">
                            {formatConsentName(
                              consentType,
                            )}
                          </p>

                          <ConsentStatus
                            granted={
                              item?.granted ===
                              true
                            }
                          />

                        </div>

                        <p className="mt-2 text-xs leading-5 text-stone-500">
                          Current version:{' '}
                          {item
                            ?.currentVersion ||
                            '—'}
                        </p>

                      </div>


                      {!item?.granted && (
                        <button
                          type="button"
                          disabled={
                            activeConsentType ===
                            consentType
                          }
                          onClick={() =>
                            handleConsentDecision(
                              consentType,
                              'granted',
                            )
                          }
                          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 text-xs font-black text-white disabled:opacity-50"
                        >

                          {activeConsentType ===
                          consentType ? (
                            <LoaderCircle
                              size={15}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Check
                              size={15}
                              aria-hidden="true"
                            />
                          )}

                          Accept current version

                        </button>
                      )}

                    </div>

                  </div>
                )
              },
            )}


            {/* OPTIONAL CONSENTS */}

            {[
              'marketing_email',
              'personalization',
            ].map(
              (
                consentType,
              ) => {
                const item =
                  consentByType.get(
                    consentType,
                  )

                const enabled =
                  item?.granted ===
                  true

                const isPersonalization =
                  consentType ===
                  'personalization'

                return (
                  <div
                    key={
                      consentType
                    }
                    className="rounded-2xl border border-violet-100 bg-white/80 p-3.5 sm:border-stone-200 sm:bg-stone-50 sm:p-5"
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <p className="font-black text-stone-950">
                            {formatConsentName(
                              consentType,
                            )}
                          </p>

                          <ConsentStatus
                            granted={
                              enabled
                            }
                          />

                        </div>

                        <p className="mt-2 max-w-2xl text-xs leading-5 text-stone-500">

                          {isPersonalization
                            ? 'Allows EPANTRY recommendation features to actively use your saved preferences and available household context.'
                            : 'Allows EPANTRY to send optional promotional and marketing email communication.'}

                        </p>

                        {isPersonalization && (
                          <p className="mt-2 text-xs font-bold text-stone-600">
                            Runtime preference:{' '}
                            {preferenceForm
                              .personalizationEnabled
                              ? 'Enabled'
                              : 'Disabled'}
                          </p>
                        )}

                      </div>


                      <button
                        type="button"
                        disabled={
                          activeConsentType ===
                          consentType
                        }
                        onClick={() =>
                          handleConsentDecision(
                            consentType,

                            enabled
                              ? 'revoked'
                              : 'granted',
                          )
                        }
                        className={[
                          'focus-ring',
                          'inline-flex',
                          'min-h-10',
                          'items-center',
                          'justify-center',
                          'rounded-xl',
                          'px-4',
                          'text-xs',
                          'font-black',
                          'disabled:opacity-50',

                          enabled
                            ? 'border border-stone-300 bg-white text-stone-700'
                            : 'bg-emerald-700 text-white',
                        ].join(
                          ' ',
                        )}
                      >

                        {activeConsentType ===
                        consentType ? (
                          <LoaderCircle
                            size={15}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : enabled ? (
                          'Disable'
                        ) : (
                          'Enable'
                        )}

                      </button>

                    </div>

                  </div>
                )
              },
            )}

          </div>


          {consents &&
            !consents
              .requiredConsentsSatisfied && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
              One or more current required legal consent versions still need acceptance.
            </div>
          )}

        </section>

      </div>
    </main>
  )
}