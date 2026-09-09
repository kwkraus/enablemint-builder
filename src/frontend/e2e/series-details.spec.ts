/**
 * E2E tests for the Series Details rich-text field on the series detail page
 * (specs/001-series-details).
 *
 * ── Auth strategy ────────────────────────────────────────────────────────────
 * See e2e/series-export.spec.ts for the full explanation. In short: a valid
 * next-auth v4 session token is injected as a cookie so the server component
 * does not redirect to /login, and all *browser-side* fetch calls are stubbed
 * via page.route(). Server-side (Node) fetches made by the App Router page
 * component itself are NOT interceptable by Playwright and require a live or
 * stubbed backend reachable at BACKEND_API_BASE_URL for full end-to-end runs.
 *
 * ── Owner-only access model (specs/001-series-details/research.md Decision 4) ──
 * The backend's GET/PUT /api/v1/series/{id} endpoints are owner-scoped only:
 * there is no distinct "viewer" (non-owner) role today, so every request that
 * can load this page also has edit rights. The two truly viewer-only UI
 * assertions from contracts/series-details-ui.md ("Read-only user") cannot be
 * authentically exercised without a real non-owner identity/route, and are
 * marked test.fixme() below with a comment pointing at this gap rather than
 * silently skipped or faked.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

// ── Constants ─────────────────────────────────────────────────────────────────

const NEXTAUTH_SECRET = 'NFB3bPhTe11U9QEm+GQ72rjQ63e2Zhkn0dsC4lsWvq8='
const SERIES_ID = 'e2e-test-series-details-001'

// ── Mock fixtures ─────────────────────────────────────────────────────────────

function buildMockSeries(details: string | null) {
  return {
    seriesId: SERIES_ID,
    title: 'E2E Details Test Webinar Series',
    status: 'Draft',
    publishedSessionCount: 0,
    details,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-02T10:00:00.000Z',
    isPublic: true,
    imageUrl: null,
  }
}

const MOCK_METRICS = {
  seriesId: SERIES_ID,
  totalRegistrations: 0,
  totalAttendees: 0,
  uniqueRegistrantAccountDomains: 0,
  uniqueAccountsInfluenced: 0,
  warmAccounts: [],
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function injectSessionCookie(context: BrowserContext): Promise<void> {
  const sessionToken = await encode({
    token: {
      name: 'E2E Test User',
      email: 'e2e-test@example.com',
      sub: 'e2e-test-user-id',
      accessToken: 'e2e-test-access-token',
    },
    secret: NEXTAUTH_SECRET,
  })

  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

// ── Route stubbing helper ────────────────────────────────────────────────────

interface StubOptions {
  initialDetails: string | null
  /** Override the PUT response status/body for a specific test (save-failure, validation). */
  putResponse?: { status: number; json?: unknown }
}

