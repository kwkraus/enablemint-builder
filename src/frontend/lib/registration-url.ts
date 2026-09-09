/**
 * Shared registration URL validation used by the Registration Link dialog.
 *
 * Mirrors the backend rules in `SessionService`/`RegistrationUrlValidator`:
 *  - Surrounding whitespace is trimmed before validating or storing.
 *  - An empty or whitespace-only value means "no registration URL" (not an error).
 *  - The trimmed value must not exceed `REGISTRATION_URL_MAX_LENGTH` characters.
 *  - The trimmed value must be an absolute URL using the `http` or `https` scheme.
 *
 * The same rules apply to the optional session recording URL (backend
 * `RecordingUrlValidator`); pass a `label` to tailor the error copy.
 */

export const REGISTRATION_URL_MAX_LENGTH = 2048

export interface RegistrationUrlValidationResult {
  /** Normalized value to submit: the trimmed string, or `null` when empty/whitespace-only. */
  value: string | null
  /** Human-readable validation error, or `null` when the value is valid. */
  error: string | null
}

/**
 * Validates and normalizes a candidate registration URL.
 *
 * Returns `{ value: null, error: null }` when the input is empty or whitespace-only
 * (treated as "clear the registration URL"). Returns a non-null `error` message when
 * the trimmed value is present but invalid; in that case `value` is always `null` so
 * callers never accidentally persist an invalid URL.
 */
export function validateRegistrationUrl(
  rawValue: string | null | undefined,
  /** Human-readable field name used in error messages (e.g. 'Recording link'). */
  label = 'Registration link',
): RegistrationUrlValidationResult {
  const trimmed = (rawValue ?? '').trim()

  if (trimmed.length === 0) {
    return { value: null, error: null }
  }

  if (trimmed.length > REGISTRATION_URL_MAX_LENGTH) {
    return {
      value: null,
      error: `${label} must be ${REGISTRATION_URL_MAX_LENGTH} characters or fewer.`,
    }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return {
      value: null,
      error: 'Enter a valid absolute URL, e.g. https://example.com/register.',
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      value: null,
      error: `${label} must start with http:// or https://.`,
    }
  }

  return { value: trimmed, error: null }
}

/** Convenience check for callers that only need a boolean. */
export function isValidRegistrationUrl(rawValue: string | null | undefined): boolean {
  const { value, error } = validateRegistrationUrl(rawValue)
  return error === null && (value !== null || (rawValue ?? '').trim().length === 0)
}