/*
  014_enable_rls_financial_tables.sql

  Purpose:
  - Enable Row Level Security (RLS) on financial tables and create minimal,
    idempotent policies that restrict access to owners / system accounts.
  - Avoids DO/EXECUTE constructs so policy expressions that reference row
    columns parse and install correctly (no NEW parsing errors).
  - Idempotent via DROP POLICY IF EXISTS before CREATE POLICY.
*/

BEGIN;

-- Enable RLS on affected tables
ALTER TABLE IF EXISTS public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transaction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_financial_transactions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper function
-- ---------------------------------------------------------------------------
-- Centralizes "account belongs to current auth user or is system" check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_is_owner_or_system(a_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.financial_accounts fa
    WHERE fa.id = $1
      AND (fa.owner_user_id::text = auth.uid()::text OR fa.type = 'system')
  );
$$;

-- ---------------------------------------------------------------------------
-- financial_accounts policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS financial_accounts_owner_or_system_select ON public.financial_accounts;
CREATE POLICY financial_accounts_owner_or_system_select ON public.financial_accounts
  FOR SELECT
  USING (owner_user_id::text = auth.uid()::text OR type = 'system');

DROP POLICY IF EXISTS financial_accounts_authenticated_insert ON public.financial_accounts;
CREATE POLICY financial_accounts_authenticated_insert ON public.financial_accounts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (owner_user_id::text = auth.uid()::text OR type = 'system' OR owner_user_id IS NULL));

DROP POLICY IF EXISTS financial_accounts_owner_update ON public.financial_accounts;
CREATE POLICY financial_accounts_owner_update ON public.financial_accounts
  FOR UPDATE
  USING (owner_user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS financial_accounts_owner_delete ON public.financial_accounts;
CREATE POLICY financial_accounts_owner_delete ON public.financial_accounts
  FOR DELETE
  USING (owner_user_id::text = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- transaction_types policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS transaction_types_public_select ON public.transaction_types;
CREATE POLICY transaction_types_public_select ON public.transaction_types
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS transaction_types_authenticated_insert ON public.transaction_types;
CREATE POLICY transaction_types_authenticated_insert ON public.transaction_types
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- financial_transactions policies
-- Note: use column names (account_id) in policy expressions so CREATE POLICY parses
-- correctly when executed as plain SQL (no DO/EXECUTE).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS financial_transactions_owner_or_system_select ON public.financial_transactions;
CREATE POLICY financial_transactions_owner_or_system_select ON public.financial_transactions
  FOR SELECT
  USING (public.account_is_owner_or_system(account_id));

DROP POLICY IF EXISTS financial_transactions_authenticated_insert_with_account_check ON public.financial_transactions;
CREATE POLICY financial_transactions_authenticated_insert_with_account_check ON public.financial_transactions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.account_is_owner_or_system(account_id));

DROP POLICY IF EXISTS financial_transactions_owner_update ON public.financial_transactions;
CREATE POLICY financial_transactions_owner_update ON public.financial_transactions
  FOR UPDATE
  USING (public.account_is_owner_or_system(account_id));

DROP POLICY IF EXISTS financial_transactions_owner_delete ON public.financial_transactions;
CREATE POLICY financial_transactions_owner_delete ON public.financial_transactions
  FOR DELETE
  USING (public.account_is_owner_or_system(account_id));

-- ---------------------------------------------------------------------------
-- scheduled_financial_transactions policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scheduled_financial_transactions_owner_or_system_select ON public.scheduled_financial_transactions;
CREATE POLICY scheduled_financial_transactions_owner_or_system_select ON public.scheduled_financial_transactions
  FOR SELECT
  USING (public.account_is_owner_or_system(account_id));

DROP POLICY IF EXISTS scheduled_financial_transactions_authenticated_insert_with_account_check ON public.scheduled_financial_transactions;
CREATE POLICY scheduled_financial_transactions_authenticated_insert_with_account_check ON public.scheduled_financial_transactions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.account_is_owner_or_system(account_id));

DROP POLICY IF EXISTS scheduled_financial_transactions_owner_update ON public.scheduled_financial_transactions;
CREATE POLICY scheduled_financial_transactions_owner_update ON public.scheduled_financial_transactions
  FOR UPDATE
  USING (public.account_is_owner_or_system(account_id));

DROP POLICY IF EXISTS scheduled_financial_transactions_owner_delete ON public.scheduled_financial_transactions;
CREATE POLICY scheduled_financial_transactions_owner_delete ON public.scheduled_financial_transactions
  FOR DELETE
  USING (public.account_is_owner_or_system(account_id));

COMMIT;