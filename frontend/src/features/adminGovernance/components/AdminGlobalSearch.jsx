import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import {
  getAdminGovernanceErrorMessage,
  searchAdminGovernance,
} from '../services/adminGovernance.service'

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function governanceRouteHint(item) {
  const domainRoutes = {
    admin: '/admin/policy',
    catalog: '/admin/data-quality',
    recipe: '/admin/recipe-review',
    marketplace: '/admin/orders-disputes',
    finance: '/admin/finance-ops',
    trust_safety: '/admin/trust-safety',
    cms: '/admin/cms',
    host_review: '/admin/host-operations',
  }

  if (
    String(item?.routeHint || '').startsWith(
      '/admin/governance/',
    )
  ) {
    const subtitleParts =
      String(item?.subtitle || '')
        .split('·')
        .map((part) => part.trim())

    const domain =
      subtitleParts[
        subtitleParts.length - 1
      ]

    return (
      domainRoutes[domain] ||
      '/admin'
    )
  }

  return item?.routeHint || ''
}

export default function AdminGlobalSearch() {
  const location =
    useLocation()

  const requestRef =
    useRef(0)

  const [query, setQuery] =
    useState('')

  const [results, setResults] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  useEffect(
    () => {
      setQuery('')
      setResults([])
      setError('')
    },
    [location.pathname],
  )

  useEffect(
    () => {
      const normalized =
        query.trim()

      if (
        normalized.length <
        2
      ) {
        requestRef.current += 1

        setResults([])
        setLoading(false)
        setError('')

        return undefined
      }

      const requestId =
        requestRef.current + 1

      requestRef.current =
        requestId

      const timer =
        window.setTimeout(
          async () => {
            setLoading(true)
            setError('')

            try {
              const data =
                await searchAdminGovernance({
                  q: normalized,
                  limit: 24,
                })

              if (
                requestRef.current !==
                requestId
              ) {
                return
              }

              setResults(
                data?.results ||
                  [],
              )
            } catch (requestError) {
              if (
                requestRef.current !==
                  requestId
              ) {
                return
              }

              setResults([])

              setError(
                getAdminGovernanceErrorMessage(
                  requestError,
                  'Unable to search the admin workspace.',
                ),
              )
            } finally {
              if (
                requestRef.current ===
                requestId
              ) {
                setLoading(false)
              }
            }
          },
          250,
        )

      return () =>
        window.clearTimeout(
          timer,
        )
    },
    [query],
  )

  const open =
    query.trim().length >=
    2

  return (
    <div className="relative">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />

        <input
          type="search"
          value={query}
          onChange={(event) =>
            setQuery(
              event.target.value,
            )
          }
          placeholder="Search users, orgs, products, recipes, orders, cases…"
          aria-label="Global admin search"
          className="focus-ring w-full rounded-2xl border border-stone-200 bg-white py-2.5 pl-10 pr-10 text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setError('')
            }}
            className="focus-ring absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Clear admin search"
          >
            <X
              size={15}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[430px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
          {loading ? (
            <div className="px-3 py-5 text-center text-xs font-bold text-stone-400">
              Searching governed records…
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 px-3 py-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          ) : results.length ? (
            <div className="space-y-1">
              {results.map(
                (item) => {
                  const body = (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                            {titleize(
                              item.type,
                            )}
                          </span>

                          {item.status ? (
                            <span className="truncate text-[10px] font-bold text-emerald-700">
                              {titleize(
                                item.status,
                              )}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1.5 truncate text-sm font-black text-stone-900">
                          {item.title ||
                            item.id}
                        </p>

                        {item.subtitle ? (
                          <p className="mt-0.5 truncate text-xs text-stone-500">
                            {item.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )

                  const destination =
                    governanceRouteHint(
                      item,
                    )

                  if (destination) {
                    return (
                      <Link
                        key={`${item.type}:${item.id}`}
                        to={destination}
                        className="focus-ring flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-emerald-50"
                      >
                        {body}
                      </Link>
                    )
                  }

                  return (
                    <div
                      key={`${item.type}:${item.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3"
                    >
                      {body}
                    </div>
                  )
                },
              )}
            </div>
          ) : (
            <div className="px-3 py-5 text-center text-xs font-bold text-stone-400">
              No permitted records matched this search.
            </div>
          )}

          <p className="border-t border-stone-100 px-3 pb-1 pt-2 text-[10px] leading-4 text-stone-400">
            Results are filtered by backend-resolved M03 permissions. Search never grants mutation authority.
          </p>
        </div>
      ) : null}
    </div>
  )
}