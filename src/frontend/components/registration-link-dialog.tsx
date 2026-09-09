'use client'

import { useId, useRef, useState } from 'react'
import { Dialog, FormControl, TextInput } from '@primer/react'
import { validateRegistrationUrl } from '@/lib/registration-url'

/**
 * Which session link the dialog is editing. Controls only the user-facing copy;
 * validation rules are identical for both (see `lib/registration-url.ts`).
 */
export type SessionLinkKind = 'registration' | 'recording'

const LINK_COPY: Record<SessionLinkKind, {
  addTitle: string
  editTitle: string
  subtitle: string
  fieldLabel: string
  placeholder: string
  errorLabel: string
}> = {
  registration: {
    addTitle: 'Add Registration Link',
    editTitle: 'Edit Registration Link',
    subtitle:
      'Paste the webinar registration URL from your conferencing provider (Teams, Zoom, Webex, or any other provider).',
    fieldLabel: 'Registration URL',
    placeholder: 'https://teams.microsoft.com/registration/example',
    errorLabel: 'Registration link',
  },
  recording: {
    addTitle: 'Add Recording Link',
    editTitle: 'Edit Recording Link',
    subtitle:
      'Paste the URL where the recording of this session can be watched (Stream, SharePoint, YouTube, or any other host).',
    fieldLabel: 'Recording URL',
    placeholder: 'https://example.com/recording',
    errorLabel: 'Recording link',
  },
}

interface RegistrationLinkDialogProps {
  /** Whether the dialog is currently open. Renders nothing when false. */
  open: boolean
  /** The session's current registration URL, or null when none is set. Used to prefill the field for edits. */
  initialValue: string | null
  /** Called with the normalized URL (or null to clear) when the owner chooses Done with a valid value. */
  onSave: (value: string | null) => void
  /** Called when the owner cancels or dismisses the dialog (Escape, backdrop, Cancel button, close button). Discards unsaved changes. */
  onCancel: () => void
  /** Which link is being edited. Defaults to the registration link. */
  kind?: SessionLinkKind
}

/**
 * Reusable Add/Edit Registration Link modal shared by session create and edit
 * surfaces. Provides a labeled URL field with inline validation as the value
 * changes or on blur, and explicit Done/Cancel actions instead of an
 * always-visible full-width URL textbox (FR-016, FR-017).
 *
 * Backend validation remains authoritative on the containing session save;
 * this dialog only prevents obviously invalid values from being confirmed so
 * the owner gets immediate feedback (Decision 6, research.md).
 */
export function RegistrationLinkDialog({
  open,
  initialValue,
  onSave,
  onCancel,
  kind = 'registration',
}: RegistrationLinkDialogProps) {
  const copy = LINK_COPY[kind]
  const [value, setValue] = useState(initialValue ?? '')
  const [touched, setTouched] = useState(false)
  // Tracks whether we've already reset local state for the current "open" transition.
  // Adjusting state during render (rather than in a useEffect) avoids an extra
  // render pass and cascading-render lint warnings; see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(open)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()

  if (open && !wasOpen) {
    setWasOpen(true)
    setValue(initialValue ?? '')
    setTouched(false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  if (!open) return null

  const { error } = validateRegistrationUrl(value, copy.errorLabel)
  const showError = touched && error !== null

  function commit() {
    setTouched(true)
    const result = validateRegistrationUrl(value, copy.errorLabel)
    if (result.error) return
    onSave(result.value)
  }

  return (
    <Dialog
      title={initialValue ? copy.editTitle : copy.addTitle}
      subtitle={copy.subtitle}
      onClose={onCancel}
      initialFocusRef={inputRef}
      footerButtons={[
        {
          content: 'Cancel',
          onClick: onCancel,
        },
        {
          content: 'Done',
          buttonType: 'primary',
          onClick: commit,
          disabled: touched && error !== null,
        },
      ]}
    >
      <FormControl>
        <FormControl.Label>{copy.fieldLabel}</FormControl.Label>
        <TextInput
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={copy.placeholder}
          block
          aria-label={copy.fieldLabel}
          aria-describedby={showError ? errorId : undefined}
          aria-invalid={showError ? true : undefined}
          validationStatus={showError ? 'error' : undefined}
        />
        {showError && (
          <FormControl.Validation id={errorId} variant="error">
            {error}
          </FormControl.Validation>
        )}
      </FormControl>
    </Dialog>
  )
}
