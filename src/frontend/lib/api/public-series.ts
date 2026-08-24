import { apiFetch, ApiError } from './client'
import type { PublicSeriesResponse } from './types'

/**
 * Fetches the anonymous public landing page payload for a series.
 *
 * Unlike every other `lib/api` call, this hits `/api/v1/public/series/{id}`
 * and is never passed an access token -- the endpoint is unauthenticated by
 * design (see `specs/004-public-series-landing-page/contracts/public-series-api.md`).
 * Returns `null` for a `404` (series doesn't exist or is not public) so the
 * caller can render a not-found page without treating it as an error.
 */
export async function getPublicSeries(id: string): Promise<PublicSeriesResponse | null> {
  try {
    return await apiFetch<PublicSeriesResponse>(`/public/series/${id}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
