# Handoff

Last updated: 2026-07-14

## Current State

The app is a local Next.js/TypeScript/Prisma SQLite commission tracker for Thai Sport Bodyworks. It has login protection, local user management, administrator-managed commissionable staff, first-time client intake, opportunities, membership sales, commission summaries, and month-end flows.

Latest implemented flow: Add First Time Client now has two submit paths.

- `Create opportunity` creates the client/opportunity, shows `Opportunity is created`, and returns to Dashboard.
- `Sold Membership` creates the client/opportunity, records a same-day membership sale, applies the existing first-visit $10 commission credit, shows `Good Job`, and returns to Dashboard.
- Client Type options include `Resident`, `Long Term Visitor`, `Tourist`, `Prospect - Partner`, and `Prospect - Other`.

## Recent Decisions

- Sold Membership uses active `Individual Membership` when available, otherwise the first active membership type.
- If a support closer is selected on Sold Membership, the existing split-approval path remains in effect.
- Dashboard reads `?message=` and displays a success message banner.
- `next.config.ts` allows dev origin `10.0.0.20` for LAN preview.

## Files Changed Recently

- `src/app/actions.ts`
- `src/app/page.tsx`
- `src/app/clients/new/new-client-form.tsx`
- `src/lib/session-options.ts`
- `next.config.ts`
- `README.md`
- `AGENTS.md`
- `handoff.md`

## Verification

Commands run successfully:

```bash
npm test
npm run lint
npm run build
```

The production build needs to run outside the sandbox because Turbopack binds a local port during CSS processing.

Smoke checks against the running dev server confirmed:

- `/clients/new` redirects unauthenticated users to `/login`.
- Authenticated Add First Time Client HTML includes `Create opportunity`, `Sold Membership`, `Prospect - Partner`, and `Prospect - Other`.
- Authenticated Dashboard HTML displays the `Good Job` message.

## Known Issues

- Playwright package exists in dependencies, but the browser binary is not installed, so browser automation could not run.
- Git repository has no commits yet, and most project files are untracked.
- Current LAN URL may change when the network changes; re-check with `ipconfig getifaddr en0`.

## Useful Commands

```bash
npm run dev -- --hostname 0.0.0.0
npm test
npm run lint
npm run build
npx prisma migrate dev
npm run db:seed
```

## Next Steps

- Manually test the full Add First Time Client flow on the target device.
- Decide whether Sold Membership should always award full first-visit credit immediately, even when support closer is selected, or keep split approval.
- Make an initial git commit once the current untracked project state is acceptable.
