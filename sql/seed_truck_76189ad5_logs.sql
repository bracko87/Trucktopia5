-- seed_truck_76189ad5_logs.sql
-- 
-- Insert example truck_logs entries for truck 76189ad5-e0a2-4bc8-b9b2-807157e2d4c6.
-- Use psql or your DB migration runner to execute this file.
-- Note: FK constraints require the referenced user_trucks row to exist.

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000001',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'purchase',
 'Truck purchased and delivered',
 $${
  "price": 28500,
  "currency": "EUR",
  "vendor": "AutoTrucks Ltd",
  "invoice_id": "INV-2026-078",
  "odometer": 0,
  "delivered_after_registration": true,
  "purchase_location": { "city": "Zrenjanin", "city_id": "5ffee551-4eac-46e9-b341-51a60b3b15d5" }
 }$$::jsonb,
 'system',
 'a3f4b2c1-1111-4444-8888-999999999999',
 '2026-01-04T22:04:03Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000002',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'hub_change',
 'Assigned to hub Zrenjanin (main)',
 $${
  "from": null,
  "to": { "hub_id": "5ffee551-4eac-46e9-b341-51a60b3b15d5", "city": "Zrenjanin" },
  "reason": "Initial allocation"
 }$$::jsonb,
 'ui',
 'a3f4b2c1-1111-4444-8888-999999999999',
 '2026-01-04T22:05:10Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000003',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'registration_change',
 'Registration set to ZR1001',
 $${
  "old_registration": null,
  "new_registration": "ZR1001",
  "changed_by": "a3f4b2c1-1111-4444-8888-999999999999"
 }$$::jsonb,
 'system',
 'a3f4b2c1-1111-4444-8888-999999999999',
 '2026-01-04T22:06:30Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000004',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'assign_driver',
 'Driver Markovic assigned',
 $${
  "driver_id": "d1111111-2222-3333-4444-555555555555",
  "driver_name": "Milos Markovic",
  "assigned_by": "b2b2b2b2-2222-4444-8888-aaaaaaaaaaaa"
 }$$::jsonb,
 'ui',
 'b2b2b2b2-2222-4444-8888-aaaaaaaaaaaa',
 '2026-01-05T08:30:00Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000005',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'maintenance_completed',
 'Initial inspection and oil change',
 $${
  "type": "inspection",
  "company": "Zrenjanin Service",
  "cost": 120,
  "currency": "EUR",
  "odometer": 114,
  "next_due_km": 44114,
  "maintenance_id": "m-2026-0001"
 }$$::jsonb,
 'ui',
 'c3c3c3c3-3333-6666-9999-bbbbbbbbbbbb',
 '2026-01-06T01:00:00Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000006',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'mileage_update',
 'Odometer recorded by driver',
 $${
  "odometer": 150,
  "recorded_by": "d1111111-2222-3333-4444-555555555555"
 }$$::jsonb,
 'ui',
 'd1111111-2222-3333-4444-555555555555',
 '2026-01-10T12:15:00Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000007',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'job_assigned',
 'Job 9f8e7d assigned (Zrenjanin -> Belgrade)',
 $${
  "job_id": "9f8e7d60-aaaa-4444-bbbb-cccccccccccc",
  "origin": "Zrenjanin",
  "destination": "Belgrade",
  "scheduled_pickup": "2026-01-12T09:00:00Z"
 }$$::jsonb,
 'system',
 'a3f4b2c1-1111-4444-8888-999999999999',
 '2026-01-11T09:00:00Z'
);

INSERT INTO public.truck_logs (id, user_truck_id, event_type, message, payload, source, created_by_user_id, created_at)
VALUES
('e1a1c2d3-0000-4000-8000-000000000008',
 '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
 'incident_reported',
 'Minor collision on delivery, bumper damaged',
 $${
  "severity": "low",
  "description": "Rear bumper scratch after parking incident",
  "police_report_id": null,
  "estimated_repair_cost": 350,
  "currency": "EUR",
  "photos": ["https://cdn.example.com/repairs/123.jpg"]
 }$$::jsonb,
 'ui',
 'd1111111-2222-3333-4444-555555555555',
 '2026-01-12T11:45:00Z'
);

-- Helpful read query
-- Select logs for the truck in newest-first order
SELECT * FROM public.truck_logs
 WHERE user_truck_id = '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6'
 ORDER BY created_at DESC;
