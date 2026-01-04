/*
  013_financial_transactions.sql

  Purpose:
  - Create a flexible, auditable financial system core:
    - financial_accounts: wallets owned by users/companies or system
    - transaction_types: canonical types for classification
    - financial_transactions: single ledger of all transactions
    - scheduled_financial_transactions: recurring transactions (wages, subscriptions, upkeep)

  Design notes:
  - Single transactions table keeps queries simple and enables a unified ledger UI.
  - Use type_code + kind + metadata (jsonb) for extensibility instead of many per-type tables.
  - Amount is stored as a non-negative numeric and the semantic (credit/debit) is derived
    by the account, transaction_type.direction or by business logic in the app layer.
  - Idempotent: safe to run multiple times.
*/

BEGIN;

-- Ensure UUID generator is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Accounts (wallets)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  owner_company_id uuid,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'player', /* e.g. player | company | system */
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2) Transaction types (catalog of types and direction hint)
CREATE TABLE IF NOT EXISTS public.transaction_types (
  code text PRIMARY KEY, /* e.g. wage, maintenance, job_reward, purchase, fee, transfer */
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  category text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 3) Main transactions ledger
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  counterparty_account_id uuid REFERENCES public.financial_accounts(id),
  type_code text REFERENCES public.transaction_types(code),
  kind text NOT NULL CHECK (kind IN ('income','expense','transfer','fee','wage','maintenance','purchase','sale','adjustment','refund')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz DEFAULT now(),
  related_job_offer_id uuid,
  related_truck_id uuid,
  scheduled_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  note text
);

-- Useful indexes for querying feeds and joins
CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_created_at ON public.financial_transactions(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type_code ON public.financial_transactions(type_code);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_related_job_offer_id ON public.financial_transactions(related_job_offer_id);

-- 4) Scheduled/recurring transactions (wages, periodic maintenance, subscriptions)
CREATE TABLE IF NOT EXISTS public.scheduled_financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  type_code text REFERENCES public.transaction_types(code),
  kind text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  interval_spec text NOT NULL, /* human/cron style: e.g. 'monthly', 'weekly', or cron-like expression */
  next_run_at timestamptz,
  active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

COMMIT;