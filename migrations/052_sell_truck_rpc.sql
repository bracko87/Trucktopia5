-- migrations/052_sell_truck_rpc.sql
-- Create sales audit table and RPC to atomically record a sale and remove the truck.
-- Notes:
--  - This function uses auth.uid() to map to public.users.auth_user_id.
--  - It performs ownership checks and deletes the user_trucks row inside a single transaction.
--  - For production you may want to mark this as SECURITY DEFINER and create a specific role
--    to execute it so the endpoint can bypass RLS safely. Here we mark it SECURITY DEFINER:
--    ensure the migration is applied by a privileged role.
CREATE TABLE IF NOT EXISTS public.sales_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL,
  seller_user_id uuid NULL,
  seller_company_id uuid NULL,
  buyer_type text NULL,
  offer_label text NULL,
  price_cents bigint NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT sales_audit_pkey PRIMARY KEY (id)
);

-- Function: sell_truck
-- Parameters:
--  - p_truck_uuid: uuid of user_trucks row to sell
--  - p_offer_label: label of offer (e.g. 'dealer', 'company', 'private')
--  - p_price_cents: price in cents to record
--  - p_buyer_type: optional buyer type
-- Behavior:
--  - requires auth.uid() to be set
--  - finds public.users row where auth_user_id = auth.uid()
--  - locks the user_trucks row FOR UPDATE
--  - ensures the caller owns the truck (owner_user_id matches public.users.id OR
--    caller owns the owner_company_id)
--  - inserts sales_audit row
--  - deletes user_trucks row
--  - returns JSON { success: true, sale_id, price_cents }
CREATE OR REPLACE FUNCTION public.sell_truck(
  p_truck_uuid uuid,
  p_offer_label text,
  p_price_cents bigint,
  p_buyer_type text DEFAULT 'private'
) RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid text;
  v_user_id uuid;
  v_truck public.user_trucks%ROWTYPE;
  v_sale_id uuid;
  v_allowed boolean := false;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = v_uid LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'public_user_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_truck FROM public.user_trucks WHERE id = p_truck_uuid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'truck_not_found' USING ERRCODE = 'P0003';
  END IF;

  IF v_truck.owner_user_id IS NOT NULL AND v_truck.owner_user_id = v_user_id THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed AND v_truck.owner_company_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.companies c WHERE c.id = v_truck.owner_company_id AND c.owner_id = v_user_id) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO public.sales_audit (truck_id, seller_user_id, seller_company_id, buyer_type, offer_label, price_cents)
  VALUES (p_truck_uuid, v_truck.owner_user_id, v_truck.owner_company_id, p_buyer_type, p_offer_label, p_price_cents)
  RETURNING id INTO v_sale_id;

  DELETE FROM public.user_trucks WHERE id = p_truck_uuid;

  RETURN json_build_object('success', true, 'sale_id', v_sale_id, 'price_cents', p_price_cents);
END;
$$ SECURITY DEFINER;
