import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  getMyLearningDashboard,
} from './learning.dashboard.service.js'

import {
  resolveLearningMediaDelivery,
} from './learning.media.service.js'

import {
  createCourseLesson,
  createCourseModule,
  createLessonBookmark,
  deleteLessonBookmark,
  deleteLessonNote,
  getCourseCurriculum,
  getCreatorCourseCurriculum,
  getLessonLearningExperience,
  registerCourseMediaAsset,
  updateCourseLesson,
  updateCourseMediaAvailability,
  updateCourseModule,
  updateLessonProgress,
  upsertLessonNote,
} from './learning.service.js'

function sendSuccess(
  req,
  res,
  statusCode,
  data,
  message,
) {
  return res
    .status(statusCode)
    .json(
      new ApiResponse(
        statusCode,
        {
          ...data,
          requestId: req.requestId,
        },
        message,
      ),
    )
}

function wrap(handler) {
  return async function learningController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(req, res)
    } catch (error) {
      return next(error)
    }
  }
}

export const getMyLearningController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await getMyLearningDashboard({
        actorUser: req.currentUser,
      }),
      'My Learning loaded.',
    ),
)

export const getCourseCurriculumController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await getCourseCurriculum({
        courseId: req.validated.params.courseId,
        actorUser: req.currentUser,
      }),
      'Course curriculum loaded.',
    ),
)

export const getLessonLearningExperienceController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await getLessonLearningExperience({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        actorUser: req.currentUser,
      }),
      'Course lesson loaded.',
    ),
)

export const updateLessonProgressController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await updateLessonProgress({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Lesson progress updated.',
    ),
)

export const createLessonBookmarkController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      201,
      await createLessonBookmark({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Lesson bookmark saved.',
    ),
)

export const deleteLessonBookmarkController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await deleteLessonBookmark({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        bookmarkId: req.validated.params.bookmarkId,
        actorUser: req.currentUser,
      }),
      'Lesson bookmark removed.',
    ),
)

export const upsertLessonNoteController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      req.validated.body.noteId ? 200 : 201,
      await upsertLessonNote({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      req.validated.body.noteId
        ? 'Lesson note updated.'
        : 'Lesson note created.',
    ),
)

export const deleteLessonNoteController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await deleteLessonNote({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        noteId: req.validated.params.noteId,
        actorUser: req.currentUser,
      }),
      'Lesson note removed.',
    ),
)

export const resolveLearningMediaDeliveryController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await resolveLearningMediaDelivery({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        mediaId: req.validated.params.mediaId,
        actorUser: req.currentUser,
      }),
      'Authorized learning media delivery resolved.',
    ),
)

export const getCreatorCourseCurriculumController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await getCreatorCourseCurriculum({
        courseId: req.validated.params.courseId,
        actorUser: req.currentUser,
      }),
      'Creator course curriculum loaded.',
    ),
)

export const createCourseModuleController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      201,
      await createCourseModule({
        courseId: req.validated.params.courseId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Course module created.',
    ),
)

export const updateCourseModuleController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await updateCourseModule({
        courseId: req.validated.params.courseId,
        moduleId: req.validated.params.moduleId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Course module updated.',
    ),
)

export const createCourseLessonController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      201,
      await createCourseLesson({
        courseId: req.validated.params.courseId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Course lesson created.',
    ),
)

export const updateCourseLessonController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await updateCourseLesson({
        courseId: req.validated.params.courseId,
        lessonId: req.validated.params.lessonId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Course lesson updated.',
    ),
)

export const registerCourseMediaAssetController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      201,
      await registerCourseMediaAsset({
        courseId: req.validated.params.courseId,
        input: req.validated.body,
        actorUser: req.currentUser,
      }),
      'Course media asset registered.',
    ),
)

export const updateCourseMediaAvailabilityController = wrap(
  async (req, res) =>
    sendSuccess(
      req,
      res,
      200,
      await updateCourseMediaAvailability({
        courseId: req.validated.params.courseId,
        mediaId: req.validated.params.mediaId,
        availabilityState: req.validated.body.availabilityState,
        actorUser: req.currentUser,
      }),
      'Course media availability updated.',
    ),
)
