export interface SeriesListItem {
  seriesId: string
  title: string
  sessionCount: number
  totalRegistrations: number
  totalAttendees: number
  uniqueAccountsInfluenced: number
  createdAt: string
  updatedAt: string
}

export interface SeriesResponse {
  seriesId: string
  title: string
  details: string | null
  isPublic: boolean
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface SessionListItem {
  sessionId: string
  title: string
  startsAt: string
  endsAt: string
  totalRegistrations: number
  totalAttendees: number
  ownerDisplayName: string
  registrationUrl: string | null
}

export interface SessionResponse {
  sessionId: string
  seriesId: string
  title: string
  startsAt: string
  endsAt: string
  registrationUrl: string | null
  description: string | null
}

export interface PublicSessionItem {
  sessionId: string
  title: string
  startsAt: string
  endsAt: string
  registrationUrl: string | null
  description: string | null
}

export interface PublicSeriesResponse {
  title: string
  details: string | null
  imageUrl: string | null
  sessions: PublicSessionItem[]
}

export interface SeriesMetricsResponse {
  seriesId: string
  totalRegistrations: number
  totalAttendees: number
  uniqueRegistrantAccountDomains: number
  uniqueAccountsInfluenced: number
  warmAccounts: { accountDomain: string; warmRule: 'W1' | 'W2' }[]
}

export interface SessionMetricsResponse {
  sessionId: string
  totalRegistrations: number
  totalAttendees: number
  uniqueRegistrantAccountDomains: number
  uniqueAttendeeAccountDomains: number
  warmAccountsTriggered: string[]
}