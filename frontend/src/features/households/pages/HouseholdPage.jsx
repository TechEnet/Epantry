import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Home,
  LoaderCircle,
  MailPlus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Users,
  XCircle,
} from 'lucide-react'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  useHousehold,
} from '../context/HouseholdContext'

import {
  removeHouseholdMember,
  updateHouseholdMemberRole,
} from '../services/household.service'

import {
  createHouseholdInvitation,
  listHouseholdInvitations,
  resendHouseholdInvitation,
  revokeHouseholdInvitation,
} from '../services/householdInvitation.service'

function getRoleLabel(
  role,
  roleLabel,
) {
  switch (role) {
    case 'owner':
      return 'Owner'

    case 'admin':
      return 'Admin'

    default: {
      const label =
        String(
          roleLabel ||
            '',
        ).trim()

      return label ||
        'Member'
    }
  }
}

const MEMBER_INVITE_ROLE_OPTIONS = [
  {
    value: 'member',
    label: 'Member',
    roleLabel: 'Member',
  },
  {
    value: 'partner',
    label: 'Partner / Spouse',
    roleLabel: 'Partner / Spouse',
  },
  {
    value: 'parent',
    label: 'Parent',
    roleLabel: 'Parent',
  },
  {
    value: 'child',
    label: 'Child',
    roleLabel: 'Child',
  },
  {
    value: 'other',
    label: 'Other',
    roleLabel: '',
  },
]

function getInviteRoleDetails(
  roleOption,
  customRoleLabel,
) {
  if (
    roleOption ===
    'admin'
  ) {
    return {
      role: 'admin',
      roleLabel: 'Admin',
    }
  }

  const option =
    MEMBER_INVITE_ROLE_OPTIONS.find(
      (entry) =>
        entry.value ===
        roleOption,
    ) ||
    MEMBER_INVITE_ROLE_OPTIONS[0]

  return {
    role: 'member',
    roleLabel:
      option.value ===
        'other'
        ? String(
            customRoleLabel ||
              '',
          ).trim()
        : option.roleLabel,
  }
}

function getInvitationStatusClasses(
  status,
) {
  switch (status) {
    case 'accepted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'

    case 'declined':
    case 'revoked':
      return 'border-stone-200 bg-stone-100 text-stone-600'

    case 'expired':
      return 'border-amber-200 bg-amber-50 text-amber-800'

    default:
      return 'border-blue-200 bg-blue-50 text-blue-800'
  }
}

function formatDate(
  value,
) {
  if (!value) {
    return 'Not available'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not available'
  }

  return date.toLocaleDateString()
}

function formatDateTime(
  value,
) {
  if (!value) {
    return 'Not available'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not available'
  }

  return date.toLocaleString()
}

function ActionNotice({
  notice,
}) {
  if (!notice?.message) {
    return null
  }

  const isError =
    notice.type ===
    'error'

  return (
    <div
      className={[
        'mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6',
        isError
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      ].join(' ')}
      role={
        isError
          ? 'alert'
          : 'status'
      }
    >
      {isError ? (
        <CircleAlert
          size={20}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          size={20}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      )}

      <span>
        {notice.message}
      </span>
    </div>
  )
}

