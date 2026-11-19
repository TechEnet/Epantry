import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, Flag, ShieldCheck } from 'lucide-react'

// Publication details are intentionally not fabricated.
const operator = String(import.meta.env.VITE_EPANTRY_LEGAL_ENTITY || '').trim()
const postalAddress = String(import.meta.env.VITE_EPANTRY_LEGAL_ADDRESS || '').trim()
const legalEmail = String(import.meta.env.VITE_EPANTRY_LEGAL_EMAIL || '').trim()
const effectiveDate = String(import.meta.env.VITE_EPANTRY_LEGAL_EFFECTIVE_DATE || '').trim()
const reviewed = import.meta.env.VITE_EPANTRY_LEGAL_APPROVED === 'true'
const publicationReady = Boolean(operator && postalAddress && legalEmail && effectiveDate && reviewed)
const sections = [
  ['accounts', 'Accounts and eligibility'],
  ['marketplace', 'Hosts, products and review'],
  ['orders', 'Prices, payment and delivery'],
  ['food', 'Food information and safety'],
  ['content', 'Content and ownership'],
  ['moderation', 'Reports, moderation and appeals'],
  ['disputes', 'Rights, complaints and disputes'],
  ['updates', 'Legal contact and updates'],
]

function Section({ id, number, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 border-t border-[#E5D4C9] pt-7 sm:pt-9">
      <div className="flex items-baseline gap-3">
        <span aria-hidden="true" className="shrink-0 text-[12px] font-bold tracking-widest text-[#A7563F]">{number}</span>
        <h2 id={`${id}-heading`} className="text-[22px] font-bold leading-tight tracking-tight text-[#453229] sm:text-[26px]">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-[15px] leading-7 text-[#5A5149] sm:text-[16px]">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] pb-16 text-[#362F29]">
      <header className="border-b border-[#E3C9B6] bg-[#F9E2D3] px-4 pb-9 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#995A44]">EPANTRY / Legal documents</p>
          <h1 className="mt-3 max-w-4xl text-[34px] font-bold leading-[1.1] tracking-[-0.04em] sm:text-[54px]">Terms & conditions.</h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#795B4B]">How Customers, Hosts and EPANTRY participate in the marketplace, and how complaints and listings are handled.</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-[#815844]">
            <span>Document version: terms-v1</span>
            <span>Effective date: {publicationReady ? effectiveDate : 'Pending approval'}</span>
            <span>Status: {publicationReady ? 'Approved for publication' : 'Publication review pending'}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-9 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="On this page">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#906954]">On this page</p>
          <nav className="grid grid-cols-2 gap-x-3 gap-y-1 lg:grid-cols-1">
            {sections.map(([id, title]) => <a key={id} href={`#${id}`} className="rounded-md py-1.5 text-[13px] font-medium text-[#805744] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A35E43]">{title}</a>)}
          </nav>
          <div className="mt-7 flex flex-wrap gap-3 text-[13px] font-semibold">
            <Link to="/privacy-policy" className="underline underline-offset-4">Privacy policy</Link>
            <Link to="/about" className="underline underline-offset-4">About EPANTRY</Link>
          </div>
        </aside>
        <article className="max-w-3xl min-w-0">
          {!publicationReady && (
            <div role="status" className="mb-8 border-l-4 border-[#B66C40] bg-[#FFF0D9] p-4 text-[14px] leading-6 text-[#734528]">
              <strong>Publication review required.</strong> The legal operator, contact information, commercial obligations and applicable consumer rules must be verified before these terms are final.
            </div>
          )}
          <p className="mb-8 text-[16px] leading-7 text-[#5E4B3E]">These terms describe the EPANTRY platform for browsing, recipes, Pantry planning and Host-supplied marketplace listings. They should be read with the <Link to="/privacy-policy" className="font-semibold underline underline-offset-4">Privacy Policy</Link> and the order-specific information shown at checkout.</p>
          <Section id="accounts" number="01" title="Accounts and eligibility">
            <p>Customers may browse public content and, when eligible, create accounts to save recipes, manage Pantry information and shop. Host access is subject to separate business verification, applicable platform permissions and approval processes.</p>
            <p>Keep your credentials secure, provide accurate account information and use the services only where you are legally permitted to do so. Some services, products and delivery areas may be unavailable by region. The final terms must confirm age requirements and permitted markets.</p>
          </Section>
          <Section id="marketplace" number="02" title="Hosts, products and review">
            <p>Hosts submit listings, product information, images, prices and other required details. Super Admin review controls marketplace approval and visibility under EPANTRY's existing governance workflow. A listing can be declined, corrected or referred for further review.</p>
            <p>Hosts are responsible for the accuracy and legality of their descriptions, required trader information, licensing, product availability and any regulated food declarations. EPANTRY's review does not automatically guarantee every product claim or replace a seller's statutory responsibilities.</p>
            <p>Listings must not contain illegal, misleading, counterfeit, unsafe or infringing goods or prohibited content. EU trader-traceability checks, where applicable, require separate evidence and verification before eligible offers can be made available.</p>
          </Section>
          <Section id="orders" number="03" title="Prices, payment and delivery">
            <p>Available prices, charges, delivery coverage, availability and order totals should be shown to Customers before payment. Checkout may use a third-party payment processor; EPANTRY's current checkout integrates Razorpay where configured.</p>
            <p>Order submission, payment confirmation, seller acceptance, cancellation, returns, refunds and fulfilment depend on the actual order type, seller obligations and the rules shown at checkout. The final terms must state the verified refund/contact process and actual fulfilment responsibility without inventing blanket timeframes.</p>
            <p>Mandatory consumer protections, including applicable cancellation or withdrawal rights and exceptions, are not removed by these terms.</p>
          </Section>
          <Section id="food" number="04" title="Food information and safety">
            <p>Recipe ingredients, estimated nutrition, allergens and dietary attributes help customers make decisions but are not substitutes for inspecting product labels or obtaining professional advice where needed.</p>
            <p>Hosts must provide accurate food safety, ingredient, allergen, nutritional and origin information where required by law. Product substitution or recipe variation can affect allergen and nutrition details; confirm with the seller or product packaging before consumption.</p>
          </Section>
          <Section id="content" number="05" title="Content and ownership">
            <p>EPANTRY's brand, interface, data presentation and original material are protected as applicable. Hosts and users should only upload content they own or are authorized to use, including images, listings and recipe materials.</p>
            <p>Public contributions may be subject to relevant community rules and moderation. A complete content license, permitted use of user-generated content and takedown process must be approved by the legal owner before release.</p>
          </Section>
          <Section id="moderation" number="06" title="Reports, moderation and appeals">
            <p>EPANTRY can review reported listings and content that appears unlawful, unsafe, misleading or contrary to platform rules. Moderation may include assessment of listing evidence, Host verification status, applicable product rules and the surrounding context.</p>
            <p>Depending on the facts and legal requirements, responses may include leaving content available, requesting corrections, escalating to a qualified reviewer, restricting availability or removing content using governed Admin controls. The current M2 reporting system records review decisions; it does not automatically unpublish a listing when a report is accepted.</p>
            <p>Where required, affected parties must be told relevant reasons and receive any applicable review or appeal options. The M2 public reporting flow currently supports reporter-side appeals with a private reference/access key. Seller-side notices, appeal access and enforcement integration remain separate release requirements.</p>
            <p>The current report decision path is a permission-controlled Admin review with recorded reasons and an appeal reviewer. Any automated content-screening or ranking systems require their own verified transparency disclosures before international launch.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/report-listing" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#563E32] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#795648]"><Flag size={16} /> Report a listing</Link>
              <Link to="/about" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#D6B9A3] px-4 py-2 text-[14px] font-semibold text-[#654132] hover:bg-[#F6E7DD]">How EPANTRY works <ArrowUpRight size={16} /></Link>
            </div>
          </Section>
          <Section id="disputes" number="07" title="Rights, complaints and disputes">
            <p>For an order problem, start with the order details and available support/Host channels. To report unlawful content, use <Link to="/report-listing" className="font-semibold underline underline-offset-4">Report listing</Link>; report status and eligible reporter appeals follow the existing private reference flow.</p>
            <p>The final terms must identify actual consumer-help contacts, the responsible contracting party, dispute-resolution routes and country-specific rules. Nothing here is intended to exclude statutory consumer rights or mandatory protections in a Customer's country.</p>
          </Section>
          <Section id="updates" number="08" title="Legal contact and updates">
            <p><strong>Legal operator:</strong> {operator || 'To be confirmed before publication.'}</p>
            <p><strong>Registered address:</strong> {postalAddress || 'To be confirmed before publication.'}</p>
            <p><strong>Legal contact:</strong> {legalEmail ? <a href={`mailto:${legalEmail}`} className="underline underline-offset-4">{legalEmail}</a> : 'To be confirmed before publication.'}</p>
            <p>Current document version: <strong>terms-v1</strong>. The final effective date and publication history must be recorded on approval. Material changes may require advance notice and renewed acknowledgement through the existing legal-consent workflow.</p>
            <p>Any jurisdiction or governing-law clause must be validated against the markets served and cannot override mandatory consumer rights.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#E5D4C9] pt-5">
              <Link to="/privacy-policy" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D6B9A3] px-4 py-2 text-[14px] font-semibold text-[#654132] hover:bg-[#F6E7DD]"><ShieldCheck size={16} /> Read privacy policy <ArrowUpRight size={15} /></Link>
              <Link to="/about" className="inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-[#654132] underline underline-offset-4"><FileText size={16} /> About EPANTRY</Link>
            </div>
          </Section>
        </article>
      </div>
    </main>
  )
}
