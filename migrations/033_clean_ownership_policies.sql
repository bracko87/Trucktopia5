/**
 * migrations/033_clean_ownership_policies.sql
 *
 * Purpose:
 *  - Make ownership RLS policies idempotent and canonical.
 *  - Drop existing conflicting policies if present and recreate safe policies
 *    that enforce "owner -> auth.uid()" semantics or equivalent EXISTS checks.
 *
 * Notes:
 *  - This migration is defensive: it uses DROP POLICY IF EXISTS before CREATE.
 *  - Where tables reference public.users by user id, checks join against users.auth_user_id
 *    so we don't assume whether owner columns store auth.uid() or internal user id.
 */

/* Ensure RLS is enabled on affected tables (no-op if already enabled) */
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_truck_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_transactions ENABLE ROW LEVEL SECURITY;

/*
 * USERS
 * Canonical: auth.uid() must equal users.auth_user_id for read/update/insert.
 */
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

/*
 * COMPANIES
 * Canonical: owner_id (existing schema) must correspond to the authenticated user.
 * If you later rename owner_id -> owner_user_id, update policies accordingly.
 */
DROP POLICY IF EXISTS companies_insert_owner ON public.companies;
DROP POLICY IF EXISTS companies_select_owner ON public.companies;
DROP POLICY IF EXISTS companies_update_owner ON public.companies;

CREATE POLICY companies_insert_owner ON public.companies
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY companies_select_owner ON public.companies
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY companies_update_owner ON public.companies
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

/*
 * USER_TRUCKS
 * Canonical: owner_user_id (exists in schema) must map to the authenticated user.
 */
DROP POLICY IF EXISTS user_trucks_insert_owner ON public.user_trucks;
DROP POLICY IF EXISTS user_trucks_select_owner ON public.user_trucks;
DROP POLICY IF EXISTS user_trucks_update_owner ON public.user_trucks;
DROP POLICY IF EXISTS user_trucks_delete_owner ON public.user_trucks;

CREATE POLICY user_trucks_insert_owner ON public.user_trucks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_trucks_select_owner ON public.user_trucks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_trucks_update_owner ON public.user_trucks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_trucks_delete_owner ON public.user_trucks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

/*
 * USER_TRUCK_COMPONENTS
 * Canonical: components are owned indirectly via their user_truck.owner_user_id.
 * Use an EXISTS join to enforce that the truck's owner corresponds to auth.uid().
 */
DROP POLICY IF EXISTS user_truck_components_insert_owner ON public.user_truck_components;
DROP POLICY IF EXISTS user_truck_components_select_owner ON public.user_truck_components;
DROP POLICY IF EXISTS user_truck_components_update_owner ON public.user_truck_components;
DROP POLICY IF EXISTS user_truck_components_delete_owner ON public.user_truck_components;

CREATE POLICY user_truck_components_insert_owner ON public.user_truck_components
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_trucks ut
      JOIN users u ON u.id = ut.owner_user_id
      WHERE ut.id = user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_truck_components_select_owner ON public.user_truck_components
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM user_trucks ut
      JOIN users u ON u.id = ut.owner_user_id
      WHERE ut.id = user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_truck_components_update_owner ON public.user_truck_components
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_trucks ut
      JOIN users u ON u.id = ut.owner_user_id
      WHERE ut.id = user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_trucks ut
      JOIN users u ON u.id = ut.owner_user_id
      WHERE ut.id = user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_truck_components_delete_owner ON public.user_truck_components
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM user_trucks ut
      JOIN users u ON u.id = ut.owner_user_id
      WHERE ut.id = user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

/*
 * USER_LEASES
 * Canonical: owner_user_id must correspond to auth.uid()
 */
DROP POLICY IF EXISTS user_leases_insert_owner ON public.user_leases;
DROP POLICY IF EXISTS user_leases_select_owner ON public.user_leases;
DROP POLICY IF EXISTS user_leases_update_owner ON public.user_leases;
DROP POLICY IF EXISTS user_leases_delete_owner ON public.user_leases;

CREATE POLICY user_leases_insert_owner ON public.user_leases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_leases_select_owner ON public.user_leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_leases_update_owner ON public.user_leases
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY user_leases_delete_owner ON public.user_leases
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()
    )
  );

/*
 * HUBS
 * Recommendation applied: treat as owned by a user (owner_id -> auth.uid()).
 */
DROP POLICY IF EXISTS hubs_insert_owner ON public.hubs;
DROP POLICY IF EXISTS hubs_select_owner ON public.hubs;
DROP POLICY IF EXISTS hubs_update_owner ON public.hubs;

CREATE POLICY hubs_insert_owner ON public.hubs
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY hubs_select_owner ON public.hubs
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY hubs_update_owner ON public.hubs
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

/*
 * JOB_OFFERS
 * Canonical: posted_by_user_id = auth.uid()
 */
DROP POLICY IF EXISTS job_offers_insert_owner ON public.job_offers;
DROP POLICY IF EXISTS job_offers_update_owner ON public.job_offers;
DROP POLICY IF EXISTS job_offers_delete_owner ON public.job_offers;

CREATE POLICY job_offers_insert_owner ON public.job_offers
  FOR INSERT
  WITH CHECK (posted_by_user_id = auth.uid());

CREATE POLICY job_offers_update_owner ON public.job_offers
  FOR UPDATE
  USING (posted_by_user_id = auth.uid())
  WITH CHECK (posted_by_user_id = auth.uid());

CREATE POLICY job_offers_delete_owner ON public.job_offers
  FOR DELETE
  USING (posted_by_user_id = auth.uid());

/*
 * FINANCIAL_ACCOUNTS
 * Canonical: account owned by a user OR system accounts visible.
 */
DROP POLICY IF EXISTS financial_accounts_insert_owner ON public.financial_accounts;
DROP POLICY IF EXISTS financial_accounts_select_owner ON public.financial_accounts;
DROP POLICY IF EXISTS financial_accounts_update_owner ON public.financial_accounts;
DROP POLICY IF EXISTS financial_accounts_delete_owner ON public.financial_accounts;

CREATE POLICY financial_accounts_insert_owner ON public.financial_accounts
  FOR INSERT
  WITH CHECK (
    (
      /* allow user-owned accounts where owner_user_id maps to auth.uid() */
      EXISTS (SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid())
    ) OR (type = 'system')
  );

CREATE POLICY financial_accounts_select_owner ON public.financial_accounts
  FOR SELECT
  USING (
    (
      EXISTS (SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid())
    ) OR (type = 'system')
  );

CREATE POLICY financial_accounts_update_owner ON public.financial_accounts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()));

CREATE POLICY financial_accounts_delete_owner ON public.financial_accounts
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = owner_user_id AND u.auth_user_id = auth.uid()));

/*
 * FINANCIAL_TRANSACTIONS
 * Simplified ownership: transaction.account_id must reference an account owned by the auth user.
 */
DROP POLICY IF EXISTS financial_transactions_insert_owner ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_select_owner ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_update_owner ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_delete_owner ON public.financial_transactions;

CREATE POLICY financial_transactions_insert_owner ON public.financial_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM financial_accounts a
      JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = account_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY financial_transactions_select_owner ON public.financial_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM financial_accounts a
      JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = financial_transactions.account_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY financial_transactions_update_owner ON public.financial_transactions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM financial_accounts a
      JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = financial_transactions.account_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM financial_accounts a
      JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = financial_transactions.account_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY financial_transactions_delete_owner ON public.financial_transactions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM financial_accounts a
      JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = financial_transactions.account_id
        AND u.auth_user_id = auth.uid()
    )
  );