'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LinkExternalIcon, CalendarIcon, ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react'
import { hasSeriesDetails, renderSeriesDetailsHtml } from '@/lib/series-details-html'
import type { PublicSeriesResponse } from '@/lib/api/types'

const DEFAULT_BANNER_SRC = '/series-banner-default.svg'

function formatSessionDateTime(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const date = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return { date, time: `${startTime} – ${endTime}` }
}

/** A session has already ended when its `endsAt` is in the past (FR-013). */
function hasEnded(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now()
}

interface Props {
  series: PublicSeriesResponse
}

/**
 * Anonymous, read-only landing page for a public series. Deliberately styled
 * distinct from the authenticated admin UI (FR-011) -- banner hero, card-based
 * session list with expandable descriptions, no app header/chrome. Renders
 * entirely from the `PublicSeriesResponse` payload; performs no mutations
 * (FR-012).
 */
export function PublicSeriesLanding({ series }: Props) {
  const sortedSessions = [...series.sessions].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--bgColor-accent-emphasis,#0969da)]/5 to-transparent">
      {/* Banner: falls back to a bundled stock image today; `series.imageUrl` is
          already threaded through end-to-end so a future owner-facing image
          picker only needs to set that field -- no other changes required here. */}
      <div className="relative h-40 w-full overflow-hidden sm:h-56 md:h-64">
        <Image
          src={series.imageUrl || DEFAULT_BANNER_SRC}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="mb-10 text-center sm:mb-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fgColor-accent)' }}>
            Webinar Series
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{series.title}</h1>
          {hasSeriesDetails(series.details) && (
            <div className="mx-auto mt-4 max-w-2xl text-left text-base leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_li]:mb-1" style={{ color: 'var(--fgColor-muted)' }}>
              {renderSeriesDetailsHtml(series.details as string)}
            </div>
          )}
        </header>

        <section aria-label="Sessions">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--fgColor-muted)' }}>
            Sessions
          </h2>

          {sortedSessions.length === 0 ? (
            <div
              className="rounded-xl px-6 py-12 text-center"
              style={{
                border: '1px solid var(--borderColor-default)',
                backgroundColor: 'var(--bgColor-default)',
                color: 'var(--fgColor-muted)',
              }}
            >
              <p>No sessions have been scheduled yet. Check back soon.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {sortedSessions.map((s) => {
                const { date, time } = formatSessionDateTime(s.startsAt, s.endsAt)
                const ended = hasEnded(s.endsAt)
                const hasDescription = hasSeriesDetails(s.description)
                const isExpanded = expandedSessionId === s.sessionId

                return (
                  <li
                    key={s.sessionId}
                    className="rounded-xl p-4 sm:p-5"
                    style={{
                      border: '1px solid var(--borderColor-default)',
                      backgroundColor: 'var(--bgColor-default)',
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        disabled={!hasDescription}
                        onClick={() => setExpandedSessionId(isExpanded ? null : s.sessionId)}
                        aria-expanded={hasDescription ? isExpanded : undefined}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                      >
                        <p className="flex items-center gap-1.5 font-semibold">
                          <span className="truncate">{s.title}</span>
                          {hasDescription && (
                            isExpanded ? (
                              <ChevronUpIcon size={16} className="shrink-0" />
                            ) : (
                              <ChevronDownIcon size={16} className="shrink-0" />
                            )
                          )}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: 'var(--fgColor-muted)' }}>
                          <CalendarIcon size={14} />
                          {date} · {time}
                          {ended && <span className="ml-1 italic">(past)</span>}
                        </p>
                      </button>

                      {s.registrationUrl && !ended && (
                        <a
                          href={s.registrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                          style={{
                            backgroundColor: 'var(--bgColor-accent-emphasis)',
                            color: 'var(--fgColor-onEmphasis)',
                          }}
                        >
                          Register <LinkExternalIcon size={14} />
                        </a>
                      )}
                    </div>

                    {hasDescription && isExpanded && (
                      <div
                        className="mt-3 max-w-none border-t pt-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_li]:mb-1"
                        style={{ borderColor: 'var(--borderColor-default)', color: 'var(--fgColor-muted)' }}
                      >
                        {renderSeriesDetailsHtml(s.description as string)}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

