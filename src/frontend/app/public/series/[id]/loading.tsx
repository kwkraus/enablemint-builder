/** Route-level loading skeleton shown while the public series page streams in. */
export default function PublicSeriesLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16" aria-busy="true" aria-label="Loading series…">
      <div className="mb-10 flex flex-col items-center gap-3 text-center sm:mb-14">
        <div className="h-3 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--bgColor-muted)' }} />
        <div className="h-9 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--bgColor-muted)' }} />
        <div className="h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: 'var(--bgColor-muted)' }} />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--bgColor-muted)' }}
          />
        ))}
      </div>
    </div>
  )
}
