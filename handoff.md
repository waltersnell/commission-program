# Handoff

Last updated: 2026-08-11

## Current State

The app is a local Next.js/TypeScript/Prisma SQLite commission tracker for Thai Sport Bodyworks. It has login protection, local user management, administrator-managed commissionable staff, first-time client intake, opportunities, membership sales, commission summaries, and month-end flows.

Latest in-progress flow: Hallmark-guided UI improvements for front desk speed and responsive technical use.

- Installed and used the Hallmark skill from `nutlope/hallmark`.
- Added durable design system files: `design.md`, `tokens.css`, `.hallmark/preflight.json`, and `.hallmark/log.json`.
- Audience/tone/use-case decisions: front desk is primary, adding first-time clients is the fastest workflow, tone is technical/operational, and desktop/iPad/mobile must all work well.
- Menu structure and route labels are intentionally unchanged.
- Login now shows a read-only `Top 5 Leaderboard for <current month>` preview before sign-in, provides a visible `Forgot password?` recovery link, and preserves the entered username when a failed sign-in redirects to recovery.
- App shell now uses the Hallmark token system, local Geist font files from the installed Next package, active nav styling, mobile hamburger navigation at 768 px or less, no `TS` mark, and consistent focus/button/input states. The mobile nav uses explicit `768px/769px` CSS breakpoints so the full desktop menu is forced off on mobile.
- Mobile header now puts the hamburger on the right side of the app name, with user information and logout on the row below.
- The UI palette is now light blue-grey instead of the earlier green-leaning paper/accent colors.
- Administration panel headers and CRM step headers use a dedicated touch-friendly trigger so mobile taps open editing panels reliably.
- Dashboard uses the same Workbench app rhythm with compact metric cards, tokenized surfaces, thicker panel outlines, more panel spacing, `Dashboard` as the page title, Recent Activity above Estimated Commissions, and Estimated Commissions sorted by Front Desk/Sales highest commission then Therapists highest commission.
- Add First Time Client now focuses the first field and keeps the Create opportunity / Sold Membership action bar sticky for faster entry.
- Opportunity list highlight colors are tokenized; opportunity detail now shows clear success messages for completed tasks, recorded sales, and closed opportunities.
- Sales, Commissions, Month-End, Admin, and Forgot Password share the updated page shell/card rhythm.
- Timezone fix: business "today/current month" and displayed timestamps are now explicit `America/Los_Angeles`; date-only database fields remain stable calendar dates so existing production rows do not shift backward.
- Docker and Compose set `TZ=America/Los_Angeles` as a backup, but the app code no longer depends on the container timezone for business dates.
- Month-End Review now shows pending approvals both as individual sales and as a `Pending Sales by Staff` summary. The staff summary uses credited split rows, so a 70/30 pending membership appears for both credited staff while preserving each person's pending credit amount.

Previous implemented flow: Dashboard and opportunity workflow updates for the active month.

