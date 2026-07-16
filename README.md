# Thai Sport Membership Commission Tracker

Local-first commission tracking for Thai Sport Bodyworks. This version uses Next.js App Router, TypeScript, Prisma, SQLite, local login access, administrator-managed users/staff, seed data, and deterministic commission tests. It does not integrate with Zenoti or any external service.

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

- Administrator: manage user access, commissionable staff, commission settings, and editable CRM step templates from collapsed panels that open and close individually.
- Add First Time Client: collect contact/session/client details, therapist, interest level, closer assignments, and who collected the membership conversation. Validation errors beep, highlight the rejected field, and keep entered data in place for correction.
- Create opportunity: saves the client and opportunity, then returns to Dashboard with a success message.
- Sold Membership: saves the client and opportunity, records a same-day pending membership sale, assigns the first-visit commission credit, then returns to Dashboard with a success message.
- Dashboard: shows `Leaderboard` plus the current date and estimates commissions for all active staff using pending and approved sales.
- Opportunities: administrators see filterable open Hot/Warm opportunities; other users see only open Hot/Warm opportunities tied to their matching commissionable staff record. Next Action is currently `Personal SMS` with Hot due first-visit +1 day and Warm due first-visit +2 days.
- Sales and commissions: managers and administrators can review all records; front desk users see only their own sales and commissions. Pending sales do not count until an administrator approves them.
- Opportunity detail: client information includes collection notes, and a Next Action panel provides the due date, a large editable SMS copy window, copy button with clipboard fallback, and Task Completed workflow.

## Database

SQLite is stored at `prisma/dev.db` when `DATABASE_URL="file:./dev.db"`.

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
