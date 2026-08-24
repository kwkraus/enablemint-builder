import Link from 'next/link'

/**
 * Rendered by Next.js when `notFound()` is called from the public series
 * page (FR-008/FR-016). Deliberately generic -- gives no hint whether the
 * requested id was invalid or simply belongs to a private series.
 */
export default function PublicSeriesNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Series not found</h1>
      <p className="mt-2 max-w-md" style={{ color: 'var(--fgColor-muted)' }}>
        This page doesn&apos;t exist, or the series is no longer publicly available.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium"
        style={{ color: 'var(--fgColor-accent)' }}
      >
        Go to homepage
      </Link>
    </div>
  )
}
