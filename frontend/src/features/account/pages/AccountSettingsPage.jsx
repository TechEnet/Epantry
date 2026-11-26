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
  UserRound,
  Leaf,
  Drumstick,
  Utensils,
  X,
} from 'lucide-react'

import { Link } from 'react-router-dom'

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
  { value: 'vegetarian', label: 'Veg', description: 'Vegetarian food' },
  { value: 'non_vegetarian', label: 'Non-Veg', description: 'Includes meat, fish or eggs' },
  { value: '', label: 'No preference', description: 'All food choices' },
]
const OTHER_DIET_MODES = [
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
]
const DIET_MODE_VALUES = ['vegetarian', 'non_vegetarian', 'vegan', 'pescatarian']
const OPTIONAL_DIETARY_OPTIONS = [
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten_free', label: 'Gluten free' },
  { value: 'dairy_free', label: 'Dairy free' },
]

function selectDietMode(values, mode) {
  const remaining = values.filter((value) => !DIET_MODE_VALUES.includes(value))
  return mode ? [...remaining, mode] : remaining
}

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

function ConsentStatus({ granted, optional = false }) {
  return <span className="aps-status" data-active={granted ? 'true' : 'false'}>
    {granted && <Check size={15} aria-hidden="true" />}
    {optional ? (granted ? 'On' : 'Off') : (granted ? 'Accepted' : 'Not accepted')}
  </span>
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

  const chosenDiet = ['vegan', 'pescatarian', 'vegetarian', 'non_vegetarian'].find((value) => preferenceForm.dietaryLifestyles.includes(value)) || ''
  const dietLabel = [...DIETARY_OPTIONS, ...OTHER_DIET_MODES].find((option) => option.value === chosenDiet)?.label || 'No preference'
  const chooseDiet = (mode) => {
    setPreferenceForm((current) => ({ ...current, dietaryLifestyles: selectDietMode(current.dietaryLifestyles, mode) }))
    setPreferenceMessage('')
  }
  const renderDiet = (option) => (
    <label key={option.value || 'none'} className="aps-diet-option" data-selected={chosenDiet === option.value ? 'true' : 'false'}>
      <input type="radio" name="account-diet-mode" value={option.value} checked={chosenDiet === option.value} onChange={() => chooseDiet(option.value)} />
      <span className="aps-diet-symbol" aria-hidden="true">{option.value === 'non_vegetarian' ? <Drumstick size={28}/> : option.value === 'vegetarian' || option.value === 'vegan' ? <Leaf size={28}/> : <Utensils size={28}/>}</span>
      <span className="aps-diet-copy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
    </label>
  )
  const renderPreference = (key, option) => (
    <label key={option.value} className="aps-chip" data-selected={preferenceForm[key].includes(option.value) ? 'true' : 'false'}>
      <input type="checkbox" checked={preferenceForm[key].includes(option.value)} onChange={() => togglePreferenceValue(key, option.value)} />
      {option.label}
    </label>
  )
  return (
    <main className="aps-page">
      <style>{`
        .aps-page { --clay:#C56C42; --forest:#173F35; --ink:#202421; --paper:#F7F6F2; --sage:#D7DDCF; --line:#C8D0C2; --muted:#4D5A51; box-sizing:border-box; container-type:inline-size; min-width:0; width:100%; background:var(--paper); color:var(--ink); padding:28px 34px 48px; font-size:16px; line-height:1.5; }
        .aps-page * { box-sizing:border-box; }
        .aps-page :is(h1,h2,h3,p) { margin:0; }
        .aps-page :is(h1,h2,h3,legend) { color:var(--ink)!important; font-weight:700; letter-spacing:-.025em; line-height:1.2; }
        .aps-page .aps-hero { display:flex; align-items:center; gap:16px; padding:0 0 24px; border-bottom:2px solid var(--ink); }
        .aps-page .aps-hero h1 { font-size:clamp(29px,3.2vw,40px); }
        .aps-page .aps-hero-icon { width:52px; height:52px; background:var(--clay)!important; color:#141916!important; display:grid; place-items:center; border-radius:12px; flex:none; }
        .aps-page .aps-section { min-width:0; display:grid; grid-template-columns:minmax(0,200px) minmax(0,1fr); column-gap:28px; align-items:start; padding:28px 0; border-bottom:1px solid var(--line); }
        .aps-page > .aps-section:last-child { border-bottom:0; padding-bottom:0; }
        .aps-page .aps-heading { display:flex; flex-direction:column; align-items:flex-start; gap:12px; padding-top:4px; min-width:0; }
        .aps-page .aps-heading h2 { font-size:26px; }
        .aps-page .aps-heading .aps-section-mark { width:36px; height:4px; background:var(--clay); display:block; border-radius:2px; }
        .aps-page h3,.aps-page legend { font-size:20px; }
        .aps-page .aps-muted { color:var(--muted)!important; font-size:15px; line-height:1.5; }
        .aps-page p,.aps-page strong,.aps-page a { overflow-wrap:anywhere; }
        .aps-page .aps-account-grid,.aps-page .aps-address-column { display:contents; }
        .aps-page .aps-profile { overflow:hidden; border:1px solid var(--line); border-radius:16px; background:var(--paper); min-width:0; }
        .aps-page .aps-identity { display:flex; align-items:center; flex-wrap:wrap; justify-content:space-between; gap:20px; padding:20px 24px; background:var(--clay)!important; color:#141916!important; min-width:0; }
        .aps-page .aps-identity :is(h3,p,strong) { color:#141916!important; }
        .aps-page .aps-avatar-row { display:flex; align-items:center; gap:16px; min-width:0; }
        .aps-page .aps-avatar { width:76px; height:76px; flex:0 0 76px; position:relative; }
        .aps-page .aps-avatar img,.aps-page .aps-initial { width:100%; height:100%; border-radius:50%; object-fit:cover; background:var(--forest)!important; color:white!important; display:grid; place-items:center; font-weight:700; font-size:32px; border:2px solid var(--paper); }
        .aps-page .aps-camera { position:absolute; right:-3px; bottom:-3px; display:grid; place-items:center; background:var(--paper)!important; color:var(--forest)!important; width:34px; height:34px; border:2px solid var(--clay); border-radius:50%; cursor:pointer; }
        .aps-page .aps-identity-email { min-width:0; overflow-wrap:anywhere; font-size:16px; padding-left:16px; border-left:1px solid #20242155; }
        .aps-page .aps-identity-email strong { display:block; font-weight:650; }
        .aps-page .aps-form { padding:22px 24px; min-width:0; }
        .aps-page .aps-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
        .aps-page .aps-field { display:grid; align-content:start; gap:7px; min-width:0; }
        .aps-page .aps-field label,.aps-page .aps-address-form label { color:var(--ink)!important; font-size:16px; font-weight:650; }
        .aps-page input:not([type=radio]):not([type=checkbox]):not([type=file]),.aps-page select,.aps-page textarea { color:var(--ink)!important; background:#fff!important; border:1px solid #AEB9AA!important; border-radius:9px; padding:12px 14px; font-size:16px; width:100%; min-width:0; min-height:48px; }
        .aps-page input::placeholder { color:#626B62; opacity:1; }
        .aps-page :is(input,select,textarea,button,summary):focus-visible,.aps-page .aps-camera:focus-within { outline:2px solid var(--forest); outline-offset:3px; }
        .aps-page .aps-actions { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:18px; }
        .aps-page .aps-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:10px 16px; border:1px solid var(--forest); border-radius:9px; background:transparent!important; color:var(--forest)!important; font-size:15px; font-weight:700; cursor:pointer; max-width:100%; line-height:1.25; text-align:center; }
        .aps-page .aps-button svg { flex-shrink:0; }
        .aps-page .aps-primary { background:var(--clay)!important; border-color:var(--clay); color:#141916!important; }
        .aps-page .aps-button:hover:not(:disabled) { box-shadow:inset 0 0 0 1px currentColor; }
        .aps-page .aps-button:disabled { opacity:.55; cursor:not-allowed; }
        .aps-page .aps-status { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:6px; font-size:14px; line-height:1.4; font-weight:650; background:#EBE8E0!important; color:var(--ink)!important; }
        .aps-page .aps-status[data-active=true] { background:var(--sage)!important; color:var(--forest)!important; }
        .aps-page .aps-address-content,.aps-page .aps-privacy-content { min-width:0; }
        .aps-page .aps-address-list { background:var(--sage); border-radius:14px; overflow:hidden; }
        .aps-page .aps-address-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:20px 24px; border-bottom:1px solid #B7C2B2; }
        .aps-page .aps-address-row:last-child { border-bottom:0; }
        .aps-page .aps-address-info { display:flex; flex:1 1 210px; gap:14px; align-items:flex-start; min-width:0; }
        .aps-page .aps-address-info > div { min-width:0; }
        .aps-page .aps-address-info p { margin-top:6px; }
        .aps-page .aps-address-row .aps-status { background:var(--paper)!important; }
        .aps-page .aps-icon { display:grid; place-items:center; width:44px; height:44px; flex:0 0 44px; background:var(--paper)!important; color:var(--forest)!important; border-radius:10px; }
        .aps-page .aps-inline { display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; }
        .aps-page .aps-address-form { margin-top:16px; background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:20px; min-width:0; }
        .aps-page .aps-household { display:flex; align-items:center; gap:14px; padding:14px 0 0; margin-top:16px; border-top:1px solid var(--line); }
        .aps-page .aps-household .aps-icon { background:var(--sage)!important; color:var(--forest)!important; }
        .aps-page .aps-household h2 { font-size:20px; margin-bottom:4px; }
        .aps-page .aps-preferences { min-width:0; border:1px solid var(--line); border-radius:16px; overflow:hidden; background:var(--paper); }
        .aps-page .aps-diet { min-width:0; background:var(--sage); padding:22px 24px; }
        .aps-page fieldset { border:0; margin:0; padding:0; min-width:0; }
        .aps-page .aps-diet-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:15px; }
        .aps-page .aps-diet-top .aps-status { background:var(--paper)!important; }
        .aps-page .aps-diet-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .aps-page .aps-diet-option { display:grid; grid-template-columns:1fr auto; align-items:start; gap:12px 8px; min-width:0; background:var(--paper)!important; border:1px solid #B5C0AF; border-radius:11px; padding:15px; cursor:pointer; color:var(--ink)!important; }
        .aps-page .aps-diet-option[data-selected=true] { background:#F3DFD3!important; border:2px solid #944624; padding:14px; color:var(--ink)!important; }
        .aps-page .aps-diet-option input { grid-column:2; grid-row:1; align-self:center; }
        .aps-page .aps-diet-symbol { grid-column:1; grid-row:1; width:30px; height:30px; color:var(--forest)!important; display:grid; place-items:center; }
        .aps-page .aps-diet-symbol svg { width:28px; height:28px; }
        .aps-page .aps-diet-copy { grid-column:1/-1; min-width:0; display:grid; gap:3px; }
        .aps-page .aps-diet-copy strong { font-size:20px; color:inherit!important; }
        .aps-page .aps-diet-copy small { font-size:15px; color:var(--muted)!important; line-height:1.4; }
        .aps-page input[type=radio],.aps-page input[type=checkbox] { accent-color:var(--forest); width:18px; height:18px; flex:0 0 18px; margin:0; appearance:auto; }
        .aps-page .aps-optional { margin-top:16px; padding-top:12px; border-top:1px solid #B5C0AF; }
        .aps-page .aps-optional summary { color:var(--forest)!important; font-size:15px; font-weight:700; cursor:pointer; }
        .aps-page .aps-optional .aps-diet-grid { margin:12px 0; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .aps-page .aps-pref-columns { min-width:0; display:grid; grid-template-columns:minmax(0,1fr); }
        .aps-page .aps-pref-columns > div { min-width:0; padding:22px 24px; }
        .aps-page .aps-pref-columns > div+div { border-top:1px solid var(--line); }
        .aps-page .aps-chips { display:flex; flex-wrap:wrap; gap:9px; margin-top:12px; }
        .aps-page .aps-chip { display:inline-flex; align-items:center; gap:7px; min-height:42px; padding:8px 12px; border:1px solid #BFC8BA; border-radius:7px; background:var(--paper)!important; color:var(--ink)!important; font-size:16px; cursor:pointer; }
        .aps-page .aps-chip[data-selected=true] { background:var(--sage)!important; color:var(--forest)!important; border-color:var(--forest); }
        .aps-page .aps-save-bar { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-start; gap:12px; padding:16px 24px; border-top:1px solid var(--line); background:var(--paper); }
        .aps-page .aps-privacy { display:grid; grid-template-columns:minmax(0,1fr); gap:20px; }
        .aps-page .aps-privacy-column { min-width:0; display:grid; grid-template-columns:minmax(130px,.38fr) minmax(0,1fr); align-items:start; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:var(--paper); }
        .aps-page .aps-privacy-group { grid-row:1/3; align-self:stretch; padding:20px; color:var(--forest)!important; background:var(--sage); font-size:18px; font-weight:700; }
        .aps-page .aps-privacy-column+div .aps-privacy-group { background:#F3DFD3; color:var(--ink)!important; }
        .aps-page .aps-consent-row { grid-column:2; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:17px 20px; border-bottom:1px solid var(--line); min-width:0; }
        .aps-page .aps-consent-row:last-child { border-bottom:0; }
        .aps-page .aps-consent-row > div { min-width:0; flex:1 1 200px; }
        .aps-page .aps-consent-row h3 { font-size:19px; }
        .aps-page .aps-consent-row a { color:var(--forest)!important; font-size:15px; font-weight:650; text-decoration:underline; text-underline-offset:3px; }
        .aps-page .aps-consent-row p { margin:5px 0; }
        .aps-page .aps-consent-row .aps-primary { background:var(--forest)!important; color:var(--paper)!important; border-color:var(--forest); }
        .aps-page .aps-warning { background:#F3DFD3; border-left:4px solid var(--clay); color:var(--ink)!important; padding:13px 16px; margin-top:16px; font-size:15px; }
        .aps-page .aps-error { background:#FBE7E5; color:#812D24!important; border-left:4px solid #A63F34; padding:13px; margin-top:14px; display:flex; gap:10px; align-items:flex-start; }
        @container (min-width:1050px) { .aps-page .aps-pref-columns { grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr); } .aps-page .aps-pref-columns > div+div { border-top:0; border-left:1px solid var(--line); } }
        @container (max-width:940px) { .aps-page .aps-section { grid-template-columns:minmax(0,1fr); gap:14px; } .aps-page .aps-heading { flex-direction:row; flex-wrap:wrap; align-items:center; justify-content:space-between; } .aps-page .aps-heading .aps-section-mark { display:none; } }
        @container (max-width:600px) { .aps-page .aps-fields { grid-template-columns:minmax(0,1fr); gap:14px; } .aps-page .aps-identity,.aps-page .aps-form,.aps-page .aps-diet,.aps-page .aps-pref-columns > div { padding:17px; } .aps-page .aps-identity-email { padding-left:0; border-left:0; width:100%; } .aps-page .aps-diet-grid { grid-template-columns:minmax(0,1fr); gap:8px; } .aps-page .aps-diet-option { grid-template-columns:30px minmax(0,1fr) auto; align-items:center; gap:10px; padding:12px; } .aps-page .aps-diet-option[data-selected=true] { padding:11px; } .aps-page .aps-diet-option input { grid-column:3; } .aps-page .aps-diet-copy { grid-column:2; grid-row:1; } .aps-page .aps-save-bar { padding:14px 17px; } .aps-page .aps-address-row { padding:16px; } .aps-page .aps-optional .aps-diet-grid { grid-template-columns:minmax(0,1fr); } .aps-page .aps-privacy-column { grid-template-columns:minmax(0,1fr); } .aps-page .aps-privacy-group { grid-row:auto; padding:12px 16px; } .aps-page .aps-consent-row { grid-column:1; padding:16px; gap:10px; } .aps-page .aps-actions .aps-primary,.aps-page .aps-save-bar .aps-primary { width:100%; } }
        @media(max-width:639px) { .aps-page { padding:14px 12px 30px; } .aps-page .aps-section { padding:22px 0; } .aps-page .aps-hero { padding-bottom:16px; gap:12px; } .aps-page .aps-hero-icon { width:44px; height:44px; } .aps-page .aps-address-form { padding:14px; } .aps-page .aps-heading h2 { font-size:24px; } }
      `}</style>
      <header className="aps-hero">
        <span className="aps-hero-icon"><UserRound size={25} aria-hidden="true" /></span>
        <h1>Profile & preferences</h1>
      </header>
      {pageError && <div className="aps-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>{pageError}</span></div>}
      <div className="aps-account-grid" data-editing={Boolean(addressForm)}>
      <section className="aps-section" aria-labelledby="profile-heading">
        <div className="aps-heading"><span className="aps-section-mark" aria-hidden="true"/><h2 id="profile-heading">Personal details</h2></div>
        <div className="aps-profile">
          <div className="aps-identity">
            <div className="aps-avatar-row">
              <div className="aps-avatar">
                {profile?.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="Your profile"/> : <span className="aps-initial">{String(profile?.name || 'E').trim().charAt(0).toUpperCase() || 'E'}</span>}
                <label className="aps-camera" title="Change profile photo">{isUploadingPhoto ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true"/> : <Camera size={17} aria-hidden="true"/>}<span className="sr-only">Change profile photo</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isUploadingPhoto} onChange={handlePhotoChange} aria-label="Change profile photo"/></label>
              </div>
              <div className="min-w-0"><h3>{profile?.name || 'EPANTRY member'}</h3><p className="aps-muted">{isUploadingPhoto ? 'Uploading photo…' : 'Change profile photo'}</p></div>
            </div>
            <div className="aps-identity-email"><p className="aps-muted">Sign-in email</p><strong>{profile?.email || 'Not available'}</strong></div>
          </div>
          <form className="aps-form" onSubmit={handleProfileSave}>
            <div className="aps-fields">
              <div className="aps-field"><label htmlFor="account-name">Full name</label><input id="account-name" type="text" autoComplete="name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}/></div>
              <div className="aps-field"><label htmlFor="account-phone">Phone number</label><input id="account-phone" type="tel" autoComplete="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+91 98765 43210"/>{profile?.phoneVerified && <span className="aps-inline aps-muted"><Check size={15}/> Verified number</span>}</div>
            </div>
            <div className="aps-actions"><button className="aps-button aps-primary" type="submit" disabled={isSavingProfile}>{isSavingProfile ? <LoaderCircle size={17} className="animate-spin"/> : <Save size={17}/>} Save profile</button>{profileMessage && <p role="status" className="aps-muted">{profileMessage}</p>}</div>
          </form>
        </div>
      </section>
      <div className="aps-address-column">
      <section className="aps-section" aria-labelledby="addresses-heading">
        <div className="aps-heading"><span className="aps-section-mark" aria-hidden="true"/><h2 id="addresses-heading">Delivery addresses</h2><button type="button" className="aps-button aps-primary" onClick={beginAddAddress}><Plus size={18}/> Add address</button></div>
        <div className="aps-address-content">
        {addressMessage && <p role="status" className="aps-muted mb-3">{addressMessage}</p>}
        <div className="aps-address-list">
          {addresses.length ? addresses.map((address) => <article className="aps-address-row" key={address.id}>
            <div className="aps-address-info"><span className="aps-icon"><MapPin size={20}/></span><div className="min-w-0"><div className="aps-inline"><h3>{formatAddressTitle(address)}</h3>{address.isDefault && <span className="aps-status" data-active="true">Default</span>}</div><p className="aps-muted">{[address.addressLine1,address.addressLine2,address.area,address.city,address.state,address.postalCode].filter(Boolean).join(', ')}</p></div></div>
            <button type="button" className="aps-button" onClick={() => beginEditAddress(address)} aria-label={`Edit ${formatAddressTitle(address)} address`}><Pencil size={17}/> Edit</button>
          </article>) : <p className="aps-address-row aps-muted">No delivery addresses added.</p>}
        </div>
          {addressForm && (
            <form onSubmit={handleAddressSubmit} className="aps-address-form">
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
                <button type="submit" disabled={isSavingAddress} className="aps-button aps-primary">
                  {isSavingAddress ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                  {addressForm.id ? 'Save address' : 'Add address'}
                </button>
              </div>
            </form>
          )}
      <section className="aps-household" aria-labelledby="household-heading"><span className="aps-icon"><Home size={21}/></span><div className="min-w-0"><h2 id="household-heading">Your household</h2>{isLoadingHousehold ? <p className="aps-muted">Loading household…</p> : hasHousehold ? <p className="aps-muted"><strong>{household.name}</strong> · {household.usualPeopleCount} {Number(household.usualPeopleCount) === 1 ? 'person' : 'people'}</p> : <p className="aps-muted">No household yet.</p>}</div></section>
      </div>
      </section>
      </div>
      </div>
      <section className="aps-section" aria-labelledby="preferences-heading">
        <div className="aps-heading"><span className="aps-section-mark" aria-hidden="true"/><h2 id="preferences-heading">Food preferences</h2></div>
        <form className="aps-preferences" onSubmit={handlePreferencesSave}>
          <div className="aps-diet">
            <fieldset disabled={isSavingPreferences} aria-label="Food choice">
              <div className="aps-diet-top"><h3>Food choice</h3><span className="aps-status" data-active="true">Selected: {dietLabel}</span></div>
              <div className="aps-diet-grid">{DIETARY_OPTIONS.map(renderDiet)}</div>
              <details className="aps-optional" open={OTHER_DIET_MODES.some((option) => option.value === chosenDiet) || undefined}>
                <summary>Other dietary preferences</summary>
                <div className="aps-diet-grid">{OTHER_DIET_MODES.map(renderDiet)}</div>
                <div className="aps-chips">{OPTIONAL_DIETARY_OPTIONS.map((option) => renderPreference('dietaryLifestyles',option))}</div>
              </details>
            </fieldset>
          </div>
          <div className="aps-pref-columns">
            <div><fieldset disabled={isSavingPreferences}><legend>Allergens to flag</legend><p className="aps-muted mt-1">Always check product labels for safety.</p><div className="aps-chips">{ALLERGEN_OPTIONS.map((option) => renderPreference('allergens',option))}</div></fieldset></div>
            <div><div className="aps-fields">
              <div className="aps-field"><label htmlFor="preferred-cuisines">Favorite cuisines</label><input id="preferred-cuisines" value={preferenceForm.preferredCuisines} onChange={(event) => setPreferenceForm((current) => ({ ...current, preferredCuisines: event.target.value }))} placeholder="Indian, Italian, Thai"/></div>
              <div className="aps-field"><label htmlFor="disliked-ingredients">Ingredients you dislike</label><input id="disliked-ingredients" value={preferenceForm.dislikedIngredients} onChange={(event) => setPreferenceForm((current) => ({ ...current, dislikedIngredients: event.target.value }))} placeholder="Olives, coriander"/></div>
              <div className="aps-field"><label htmlFor="measurement-system">Measurements</label><select id="measurement-system" value={preferenceForm.measurementSystem} onChange={(event) => setPreferenceForm((current) => ({ ...current, measurementSystem: event.target.value }))}><option value="metric">Metric</option><option value="imperial">Imperial</option></select></div>
              <div className="aps-field"><label htmlFor="account-locale">Language & region</label><select id="account-locale" value={preferenceForm.locale} onChange={(event) => setPreferenceForm((current) => ({ ...current, locale: event.target.value }))}>{LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            </div><p className="aps-muted mt-3">Separate multiple cuisines or ingredients with commas.</p></div>
          </div>
          <div className="aps-save-bar"><button type="submit" disabled={isSavingPreferences} className="aps-button aps-primary">{isSavingPreferences ? <LoaderCircle size={17} className="animate-spin"/> : <Save size={17}/>} Save food preferences</button>{preferenceMessage && <p className="aps-muted" role="status">{preferenceMessage}</p>}</div>
        </form>
      </section>

      <section className="aps-section" aria-labelledby="consent-heading">
        <div className="aps-heading"><span className="aps-section-mark" aria-hidden="true"/><h2 id="consent-heading">Privacy & permissions</h2></div>
        <div className="aps-privacy-content">
        <div className="aps-privacy">
          <div className="aps-privacy-column">
          <div className="aps-privacy-group">Required policies</div>
          {['terms_of_service','privacy_policy'].map((consentType) => {
            const item = consentByType.get(consentType)
            const terms = consentType === 'terms_of_service'
            return <div key={consentType} className="aps-consent-row"><div><div className="aps-inline"><h3>{formatConsentName(consentType)}</h3><ConsentStatus granted={item?.granted === true}/></div>{item?.currentVersion && <p className="aps-muted">Version: {item.currentVersion}</p>}<Link to={terms ? '/terms' : '/privacy-policy'}>Read {terms ? 'Terms & Conditions' : 'Privacy Policy'}</Link></div>{!item?.granted && <button type="button" disabled={activeConsentType === consentType} onClick={() => handleConsentDecision(consentType,'granted')} className="aps-button aps-primary">{activeConsentType === consentType ? <LoaderCircle size={17} className="animate-spin"/> : <Check size={17}/>} Accept</button>}</div>
          })}
          </div>
          <div className="aps-privacy-column">
          <div className="aps-privacy-group">Optional settings</div>
          {['marketing_email','personalization'].map((consentType) => {
            const enabled = consentByType.get(consentType)?.granted === true
            const isPersonalization = consentType === 'personalization'
            return <div key={consentType} className="aps-consent-row"><div><div className="aps-inline"><h3>{isPersonalization ? 'Personalized recommendations' : 'Marketing emails'}</h3><ConsentStatus granted={enabled} optional/></div><p className="aps-muted">{isPersonalization ? 'Use your food and household preferences for suggestions.' : 'Receive news and offers by email.'}</p>{isPersonalization && preferenceForm.personalizationEnabled !== enabled && <p className="aps-muted">Recommendations: {preferenceForm.personalizationEnabled ? 'On' : 'Off'}</p>}</div><button type="button" disabled={activeConsentType === consentType} onClick={() => handleConsentDecision(consentType,enabled ? 'revoked' : 'granted')} className={`aps-button ${enabled ? '' : 'aps-primary'}`}>{activeConsentType === consentType ? <LoaderCircle size={17} className="animate-spin"/> : enabled ? 'Disable' : 'Enable'}</button></div>
          })}
          </div>
        </div>
        {consents && !consents.requiredConsentsSatisfied && <p role="status" className="aps-warning">Accept the current Terms and Privacy Policy to finish account setup.</p>}
        </div>
      </section>
    </main>
  )
}
