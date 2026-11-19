import { Link } from 'react-router-dom'
import { ArrowUpRight, Cookie, FileText, ShieldCheck } from 'lucide-react'
import { COOKIE_SETTINGS_EVENT } from '../../cookieConsent/cookieConsent.service'

// These values must be verified by the business/legal owner before publication.
// Do not invent a legal operator, postal address, DPO, or EU representative.
const operator = String(import.meta.env.VITE_EPANTRY_LEGAL_ENTITY || '').trim()
const postalAddress = String(import.meta.env.VITE_EPANTRY_LEGAL_ADDRESS || '').trim()
const privacyEmail = String(import.meta.env.VITE_EPANTRY_PRIVACY_EMAIL || '').trim()
const representative = String(import.meta.env.VITE_EPANTRY_EU_REPRESENTATIVE || '').trim()
const dpoEmail = String(import.meta.env.VITE_EPANTRY_DPO_EMAIL || '').trim()
const effectiveDate = String(import.meta.env.VITE_EPANTRY_LEGAL_EFFECTIVE_DATE || '').trim()
const reviewed = import.meta.env.VITE_EPANTRY_LEGAL_APPROVED === 'true'
const publicationReady = Boolean(operator && postalAddress && privacyEmail && effectiveDate && reviewed)
const sections = [
  ['operator', 'Who operates EPANTRY'],
  ['data', 'Information we handle'],
  ['purposes', 'Why we use information'],
  ['cookies', 'Cookies and choices'],
  ['sharing', 'Sharing and transfers'],
  ['retention', 'Retention and security'],
  ['rights', 'Your privacy rights'],
  ['updates', 'Questions and changes'],
]

