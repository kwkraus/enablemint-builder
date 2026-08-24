'use client'

import { useId, useState } from 'react'
import { ToggleSwitch } from '@primer/react'
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
      <div className="flex items-center gap-2">
        <ToggleSwitch
          aria-labelledby={labelId}
          checked={checked}
          onClick={handleClick}
          disabled={disabled || pending}
          size="small"
        />
        <span id={labelId} className="text-sm font-medium">
          Public landing page
        </span>
        {checked && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--fgColor-accent)' }}
          >
            View page <LinkExternalIcon size={12} />
          </a>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: 'var(--fgColor-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
