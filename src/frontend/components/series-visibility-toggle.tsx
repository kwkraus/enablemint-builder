'use client'

import { useId, useState } from 'react'
import { GlobeIcon, LinkExternalIcon } from '@primer/octicons-react'
import { AnchoredOverlay, IconButton } from '@primer/react'

export interface SeriesVisibilityToggleProps {
  /** Current `IsPublic` state, as last confirmed by the server. */
  checked: boolean
  /** Absolute public landing page URL, shown only while `checked` is true. */
  publicUrl: string
  /** Persists the new value; throwing leaves the toggle at its prior state. */
  onChange: (nextChecked: boolean) => Promise<void>
  disabled?: boolean
}

/**
 * Owner-facing on/off control for the public series landing page
 * (`/public/series/{id}`). Collapsed to a single globe icon that carries the
 * on/off indication; clicking it opens a popover with the title, the switch,
 * and the public link. Off by default (FR-013/FR-014) -- this component only
 * ever reflects and changes the series' `isPublic` flag; it never infers
 * visibility from anything else.
 */
export function SeriesVisibilityToggle({
  checked,
  publicUrl,
  onChange,
  disabled = false,
}: SeriesVisibilityToggleProps) {
  const labelId = useId()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const statusText = checked ? 'Public' : 'Private'

  async function handleClick() {
    const next = !checked
    setPending(true)
    setError(null)
    try {
      await onChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility')
    } finally {
      setPending(false)
    }
  }

  return (
    <AnchoredOverlay
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      renderAnchor={(anchorProps) => (
        <IconButton
          {...anchorProps}
          icon={GlobeIcon}
          aria-label={`Landing page: ${statusText}`}
          title={`Landing page: ${statusText}`}
          variant="default"
          sx={{ color: checked ? 'var(--fgColor-success)' : 'var(--fgColor-muted)' }}
        />
      )}
    >
      <div className="flex w-72 flex-col gap-3 p-3" role="group" aria-labelledby={labelId}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span id={labelId} className="text-sm font-semibold">
              Landing page
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                color: checked ? 'var(--fgColor-success)' : 'var(--fgColor-muted)',
                backgroundColor: checked ? 'var(--bgColor-success-muted)' : 'var(--bgColor-neutral-muted)',
              }}
            >
              {statusText}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={labelId}
            title={`Make landing page ${checked ? 'private' : 'public'}`}
            onClick={handleClick}
            disabled={disabled || pending}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: checked ? 'var(--bgColor-accent-emphasis)' : 'var(--controlTrack-bgColor-rest)',
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--fgColor-muted)' }}>
          Controls whether visitors can access the public series landing page.
        </p>

        {checked && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm"
            style={{ color: 'var(--fgColor-accent)' }}
            aria-label="Open public landing page"
            title="Open public landing page"
          >
            <LinkExternalIcon size={16} />
            <span className="truncate">{publicUrl}</span>
          </a>
        )}

        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--fgColor-danger)' }}>
            {error}
          </p>
        )}
      </div>
    </AnchoredOverlay>
  )
}
