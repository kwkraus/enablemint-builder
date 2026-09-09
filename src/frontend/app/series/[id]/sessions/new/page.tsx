'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ChevronLeftIcon, LinkIcon, LinkExternalIcon, PencilIcon, DeviceCameraVideoIcon } from '@primer/octicons-react'
import { Button, FormControl, IconButton, TextInput, Spinner, Link as PrimerLink } from '@primer/react'
import { ErrorBanner } from '@/components/error-banner'
import { SessionSchedulePicker } from '@/components/session-schedule-picker'
import { RegistrationLinkDialog } from '@/components/registration-link-dialog'
import { createSession } from '@/lib/api/sessions'

const cardStyle: React.CSSProperties = {
  borderWidth: 'var(--borderWidth-thin, 1px)',
  borderStyle: 'solid',
  borderColor: 'var(--borderColor-default, var(--color-border-default))',
  borderRadius: 'var(--borderRadius-medium, 6px)',
  padding: 'var(--base-size-24, 24px)',
}

export default function NewSessionPage() {
  const params = useParams()
  const seriesId = params.id as string
  const { data: authSession } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [startsAtDate, setStartsAtDate] = useState<Date | null>(null)
  const [endsAtDate, setEndsAtDate] = useState<Date | null>(null)
  const [registrationUrl, setRegistrationUrl] = useState<string | null>(null)
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingDialogOpen, setRecordingDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const titleError = touched && !title.trim() ? 'Title is required' : null
  const endsAtError =
    touched && startsAtDate && endsAtDate && endsAtDate.getTime() <= startsAtDate.getTime()
      ? 'End time must be after start time'
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!title.trim()) return
    if (startsAtDate && endsAtDate && endsAtDate.getTime() <= startsAtDate.getTime()) return

    setLoading(true)
    setError(null)
    try {
      await createSession(
        seriesId,
        {
          title: title.trim(),
          startsAt: startsAtDate ? startsAtDate.toISOString() : '',
          endsAt: endsAtDate ? endsAtDate.toISOString() : '',
          registrationUrl,
          recordingUrl,
        },
        authSession?.accessToken ?? '',
      )
      router.push(`/series/${seriesId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/series/${seriesId}`}
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: 'var(--fgColor-muted, var(--color-fg-muted))' }}
        >
          <ChevronLeftIcon size={16} />
          Back to Series
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Add Session</h1>

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'var(--overlay-backdrop, rgba(0,0,0,0.3))' }}
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="flex items-center gap-3 px-6 py-4 shadow-lg"
            style={{
              backgroundColor: 'var(--bgColor-default, var(--color-canvas-default))',
              borderRadius: 'var(--borderRadius-medium, 6px)',
            }}
          >
            <Spinner size="small" />
            <span className="text-sm font-medium">Creating session…</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormControl required>
          <FormControl.Label>Title</FormControl.Label>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Intro to EnableFront"
            block
            autoFocus
            validationStatus={titleError ? 'error' : undefined}
          />
          {titleError && (
            <FormControl.Validation variant="error">{titleError}</FormControl.Validation>
          )}
        </FormControl>

        <div className="space-y-4" style={cardStyle}>
          <h2 className="text-base font-semibold">Schedule</h2>
          <SessionSchedulePicker
            startsAt={startsAtDate}
            endsAt={endsAtDate}
            onStartsAtChange={setStartsAtDate}
            onEndsAtChange={setEndsAtDate}
            disabled={loading}
          />
          {endsAtError && (
            <FormControl.Validation variant="error">{endsAtError}</FormControl.Validation>
          )}
        </div>

        <div className="space-y-3" style={cardStyle}>
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
                onClick={() => setRegistrationDialogOpen(true)}
              />
            </div>
          ) : (
            <Button
              type="button"
              variant="default"
              size="small"
              leadingVisual={LinkIcon}
              onClick={() => setRegistrationDialogOpen(true)}
            >
              Add Registration Link
            </Button>
          )}
        </div>

        <div className="space-y-3" style={cardStyle}>
          <h2 className="text-base font-semibold">Recording</h2>
          {recordingUrl ? (
            <div className="flex items-center gap-2">
              <PrimerLink
                href={recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                Recording Link
                <LinkExternalIcon size={14} aria-hidden="true" />
              </PrimerLink>
              <IconButton
                icon={PencilIcon}
                aria-label="Edit recording link"
                size="small"
                variant="invisible"
                onClick={() => setRecordingDialogOpen(true)}
              />
            </div>
          ) : (
            <Button
              type="button"
              variant="default"
              size="small"
              leadingVisual={DeviceCameraVideoIcon}
              onClick={() => setRecordingDialogOpen(true)}
            >
              Add Recording Link
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
          <Button as={Link} href={`/series/${seriesId}`} variant="default">
            Cancel
          </Button>
        </div>
      </form>

      <RegistrationLinkDialog
        open={registrationDialogOpen}
        initialValue={registrationUrl}
        onSave={(value) => {
          setRegistrationUrl(value)
          setRegistrationDialogOpen(false)
        }}
        onCancel={() => setRegistrationDialogOpen(false)}
      />

      <RegistrationLinkDialog
        kind="recording"
        open={recordingDialogOpen}
        initialValue={recordingUrl}
        onSave={(value) => {
          setRecordingUrl(value)
          setRecordingDialogOpen(false)
        }}
        onCancel={() => setRecordingDialogOpen(false)}
      />
    </div>
  )
}
