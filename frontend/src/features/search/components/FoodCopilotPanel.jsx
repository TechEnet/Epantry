import {
  useMemo,
  useState,
} from 'react'

import {
  Bot,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getCopilotErrorMessage,
  sendCopilotMessage,
} from '../services/copilot.service'

const STARTER_MESSAGES =
  Object.freeze([
    '20 min me paneer dinner suggest karo',
    'Use what I already have',
    'Is search ko quicker karo',
    'Why did you choose this?',
  ])

function SourceCard({
  item,
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
            {item.type}
          </p>

          <p className="mt-1 truncate text-sm font-black text-stone-950">
            {item.title}
          </p>

          {item.subtitle && (
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {item.subtitle}
            </p>
          )}
        </div>

        {item.path && (
          <Link
            to={item.path}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50"
            aria-label={`Open ${item.title}`}
          >
            <ExternalLink
              size={14}
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    </div>
  )
}

export default function FoodCopilotPanel({
  open,
  onClose,
  searchSession,
  onSearchSessionChange,
}) {
  const [
    messages,
    setMessages,
  ] =
    useState([])

  const [
    input,
    setInput,
  ] =
    useState('')

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState('')

  const history =
    useMemo(
      () =>
        messages
          .filter(
            (
              item,
            ) =>
              item.role ===
                'user' ||
              item.role ===
                'assistant',
          )
          .map(
            (
              item,
            ) => ({
              role:
                item.role,

              content:
                item.content,
            }),
          ),
      [
        messages,
      ],
    )

  async function submitMessage(
    value,
  ) {
    const normalized =
      String(
        value ||
          '',
      ).trim()

    if (
      !normalized ||
      loading
    ) {
      return
    }

    const nextUser = {
      id:
        `user-${Date.now()}`,

      role:
        'user',

      content:
        normalized,
    }

    setMessages(
      (
        current,
      ) => [
        ...current,
        nextUser,
      ],
    )

    setInput('')
    setLoading(true)
    setError('')

    try {
      const result =
        await sendCopilotMessage({
          message:
            normalized,

          history,

          searchSession,
        })

      if (
        result?.searchSession &&
        typeof onSearchSessionChange ===
          'function'
      ) {
        onSearchSessionChange(
          result.searchSession,
        )
      }

      setMessages(
        (
          current,
        ) => [
          ...current,
          {
            id:
              `assistant-${Date.now()}`,

            role:
              'assistant',

            content:
              result?.assistantMessage ||
              'I could not produce a verified answer.',

            mode:
              result?.mode ||
              'fallback',

            modelId:
              result?.modelId ||
              null,

            toolsUsed:
              result?.toolsUsed ||
              [],

            sourceCards:
              result?.sourceCards ||
              [],
          },
        ],
      )
    } catch (
      requestError
    ) {
      setError(
        getCopilotErrorMessage(
          requestError,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  if (
    !open
  ) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-stone-950/40 backdrop-blur-sm">
      <button
        type="button"
        className="min-w-0 flex-1"
        onClick={onClose}
        aria-label="Close Food Copilot"
      />

      <aside className="flex h-full w-full max-w-[520px] flex-col border-l border-stone-200 bg-[#f7f5ef] shadow-2xl">
        <header className="border-b border-stone-200 bg-stone-950 p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Bot
                  size={18}
                  aria-hidden="true"
                />

                <p className="text-xs font-black uppercase tracking-[0.14em]">
                  M12 · Food Copilot
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-tight">
                AI over deterministic tools
              </h2>

              <p className="mt-2 text-xs leading-5 text-stone-400">
                Copilot can search, refine, inspect Recipes, scale servings and use Customer Pantry tools. It cannot invent price, stock, safety, payment or authorization truth.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-900"
              aria-label="Close Food Copilot"
            >
              <X
                size={18}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {messages.length ===
          0 ? (
            <div className="rounded-[24px] border border-stone-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Sparkles
                  size={20}
                  className="mt-0.5 text-emerald-700"
                  aria-hidden="true"
                />

                <div>
                  <h3 className="font-black text-stone-950">
                    Start with a food decision
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    The assistant will call only EPANTRY allowlisted tools. If OpenRouter fails, deterministic Search remains available.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {STARTER_MESSAGES.map(
                  (
                    starter,
                  ) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() =>
                        submitMessage(
                          starter,
                        )
                      }
                      className="w-full rounded-xl bg-stone-50 px-4 py-3 text-left text-sm font-bold text-stone-700 transition hover:bg-stone-100"
                    >
                      {starter}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(
                (
                  item,
                ) => (
                  <div
                    key={item.id}
                    className={[
                      'rounded-[22px] p-4',

                      item.role ===
                      'user'
                        ? 'ml-8 bg-stone-950 text-white'
                        : 'mr-4 border border-stone-200 bg-white text-stone-900',
                    ].join(' ')}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {item.content}
                    </p>

                    {item.role ===
                      'assistant' && (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',

                              item.mode ===
                              'fallback'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800',
                            ].join(' ')}
                          >
                            {item.mode ===
                            'fallback'
                              ? 'Deterministic fallback'
                              : 'OpenRouter + tools'}
                          </span>

                          {(item.toolsUsed || []).map(
                            (
                              tool,
                            ) => (
                              <span
                                key={tool}
                                className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black text-stone-600"
                              >
                                {tool}
                              </span>
                            ),
                          )}
                        </div>

                        {(item.sourceCards || []).length >
                          0 && (
                          <div className="mt-4 grid gap-2">
                            {item.sourceCards.map(
                              (
                                source,
                              ) => (
                                <SourceCard
                                  key={`${source.type}:${source.id}`}
                                  item={source}
                                />
                              ),
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-sm font-bold text-stone-600">
              <RefreshCw
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />

              Checking EPANTRY tools…
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              <TriangleAlert
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              {error}
            </div>
          )}
        </div>

        <footer className="border-t border-stone-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-stone-500">
            <ShieldCheck
              size={14}
              className="text-emerald-700"
              aria-hidden="true"
            />

            AI wording is non-authoritative; cards come from deterministic EPANTRY tools.
          </div>

          <form
            onSubmit={(
              event,
            ) => {
              event.preventDefault()
              submitMessage(input)
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(
                event,
              ) =>
                setInput(
                  event.target.value,
                )
              }
              maxLength={1500}
              placeholder="Ask Food Copilot…"
              className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-bold outline-none"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !input.trim()
              }
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send Copilot message"
            >
              <Send
                size={17}
                aria-hidden="true"
              />
            </button>
          </form>
        </footer>
      </aside>
    </div>
  )
}