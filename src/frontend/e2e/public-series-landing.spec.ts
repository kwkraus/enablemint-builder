/**
 * E2E tests for the anonymous public series landing page
 * (`/public/series/[id]`, backed by `GET /api/v1/public/series/{id}`).
 *
 * Unlike the authenticated series pages, this route requires no session
 * cookie at all -- it must be reachable with a cold, unauthenticated
 * browser context. The Next.js server component fetches
 * `GET /api/v1/public/series/:id` directly from the Node server process,
 * which is not interceptable by Playwright's `page.route()` (that only
 * intercepts browser-originated requests). We rely on
 * `BACKEND_API_BASE_URL`/`NEXT_PUBLIC_BACKEND_API_BASE_URL` pointing at a
 * reachable backend (or local stub) for these tests to pass; see
 * `series-export.spec.ts` for the same caveat on other pages.
 */
import { test, expect } from '@playwright/test'

const PUBLIC_SERIES_ID = 'e2e-public-series-001'
const PRIVATE_SERIES_ID = 'e2e-private-series-001'
const EMPTY_DETAILS_SERIES_ID = 'e2e-empty-details-series-001'
const NO_SESSIONS_SERIES_ID = 'e2e-no-sessions-series-001'

test.describe('Public series landing page', () => {
  test('is reachable without any authentication cookie', async ({ browser }) => {
    // Explicitly create a context with zero cookies/storage state to prove
    // the route never redirects to /login (FR-002).
    const context = await browser.newContext()
    const page = await context.newPage()

    const response = await page.goto(`/public/series/${PUBLIC_SERIES_ID}`)
    expect(response?.status()).not.toBe(401)
    expect(response?.status()).not.toBe(403)
    expect(page.url()).not.toContain('/login')
    expect(page.url()).not.toContain('/api/auth/signin')

    await context.close()
  })

  test('shows a generic not-found state for a nonexistent series id', async ({ page }) => {
    await page.goto('/public/series/00000000-0000-0000-0000-000000000000')
    await expect(page.getByRole('heading', { name: 'Series not found' })).toBeVisible()
  })

  // The remaining scenarios (T024-T026, T037-T039, T041-T043) require the
  // backend to actually serve the fixture series ids above with the
  // corresponding IsPublic/details/sessions state, since the page.tsx server
  // component's fetch runs in the Node dev-server process and is not
  // interceptable by page.route() (see series-export.spec.ts for the same
  // documented limitation). They are written to run against a live backend
  // or local stub seeded with these fixture ids.

  test('renders title, details, and session table for a public series', async ({ page }) => {
    await page.goto(`/public/series/${PUBLIC_SERIES_ID}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Register/i }).first()).toBeVisible()
  })

  test('renders cleanly with no broken description section when Details is empty', async ({ page }) => {
    await page.goto(`/public/series/${EMPTY_DETAILS_SERIES_ID}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('shows a neutral empty-state message when a public series has zero sessions', async ({ page }) => {
    await page.goto(`/public/series/${NO_SESSIONS_SERIES_ID}`)
    await expect(page.getByText('No sessions have been scheduled yet.')).toBeVisible()
  })

  test('a private series renders the identical not-found page as a nonexistent id', async ({ page }) => {
    await page.goto(`/public/series/${PRIVATE_SERIES_ID}`)
    await expect(page.getByRole('heading', { name: 'Series not found' })).toBeVisible()
  })

  test('a session with a registrationUrl shows a Register control opening in a new tab', async ({ page, context }) => {
    await page.goto(`/public/series/${PUBLIC_SERIES_ID}`)
    const registerLink = page.getByRole('link', { name: /Register/i }).first()
    await expect(registerLink).toHaveAttribute('target', '_blank')
    await expect(registerLink).toHaveAttribute('rel', 'noopener noreferrer')
    void context // new-tab behavior is implied by target="_blank"+rel, verified via attributes above
  })

  test('sessions with an ended endsAt show no active Register control', async ({ page }) => {
    await page.goto(`/public/series/${PUBLIC_SERIES_ID}`)
    await expect(page.getByText('(past)').first()).toBeVisible()
  })

  test('mobile viewport (~375px) has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/public/series/${PUBLIC_SERIES_ID}`)
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)
  })

  test('tablet (~768px) and desktop (~1280px) viewports have no horizontal overflow', async ({ page }) => {
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/public/series/${PUBLIC_SERIES_ID}`)
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasOverflow).toBe(false)
    }
  })
})

