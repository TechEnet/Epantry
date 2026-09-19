import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  FilePlus2,
  Layers3,
  LoaderCircle,
  Plus,
  Radio,
  ShieldCheck,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  createLearningCourseLesson,
  createLearningCourseModule,
  getCreatorCourseCurriculum,
  getLearningErrorMessage,
  registerLearningCourseMedia,
  updateLearningCourseLesson,
  updateLearningCourseMedia,
  updateLearningCourseModule,
} from '../services/learning.service'

function statusClass(status) {
  if (status === 'published' || status === 'available') {
    return 'bg-emerald-100 text-emerald-800'
  }

  if (status === 'archived' || status === 'removed') {
    return 'bg-stone-200 text-stone-700'
  }

  return 'bg-amber-100 text-amber-800'
}

export default function CreatorCourseBuilderPage() {
  const {
    courseId,
  } = useParams()

  const [curriculum, setCurriculum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [moduleForm, setModuleForm] = useState({
    moduleKey: '',
    title: '',
    summary: '',
    sortOrder: 0,
  })

  const [lessonForm, setLessonForm] = useState({
    moduleId: '',
    lessonKey: '',
    title: '',
    summary: '',
    lessonType: 'video',
    accessPolicy: 'course',
    sortOrder: 0,
    durationSeconds: 0,
    bodyText: '',
    linkedRecipeVersionId: '',
    isRequiredForCompletion: true,
  })

  const [mediaForm, setMediaForm] = useState({
    lessonId: '',
    mediaType: 'video',
    storageProvider: 'external_https',
    assetReference: '',
    language: 'en',
    label: '',
    mimeType: 'video/mp4',
    durationSeconds: 0,
    availabilityState: 'processing',
    isDefault: true,
    downloadable: false,
    rightsStatement: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getCreatorCourseCurriculum(courseId)
      setCurriculum(result)
    } catch (requestError) {
      setError(
        getLearningErrorMessage(
          requestError,
          'Unable to load Creator course curriculum.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const lessons = useMemo(
    () =>
      (curriculum?.modules || []).flatMap(
        (module) => module.lessons || [],
      ),
    [curriculum],
  )

  async function run(action, successMessage) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await action()
      setNotice(successMessage)
      await load()
    } catch (requestError) {
      setError(getLearningErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateModule(event) {
    event.preventDefault()

    await run(
      () =>
        createLearningCourseModule({
          courseId,
          input: {
            ...moduleForm,
            sortOrder: Number(moduleForm.sortOrder || 0),
          },
        }),
      'Course module created.',
    )

    setModuleForm({
      moduleKey: '',
      title: '',
      summary: '',
      sortOrder: 0,
    })
  }

  async function handleCreateLesson(event) {
    event.preventDefault()

    await run(
      () =>
        createLearningCourseLesson({
          courseId,
          input: {
            ...lessonForm,
            durationSeconds: Number(lessonForm.durationSeconds || 0),
            sortOrder: Number(lessonForm.sortOrder || 0),
            linkedRecipeVersionId:
              lessonForm.lessonType === 'recipe'
                ? lessonForm.linkedRecipeVersionId || null
                : null,
            bodyText:
              lessonForm.lessonType === 'text'
                ? lessonForm.bodyText
                : '',
          },
        }),
      'Course lesson created.',
    )

    setLessonForm((current) => ({
      ...current,
      lessonKey: '',
      title: '',
      summary: '',
      durationSeconds: 0,
      bodyText: '',
      linkedRecipeVersionId: '',
    }))
  }

  async function handleRegisterMedia(event) {
    event.preventDefault()

    await run(
      () =>
        registerLearningCourseMedia({
          courseId,
          input: {
            ...mediaForm,
            durationSeconds: Number(mediaForm.durationSeconds || 0),
          },
        }),
      'Learning media metadata registered.',
    )

    setMediaForm((current) => ({
      ...current,
      assetReference: '',
      label: '',
      rightsStatement: '',
    }))
  }

  if (loading) {
    return (
      <main className="page-shell grid min-h-[60vh] place-items-center py-10">
        <LoaderCircle className="animate-spin text-emerald-700" aria-label="Loading Creator course builder" />
      </main>
    )
  }

  return (
    <main className="page-shell py-8 sm:py-10">
      <Link
        to="/creator-studio"
        className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-emerald-800"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Creator Studio
      </Link>

      <section className="mt-5 rounded-[30px] bg-stone-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600">
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
              Verified Creator Authoring
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Course Builder
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-400">
              Build modules, lessons and governed media on the existing M15 CreatorCourse. CourseEntitlement remains the Pro access authority; this builder never creates a new application role.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="mt-6 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Layers3 size={18} className="text-emerald-700" aria-hidden="true" />
          <h2 className="text-xl font-black text-stone-950">Curriculum</h2>
        </div>

        <div className="mt-5 space-y-4">
          {(curriculum?.modules || []).length ? curriculum.modules.map((module, index) => (
            <article key={module.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Module {index + 1} · {module.moduleKey}
                  </p>
                  <h3 className="mt-1 text-base font-black text-stone-900">{module.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{module.summary || 'No summary'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(module.status)}`}>
                    {module.status}
                  </span>
                  {module.status === 'draft' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(
                        () => updateLearningCourseModule({
                          courseId,
                          moduleId: module.id,
                          input: { status: 'published' },
                        }),
                        'Module published.',
                      )}
                      className="focus-ring rounded-xl bg-emerald-700 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
                    >
                      Publish
                    </button>
                  ) : module.status === 'published' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(
                        () => updateLearningCourseModule({
                          courseId,
                          moduleId: module.id,
                          input: { status: 'archived' },
                        }),
                        'Module archived.',
                      )}
                      className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-[10px] font-black text-stone-700 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {(module.lessons || []).map((lesson) => (
                  <div key={lesson.id} className="rounded-xl bg-stone-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-800">{lesson.title}</p>
                        <p className="mt-1 text-[11px] font-semibold text-stone-500">
                          {lesson.lessonType.replace(/_/g, ' ')} · {lesson.accessPolicy} · {lesson.media?.length || 0} media assets
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusClass(lesson.status)}`}>
                          {lesson.status}
                        </span>
                        {lesson.status === 'draft' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(
                              () => updateLearningCourseLesson({
                                courseId,
                                lessonId: lesson.id,
                                input: { status: 'published' },
                              }),
                              'Lesson published.',
                            )}
                            className="focus-ring rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[9px] font-black text-white disabled:opacity-50"
                          >
                            Publish
                          </button>
                        ) : lesson.status === 'published' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(
                              () => updateLearningCourseLesson({
                                courseId,
                                lessonId: lesson.id,
                                input: { status: 'archived' },
                              }),
                              'Lesson archived.',
                            )}
                            className="focus-ring rounded-lg border border-stone-200 px-2.5 py-1.5 text-[9px] font-black text-stone-600 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {(lesson.media || []).length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lesson.media.map((media) => (
                          <div key={media.id} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-stone-600">
                            <Radio size={11} aria-hidden="true" />
                            {media.mediaType} · {media.availabilityState}
                            {media.availabilityState === 'processing' ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => run(
                                  () => updateLearningCourseMedia({
                                    courseId,
                                    mediaId: media.id,
                                    availabilityState: 'available',
                                  }),
                                  'Media marked available.',
                                )}
                                className="font-black text-emerald-700"
                              >
                                Mark available
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          )) : (
            <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm font-bold text-stone-400">
              Create the first module below.
            </p>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <form onSubmit={handleCreateModule} className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus size={17} className="text-emerald-700" aria-hidden="true" />
            <h2 className="text-sm font-black text-stone-900">Add module</h2>
          </div>

          <input
            required
            value={moduleForm.title}
            onChange={(event) => setModuleForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Module title"
            className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <input
            required
            value={moduleForm.moduleKey}
            onChange={(event) => setModuleForm((current) => ({ ...current, moduleKey: event.target.value }))}
            placeholder="module-key"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <textarea
            rows={3}
            value={moduleForm.summary}
            onChange={(event) => setModuleForm((current) => ({ ...current, summary: event.target.value }))}
            placeholder="Module summary"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <input
            type="number"
            min="0"
            value={moduleForm.sortOrder}
            onChange={(event) => setModuleForm((current) => ({ ...current, sortOrder: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <button disabled={busy} className="focus-ring mt-3 w-full rounded-xl bg-stone-950 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">
            Add module
          </button>
        </form>

        <form onSubmit={handleCreateLesson} className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FilePlus2 size={17} className="text-emerald-700" aria-hidden="true" />
            <h2 className="text-sm font-black text-stone-900">Add lesson</h2>
          </div>

          <select
            required
            value={lessonForm.moduleId}
            onChange={(event) => setLessonForm((current) => ({ ...current, moduleId: event.target.value }))}
            className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          >
            <option value="">Select module</option>
            {(curriculum?.modules || []).filter((item) => item.status !== 'archived').map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <input
            required
            value={lessonForm.title}
            onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Lesson title"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <input
            required
            value={lessonForm.lessonKey}
            onChange={(event) => setLessonForm((current) => ({ ...current, lessonKey: event.target.value }))}
            placeholder="lesson-key"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={lessonForm.lessonType}
              onChange={(event) => setLessonForm((current) => ({ ...current, lessonType: event.target.value }))}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
            >
              <option value="video">Video</option>
              <option value="live_recording">Live recording</option>
              <option value="text">Text</option>
              <option value="recipe">Recipe</option>
            </select>
            <select
              value={lessonForm.accessPolicy}
              onChange={(event) => setLessonForm((current) => ({ ...current, accessPolicy: event.target.value }))}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
            >
              <option value="course">Course access</option>
              <option value="preview">Preview</option>
            </select>
          </div>

          {lessonForm.lessonType === 'text' ? (
            <textarea
              required
              rows={4}
              value={lessonForm.bodyText}
              onChange={(event) => setLessonForm((current) => ({ ...current, bodyText: event.target.value }))}
              placeholder="Lesson text"
              className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
            />
          ) : null}

          {lessonForm.lessonType === 'recipe' ? (
            <input
              required
              value={lessonForm.linkedRecipeVersionId}
              onChange={(event) => setLessonForm((current) => ({ ...current, linkedRecipeVersionId: event.target.value }))}
              placeholder="Published RecipeVersion ObjectId"
              className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
            />
          ) : null}

          <button disabled={busy || !lessonForm.moduleId} className="focus-ring mt-3 w-full rounded-xl bg-stone-950 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">
            Add lesson
          </button>
        </form>

        <form onSubmit={handleRegisterMedia} className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Radio size={17} className="text-emerald-700" aria-hidden="true" />
            <h2 className="text-sm font-black text-stone-900">Register media</h2>
          </div>

          <select
            required
            value={mediaForm.lessonId}
            onChange={(event) => setMediaForm((current) => ({ ...current, lessonId: event.target.value }))}
            className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          >
            <option value="">Select lesson</option>
            {lessons.filter((item) => item.status !== 'archived').map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={mediaForm.mediaType}
              onChange={(event) => setMediaForm((current) => ({ ...current, mediaType: event.target.value }))}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
            >
              <option value="video">Video</option>
              <option value="live_recording">Live recording</option>
              <option value="caption">Caption</option>
              <option value="transcript">Transcript</option>
              <option value="download">Download</option>
            </select>
            <select
              value={mediaForm.storageProvider}
              onChange={(event) => setMediaForm((current) => ({ ...current, storageProvider: event.target.value }))}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
            >
              <option value="external_https">External HTTPS</option>
              <option value="cloudinary_authenticated_video">Cloudinary authenticated video</option>
              <option value="cloudinary_authenticated_raw">Cloudinary authenticated raw</option>
            </select>
          </div>
          <input
            required
            value={mediaForm.assetReference}
            onChange={(event) => setMediaForm((current) => ({ ...current, assetReference: event.target.value }))}
            placeholder={mediaForm.storageProvider === 'external_https' ? 'https://…' : 'v123/folder/asset.mp4'}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <input
            value={mediaForm.label}
            onChange={(event) => setMediaForm((current) => ({ ...current, label: event.target.value }))}
            placeholder="Media label"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          />
          <select
            value={mediaForm.availabilityState}
            onChange={(event) => setMediaForm((current) => ({ ...current, availabilityState: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none"
          >
            <option value="processing">Processing</option>
            <option value="available">Available</option>
            <option value="restricted">Restricted</option>
          </select>
          <button disabled={busy || !mediaForm.lessonId} className="focus-ring mt-3 w-full rounded-xl bg-stone-950 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">
            Register media
          </button>
        </form>
      </div>

      <section className="mt-6 flex items-start gap-3 rounded-[24px] border border-blue-200 bg-blue-50 p-5 text-blue-900">
        <ShieldCheck size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs leading-6">
          Raw video binaries are not stored in MongoDB. The builder stores provider metadata only. Learner playback is resolved by the backend after entitlement checks, and stable storage references are not returned by learner curriculum APIs.
        </p>
      </section>
    </main>
  )
}
