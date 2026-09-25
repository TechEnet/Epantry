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
          setError(
            getLearningErrorMessage(
              requestError,
              'Unable to load My Learning.',
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

  return (
    <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7">
      <header className="rounded-[24px] bg-stone-950 p-4 text-white shadow-sm sm:rounded-[28px] sm:p-8">
        <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
              Customer Learning Workspace
            </p>
            <h1 className="mt-2 text-[24px] font-black tracking-tight sm:mt-3 sm:text-4xl">
              My Learning
            </h1>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-[1.45] text-stone-400 sm:mt-3 sm:text-sm sm:leading-6">
              <span className="sm:hidden">Continue your EPANTRY courses, track progress and pick up exactly where you left off.</span>
              <span className="hidden sm:inline">Continue entitled or free EPANTRY courses, review progress, and return to the exact course curriculum without creating a separate learner role.</span>
            </p>
          </div>

          <Link
            to="/learn"
            className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-black text-stone-950 sm:h-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs"
          >
            <BookOpen size={16} aria-hidden="true" />
            Browse courses
          </Link>
        </div>
      </header>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-emerald-700" aria-label="Loading My Learning" />
        </div>
      ) : (
        <>
          <section className="mt-4 sm:mt-6">
            <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-50 p-2.5 shadow-sm sm:hidden">
              {[
                {
                  label: 'Active courses',
                  value: data?.summary?.activeCourses || 0,
                  icon: GraduationCap,
                  tone: 'border-emerald-200 bg-white/80 text-emerald-700',
                },
                {
                  label: 'In progress',
                  value: data?.summary?.inProgress || 0,
                  icon: Clock3,
                  tone: 'border-sky-200 bg-white/80 text-sky-700',
                },
                {
                  label: 'Completed',
                  value: data?.summary?.completed || 0,
                  icon: CheckCircle2,
                  tone: 'border-violet-200 bg-white/80 text-violet-700',
                },
              ].map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className={`min-w-0 rounded-[16px] border px-2.5 py-2.5 shadow-sm ${item.tone}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <Icon size={14} className="shrink-0" aria-hidden="true" />
                      <p className="text-[20px] font-black leading-none text-stone-950">{item.value}</p>
                    </div>
                    <p className="mt-2 truncate text-[9px] font-black text-stone-600">{item.label}</p>
                  </div>
                )
              })}
            </div>

            <div className="hidden gap-4 sm:grid sm:grid-cols-3">
              {[
                {
                  label: 'Active courses',
                  value: data?.summary?.activeCourses || 0,
                  icon: GraduationCap,
                },
                {
                  label: 'In progress',
                  value: data?.summary?.inProgress || 0,
                  icon: Clock3,
                },
                {
                  label: 'Completed',
                  value: data?.summary?.completed || 0,
                  icon: CheckCircle2,
                },
              ].map((item) => {
                const Icon = item.icon

                return (
                  <div key={item.label} className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm">
                    <Icon size={18} className="text-emerald-700" aria-hidden="true" />
                    <p className="mt-4 text-3xl font-black text-stone-950">{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-stone-500">{item.label}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
            {(data?.courses || []).length ? (
              data.courses.map((item) => (
                <article
                  key={item.course.id}
                  className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6"
                >
                  <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800">
                          {item.course.accessType === 'pro' ? 'Pro' : 'Free'}
                        </span>
                        {item.accessAllowed ? null : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                            <LockKeyhole size={11} aria-hidden="true" />
                            Access inactive
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2 text-[17px] font-black text-stone-950 sm:mt-3 sm:text-xl">
                        {item.course.title}
                      </h2>

                      <p className="mt-1.5 max-w-2xl text-[11px] leading-[1.45] text-stone-500 sm:mt-2 sm:text-sm sm:leading-6">
                        {item.course.summary || 'EPANTRY learning course'}
                      </p>

                      {item.creator?.displayName ? (
                        <p className="mt-1.5 text-[10px] font-bold text-stone-400 sm:mt-2 sm:text-xs">
                          By {item.creator.displayName}
                          {item.creator.verificationStatus === 'verified' ? ' · Verified' : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="w-full max-w-sm shrink-0">
                      <div className="flex items-center justify-between text-xs font-black text-stone-600">
                        <span>Progress</span>
                        <span>{item.progress.percentComplete}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100 sm:mt-2 sm:h-2">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${Math.min(100, Math.max(0, item.progress.percentComplete || 0))}%` }}
                        />
                      </div>

                      <Link
                        to={`/learn/courses/${encodeURIComponent(item.course.id)}`}
                        className="focus-ring mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-stone-950 px-3 text-[10px] font-black text-white sm:mt-4 sm:h-auto sm:gap-2 sm:px-4 sm:py-3 sm:text-xs"
                      >
                        {item.progress.percentComplete > 0 ? 'Continue course' : 'Open course'}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-stone-300 bg-white p-6 text-center sm:rounded-[24px] sm:p-10">
                <GraduationCap size={34} className="mx-auto text-stone-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-stone-700">No learning activity yet.</p>
                <Link
                  to="/learn"
                  className="focus-ring mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                >
                  Browse Learn / Pro
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
