// EU trader checks reuse the approved Host KYB and accepted documents, never another KYB process.
import mongoose from 'mongoose'
import { ApiError } from '../../utils/ApiError.js'
import { MarketplaceOrganization } from '../marketplace/marketplace.models.js'
import { HostKybCase, HostOrganizationDocument } from '../hostOperations/hostOperations.models.js'
import { DsaTraderProfile } from './dsa.models.js'

function problem(message, status = 409) { throw new ApiError(status, message) }
export async function ownerOrganization(userId) {
  const org = await MarketplaceOrganization.findOne({ ownerUserId: userId, status: 'active' }).select('_id ownerUserId displayName').lean()
  if (!org) problem('Active Host business ownership is required.', 403)
  return org
}
export async function validateEvidence(organizationId, registrationEvidenceDocumentId, paymentEvidenceDocumentId) {
  const ids = [registrationEvidenceDocumentId, paymentEvidenceDocumentId]
  if (ids.some(id => !mongoose.isValidObjectId(id))) problem('Select two valid approved Host documents.', 400)
  const docs = await HostOrganizationDocument.find({ _id: { $in: ids }, organizationId, status: 'accepted',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
    .select('_id documentType').lean()
  const map = new Map(docs.map(d => [String(d._id), d.documentType]))
  if (!['incorporation', 'tax_registration', 'identity'].includes(map.get(String(registrationEvidenceDocumentId)))) {
    problem('Registration/identity evidence must be an accepted, unexpired document belonging to this Host.')
  }
  if (map.get(String(paymentEvidenceDocumentId)) !== 'bank_proof') {
    problem('Payment account evidence must be an accepted, unexpired bank-proof document belonging to this Host.')
  }
}
export async function assertEuTraderReady({ ownerUserId, session = null }) {
  if (process.env.EPANTRY_EU_MARKET_ENABLED !== 'true') return // Do not alter India-only launch flows.
  const org = await MarketplaceOrganization.findOne({ ownerUserId, status: 'active' }).session(session)
  if (!org) problem('EU listing cannot publish without an active Host business.')
  const [kyb, trader] = await Promise.all([
    HostKybCase.findOne({ organizationId: org._id, status: 'approved' }).session(session),
    DsaTraderProfile.findOne({ organizationId: org._id, status: 'verified', ownerUserId }).session(session),
  ])
  if (!kyb || !trader || !trader.selfCertification || trader.legalName.trim().toLowerCase() !== kyb.legalEntityName.trim().toLowerCase()) {
    problem('EU selling requires approved Host KYB and a verified DSA trader declaration.')
  }
  await validateEvidence(org._id, trader.registrationEvidenceDocumentId, trader.paymentEvidenceDocumentId)
  return trader
}
export async function submitTraderProfile({ ownerUserId, data }) {
  const org = await ownerOrganization(ownerUserId)
  const kyb = await HostKybCase.findOne({ organizationId: org._id, status: 'approved' }).lean()
  if (!kyb) problem('Complete existing Host KYB approval before EU trader verification.')
  if (data.legalName.trim().toLowerCase() !== kyb.legalEntityName.trim().toLowerCase()) {
    problem('Trader legal name must match the approved Host KYB record.', 400)
  }
  await validateEvidence(org._id, data.registrationEvidenceDocumentId, data.paymentEvidenceDocumentId)
  const current = await DsaTraderProfile.findOne({ organizationId: org._id })
  if (current?.status === 'verified') problem('Verified trader details are locked. Contact Trust & Safety for a governed change.')
  const profile = await DsaTraderProfile.findOneAndUpdate({ organizationId: org._id },
    { $set: { ...data, ownerUserId, status: 'submitted', verifiedAt: null, verifiedBy: null, reviewReason: '' } },
    { new: true, upsert: true, runValidators: true })
  return safeProfile(profile)
}
export function safeProfile(p) {
  if (!p) return null
  return { id: String(p._id), legalName: p.legalName, postalAddress: p.postalAddress,
    contactEmail: p.contactEmail, contactPhone: p.contactPhone, businessRegister: p.businessRegister,
    registrationNumber: p.registrationNumber, registrationEvidenceDocumentId: String(p.registrationEvidenceDocumentId),
    paymentEvidenceDocumentId: String(p.paymentEvidenceDocumentId), selfCertification: p.selfCertification,
    status: p.status, reviewedAt: p.verifiedAt, reviewReason: p.reviewReason }
}
export function publicTrader(p) {
  if (!p || p.status !== 'verified') return null
  return { legalName: p.legalName, postalAddress: p.postalAddress, contactEmail: p.contactEmail,
    contactPhone: p.contactPhone, businessRegister: p.businessRegister, registrationNumber: p.registrationNumber }
}
export async function decideTraderProfile({ id, decision, reason, actorId }) {
  if (!mongoose.isValidObjectId(id)) problem('Invalid trader profile ID.', 400)
  const profile = await DsaTraderProfile.findOne({ _id: id, status: 'submitted' })
  if (!profile) problem('Only submitted profiles can be reviewed.')
  if (decision === 'verified') {
    const org = await MarketplaceOrganization.findOne({ _id: profile.organizationId, ownerUserId: profile.ownerUserId, status: 'active' }).lean()
    const kyb = await HostKybCase.findOne({ organizationId: profile.organizationId, status: 'approved' }).lean()
    if (!org || !kyb || kyb.legalEntityName.trim().toLowerCase() !== profile.legalName.trim().toLowerCase()) {
      problem('Host business and KYB must match before verification.')
    }
    await validateEvidence(profile.organizationId, profile.registrationEvidenceDocumentId, profile.paymentEvidenceDocumentId)
  }
  profile.status = decision
  profile.reviewReason = reason
  profile.verifiedAt = decision === 'verified' ? new Date() : null
  profile.verifiedBy = decision === 'verified' ? actorId : null
  profile.reviewHistory.push({ reviewerId: actorId, decision, reason })
  await profile.save()
  return safeProfile(profile)
}
