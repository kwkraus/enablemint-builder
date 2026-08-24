# Session Description UI Contract

The authenticated session detail route `src/frontend/app/sessions/[id]/page.tsx` renders a
`Session Description` section before schedule/registration content.

## States

- **Empty:** Show a keyboard-accessible “Add description” affordance; do not show placeholder copy as
  saved content.
- **Read-only populated:** Render server-sanitized supported formatting without
  `dangerouslySetInnerHTML`. Long content is bounded/collapsed by default.
- **Collapsed long content:** Show an accessible button named “Show more… session description” with
  `aria-expanded="false"` and `aria-controls` referencing the labeled content region.
- **Expanded long content:** Show “Show less… session description” with `aria-expanded="true`;
  activating it restores the bounded collapsed state.
- **Edit:** Reuse the series editor controls and save/cancel behavior with session-specific labels.
- **Save failure:** Keep the draft in edit mode and show the existing error banner.

All controls must be keyboard-operable, have visible focus, clear accessible names, and expose
explicit saving/disabled states. Description save is carried by the existing full session PUT and
must include the current description when schedule fields are saved.

