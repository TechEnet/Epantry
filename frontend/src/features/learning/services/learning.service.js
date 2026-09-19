import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(response) {
  if (
    response?.data &&
    typeof response.data === 'object' &&
    Object.prototype.hasOwnProperty.call(response.data, 'success')
  ) {
    return response.data.data
  }

  return response?.data ?? response
}

function encodePath(value) {
  return encodeURIComponent(String(value || '').trim())
}

async function getCsrfToken() {
  const response = await apiClient.get('/auth/csrf')
  const data = unwrap(response)

  if (!data?.csrfToken) {
    throw new Error('Unable to initialize secure Learning request.')
  }

  return data.csrfToken
}

async function mutate({
  method = 'post',
  url,
  data = {},
}) {
  const csrfToken = await getCsrfToken()

  const response = await apiClient.request({
    method,
    url,
    data,
    headers: {
      'x-csrf-token': csrfToken,
    },
  })

  return unwrap(response)
}

export function getLearningErrorMessage(
  error,
  fallback = 'Unable to complete this learning action right now.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

/* Learner */

export async function getMyLearning() {
  const response = await apiClient.get('/learning/me')
  return unwrap(response)
}

export async function getCourseCurriculum(courseId) {
  const response = await apiClient.get(
    `/learning/courses/${encodePath(courseId)}`,
  )

  return unwrap(response)
}

export async function getCourseLesson({
  courseId,
  lessonId,
}) {
  const response = await apiClient.get(
    `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}`,
  )

  return unwrap(response)
}

export async function resolveCourseMedia({
  courseId,
  lessonId,
  mediaId,
}) {
  const response = await apiClient.get(
    `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}/media/${encodePath(mediaId)}/delivery`,
  )

  return unwrap(response)
}

export async function updateCourseLessonProgress({
  courseId,
  lessonId,
  input,
}) {
  return mutate({
    method: 'patch',
    url: `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}/progress`,
    data: input,
  })
}

export async function createCourseLessonBookmark({
  courseId,
  lessonId,
  input,
}) {
  return mutate({
    url: `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}/bookmarks`,
    data: input,
  })
}

export async function deleteCourseLessonBookmark({
  courseId,
  lessonId,
  bookmarkId,
}) {
  return mutate({
    method: 'delete',
    url: `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}/bookmarks/${encodePath(bookmarkId)}`,
  })
}

export async function saveCourseLessonNote({
  courseId,
  lessonId,
  input,
}) {
  return mutate({
    method: 'put',
    url: `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}/notes`,
    data: input,
  })
}

export async function deleteCourseLessonNote({
  courseId,
  lessonId,
  noteId,
}) {
  return mutate({
    method: 'delete',
    url: `/learning/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}/notes/${encodePath(noteId)}`,
  })
}

/* Verified Creator authoring */

export async function getCreatorCourseCurriculum(courseId) {
  const response = await apiClient.get(
    `/learning/creator/courses/${encodePath(courseId)}/curriculum`,
  )

  return unwrap(response)
}

export async function createLearningCourseModule({
  courseId,
  input,
}) {
  return mutate({
    url: `/learning/creator/courses/${encodePath(courseId)}/modules`,
    data: input,
  })
}

export async function updateLearningCourseModule({
  courseId,
  moduleId,
  input,
}) {
  return mutate({
    method: 'patch',
    url: `/learning/creator/courses/${encodePath(courseId)}/modules/${encodePath(moduleId)}`,
    data: input,
  })
}

export async function createLearningCourseLesson({
  courseId,
  input,
}) {
  return mutate({
    url: `/learning/creator/courses/${encodePath(courseId)}/lessons`,
    data: input,
  })
}

export async function updateLearningCourseLesson({
  courseId,
  lessonId,
  input,
}) {
  return mutate({
    method: 'patch',
    url: `/learning/creator/courses/${encodePath(courseId)}/lessons/${encodePath(lessonId)}`,
    data: input,
  })
}

export async function registerLearningCourseMedia({
  courseId,
  input,
}) {
  return mutate({
    url: `/learning/creator/courses/${encodePath(courseId)}/media`,
    data: input,
  })
}

export async function updateLearningCourseMedia({
  courseId,
  mediaId,
  availabilityState,
}) {
  return mutate({
    method: 'patch',
    url: `/learning/creator/courses/${encodePath(courseId)}/media/${encodePath(mediaId)}`,
    data: {
      availabilityState,
    },
  })
}
