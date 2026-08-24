import { notFound } from 'next/navigation'
import { getPublicSeries } from '@/lib/api/public-series'
import { PublicSeriesLanding } from '@/components/public-series-landing'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const series = await getPublicSeries(id)
  if (!series) return { title: 'Series not found — EnableFront Builder' }
  return { title: `${series.title} — EnableFront Builder` }
}

/**
 * Public, anonymous landing page for a series (FR-001/FR-002). No auth
 * check of any kind is performed here -- visibility is entirely gated
 * server-side by `GET /api/v1/public/series/{id}`, which returns 404 for
 * both a nonexistent series and one with `IsPublic == false` (FR-016).
 */
export default async function PublicSeriesPage({ params }: Props) {
  const { id } = await params
  const series = await getPublicSeries(id)

  if (!series) {
    notFound()
  }

  return <PublicSeriesLanding series={series} />
}
