# Handoff

Last updated: 2026-07-24

## Current State

The app is a local Next.js/TypeScript/Prisma SQLite commission tracker for Thai Sport Bodyworks. It has login protection, local user management, administrator-managed commissionable staff, first-time client intake, opportunities, membership sales, commission summaries, and month-end flows.

Latest in-progress flow: Dashboard and opportunity workflow updates for the active month.

- Dashboard title now shows `Leaderboard` followed by the current date.
- Dashboard Estimated Commissions lists all active staff and estimates commissions from both pending and approved sales.
- Add First Time Client captures `Collected By` and saves an intake submit timestamp on the opportunity.
- Open Opportunities defaults to open records sorted by newest first-visit date.
- Open Opportunities only shows Hot and Warm opportunities; Cold, None, and sold opportunities are hidden.
- Next Action is guide-driven display text instead of a dropdown: Hot and Warm currently show `Personal SMS`, with due dates at first-visit +1 day and +2 days respectively. Late due dates turn orange.
- Opportunity detail shows a Next Action panel above Membership Sale with an editable SmartCare FAQ SMS, Copy SMS, and Task Completed. Completing Hot `Personal SMS` advances the opportunity to `Phone Outreach` due first-visit +3 days.
- Opportunity detail SMS editor is enlarged and Copy SMS now uses `navigator.clipboard` with a textarea selection fallback for normal paste.
- Client Information on opportunity detail includes collection notes and no longer repeats Next Action.
- Add First Time Client validation now uses client-side checks plus `useActionState` server errors so rejected fields beep, show inline errors, and do not clear entered data.
- Administration includes editable CRM Step templates for Initial Text Message, Final Text Message, Initial Email, Final Email, and Initial Voice Script. Each template opens for editing only after tapping that action.
- Administration sections are collapsed by default and each panel opens/closes independently from its title row.
- Docker support is staged with `Dockerfile`, `.dockerignore`, and `docker-compose.yml`; the container runs `prisma migrate deploy` before `next start` and uses `/app/data/prod.db` for persistent SQLite.
- GitHub Container Registry support is staged with `.github/workflows/docker-image.yml`; pushes to `main` build and publish `ghcr.io/waltersnell/commission-program:latest`.
- Month-End and Admin are administrator-only in navigation and direct page access.
- New membership sales start as `PENDING`; administrator approval is required before they count toward commissions.
- Non-manager sales and commission views are limited to the logged-in user's matching staff record.

Previous implemented flow: Add First Time Client has two submit paths.

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
- `src/app/admin/admin-panel.tsx`
- `src/app/admin/crm-steps-editor.tsx`
- `src/app/clients/new/new-client-form.tsx`
- `src/app/opportunities/[id]/next-action-card.tsx`
- `src/lib/client-form-state.ts`
- `src/lib/crm-steps.ts`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `.github/workflows/docker-image.yml`
- `src/lib/session-options.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260716133000_add_crm_step_templates/migration.sql`
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
- Current LAN URL may change when the network changes; re-check with `ipconfig getifaddr en0`.
- Repository now has the initial commit `ca1ca70 Initial commission tracker state`; working tree was clean after verification on 2026-07-14.

## Useful Commands

```bash
npm run dev -- --hostname 0.0.0.0
npm test
npm run lint
npm run build
npx prisma migrate dev
npm run db:seed
docker compose up --build
docker compose run --rm commission-program npm run docker:seed
docker pull ghcr.io/waltersnell/commission-program:latest
```

## Next Steps

- Manually test the full Add First Time Client flow on the target device.
- Decide whether Sold Membership should always award full first-visit credit immediately, even when support closer is selected, or keep split approval.
- Push the GitHub Actions workflow to `main`, then confirm the Docker image publishes in GitHub Actions and Packages.
