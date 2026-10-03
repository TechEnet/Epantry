import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(backendRoot, '..')

function readBackend(relativePath) {
  return fs.readFileSync(path.join(backendRoot, relativePath), 'utf8')
}

function readFrontend(relativePath) {
  return fs.readFileSync(path.join(projectRoot, 'frontend', relativePath), 'utf8')
}

test('M4-B professional courses are standalone drafts and no longer depend on a public Customer Community Recipe', () => {
  const models = readBackend('src/modules/community/community.models.js')
  const service = readBackend('src/modules/community/community.service.js')
  const validation = readBackend('src/modules/community/community.validation.js')

  assert.match(models, /CREATOR_COURSE_STATUSES[\s\S]*?'draft'[\s\S]*?'in_review'[\s\S]*?'listed'[\s\S]*?'rejected'[\s\S]*?'archived'/)
  assert.match(models, /linkedCommunityRecipeId:[\s\S]*?default:\s*null/)
  assert.match(models, /linkedRecipeVersionId:[\s\S]*?default:\s*null/)
  assert.match(models, /status:[\s\S]*?default:\s*'draft'/)
  assert.match(validation, /linkedCommunityRecipeId:[\s\S]*?objectIdSchema[\s\S]*?\.optional\(\)/)
  assert.match(service, /createCreatorCourse[\s\S]*?linkedCommunityRecipeId:[\s\S]*?null[\s\S]*?linkedRecipeVersionId:[\s\S]*?null[\s\S]*?status:[\s\S]*?'draft'/)
})

test('M4-B Creator governance submission is Chef + Restaurant Host gated and validates published modules, lessons and video media', () => {
  const routes = readBackend('src/modules/communityExpansion/communityExpansion.routes.js')
  const service = readBackend('src/modules/communityExpansion/communityExpansion.service.js')

  assert.match(routes, /const creatorHostSecurity = \[[\s\S]*?requireChefRestaurantHostAccess[\s\S]*?\]/)
  assert.match(routes, /['"]\/community-trust\/creator-content['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(service, /requireCreatorCourseReadyForReview/)
  assert.match(service, /CourseModule\.countDocuments[\s\S]*?status:[\s\S]*?'published'/)
  assert.match(service, /CourseLesson\.find[\s\S]*?status:[\s\S]*?'published'/)
  assert.match(service, /CourseMediaAsset\.exists[\s\S]*?availabilityState:[\s\S]*?'available'/)
})

test('M4-B course submit creates or resubmits governance, locks course in review and notifies Super Admin with deep link metadata', () => {
  const service = readBackend('src/modules/communityExpansion/communityExpansion.service.js')
  const notifications = readBackend('src/modules/notifications/notification.models.js')
  const notificationService = readBackend('src/modules/notifications/notification.service.js')

  assert.match(service, /governance\.governanceState\s*=\s*['"]pending_review['"]/)
  assert.match(service, /CreatorCourse\.updateOne[\s\S]*?status:[\s\S]*?'in_review'/)
  assert.match(service, /notifyActiveSuperAdminsBestEffort\(\{[\s\S]*?triggerType:[\s\S]*?'creator_approval_requested'/)
  assert.match(notifications, /['"]creator_approval_requested['"]/)
  assert.match(notificationService, /case ['"]creator_approval_requested['"]:[\s\S]*?\/admin\/community/)
  assert.match(notificationService, /creator-content-governance/)
})

test('M4-B Super Admin Creator Ops approval controls customer discovery state without deleting course history', () => {
  const service = readBackend('src/modules/communityExpansion/communityExpansion.service.js')
  const adminPanel = readFrontend('src/features/communityExpansion/components/AdminExpansionTrustPanel.jsx')

  assert.match(service, /reviewAdminCreatorContent/)
  assert.match(service, /input\.decision ===[\s\S]*?'approved'[\s\S]*?\? 'listed'/)
  assert.match(service, /input\.decision ===[\s\S]*?'removed'[\s\S]*?\? 'archived'/)
  assert.match(service, /:\s*'rejected'/)
  assert.match(service, /input\.decision ===[\s\S]*?'approved'[\s\S]*?record\.rights\.takedownState[\s\S]*?'clear'/)
  assert.match(adminPanel, /id="creator-content-governance"/)
  assert.match(adminPanel, /Creator course & media approval/)
  assert.match(adminPanel, /Creator course approved and released to Learn \/ Pro/)
  assert.match(adminPanel, /Creator course returned to the Host for changes/)
})

test('M4-B Host Course Builder owns submit-to-Super-Admin flow and locks editing while in review or approved', () => {
  const learningService = readBackend('src/modules/learning/learning.service.js')
  const builder = readFrontend('src/features/learning/pages/CreatorCourseBuilderPage.jsx')

  assert.match(learningService, /function requireEditableCreatorCourse/)
  assert.match(learningService, /!\[[\s\S]*?'draft'[\s\S]*?'rejected'[\s\S]*?\]\.includes/)
  assert.match(learningService, /waiting for Super Admin review/)
  assert.match(builder, /registerCreatorContent/)
  assert.match(builder, /Submit to Super Admin/)
  assert.match(builder, /courseStatus === 'in_review'/)
  assert.match(builder, /Only approved Creator courses become visible in Learn \/ Pro/)
})

test('M4-B Creator Studio lists own draft/review/rejected courses while Customer Learn sees only listed courses', () => {
  const communityService = readBackend('src/modules/community/community.service.js')
  const frontendService = readFrontend('src/features/community/services/community.service.js')
  const profile = readFrontend('src/features/community/pages/CreatorProfilePage.jsx')
  const learn = readFrontend('src/features/community/pages/LearnProPage.jsx')

  assert.match(communityService, /listMyCreatorCourses/)
  assert.match(communityService, /status:\s*\{[\s\S]*?\$ne:[\s\S]*?'archived'/)
  assert.match(communityService, /listCreatorCourses[\s\S]*?status:[\s\S]*?'listed'/)
  assert.match(frontendService, /export async function listMyCreatorCourses/)
  assert.match(profile, /listMyCreatorCourses/)
  assert.match(profile, /Course draft created/)
  assert.doesNotMatch(profile, /publicRecipeOptions/)
  assert.match(learn, /entitled && item\.recipe/)
})

test('M4-B creator verification request also informs Super Admin and Admin deep-link opens the creator queue', () => {
  const service = readBackend('src/modules/community/community.service.js')
  const adminPage = readFrontend('src/features/community/pages/AdminCommunityPage.jsx')
  const notificationService = readBackend('src/modules/notifications/notification.service.js')

  assert.match(service, /requestCreatorVerification[\s\S]*?notifyActiveSuperAdminsBestEffort[\s\S]*?creator\.verification_requested/)
  assert.match(notificationService, /creator_profile[\s\S]*?\/admin\/community\?tab=creators/)
  assert.match(adminPage, /useSearchParams/)
  assert.match(adminPage, /searchParams\.get\(['"]tab['"]\) === ['"]creators['"]/)
})
