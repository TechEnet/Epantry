// EPANTRY: one-account, admin-verified legacy -> Hybrid assignment.
// Read-only unless --apply --confirm-hybrid are both specified.
// Never changes an account already assigned B2B, Brand/Seller or Chef/Restaurant.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js'
import { User } from '../src/modules/users/user.model.js'

function option(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? '' : String(process.argv[index + 1] || '').trim()
}
const email = option('--email').toLowerCase()
const apply = process.argv.includes('--apply')
const confirmed = process.argv.includes('--confirm-hybrid')
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/verify-hybrid-workspace.mjs --email ACCOUNT_EMAIL [--apply --confirm-hybrid]')
  process.exit(2)
}
if (apply !== confirmed) {
  console.error('For a workspace change, specify BOTH --apply and --confirm-hybrid. Otherwise omit both for read-only status.')
  process.exit(2)
}

try {
  await connectDatabase()
  const user = await User.findOne({ email })
    .select('_id email hostEnabled hostAccessStatus hostWorkspaceType accountStatus')
    .lean()

  if (!user) throw new Error('No EPANTRY user matches that email. No data changed.')
  const type = user.hostWorkspaceType || 'legacy (unset)'
  console.log(`Account: ${user.email}`)
  console.log(`Host access: enabled=${user.hostEnabled === true}; status=${user.hostAccessStatus || 'unknown'}`)
  console.log(`Current workspace: ${type}`)
  if (user.hostWorkspaceType === 'hybrid') {
    console.log('Already Hybrid. No database update required. Sign out and back in to refresh the session.')
  } else if (user.hostWorkspaceType) {
    throw new Error(`This account is already explicitly ${user.hostWorkspaceType}. Refusing to change another Host workspace.`)
  } else if (user.hostEnabled !== true || user.hostAccessStatus !== 'active') {
    throw new Error('Only already-active, approved legacy Host accounts qualify. No change made.')
  } else if (!apply) {
    console.log('Read-only check complete. If Super Admin has verified this account is intended to be Hybrid, rerun with --apply --confirm-hybrid.')
  } else {
    const result = await User.updateOne({
      _id: user._id,
      hostWorkspaceType: null,
      hostEnabled: true,
      hostAccessStatus: 'active',
    }, { $set: { hostWorkspaceType: 'hybrid' } })
    if (result.modifiedCount !== 1) throw new Error('Account changed concurrently or failed verification. No update applied.')
    console.log('Updated one approved legacy Host to Hybrid. Sign out and sign in again before testing.')
  }
} catch (error) {
  console.error(error?.message || error)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