function Section({ id, number, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 border-t border-[#D9E2D9] pt-7 sm:pt-9">
      <div className="flex items-baseline gap-3">
        <span aria-hidden="true" className="shrink-0 text-[12px] font-bold tracking-widest text-[#307A5C]">{number}</span>
        <h2 id={`${id}-heading`} className="text-[22px] font-bold leading-tight tracking-tight text-[#153E31] sm:text-[26px]">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-[15px] leading-7 text-[#40514B] sm:text-[16px]">{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#F6F4EE] pb-16 text-[#20382F]">
      <header className="border-b border-[#D9E2D9] bg-[#E5F2E9] px-4 pb-9 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#356C52]">EPANTRY / Legal documents</p>
          <h1 className="mt-3 max-w-4xl text-[34px] font-bold leading-[1.1] tracking-[-0.04em] sm:text-[54px]">Privacy policy.</h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#476357]">What we process, why we process it, and how Customers and Hosts can exercise their privacy rights.</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-[#315947]">
            <span>Document version: privacy-v1</span>
            <span>Effective date: {publicationReady ? effectiveDate : 'Pending approval'}</span>
            <span>Status: {publicationReady ? 'Approved for publication' : 'Publication review pending'}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-9 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="On this page">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#557366]">On this page</p>
          <nav className="grid grid-cols-2 gap-x-3 gap-y-1 lg:grid-cols-1">
            {sections.map(([id, title]) => <a key={id} href={`#${id}`} className="rounded-md py-1.5 text-[13px] font-medium text-[#3A6050] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236445]">{title}</a>)}
          </nav>
          <div className="mt-7 flex flex-wrap gap-3 text-[13px] font-semibold">
            <Link to="/terms" className="underline underline-offset-4">Terms & conditions</Link>
            <Link to="/about" className="underline underline-offset-4">About EPANTRY</Link>
          </div>
        </aside>
        <article className="max-w-3xl min-w-0">
          {!publicationReady && (
            <div role="status" className="mb-8 border-l-4 border-[#C47B38] bg-[#FFF0D9] p-4 text-[14px] leading-6 text-[#6E4927]">
              <strong>Publication review required.</strong> The legal operator, address, privacy contact and legal sign-off must be confirmed before this draft is treated as a final EU privacy notice.
            </div>
          )}
          <p className="mb-8 text-[16px] leading-7 text-[#385145]">This notice concerns use of EPANTRY's shopping, recipe, Pantry, account and Host marketplace services. The precise categories processed depend on the features you use. Optional tracking choices are handled separately from account and order processing.</p>
          <Section id="operator" number="01" title="Who operates EPANTRY">
            <p><strong>Data controller / legal operator:</strong> {operator || 'To be confirmed before publication.'}</p>
            <p><strong>Registered contact address:</strong> {postalAddress || 'To be confirmed before publication.'}</p>
            <p><strong>Privacy contact:</strong> {privacyEmail ? <a href={`mailto:${privacyEmail}`} className="underline underline-offset-4">{privacyEmail}</a> : 'To be confirmed before publication.'}</p>
            <p><strong>EU representative, if applicable:</strong> {representative || 'Applicability and contact to be confirmed.'}</p>
            <p><strong>Data protection officer, if required:</strong> {dpoEmail ? <a href={`mailto:${dpoEmail}`} className="underline underline-offset-4">{dpoEmail}</a> : 'Applicability and contact to be confirmed.'}</p>
          </Section>
          <Section id="data" number="02" title="Information we handle">
            <p><strong>Accounts:</strong> name, email, phone, authentication and security records, account preferences and role/access information.</p>
            <p><strong>Shopping:</strong> delivery addresses, cart, orders, fulfilment and payment status or reference information. A payment provider may process card/payment credentials separately.</p>
            <p><strong>Food and planning:</strong> saved recipes, dietary preferences, Pantry or household information, meal planning and voluntary purchase-source information where enabled.</p>
            <p><strong>Host operations:</strong> business identity, authorized users, submitted listings, product/food details, approvals, governance and order records.</p>
            <p><strong>Usage and security:</strong> technical logs, security events and cookie/consent decisions. Optional analytics or personalization data depends on the choices and features enabled.</p>
            <p><strong>Marketplace reports:</strong> reported URL, reason, explanation, optional reporter contact, an evidence link and the status or moderation history when you submit a report.</p>
            <p>Information may be supplied by you, your authorized Host organization, integrated providers or your device when you use a relevant feature. Precise sources and categories require a final data inventory.</p>
          </Section>
          <Section id="purposes" number="03" title="Why we use information">
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] border-collapse text-left text-[14px]"><thead><tr className="border-b border-[#BFCFC2] text-[#183D2F]"><th className="py-3 pr-4">Purpose</th><th className="py-3">Potential GDPR basis*</th></tr></thead><tbody>
              <tr className="border-b border-[#DFE5DB]"><td className="py-3 pr-4">Account, orders, delivery and requested services</td><td className="py-3">Contract / steps requested before a contract</td></tr>
              <tr className="border-b border-[#DFE5DB]"><td className="py-3 pr-4">Tax records and legally required disclosures</td><td className="py-3">Legal obligation, where applicable</td></tr>
              <tr className="border-b border-[#DFE5DB]"><td className="py-3 pr-4">Security, fraud prevention and service integrity</td><td className="py-3">Legitimate interests or legal obligation, as assessed</td></tr>
              <tr className="border-b border-[#DFE5DB]"><td className="py-3 pr-4">Optional analytics, emails and selected personalization</td><td className="py-3">Consent where required; preferences remain controllable</td></tr>
            </tbody></table></div>
            <p className="text-[13px]">*These are proposed purpose/basis mappings, not a completed record of processing. Legal review must confirm the basis for each actual activity, including any sensitive dietary information and automated decisions where applicable.</p>
          </Section>
          <Section id="cookies" number="04" title="Cookies and choices">
            <p>EPANTRY uses a cookie-consent interface with necessary categories and optional preferences/analytics choices. You can review or change non-essential choices without changing your basic account access.</p>
            <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#174D38] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#27694E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174D38]"><Cookie size={16} aria-hidden="true" /> Open cookie settings</button>
            <p>Consent settings and withdrawal must be enforced against the actual analytics and third-party scripts; this requires production verification.</p>
          </Section>
          <Section id="sharing" number="05" title="Sharing and international transfers">
            <p>Personal data may be handled by service providers needed for hosting, account communications, payments, delivery, analytics (when permitted) and fraud/security operations, and by relevant Host or delivery parties when necessary to complete an order.</p>
            <p>The final notice must identify the relevant recipient categories, any actual international transfers, transfer mechanisms and how to obtain applicable safeguards. No third-party processor or transfer arrangement should be assumed without a verified inventory.</p>
          </Section>
          <Section id="retention" number="06" title="Retention and security">
            <p>Account, transaction, Host verification, complaint and security records may have different retention periods. Legitimate disputes, tax obligations, fraud investigation or legal holds may require some records to be retained after an erasure request.</p>
            <p>Access controls, verification checks and governed privacy requests are part of the service. The final published notice must give the actual retention periods or usable criteria for each data category; this draft does not claim a universal deletion timeframe.</p>
          </Section>
          <Section id="rights" number="07" title="Your privacy rights">
            <p>Where applicable, you can ask to access and obtain your information, correct inaccurate details, request erasure, restrict processing, receive portable data, object to certain processing and withdraw optional consent.</p>
            <p>Use your <Link to="/account/privacy" className="font-semibold underline underline-offset-4">Customer privacy workspace</Link> or <Link to="/host/privacy" className="font-semibold underline underline-offset-4">Host privacy workspace</Link> after signing in. Requests are reviewed with identity and legal-retention checks; not every deletion request can remove every record.</p>
            <p>You can also complain to a competent data protection supervisory authority where GDPR applies. A verified operator contact must be provided before launch.</p>
          </Section>
          <Section id="updates" number="08" title="Questions and changes">
            <p>When this notice is formally approved, EPANTRY must publish its effective date and maintain a version history. Material changes may require notice and renewed acknowledgement through the existing account consent workflow.</p>
            <p>Version shown here: <strong>privacy-v1</strong>. This matches the currently available account-consent version but does not itself prove the published text was legally approved when past acceptances were recorded.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#CFDCCF] pt-5">
              <Link to="/terms" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#A7BAAB] px-4 py-2 text-[14px] font-semibold text-[#174D38] hover:bg-[#E8F2E9]"><FileText size={16} /> Read terms <ArrowUpRight size={15}/></Link>
              <Link to="/about" className="inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-[#174D38] underline underline-offset-4"><ShieldCheck size={16} /> About EPANTRY</Link>
            </div>
          </Section>
        </article>
      </div>
    </main>
  )
}
