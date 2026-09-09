'use client'

import { useId, useState } from 'react'
import { LinkExternalIcon } from '@primer/octicons-react'

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
 * (`/public/series/{id}`). Off by default (FR-013/FR-014) -- this component
 * only ever reflects and changes the series' `isPublic` flag; it never
 * infers visibility from anything else.
 */
export function SeriesVisibilityToggle({
  checked,
  publicUrl,
  onChange,
  disabled = false,
}: SeriesVisibilityToggleProps) {
  const labelId = useId()
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
    <div className="flex flex-col gap-1">
      <div
        className="inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2"
        style={{
          backgroundColor: 'var(--bgColor-muted)',
          border: '1px solid var(--borderColor-default)',
        }}
        title="Controls whether visitors can access the public series landing page."
      >
        <span id={labelId} className="text-sm font-medium">
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
        {checked && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md p-1"
            style={{ color: 'var(--fgColor-accent)' }}
            aria-label="Open public landing page"
            title="Open public landing page"
          >
            <LinkExternalIcon size={16} />
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--fgColor-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
