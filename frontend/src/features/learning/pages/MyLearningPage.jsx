import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  getLearningErrorMessage,
  getMyLearning,
} from '../services/learning.service'

export default function MyLearningPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await getMyLearning()

        if (active) {
          setData(result)
        }
      } catch (requestError) {
        if (active) {
          setData(null)
          setError(
            getLearningErrorMessage(
              requestError,
              'Unable to load your learning courses right now.',
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
  }, [])

  const courses = Array.isArray(data?.courses) ? data.courses : []

  const overview = [
    {
      label: 'Available courses',
      value: data?.summary?.activeCourses ?? 0,
      icon: GraduationCap,
    },
    {
      label: 'In progress',
      value: data?.summary?.inProgress ?? 0,
      icon: Clock3,
    },
    {
      label: 'Completed',
      value: data?.summary?.completed ?? 0,
      icon: CheckCircle2,
    },
  ]

  return (
    <main className="min-h-[55vh] w-full min-w-0 bg-[#F7F6F2] px-4 pb-8 pt-5 text-[#202421] sm:px-6 sm:pb-10 sm:pt-7 lg:px-8 lg:pb-12">
      <header className="grid gap-5 border-b border-[#D4D9CF] pb-6 sm:gap-6 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3 sm:mb-4">
            <span className="h-[3px] w-9 shrink-0 rounded-full bg-[#C86C42]" aria-hidden="true" />
            <span className="text-[13px] font-semibold tracking-[0.02em] text-[#8C4A30]">
              Your learning space
            </span>
          </div>
          <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.035em] text-[#173F35] sm:text-[38px] lg:text-[44px]">
            My Learning
          </h1>
          <p className="mt-3 max-w-[640px] text-[15px] leading-[1.6] text-[#4C5750] sm:text-[16px]">
            Your courses, your progress, all in one place. Find a course and continue learning at your own pace.
          </p>
        </div>

        <Link
          to="/learn"
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#245A49] sm:w-fit"
        >
          <BookOpen size={18} aria-hidden="true" />
          Browse courses
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </header>

      {loading ? (
        <section
          className="flex min-h-48 items-center justify-center gap-3 py-12 text-[15px] font-medium text-[#436052]"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle size={21} className="animate-spin" aria-hidden="true" />
          Loading your courses…
        </section>
      ) : error ? (
        <section
          className="mt-6 border-l-4 border-red-600 bg-[#FFF0EB] px-5 py-5 sm:mt-8 sm:px-6"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <CircleAlert size={21} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold text-red-900">We couldn't load your courses</h2>
              <p className="mt-1 text-[14px] leading-6 text-red-800">{error}</p>
              <p className="mt-1 text-[14px] leading-6 text-red-800">Please try refreshing the page.</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section
            className="mt-5 overflow-hidden rounded-[18px] bg-[#E2E7D9] sm:mt-7"
            aria-label="Learning overview"
          >
            <div className="grid grid-cols-3 px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
              {overview.map((item, index) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className={`min-w-0 px-2.5 sm:px-5 lg:px-7 ${index > 0 ? 'border-l border-[#BEC8B9]' : ''}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[#38634F]">
                      <Icon size={19} className="shrink-0" aria-hidden="true" />
                      <span className="text-[28px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[#173F35] sm:text-[36px]">
                        {item.value}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-[1.35] text-[#344C40] sm:mt-3 sm:text-[15px]">
                      {item.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="mt-7 sm:mt-10" aria-labelledby="my-courses-heading">
            <div className="mb-5 flex flex-col justify-between gap-2 border-b border-[#D4D9CF] pb-4 sm:mb-6 sm:flex-row sm:items-end sm:gap-6">
              <div>
                <h2
                  id="my-courses-heading"
                  className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-[#173F35] sm:text-[27px]"
                >
                  Your courses
                </h2>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-[#536057] sm:text-[15px]">
                  {courses.length
                    ? 'Pick up where you left off or explore your course details.'
                    : 'Courses you start or gain access to will appear here.'}
                </p>
              </div>
              {courses.length ? (
                <span className="self-start text-[14px] font-medium text-[#7A594A] sm:self-auto">
                  {courses.length} {courses.length === 1 ? 'course' : 'courses'}
                </span>
              ) : null}
            </div>

            {courses.length ? (
              <div className="divide-y divide-[#D4D9CF] border-b border-[#D4D9CF]">
                {courses.map((item) => {
                  const percent = Math.min(
                    100,
                    Math.max(0, Number(item.progress?.percentComplete) || 0),
                  )
                  const courseId = item.course?.id

                  return (
                    <article
                      key={courseId}
                      className="grid min-w-0 gap-5 py-6 sm:gap-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,290px)] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2.5">
                          <span className="inline-flex items-center rounded-full bg-[#F4E0D5] px-3 py-1 text-[13px] font-semibold text-[#88472A]">
                            {item.course?.accessType === 'pro' ? 'Pro course' : 'Free course'}
                          </span>
                          {item.accessAllowed ? null : (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#76513C]">
                              <LockKeyhole size={14} aria-hidden="true" />
                              Access inactive
                            </span>
                          )}
                        </div>

                        <h3 className="text-[20px] font-semibold leading-[1.3] tracking-[-0.015em] text-[#202421] sm:text-[23px]">
                          {item.course?.title}
                        </h3>
                        <p className="mt-2 max-w-[680px] text-[14px] leading-[1.6] text-[#536057] sm:text-[15px]">
                          {item.course?.summary || 'Explore the lessons in this EPANTRY course.'}
                        </p>
                        {item.creator?.displayName ? (
                          <p className="mt-2 text-[14px] font-medium leading-5 text-[#38634F]">
                            By {item.creator.displayName}
                            {item.creator.verificationStatus === 'verified' ? ' · Verified creator' : ''}
                          </p>
                        ) : null}
                      </div>

                      <div className="min-w-0 border-l-[3px] border-[#C86C42] pl-4 sm:pl-5 lg:pl-6">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-[14px] font-medium text-[#4C5750]">Course progress</span>
                          <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[#173F35]">
                            {percent}%
                          </span>
                        </div>
                        <div
                          className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#D9DED4]"
                          role="progressbar"
                          aria-label={`${item.course?.title || 'Course'} progress`}
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-[#1F7759]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <Link
                          to={`/learn/courses/${encodeURIComponent(courseId)}`}
                          className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#173F35] px-4 py-2.5 text-[14px] font-semibold text-[#173F35] transition-colors hover:bg-[#E2E7D9] sm:w-auto"
                        >
                          {item.accessAllowed
                            ? (percent > 0 ? 'Continue course' : 'Open course')
                            : 'View course'}
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="grid overflow-hidden rounded-[18px] bg-[#E8EBE2] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="px-5 py-7 sm:px-8 sm:py-9">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#F5D9CB] text-[#A35434]">
                    <GraduationCap size={22} aria-hidden="true" />
                  </div>
                  <h3 className="max-w-xl text-[21px] font-semibold leading-[1.3] tracking-[-0.02em] text-[#173F35] sm:text-[25px]">
                    Your learning journey starts here.
                  </h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-[1.6] text-[#48554C]">
                    You don't have any courses in your learning list yet. Explore available courses and start building your skills.
                  </p>
                  <Link
                    to="/learn"
                    className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#173F35] underline decoration-[#C86C42] decoration-2 underline-offset-4 hover:text-[#C86C42]"
                  >
                    Explore courses
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
                <div className="hidden h-full w-4 bg-[#C86C42] sm:block" aria-hidden="true" />
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
