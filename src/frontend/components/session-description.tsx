'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { PencilIcon, PlusIcon } from '@primer/octicons-react'
import { Button, IconButton } from '@primer/react'
import { SeriesDetailsEditor } from '@/components/series-details-editor'
import { hasSeriesDetails, renderSeriesDetailsHtml } from '@/lib/series-details-html'

export interface SessionDescriptionProps {
  /** Sanitized session description HTML from the server, or `null` when none is saved. */
  value: string | null
  /**
   * Whether the current user may add/edit the description. Mirrors
   * `SeriesDetailsProps.canEdit` (see series-details.tsx): the backend's
   * GET/PUT `/api/v1/sessions/{id}` endpoints are owner-scoped only (see
   * specs/003-session-description/contracts/session-description-api.md) --
   * there is no distinct non-owner "viewer" role today, so anyone who can
   * load this page can also edit it. Threaded through explicitly so a future
   * access model only needs to change the single call site that computes it.
   */
  canEdit: boolean
  onSave: (nextValue: string) => Promise<void>
  saving?: boolean
  disabled?: boolean
}

/**
 * Collapsed height bound (roughly six-to-eight lines at this component's
 * text-sm/leading-relaxed sizing) so a long description never pushes
 * schedule, registration, or metrics off the viewport by default (FR-010).
 * See specs/003-session-description/research.md Decision 5.
 */
const COLLAPSED_MAX_HEIGHT_PX = 176

/**
 * Session Description section: sanitized read-only rendering for any viewer,
 * an accessible add/edit affordance and headless editor reused from Series
 * Details for owners, and a bounded collapsed presentation with
 * keyboard-operable "Show more…"/"Show less…" disclosure controls for long
 * content (FR-010/FR-011). Read-only, non-editing users never see an empty
 * "Add description" prompt when no description exists (mirrors
 * series-details.tsx's FR-008-equivalent behavior).
 *
 * Reuses `SeriesDetailsEditor` and the safe `renderSeriesDetailsHtml`
 * renderer with session-specific labels (specs/003-session-description/
 * research.md Decisions 4-5) so a session description is never visually or
 * programmatically confused with a series description (SC-003).
 */
export function SessionDescription({
  value,
  canEdit,
  onSave,
  saving = false,
  disabled = false,
}: SessionDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const contentId = useId()
  const hasDescription = hasSeriesDetails(value)

  // A newly saved/reloaded value always starts in the bounded collapsed state.
  // Adjusted during render (not in an effect) per the React-recommended
  // "adjusting state when a prop changes" pattern, avoiding an extra
  // cascading render from a setState-in-effect.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setIsExpanded(false)
  }

  // Resize-safe overflow measurement: only render the disclosure control when
  // the collapsed content actually overflows its bound. Re-measures on
  // viewport/content resizes while collapsed; once expanded there is no
  // clamp to overflow, so measurement pauses until collapsed again.
  useEffect(() => {
    if (!hasDescription || isEditing || isExpanded) return

    const node = contentRef.current
    if (!node) return

    function measure() {
      if (!node) return
      setIsOverflowing(node.scrollHeight - node.clientHeight > 1)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasDescription, isEditing, isExpanded, value])

  if (!canEdit && !hasDescription) {
    return null
  }

  async function handleEditorSave(nextValueHtml: string) {
    try {
      await onSave(nextValueHtml)
      setIsEditing(false)
    } catch {
      // The parent page (app/sessions/[id]/page.tsx) surfaces the failure via
      // an error banner and keeps `saving` false; staying in edit mode here
      // retains the in-progress draft rather than discarding it.
    }
  }

  return (
    <section aria-label="Session description">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--fgColor-muted)' }}
        >
          Description
        </h2>
        {canEdit && !isEditing && hasDescription && (
          <IconButton
            icon={PencilIcon}
            aria-label="Edit session description"
            variant="invisible"
            size="small"
            disabled={disabled}
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>

      {isEditing ? (
        <SeriesDetailsEditor
          initialValue={value ?? ''}
          onSave={handleEditorSave}
          onCancel={() => setIsEditing(false)}
          disabled={disabled}
          saving={saving}
          toolbarLabel="Session description formatting"
          textboxLabel="Session description"
          placeholderText="Describe what attendees can expect in this session…"
          saveLabel="Save description"
        />
      ) : hasDescription ? (
        <div>
          <div
            id={contentId}
            ref={contentRef}
            className="max-w-none text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_li]:mb-1"
            style={isExpanded ? undefined : { maxHeight: COLLAPSED_MAX_HEIGHT_PX, overflow: 'hidden' }}
          >
            {renderSeriesDetailsHtml(value as string)}
          </div>
          {isOverflowing && (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={contentId}
              onClick={() => setIsExpanded((expanded) => !expanded)}
              className="mt-2 rounded text-sm font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: 'var(--fgColor-accent)' }}
            >
              {isExpanded ? 'Show less\u2026 session description' : 'Show more\u2026 session description'}
            </button>
          )}
        </div>
      ) : (
        <Button
          variant="invisible"
          size="small"
          leadingVisual={PlusIcon}
          disabled={disabled}
          onClick={() => setIsEditing(true)}
          className="px-0"
        >
          Add description
        </Button>
      )}
    </section>
  )
}
