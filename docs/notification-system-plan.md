# Notification System Plan

This document defines **what should become a notification**, where the decision logic should live, and how notifications should be handled in UI.

## UX model

- Bell icon in header = unread counter.
- Clicking the bell opens the notifications UI.
- Notifications UI has two tabs:
  - Unread
  - Read
- Notification labels:
  - `Admin` (blue badge, `type` starts with `ADMIN`)
  - `Game` (amber badge, all other types)

## 1) Control model (recommended)

You wanted bigger control — use a **notification type catalog** in backend as your single authority.

- Backend is the only writer to `public.notifications`.
- Producers (triggers/functions/cron/admin panel) must use only approved `type` values.
- Text templates are versioned and managed centrally.

### Control layers

1. **Catalog layer (policy):** list allowed types, severity, default template, enabled/disabled.
2. **Producer layer (events):** specific functions decide *when* to emit a type.
3. **Delivery layer (insert):** one shared DB function inserts into `public.notifications`.

This means: you can disable a type or edit text centrally without rewriting all event producers.

## 2) Where to define what is / is not a notification

Define this in backend catalog + producer functions:

- `notification_types` table (or similar) with type metadata and templates.
- producer SQL functions/triggers (e.g. insurance expiry, maintenance due, job completed).
- admin tool inserts `ADMIN_*` types through same shared function.

Frontend should only **render** and **mark read**.

## What should create notifications

Use notifications for events that are:

1. Actionable (player should react soon), or
2. Financially important (money/risk impact), or
3. Status-complete transitions (job, hire, training, repair finished), or
4. Platform announcements from admin.

Do **not** notify for routine background updates already visible on the active screen.

## 3) Suggested type catalog

### Admin

- `ADMIN_ANNOUNCEMENT`
- `ADMIN_MAINTENANCE`
- `ADMIN_COMPENSATION`

### Gameplay

- `INSURANCE_EXPIRY`
- `JOB_DEADLINE_SOON`
- `JOB_FAILED`
- `JOB_COMPLETED`
- `TRUCK_MAINTENANCE_DUE`
- `TRUCK_REPAIR_FINISHED`
- `STAFF_TRAINING_COMPLETE`
- `STAFF_CONTRACT_EXPIRING`
- `LOAN_PAYMENT_DUE`
- `LOW_BALANCE_ALERT`

## 4) Rich notifications (links/details)

Yes, this is absolutely possible and not a huge rewrite if done in phases.

### Phase A (implemented now)

- UI maps type -> default action button (e.g. Open my jobs / Open trucks / Open finances).
- Optional use of `entity_id` for focus/highlight query parameter.

### Phase B (recommended DB upgrade)

Add fields to support precise details:

- `title text`
- `metadata jsonb` (truck_id, truck_name, job_id, route, etc.)
- `action_path text` (exact link for notification)
- `action_label text`

Then each notification can have custom deep links like:

- Truck broken -> `/trucks?focus=<truck_id>`
- Job delivered -> `/my-jobs?focus=<job_id>`

## 5) Notification text management

You are correct: texts should be prepared and stored centrally.

Recommended:

- Keep canonical templates in backend catalog table (supports admin editing).
- Optionally mirror labels in frontend for friendly display names.
- Avoid hardcoding random message strings in many places.

## 6) Current table status

Current `public.notifications` table works for V1.

For V2 rich payloads, add columns listed in Phase B.