# CRM Config Checklist

Next.js 16 + Prisma + Supabase app for managing CRM configuration checklists.

## Getting Started

Install dependencies, configure env vars, then run:

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Environment Variables

Core app:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `ADMIN_SECRET`

Google admin sign-in:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Owner notifications:

- `APP_BASE_URL`
- `BREVO_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

Optional external cron:

- `CRON_SECRET`

`NOTIFICATION_FROM_EMAIL` must be a verified Brevo sender, for example an address under `updates.se-talkpush.com`.

## Owner Notifications

Each checklist can optionally define an `ownerEmail`. When present:

- file uploads send an immediate email
- regular edits are debounced per tab and flush after 5 minutes of inactivity
- digests are rate-limited to at most 1 email per tab per hour
- dispatch is self-triggered by successful checklist saves and uploads, so no Vercel cron is required

To disable notifications for a checklist, clear the `ownerEmail` field.

## Known Edge Case

The self-dispatch model only sweeps when some save or upload occurs. If the very last edit in the entire system is never followed by another write, that final digest may remain unsent.

If that becomes a problem, point an external cron at:

```text
GET /api/cron/notifications
Authorization: Bearer <CRON_SECRET>
```

Run it every 5 minutes from any external scheduler such as GitHub Actions or cron-job.org.

## Cron Endpoint

`/api/cron/notifications` runs the same notification sweep used by the self-dispatch path and returns a JSON summary of:

- `scanned`
- `sent`
- `failed`
- `skippedRateLimited`
- `skippedVersionConflict`
