import {
  Building2,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Send,
  Store,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  getHostCommercialProfile,
  getHostOperationalOrganization,
  getHostOperationsErrorMessage,
  submitHostCommercialProfile,
} from '../services/hostOperations.service'

const PROFILE_TYPES = [
  {
    value: 'seller',
    label: 'Seller',
    description: 'Sell products directly to customers.',
  },
  {
    value: 'b2b',
    label: 'B2B / Hospitality',
    description: 'Supply businesses, kitchens and hospitality teams.',
  },
  {
    value: 'brand',
    label: 'Brand',
    description: 'Manage branded products and your brand presence.',
  },
  {
    value: 'restaurant',
    label: 'Restaurant',
    description: 'Operate a restaurant or food outlet.',
  },
  {
    value: 'chef',
    label: 'Chef',
    description: 'Share recipes and chef-led food experiences.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Combine more than one business model in one account.',
  },
]

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

// Page-scoped styles keep the shared Host sidebar, navbar and footer unchanged.
const businessProfileStyles = String.raw`
.hbp-page {
  --hbp-forest: #173F35;
  --hbp-deep: #10372F;
  --hbp-clay: #C86C42;
  --hbp-sage: #E4EAE0;
  --hbp-porcelain: #F7F6F2;
  --hbp-ink: #202421;
  --hbp-muted: #53645B;
  width: 100%;
  min-width: 0;
  padding: clamp(17px, 2vw, 32px) clamp(13px, 2.25vw, 36px) 42px;
  background: var(--hbp-porcelain);
  color: var(--hbp-ink);
  font-family: 'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.55;
}
.hbp-page *, .hbp-page *::before, .hbp-page *::after {box-sizing: border-box;}
.hbp-page button, .hbp-page input, .hbp-page textarea {font: inherit;}
.hbp-page button:focus-visible, .hbp-page a:focus-visible,
.hbp-page input:focus-visible, .hbp-page textarea:focus-visible,
.hbp-page label:focus-within {outline: 3px solid var(--hbp-clay);outline-offset: 3px;}
.hbp-intro {display:grid;grid-template-columns:minmax(0,1.65fr) minmax(245px,.65fr);overflow:hidden;border-radius:18px;background:var(--hbp-forest);}
.hbp-intro-main {padding:clamp(25px,3.2vw,45px);position:relative;min-width:0;}
.hbp-eyebrow {display:flex;align-items:center;gap:10px;margin:0;color:var(--hbp-clay);font-size:13px;font-weight:800;letter-spacing:.065em;text-transform:uppercase;}
.hbp-eyebrow::before {content:'';display:block;width:23px;height:2px;background:currentColor;flex:none;}
.hbp-intro-main .hbp-eyebrow {color:#F3B79A;}
.hbp-title {margin:14px 0 0!important;color:#FFFDF8!important;font-size:clamp(29px,3vw,43px)!important;font-weight:800!important;line-height:1.14!important;letter-spacing:-.045em!important;}
.hbp-intro-copy {max-width:590px;margin:13px 0 0!important;color:#DBE6DF!important;font-size:16px!important;line-height:1.6!important;}
.hbp-intro-aside {display:flex;flex-direction:column;justify-content:center;gap:10px;padding:clamp(22px,2.5vw,34px);background:#E4EAE0;border-left:4px solid var(--hbp-clay);}
.hbp-aside-kicker {margin:0!important;font-size:13px!important;font-weight:800;color:#AD5633!important;letter-spacing:.065em;text-transform:uppercase;}
.hbp-org-name {display:flex;align-items:center;gap:11px;min-width:0;margin:0!important;color:var(--hbp-forest)!important;font-size:clamp(18px,1.7vw,24px)!important;font-weight:800!important;overflow-wrap:anywhere;line-height:1.27!important;letter-spacing:-.025em;}
.hbp-org-icon {display:grid;place-items:center;width:40px;height:40px;flex:none;color:#fff;background:var(--hbp-forest);border-radius:11px;}
.hbp-org-caption {margin:0!important;color:#516359!important;font-size:14px!important;line-height:1.5!important;}
.hbp-content {display:grid;grid-template-columns:minmax(0,1fr) minmax(245px,295px);align-items:start;gap:clamp(18px,2.2vw,31px);margin-top:30px;}
.hbp-editor {min-width:0;border-top:3px solid var(--hbp-clay);background:#FFFEFC;padding:clamp(21px,2.8vw,36px);}
.hbp-section-heading {margin:9px 0 0!important;color:var(--hbp-forest)!important;font-size:clamp(23px,2.2vw,30px)!important;font-weight:800!important;line-height:1.2!important;letter-spacing:-.035em;}
.hbp-section-copy {margin:9px 0 0!important;color:var(--hbp-muted)!important;font-size:15px!important;line-height:1.6!important;max-width:650px;}
.hbp-choices {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin-top:24px;border-top:1px solid #DDE4DA;}
.hbp-choice {min-width:0;display:flex;align-items:flex-start;gap:13px;cursor:pointer;border-bottom:1px solid #DDE4DA;border-left:3px solid transparent;padding:19px 14px 18px 12px;transition:background .18s ease,border-color .18s ease;}
.hbp-choice:hover {background:#F1F5EF;}
.hbp-choice[data-active='true'] {background:#E7EFE7;border-left-color:var(--hbp-clay);}
.hbp-choice input[type='radio'] {flex:none;width:19px;height:19px;margin:3px 0 0;accent-color:var(--hbp-forest);cursor:pointer;}
.hbp-choice-copy {display:block;min-width:0;flex:1;}
.hbp-choice-name {display:block;color:#203D33;font-size:17px;font-weight:800;line-height:1.35;}
.hbp-choice-description {display:block;margin-top:5px;color:#53635A;font-size:14px;line-height:1.55;}
.hbp-choice-check {flex:none;color:#1E5948;margin-top:2px;}
.hbp-note-area {margin-top:28px;padding-top:24px;border-top:1px solid #DBE3D9;}
.hbp-note-label {display:block;color:var(--hbp-forest);font-size:16px;font-weight:750;}
.hbp-optional {color:#728177;font-size:13px;font-weight:500;}
.hbp-textarea {display:block;margin-top:10px;width:100%;min-height:108px;padding:14px 16px;border:1px solid #C8D5CA;background:#fff;border-radius:10px;color:var(--hbp-ink);font-size:16px!important;line-height:1.55;resize:vertical;}
.hbp-textarea::placeholder {color:#79877C;}
.hbp-submit-bar {display:flex;align-items:center;justify-content:flex-end;margin-top:20px;gap:12px;}
.hbp-save-button {display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;border:1px solid var(--hbp-forest);border-radius:9px;background:var(--hbp-forest);color:#fff;padding:12px 21px;font-size:15px;font-weight:800;cursor:pointer;transition:background .17s ease,transform .17s ease;}
.hbp-save-button:hover:not(:disabled) {background:#255D4D;transform:translateY(-1px);}
.hbp-save-button:disabled {opacity:.6;cursor:not-allowed;}
.hbp-summary {min-width:0;background:var(--hbp-sage);border-top:3px solid var(--hbp-forest);padding:clamp(21px,2vw,29px);}
.hbp-summary-title {margin:9px 0 0!important;font-size:22px!important;font-weight:800!important;color:var(--hbp-forest)!important;letter-spacing:-.025em;line-height:1.25!important;}
.hbp-summary-block {margin-top:22px;padding-top:20px;border-top:1px solid #C9D4CA;}
.hbp-summary-label {margin:0!important;font-size:13px!important;font-weight:750;color:#65766B!important;letter-spacing:.04em;text-transform:uppercase;}
.hbp-summary-value {margin:7px 0 0!important;color:var(--hbp-forest)!important;font-size:21px!important;line-height:1.35!important;font-weight:800!important;overflow-wrap:anywhere;}
.hbp-summary-value-compact {font-size:17px!important;}
.hbp-summary-detail {margin:6px 0 0!important;font-size:14px!important;color:#52635A!important;line-height:1.55!important;}
.hbp-summary-time {margin:9px 0 0!important;color:#6D7B70!important;font-size:13px!important;}
.hbp-alert {display:flex;align-items:flex-start;gap:11px;margin-top:20px;border-left:4px solid;padding:14px 18px;font-size:15px;line-height:1.55;}
.hbp-alert-error {border-color:#BF4E40;background:#FFF0EB;color:#813B31;}
.hbp-alert-success {border-color:#2C7758;background:#E7F2E9;color:#173F35;}
.hbp-loading {display:flex;align-items:center;justify-content:center;gap:11px;min-height:170px;margin-top:24px;background:#E8EEE7;color:var(--hbp-forest);font-size:16px;font-weight:700;}
.hbp-onboarding {margin-top:26px;background:#F8EDE5;border-top:3px solid var(--hbp-clay);padding:clamp(22px,2.8vw,36px);}
.hbp-onboarding-icon {color:#AE542D;}
.hbp-onboarding-title {margin:13px 0 0!important;color:var(--hbp-forest)!important;font-size:24px!important;font-weight:800!important;}
.hbp-onboarding-copy {max-width:720px;color:#53635A;font-size:15px;line-height:1.6;margin:9px 0 20px;}
@media(max-width:920px) {
  .hbp-intro {grid-template-columns:1fr;}
  .hbp-intro-aside {border-left:0;border-top:3px solid var(--hbp-clay);padding:20px 27px;}
  .hbp-content {grid-template-columns:1fr;}
  .hbp-summary {display:grid;grid-template-columns:1fr 1fr;gap:0 20px;}
  .hbp-summary-head {grid-column:1/-1;}
}
/* Dedicated small-screen composition. Desktop and tablet rules above remain unchanged. */
@media (max-width:600px) {
  .hbp-page {
    padding:10px 10px 28px;
    background:#F7F6F2;
    font-size:15px;
  }

  /* Compact two-tone introduction instead of the desktop feature block. */
  .hbp-intro {
    display:flex;
    flex-direction:column;
    overflow:visible;
    border-radius:0;
    background:transparent;
  }
  .hbp-intro-main {
    padding:19px 18px 18px;
    border-radius:14px 14px 0 0;
    border-bottom:3px solid #C86C42;
    background:#173F35;
  }
  .hbp-intro-main .hbp-eyebrow {
    font-size:12.5px;
    letter-spacing:.045em;
  }
  .hbp-title {
    margin-top:9px!important;
    font-size:27px!important;
    line-height:1.13!important;
    letter-spacing:-.04em!important;
  }
  .hbp-intro-copy {
    margin-top:8px!important;
    font-size:14px!important;
    line-height:1.5!important;
  }
  .hbp-intro-aside {
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    min-width:0;
    padding:11px 15px;
    border:0;
    border-radius:0 0 14px 14px;
    background:#E4EAE0;
  }
  .hbp-aside-kicker {
    flex:none;
    margin:0!important;
    font-size:12.5px!important;
    letter-spacing:.025em;
  }
  .hbp-org-name {
    justify-content:flex-end;
    gap:8px;
    font-size:16px!important;
    line-height:1.25!important;
    text-align:right;
  }
  .hbp-org-icon {
    width:32px;
    height:32px;
    border-radius:9px;
  }
  .hbp-org-icon svg {width:17px;height:17px;}

  /* Open editorial content: no nested desktop panel or oversized empty padding. */
  .hbp-content {
    display:flex;
    flex-direction:column;
    gap:0;
    margin-top:20px;
  }
  .hbp-editor {
    border:0;
    background:transparent;
    padding:0 3px;
  }
  .hbp-editor > .hbp-eyebrow {
    color:#AC5430;
    font-size:12.5px;
  }
  .hbp-section-heading {
    margin-top:6px!important;
    font-size:23px!important;
    line-height:1.18!important;
  }
  .hbp-section-copy {
    margin-top:7px!important;
    font-size:14px!important;
    line-height:1.5!important;
  }

  /* Mobile-specific 2-column choice board; every option remains readable/tappable. */
  .hbp-choices {
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
    margin-top:17px;
    border:0;
  }
  .hbp-choice {
    display:grid;
    grid-template-columns:19px minmax(0,1fr) 17px;
    align-items:start;
    column-gap:7px;
    row-gap:0;
    min-height:115px;
    padding:13px 11px 12px;
    border:1px solid #D7DFD5;
    border-radius:12px;
    background:#FFFDF9;
    box-shadow:0 2px 7px rgba(23,63,53,.035);
    transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
    -webkit-tap-highlight-color:transparent;
  }
  .hbp-choice:nth-child(4n+2),
  .hbp-choice:nth-child(4n+3) {background:#EEF2EB;}
  .hbp-choice:hover {background:#E8EFE7;}
  .hbp-choice[data-active='true'] {
    border:1.5px solid #C86C42;
    background:#E0EADF;
    box-shadow:inset 0 3px 0 #C86C42,0 3px 10px rgba(23,63,53,.08);
  }
  .hbp-choice input[type='radio'] {
    grid-column:1;
    grid-row:1;
    width:18px;
    height:18px;
    margin:1px 0 0;
    accent-color:#173F35;
  }
  .hbp-choice-copy {
    grid-column:2 / 4;
    grid-row:1;
    padding-right:0;
  }
  .hbp-choice-name {
    padding-right:4px;
    font-size:15px;
    font-weight:800;
    line-height:1.34;
    overflow-wrap:break-word;
  }
  .hbp-choice-description {
    display:block;
    margin-top:5px;
    font-size:13px;
    line-height:1.45;
    color:#516158;
  }
  .hbp-choice-check {display:none;}

  /* Form action follows the choices naturally without an extra card. */
  .hbp-note-area {
    margin-top:22px;
    padding-top:17px;
    border-top:1px solid #D6DED4;
  }
  .hbp-note-label {font-size:15px;}
  .hbp-optional {font-size:13px;}
  .hbp-textarea {
    min-height:86px;
    padding:12px 13px;
    border-radius:10px;
    font-size:15px!important;
    line-height:1.5;
  }
  .hbp-submit-bar {justify-content:stretch;margin-top:14px;}
  .hbp-save-button {
    width:100%;
    min-height:49px;
    border-radius:10px;
    font-size:15px;
  }

  /* Compact, visually separate saved-profile strip rather than a tall side card. */
  .hbp-summary {
    order:-1;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    align-items:stretch;
    gap:10px;
    margin:0 0 17px;
    padding:16px 0 0;
    border-top:3px solid #173F35;
    background:transparent;
  }
  .hbp-summary-head {grid-column:1 / -1;}
  .hbp-summary-head .hbp-eyebrow {display:none;}
  .hbp-summary-title {
    margin:0!important;
    font-size:21px!important;
  }
  .hbp-summary-block {
    min-width:0;
    margin:0;
    padding:14px 13px;
    border:0;
    border-radius:10px;
    background:#E4EAE0;
  }
  .hbp-summary-block:last-child {background:#F5E8DF;}
  .hbp-summary-label {
    font-size:12.5px!important;
    letter-spacing:0;
    line-height:1.35;
  }
  .hbp-summary-value {
    margin-top:7px!important;
    font-size:18px!important;
    line-height:1.3!important;
  }
  .hbp-summary-value-compact {font-size:15px!important;}
  .hbp-summary-detail {
    font-size:13px!important;
    line-height:1.5!important;
  }
  .hbp-summary-time {font-size:12.5px!important;}
  .hbp-alert {margin-top:13px;padding:12px 13px;font-size:14px;}
  .hbp-loading {min-height:125px;margin-top:17px;}
  .hbp-onboarding {margin-top:18px;padding:20px 17px;}
  .hbp-onboarding-title {font-size:22px!important;}
}
@media (max-width:340px) {
  .hbp-choice {padding:11px 9px;column-gap:6px;}
  .hbp-choice-name {font-size:14px;}
  .hbp-choice-description {font-size:12.5px;}
  .hbp-intro-aside {padding-inline:11px;}
}
@media(prefers-reduced-motion:reduce) {
  .hbp-choice,.hbp-save-button {transition:none!important;}
}
`

