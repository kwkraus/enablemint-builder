'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ChevronLeftIcon, CheckIcon, TrashIcon, LinkIcon, LinkExternalIcon, PencilIcon } from '@primer/octicons-react'
import { Button, IconButton, Spinner, Token, SkeletonBox, Link as PrimerLink } from '@primer/react'
import { SkeletonText } from '@primer/react/experimental'
import { ErrorBanner } from '@/components/error-banner'
import { MetricsPanel } from '@/components/metrics-panel'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { InlineEditableTitle } from '@/components/inline-editable-title'
import { SessionSchedulePicker } from '@/components/session-schedule-picker'
import { RegistrationLinkDialog } from '@/components/registration-link-dialog'
import { SessionDescription } from '@/components/session-description'

import {
  getSessionById,
  updateSession,
  updateSessionTitle,
  deleteSession,
} from '@/lib/api/sessions'
import { getSessionMetrics } from '@/lib/api/metrics'
import type { SessionResponse, SessionMetricsResponse } from '@/lib/api/types'

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export default function SessionDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: authSession, status: authStatus } = useSession()
  const router = useRouter()
  const token = authSession?.accessToken ?? ''

  const [session, setSession] = useState<SessionResponse | null>(null)
  const [metrics, setMetrics] = useState<SessionMetricsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const loadData = useCallback(async () => {
    if (authStatus === 'loading' || !token) return
    setLoadingData(true)
    setLoadError(null)
    try {
      const [s, m] = await Promise.all([
        getSessionById(id, token),
        getSessionMetrics(id, token).catch(() => null),
      ])
      setSession(s)
      setMetrics(m ?? null)
      setTitle(s.title)
      setStartsAtDate(toDate(s.startsAt))
      setEndsAtDate(toDate(s.endsAt))
      setRegistrationUrl(s.registrationUrl ?? null)
      setDescription(s.description ?? null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoadingData(false)
    }
  }, [id, token, authStatus])

  useEffect(() => {
    loadData()
  }, [loadData])

  const [title, setTitle] = useState('')
  const [startsAtDate, setStartsAtDate] = useState<Date | null>(null)
  const [endsAtDate, setEndsAtDate] = useState<Date | null>(null)
  const [registrationUrl, setRegistrationUrl] = useState<string | null>(null)
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false)
  const [touched, setTouched] = useState(false)

  const titleError = touched && !title.trim() ? 'Title is required' : null
  const endsAtError =
    touched && startsAtDate && endsAtDate && endsAtDate.getTime() <= startsAtDate.getTime()
      ? 'End time must be after start time'
      : null

  const [titleSaveLoading, setTitleSaveLoading] = useState(false)
  const [titleSaveError, setTitleSaveError] = useState<string | null>(null)

  async function handleInlineTitleSave(nextTitle: string) {
    setTitleSaveLoading(true)
    setTitleSaveError(null)
    try {
      const updatedSession = await updateSessionTitle(id, { title: nextTitle }, token)
      setTitle(updatedSession.title)
      setSession((currentSession) => (currentSession ? { ...currentSession, ...updatedSession } : updatedSession))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update session title'
      setTitleSaveError(message)
      throw err
    } finally {
      setTitleSaveLoading(false)
    }
  }

  // ── Session description (specs/003-session-description) ──────────────────
  // The description belongs to the individual session (FR-002/FR-007) and is
  // always carried through the existing full session PUT: there is no
  // separate description-only endpoint (research.md Decision 2), so both the
  // description editor's own save and the schedule form's Save button below
  // must submit the currently-known description together with the rest of
  // the session's fields.
  const [description, setDescription] = useState<string | null>(null)
  const [descriptionSaving, setDescriptionSaving] = useState(false)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)

  // The backend only ever returns/updates a session for its owner (mirrors
  // specs/001-series-details/research.md Decision 4) -- there is no separate
  // non-owner "viewer" role today, so anyone who can load this page can also
  // edit its description. Single call site to change if that ever differs.
  const canEditDescription = true

  async function handleDescriptionSave(nextDescription: string) {
    setDescriptionSaving(true)
    setDescriptionError(null)
    try {
      const updated = await updateSession(
        id,
        {
          // Description saves use the last persisted session fields so an
          // in-progress schedule/title edit is neither committed nor able to
          // block the description update with an unrelated validation error.
          title: session?.title ?? title.trim(),
          startsAt: session?.startsAt ?? (startsAtDate ? startsAtDate.toISOString() : ''),
          endsAt: session?.endsAt ?? (endsAtDate ? endsAtDate.toISOString() : ''),
          registrationUrl: session?.registrationUrl ?? null,
          description: nextDescription,
        },
        token,
      )
      setDescription(updated.description)
      setSession((currentSession) => (currentSession ? { ...currentSession, ...updated } : updated))
    } catch (err) {
      setDescriptionError(err instanceof Error ? err.message : 'Failed to update session description')
      throw err
    } finally {
      setDescriptionSaving(false)
    }
  }

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault()
    setTouched(true)
    if (!title.trim()) return
    if (startsAtDate && endsAtDate && endsAtDate.getTime() <= startsAtDate.getTime()) return

    setSaveLoading(true)
    setSaveError(null)
    try {
      await updateSession(
        id,
        {
          title: title.trim(),
          startsAt: startsAtDate ? startsAtDate.toISOString() : '',
          endsAt: endsAtDate ? endsAtDate.toISOString() : '',
          registrationUrl,
          description,
        },
        token,
      )
      router.push(`/series/${session?.seriesId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setSaveError(msg)
      setSaveLoading(false)
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await deleteSession(id, token)
      router.push(`/series/${session?.seriesId}`)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete session')
      setDeleteLoading(false)
      setDeleteOpen(false)
    }
  }

  const busy = saveLoading || deleteLoading || titleSaveLoading || descriptionSaving

  if (loadingData) {
    return (
      <div className="space-y-6" aria-label="Loading session…" aria-busy="true">
        <SkeletonText size="bodySmall" maxWidth={112} />
        <div className="flex items-center gap-3">
          <SkeletonBox height={32} width={256} />
          <SkeletonBox height={32} width={32} />
          <SkeletonBox height={24} width={80} className="rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          <div className="space-y-4 rounded-lg border p-6" style={{ backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))' }}>
            <SkeletonText size="bodySmall" maxWidth={96} />
            <div className="space-y-1.5">
              <SkeletonText size="bodySmall" maxWidth={80} />
              <SkeletonBox height={40} />
            </div>
            <div className="space-y-1.5">
              <SkeletonText size="bodySmall" maxWidth={64} />
              <SkeletonBox height={40} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3 rounded-lg border p-6" style={{ backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))' }}>
              <SkeletonBox height={40} />
            </div>
            <div className="space-y-3 rounded-lg border p-6" style={{ backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))' }}>
              <SkeletonBox height={40} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkeletonBox height={40} width={96} />
            <SkeletonBox height={40} width={80} />
          </div>
          <SkeletonBox height={40} width={40} />
        </div>
      </div>
    )
  }

  if (loadError || !session) {
    return (
      <div className="space-y-4 py-8">
        <ErrorBanner message={loadError ?? 'Session not found'} onRetry={loadData} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/series/${session.seriesId}`}
        className="inline-flex items-center gap-1 text-sm transition-colors"
        style={{ color: 'var(--fgColor-muted, var(--color-fg-muted))' }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--fgColor-default, var(--color-fg-default))'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--fgColor-muted, var(--color-fg-muted))'
        }}
      >
        <ChevronLeftIcon size={16} aria-hidden="true" />
        Back to Series
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <InlineEditableTitle
              value={title}
              onSave={handleInlineTitleSave}
              disabled={busy}
              editAriaLabel="Edit session title"
              saveAriaLabel="Save session title"
              inputAriaLabel="Session title"
              titleClassName="text-2xl font-bold tracking-tight"
            />
          </div>
          {titleError && (
            <p role="alert" className="text-xs" style={{ color: 'var(--fgColor-danger, var(--color-danger-fg))' }}>
              {titleError}
            </p>
          )}
        </div>
      </div>

      {deleteError && <ErrorBanner message={deleteError} />}
      {titleSaveError && <ErrorBanner message={titleSaveError} />}
      {descriptionError && <ErrorBanner message={descriptionError} />}
      {saveError && <ErrorBanner message={saveError} />}

      {saveLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-3 rounded-lg px-6 py-4 shadow-lg" style={{ backgroundColor: 'var(--bgColor-default)' }}>
            <Spinner size="medium" />
            <span className="text-sm font-medium">Saving…</span>
          </div>
        </div>
      )}

      <SessionDescription
        value={description}
        canEdit={canEditDescription}
        onSave={handleDescriptionSave}
        saving={descriptionSaving}
        disabled={busy}
      />

      <form onSubmit={handleSave} noValidate className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          <section className="rounded-lg border p-6 space-y-4" style={{ backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))' }}>
            <h2 className="text-base font-semibold">Schedule</h2>

            <SessionSchedulePicker
              startsAt={startsAtDate}
              endsAt={endsAtDate}
              onStartsAtChange={setStartsAtDate}
              onEndsAtChange={setEndsAtDate}
              disabled={saveLoading}
            />
            {endsAtError && (
              <p role="alert" className="mt-1 text-xs" style={{ color: 'var(--fgColor-danger, var(--color-danger-fg))' }}>
                {endsAtError}
              </p>
            )}
          </section>

          <section className="rounded-lg border p-6 space-y-4" style={{ backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))' }}>
            <h2 className="text-base font-semibold">Registration</h2>

            {registrationUrl ? (
              <div className="flex items-center gap-2">
                <PrimerLink
                  href={registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1"
                >
                  Registration Link
                  <LinkExternalIcon size={14} aria-hidden="true" />
                </PrimerLink>
                <IconButton
                  icon={PencilIcon}
                  aria-label="Edit registration link"
                  size="small"
                  variant="invisible"
                  disabled={saveLoading}
                  onClick={() => setRegistrationDialogOpen(true)}
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="default"
                size="small"
                leadingVisual={LinkIcon}
                disabled={saveLoading}
                onClick={() => setRegistrationDialogOpen(true)}
              >
                Add Registration Link
              </Button>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" leadingVisual={CheckIcon} disabled={saveLoading}>
              Save
            </Button>
            <Button as={Link} href={`/series/${session.seriesId}`} variant="default">
              Cancel
            </Button>
          </div>
          <IconButton
            icon={TrashIcon}
            aria-label="Delete session"
            variant="danger"
            onClick={() => {
              setDeleteError(null)
              setDeleteOpen(true)
            }}
          />
        </div>
      </form>

      {metrics && (
        <section className="rounded-lg border p-6 space-y-4" style={{ backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))' }} aria-label="Session metrics">
          <h2 className="text-base font-semibold">Metrics</h2>
          <MetricsPanel
            metrics={[
              { label: 'Registrations', value: metrics.totalRegistrations },
              { label: 'Attendees', value: metrics.totalAttendees },
              { label: 'Registrant Domains', value: metrics.uniqueRegistrantAccountDomains },
              { label: 'Attendee Domains', value: metrics.uniqueAttendeeAccountDomains },
            ]}
          />
          {metrics.warmAccountsTriggered.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--fgColor-muted, var(--color-fg-muted))' }}>
                Warm accounts triggered:
              </p>
              <div className="flex flex-wrap gap-2">
                {metrics.warmAccountsTriggered.map((domain) => (
                  <Token key={domain} text={domain} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Session"
        description="This will permanently delete the session. Continue?"
        confirmLabel="Delete Session"
        dangerous
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <RegistrationLinkDialog
        open={registrationDialogOpen}
        initialValue={registrationUrl}
        onSave={(value) => {
          setRegistrationUrl(value)
          setRegistrationDialogOpen(false)
        }}
        onCancel={() => setRegistrationDialogOpen(false)}
      />
    </div>
  )
}