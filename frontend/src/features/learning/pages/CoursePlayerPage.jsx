import {
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  CircleAlert,
  FileText,
  Gauge,
  LoaderCircle,
  NotebookPen,
  Save,
  Trash2,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  createCourseLessonBookmark,
  deleteCourseLessonBookmark,
  deleteCourseLessonNote,
  getCourseLesson,
  getLearningErrorMessage,
  resolveCourseMedia,
  saveCourseLessonNote,
  updateCourseLessonProgress,
} from '../services/learning.service'

function secondsLabel(value) {
  const seconds = Math.max(0, Math.floor(Number(value || 0)))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export default function CoursePlayerPage() {
  const {
    courseId,
    lessonId,
  } = useParams()

  const videoRef = useRef(null)

  const [data, setData] = useState(null)
  const [deliveries, setDeliveries] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [position, setPosition] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [noteText, setNoteText] = useState('')
  const [bookmarkLabel, setBookmarkLabel] = useState('')

  async function loadLesson() {
    setLoading(true)
    setError('')

    try {
      const result = await getCourseLesson({
        courseId,
        lessonId,
      })

      setData(result)
      setPosition(result?.progress?.playbackPositionSeconds || 0)
      setSpeed(result?.progress?.playbackSpeed || 1)

      const availableMedia = result?.media || []
      const resolvedEntries = await Promise.all(
        availableMedia.map(async (media) => {
          try {
            const delivery = await resolveCourseMedia({
              courseId,
              lessonId,
              mediaId: media.id,
            })

            return [media.id, delivery]
          } catch {
            return [media.id, null]
          }
        }),
      )

      setDeliveries(Object.fromEntries(resolvedEntries))
    } catch (requestError) {
      setError(
        getLearningErrorMessage(
          requestError,
          'Unable to open this course lesson.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLesson()
  }, [courseId, lessonId])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }, [speed])

  const primaryMedia = useMemo(
    () =>
      (data?.media || []).find(
        (item) =>
          ['video', 'live_recording'].includes(item.mediaType) &&
          deliveries[item.id]?.delivery?.url,
      ) || null,
    [data, deliveries],
  )

  const captions = useMemo(
    () =>
      (data?.media || []).filter(
        (item) =>
          item.mediaType === 'caption' &&
          deliveries[item.id]?.delivery?.url,
      ),
    [data, deliveries],
  )

  const transcripts = useMemo(
    () =>
      (data?.media || []).filter(
        (item) =>
          item.mediaType === 'transcript' &&
          deliveries[item.id]?.delivery?.url,
      ),
    [data, deliveries],
  )

  async function saveProgress({
    completed = false,
  } = {}) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await updateCourseLessonProgress({
        courseId,
        lessonId,
        input: {
          status: completed ? 'completed' : 'in_progress',
          completionPercent: completed
            ? 100
            : Math.max(
                data?.progress?.completionPercent || 0,
                primaryMedia?.durationSeconds
                  ? Math.min(
                      99,
                      Math.round((position / primaryMedia.durationSeconds) * 100),
                    )
                  : 1,
              ),
          playbackPositionSeconds: Math.max(0, Math.floor(position)),
          playbackSpeed: speed,
        },
      })

      setData((current) => ({
        ...current,
        progress: result.lessonProgress,
      }))

      setNotice(
        completed
          ? 'Lesson marked complete.'
          : 'Lesson progress saved.',
      )
    } catch (requestError) {
      setError(
        getLearningErrorMessage(
          requestError,
          'Unable to save lesson progress.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  async function addBookmark() {
    setBusy(true)
    setError('')

    try {
      const result = await createCourseLessonBookmark({
        courseId,
        lessonId,
        input: {
          positionSeconds: Math.max(0, Math.floor(position)),
          label: bookmarkLabel.trim(),
        },
      })

      setData((current) => ({
        ...current,
        bookmarks: [
          ...(current?.bookmarks || []).filter(
            (item) => item.id !== result.bookmark.id,
          ),
          result.bookmark,
        ].sort((a, b) => a.positionSeconds - b.positionSeconds),
      }))

      setBookmarkLabel('')
      setNotice('Bookmark saved.')
    } catch (requestError) {
      setError(getLearningErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function removeBookmark(bookmarkId) {
    setBusy(true)

    try {
      await deleteCourseLessonBookmark({
        courseId,
        lessonId,
        bookmarkId,
      })

      setData((current) => ({
        ...current,
        bookmarks: (current?.bookmarks || []).filter(
          (item) => item.id !== bookmarkId,
        ),
      }))
    } catch (requestError) {
      setError(getLearningErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function addNote() {
    if (!noteText.trim()) {
      return
    }

    setBusy(true)
    setError('')

    try {
      const result = await saveCourseLessonNote({
        courseId,
        lessonId,
        input: {
          noteText: noteText.trim(),
          positionSeconds: Math.max(0, Math.floor(position)),
        },
      })

      setData((current) => ({
        ...current,
        notes: [result.note, ...(current?.notes || [])],
      }))

      setNoteText('')
      setNotice('Note saved.')
    } catch (requestError) {
      setError(getLearningErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function removeNote(noteId) {
    setBusy(true)

    try {
      await deleteCourseLessonNote({
        courseId,
        lessonId,
        noteId,
      })

      setData((current) => ({
        ...current,
        notes: (current?.notes || []).filter(
          (item) => item.id !== noteId,
        ),
      }))
    } catch (requestError) {
      setError(getLearningErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell grid min-h-[60vh] place-items-center py-10">
        <LoaderCircle className="animate-spin text-emerald-700" aria-label="Loading lesson" />
      </main>
    )
  }

  if (error && !data?.lesson) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-start gap-3">
            <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        </div>
      </main>
    )
  }

  const lesson = data?.lesson

  return (
    <main className="page-shell py-8 sm:py-10">
      <Link
        to={`/learn/courses/${encodeURIComponent(courseId)}`}
        className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-emerald-800"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to course
      </Link>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-5">
          <article className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
            <div className="p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                <span>{String(lesson.lessonType || '').replace(/_/g, ' ')}</span>
                {lesson.accessPolicy === 'preview' ? <span>· Preview</span> : null}
              </div>
              <h1 className="mt-2 text-2xl font-black text-stone-950 sm:text-3xl">
                {lesson.title}
              </h1>
              {lesson.summary ? (
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {lesson.summary}
                </p>
              ) : null}
            </div>

            {primaryMedia ? (
              <div className="bg-black">
                <video
                  ref={videoRef}
                  src={deliveries[primaryMedia.id]?.delivery?.url}
                  controls
                  className="aspect-video w-full bg-black"
                  onLoadedMetadata={(event) => {
                    if (position > 0 && event.currentTarget.duration > position) {
                      event.currentTarget.currentTime = position
                    }
                    event.currentTarget.playbackRate = speed
                  }}
                  onTimeUpdate={(event) => {
                    setPosition(event.currentTarget.currentTime || 0)
                  }}
                >
                  {captions.map((caption) => (
                    <track
                      key={caption.id}
                      src={deliveries[caption.id]?.delivery?.url}
                      kind="captions"
                      srcLang={caption.language || 'en'}
                      label={caption.label || caption.language || 'Captions'}
                      default={caption.isDefault === true}
                    />
                  ))}
                </video>
              </div>
            ) : lesson.lessonType === 'text' ? (
              <div className="border-t border-stone-200 p-6 sm:p-7">
                <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                  {lesson.bodyText}
                </div>
              </div>
            ) : lesson.lessonType === 'recipe' ? (
              <div className="border-t border-stone-200 p-6 sm:p-7">
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  This lesson references governed Recipe Version <strong>{lesson.linkedRecipeVersionId}</strong>. Recipe quantities, nutrition and allergen truth remain owned by the Recipe/Food Intelligence domains.
                </div>
              </div>
            ) : (
              <div className="border-t border-stone-200 p-6 sm:p-7 text-sm font-semibold text-stone-500">
                No authorized playable media is currently available for this lesson.
              </div>
            )}
          </article>

          <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-stone-900">Learning progress</p>
                <p className="mt-1 text-xs text-stone-500">
                  Position {secondsLabel(position)} · {data?.progress?.completionPercent || 0}% saved
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-600">
                  <Gauge size={14} aria-hidden="true" />
                  <select
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                    className="bg-transparent outline-none"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
                      <option key={value} value={value}>{value}x</option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveProgress()}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                >
                  <Save size={14} aria-hidden="true" />
                  Save progress
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveProgress({ completed: true })}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Mark complete
                </button>
              </div>
            </div>
          </section>

          {transcripts.length ? (
            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-emerald-700" aria-hidden="true" />
                <h2 className="text-sm font-black text-stone-900">Transcript assets</h2>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {transcripts.map((item) => (
                  <a
                    key={item.id}
                    href={deliveries[item.id]?.delivery?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 hover:border-emerald-300"
                  >
                    {item.label || item.language || 'Open transcript'}
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <aside className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
              {notice}
            </div>
          ) : null}

          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BookmarkPlus size={17} className="text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-black text-stone-900">Bookmarks</h2>
            </div>

            <input
              value={bookmarkLabel}
              onChange={(event) => setBookmarkLabel(event.target.value)}
              placeholder="Optional bookmark label"
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-400"
            />

            <button
              type="button"
              disabled={busy}
              onClick={addBookmark}
              className="focus-ring mt-2 w-full rounded-xl bg-stone-950 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              Bookmark {secondsLabel(position)}
            </button>

            <div className="mt-4 space-y-2">
              {(data?.bookmarks || []).map((bookmark) => (
                <div key={bookmark.id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
                  <div>
                    <p className="text-xs font-black text-stone-800">{secondsLabel(bookmark.positionSeconds)}</p>
                    <p className="mt-0.5 text-[11px] text-stone-500">{bookmark.label || 'Saved point'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBookmark(bookmark.id)}
                    className="focus-ring rounded-lg p-2 text-stone-400 hover:bg-white hover:text-red-600"
                    aria-label="Delete bookmark"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <NotebookPen size={17} className="text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-black text-stone-900">Lesson notes</h2>
            </div>

            <textarea
              rows={4}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Write a private learning note…"
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold leading-5 outline-none focus:border-emerald-400"
            />

            <button
              type="button"
              disabled={busy || !noteText.trim()}
              onClick={addNote}
              className="focus-ring mt-2 w-full rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              Save note at {secondsLabel(position)}
            </button>

            <div className="mt-4 space-y-2">
              {(data?.notes || []).map((note) => (
                <div key={note.id} className="rounded-xl bg-stone-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-xs leading-5 text-stone-700">{note.noteText}</p>
                      {note.positionSeconds !== null ? (
                        <p className="mt-2 text-[10px] font-black text-stone-400">
                          At {secondsLabel(note.positionSeconds)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNote(note.id)}
                      className="focus-ring shrink-0 rounded-lg p-2 text-stone-400 hover:bg-white hover:text-red-600"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
