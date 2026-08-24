/**
 * E2E tests for the Session Description rich-text field on the session
 * detail page (specs/003-session-description).
 *
 * ── Auth strategy ────────────────────────────────────────────────────────────
 * Same next-auth v4 session-token cookie injection approach as
 * `series-details.spec.ts` / `session-registration-link.spec.ts`.
 *
 * ── Backend mocking strategy ─────────────────────────────────────────────────
 * The session detail page (`/sessions/[id]`) is fully client-rendered
 * ('use client'), so every backend call happens as a browser fetch that
 * `page.route()` can intercept directly (unlike the series detail page's
 * initial server-side fetch -- see series-export.spec.ts for that
 * distinction).
 *
 * ── Owner-only access model (research.md Decision 4, mirrored from
 * specs/001-series-details) ──
 * The backend's GET/PUT /api/v1/sessions/{id} endpoints are owner-scoped
 * only: there is no distinct "viewer" (non-owner) role today, so every
 * request that can load this page also has edit rights.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

// ── Constants ─────────────────────────────────────────────────────────────────

const NEXTAUTH_SECRET = 'NFB3bPhTe11U9QEm+GQ72rjQ63e2Zhkn0dsC4lsWvq8='
const SERIES_ID = 'e2e-test-series-for-description-001'
const SESSION_ID = 'e2e-test-session-description-001'
const SESSION_ID_B = 'e2e-test-session-description-002'

// A single very long paragraph, comfortably long enough to overflow the
// component's bounded collapsed height regardless of exact container width.
const LONG_DESCRIPTION_TEXT = Array.from(
  { length: 40 },
  (_, i) => `This is sentence number ${i + 1} describing what attendees can expect in this session.`,
).join(' ')
const LONG_DESCRIPTION_HTML = `<p>${LONG_DESCRIPTION_TEXT}</p>`

// ── Mock fixtures ─────────────────────────────────────────────────────────────

function buildMockSession(
  sessionId: string,
  description: string | null,
  overrides: Partial<{ title: string; registrationUrl: string | null }> = {},
) {
  return {
    sessionId,
    seriesId: SERIES_ID,
    title: overrides.title ?? 'E2E Description Test Session',
    startsAt: '2026-09-01T17:00:00.000Z',
    endsAt: '2026-09-01T18:00:00.000Z',
    registrationUrl: overrides.registrationUrl ?? null,
    description,
  }
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
  sessionId?: string
  initialDescription: string | null
  /** Override the PUT response status/body for a specific test (save-failure, validation). */
  putResponse?: { status: number; json?: unknown }
  /** Delay (ms) before fulfilling PUT, to observe an in-flight saving state. */
  putDelayMs?: number
}

