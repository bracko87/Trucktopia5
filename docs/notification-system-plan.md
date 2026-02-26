# Notification System Plan

This document defines **what should become a notification** and how to treat it in UI.

## UX model

- Bell icon in header = unread counter.
- Clicking bell opens `/notifications` page.
- Notifications page has two tabs:
  - Unread
  - Read
- Notification labels:
  - `Admin` (blue badge, `type` starts with `ADMIN`)
  - `Game` (amber badge, all other types)

## Where to define notification rules

Use a single source of truth in the database:

1. **DB functions/triggers/cron jobs** are responsible for creating rows in `public.notifications`.
2. Frontend only reads and marks read/unread.
3. Each producer inserts with a stable `type` and clear `message`.

Recommended places:

- `supabase/functions/*` for event-based inserts (hire, salary updates, etc.)
- scheduled SQL function for time-based alerts (insurance expiry, loan due, contract expiry)
- admin panel endpoint for `ADMIN_*` announcements

## What should create notifications

Use notifications for events that are:

1. Actionable (player should react soon), or
2. Financially important (money/risk impact), or
3. Status-complete transitions (job, hire, training, repair finished), or
4. Platform announcements from admin.

Do **not** notify for routine background updates already visible on the active screen.

## Suggested type catalog

### Admin

- `ADMIN_ANNOUNCEMENT` — general game/admin message
- `ADMIN_MAINTENANCE` — maintenance window / downtime
- `ADMIN_COMPENSATION` — compensation or correction

### Gameplay

- `INSURANCE_EXPIRY` — keep existing function
- `JOB_DEADLINE_SOON`
- `JOB_FAILED`
- `JOB_COMPLETED`
- `TRUCK_MAINTENANCE_DUE`
- `TRUCK_REPAIR_FINISHED`
- `STAFF_TRAINING_COMPLETE`
- `STAFF_CONTRACT_EXPIRING`
- `LOAN_PAYMENT_DUE`
- `LOW_BALANCE_ALERT`

## Existing table usage

Current `public.notifications` table is suitable for V1.

Optional V2 additions (later):

- `title text`
- `metadata jsonb`
- `priority smallint`
- `channel text default 'in_app'`

These are not required for the first rollout.