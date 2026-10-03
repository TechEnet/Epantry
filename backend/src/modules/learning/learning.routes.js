import {
  Router,
} from 'express'

import {
  z,
} from 'zod'

import {
  sensitiveResponseNoStoreMiddleware,
} from '../../middlewares/security.middleware.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  requireChefRestaurantHostAccess,
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  createCourseLessonController,
  createCourseModuleController,
  createProMembershipCheckoutController,
  createLessonBookmarkController,
  deleteLessonBookmarkController,
  deleteLessonNoteController,
  getCourseCurriculumController,
  getCreatorCourseCurriculumController,
  getLessonLearningExperienceController,
  getMyLearningController,
  getProMembershipOverviewController,
  getPublicProCatalogController,
  registerCourseMediaAssetController,
  resolveLearningMediaDeliveryController,
  updateCourseLessonController,
  updateCourseMediaAvailabilityController,
  updateCourseModuleController,
  updateLessonProgressController,
  upsertLessonNoteController,
  verifyProMembershipPaymentController,
} from './learning.controller.js'

import {
  courseIdParamsSchema,
  courseLessonParamsSchema,
  courseModuleParamsSchema,
  createCourseLessonBodySchema,
  createCourseModuleBodySchema,
  createLessonBookmarkBodySchema,
  learningObjectIdSchema,
  registerCourseMediaBodySchema,
  updateCourseLessonBodySchema,
  updateCourseMediaStateBodySchema,
  updateCourseModuleBodySchema,
  updateLessonProgressBodySchema,
  upsertLessonNoteBodySchema,
} from './learning.validation.js'

const router = Router()

const customerSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
]

const creatorHostSecurity = [
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireChefRestaurantHostAccess,
]

const courseMediaParamsSchema = z
  .object({
    courseId: learningObjectIdSchema,
    mediaId: learningObjectIdSchema,
  })
  .strict()

const lessonMediaParamsSchema = z
  .object({
    courseId: learningObjectIdSchema,
    lessonId: learningObjectIdSchema,
    mediaId: learningObjectIdSchema,
  })
  .strict()

const lessonBookmarkParamsSchema = z
  .object({
    courseId: learningObjectIdSchema,
    lessonId: learningObjectIdSchema,
    bookmarkId: learningObjectIdSchema,
  })
  .strict()

const lessonNoteParamsSchema = z
  .object({
    courseId: learningObjectIdSchema,
    lessonId: learningObjectIdSchema,
    noteId: learningObjectIdSchema,
  })
  .strict()


const proPlanParamsSchema = z
  .object({
    planCode: z.enum([
      'monthly',
      'quarterly',
      'half_year',
      'annual',
    ]),
  })
  .strict()

const proPaymentParamsSchema = z
  .object({
    paymentId: learningObjectIdSchema,
  })
  .strict()

const verifyProPaymentBodySchema = z
  .object({
    razorpayPaymentId: z.string().trim().min(1).max(180),
    razorpayOrderId: z.string().trim().min(1).max(180),
    razorpaySignature: z.string().trim().min(1).max(512),
  })
  .strict()

function validate(schema, source, code, message) {
  return function learningValidationMiddleware(
    req,
    res,
    next,
  ) {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      return next(
        new ApiError(
          400,
          message,
          [
            {
              code,
              issues: result.error.issues,
            },
          ],
        ),
      )
    }

    req.validated = {
      ...(req.validated || {}),
      [source]: result.data,
    }

    return next()
  }
}



/*
|--------------------------------------------------------------------------
| Public EPANTRY Pro catalog
|--------------------------------------------------------------------------
|
| Pricing and included benefits are visible before sign-in. Membership state
| remains Customer-scoped below the authenticated boundary.
|
*/

router.get(
  '/pro/catalog',
  sensitiveResponseNoStoreMiddleware,
  getPublicProCatalogController,
)

/*
|--------------------------------------------------------------------------
| Verified Creator course authoring
|--------------------------------------------------------------------------
|
| The service layer verifies current Chef/Creator status and owned-course
| scope again. These routes never create a Creator application role.
|--------------------------------------------------------------------------
*/

router.get(
  '/creator/courses/:courseId/curriculum',
  ...creatorHostSecurity,
  validate(
    courseIdParamsSchema,
    'params',
    'LEARNING_COURSE_ID_INVALID',
    'Invalid Creator course ID.',
  ),
  getCreatorCourseCurriculumController,
)

router.post(
  '/creator/courses/:courseId/modules',
  ...creatorHostSecurity,
  requireCsrfToken,
  validate(
    courseIdParamsSchema,
    'params',
    'LEARNING_COURSE_ID_INVALID',
    'Invalid Creator course ID.',
  ),
  validate(
    createCourseModuleBodySchema,
    'body',
    'LEARNING_MODULE_INPUT_INVALID',
    'Invalid course module input.',
  ),
  createCourseModuleController,
)

router.patch(
  '/creator/courses/:courseId/modules/:moduleId',
  ...creatorHostSecurity,
  requireCsrfToken,
  validate(
    courseModuleParamsSchema,
    'params',
    'LEARNING_MODULE_ID_INVALID',
    'Invalid course module identity.',
  ),
  validate(
    updateCourseModuleBodySchema,
    'body',
    'LEARNING_MODULE_UPDATE_INVALID',
    'Invalid course module update.',
  ),
  updateCourseModuleController,
)

router.post(
  '/creator/courses/:courseId/lessons',
  ...creatorHostSecurity,
  requireCsrfToken,
  validate(
    courseIdParamsSchema,
    'params',
    'LEARNING_COURSE_ID_INVALID',
    'Invalid Creator course ID.',
  ),
  validate(
    createCourseLessonBodySchema,
    'body',
    'LEARNING_LESSON_INPUT_INVALID',
    'Invalid course lesson input.',
  ),
  createCourseLessonController,
)

