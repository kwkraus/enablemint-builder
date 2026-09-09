'use client'

import { useState } from 'react'
import { LinkExternalIcon, CalendarIcon, ChevronDownIcon, ChevronUpIcon, PlayIcon } from '@primer/octicons-react'
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bgColor-default)' }}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* Banner: falls back to a bundled stock image today; `series.imageUrl` is
            already threaded through end-to-end so a future owner-facing image
            picker only needs to set that field -- no other changes required here.
            Contained (not full-bleed) and modestly sized to keep the page compact. */}
        <div
          className="relative h-28 w-full overflow-hidden rounded-lg sm:h-36 md:h-44"
          style={{ border: '1px solid var(--borderColor-default)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={series.imageUrl || DEFAULT_BANNER_SRC}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        <header className="mt-6 mb-6 text-left sm:mt-8 sm:mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fgColor-accent)' }}>
            Webinar Series
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{series.title}</h1>
          {hasSeriesDetails(series.details) && (
            <div className="mt-2 max-w-2xl text-left text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_li]:mb-1" style={{ color: 'var(--fgColor-muted)' }}>
              {renderSeriesDetailsHtml(series.details as string)}
            </div>
          )}
        </header>

        <section aria-label="Sessions">
          <h2
            className="mb-3 border-b pb-2 text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--fgColor-muted)', borderColor: 'var(--borderColor-default)' }}
          >
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
            <ul className="flex flex-col">
              {sortedSessions.map((s) => {
                const { date, time } = formatSessionDateTime(s.startsAt, s.endsAt)
                const ended = hasEnded(s.endsAt)
                // A recording replaces the registration link once the session has been
                // delivered. When a recording is published ahead of the delivery date,
                // both links are shown so viewers can still register for the live run.
                const showRecording = Boolean(s.recordingUrl)
                const showRegistration = Boolean(s.registrationUrl) && !ended
                const hasDescription = hasSeriesDetails(s.description)
                const isExpanded = expandedSessionId === s.sessionId

                return (
                  <li
                    key={s.sessionId}
                    className="py-3"
                    style={{ borderBottom: '1px solid var(--borderColor-muted, var(--borderColor-default))' }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <button
                        type="button"
                        disabled={!hasDescription}
                        onClick={() => setExpandedSessionId(isExpanded ? null : s.sessionId)}
                        aria-expanded={hasDescription ? isExpanded : undefined}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                      >
                        <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--fgColor-muted)' }}>
                          <CalendarIcon size={14} />
                          {date} · {time}
                          {ended && <span className="ml-1 italic">(past)</span>}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 font-semibold">
                          <span className="truncate">{s.title}</span>
                          {hasDescription && (
                            isExpanded ? (
                              <ChevronUpIcon size={16} className="shrink-0" />
                            ) : (
                              <ChevronDownIcon size={16} className="shrink-0" />
                            )
                          )}
                        </p>
                      </button>

                      {(showRegistration || showRecording) && (
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          {showRegistration && (
                            <a
                              href={s.registrationUrl as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center justify-center gap-1 text-sm font-semibold hover:underline"
                              style={{ color: 'var(--fgColor-accent)' }}
                            >
                              Register <LinkExternalIcon size={12} />
                            </a>
                          )}

                          {showRecording && (
                            <a
                              href={s.recordingUrl as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center justify-center gap-1 text-sm font-semibold hover:underline"
                              style={{ color: 'var(--fgColor-accent)' }}
                            >
                              <PlayIcon size={12} /> Watch Recording
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {hasDescription && isExpanded && (
                      <div
                        className="mt-2 max-w-none text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_li]:mb-1"
                        style={{ color: 'var(--fgColor-muted)' }}
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

