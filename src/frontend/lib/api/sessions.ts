import { apiFetch } from './client'
import type { SessionListItem, SessionResponse } from './types'

export async function getSessionsBySeries(
  seriesId: string,
  accessToken: string,
): Promise<SessionListItem[]> {
  return apiFetch<SessionListItem[]>(`/series/${seriesId}/sessions`, {}, accessToken)
}

export async function createSession(
  seriesId: string,
  data: {
    title: string
    startsAt: string
    endsAt: string
    registrationUrl?: string | null
    description?: string | null
  },
  accessToken: string,
): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(
    `/series/${seriesId}/sessions`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken,
  )
}

export async function getSessionById(id: string, accessToken: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(`/sessions/${id}`, {}, accessToken)
}

export async function updateSession(
  id: string,
  data: {
    title: string
    startsAt: string
    endsAt: string
    registrationUrl?: string | null
    description?: string | null
  },
  accessToken: string,
): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(
    `/sessions/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    accessToken,
  )
}

export async function updateSessionTitle(
  id: string,
  data: { title: string },
  accessToken: string,
): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(
    `/sessions/${id}/title`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    accessToken,
  )
}
export async function deleteSession(id: string, accessToken: string): Promise<void> {
  return apiFetch<void>(`/sessions/${id}`, { method: 'DELETE' }, accessToken)
}