router.patch(
  '/creator/courses/:courseId/lessons/:lessonId',
  ...creatorHostSecurity,
  requireCsrfToken,
  validate(
    courseLessonParamsSchema,
    'params',
    'LEARNING_LESSON_ID_INVALID',
    'Invalid course lesson identity.',
  ),
  validate(
    updateCourseLessonBodySchema,
    'body',
    'LEARNING_LESSON_UPDATE_INVALID',
    'Invalid course lesson update.',
  ),
  updateCourseLessonController,
)

router.post(
  '/creator/courses/:courseId/media',
  ...creatorHostSecurity,
  requireCsrfToken,
  validate(
    courseIdParamsSchema,
    'params',
    'LEARNING_COURSE_ID_INVALID',
    'Invalid Creator course ID.',
  ),
  validate(
    registerCourseMediaBodySchema,
    'body',
    'LEARNING_MEDIA_INPUT_INVALID',
    'Invalid course media input.',
  ),
  registerCourseMediaAssetController,
)

router.patch(
  '/creator/courses/:courseId/media/:mediaId',
  ...creatorHostSecurity,
  requireCsrfToken,
  validate(
    courseMediaParamsSchema,
    'params',
    'LEARNING_MEDIA_ID_INVALID',
    'Invalid course media identity.',
  ),
  validate(
    updateCourseMediaStateBodySchema,
    'body',
    'LEARNING_MEDIA_STATE_INVALID',
    'Invalid course media availability state.',
  ),
  updateCourseMediaAvailabilityController,
)


router.use(...customerSecurity)

/*
|--------------------------------------------------------------------------
| Learner workspace
|--------------------------------------------------------------------------
*/

router.get(
  '/me',
  getMyLearningController,
)

router.get(
  '/pro/overview',
  getProMembershipOverviewController,
)


router.post(
  '/pro/plans/:planCode/checkout',
  requireCsrfToken,
  validate(
    proPlanParamsSchema,
    'params',
    'PRO_PLAN_CODE_INVALID',
    'Invalid EPANTRY Pro plan.',
  ),
  createProMembershipCheckoutController,
)

router.post(
  '/pro/payments/:paymentId/verify',
  requireCsrfToken,
  validate(
    proPaymentParamsSchema,
    'params',
    'PRO_PAYMENT_ID_INVALID',
    'Invalid EPANTRY Pro payment identity.',
  ),
  validate(
    verifyProPaymentBodySchema,
    'body',
    'PRO_PAYMENT_VERIFICATION_INPUT_INVALID',
    'Invalid Razorpay verification response.',
  ),
  verifyProMembershipPaymentController,
)

router.get(
  '/courses/:courseId',
  validate(
    courseIdParamsSchema,
    'params',
    'LEARNING_COURSE_ID_INVALID',
    'Invalid learning course ID.',
  ),
  getCourseCurriculumController,
)

router.get(
  '/courses/:courseId/lessons/:lessonId',
  validate(
    courseLessonParamsSchema,
    'params',
    'LEARNING_LESSON_ID_INVALID',
    'Invalid learning lesson identity.',
  ),
  getLessonLearningExperienceController,
)

router.get(
  '/courses/:courseId/lessons/:lessonId/media/:mediaId/delivery',
  validate(
    lessonMediaParamsSchema,
    'params',
    'LEARNING_MEDIA_ID_INVALID',
    'Invalid learning media identity.',
  ),
  resolveLearningMediaDeliveryController,
)

router.patch(
  '/courses/:courseId/lessons/:lessonId/progress',
  requireCsrfToken,
  validate(
    courseLessonParamsSchema,
    'params',
    'LEARNING_LESSON_ID_INVALID',
    'Invalid learning lesson identity.',
  ),
  validate(
    updateLessonProgressBodySchema,
    'body',
    'LEARNING_PROGRESS_INPUT_INVALID',
    'Invalid lesson progress update.',
  ),
  updateLessonProgressController,
)

router.post(
  '/courses/:courseId/lessons/:lessonId/bookmarks',
  requireCsrfToken,
  validate(
    courseLessonParamsSchema,
    'params',
    'LEARNING_LESSON_ID_INVALID',
    'Invalid learning lesson identity.',
  ),
  validate(
    createLessonBookmarkBodySchema,
    'body',
    'LEARNING_BOOKMARK_INPUT_INVALID',
    'Invalid lesson bookmark.',
  ),
  createLessonBookmarkController,
)

router.delete(
  '/courses/:courseId/lessons/:lessonId/bookmarks/:bookmarkId',
  requireCsrfToken,
  validate(
    lessonBookmarkParamsSchema,
    'params',
    'LEARNING_BOOKMARK_ID_INVALID',
    'Invalid lesson bookmark identity.',
  ),
  deleteLessonBookmarkController,
)

router.put(
  '/courses/:courseId/lessons/:lessonId/notes',
  requireCsrfToken,
  validate(
    courseLessonParamsSchema,
    'params',
    'LEARNING_LESSON_ID_INVALID',
    'Invalid learning lesson identity.',
  ),
  validate(
    upsertLessonNoteBodySchema,
    'body',
    'LEARNING_NOTE_INPUT_INVALID',
    'Invalid lesson note.',
  ),
  upsertLessonNoteController,
)

router.delete(
  '/courses/:courseId/lessons/:lessonId/notes/:noteId',
  requireCsrfToken,
  validate(
    lessonNoteParamsSchema,
    'params',
    'LEARNING_NOTE_ID_INVALID',
    'Invalid lesson note identity.',
  ),
  deleteLessonNoteController,
)


export default router