- Dashboard title previously showed `Leaderboard` followed by the current date; the Hallmark UI pass changed the page title to `Dashboard` and moved the date into supporting copy.
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
- Docker support is staged with `Dockerfile`, `.dockerignore`, and `docker-compose.yml`; the image generates Prisma Client in the final runtime stage, then the container runs `prisma migrate deploy` before `next start` and uses `/app/data/prod.db` for persistent SQLite.
- GitHub Container Registry support is staged with `.github/workflows/docker-image.yml`; pushes to `main` build and publish `ghcr.io/waltersnell/commission-program:latest`.
- VPS source deploy hit `@prisma/client did not initialize yet` on login because the final Docker runtime stage installed dependencies fresh without generating Prisma Client. `Dockerfile` now runs `npx prisma generate` after copying the Prisma schema into the runner stage.
- Managers see the operating menu plus Month-End, but not Admin. Month-End is read-only for pending approval actions when viewed by a manager; administrator approval buttons remain administrator-only.
- Opportunities now show non-admin users `My Opportunities` followed by `All Other Opportunities`. Both sections link to opportunity detail, where authenticated users can edit primary and secondary closer assignments while the opportunity is still open and unsold.
- The active navigation state is driven by the Next 16 `proxy.ts` pathname header and shared `src/lib/navigation.ts` helpers, so nested routes highlight their parent menu item.
- Desktop and mobile active navigation now use `usePathname()` in client navigation components, preventing the blue highlight from remaining on Dashboard after client-side route changes.
- Closer selectors now use only active Front Desk, Manager, and Administrator assignments. An active privileged login user can keep a matching existing staff record selectable even if the old staff row has a legacy role such as Therapist.
- Administration now has a Client Lookup panel directly above Audit History. It uses the Open Opportunities name/phone, location, and closer filters, links each result to a full editor, and provides audited update and confirmed deletion actions for the client, opportunity, follow-ups, sale, and sale credits.
- Dashboard monthly sales totals, pending approvals, location totals, and leaderboard estimates use the active month and include approved plus pending membership sales; Commission Progress remains approved-only. Rejected sales remain excluded from commission calculations.
- Membership Sales now shows each client's total credit units summed across all credit rows, regardless of approval state.
- Non-admin Opportunities no longer paginate the `My Opportunities` or `All Other Opportunities` sections, so all matching open Hot/Warm records are listed.
- Dashboard Estimated Commissions now stacks below the location panel until wide desktop and uses a compact fixed-layout table so iPad users do not need horizontal scrolling.
- Administration now uses four responsive, URL-backed submenus: Users, Commission Settings, Other Settings, and Client Search. Each submenu shows only its related panels, keeps those panels expanded, and remains selected across client lookup links and admin action redirects.
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
- `design.md`
- `tokens.css`
- `.hallmark/preflight.json`
- `.hallmark/log.json`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/clients/new/page.tsx`
- `src/app/clients/new/new-client-form.tsx`
- `src/app/opportunities/page.tsx`
- `src/app/opportunities/[id]/page.tsx`
- `src/app/opportunities/[id]/next-action-card.tsx`
- `src/app/sales/page.tsx`
- `src/app/commissions/page.tsx`
- `src/app/month-end/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/page.tsx`
- `src/app/admin/admin-panel.tsx`
- `src/app/admin/client-record-editor.tsx`
- `src/app/admin/delete-client-record-button.tsx`
- `src/app/desktop-nav.tsx`
- `src/lib/current-staff.ts`
- `src/lib/data.ts`
- `src/lib/roles.ts`
- `src/lib/validation.ts`
- `tests/commission.test.ts`
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

Latest UI verification on 2026-07-29:

```bash
npm run lint
npm test
npm run build
```

Additional smoke checks against the running dev server confirmed:

- `/login` renders `Thai Sport Commissions`, `Sign in`, `Top 5 Leaderboard for July 2026`, and five ranked rows before authentication.
- `/clients/new` still redirects unauthenticated users to `/login`.
- Dev server started at `http://localhost:3000`; LAN IP during verification was `192.168.1.87`.
- Source verification confirmed mobile navigation switches at `<= 768px`, menu items render vertically, and admin/CRM panel triggers use touch-friendly buttons.

Latest timezone verification on 2026-08-01:

```bash
npm test
npm run lint
npm run build
```

- Tests cover Pacific "today" when UTC has rolled to the next day, stable date-only storage, month ranges, Pacific timestamp display, and Month-End pending sales summarized by credited staff.

Smoke checks against the running dev server confirmed:

- `/clients/new` redirects unauthenticated users to `/login`.
- Authenticated Add First Time Client HTML includes `Create opportunity`, `Sold Membership`, `Prospect - Partner`, and `Prospect - Other`.
- Authenticated Dashboard HTML displays the `Good Job` message.

## Known Issues

- Playwright is not installed in this checkout, so visual checks used server-rendered HTML and source inspection rather than browser automation.
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
- Review the Hallmark UI changes on desktop, iPad, and mobile before any production deploy.
- Decide whether Sold Membership should always award full first-visit credit immediately, even when support closer is selected, or keep split approval.
- Push the GitHub Actions workflow to `main`, then confirm the Docker image publishes in GitHub Actions and Packages.