const HOUSEHOLD_STYLES = "/* Household atelier / page-local editorial visual system. */\n.hh-page {\n  --hh-forest: #173F35;\n  --hh-clay: #C56C42;\n  --hh-ink: #202421;\n  --hh-sage: #D7DDCF;\n  --hh-paper: #F7F6F2;\n  --hh-rule: rgba(32,36,33,.14);\n  --hh-warm: #f3e4d9;\n  width: 100%; min-width: 0; overflow-x: clip;\n  padding: clamp(14px, 2.05vw, 30px) !important;\n  background: var(--hh-paper) !important; color: var(--hh-ink);\n  font-family: 'Plus Jakarta Sans', Inter, ui-sans-serif, sans-serif;\n}\n.hh-page, .hh-page * { box-sizing: border-box; }\n.hh-page h1,.hh-page h2,.hh-page h3 {font-family: inherit; letter-spacing:-.035em!important; line-height:1.17!important;}\n.hh-page h2 {font-size:clamp(22px,2.15vw,30px)!important;font-weight:750!important;color:var(--hh-ink)!important;}\n.hh-page h3 {font-size:17px!important;font-weight:700!important;}\n.hh-page p {line-height:1.55;}\n.hh-page button,.hh-page input,.hh-page select {font-family:inherit;}\n.hh-page button {cursor:pointer;transition:background-color .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease;}\n.hh-page button:disabled {cursor:not-allowed;opacity:.55;}\n.hh-page :is(button,input,select):focus-visible {outline:3px solid var(--hh-clay)!important;outline-offset:3px;}\n.hh-page .hh-eyebrow {font-size:12px!important;font-weight:800!important;letter-spacing:.125em!important;text-transform:uppercase;color:#9a4b29!important;}\n.hh-page .hh-eyebrow::before {content:'';display:inline-block;width:16px;height:2px;background:currentColor;vertical-align:middle;margin:0 10px 3px 0;}\n/* The hero is an intentional split composition, not two repeated cards. */\n.hh-hero {display:grid;grid-template-columns:minmax(0,1.5fr) minmax(288px,.7fr);min-height:286px;position:relative;overflow:hidden;border:0;border-radius:21px;background:var(--hh-clay)!important;box-shadow:0 22px 42px -33px #7d3e27a8;}\n.hh-hero-intro {display:flex;flex-direction:column;justify-content:center;align-items:flex-start;min-width:0;position:relative;isolation:isolate;padding:clamp(29px,4vw,58px);background:linear-gradient(122deg,#D3835C 0%,#C56C42 59%,#AD5935 100%)!important;}\n.hh-hero-intro::after {content:'';position:absolute;right:-57px;bottom:-130px;width:360px;height:360px;border:1px solid #f5d8c73b;border-radius:50%;box-shadow:0 0 0 45px #ffffff09,0 0 0 91px #ffffff09;pointer-events:none;z-index:-1;}\n.hh-hero-eyebrow {color:#fff4e9!important;font-size:12px;letter-spacing:.15em;font-weight:800;text-transform:uppercase;display:inline-flex;align-items:center;gap:9px;}\n.hh-hero-eyebrow::before {content:'';width:27px;height:2px;background:#fff2e6;}\n.hh-hero h1 {font-size:clamp(36px,4.1vw,62px)!important;font-weight:780!important;color:#201f1b!important;letter-spacing:-.062em!important;line-height:1.04!important;margin:20px 0 15px!important;max-width:800px;overflow-wrap:anywhere;}\n.hh-hero-description {color:#31291f!important;font-size:clamp(14px,1.12vw,17px)!important;line-height:1.62!important;font-weight:600!important;max-width:565px;}\n.hh-hero-state {position:relative;isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;gap:25px;min-width:0;padding:clamp(27px,3vw,42px);background:var(--hh-forest)!important;color:var(--hh-paper)!important;}\n.hh-hero-state::before {content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,transparent 0 39px,#ffffff05 40px 41px);pointer-events:none;z-index:-1;}\n.hh-state-label {font-size:12px!important;font-weight:750!important;letter-spacing:.11em;color:#dce5d8!important;display:flex;align-items:center;gap:10px;text-transform:uppercase;}\n.hh-state-label svg {color:#efb28f;flex-shrink:0;}\n.hh-state-role {color:var(--hh-paper)!important;font-size:clamp(29px,2.7vw,42px)!important;font-weight:780;line-height:1.1;letter-spacing:-.04em;margin:15px 0 9px;}\n.hh-state-desc {color:#d9e3db!important;font-size:14px!important;}\n.hh-state-bottom {display:flex;flex-wrap:wrap;align-items:end;gap:16px;justify-content:space-between;border-top:1px solid #ffffff3a;padding-top:20px;}\n.hh-state-members {color:#edf2ec!important;font-size:14px!important;font-weight:650;}\n.hh-state-members strong {font-size:31px;color:#f9ede5;font-weight:800;line-height:1;padding-right:6px;}\n.hh-state-refresh {display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:43px;border-radius:9px;padding:0 17px!important;background:var(--hh-paper)!important;color:var(--hh-forest)!important;border:1px solid var(--hh-paper)!important;font-size:14px!important;font-weight:750!important;}\n.hh-state-refresh:hover {background:var(--hh-sage)!important;transform:translateY(-1px);}\n/* Guided steps: a considered editorial strip that also links visually. */\n.hh-steps {margin:32px 0 0!important;padding:clamp(22px,2.4vw,31px)!important;background:#e3e7dd!important;border:0!important;border-radius:17px;}\n.hh-section-head {display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:23px;}\n.hh-steps h2 {margin:8px 0 0!important;max-width:730px;}\n.hh-intro-description {max-width:330px;color:#45564b!important;font-size:14px!important;font-weight:550;}\n.hh-step-row {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid #98ae9c;}\n.hh-step {min-width:0;position:relative;padding:21px 17px 0 0;}\n.hh-step + .hh-step {padding-left:22px;border-left:1px solid #b5c3b7;}\n.hh-step-marker {display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;}\n.hh-step-num {color:var(--hh-clay)!important;font-size:32px;font-weight:800;line-height:1;letter-spacing:-.06em;}\n.hh-step-marker svg {color:var(--hh-forest);width:20px;height:20px;flex-shrink:0;}\n.hh-step h3 {color:var(--hh-forest)!important;margin:0 0 9px!important;}\n.hh-step p {color:#4b5b51!important;font-size:13.5px!important;line-height:1.62!important;margin:0!important;}\n/* Account selection: separate title, rich active state, ledger-like other entries. */\n.hh-accounts-group {margin:36px 0 0!important;padding:clamp(24px,2.8vw,38px)!important;border:1px solid #d3dacd!important;background:#fcfaf6!important;border-radius:20px!important;box-shadow:0 17px 36px -32px #3b453c5e!important;}\n.hh-households {background:transparent!important;border:0!important;padding:0!important;border-radius:0!important;box-shadow:none!important;}\n.hh-households-heading {padding:0 0 20px!important;border-bottom:1px solid #c6cec4!important;}\n.hh-households-heading h2 {margin:9px 0 0!important;}\n.hh-households-heading p:not(.hh-eyebrow) {font-size:14px!important;color:#56635b!important;line-height:1.5!important;margin-top:9px!important;}\n.hh-households-list {margin:9px 0 0!important;display:grid!important;grid-template-columns:1fr!important;gap:0!important;}\n.hh-household-option {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px;min-width:0;padding:18px 19px!important;border:0!important;border-bottom:1px solid #d6dcd2!important;border-radius:0!important;background:transparent!important;transition:background .18s ease!important;box-shadow:none!important;}\n.hh-household-option:hover {background:#e8ece2!important;}\n.hh-household-option.is-current {margin:13px 0 6px;border:1px solid #b1c0b2!important;border-left:5px solid var(--hh-clay)!important;border-radius:12px!important;background:linear-gradient(115deg,#dae4d7,#e9eae2)!important;box-shadow:0 11px 20px -21px #173f35!important;}\n.hh-household-option > div {min-width:0;flex:1;}\n.hh-household-option > div > div {min-width:0;}\n.hh-household-option p:first-child {font-size:18px!important;font-weight:800!important;color:var(--hh-forest)!important;white-space:normal!important;overflow-wrap:anywhere;}\n.hh-household-option p:nth-child(2) {font-size:14px!important;color:#4b5d51!important;}\n.hh-household-option span[class*='rounded-full'] {display:inline-flex!important;align-items:center;padding:5px 12px;border-radius:999px;background:var(--hh-forest)!important;color:var(--hh-paper)!important;border:0!important;font-size:12px!important;font-weight:750!important;}\n.hh-household-option > button {margin:0!important;background:var(--hh-forest)!important;color:var(--hh-paper)!important;border-radius:9px!important;min-height:43px;padding-inline:17px!important;font-weight:700!important;}\n.hh-household-option > button:hover {background:#27614d!important;}\n.hh-facts {display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;margin:24px 0 0!important;overflow:hidden;border:0!important;border-radius:12px!important;background:var(--hh-forest)!important;}\n.hh-fact {border:0!important;border-radius:0!important;background:transparent!important;padding:21px 26px!important;box-shadow:none!important;min-width:0;}\n.hh-fact + .hh-fact {border-left:1px solid #ffffff3a!important;}\n.hh-fact svg {width:19px;height:19px;color:#e4a37e!important;}\n.hh-fact p:nth-of-type(1) {font-size:12px!important;color:#e2e8df!important;letter-spacing:.06em;font-weight:750!important;margin:10px 0 6px!important;}\n.hh-fact p:nth-of-type(2) {font-size:clamp(16px,1.4vw,21px)!important;color:var(--hh-paper)!important;font-weight:780!important;line-height:1.3!important;overflow-wrap:anywhere;white-space:normal!important;}\n/* People management has a warm invitation band, then a quiet roster. */\n.hh-management {margin-top:35px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}\n.hh-invite {padding:clamp(24px,3vw,42px)!important;border-radius:20px!important;border:0!important;background:linear-gradient(115deg,#e9bfaa 0%,#edd1bc 55%,#f5e9de 100%)!important;position:relative;overflow:hidden;}\n.hh-invite::after {content:'';position:absolute;width:270px;height:270px;right:-160px;top:-155px;border:1px solid #ad613848;border-radius:50%;box-shadow:0 0 0 33px #c56c420d;pointer-events:none;}\n.hh-invite h2 {color:var(--hh-ink)!important;margin:8px 0 0!important;}\n.hh-invite .hh-eyebrow {color:#8b421f!important;}\n.hh-invite p:not(.hh-eyebrow) {color:#4d3e32!important;font-size:14px!important;line-height:1.55!important;}\n.hh-invite > div:first-child > div:last-child {background:var(--hh-forest)!important;color:var(--hh-paper)!important;border-color:var(--hh-forest)!important;font-size:13px!important;padding:8px 14px!important;white-space:nowrap;}\n.hh-invite form {position:relative;display:grid!important;grid-template-columns:minmax(175px,.85fr) minmax(230px,1.6fr) minmax(150px,.8fr) auto!important;gap:13px!important;margin-top:23px!important;align-items:start;}\n.hh-invite input,.hh-invite select {min-height:49px!important;width:100%!important;min-width:0!important;padding:0 15px!important;border:1px solid #ae9f8e!important;border-radius:10px!important;background:#fffdf9!important;color:var(--hh-ink)!important;font-size:14px!important;box-shadow:0 2px 0 #ffffff65!important;}\n.hh-invite input::placeholder {color:#77726c!important;font-size:14px!important;}\n.hh-invite button[type='submit'] {min-height:49px!important;padding:0 20px!important;border-radius:10px!important;background:var(--hh-forest)!important;color:var(--hh-paper)!important;font-size:14px!important;font-weight:750!important;white-space:nowrap!important;}\n.hh-invite button[type='submit']:hover {background:#28634f!important;transform:translateY(-1px);}\n.hh-members {padding:27px 0!important;margin-top:26px!important;border:0!important;border-top:1px solid #c7cec4!important;border-bottom:1px solid #c7cec4!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;}\n.hh-members h2,.hh-invitations h2 {margin:9px 0 0!important;}\n.hh-members >div:first-child svg {color:var(--hh-clay)!important;}\n.hh-members-list {margin:17px 0 0!important;display:grid!important;gap:0!important;}\n.hh-person {position:relative;border:0!important;border-bottom:1px solid #d2d9cd!important;border-radius:0!important;padding:18px 12px!important;background:transparent!important;box-shadow:none!important;transition:background .18s ease!important;}\n.hh-person:hover,.hh-person:focus-within {background:#e4e9df!important;}\n.hh-person >div {gap:20px!important;}\n.hh-person-avatar {display:grid;place-items:center;flex-shrink:0;width:47px;height:47px;border-radius:50%;background:var(--hh-sage);color:var(--hh-forest);border:2px solid #fffdf9;font-size:19px!important;font-weight:800;}\n.hh-person p:first-child {font-size:16px!important;color:var(--hh-ink)!important;font-weight:750!important;}\n.hh-person p:nth-child(2) {font-size:13px!important;color:#5a665d!important;}\n.hh-person span[class*='rounded-full'] {font-size:12px!important;}\n.hh-person select {background:#fffdf9!important;border:1px solid #becbbb!important;min-height:42px!important;border-radius:10px!important;font-size:13px!important;padding-inline:12px!important;}\n.hh-person button {min-height:42px!important;border-radius:10px!important;font-size:13px!important;}\n.hh-invitations {margin-top:27px!important;padding:clamp(24px,2.8vw,34px)!important;background:#e3e8de!important;border:1px solid #c8d2c5!important;border-radius:18px!important;box-shadow:none!important;}\n.hh-invitations > div:first-child svg {color:var(--hh-forest)!important;}\n.hh-invitations-list {margin-top:15px!important;display:grid!important;gap:0!important;}\n.hh-invitation-row {padding:17px 4px!important;border:0!important;border-bottom:1px solid #c4d0c3!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;}\n.hh-invitation-row:hover,.hh-invitation-row:focus-within {background:#d3dfd2!important;}\n.hh-invitation-row p:first-child {color:var(--hh-ink)!important;font-size:15px!important;font-weight:750!important;}\n.hh-invitation-row div[class*='gap-x'] {font-size:13px!important;line-height:1.6!important;color:#4e5d54!important;}\n.hh-invitation-row button {min-height:42px!important;padding-inline:13px!important;font-size:13px!important;}\n.hh-invitation-row span[class*='rounded-full'] {font-size:12px!important;}\n.hh-page :is(.hh-members,.hh-invitations) p:not(.hh-eyebrow) {line-height:1.55;}\n@media(max-width:1130px) {\n .hh-invite form {grid-template-columns:repeat(2,minmax(0,1fr))!important;}\n .hh-invite form > button {grid-column:auto!important;}\n .hh-step-row {grid-template-columns:repeat(2,minmax(0,1fr));}\n .hh-step {padding-bottom:19px;}\n .hh-step:nth-child(3) {border-left:0;padding-left:0;border-top:1px solid #b5c3b7;}\n .hh-step:nth-child(4) {border-top:1px solid #b5c3b7;}\n}\n@media(max-width:720px) {\n .hh-page {padding:12px!important;}\n .hh-hero {grid-template-columns:minmax(0,1fr);border-radius:16px;min-height:0;}\n .hh-hero-intro,.hh-hero-state {padding:25px 21px;}\n .hh-hero h1 {font-size:clamp(30px,7.8vw,43px)!important;margin:15px 0 12px!important;}\n .hh-hero-state {gap:17px;}\n .hh-state-role {font-size:30px!important;margin-top:9px;}\n .hh-state-bottom {padding-top:14px;}\n .hh-steps {margin-top:20px!important;padding:20px 17px!important;}\n .hh-section-head {display:block;margin-bottom:17px;}\n .hh-intro-description {margin-top:10px;max-width:none;}\n .hh-step-row {grid-template-columns:repeat(2,minmax(0,1fr));}\n .hh-step {padding:17px 11px 16px 0;}\n .hh-step + .hh-step {padding-left:12px;}\n .hh-step:nth-child(3) {padding-left:0;}\n .hh-step-num {font-size:26px;}\n .hh-step h3 {font-size:15px!important;}\n .hh-step p {font-size:13px!important;}\n .hh-accounts-group {padding:20px 16px!important;margin-top:21px!important;border-radius:15px!important;}\n .hh-household-option {padding:14px 12px!important;}\n .hh-household-option.is-current {padding:14px 13px!important;}\n .hh-fact {padding:14px 13px!important;}\n .hh-fact p:nth-of-type(2) {font-size:15px!important;}\n .hh-invite {padding:23px 18px!important;border-radius:15px!important;}\n .hh-invite form {grid-template-columns:1fr!important;gap:10px!important;}\n .hh-invite form > button {grid-column:1!important;}\n .hh-management {margin-top:22px!important;}\n .hh-members {margin-top:20px!important;}\n .hh-person >div {gap:11px!important;}\n .hh-page h2 {font-size:22px!important;}\n .hh-invitations {margin-top:22px!important;padding:21px 16px!important;border-radius:15px!important;}\n .hh-household-option > button {width:100%;}\n}\n@media(max-width:440px) {\n .hh-facts {grid-template-columns:repeat(2,minmax(0,1fr))!important;}\n .hh-fact:first-child {grid-column:1/-1;border-bottom:1px solid #ffffff3a!important;}\n .hh-fact:nth-child(2) {border-left:0!important;}\n .hh-invite > div:first-child {align-items:start;}\n .hh-person-avatar {width:40px;height:40px;font-size:16px!important;}\n .hh-step p {font-size:12.7px!important;}\n}\n@media(prefers-reduced-motion:reduce) {.hh-page * {transition:none!important;scroll-behavior:auto!important;}}\n\n/* Mobile-only Household layout: use available width, retain clear data and controls. */\n@media (max-width: 639px) {\n  .hh-page {\n    width: calc(100% + 16px) !important;\n    max-width: none !important;\n    min-width: 0 !important;\n    margin: 0 -8px !important;\n    padding: 0 0 16px !important;\n    overflow-x: clip;\n  }\n  .hh-page > div { width: 100%; min-width: 0; }\n  .hh-page :is(.hh-hero,.hh-steps,.hh-accounts-group,.hh-invite,.hh-members,.hh-invitations) {\n    width: 100%; min-width: 0; max-width: 100%;\n  }\n  .hh-page :is(.hh-hero,.hh-steps,.hh-accounts-group,.hh-invite,.hh-invitations) {\n    border-radius: 13px !important;\n  }\n  /* Compact introduction; the active role stays readable and Refresh remains usable. */\n  .hh-hero { grid-template-columns: minmax(0,1fr); min-height: 0 !important; box-shadow: none !important; }\n  .hh-hero-intro { padding: 17px 17px 15px !important; }\n  .hh-hero-eyebrow { font-size: 11px !important; letter-spacing: .08em !important; }\n  .hh-hero-eyebrow::before { width: 19px; }\n  .hh-hero h1 { font-size: clamp(26px,7.3vw,30px) !important; line-height: 1.13 !important; margin: 9px 0 6px !important; letter-spacing: -.045em !important; }\n  .hh-hero-description { font-size: 13.5px !important; line-height: 1.42 !important; max-width: none; }\n  .hh-hero-state { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 13px 16px !important; }\n  .hh-hero-state > div:first-child { min-width: 0; }\n  .hh-state-label { font-size: 11px !important; letter-spacing: .035em !important; gap: 5px; }\n  .hh-state-label svg { width: 14px; height: 14px; }\n  .hh-state-role { font-size: 25px !important; margin: 6px 0 0 !important; }\n  .hh-state-desc { display: none !important; }\n  .hh-state-bottom { border: 0 !important; padding: 0 !important; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; flex-wrap: nowrap; gap: 7px; }\n  .hh-state-members { font-size: 11px !important; white-space: nowrap; }\n  .hh-state-members strong { font-size: 22px; padding-right: 4px; }\n  .hh-state-refresh { min-height: 36px !important; padding: 0 10px !important; font-size: 12px !important; gap: 5px; }\n  .hh-state-refresh svg { width: 14px; height: 14px; }\n  /* Four-step help becomes a compact, two-column directory instead of tall cards. */\n  .hh-steps { margin: 18px 0 0 !important; padding: 16px 15px !important; }\n  .hh-section-head { margin-bottom: 11px !important; }\n  .hh-page .hh-eyebrow { font-size: 11.5px !important; letter-spacing: .055em !important; }\n  .hh-page .hh-eyebrow::before { width: 12px; margin-right: 6px; }\n  .hh-steps h2 { margin: 5px 0 0 !important; font-size: 20px !important; }\n  .hh-intro-description { display: none !important; }\n  .hh-step-row { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0; }\n  .hh-step,.hh-step + .hh-step,.hh-step:nth-child(3),.hh-step:nth-child(4) { min-width: 0; padding: 12px 9px !important; }\n  .hh-step:nth-child(odd) { padding-left: 0 !important; border-left: 0 !important; }\n  .hh-step:nth-child(even) { border-left: 1px solid #b5c3b7 !important; }\n  .hh-step:nth-child(n + 3) { border-top: 1px solid #b5c3b7 !important; }\n  .hh-step-marker { margin-bottom: 5px; }\n  .hh-step-num { font-size: 22px !important; }\n  .hh-step-marker svg { width: 16px; height: 16px; }\n  .hh-step h3 { margin: 0 !important; font-size: 13.5px !important; line-height: 1.32 !important; overflow-wrap: anywhere; }\n  .hh-step p { display: none !important; }\n  /* Household details stay complete, but no longer sit inside multiple wide gutters. */\n  .hh-accounts-group { margin: 19px 0 0 !important; padding: 17px 15px !important; }\n  .hh-households-heading { padding-bottom: 10px !important; }\n  .hh-households-heading h2 { font-size: 20px !important; margin: 5px 0 0 !important; }\n  .hh-households-heading p:not(.hh-eyebrow) { display: none !important; }\n  .hh-households-list { margin-top: 5px !important; }\n  .hh-household-option,.hh-household-option.is-current { padding: 12px !important; gap: 10px; }\n  .hh-household-option p:first-child { font-size: 16px !important; }\n  .hh-household-option p:nth-child(2) { font-size: 12.5px !important; }\n  .hh-household-option > button { width: auto !important; min-height: 40px !important; margin-top: 1px !important; font-size: 13px !important; }\n  .hh-facts { margin: 13px 0 0 !important; grid-template-columns: repeat(3,minmax(0,1fr)) !important; border-radius: 9px !important; }\n  .hh-fact,.hh-fact:first-child { grid-column: auto !important; padding: 11px 9px !important; border-bottom: 0 !important; }\n  .hh-fact:nth-child(2) { border-left: 1px solid #ffffff3a !important; }\n  .hh-fact svg { height: 17px; width: 17px; }\n  .hh-fact p:nth-of-type(1) { font-size: 11px !important; margin: 6px 0 3px !important; letter-spacing: 0 !important; }\n  .hh-fact p:nth-of-type(2) { font-size: 12.5px !important; line-height: 1.35 !important; }\n  /* Keep invitations and permission controls: compact groups, not tiny text. */\n  .hh-management { margin-top: 19px !important; }\n  .hh-invite { padding: 17px 15px !important; }\n  .hh-invite h2,.hh-members h2,.hh-invitations h2 { font-size: 20px !important; margin: 5px 0 0 !important; }\n  .hh-invite form { grid-template-columns: minmax(0,1fr) !important; gap: 9px !important; margin-top: 12px !important; }\n  .hh-invite form > button { grid-column: 1 / -1 !important; }\n  .hh-invite select,.hh-invite input { min-height: 43px !important; height: auto; font-size: 14px !important; }\n  .hh-invite input::placeholder { font-size: 13px !important; }\n  .hh-invite button[type=submit] { min-height: 43px !important; font-size: 14px !important; }\n  .hh-members { margin-top: 19px !important; padding: 17px 0 !important; }\n  .hh-members-list { margin-top: 10px !important; }\n  .hh-person { padding: 12px 5px !important; }\n  .hh-person > div { gap: 9px !important; }\n  .hh-person-avatar { width: 38px; height: 38px; }\n  .hh-person p:first-child { font-size: 15px !important; }\n  .hh-person p:nth-child(2) { font-size: 12.5px !important; }\n  .hh-person :is(select,button) { min-height: 40px !important; font-size: 13px !important; }\n  .hh-invitations { margin-top: 19px !important; padding: 17px 15px !important; }\n  .hh-invitations-list { margin-top: 8px !important; }\n  .hh-invitation-row { padding: 12px 0 !important; }\n  .hh-invitation-row p:first-child { font-size: 14px !important; }\n  .hh-invitation-row button { min-height: 40px !important; font-size: 12.5px !important; }\n  .hh-page :is(input,select,button) { max-width: 100%; }\n}\n@media (max-width: 350px) {\n  .hh-hero-state { grid-template-columns: minmax(0,1fr); }\n  .hh-state-bottom { flex-direction: row; justify-content: space-between; align-items: center; }\n  .hh-step h3 { font-size: 12.5px !important; }\n}\n"

