# Thai Sport Membership Commission Tracker

Local-first commission tracking for Thai Sport Bodyworks. This version uses Next.js App Router, TypeScript, Prisma, SQLite, local login access, administrator-managed users/staff, seed data, deterministic commission tests, and a Hallmark-guided UI system. It does not integrate with Zenoti or any external service.

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

For LAN testing, start dev with:

```bash
npm run dev -- --hostname 0.0.0.0
```

Open the local or network URL printed by Next.js.

## Docker

Docker is set up for production-style hosting with SQLite stored in a persistent `/app/data` volume.

Build and start locally:

```bash
docker compose up --build
```

For a brand-new Docker volume, seed the initial local users once:

```bash
docker compose run --rm commission-program npm run docker:seed
docker compose up
```

The Docker image generates Prisma Client during the final runtime stage, then the container runs `prisma migrate deploy` before `next start`. Keep `DATABASE_URL="file:/app/data/prod.db"` and mount `/app/data` as persistent storage so SQLite data survives container rebuilds.

## GitHub Docker Image

GitHub Actions builds and publishes a Docker image to GitHub Container Registry whenever `main` is pushed:

```bash
ghcr.io/waltersnell/commission-program:latest
```

The workflow is defined in `.github/workflows/docker-image.yml`. It can also be started manually from the repository's Actions tab with `workflow_dispatch`.

On a Docker-ready VPS, pull and run the GitHub image with persistent SQLite storage:

```bash
docker pull ghcr.io/waltersnell/commission-program:latest
docker volume create commission-program-data
docker run -d \
  --name commission-program \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="file:/app/data/prod.db" \
  -v commission-program-data:/app/data \
  ghcr.io/waltersnell/commission-program:latest
```

For a brand-new volume, seed initial local users once:

```bash
docker run --rm \
  -e DATABASE_URL="file:/app/data/prod.db" \
  -v commission-program-data:/app/data \
  ghcr.io/waltersnell/commission-program:latest \
  npm run docker:seed
```

## Local Users

The app uses local username/password login before loading protected dashboard views.

Seeded users:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `local-admin` | Administrator |
| `manager` | `local-manager` | Manager |
| `frontdesk` | `local-frontdesk` | Front Desk |

Users can also be created, edited, and deactivated from the Administrator page. Deactivation prevents login while preserving existing records.

## Current Workflows

- Login: shows a read-only `Top 5 Leaderboard for <current month>` preview before sign-in, ranked by credited membership sales, then authenticates into the protected app.
- Administrator: manage user access, commissionable staff, commission settings, and editable CRM step templates from collapsed panels that open and close individually.
- Add First Time Client: front-desk-first intake for contact/session/client details, therapist, interest level, closer assignments, and who collected the membership conversation. The screen uses one `Name` field, then stores it in the existing first-name/last-name database columns so existing production data remains compatible. Primary Closer is limited to Front Desk, Manager, and matching Administrator staff records; Secondary Closer keeps the full active staff list. The first field receives focus, action buttons stay close at hand, validation errors beep, highlight the rejected field, and keep entered data in place for correction.
- Create opportunity: saves the client and opportunity, then returns to Dashboard with a success message.
- Sold Membership: saves the client and opportunity, records a same-day pending membership sale, assigns the first-visit commission credit, then returns to Dashboard with a success message.
- Dashboard: shows active-month metrics, Recent Activity, and Estimated Commissions for all active staff using pending and approved sales. Estimated Commissions sorts Front Desk and Sales staff by highest commission first, then Therapists by highest commission. Sales by Location shows both total sold and approved sold progression.
- Opportunities: administrators see filterable open Hot/Warm opportunities; other users see only open Hot/Warm opportunities tied to their matching commissionable staff record. Next Action is currently `Personal SMS` with Hot due first-visit +1 day and Warm due first-visit +2 days.
- Sales and commissions: managers and administrators can review all records; front desk users see only their own sales and commissions. Commission Progress estimates pending plus approved sales; final Month-End commission results still use approved sales only.
- Month-End Review: administrators see pending approvals both as individual sales and as a staff summary, so split pending memberships are visible by credited staff before approval. Final Totals still include approved sales only.
- Opportunity detail: client information includes collection notes, and a Next Action panel provides the due date, a large editable SMS copy window, copy button with clipboard fallback, and Task Completed workflow.

## Design System

The app uses a Hallmark-guided design system recorded in `design.md` and `tokens.css`.

- Preserve the existing menu structure and route labels unless the user explicitly asks for navigation changes.
- Primary audience is front desk; keep Add First Time Client fast on desktop, iPad, and mobile.
- Mobile navigation uses a hamburger menu at 768 px or less while desktop keeps the full menu visible.
- Mobile header layout keeps the hamburger on the right side of the app name, with user information and logout below it.
- Tone is technical and operational. Avoid marketing-page heroes, decorative imagery, fake device/browser chrome, and one-off raw color values.
- Shared colors, font roles, spacing, radii, and motion tokens live in `tokens.css`; `src/app/globals.css` imports those tokens and maps them into the app’s existing class names. The current palette is light blue-grey, not green.

## Database

SQLite is stored at `prisma/dev.db` when `DATABASE_URL="file:./dev.db"`.

In Docker, SQLite is stored at `/app/data/prod.db` by default. The `docker-compose.yml` file mounts this path as the named volume `commission-program-data`.

Business dates use the `America/Los_Angeles` calendar. Date-only fields such as first visits and membership sale dates are stored as stable calendar dates, while displayed timestamps and default "today/current month" values are formatted for Pacific time. Docker sets `TZ=America/Los_Angeles` as an additional safeguard.

Reset and reseed:

```bash
npm run db:reset
```

Seed only:

```bash
npm run db:seed
```

## Tests

```bash
npm test
```

The test suite covers progressive commission tiers, fractional split credits, first-visit bonuses, validation, open/invalid/pending exclusions, finalized-month edit rules, and recalculation idempotency.

## Future Integration Notes

Future phases may import first-time client and membership data from Zenoti. This version keeps all data local and avoids placeholder APIs that would need to be removed later.