async function stubSessionRoutes(page: Page, options: StubOptions) {
  const sessionId = options.sessionId ?? SESSION_ID
  let currentDescription = options.initialDescription

  await page.route(`**/api/v1/sessions/${sessionId}`, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, json: buildMockSession(sessionId, currentDescription) })
      return
    }
    if (method === 'PUT') {
      if (options.putDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.putDelayMs))
      }
      if (options.putResponse) {
        await route.fulfill({
          status: options.putResponse.status,
          json: options.putResponse.json ?? {
            errorCode: 'validation_error',
            message: 'Save failed',
            correlationId: 'test-correlation-id',
          },
        })
        return
      }
      const body = route.request().postDataJSON() as { title: string; description?: string | null }
      // Mirror the server's plain-text normalization (data-model.md rule 3):
      // markup-only content with no decoded text (e.g. a lone "<p><br></p>"
      // left behind by clearing a contentEditable region) saves as null.
      const rawDescription = body.description ?? null
      const plainText = rawDescription ? rawDescription.replace(/<[^>]*>/g, '').trim() : ''
      currentDescription = plainText.length > 0 ? rawDescription : null
      await route.fulfill({
        status: 200,
        json: buildMockSession(sessionId, currentDescription, { title: body.title }),
      })
      return
    }
    await route.continue()
  })

  await page.route(`**/api/v1/sessions/${sessionId}/metrics`, (route) =>
    route.fulfill({ status: 404 }),
  )
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('Session detail page — Session Description field', () => {
  test.beforeEach(async ({ context }) => {
    await injectSessionCookie(context)
  })

  // ── User Story 2: empty/null description ──────────────────────────────────

  test('shows an "Add description" affordance when no description is saved', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: null })
    await page.goto(`/sessions/${SESSION_ID}`)

    await expect(page.getByRole('button', { name: 'Add description' })).toBeVisible()
  })

  test('a legacy session with a null description remains coherent and usable', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: null })
    await page.goto(`/sessions/${SESSION_ID}`)

    // No required-description warning, and the rest of the page (schedule,
    // registration, Save/Cancel) remains present and usable (FR-005, SC-002).
    await expect(page.getByText(/description is required/i)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  // ── User Story 1: view formatted/populated description ─────────────────────

  test('typing and formatting content, then saving, persists and re-renders read-only content', async ({
    page,
  }) => {
    await stubSessionRoutes(page, { initialDescription: null })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Add description' }).click()

    const editor = page.getByRole('textbox', { name: 'Session description' })
    await expect(editor).toBeVisible()
    await editor.click()
    await page.keyboard.type('Important session agenda')

    await page.keyboard.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Bold' }).click()

    await page.getByRole('button', { name: 'Save description' }).click()

    await expect(page.getByRole('textbox', { name: 'Session description' })).toHaveCount(0)
    await expect(page.getByText('Important session agenda')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit session description' })).toBeVisible()
  })

  test('reloading the page preserves previously saved description', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: '<p><strong>Persisted</strong> description</p>' })
    await page.goto(`/sessions/${SESSION_ID}`)

    await expect(page.getByText('Persisted description')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add description' })).toHaveCount(0)

    await page.reload()

    await expect(page.getByText('Persisted description')).toBeVisible()
  })

  test('two different sessions never display one another\'s description', async ({ page }) => {
    await stubSessionRoutes(page, {
      sessionId: SESSION_ID,
      initialDescription: '<p>Session A description</p>',
    })
    await stubSessionRoutes(page, {
      sessionId: SESSION_ID_B,
      initialDescription: '<p>Session B description</p>',
    })

    await page.goto(`/sessions/${SESSION_ID}`)
    await expect(page.getByText('Session A description')).toBeVisible()
    await expect(page.getByText('Session B description')).toHaveCount(0)

    await page.goto(`/sessions/${SESSION_ID_B}`)
    await expect(page.getByText('Session B description')).toBeVisible()
    await expect(page.getByText('Session A description')).toHaveCount(0)
  })

  // ── User Story 3: edit/save/cancel/clear lifecycle ──────────────────────────

  test('canceling an edit discards draft changes and keeps the prior saved value', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: '<p>Original description</p>' })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Edit session description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Discarded draft')

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('textbox', { name: 'Session description' })).toHaveCount(0)
    await expect(page.getByText('Original description')).toBeVisible()
    await expect(page.getByText('Discarded draft')).toHaveCount(0)
  })

  test('editing existing description and saving replaces the read-only content', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: '<p>Original description</p>' })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Edit session description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Updated description content')

    await page.getByRole('button', { name: 'Save description' }).click()

    await expect(page.getByRole('textbox', { name: 'Session description' })).toHaveCount(0)
    await expect(page.getByText('Updated description content')).toBeVisible()
    await expect(page.getByText('Original description')).toHaveCount(0)
  })

  test('clearing all content and saving returns to the empty "Add description" state', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: '<p>Original description</p>' })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Edit session description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')

    await page.getByRole('button', { name: 'Save description' }).click()

    await expect(page.getByRole('textbox', { name: 'Session description' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add description' })).toBeVisible()
    await expect(page.getByText('Original description')).toHaveCount(0)
  })

  test('shows a saving/disabled state while the description save is pending', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: null, putDelayMs: 300 })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Add description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.type('Slow save draft')

    const saveButton = page.getByRole('button', { name: 'Save description' })
    await saveButton.click()

    // The button's accessible name changes once saving (its text is replaced
    // by a spinner), so re-locate it by the always-present `aria-busy`
    // attribute rather than by its (now-stale) name.
    await expect(page.locator('button[aria-busy="true"]')).toBeVisible()
    await expect(editor).toHaveAttribute('contenteditable', 'false')
  })

  test('a save failure keeps the editor open with the draft intact and shows an error banner', async ({
    page,
  }) => {
    await stubSessionRoutes(page, {
      initialDescription: null,
      putResponse: {
        status: 500,
        json: {
          errorCode: 'internal_error',
          message: 'Failed to update session description',
          correlationId: 'test-correlation-id',
        },
      },
    })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Add description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.type('Draft that fails to save')

    await page.getByRole('button', { name: 'Save description' }).click()

    await expect(page.getByText(/Failed to update session description/)).toBeVisible()
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Draft that fails to save')
  })

  test('an over-limit save shows the validation error returned by the API', async ({ page }) => {
    await stubSessionRoutes(page, {
      initialDescription: null,
      putResponse: {
        status: 400,
        json: {
          errorCode: 'validation_error',
          message: 'Session description must not exceed 10,000 characters.',
          correlationId: 'test-correlation-id',
        },
      },
    })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Add description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.type('Some content that the stubbed API will reject as over-limit')

    await page.getByRole('button', { name: 'Save description' }).click()

    await expect(page.getByText(/10,000 characters/)).toBeVisible()
    await expect(editor).toBeVisible()
  })

  test('saving the description carries the currently loaded schedule and registration fields', async ({
    page,
  }) => {
    const captured: { putBody: Record<string, unknown> | null } = { putBody: null }

    await page.route(`**/api/v1/sessions/${SESSION_ID}`, async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          json: buildMockSession(SESSION_ID, null, {
            registrationUrl: 'https://teams.microsoft.com/registration/example',
          }),
        })
        return
      }
      if (method === 'PUT') {
        captured.putBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          json: buildMockSession(SESSION_ID, (captured.putBody?.description as string | null) ?? null, {
            registrationUrl: 'https://teams.microsoft.com/registration/example',
          }),
        })
        return
      }
      await route.continue()
    })
    await page.route(`**/api/v1/sessions/${SESSION_ID}/metrics`, (route) =>
      route.fulfill({ status: 404 }),
    )

    await page.goto(`/sessions/${SESSION_ID}`)
    await page.getByRole('button', { name: 'Add description' }).click()
    const editor = page.getByRole('textbox', { name: 'Session description' })
    await editor.click()
    await page.keyboard.type('New description')
    await page.getByRole('button', { name: 'Save description' }).click()

    await expect.poll(() => captured.putBody?.registrationUrl).toBe(
      'https://teams.microsoft.com/registration/example',
    )
    expect(captured.putBody?.title).toBe('E2E Description Test Session')
  })

  // ── User Story 1: bounded disclosure for long descriptions ─────────────────

  test('a long description is bounded by default with an accessible "Show more…" control', async ({
    page,
  }) => {
    await stubSessionRoutes(page, { initialDescription: LONG_DESCRIPTION_HTML })
    await page.goto(`/sessions/${SESSION_ID}`)

    const showMore = page.getByRole('button', { name: 'Show more… session description' })
    await expect(showMore).toBeVisible()
    await expect(showMore).toHaveAttribute('aria-expanded', 'false')

    const expandedId = await showMore.getAttribute('aria-controls')
    expect(expandedId).toBeTruthy()

    // Other session capabilities remain reachable even with a long description.
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  test('activating "Show more…" expands the description and exposes "Show less…"', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: LONG_DESCRIPTION_HTML })
    await page.goto(`/sessions/${SESSION_ID}`)

    const showMore = page.getByRole('button', { name: 'Show more… session description' })
    await showMore.focus()
    await showMore.press('Enter')

    const showLess = page.getByRole('button', { name: 'Show less… session description' })
    await expect(showLess).toBeVisible()
    await expect(showLess).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('This is sentence number 40')).toBeVisible()
  })

  test('activating "Show less…" re-collapses the description', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: LONG_DESCRIPTION_HTML })
    await page.goto(`/sessions/${SESSION_ID}`)

    await page.getByRole('button', { name: 'Show more… session description' }).click()
    const showLess = page.getByRole('button', { name: 'Show less… session description' })
    await showLess.focus()
    await showLess.press('Enter')

    await expect(page.getByRole('button', { name: 'Show more… session description' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show less… session description' })).toHaveCount(0)
  })

  test('a short description does not show a disclosure control', async ({ page }) => {
    await stubSessionRoutes(page, { initialDescription: '<p>Short description</p>' })
    await page.goto(`/sessions/${SESSION_ID}`)

    await expect(page.getByText('Short description')).toBeVisible()
    await expect(page.getByRole('button', { name: /Show more/ })).toHaveCount(0)
  })
})