export default function HouseholdPage() {
  const {
    currentUser,
  } = useAuth()

  const {
    household,
    membership,
    households,
    members,
    hasHousehold,
    isLoadingHousehold,
    isCreatingHousehold,
    isLoadingMembers,
    householdError,
    membersError,
    refreshHousehold,
    createHousehold,
    selectHousehold,
    loadMembers,
  } = useHousehold()

  const [
    form,
    setForm,
  ] = useState({
    name:
      '',
    usualPeopleCount:
      '1',
  })

  const [
    formError,
    setFormError,
  ] = useState('')

  const [
    inviteForm,
    setInviteForm,
  ] = useState({
    householdId:
      '',
    email:
      '',
    role:
      'member',
    customRoleLabel:
      '',
  })

  const [
    invitations,
    setInvitations,
  ] = useState([])

  const [
    isLoadingInvitations,
    setIsLoadingInvitations,
  ] = useState(false)

  const [
    invitationError,
    setInvitationError,
  ] = useState('')

  const [
    actionKey,
    setActionKey,
  ] = useState('')

  const [
    notice,
    setNotice,
  ] = useState(null)

  const manageableHouseholds =
    useMemo(
      () =>
        (Array.isArray(
          households,
        )
          ? households
          : []
        ).filter(
          (entry) =>
            entry?.membership?.role ===
              'owner' ||
            entry?.membership?.role ===
              'admin',
        ),
      [
        households,
      ],
    )

  const inviteTarget =
    useMemo(
      () =>
        manageableHouseholds.find(
          (entry) =>
            entry?.household?.id ===
            inviteForm.householdId,
        ) ||
        null,
      [
        manageableHouseholds,
        inviteForm.householdId,
      ],
    )

  const canManageHousehold =
    membership?.role ===
      'owner' ||
    membership?.role ===
      'admin'

  const canSendInvites =
    manageableHouseholds.length >
    0

  const isOwner =
    membership?.role ===
    'owner'

  const inviteTargetIsOwner =
    inviteTarget?.membership?.role ===
    'owner'

  useEffect(() => {
    if (
      manageableHouseholds.length ===
      0
    ) {
      setInviteForm(
        (current) => ({
          ...current,
          householdId:
            '',
        }),
      )
      return
    }

    const stillAvailable =
      manageableHouseholds.some(
        (entry) =>
          entry?.household?.id ===
          inviteForm.householdId,
      )

    if (stillAvailable) {
      return
    }

    const preferred =
      manageableHouseholds.find(
        (entry) =>
          entry?.household?.id ===
          household?.id,
      ) ||
      manageableHouseholds[0]

    setInviteForm(
      (current) => ({
        ...current,
        householdId:
          preferred?.household?.id ||
          '',
        role:
          'member',
        customRoleLabel:
          '',
      }),
    )
  }, [
    manageableHouseholds,
    household?.id,
    inviteForm.householdId,
  ])

  const activeInvitationCount =
    useMemo(
      () =>
        invitations.filter(
          (invitation) =>
            invitation.status ===
            'pending',
        ).length,
      [
        invitations,
      ],
    )

  const loadInvitations =
    useCallback(
      async () => {
        if (
          !inviteForm.householdId ||
          !inviteTarget
        ) {
          setInvitations([])
          setInvitationError('')
          return []
        }

        setIsLoadingInvitations(
          true,
        )
        setInvitationError('')

        try {
          const data =
            await listHouseholdInvitations(
              inviteForm.householdId,
            )

          const nextInvitations =
            Array.isArray(
              data?.invitations,
            )
              ? data.invitations
              : []

          setInvitations(
            nextInvitations,
          )

          return nextInvitations
        } catch (error) {
          setInvitationError(
            error?.message ||
              'Unable to load household invitations.',
          )
          throw error
        } finally {
          setIsLoadingInvitations(
            false,
          )
        }
      },
      [
        inviteForm.householdId,
        inviteTarget,
      ],
    )

  useEffect(() => {
    if (
      !hasHousehold ||
      !household?.id
    ) {
      return
    }

    void loadMembers()
      .catch(
        () => undefined,
      )
  }, [
    hasHousehold,
    household?.id,
    loadMembers,
  ])

  useEffect(() => {
    if (
      !hasHousehold ||
      !inviteForm.householdId ||
      !inviteTarget
    ) {
      setInvitations([])
      return
    }

    void loadInvitations()
      .catch(
        () => undefined,
      )
  }, [
    hasHousehold,
    inviteForm.householdId,
    inviteTarget,
    loadInvitations,
  ])

  const updateField =
    (
      key,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [key]:
            value,
        }),
      )
      setFormError('')
    }

  const handleCreate =
    async (
      event,
    ) => {
      event.preventDefault()

      const name =
        form.name.trim()

      const usualPeopleCount =
        Number(
          form.usualPeopleCount,
        )

      if (
        name.length <
        2
      ) {
        setFormError(
          'Enter a household name with at least 2 characters.',
        )
        return
      }

      if (
        !Number.isInteger(
          usualPeopleCount,
        ) ||
        usualPeopleCount <
          1 ||
        usualPeopleCount >
          50
      ) {
        setFormError(
          'Usual people count must be between 1 and 50.',
        )
        return
      }

      try {
        await createHousehold({
          name,
          usualPeopleCount,
        })
        setFormError('')
      } catch (error) {
        setFormError(
          error?.message ||
            'Unable to create your household.',
        )
      }
    }

  const handleInvite =
    async (
      event,
    ) => {
      event.preventDefault()

      if (
        !inviteForm.householdId ||
        !inviteTarget ||
        actionKey
      ) {
        return
      }

      const email =
        inviteForm.email
          .trim()
          .toLowerCase()

      if (!email) {
        setNotice({
          type:
            'error',
          message:
            'Enter the email address you want to invite.',
        })
        return
      }

      const roleDetails =
        getInviteRoleDetails(
          inviteForm.role,
          inviteForm.customRoleLabel,
        )

      if (
        inviteForm.role ===
          'other' &&
        !roleDetails.roleLabel
      ) {
        setNotice({
          type:
            'error',
          message:
            'Enter a name for the custom household role.',
        })
        return
      }

      if (
        inviteForm.role ===
          'other' &&
        ['owner', 'admin'].includes(
          roleDetails.roleLabel
            .toLowerCase(),
        )
      ) {
        setNotice({
          type:
            'error',
          message:
            'Owner and Admin are reserved household access roles. Choose the matching role option instead.',
        })
        return
      }

      const role =
        inviteTargetIsOwner
          ? roleDetails.role
          : 'member'

      const roleLabel =
        role ===
          'admin'
          ? 'Admin'
          : roleDetails.roleLabel

      setActionKey(
        'create-invitation',
      )
      setNotice(null)

      try {
        const result =
          await createHouseholdInvitation(
            inviteForm.householdId,
            {
              email,
              role,
              roleLabel,
            },
          )

        setInviteForm(
          (current) => ({
            ...current,
            email:
              '',
            role:
              'member',
            customRoleLabel:
              '',
          }),
        )

        await loadInvitations()

        const delivered =
          result?.delivery
            ?.delivered ===
          true

        setNotice({
          type:
            'success',
          message:
            delivered
              ? `Invitation sent to ${email}.`
              : `Invitation created for ${email}. Email delivery is pending retry, so you can use Resend after delivery is restored.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to create the household invitation.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleResendInvitation =
    async (
      invitation,
    ) => {
      if (
        !inviteForm.householdId ||
        !invitation?.id ||
        actionKey
      ) {
        return
      }

      setActionKey(
        `resend:${invitation.id}`,
      )
      setNotice(null)

      try {
        const result =
          await resendHouseholdInvitation(
            inviteForm.householdId,
            invitation.id,
          )

        await loadInvitations()

        setNotice({
          type:
            'success',
          message:
            result?.delivery
              ?.delivered ===
            true
              ? `Invitation resent to ${invitation.invitedEmail}. The previous link is no longer valid.`
              : `Invitation link was rotated for ${invitation.invitedEmail}, but email delivery is pending retry.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to resend the household invitation.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleRevokeInvitation =
    async (
      invitation,
    ) => {
      if (
        !inviteForm.householdId ||
        !invitation?.id ||
        actionKey
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `Revoke the invitation for ${invitation.invitedEmail}?`,
        )

      if (!confirmed) {
        return
      }

      setActionKey(
        `revoke:${invitation.id}`,
      )
      setNotice(null)

      try {
        await revokeHouseholdInvitation(
          inviteForm.householdId,
          invitation.id,
        )

        await loadInvitations()

        setNotice({
          type:
            'success',
          message:
            `Invitation for ${invitation.invitedEmail} was revoked.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to revoke the household invitation.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleMemberRoleChange =
    async (
      member,
      nextRole,
    ) => {
      if (
        !household?.id ||
        !member?.membershipId ||
        actionKey ||
        member.role ===
          nextRole
      ) {
        return
      }

      setActionKey(
        `role:${member.membershipId}`,
      )
      setNotice(null)

      try {
        await updateHouseholdMemberRole(
          household.id,
          member.membershipId,
          nextRole,
        )

        await loadMembers()

        setNotice({
          type:
            'success',
          message:
            `${member.user.name} is now a household ${getRoleLabel(
              nextRole,
            ).toLowerCase()}.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to update the household member role.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleRemoveMember =
    async (
      member,
    ) => {
      if (
        !household?.id ||
        !member?.membershipId ||
        actionKey
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `Remove ${member.user.name} from ${household.name}?`,
        )

      if (!confirmed) {
        return
      }

      setActionKey(
        `remove:${member.membershipId}`,
      )
      setNotice(null)

      try {
        await removeHouseholdMember(
          household.id,
          member.membershipId,
        )

        await loadMembers()

        setNotice({
          type:
            'success',
          message:
            `${member.user.name} was removed from the household.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to remove the household member.',
        })
      } finally {
        setActionKey('')
      }
    }

  if (isLoadingHousehold) {
    return (
      <div className="min-h-screen bg-[#f7f5ef] p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-[#d9e3dd] bg-white">
          <div className="text-center">
            <LoaderCircle
              size={30}
              className="mx-auto animate-spin text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-bold text-stone-600">
              Loading household...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (
    householdError &&
    !household
  ) {
    return (
      <div className="min-h-screen bg-[#f7f5ef] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-xl rounded-[28px] border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <CircleAlert
            size={32}
            className="text-red-600"
            aria-hidden="true"
          />
          <h1 className="mt-5 text-2xl font-black text-stone-950">
            Unable to load household
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {householdError.message ||
              'Please try again.'}
          </p>
          <button
            type="button"
            onClick={() => {
              void refreshHousehold()
                .catch(
                  () => undefined,
                )
            }}
            className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!hasHousehold) {
    const canCreateHousehold =
      currentUser?.accountStatus ===
      'active'

    return (
      <div className="min-h-screen bg-[#f7f5ef] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-[#d9e3dd] bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#dcf7e8] text-[#173f35]">
            <Home
              size={27}
              aria-hidden="true"
            />
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Household
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            Create your household
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            Household setup gives EPANTRY a shared context for pantry items, planning, lists and household-level food preferences. You can invite family members after creating it.
          </p>

          {!canCreateHousehold ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <CircleAlert
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold leading-6 text-amber-900">
                  Household creation becomes available when your EPANTRY account is active.
                </p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleCreate}
              className="mt-8 grid gap-5"
              noValidate
            >
              {formError ? (
                <div
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="household-name"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Household name
                </label>
                <input
                  id="household-name"
                  type="text"
                  maxLength={120}
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      'name',
                      event.target.value,
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950"
                  placeholder="e.g. Sharma Household"
                />
              </div>

              <div>
                <label
                  htmlFor="household-people"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Usual number of people
                </label>
                <input
                  id="household-people"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  step="1"
                  value={form.usualPeopleCount}
                  onChange={(event) =>
                    updateField(
                      'usualPeopleCount',
                      event.target.value,
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950"
                />
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  This is planning context, not the number of registered EPANTRY accounts.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreatingHousehold}
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#173f35] px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#205545] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingHousehold ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Home
                    size={18}
                    aria-hidden="true"
                  />
                )}
                {isCreatingHousehold
                  ? 'Creating household...'
                  : 'Create household'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="hh-page w-full">
      <style>{HOUSEHOLD_STYLES}</style>
      <div className="w-full min-w-0">
        <header className="hh-hero">
          <div className="hh-hero-intro">
            <span className="hh-hero-eyebrow">Household workspace</span>
            <h1>{household.name}</h1>
            <p className="hh-hero-description"><span className="hidden sm:inline">Manage the people and household you share your Pantry and meal plans with.</span><span className="sm:hidden">Manage people, Pantry and plans together.</span></p>
          </div>
          <div className="hh-hero-state">
            <div>
              <span className="hh-state-label"><ShieldCheck size={18} aria-hidden="true" /> Your active household</span>
              <div className="hh-state-role">{getRoleLabel(membership.role, membership.roleLabel)}</div>
              <p className="hh-state-desc">Your access in this household</p>
            </div>
            <div className="hh-state-bottom">
              <span className="hh-state-members"><strong>{members.length}</strong> active {members.length === 1 ? 'member' : 'members'}</span>
              <button type="button" className="hh-state-refresh focus-ring" onClick={() => {
                void Promise.all([
                  refreshHousehold(),
                  loadMembers(),
                  canSendInvites ? loadInvitations() : Promise.resolve([]),
                ]).catch(() => undefined)
              }}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
            </div>
          </div>
        </header>

        <ActionNotice
          notice={notice}
        />

        <section className="hh-steps" aria-labelledby="household-guide-heading">
          <div className="hh-section-head">
            <div>
              <p className="hh-eyebrow">How your household works</p>
              <h2 id="household-guide-heading"><span className="hidden sm:inline">People, Pantry and access — together.</span><span className="sm:hidden">People and access</span></h2>
            </div>
            <p className="hh-intro-description">One account can belong to several households. Your access is set separately for each one.</p>
          </div>
          <div className="hh-step-row">
            <div className="hh-step"><div className="hh-step-marker"><span className="hh-step-num">01</span><Home size={19} aria-hidden="true" /></div><h3>Choose a household</h3><p>Set which household is active before using shared Pantry and plans.</p></div>
            <div className="hh-step"><div className="hh-step-marker"><span className="hh-step-num">02</span><Send size={19} aria-hidden="true" /></div><h3>Invite your people</h3><p>Owners and admins can invite people using their verified email.</p></div>
            <div className="hh-step"><div className="hh-step-marker"><span className="hh-step-num">03</span><Users size={19} aria-hidden="true" /></div><h3>They choose to join</h3><p>Invited customers can accept or decline their household role.</p></div>
            <div className="hh-step"><div className="hh-step-marker"><span className="hh-step-num">04</span><ShieldCheck size={19} aria-hidden="true" /></div><h3>Keep access clear</h3><p>Each household keeps its own roles. Invitations never grant Owner access.</p></div>
          </div>
        </section>

        <div className="hh-accounts-group">
          <section className="hh-households">
          <div className="hh-households-heading flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="hh-eyebrow">
                Your households
              </p>
              <h2 className="mt-1 text-[16px] font-black tracking-tight text-stone-950 sm:mt-2 sm:text-2xl">
                <span className="sm:hidden">Your households</span>
                <span className="hidden sm:inline">Switch households and manage your access.</span>
              </h2>
              <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:font-normal sm:leading-6 sm:text-stone-500">
                <span className="sm:hidden">Active household powers shared Pantry and planning.</span>
                <span className="hidden sm:inline">Your active household powers shared Pantry and meal planning.</span>
              </p>
            </div>
          </div>

          <div className="hh-households-list">
            {(Array.isArray(households) ? households : []).map(
              (entry) => {
                const isActive =
                  entry?.household?.id ===
                  household?.id

                return (
                  <div
                    key={entry.household.id}
                    className={`hh-household-option ${isActive ? 'is-current' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-stone-950">
                          {entry.household.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          Your role: {getRoleLabel(entry.membership.role, entry.membership.roleLabel)}
                        </p>
                      </div>
                      <span className={[
                        'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
                        isActive
                          ? 'bg-emerald-700 text-white'
                          : 'border border-stone-200 bg-white text-stone-600',
                      ].join(' ')}>
                        {isActive
                          ? 'Active'
                          : getRoleLabel(entry.membership.role, entry.membership.roleLabel)}
                      </span>
                    </div>

                    {!isActive ? (
                      <button
                        type="button"
                        disabled={Boolean(actionKey)}
                        onClick={() => {
                          setActionKey(
                            `select:${entry.household.id}`,
                          )
                          setNotice(null)

                          void selectHousehold(
                            entry.household.id,
                          )
                            .then(() => {
                              setNotice({
                                type:
                                  'success',
                                message:
                                  `${entry.household.name} is now your active household.`,
                              })
                            })
                            .catch((error) => {
                              setNotice({
                                type:
                                  'error',
                                message:
                                  error?.message ||
                                  'Unable to switch household.',
                              })
                            })
                            .finally(() => {
                              setActionKey('')
                            })
                        }}
                        className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173f35] px-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-[#205545] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Use this household
                      </button>
                    ) : null}
                  </div>
                )
              },
            )}
          </div>
        </section>

        <div className="hh-facts">
          <div className="hh-fact">
            <Home
              size={16}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-2 text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 sm:mt-4 sm:text-xs sm:font-bold sm:tracking-wide">
              Household
            </p>
            <p className="mt-1 break-words text-[9.5px] font-black leading-tight text-stone-950 sm:mt-2 sm:text-base sm:leading-normal">
              {household.name}
            </p>
          </div>

          <div className="hh-fact">
            <Users
              size={16}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-2 text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 sm:mt-4 sm:text-xs sm:font-bold sm:tracking-wide">
              Active members
            </p>
            <p className="mt-1 truncate text-[11px] font-black text-stone-950 sm:mt-2 sm:overflow-visible sm:text-clip sm:whitespace-normal sm:text-base">
              {members.length}
            </p>
          </div>

          <div className="hh-fact">
            <ShieldCheck
              size={16}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-2 text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 sm:mt-4 sm:text-xs sm:font-bold sm:tracking-wide">
              Your role
            </p>
            <p className="mt-1 truncate text-[11px] font-black text-stone-950 sm:mt-2 sm:overflow-visible sm:text-clip sm:whitespace-normal sm:text-base">
              {getRoleLabel(
                membership.role,
                membership.roleLabel,
              )}
            </p>
          </div>
        </div>
        </div>

        <div className="hh-management">
        {canSendInvites ? (
          <section className="hh-invite">
            <div className="flex items-center justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="hh-eyebrow">
                  Invite people
                </p>
                <h2 className="mt-1 text-[16px] font-black text-stone-950 sm:mt-2 sm:text-2xl">
                  Add household members
                </h2>
                <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:max-w-2xl sm:text-sm sm:font-normal sm:leading-6 sm:text-stone-500">
                  <span className="sm:hidden">Invite by email; they join with the same verified address.</span>
                  <span className="hidden sm:inline">Invite by verified email. People decide whether to join.</span>
                </p>
              </div>

              <div className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[9px] font-black text-emerald-800 sm:px-3 sm:py-1.5 sm:text-xs">
                {activeInvitationCount} pending
              </div>
            </div>

            <form
              onSubmit={handleInvite}
              className="mt-3 grid grid-cols-[1.08fr_0.92fr] gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3 lg:grid-cols-[220px_minmax(0,1fr)_180px_auto]"
            >
              <div>
                <label
                  htmlFor="household-invite-household"
                  className="sr-only"
                >
                  Household
                </label>
                <select
                  id="household-invite-household"
                  value={inviteForm.householdId}
                  onChange={(event) => {
                    setInviteForm(
                      (current) => ({
                        ...current,
                        householdId:
                          event.target.value,
                        role:
                          'member',
                        customRoleLabel:
                          '',
                      }),
                    )
                    setNotice(null)
                  }}
                  className="focus-ring min-h-10 w-full min-w-0 rounded-xl border border-[#cfe2d8] bg-white px-2 text-[9.5px] font-bold text-stone-800 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-sm"
                >
                  {manageableHouseholds.map(
                    (entry) => (
                      <option
                        key={entry.household.id}
                        value={entry.household.id}
                      >
                        {entry.household.name} · {getRoleLabel(entry.membership.role, entry.membership.roleLabel)}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="household-invite-email"
                  className="sr-only"
                >
                  Email address
                </label>
                <input
                  id="household-invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteForm.email}
                  onChange={(event) => {
                    setInviteForm(
                      (current) => ({
                        ...current,
                        email:
                          event.target.value,
                      }),
                    )
                    setNotice(null)
                  }}
                  placeholder="family@example.com"
                  className="focus-ring min-h-10 w-full min-w-0 rounded-xl border border-[#cfe2d8] bg-white px-2 text-[9.5px] font-semibold text-stone-950 placeholder:text-[9.5px] sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-sm sm:placeholder:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="household-invite-role"
                  className="sr-only"
                >
                  Household role
                </label>
                <select
                  id="household-invite-role"
                  value={inviteForm.role}
                  onChange={(event) => {
                    setInviteForm(
                      (current) => ({
                        ...current,
                        role:
                          event.target.value,
                        customRoleLabel:
                          event.target.value ===
                            'other'
                            ? current.customRoleLabel
                            : '',
                      }),
                    )
                    setNotice(null)
                  }}
                  className="focus-ring min-h-10 w-full min-w-0 rounded-xl border border-[#cfe2d8] bg-white px-2 text-[9.5px] font-bold text-stone-800 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-sm"
                >
                  <option value="member">
                    Member
                  </option>
                  {inviteTargetIsOwner ? (
                    <option value="admin">
                      Admin
                    </option>
                  ) : null}
                  <option value="partner">
                    Partner / Spouse
                  </option>
                  <option value="parent">
                    Parent
                  </option>
                  <option value="child">
                    Child
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>

                {inviteForm.role ===
                'other' ? (
                  <input
                    type="text"
                    value={inviteForm.customRoleLabel}
                    maxLength={40}
                    onChange={(event) => {
                      setInviteForm(
                        (current) => ({
                          ...current,
                          customRoleLabel:
                            event.target.value,
                        }),
                      )
                      setNotice(null)
                    }}
                    placeholder="e.g. Sister, Caregiver"
                    aria-label="Custom household role name"
                    className="focus-ring mt-2 min-h-10 w-full rounded-xl border border-[#cfe2d8] bg-white px-3 text-[11px] font-semibold text-stone-950 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-sm"
                  />
                ) : null}
              </div>

              <button
                type="submit"
                disabled={Boolean(actionKey)}
                className="focus-ring col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#173f35] px-4 text-[11px] font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#205545] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:min-h-12 sm:rounded-2xl sm:px-5 sm:text-sm"
              >
                {actionKey ===
                'create-invitation' ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send
                    size={17}
                    aria-hidden="true"
                  />
                )}
                Send invite
              </button>
            </form>

            {!inviteTargetIsOwner ? (
              <p className="mt-2 text-[9px] font-semibold leading-4 text-stone-600 sm:mt-3 sm:text-xs sm:font-normal sm:leading-5 sm:text-stone-500">
                Household admins can invite standard members. Only the household owner can invite another admin.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="hh-members">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="hh-eyebrow">
                Membership
              </p>
              <h2 className="mt-1 text-[16px] font-black text-stone-950 sm:mt-2 sm:text-2xl">
                Household members
              </h2>
            </div>
            <Users
              size={20}
              className="text-sky-700"
              aria-hidden="true"
            />
          </div>

          {membersError ? (
            <div
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              role="alert"
            >
              {membersError.message ||
                'Unable to load household members.'}
            </div>
          ) : null}

          {isLoadingMembers ? (
            <div className="flex min-h-32 items-center justify-center">
              <LoaderCircle
                size={24}
                className="animate-spin text-emerald-700"
                aria-label="Loading household members"
              />
            </div>
          ) : (
            <div className="hh-members-list">
              {members.map(
                (member) => {
                  const canChangeRole =
                    isOwner &&
                    !member.isCurrentUser &&
                    member.role !==
                      'owner'

                  const canRemove =
                    !member.isCurrentUser &&
                    member.role !==
                      'owner' &&
                    (
                      isOwner ||
                      (
                        membership.role ===
                          'admin' &&
                        member.role ===
                          'member'
                      )
                    )

                  const rowActionPending =
                    actionKey.endsWith(
                      member.membershipId,
                    )

                  return (
                    <div
                      key={member.membershipId}
                      className="hh-person"
                    >
                      <div className="flex flex-col gap-2 sm:gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="hh-person-avatar" aria-hidden="true">{String(member.user?.name || '?').charAt(0).toUpperCase()}</span>
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-black text-stone-950">
                              {member.user.name}
                            </p>
                            {member.isCurrentUser ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                                You
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            Joined {formatDate(
                              member.joinedAt,
                            )}
                          </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {canChangeRole ? (
                            <label className="relative">
                              <span className="sr-only">
                                Change role for {member.user.name}
                              </span>
                              <select
                                value={member.role}
                                disabled={
                                  Boolean(actionKey)
                                }
                                onChange={(event) => {
                                  void handleMemberRoleChange(
                                    member,
                                    event.target.value,
                                  )
                                }}
                                className="focus-ring min-h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-[10px] font-black text-stone-700 disabled:opacity-60 sm:min-h-10 sm:rounded-xl sm:px-3 sm:text-xs"
                              >
                                <option value="member">
                                  Member
                                </option>
                                <option value="admin">
                                  Admin
                                </option>
                              </select>
                            </label>
                          ) : (
                            <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-black text-stone-700 sm:px-3 sm:py-1.5 sm:text-xs">
                              {getRoleLabel(
                                member.role,
                                member.roleLabel,
                              )}
                            </span>
                          )}

                          {canChangeRole &&
                          member.role ===
                            'member' &&
                          member.roleLabel &&
                          member.roleLabel !==
                            'Member' ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">
                              {member.roleLabel}
                            </span>
                          ) : null}

                          {canRemove ? (
                            <button
                              type="button"
                              disabled={Boolean(actionKey)}
                              onClick={() => {
                                void handleRemoveMember(
                                  member,
                                )
                              }}
                              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {rowActionPending ? (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2
                                  size={14}
                                  aria-hidden="true"
                                />
                              )}
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                },
              )}

              {members.length ===
              0 ? (
                <p className="py-8 text-center text-sm font-semibold text-stone-500">
                  No active household members were found.
                </p>
              ) : null}
            </div>
          )}

          {isOwner ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-200 bg-[#f5f2ff] p-2.5 sm:mt-5 sm:items-start sm:gap-3 sm:rounded-2xl sm:p-4">
              <UserRoundCog
                size={19}
                className="mt-0.5 shrink-0 text-stone-500"
                aria-hidden="true"
              />
              <p className="text-[9px] font-semibold leading-4 text-stone-600 sm:text-xs sm:font-normal sm:leading-5">
                <span className="sm:hidden">Only owners change admin roles; ownership transfer stays separate.</span>
                <span className="hidden sm:inline">Only the owner can promote or demote household admins. Ownership transfer is intentionally not handled by the normal member-role control.</span>
              </p>
            </div>
          ) : null}
        </section>
        </div>

        {canSendInvites ? (
          <section className="hh-invitations">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="hh-eyebrow">
                  Invitations
                </p>
                <h2 className="mt-1 text-[16px] font-black text-stone-950 sm:mt-2 sm:text-2xl">
                  Invitation history
                </h2>
              </div>
              <MailPlus
                size={20}
                className="text-violet-600"
                aria-hidden="true"
              />
            </div>

            {invitationError ? (
              <div
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
                role="alert"
              >
                {invitationError}
              </div>
            ) : null}

            {isLoadingInvitations ? (
              <div className="flex min-h-32 items-center justify-center">
                <LoaderCircle
                  size={24}
                  className="animate-spin text-emerald-700"
                  aria-label="Loading household invitations"
                />
              </div>
            ) : (
              <div className="hh-invitations-list">
                {invitations.map(
                  (invitation) => {
                    const isPending =
                      invitation.status ===
                      'pending'

                    const canResend =
                      invitation.status ===
                        'pending' ||
                      invitation.status ===
                        'expired'

                    const isAdminInvitation =
                      invitation.role ===
                      'admin'

                    const adminCanAct =
                      inviteTargetIsOwner ||
                      !isAdminInvitation

                    return (
                      <div
                        key={invitation.id}
                        className="hh-invitation-row"
                      >
                        <div className="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <p className="break-all text-[11px] font-black leading-4 text-stone-950 sm:text-base sm:leading-normal">
                                {invitation.invitedEmail}
                              </p>
                              <span
                                className={[
                                  'rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide sm:px-2.5 sm:py-1 sm:text-[10px]',
                                  getInvitationStatusClasses(
                                    invitation.status,
                                  ),
                                ].join(' ')}
                              >
                                {invitation.status}
                              </span>
                              <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-stone-600 sm:px-2.5 sm:py-1 sm:text-[10px]">
                                {getRoleLabel(
                                  invitation.role,
                                  invitation.roleLabel,
                                )}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9.5px] font-semibold leading-4 text-stone-500 sm:mt-2 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
                              <span>
                                Created {formatDate(
                                  invitation.createdAt,
                                )}
                              </span>
                              <span>
                                Expires {formatDateTime(
                                  invitation.expiresAt,
                                )}
                              </span>
                              <span>
                                Delivery: {invitation.deliveryStatus ||
                                  'pending'}
                              </span>
                              {invitation.resendCount >
                              0 ? (
                                <span>
                                  Resent {invitation.resendCount} time{invitation.resendCount ===
                                  1
                                    ? ''
                                    : 's'}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {adminCanAct &&
                          (
                            isPending ||
                            canResend
                          ) ? (
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {canResend ? (
                                <button
                                  type="button"
                                  disabled={Boolean(actionKey)}
                                  onClick={() => {
                                    void handleResendInvitation(
                                      invitation,
                                    )
                                  }}
                                  className="focus-ring inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-[10px] font-black text-stone-700 transition hover:bg-stone-100 disabled:opacity-60 sm:min-h-10 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs"
                                >
                                  {actionKey ===
                                  `resend:${invitation.id}` ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <RotateCcw
                                      size={14}
                                      aria-hidden="true"
                                    />
                                  )}
                                  Resend
                                </button>
                              ) : null}

                              {isPending ? (
                                <button
                                  type="button"
                                  disabled={Boolean(actionKey)}
                                  onClick={() => {
                                    void handleRevokeInvitation(
                                      invitation,
                                    )
                                  }}
                                  className="focus-ring inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[10px] font-black text-red-700 transition hover:bg-red-50 disabled:opacity-60 sm:min-h-10 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs"
                                >
                                  {actionKey ===
                                  `revoke:${invitation.id}` ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <XCircle
                                      size={14}
                                      aria-hidden="true"
                                    />
                                  )}
                                  Revoke
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  },
                )}

                {invitations.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center sm:p-8">
                    <Clock3
                      size={24}
                      className="mx-auto text-stone-400"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-[12px] font-black text-stone-800 sm:mt-3 sm:text-sm">
                      No invitations yet
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-stone-500 sm:text-xs sm:leading-5">
                      New invitations and their lifecycle will appear here.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
