/*
  migrations/034_canonical_ownership_policies.sql

  Purpose:
  - Create minimal, idempotent Row Level Security (RLS) policies.
  - Only create policies when the referenced columns exist to avoid "column does not exist" errors.
  - Use safe EXECUTE + format(...) strings (no nested dollar-quoting tags that conflict).
*/

DO $$
DECLARE
  owner_col text;
BEGIN
  -- Enable RLS on target tables (no-op if already enabled)
  EXECUTE 'ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.user_truck_components ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.user_leases ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.hubs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.job_offers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.financial_accounts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.financial_transactions ENABLE ROW LEVEL SECURITY';

  ------------------------------------------------------------------------
  -- USERS: auth_user_id == auth.uid()
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id';
  IF FOUND THEN
    EXECUTE 'DROP POLICY IF EXISTS users_select_own ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS users_insert_own ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS users_update_own ON public.users';

    EXECUTE 'CREATE POLICY users_select_own ON public.users FOR SELECT USING (auth.uid() = auth_user_id)';
    EXECUTE 'CREATE POLICY users_insert_own ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_user_id)';
    EXECUTE 'CREATE POLICY users_update_own ON public.users FOR UPDATE USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id)';
  END IF;

  ------------------------------------------------------------------------
  -- COMPANIES: prefer owner_user_id, fallback to owner_id
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'owner_user_id';
  IF FOUND THEN
    owner_col := 'owner_user_id';
  ELSE
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'owner_id';
    IF FOUND THEN
      owner_col := 'owner_id';
    ELSE
      owner_col := NULL;
    END IF;
  END IF;

  IF owner_col IS NOT NULL THEN
    EXECUTE format('DROP POLICY IF EXISTS companies_owner_select ON public.companies');
    EXECUTE format('DROP POLICY IF EXISTS companies_owner_insert ON public.companies');
    EXECUTE format('DROP POLICY IF EXISTS companies_owner_update ON public.companies');
    EXECUTE format('DROP POLICY IF EXISTS companies_owner_delete ON public.companies');

    EXECUTE format(
      'CREATE POLICY companies_owner_select ON public.companies FOR SELECT USING (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY companies_owner_insert ON public.companies FOR INSERT WITH CHECK (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY companies_owner_update ON public.companies FOR UPDATE USING (%s::text = auth.uid()::text) WITH CHECK (%s::text = auth.uid()::text)',
      owner_col, owner_col
    );
    EXECUTE format(
      'CREATE POLICY companies_owner_delete ON public.companies FOR DELETE USING (%s::text = auth.uid()::text)',
      owner_col
    );
  END IF;

  ------------------------------------------------------------------------
  -- HUBS: prefer owner_user_id, fallback to owner_id
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hubs' AND column_name = 'owner_user_id';
  IF FOUND THEN
    owner_col := 'owner_user_id';
  ELSE
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hubs' AND column_name = 'owner_id';
    IF FOUND THEN
      owner_col := 'owner_id';
    ELSE
      owner_col := NULL;
    END IF;
  END IF;

  IF owner_col IS NOT NULL THEN
    EXECUTE format('DROP POLICY IF EXISTS hubs_owner_select ON public.hubs');
    EXECUTE format('DROP POLICY IF EXISTS hubs_owner_insert ON public.hubs');
    EXECUTE format('DROP POLICY IF EXISTS hubs_owner_update ON public.hubs');
    EXECUTE format('DROP POLICY IF EXISTS hubs_owner_delete ON public.hubs');

    EXECUTE format(
      'CREATE POLICY hubs_owner_select ON public.hubs FOR SELECT USING (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY hubs_owner_insert ON public.hubs FOR INSERT WITH CHECK (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY hubs_owner_update ON public.hubs FOR UPDATE USING (%s::text = auth.uid()::text) WITH CHECK (%s::text = auth.uid()::text)',
      owner_col, owner_col
    );
    EXECUTE format(
      'CREATE POLICY hubs_owner_delete ON public.hubs FOR DELETE USING (%s::text = auth.uid()::text)',
      owner_col
    );
  END IF;

  ------------------------------------------------------------------------
  -- USER_TRUCKS: prefer owner_user_id, fallback to owner_id
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_trucks' AND column_name = 'owner_user_id';
  IF FOUND THEN
    owner_col := 'owner_user_id';
  ELSE
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_trucks' AND column_name = 'owner_id';
    IF FOUND THEN
      owner_col := 'owner_id';
    ELSE
      owner_col := NULL;
    END IF;
  END IF;

  IF owner_col IS NOT NULL THEN
    EXECUTE format('DROP POLICY IF EXISTS user_trucks_owner_select ON public.user_trucks');
    EXECUTE format('DROP POLICY IF EXISTS user_trucks_owner_insert ON public.user_trucks');
    EXECUTE format('DROP POLICY IF EXISTS user_trucks_owner_update ON public.user_trucks');
    EXECUTE format('DROP POLICY IF EXISTS user_trucks_owner_delete ON public.user_trucks');

    EXECUTE format(
      'CREATE POLICY user_trucks_owner_select ON public.user_trucks FOR SELECT USING (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY user_trucks_owner_insert ON public.user_trucks FOR INSERT WITH CHECK (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY user_trucks_owner_update ON public.user_trucks FOR UPDATE USING (%s::text = auth.uid()::text) WITH CHECK (%s::text = auth.uid()::text)',
      owner_col, owner_col
    );
    EXECUTE format(
      'CREATE POLICY user_trucks_owner_delete ON public.user_trucks FOR DELETE USING (%s::text = auth.uid()::text)',
      owner_col
    );
  END IF;

  ------------------------------------------------------------------------
  -- USER_TRUCK_COMPONENTS: indirect ownership via user_trucks owner column
  -- We detect which owner column exists on user_trucks and reference it.
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_trucks' AND column_name = 'owner_user_id';
  IF FOUND THEN
    owner_col := 'owner_user_id';
  ELSE
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_trucks' AND column_name = 'owner_id';
    IF FOUND THEN
      owner_col := 'owner_id';
    ELSE
      owner_col := NULL;
    END IF;
  END IF;

  IF owner_col IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_truck_components_owner_select ON public.user_truck_components';
    EXECUTE 'DROP POLICY IF EXISTS user_truck_components_owner_insert ON public.user_truck_components';
    EXECUTE 'DROP POLICY IF EXISTS user_truck_components_owner_update ON public.user_truck_components';
    EXECUTE 'DROP POLICY IF EXISTS user_truck_components_owner_delete ON public.user_truck_components';

    EXECUTE format(
      'CREATE POLICY user_truck_components_owner_select ON public.user_truck_components FOR SELECT USING (
         EXISTS (
           SELECT 1 FROM public.user_trucks ut
           WHERE ut.id = user_truck_components.user_truck_id
             AND ut.%s::text = auth.uid()::text
         )
       )',
      owner_col
    );

    EXECUTE format(
      'CREATE POLICY user_truck_components_owner_insert ON public.user_truck_components FOR INSERT WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.user_trucks ut
           WHERE ut.id = user_truck_components.user_truck_id
             AND ut.%s::text = auth.uid()::text
         )
       )',
      owner_col
    );

    EXECUTE format(
      'CREATE POLICY user_truck_components_owner_update ON public.user_truck_components FOR UPDATE USING (
         EXISTS (
           SELECT 1 FROM public.user_trucks ut
           WHERE ut.id = user_truck_components.user_truck_id
             AND ut.%s::text = auth.uid()::text
         )
       ) WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.user_trucks ut
           WHERE ut.id = user_truck_components.user_truck_id
             AND ut.%s::text = auth.uid()::text
         )
       )',
      owner_col, owner_col
    );

    EXECUTE format(
      'CREATE POLICY user_truck_components_owner_delete ON public.user_truck_components FOR DELETE USING (
         EXISTS (
           SELECT 1 FROM public.user_trucks ut
           WHERE ut.id = user_truck_components.user_truck_id
             AND ut.%s::text = auth.uid()::text
         )
       )',
      owner_col
    );
  END IF;

  ------------------------------------------------------------------------
  -- USER_LEASES: prefer owner_user_id, fallback to owner_id
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_leases' AND column_name = 'owner_user_id';
  IF FOUND THEN
    owner_col := 'owner_user_id';
  ELSE
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_leases' AND column_name = 'owner_id';
    IF FOUND THEN
      owner_col := 'owner_id';
    ELSE
      owner_col := NULL;
    END IF;
  END IF;

  IF owner_col IS NOT NULL THEN
    EXECUTE format('DROP POLICY IF EXISTS user_leases_owner_select ON public.user_leases');
    EXECUTE format('DROP POLICY IF EXISTS user_leases_owner_insert ON public.user_leases');
    EXECUTE format('DROP POLICY IF EXISTS user_leases_owner_update ON public.user_leases');
    EXECUTE format('DROP POLICY IF EXISTS user_leases_owner_delete ON public.user_leases');

    EXECUTE format(
      'CREATE POLICY user_leases_owner_select ON public.user_leases FOR SELECT USING (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY user_leases_owner_insert ON public.user_leases FOR INSERT WITH CHECK (%s::text = auth.uid()::text)',
      owner_col
    );
    EXECUTE format(
      'CREATE POLICY user_leases_owner_update ON public.user_leases FOR UPDATE USING (%s::text = auth.uid()::text) WITH CHECK (%s::text = auth.uid()::text)',
      owner_col, owner_col
    );
    EXECUTE format(
      'CREATE POLICY user_leases_owner_delete ON public.user_leases FOR DELETE USING (%s::text = auth.uid()::text)',
      owner_col
    );
  END IF;

  ------------------------------------------------------------------------
  -- JOB_OFFERS: posted_by_user_id -> auth.uid()
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'posted_by_user_id';
  IF FOUND THEN
    EXECUTE 'DROP POLICY IF EXISTS job_offers_insert_owner ON public.job_offers';
    EXECUTE 'DROP POLICY IF EXISTS job_offers_update_owner ON public.job_offers';
    EXECUTE 'DROP POLICY IF EXISTS job_offers_delete_owner ON public.job_offers';

    EXECUTE 'CREATE POLICY job_offers_insert_owner ON public.job_offers FOR INSERT WITH CHECK (posted_by_user_id = auth.uid())';
    EXECUTE 'CREATE POLICY job_offers_update_owner ON public.job_offers FOR UPDATE USING (posted_by_user_id = auth.uid()) WITH CHECK (posted_by_user_id = auth.uid())';
    EXECUTE 'CREATE POLICY job_offers_delete_owner ON public.job_offers FOR DELETE USING (posted_by_user_id = auth.uid())';
  END IF;

  ------------------------------------------------------------------------
  -- FINANCIAL_ACCOUNTS & TRANSACTIONS: reference owner_user_id on accounts
  ------------------------------------------------------------------------
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_accounts' AND column_name = 'owner_user_id';
  IF FOUND THEN
    EXECUTE format('DROP POLICY IF EXISTS financial_accounts_owner_select ON public.financial_accounts');
    EXECUTE format('DROP POLICY IF EXISTS financial_accounts_owner_insert ON public.financial_accounts');
    EXECUTE format('DROP POLICY IF EXISTS financial_accounts_owner_update ON public.financial_accounts');
    EXECUTE format('DROP POLICY IF EXISTS financial_accounts_owner_delete ON public.financial_accounts');

    EXECUTE 'CREATE POLICY financial_accounts_owner_select ON public.financial_accounts FOR SELECT USING ((owner_user_id::text = auth.uid()::text) OR (type = ''system''))';
    EXECUTE 'CREATE POLICY financial_accounts_owner_insert ON public.financial_accounts FOR INSERT WITH CHECK ((owner_user_id::text = auth.uid()::text) OR (type = ''system''))';
    EXECUTE 'CREATE POLICY financial_accounts_owner_update ON public.financial_accounts FOR UPDATE USING (owner_user_id::text = auth.uid()::text) WITH CHECK (owner_user_id::text = auth.uid()::text)';
    EXECUTE 'CREATE POLICY financial_accounts_owner_delete ON public.financial_accounts FOR DELETE USING (owner_user_id::text = auth.uid()::text)';

    -- financial_transactions: ensure account_id references an account owned by the auth user
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'financial_transactions' AND column_name = 'account_id';
    IF FOUND THEN
      EXECUTE 'DROP POLICY IF EXISTS financial_transactions_owner_select ON public.financial_transactions';
      EXECUTE 'DROP POLICY IF EXISTS financial_transactions_owner_insert ON public.financial_transactions';
      EXECUTE 'DROP POLICY IF EXISTS financial_transactions_owner_update ON public.financial_transactions';
      EXECUTE 'DROP POLICY IF EXISTS financial_transactions_owner_delete ON public.financial_transactions';

      EXECUTE '
        CREATE POLICY financial_transactions_owner_select ON public.financial_transactions FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.financial_accounts a
            WHERE a.id = financial_transactions.account_id
              AND a.owner_user_id::text = auth.uid()::text
          )
        )';
      EXECUTE '
        CREATE POLICY financial_transactions_owner_insert ON public.financial_transactions FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.financial_accounts a
            WHERE a.id = financial_transactions.account_id
              AND a.owner_user_id::text = auth.uid()::text
          )
        )';
      EXECUTE '
        CREATE POLICY financial_transactions_owner_update ON public.financial_transactions FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.financial_accounts a
            WHERE a.id = financial_transactions.account_id
              AND a.owner_user_id::text = auth.uid()::text
          )
        ) WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.financial_accounts a
            WHERE a.id = financial_transactions.account_id
              AND a.owner_user_id::text = auth.uid()::text
          )
        )';
      EXECUTE '
        CREATE POLICY financial_transactions_owner_delete ON public.financial_transactions FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.financial_accounts a
            WHERE a.id = financial_transactions.account_id
              AND a.owner_user_id::text = auth.uid()::text
          )
        )';
    END IF;
  END IF;

END
$$ LANGUAGE plpgsql;