import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import CreatorProTransactionsPanel from '../../expansionExecution/components/CreatorProTransactionsPanel'

import {
  getCommunityErrorMessage,
  getLearningPro,
  listCreatorCourses,
  prepareCreatorCourse,
} from '../services/community.service'

export default function LearnProPage() {
  const {
    isAuthenticated,
    customerEnabled,
  } = useAuth()

  const [courses, setCourses] = useState([])
  const [learning, setLearning] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyCourseId, setBusyCourseId] = useState('')
  const [prepared, setPrepared] = useState({})

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const courseResult = await listCreatorCourses({
          page: 1,
          limit: 50,
        })

        if (!active) {
          return
        }

        setCourses(courseResult?.courses || [])

        if (isAuthenticated && customerEnabled) {
          const proResult = await getLearningPro()

          if (active) {
            setLearning(proResult)
          }
        } else {
          setLearning(null)
        }
      } catch (requestError) {
        if (active) {
          setError(
            getCommunityErrorMessage(
              requestError,
              'Unable to load Learn / EPANTRY Pro.',
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
  }, [isAuthenticated, customerEnabled])

  const entitledCourseIds = useMemo(
    () =>
      new Set(
        (learning?.entitlements || [])
          .map((item) => item.course?.id)
          .filter(Boolean),
      ),
    [learning],
  )

  async function prepare(courseItem) {
    if (!isAuthenticated || !customerEnabled) {
      return
    }

    const courseId = courseItem.course.id

    setBusyCourseId(courseId)
    setError('')

    try {
      const result = await prepareCreatorCourse({
        courseId,
        targetServings: 2,
      })

      setPrepared((current) => ({
        ...current,
        [courseId]: result,
      }))
    } catch (requestError) {
      setError(
        getCommunityErrorMessage(
          requestError,
          'Unable to prepare this class.',
        ),
      )
    } finally {
      setBusyCourseId('')
    }
  }

  return (
    <main className="page-shell py-8 sm:py-10">
      <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-700 text-white">
                <BookOpen size={22} aria-hidden="true" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  P31
                </p>
                <h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                  Learn / EPANTRY Pro
                </h1>
              </div>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-stone-600">
              Structured Creator courses now include real modules, lessons, learner progress, captions/transcript assets, bookmarks and notes. Prepare-for-Class still reuses the governed Recipe, Pantry and M10 Outcome Plan engines instead of inventing separate food truth.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
                Course progress
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800">
                Captions + transcripts
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700">
                M22 governed live sessions remain separate
              </span>
            </div>
          </div>

          <aside className="border-t border-stone-200 bg-[#f7f5ef] p-6 lg:border-l lg:border-t-0">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-black text-stone-900">
                  Pro is entitlement, not role
                </h2>
                <p className="mt-2 text-xs leading-5 text-stone-600">
                  CourseEntitlement controls protected Pro lessons. Customer / Host / Super Admin remain the only top-level access model.
                </p>
              </div>
            </div>

            {isAuthenticated && customerEnabled ? (
              <>
                <div className="mt-5 rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                    Active course entitlements
                  </p>
                  <p className="mt-2 text-2xl font-black text-stone-950">
                    {learning?.entitlements?.length || 0}
                  </p>
                </div>

                <Link
                  to="/account/learning"
                  className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-xs font-black text-white"
                >
                  <GraduationCap size={15} aria-hidden="true" />
                  My Learning
                </Link>
              </>
            ) : (
              <Link
                to="/login?returnTo=%2Flearn"
                className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-sm font-black text-white"
              >
                Sign in to start learning
              </Link>
            )}
          </aside>
        </div>
      </section>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-72 place-items-center">
          <LoaderCircle className="animate-spin text-emerald-700" aria-label="Loading courses" />
        </div>
      ) : courses.length ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {courses.map((item) => {
            const course = item.course
            const isFree = course.accessType === 'free'
            const entitled = isFree || entitledCourseIds.has(course.id)
            const preparedResult = prepared[course.id]
            const outcomePlanId =
              preparedResult?.preparation?.outcomePlan?.plan?.id || null

            const detailPath = `/learn/courses/${encodeURIComponent(course.id)}`
            const detailTarget =
              isAuthenticated && customerEnabled
                ? detailPath
                : `/login?returnTo=${encodeURIComponent(detailPath)}`

            return (
              <article
                key={course.id}
                className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm"
              >
                <div className="aspect-[16/8] bg-stone-100">
                  {item.recipe?.heroImageUrl ? (
                    <img
                      src={item.recipe.heroImageUrl}
                      alt={item.recipe.name || course.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-stone-300">
                      <BookOpen size={38} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                        {course.category || 'Cookery learning'}
                      </p>
                      <h2 className="mt-1 text-xl font-black text-stone-950">
                        {course.title}
                      </h2>
                    </div>

                    <span className={[
                      'shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase',
                      isFree
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-950 text-white',
                    ].join(' ')}>
                      {isFree ? 'Free' : 'Pro'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {course.summary || 'Structured learning from a verified EPANTRY Creator.'}
                  </p>

                  {item.creator?.id ? (
                    <Link
                      to={`/creators/${encodeURIComponent(item.creator.id)}`}
                      className="focus-ring mt-4 inline-flex items-center gap-2 text-xs font-black text-stone-600 hover:text-emerald-800"
                    >
                      <ChefHat size={14} aria-hidden="true" />
                      {item.creator.displayName}
                      {item.creator.verificationStatus === 'verified' ? ' · Verified' : ''}
                    </Link>
                  ) : null}

                  <Link
                    to={detailTarget}
                    className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-black text-white"
                  >
                    Open course curriculum
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>

                  {isAuthenticated && customerEnabled ? (
                    <div className="mt-3">
                      {preparedResult ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                            <div>
                              <p className="text-xs font-black text-emerald-900">Class preparation ready</p>
                              <p className="mt-1 text-[11px] leading-5 text-emerald-800">
                                M10 calculated genuine shortages. No automatic purchase was made.
                              </p>
                              {outcomePlanId ? (
                                <Link
                                  to={`/outcome-plans/${encodeURIComponent(outcomePlanId)}`}
                                  className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                                >
                                  <PackageCheck size={14} aria-hidden="true" />
                                  Open preparation basket
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : entitled ? (
                        <button
                          type="button"
                          disabled={busyCourseId === course.id}
                          onClick={() => prepare(item)}
                          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800 disabled:opacity-50"
                        >
                          {busyCourseId === course.id ? (
                            <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles size={15} aria-hidden="true" />
                          )}
                          Prepare for class · 2 servings
                        </button>
                      ) : (
                        <div className="flex items-start gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-stone-600">
                          <LockKeyhole size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-[11px] leading-5">
                            Pro entitlement is required for protected lessons. Preview lessons remain visible in the curriculum.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[28px] border border-dashed border-stone-300 bg-white p-10 text-center">
          <BookOpen size={34} className="mx-auto text-stone-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-black text-stone-700">
            No Learn / Pro courses are listed yet.
          </p>
        </div>
      )}

      {isAuthenticated && customerEnabled ? (
        <CreatorProTransactionsPanel />
      ) : null}
    </main>
  )
}
