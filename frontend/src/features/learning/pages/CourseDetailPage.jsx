import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  getCourseCurriculum,
  getLearningErrorMessage,
} from '../services/learning.service'

function durationLabel(seconds) {
  const value = Number(seconds || 0)

  if (!value) {
    return 'Self-paced'
  }

  const minutes = Math.max(1, Math.round(value / 60))
  return `${minutes} min`
}

export default function CourseDetailPage() {
  const {
    courseId,
  } = useParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await getCourseCurriculum(courseId)

        if (active) {
          setData(result)
        }
      } catch (requestError) {
        if (active) {
          setError(
            getLearningErrorMessage(
              requestError,
              'Unable to load this course curriculum.',
            ),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [courseId])

  if (loading) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] border border-stone-200 bg-white p-8 text-sm font-bold text-stone-500">
          Loading course curriculum…
        </div>
      </main>
    )
  }

  if (error || !data?.course) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-start gap-3">
            <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-bold">{error || 'Course not found.'}</p>
          </div>
        </div>
      </main>
    )
  }

  const {
    course,
    access,
    progress,
    modules,
  } = data

  return (
    <main className="page-shell py-8 sm:py-10">
      <Link
        to="/learn"
        className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-emerald-800"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Learn / Pro
      </Link>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-700 text-white">
                <BookOpen size={22} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  {course.accessType === 'pro' ? 'EPANTRY Pro' : 'Free learning'}
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                  {course.title}
                </h1>
              </div>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-stone-600">
              {course.summary || 'A structured EPANTRY learning course from a governed Creator profile.'}
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
                {modules.length} modules
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700">
                {progress.percentComplete}% complete
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800">
                Recipe facts stay outside the paywall
              </span>
            </div>
          </div>

          <aside className="border-t border-stone-200 bg-[#f7f5ef] p-6 lg:border-l lg:border-t-0">
            <div className="flex items-start gap-3">
              {access.allowed ? (
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <LockKeyhole size={20} className="mt-0.5 shrink-0 text-stone-500" aria-hidden="true" />
              )}
              <div>
                <h2 className="text-sm font-black text-stone-900">
                  {access.allowed ? 'Course access active' : 'Pro entitlement required'}
                </h2>
                <p className="mt-2 text-xs leading-5 text-stone-600">
                  {access.allowed
                    ? 'Your Customer identity can open the unlocked lessons below.'
                    : 'You can inspect the curriculum and preview lessons, but protected lessons remain locked until an active CourseEntitlement exists.'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between text-xs font-black text-stone-600">
                <span>Course progress</span>
                <span>{progress.percentComplete}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${Math.min(100, Math.max(0, progress.percentComplete || 0))}%` }}
                />
              </div>
            </div>

            <Link
              to="/account/learning"
              className="focus-ring mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-black text-stone-800 hover:border-emerald-300"
            >
              Open My Learning
            </Link>
          </aside>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        {modules.length ? modules.map((module, moduleIndex) => (
          <article
            key={module.id}
            className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  Module {moduleIndex + 1}
                </p>
                <h2 className="mt-1 text-xl font-black text-stone-950">
                  {module.title}
                </h2>
                {module.summary ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                    {module.summary}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {(module.lessons || []).map((lesson, lessonIndex) => {
                const completed = lesson.progress?.status === 'completed'
                const isLocked = lesson.locked === true

                const content = (
                  <div className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30">
                    <div className={[
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                      completed
                        ? 'bg-emerald-100 text-emerald-700'
                        : isLocked
                          ? 'bg-stone-100 text-stone-500'
                          : 'bg-blue-50 text-blue-700',
                    ].join(' ')}>
                      {completed ? (
                        <CheckCircle2 size={18} aria-hidden="true" />
                      ) : isLocked ? (
                        <LockKeyhole size={17} aria-hidden="true" />
                      ) : (
                        <PlayCircle size={18} aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-stone-900">
                          {moduleIndex + 1}.{lessonIndex + 1} {lesson.title}
                        </p>
                        {lesson.accessPolicy === 'preview' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800">
                            Preview
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-stone-500">
                        <span className="capitalize">{lesson.lessonType.replace(/_/g, ' ')}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={12} aria-hidden="true" />
                          {durationLabel(lesson.durationSeconds)}
                        </span>
                        {lesson.progress?.completionPercent > 0 ? (
                          <span>{lesson.progress.completionPercent}% lesson progress</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )

                return isLocked ? (
                  <div key={lesson.id} aria-disabled="true">
                    {content}
                  </div>
                ) : (
                  <Link
                    key={lesson.id}
                    to={`/learn/courses/${encodeURIComponent(course.id)}/lessons/${encodeURIComponent(lesson.id)}`}
                    className="focus-ring block"
                  >
                    {content}
                  </Link>
                )
              })}
            </div>
          </article>
        )) : (
          <div className="rounded-[26px] border border-dashed border-stone-300 bg-white p-8 text-center">
            <ShieldCheck size={30} className="mx-auto text-stone-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-black text-stone-700">
              This course has no published learning modules yet.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
