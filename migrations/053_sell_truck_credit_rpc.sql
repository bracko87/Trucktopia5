-- migrations/053_sell_truck_credit_rpc.sql
-- 
-- Create sales_audit table and an atomic RPC function sell_truck(...)
-- The RPC:
--  - validates the authenticated caller owns the truck (direct owner or company owner)
--  - inserts a sales_audit row
--  - attempts to insert a financial_transactions credit to a seller-owned account (or to a provided account)
--  - deletes the user_trucks row
--  - returns JSON indicating success or an error message
--
-- Notes:
--  - Function is SECURITY DEFINER so it can perform the audit+delete even with RLS.
--  - The RPC must be called by an authenticated user (auth.uid() != NULL).
--  - Payment accounting/fees can be extended inside the RPC later.
--  - This migration assumes pgcrypto/gen_random_uuid() is available in the DB.

BEGIN;

-- Create audit table for sales
CREATE TABLE IF NOT EXISTS public.sales_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  seller_company_id uuid NULL,
  buyer_type text NULL,
  offer_label text NULL,
  price_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_audit_pkey PRIMARY KEY (id)
);

-- Create the RPC function that performs atomic audit + credit + delete
CREATE OR REPLACE FUNCTION public.sell_truck(
  p_truck_uuid uuid,
  p_offer_label text,
  p_price_cents bigint,
  p_buyer_type text,
  p_credit_account_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
/*
  sell_truck RPC
  - p_truck_uuid: uuid of user_trucks to sell
  - p_offer_label: label/id of selected offer (eg. 'dealer'|'company'|'private')
  - p_price_cents: integer price in cents (client-provided; RPC still enforces ownership & records audit)
  - p_buyer_type: textual buyer type
  - p_credit_account_id: optional account id to credit; if null, function will attempt to locate a seller-owned financial_accounts row
*/
DECLARE
  seller_auth_uid uuid;
  seller_public_user_id uuid;
  t_owner_user_id uuid;
  t_owner_company_id uuid;
  sale_id uuid;
  acct_id uuid;
  tx_id uuid;
BEGIN
  -- 1) ensure caller is authenticated
  seller_auth_uid := auth.uid();
  IF seller_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 2) find public.users row for this auth uid
  SELECT id INTO seller_public_user_id FROM public.users WHERE auth_user_id = seller_auth_uid LIMIT 1;
  IF seller_public_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'public_user_not_found');
  END IF;

  -- 3) lock the truck row to avoid races
  SELECT owner_user_id, owner_company_id
    INTO t_owner_user_id, t_owner_company_id
    FROM public.user_trucks
    WHERE id = p_truck_uuid
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'truck_not_found');
  END IF;

  -- 4) verify ownership:
  -- allow if owner_user_id == public_user.id OR owner_company is owned by this public_user
  IF NOT (
       (t_owner_user_id IS NOT NULL AND t_owner_user_id = seller_public_user_id)
    OR (t_owner_company_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.companies c WHERE c.id = t_owner_company_id AND c.owner_id = seller_public_user_id
       ))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  -- 5) insert audit row
  INSERT INTO public.sales_audit (truck_id, seller_user_id, seller_company_id, buyer_type, offer_label, price_cents)
  VALUES (p_truck_uuid, seller_public_user_id, t_owner_company_id, p_buyer_type, p_offer_label, p_price_cents)
  RETURNING id INTO sale_id;

  -- 6) determine account to credit: prefer provided p_credit_account_id, otherwise find one for the seller
  IF p_credit_account_id IS NOT NULL THEN
    acct_id := p_credit_account_id;
  ELSE
    SELECT id INTO acct_id FROM public.financial_accounts WHERE owner_user_id = seller_public_user_id LIMIT 1;
  END IF;

  -- 7) if account exists, insert a financial transaction credit (amount stored as numeric with 2 decimals)
  IF acct_id IS NOT NULL THEN
    INSERT INTO public.financial_transactions (
      account_id,
      kind,
      amount,
      currency,
      created_at,
      related_truck_id,
      note
    ) VALUES (
      acct_id,
      'income',
      (p_price_cents::numeric / 100)::numeric(14,2),
      'USD',
      now(),
      p_truck_uuid,
      'Truck sale audit_id=' || sale_id
    )
    RETURNING id INTO tx_id;
  END IF;

  -- 8) delete the user_trucks row (removes truck from fleet)
  DELETE FROM public.user_trucks WHERE id = p_truck_uuid;

  -- 9) return success with created ids
  RETURN jsonb_build_object('success', true, 'sale_id', sale_id, 'transaction_id', tx_id);

EXCEPTION WHEN others THEN
  -- surface error message to client for debugging; callers should treat errors as failures
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to public so PostgREST /rpc/sell_truck is callable by the frontend anon/public role.
GRANT EXECUTE ON FUNCTION public.sell_truck(uuid, text, bigint, text, uuid) TO public;

COMMIT;
