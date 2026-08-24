import { apiFetch } from './client'
import type { SeriesListItem, SeriesResponse } from './types'

export async function getSeries(accessToken: string): Promise<SeriesListItem[]> {
  return apiFetch<SeriesListItem[]>('/series', {}, accessToken)
}

export async function getSeriesById(id: string, accessToken: string): Promise<SeriesResponse> {
  return apiFetch<SeriesResponse>(`/series/${id}`, {}, accessToken)
}

export async function createSeries(
  data: { title: string; details?: string | null },
  accessToken: string,
): Promise<SeriesResponse> {
  return apiFetch<SeriesResponse>(
    '/series',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken,
  )
}

export async function updateSeries(
  id: string,
  data: { title: string; details?: string | null; isPublic?: boolean },
  accessToken: string,
): Promise<SeriesResponse> {
  return apiFetch<SeriesResponse>(
    `/series/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    accessToken,
  )
}

export async function deleteSeries(id: string, accessToken: string): Promise<void> {
  return apiFetch<void>(`/series/${id}`, { method: 'DELETE' }, accessToken)
}

/**
 * Exports a series as a Markdown file and triggers a browser download.
 * Uses raw fetch (not apiFetch) because the response is a binary blob, not JSON.
 */
export async function exportSeriesMarkdown(seriesId: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? 'http://localhost:5187'
  const response = await fetch(`${baseUrl}/api/v1/series/${seriesId}/export/markdown`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`)
  }

  // Extract filename from Content-Disposition header, e.g. attachment; filename="Something.md"
  let filename = 'series-export.md'
  const disposition = response.headers.get('Content-Disposition')
  if (disposition) {
    const match = disposition.match(/filename="([^"]+)"/)
    if (match?.[1]) {
      filename = match[1]
    }
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