async function stubSeriesRoutes(page: Page, options: StubOptions) {
  let currentDetails = options.initialDetails

  await page.route(`**/api/v1/series/${SERIES_ID}`, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, json: buildMockSeries(currentDetails) })
      return
    }
    if (method === 'PUT') {
      if (options.putResponse) {
        await route.fulfill({
          status: options.putResponse.status,
          json: options.putResponse.json ?? { errorCode: 'validation_error', message: 'Save failed', correlationId: 'test-correlation-id' },
        })
        return
      }
      const body = route.request().postDataJSON() as { title: string; details?: string | null }
      currentDetails = body.details ?? null
      await route.fulfill({ status: 200, json: buildMockSeries(currentDetails) })
      return
    }
    await route.continue()
  })

  await page.route(`**/api/v1/series/${SERIES_ID}/sessions`, async (route) => {
    await route.fulfill({ status: 200, json: [] })
  })

  await page.route(`**/api/v1/series/${SERIES_ID}/metrics`, async (route) => {
    await route.fulfill({ status: 200, json: MOCK_METRICS })
  })
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('Series detail page — Series Details field', () => {
  test.beforeEach(async ({ context }) => {
    await injectSessionCookie(context)
  })

  test('shows an "Add details" affordance when no details are saved', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: null })
    await page.goto(`/series/${SERIES_ID}`)

    await expect(page.getByRole('button', { name: 'Add details' })).toBeVisible()
  })

  test('typing and formatting content, then saving, persists and re-renders read-only content', async ({
    page,
  }) => {
    await stubSeriesRoutes(page, { initialDetails: null })
    await page.goto(`/series/${SERIES_ID}`)

    await page.getByRole('button', { name: 'Add details' }).click()

    const editor = page.getByRole('textbox', { name: 'Series details' })
    await expect(editor).toBeVisible()
    await editor.click()
    await page.keyboard.type('Important agenda item')

    // Select all typed text, then apply bold via the toolbar (mousedown-based
    // so the editor selection survives the click).
    await page.keyboard.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Bold' }).click()

    await page.getByRole('button', { name: 'Save details' }).click()

    // After save, the editor closes and the sanitized read-only content shows.
    await expect(page.getByRole('textbox', { name: 'Series details' })).toHaveCount(0)
    await expect(page.getByText('Important agenda item')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit series details' })).toBeVisible()
  })

  test('reloading the page preserves previously saved details', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: '<p><strong>Persisted</strong> details</p>' })
    await page.goto(`/series/${SERIES_ID}`)

    await expect(page.getByText('Persisted details')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add details' })).toHaveCount(0)

    await page.reload()

    await expect(page.getByText('Persisted details')).toBeVisible()
  })

  test('canceling an edit discards draft changes and keeps the prior saved value', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: '<p>Original details</p>' })
    await page.goto(`/series/${SERIES_ID}`)

    await page.getByRole('button', { name: 'Edit series details' }).click()
    const editor = page.getByRole('textbox', { name: 'Series details' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Discarded draft')

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('textbox', { name: 'Series details' })).toHaveCount(0)
    await expect(page.getByText('Original details')).toBeVisible()
    await expect(page.getByText('Discarded draft')).toHaveCount(0)
  })

  test('editing existing details and saving replaces the read-only content', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: '<p>Original details</p>' })
    await page.goto(`/series/${SERIES_ID}`)

    await page.getByRole('button', { name: 'Edit series details' }).click()
    const editor = page.getByRole('textbox', { name: 'Series details' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Updated details content')

    await page.getByRole('button', { name: 'Save details' }).click()

    await expect(page.getByRole('textbox', { name: 'Series details' })).toHaveCount(0)
    await expect(page.getByText('Updated details content')).toBeVisible()
    await expect(page.getByText('Original details')).toHaveCount(0)
  })

  test('clearing all content and saving returns to the empty "Add details" state', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: '<p>Original details</p>' })
    await page.goto(`/series/${SERIES_ID}`)

    await page.getByRole('button', { name: 'Edit series details' }).click()
    const editor = page.getByRole('textbox', { name: 'Series details' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')

    await page.getByRole('button', { name: 'Save details' }).click()

    await expect(page.getByRole('textbox', { name: 'Series details' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add details' })).toBeVisible()
    await expect(page.getByText('Original details')).toHaveCount(0)
  })

  test('a save failure keeps the editor open with the draft intact and shows an error banner', async ({
    page,
  }) => {
    await stubSeriesRoutes(page, {
      initialDetails: null,
      putResponse: {
        status: 500,
        json: { errorCode: 'internal_error', message: 'Failed to update series details', correlationId: 'test-correlation-id' },
      },
    })
    await page.goto(`/series/${SERIES_ID}`)

    await page.getByRole('button', { name: 'Add details' }).click()
    const editor = page.getByRole('textbox', { name: 'Series details' })
    await editor.click()
    await page.keyboard.type('Draft that fails to save')

    await page.getByRole('button', { name: 'Save details' }).click()

    await expect(page.getByText(/Failed to update series details/)).toBeVisible()
    // The editor stays open with the draft retained.
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Draft that fails to save')
  })

  test('an over-limit save shows the validation error returned by the API', async ({ page }) => {
    await stubSeriesRoutes(page, {
      initialDetails: null,
      putResponse: {
        status: 400,
        json: {
          errorCode: 'series_details_too_long',
          message: 'Series details must be 10000 characters or fewer.',
          correlationId: 'test-correlation-id',
        },
      },
    })
    await page.goto(`/series/${SERIES_ID}`)

    await page.getByRole('button', { name: 'Add details' }).click()
    const editor = page.getByRole('textbox', { name: 'Series details' })
    await editor.click()
    await page.keyboard.type('Some content that the stubbed API will reject as over-limit')

    await page.getByRole('button', { name: 'Save details' }).click()

    await expect(page.getByText(/10000 characters or fewer/)).toBeVisible()
    await expect(editor).toBeVisible()
  })

  test('keeps series metrics discoverable in an overlay instead of the main page', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: '<p>Overview</p>' })
    await page.goto(`/series/${SERIES_ID}`)

    await expect(page.getByRole('heading', { name: 'Series metrics' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open series metrics' })).toBeVisible()

    await page.getByRole('button', { name: 'Open series metrics' }).click()

    await expect(page.getByRole('dialog', { name: 'Series metrics' })).toBeVisible()
    await expect(page.getByText('Registrations')).toBeVisible()
    await expect(page.getByText('Accounts influenced')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Series metrics' })).toHaveCount(0)
  })

  test('collapses the public landing page control into one header icon with a popover', async ({ page }) => {
    await stubSeriesRoutes(page, { initialDetails: '<p>Overview</p>' })
    await page.goto(`/series/${SERIES_ID}`)

    const trigger = page.getByRole('button', { name: /^Landing page: (Public|Private)$/ })
    await expect(trigger).toHaveCount(1)

    // Nothing about the landing page is shown inline until the popover opens.
    await expect(page.getByRole('switch', { name: 'Landing page' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Open public landing page' })).toHaveCount(0)

    await trigger.click()

    await expect(page.getByRole('switch', { name: 'Landing page' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open public landing page' })).toHaveCount(1)
    await expect(page.getByText('Public landing page')).toHaveCount(0)
    await expect(page.getByText('View page')).toHaveCount(0)
  })

  // ── Read-only (non-owner) viewer scenarios ──────────────────────────────────
  //
  // These assert the "Read-only user" rules from
  // specs/001-series-details/contracts/series-details-ui.md:
  //   - Render sanitized supported formatting read-only.
  //   - Do not show an empty editor or add-details prompt when no details exist.
  //
  // Today there is no distinct non-owner "viewer" route or identity: GET/PUT
  // /api/v1/series/{id} are owner-scoped only (research.md Decision 4), so a
  // request that can load this page always has edit rights. These are marked
  // test.fixme() rather than faked, so the gap stays visible instead of being
  // silently skipped; they should be un-skipped once a real non-owner access
  // path exists to exercise `canEdit={false}` end-to-end.

  test.fixme(
    'a read-only (non-owner) viewer does not see an "Add details" prompt when no details exist',
    async () => {
      // Requires a genuine non-owner session/route; see comment above.
    },
  )

  test.fixme(
    'a read-only (non-owner) viewer does not see edit affordances for existing details',
    async () => {
      // Requires a genuine non-owner session/route; see comment above.
    },
  )
})
