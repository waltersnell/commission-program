# Design - Thai Sport Commission Tracker

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page. Extend or amend this file when the
system needs to grow.

## Genre

modern-minimal

## Audience

Front desk is the primary audience. Managers and administrators use the same
system, but daily speed for first-time-client entry wins the hierarchy.

## Primary Use Case

Add a first-time client quickly from desktop, iPad, or mobile. Secondary tasks
are checking leaderboard progress, working open opportunities, reviewing sales,
and month-end administration.

## Tone

Technical, operational, and calm. This should feel like a clear front-desk work
surface, not a marketing page.

## Macrostructure Family

- Marketing pages: none.
- App pages: Workbench. Product UI carries the page. Use compact headers,
  dense but readable panels, tabular data, and action bars near the work.
- Content pages: Long Document only if future help/docs pages are added.

## Theme

- Blue-grey base, with no green paper background.
- `--color-paper` oklch(96.6% 0.014 248)
- `--color-paper-2` oklch(93.4% 0.018 248)
- `--color-surface` oklch(99% 0.006 248)
- `--color-surface-2` oklch(97.1% 0.011 248)
- `--color-ink` oklch(19% 0.014 255)
- `--color-ink-2` oklch(31% 0.014 255)
- `--color-muted` oklch(47% 0.016 255)
- `--color-rule` oklch(83.5% 0.018 248)
- `--color-rule-2` oklch(74.5% 0.02 248)
- `--color-accent` oklch(46% 0.105 248)
- `--color-accent-ink` oklch(97% 0.008 248)
- `--color-warn` oklch(56% 0.135 53)
- `--color-warn-ink` oklch(98% 0.01 70)
- `--color-error` oklch(52% 0.16 28)
- `--color-focus` oklch(58% 0.16 248)

## Typography

- Display: Geist, weight 700, style normal.
- Body: Geist, weight 400.
- Mono/outlier: Geist Mono, weight 500, for compact data, keyboard hints, and
  numeric counters only.
- Display tracking: 0.
- Type scale anchor: `--text-display = clamp(1.875rem, 1.35rem + 1.5vw, 3rem)`.
- Tabular numbers are required for metrics, dates, money, credits, and counts.

## Spacing

4-point named scale. The values are in `tokens.css`. Pages must use named
tokens and shared classes where possible, never new raw color values.

## Motion

- Easings: `--ease-out`, `--ease-in`, and `--ease-in-out` from `tokens.css`.
- Reveal pattern: none for content. This app should settle instantly.
- Microinteractions: button press, focus ring, panel open/close, and copy state.
- Reduced-motion fallback: opacity-only or no spatial motion, <= 150 ms.

## Microinteractions Stance

- Silent success when the result is visible.
- Error states explain the field or action that failed.
- Copy-to-clipboard changes the button/status text in place. No success toast.
- Hover is never the only affordance. Focus and touch states must exist.

## CTA Voice

- Primary CTA: filled accent button, compact rectangular radius, verb-first copy.
- Secondary CTA: bordered surface button, same height and radius.
- High-urgency CTA: warm warning fill only for true submit/sale actions.

## Per-Page Allowances

- Login may show a read-only leaderboard preview before authentication.
- Dashboard may show dense summary panels and leaderboard data.
- App pages must not use decorative hero art or fake device/browser chrome.
- Tables may stay horizontally scrollable on desktop/tablet; mobile views should
  wrap controls and preserve 44 px hit targets.

## What Pages Must Share

- Existing menu structure and route labels.
- Thai Sport Commissions wordmark.
- Blue as the restrained accent and orange as warning/action emphasis.
- Geist-based type system.
- Compact page headers, card radius, button height, table density, and focus
  treatment.
- Mobile at 768 px or less must show the hamburger on the right side of the app
  name, with user information and logout below the title row.

## What Pages May Differ On

- Metric layout and density.
- Whether the page uses a table, grid, or form-first work surface.
- Form column count by viewport.
- Admin panels may remain collapsed; each panel controls only its own content.

## Exports

### tokens.css

See `tokens.css` at the project root.
