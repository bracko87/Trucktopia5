/*
 * migrations/061_force_sync_maintenance_checks.sql
 *
 * Force-sync denormalized maintenance_checks fields with the authoritative user_trucks row.
 *
 * - Overwrites mileage_km, odometer_km, model_year, next_maintenance_km and performed_at
 *   in maintenance_checks when they differ from values in user_trucks.
 * - Idempotent and safe to run multiple times.
 * - Run this migration once on your database to fix existing inconsistent snapshots.
 */

BEGIN;

UPDATE public.maintenance_checks mc
SET
  mileage_km = ut.mileage_km,
  odometer_km = COALESCE(ut.mileage_km, mc.odometer_km),
  model_year = (
    CASE
      WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
      WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
      ELSE mc.model_year
    END
  ),
  next_maintenance_km = ut.next_maintenance_km,
  performed_at = (
    CASE
      WHEN ut.last_maintenance_at IS NOT NULL THEN (ut.last_maintenance_at::date)
      ELSE mc.performed_at
    END
  )
FROM public.user_trucks ut
WHERE mc.user_truck_id = ut.id
  AND (
    (mc.mileage_km IS DISTINCT FROM ut.mileage_km)
    OR (mc.next_maintenance_km IS DISTINCT FROM ut.next_maintenance_km)
    OR (mc.model_year IS DISTINCT FROM (
         CASE
           WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
           WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
           ELSE mc.model_year
         END
       ))
    OR (mc.performed_at IS DISTINCT FROM (CASE WHEN ut.last_maintenance_at IS NOT NULL THEN ut.last_maintenance_at::date ELSE mc.performed_at END))
  );

COMMIT;