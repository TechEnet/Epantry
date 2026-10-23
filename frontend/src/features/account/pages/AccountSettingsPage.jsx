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
  optional = false,
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-semibold',
        granted
          ? 'bg-[#DCE8DE] text-[#173F35]'
          : 'bg-[#EEEDE5] text-[#59645B]',
      ].join(' ')}
    >
      {granted && <Check size={13} aria-hidden="true" />}
      {optional ? (granted ? 'On' : 'Off') : (granted ? 'Accepted' : 'Not accepted')}
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
    <main className="w-full min-w-0 bg-[#F7F6F2] px-2 pb-5 pt-2 text-[#202421] sm:px-6 sm:pb-16 sm:pt-7 lg:px-9">
      <div className="w-full">
        <header className="border-b border-[#D7DDCF] pb-3 sm:pb-8">
          <div className="mb-1.5 flex items-center gap-2 sm:mb-2 sm:gap-3">
            <span className="h-[3px] w-7 rounded-full bg-[#C86C42]" aria-hidden="true" />
            <p className="text-[13px] font-semibold tracking-[0.08em] text-[#173F35]">Your account</p>
          </div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.035em] sm:text-[34px]">Profile & preferences</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-5 text-[#556158] sm:mt-2 sm:text-base sm:leading-6">
            <span className="sm:hidden">Manage your profile, addresses, food choices and privacy.</span>
            <span className="hidden sm:inline">Your details, delivery addresses, food choices and privacy settings—all in one place.</span>
          </p>
        </header>

        {pageError && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 sm:mt-5 sm:gap-3 sm:px-4 sm:py-3 text-sm font-medium leading-6 text-red-800">
            <CircleAlert size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{pageError}</span>
          </div>
        )}

        {/* Personal profile: image, name, phone, email and save actions remain connected. */}
        <section aria-labelledby="profile-heading" className="py-4 sm:py-9">
          <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
            <span className="text-[14px] font-bold text-[#C86C42]">01</span>
            <h2 id="profile-heading" className="text-[21px] font-bold tracking-[-0.025em] sm:text-[26px]">Personal details</h2>
          </div>
          <div className="grid min-w-0 gap-0 overflow-hidden rounded-[12px] border border-[#D7DDCF] sm:rounded-[18px] lg:grid-cols-[0.85fr_1.45fr]">
            <div className="relative flex flex-col justify-between gap-2 bg-[#173F35] p-3 text-white sm:gap-6 sm:p-7">
              <div>
                <p className="hidden text-sm font-medium text-[#DCE8DE] sm:block">Your profile photo</p>
                <div className="flex items-center gap-3 sm:mt-4 sm:gap-4">
                  <div className="relative shrink-0">
                    {profile?.profilePhotoUrl ? (
                      <img src={profile.profilePhotoUrl} alt="Your profile" className="h-14 w-14 rounded-full border-[3px] border-white/80 object-cover sm:h-24 sm:w-24" />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-white/60 bg-[#2B624E] text-2xl font-bold sm:h-24 sm:w-24 sm:text-[30px]">
                        {String(profile?.name || 'E').trim().charAt(0).toUpperCase() || 'E'}
                      </div>
                    )}
                    <label className="focus-within:ring-2 focus-within:ring-[#F7F6F2] focus-within:ring-offset-2 focus-within:ring-offset-[#173F35] absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[#C86C42] text-white transition hover:bg-[#AD5631]" title="Change profile photo">
                      {isUploadingPhoto ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Camera size={17} aria-hidden="true" />}
                      <span className="sr-only">Change profile photo</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isUploadingPhoto} onChange={handlePhotoChange} aria-label="Change profile photo" />
                    </label>
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-[17px] font-bold leading-snug sm:text-xl">{profile?.name || 'EPANTRY member'}</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-[#DFE9E1] sm:mt-1">{isUploadingPhoto ? 'Uploading your photo...' : <><span className="sm:hidden">Change photo with the camera icon.</span><span className="hidden sm:inline">Tap the camera to update your photo.</span></>}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/20 pt-2 sm:pt-4">
                <p className="text-[13px] font-medium text-[#D3E0D7]">Sign-in email</p>
                <p className="mt-0.5 break-all text-[14px] font-semibold leading-5 sm:mt-1 sm:text-[15px] sm:leading-6">{profile?.email || 'Not available'}</p>
                <p className="hidden text-[13px] leading-5 text-[#D3E0D7] sm:mt-2 sm:block">Your sign-in email cannot be changed here.</p>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="flex min-w-0 flex-col justify-between gap-3 bg-[#FEFDF9] p-3 sm:gap-6 sm:p-7">
              <div>
                <h3 className="hidden text-lg font-bold sm:block">Update your information</h3>
                <p className="hidden text-sm leading-6 text-[#647067] sm:mt-1 sm:block">Keep your name and contact number up to date.</p>
                <div className="mt-0 grid gap-3 sm:mt-5 sm:gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="account-name" className="mb-1 block text-[14px] font-semibold sm:mb-2">Full name</label>
                    <input id="account-name" type="text" autoComplete="name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#D8DDD4] bg-white px-4 text-base text-[#202421] outline-none focus:border-[#173F35]" />
                  </div>
                  <div>
                    <label htmlFor="account-phone" className="mb-1 block text-[14px] font-semibold sm:mb-2">Phone number</label>
                    <input id="account-phone" type="tel" autoComplete="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+91 98765 43210" className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#D8DDD4] bg-white px-4 text-base text-[#202421] outline-none focus:border-[#173F35]" />
                    {profile?.phoneVerified && <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#173F35]"><Check size={14} aria-hidden="true" /> Verified number</p>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#E2E5DC] pt-3 sm:gap-3 sm:pt-5">
                <button type="submit" disabled={isSavingProfile} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-4 text-[14px] font-semibold text-white transition hover:bg-[#27634E] disabled:opacity-50 sm:w-auto sm:px-5">
                  {isSavingProfile ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                  Save profile
                </button>
                {profileMessage && <p role="status" className="text-sm font-semibold text-[#173F35]">{profileMessage}</p>}
              </div>
            </form>
          </div>
        </section>

        {/* Addresses remain editable using the existing delivery-address endpoints. */}
        <section aria-labelledby="addresses-heading" className="border-t border-[#D7DDCF] py-4 sm:py-9">
          <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:items-end sm:gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-bold text-[#C86C42]">02</span>
                <h2 id="addresses-heading" className="text-[21px] font-bold tracking-[-0.025em] sm:text-[26px]"><span className="sm:hidden">Addresses</span><span className="hidden sm:inline">Delivery addresses</span></h2>
              </div>
              <p className="hidden text-[14px] leading-6 text-[#647067] sm:mt-1.5 sm:block">Choose where your orders should arrive.</p>
            </div>
            <button type="button" onClick={beginAddAddress} className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#173F35] bg-[#173F35] px-3 text-[13px] font-semibold text-white transition hover:bg-[#27634E] sm:gap-2 sm:px-5 sm:text-[14px]"><Plus size={17} aria-hidden="true" /> Add address</button>
          </div>
          {addressMessage && <p role="status" className="mt-4 text-sm font-semibold text-[#173F35]">{addressMessage}</p>}
          <div className="mt-3 grid gap-x-8 gap-y-0 border-t border-[#D7DDCF] sm:mt-5 md:grid-cols-2">
            {addresses.length > 0 ? addresses.map((address) => (
              <article key={address.id} className="flex items-start justify-between gap-2 border-b border-[#D7DDCF] py-3 sm:gap-4 sm:py-4">
                <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#E5EADB] text-[#173F35] sm:size-10"><MapPin size={19} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-bold">{formatAddressTitle(address)}</h3>
                      {address.isDefault && <span className="rounded-md bg-[#DCE8DE] px-2 py-0.5 text-[12px] font-semibold text-[#173F35]">Default</span>}
                    </div>
                    <p className="mt-0.5 break-words text-[14px] leading-5 text-[#556158] sm:mt-1 sm:leading-6">
                      {[address.addressLine1, address.addressLine2, address.area, address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => beginEditAddress(address)} aria-label={`Edit ${formatAddressTitle(address)} address`} className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-[#D7DDCF] bg-white text-[#173F35] transition hover:border-[#C86C42] hover:text-[#C86C42]"><Pencil size={18} aria-hidden="true" /></button>
              </article>
            )) : (
              <p className="py-5 text-[15px] text-[#647067]">You haven't added a delivery address yet.</p>
            )}
          </div>

          {addressForm && (
            <form onSubmit={handleAddressSubmit} className="mt-3 min-w-0 rounded-[12px] border border-[#D7DDCF] bg-[#E9EDE4] p-3 sm:mt-5 sm:rounded-[18px] sm:p-6">
              <div className="flex items-center justify-between gap-2 border-b border-[#C9D1C6] pb-2 sm:gap-3 sm:pb-4">
                <h3 className="text-lg font-bold sm:text-xl">{addressForm.id ? 'Edit delivery address' : 'Add a delivery address'}</h3>
                <button type="button" onClick={() => setAddressForm(null)} aria-label="Close address form" className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-[#C9D1C6] bg-white text-[#202421]"><X size={18} aria-hidden="true" /></button>
              </div>
              <div className="mt-3 grid gap-3 sm:mt-5 sm:gap-4 sm:grid-cols-2">
                {[
                  ['recipientName', 'Recipient name', true],
                  ['phone', 'Recipient phone', true],
                ].map(([key, label, required]) => (
                  <div key={key}>
                    <label htmlFor={`address-${key}`} className="mb-1 block text-[14px] font-semibold sm:mb-1.5">{label}</label>
                    <input id={`address-${key}`} value={addressForm[key]} onChange={(event) => updateAddressField(key, event.target.value)} required={required} inputMode={key === 'phone' ? 'tel' : undefined} className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#CED6CB] bg-white px-4 text-[15px]" />
                  </div>
                ))}
                <div>
                  <label htmlFor="address-label" className="mb-1 block text-[14px] font-semibold sm:mb-1.5">Address type</label>
                  <select id="address-label" value={addressForm.label} onChange={(event) => updateAddressField('label', event.target.value)} className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#CED6CB] bg-white px-4 text-[15px]">
                    {ADDRESS_LABELS.map((label) => <option key={label} value={label}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>)}
                  </select>
                </div>
                {addressForm.label === 'other' && (
                  <div>
                    <label htmlFor="address-customLabel" className="mb-1 block text-[14px] font-semibold sm:mb-1.5">Custom label</label>
                    <input id="address-customLabel" value={addressForm.customLabel} onChange={(event) => updateAddressField('customLabel', event.target.value)} required className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#CED6CB] bg-white px-4 text-[15px]" />
                  </div>
                )}
                {[
                  ['addressLine1', 'House / building / street', true],
                  ['addressLine2', 'Apartment / floor (optional)', false],
                  ['area', 'Area or locality', true],
                  ['landmark', 'Nearby landmark (optional)', false],
                  ['city', 'City', true],
                  ['state', 'State', true],
                  ['postalCode', 'Pincode', true],
                  ['country', 'Country', true],
                ].map(([key, label, required]) => (
                  <div key={key} className={key === 'addressLine1' || key === 'addressLine2' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`address-${key}`} className="mb-1 block text-[14px] font-semibold sm:mb-1.5">{label}</label>
                    <input id={`address-${key}`} value={addressForm[key]} onChange={(event) => updateAddressField(key, event.target.value)} required={required} inputMode={key === 'postalCode' ? 'numeric' : undefined} maxLength={key === 'postalCode' ? 6 : undefined} className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#CED6CB] bg-white px-4 text-[15px]" />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label htmlFor="address-deliveryInstructions" className="mb-1 block text-[14px] font-semibold sm:mb-1.5">Delivery instructions (optional)</label>
                  <textarea id="address-deliveryInstructions" rows={3} value={addressForm.deliveryInstructions} onChange={(event) => updateAddressField('deliveryInstructions', event.target.value)} maxLength={240} className="focus-ring w-full rounded-xl border border-[#CED6CB] bg-white px-4 py-3 text-[15px]" />
                </div>
              </div>
              <div className="mt-3 flex justify-end sm:mt-5">
                <button type="submit" disabled={isSavingAddress} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-4 text-[14px] font-semibold text-white transition hover:bg-[#27634E] disabled:opacity-50 sm:w-auto sm:justify-start sm:px-5">
                  {isSavingAddress ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                  {addressForm.id ? 'Save address' : 'Add address'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Food preferences use existing preference form state and API. */}
        <section aria-labelledby="preferences-heading" className="border-t border-[#D7DDCF] py-4 sm:py-9">
          <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
            <span className="text-[14px] font-bold text-[#C86C42]">03</span>
            <h2 id="preferences-heading" className="text-[21px] font-bold tracking-[-0.025em] sm:text-[26px]">Food preferences</h2>
          </div>
          <form onSubmit={handlePreferencesSave} className="min-w-0 overflow-hidden rounded-[12px] border border-[#D7DDCF] bg-[#E5EADB] sm:rounded-[18px]">
            <div className="grid lg:grid-cols-2">
              <div className="p-3 sm:p-7">
                <p className="mb-3 max-w-lg text-[14px] leading-5 text-[#43594A] sm:mb-5 sm:leading-6"><span className="sm:hidden">Choose your food preferences below.</span><span className="hidden sm:inline">Tell us what you like to eat, and which ingredients you'd prefer to avoid.</span></p>
                <fieldset>
                  <legend className="text-[17px] font-bold">How do you eat?</legend>
                  <p className="hidden text-[13px] leading-5 text-[#536557] sm:mt-1 sm:block">Choose any dietary preferences that fit you.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                    {DIETARY_OPTIONS.map((option) => {
                      const selected = preferenceForm.dietaryLifestyles.includes(option.value)
                      return (
                        <label key={option.value} className={`focus-within:ring-2 focus-within:ring-[#173F35] inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-2.5 py-1.5 text-[14px] font-medium transition sm:px-3 sm:py-2 ${selected ? 'border-[#173F35] bg-[#173F35] text-white' : 'border-[#C9D4C6] bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>
                          <input type="checkbox" className="sr-only" checked={selected} onChange={() => togglePreferenceValue('dietaryLifestyles', option.value)} />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <div className="my-4 h-px bg-[#C4D0C1] sm:my-6" />
                <fieldset>
                  <legend className="text-[17px] font-bold">Ingredients to avoid</legend>
                  <p className="mt-1 max-w-lg text-[13px] leading-5 text-[#536557]"><span className="sm:hidden">Flag allergens; always check product labels for safety.</span><span className="hidden sm:inline">Select allergens you want flagged. Always check packaging and ingredient information for safety.</span></p>
                  <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                    {ALLERGEN_OPTIONS.map((option) => {
                      const selected = preferenceForm.allergens.includes(option.value)
                      return (
                        <label key={option.value} className={`focus-within:ring-2 focus-within:ring-[#173F35] inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-2.5 py-1.5 text-[14px] font-medium transition sm:px-3 sm:py-2 ${selected ? 'border-[#C86C42] bg-[#F7E3D7] text-[#813D23]' : 'border-[#C9D4C6] bg-[#F7F6F2] text-[#202421] hover:border-[#C86C42]'}`}>
                          <input type="checkbox" className="sr-only" checked={selected} onChange={() => togglePreferenceValue('allergens', option.value)} />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
              <div className="border-t border-[#C9D3C5] bg-[#FEFDF9] p-3 sm:p-7 lg:border-l lg:border-t-0">
                <h3 className="text-[17px] font-bold">Make it yours</h3>
                <p className="hidden text-[14px] leading-6 text-[#647067] sm:mt-1 sm:block">Set your favorite cuisines and how measurements appear.</p>
                <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
                  <div>
                    <label htmlFor="preferred-cuisines" className="mb-1 block text-[14px] font-semibold sm:mb-2">Favorite cuisines</label>
                    <input id="preferred-cuisines" type="text" value={preferenceForm.preferredCuisines} onChange={(event) => setPreferenceForm((current) => ({ ...current, preferredCuisines: event.target.value }))} placeholder="Indian, Italian, Thai" className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#D8DDD4] bg-white px-4 text-[15px]" />
                    <p className="mt-1 text-[13px] text-[#647067] sm:mt-1.5"><span className="sm:hidden">Separate with commas.</span><span className="hidden sm:inline">Separate multiple cuisines with commas.</span></p>
                  </div>
                  <div>
                    <label htmlFor="disliked-ingredients" className="mb-1 block text-[14px] font-semibold sm:mb-2">Ingredients you dislike</label>
                    <input id="disliked-ingredients" type="text" value={preferenceForm.dislikedIngredients} onChange={(event) => setPreferenceForm((current) => ({ ...current, dislikedIngredients: event.target.value }))} placeholder="Olives, coriander" className="focus-ring min-h-11 w-full rounded-xl sm:min-h-12 border border-[#D8DDD4] bg-white px-4 text-[15px]" />
                    <p className="mt-1 text-[13px] text-[#647067] sm:mt-1.5"><span className="sm:hidden">Separate with commas.</span><span className="hidden sm:inline">Separate multiple ingredients with commas.</span></p>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-4">
                    <div>
                      <label htmlFor="measurement-system" className="mb-1 block text-[14px] font-semibold sm:mb-2">Measurements</label>
                      <select id="measurement-system" value={preferenceForm.measurementSystem} onChange={(event) => setPreferenceForm((current) => ({ ...current, measurementSystem: event.target.value }))} className="focus-ring min-h-11 min-w-0 w-full rounded-xl border border-[#D8DDD4] bg-white px-2 text-[14px] sm:min-h-12 sm:px-3 sm:text-[15px]">
                        <option value="metric">Metric</option><option value="imperial">Imperial</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="account-locale" className="mb-1 block text-[14px] font-semibold sm:mb-2">Language & region</label>
                      <select id="account-locale" value={preferenceForm.locale} onChange={(event) => setPreferenceForm((current) => ({ ...current, locale: event.target.value }))} className="focus-ring min-h-11 min-w-0 w-full rounded-xl border border-[#D8DDD4] bg-white px-2 text-[14px] sm:min-h-12 sm:px-3 sm:text-[15px]">
                        {LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[#C9D3C5] bg-[#F7F6F2] px-3 py-3 sm:gap-3 sm:px-7 sm:py-4">
              <button type="submit" disabled={isSavingPreferences} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-4 text-[14px] font-semibold text-white transition hover:bg-[#27634E] disabled:opacity-50 sm:w-auto sm:justify-start sm:px-5">
                {isSavingPreferences ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                Save food preferences
              </button>
              {preferenceMessage && <p role="status" className="text-sm font-semibold text-[#173F35]">{preferenceMessage}</p>}
            </div>
          </form>
        </section>

        {/* This is informational; it does not alter household membership. */}
        <section aria-labelledby="household-heading" className="flex items-start gap-2 border-l-[4px] border-[#C86C42] bg-[#F4E8DF] px-3 py-3 sm:gap-5 sm:px-7 sm:py-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#A85430] sm:size-10"><Home size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="household-heading" className="text-[17px] font-bold sm:text-[19px]">Your household</h2>
            {isLoadingHousehold ? (
              <p className="mt-0.5 text-[14px] leading-5 text-[#63584E] sm:mt-1 sm:leading-6">Loading household details...</p>
            ) : hasHousehold ? (
              <p className="mt-0.5 text-[14px] leading-5 text-[#63584E] sm:mt-1 sm:leading-6"><span className="sm:hidden">Shared meal plans: <strong className="text-[#202421]">{household.name}</strong> · <strong className="text-[#202421]">{household.usualPeopleCount}</strong> people.</span><span className="hidden sm:inline">Your food preferences are yours. For shared meal planning, EPANTRY can also consider your household <strong className="text-[#202421]">{household.name}</strong>, which usually includes <strong className="text-[#202421]">{household.usualPeopleCount}</strong> people.</span></p>
            ) : (
              <p className="mt-0.5 text-[14px] leading-5 text-[#63584E] sm:mt-1 sm:leading-6"><span className="sm:hidden">No household yet. Your food choices still work.</span><span className="hidden sm:inline">You haven't created a household. You can still save your personal food preferences.</span></p>
            )}
          </div>
        </section>

        {/* Consent buttons preserve required/optional decision semantics. */}
        <section aria-labelledby="consent-heading" className="py-4 sm:py-10">
          <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
            <span className="text-[14px] font-bold text-[#C86C42]">04</span>
            <h2 id="consent-heading" className="text-[21px] font-bold tracking-[-0.025em] sm:text-[26px]">Privacy & permissions</h2>
          </div>
          <p className="mb-3 max-w-3xl text-[14px] leading-5 text-[#647067] sm:mb-6 sm:leading-6"><span className="sm:hidden">Review policy approvals and optional settings.</span><span className="hidden sm:inline">Review the policies you've accepted and choose whether we can send marketing emails or personalize recommendations.</span></p>
          <div className="border-t border-[#D7DDCF]">
            {['terms_of_service', 'privacy_policy'].map((consentType) => {
              const item = consentByType.get(consentType)
              return (
                <div key={consentType} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[#D7DDCF] py-3 sm:grid-cols-1 sm:items-stretch sm:gap-4 sm:py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                      <h3 className="text-[15px] font-bold leading-5 sm:text-[16px]">{formatConsentName(consentType)}</h3>
                      <ConsentStatus granted={item?.granted === true} />
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-[#647067] sm:mt-1.5 sm:text-[14px] sm:leading-6">
                      <span className="sm:hidden">{consentType === 'terms_of_service' ? 'Using EPANTRY.' : 'How your data is used.'} {item?.currentVersion ? `Version: ${item.currentVersion}` : ''}</span>
                      <span className="hidden sm:inline">{consentType === 'terms_of_service' ? 'The terms for using EPANTRY.' : 'How we handle your personal information.'} {item?.currentVersion ? `Current version: ${item.currentVersion}` : ''}</span></p>
                  </div>
                  {!item?.granted && (
                    <button type="button" disabled={activeConsentType === consentType} onClick={() => handleConsentDecision(consentType, 'granted')} className="focus-ring inline-flex min-h-11 w-fit shrink-0 items-center justify-center gap-1 rounded-xl bg-[#173F35] px-3 text-[13px] font-semibold text-white transition hover:bg-[#27634E] disabled:opacity-50 sm:gap-2 sm:px-5 sm:text-[14px]">
                      {activeConsentType === consentType ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
                      <span className="sm:hidden">Accept</span><span className="hidden sm:inline">Accept current version</span>
                    </button>
                  )}
                </div>
              )
            })}
            {['marketing_email', 'personalization'].map((consentType) => {
              const item = consentByType.get(consentType)
              const enabled = item?.granted === true
              const isPersonalization = consentType === 'personalization'
              return (
                <div key={consentType} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[#D7DDCF] py-3 sm:grid-cols-1 sm:items-stretch sm:gap-4 sm:py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                      <h3 className="text-[15px] font-bold leading-5 sm:text-[16px]"><span className="sm:hidden">{isPersonalization ? 'Personalization' : 'Marketing emails'}</span><span className="hidden sm:inline">{isPersonalization ? 'Personalized recommendations' : 'Marketing emails'}</span></h3>
                      <ConsentStatus granted={enabled} optional />
                    </div>
                    <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#647067] sm:mt-1.5 sm:text-[14px] sm:leading-6">
                      <span className="sm:hidden">{isPersonalization ? 'Use food choices for better suggestions.' : 'Get occasional offers by email.'}</span>
                      <span className="hidden sm:inline">{isPersonalization ? 'Let EPANTRY use your saved food preferences and available household details to suggest more relevant meals and products.' : 'Receive optional news, offers and promotional emails from EPANTRY.'}</span></p>
                    {isPersonalization && <p className="mt-1 text-[13px] font-medium text-[#56675A] sm:mt-1.5">Recommendations based on your preferences: {preferenceForm.personalizationEnabled ? 'On' : 'Off'}</p>}
                  </div>
                  <button type="button" disabled={activeConsentType === consentType} onClick={() => handleConsentDecision(consentType, enabled ? 'revoked' : 'granted')} className={`focus-ring inline-flex min-h-11 w-fit min-w-[74px] shrink-0 items-center justify-center rounded-xl px-3 text-[13px] font-semibold transition disabled:opacity-50 sm:min-w-[100px] sm:px-5 sm:text-[14px] ${enabled ? 'border border-[#C86C42] bg-[#FFF7F2] text-[#A85430] hover:bg-[#F7E3D7]' : 'bg-[#173F35] text-white hover:bg-[#27634E]'}`}>
                    {activeConsentType === consentType ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              )
            })}
          </div>
          {consents && !consents.requiredConsentsSatisfied && (
            <div role="status" className="mt-3 border-l-4 border-[#C86C42] bg-[#F9EBDD] px-3 py-2 text-[14px] font-medium leading-5 text-[#754523] sm:mt-5 sm:px-4 sm:py-3 sm:leading-6"><span className="sm:hidden">Accept the latest Terms and Privacy Policy to finish setup.</span><span className="hidden sm:inline">Please accept the current Terms of Service and Privacy Policy to finish your account setup.</span></div>
          )}
        </section>
      </div>
    </main>
  )
}