export default function HostBusinessProfilePage() {
  const [organization, setOrganization] = useState(null)
  const [latestRequest, setLatestRequest] = useState(null)
  const [organizationType, setOrganizationType] = useState('seller')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [onboardingRequired, setOnboardingRequired] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const orgData = await getHostOperationalOrganization()

      if (!orgData?.organization) {
        setOnboardingRequired(true)
        setOrganization(null)
        return
      }

      setOnboardingRequired(false)

      const data = await getHostCommercialProfile()

      setOrganization(data?.organization || orgData.organization)
      setLatestRequest(data?.latestRequest || null)
      setOrganizationType(
        data?.organization?.organizationType ||
        orgData.organization.organizationType ||
        'seller',
      )
    } catch (requestError) {
      setError(
        getHostOperationsErrorMessage(
          requestError,
          'Unable to load Host business profile.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const data = await submitHostCommercialProfile({
        organizationType,
        note,
      })

      setOrganization(data?.organization || organization)
      setLatestRequest(data?.request || null)
      setNote('')
      setNotice('Business profile saved. EPANTRY operations has been notified.')
    } catch (requestError) {
      setError(
        getHostOperationsErrorMessage(
          requestError,
          'Unable to save Host business profile.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hbp-page">
      <style>{businessProfileStyles}</style>

      <header className="hbp-intro">
        <div className="hbp-intro-main">
          <p className="hbp-eyebrow">Host business setup</p>
          <h1 className="hbp-title">Choose your business type.</h1>
          <p className="hbp-intro-copy">
            Set up the right workspace for the way you run your business.
          </p>
        </div>
        <div className="hbp-intro-aside">
          <p className="hbp-aside-kicker">Your business</p>
          <p className="hbp-org-name">
            <span className="hbp-org-icon"><Store size={19} aria-hidden="true" /></span>
            {organization?.displayName || 'Host workspace'}
          </p>
        </div>
      </header>

      {error ? (
        <div className="hbp-alert hbp-alert-error" role="alert">
          <CircleAlert size={20} className="shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="hbp-alert hbp-alert-success" role="status">
          <CheckCircle2 size={20} className="shrink-0" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="hbp-loading" role="status">
          <LoaderCircle size={21} className="animate-spin" aria-hidden="true" />
          Loading business profile…
        </div>
      ) : onboardingRequired ? (
        <section className="hbp-onboarding">
          <Building2 size={26} className="hbp-onboarding-icon" aria-hidden="true" />
          <h2 className="hbp-onboarding-title">Complete your Host setup first</h2>
          <p className="hbp-onboarding-copy">
            Your business profile belongs to your Host workspace. Finish the initial setup before choosing a business type.
          </p>
          <Link to="/host/operations" className="hbp-save-button">
            Open Operations Center
          </Link>
        </section>
      ) : (
        <div className="hbp-content">
          <section className="hbp-editor" aria-labelledby="hbp-business-title">
            <p className="hbp-eyebrow">Business setup</p>
            <h2 id="hbp-business-title" className="hbp-section-heading">How do you operate?</h2>
            <p className="hbp-section-copy">
              Choose one type. Select Hybrid if more than one applies to your business.
            </p>

            <div className="hbp-choices" role="radiogroup" aria-label="Business type">
              {PROFILE_TYPES.map((item) => (
                <label
                  key={item.value}
                  className="hbp-choice"
                  data-active={organizationType === item.value}
                >
                  <input
                    type="radio"
                    name="organizationType"
                    value={item.value}
                    checked={organizationType === item.value}
                    onChange={() => setOrganizationType(item.value)}
                  />
                  <span className="hbp-choice-copy">
                    <span className="hbp-choice-name">{item.label}</span>
                    <span className="hbp-choice-description">{item.description}</span>
                  </span>
                  {organizationType === item.value ? (
                    <CheckCircle2 className="hbp-choice-check" size={19} aria-hidden="true" />
                  ) : null}
                </label>
              ))}
            </div>

            <div className="hbp-note-area">
              <label htmlFor="hbp-business-note" className="hbp-note-label">
                Business note <span className="hbp-optional">(optional)</span>
              </label>
              <textarea
                id="hbp-business-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={1200}
                placeholder="Add any details the operations team should know."
                className="hbp-textarea"
              />
            </div>

            <div className="hbp-submit-bar">
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="hbp-save-button"
              >
                {busy ? (
                  <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
                {busy ? 'Saving profile…' : 'Save business profile'}
              </button>
            </div>
          </section>

          <aside className="hbp-summary" aria-label="Saved business profile">
            <div className="hbp-summary-head">
              <p className="hbp-eyebrow">On record</p>
              <h2 className="hbp-summary-title">Your profile</h2>
            </div>
            <div className="hbp-summary-block">
              <p className="hbp-summary-label">Current business type</p>
              <p className="hbp-summary-value">
                {organization?.organizationType
                  ? titleize(organization.organizationType)
                  : 'Not set'}
              </p>
            </div>
            <div className="hbp-summary-block">
              <p className="hbp-summary-label">Latest update</p>
              {latestRequest ? (
                <>
                  <p className="hbp-summary-value hbp-summary-value-compact">
                    {titleize(latestRequest.organizationType)} submitted
                  </p>
                  <p className="hbp-summary-detail">
                    Shared with {latestRequest.notifiedAdminCount} operations admin account(s).
                  </p>
                  <p className="hbp-summary-time">
                    {latestRequest.createdAt
                      ? new Date(latestRequest.createdAt).toLocaleString()
                      : '—'}
                  </p>
                </>
              ) : (
                <p className="hbp-summary-detail">No profile updates submitted yet.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
