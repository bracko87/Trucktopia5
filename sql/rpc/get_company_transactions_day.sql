-- Get transactions for a company for a single game-day window (00:01 -> next day 00:01) in provided timezone.
-- Returns a JSON object with { rows: [...], count: N }.
CREATE OR REPLACE FUNCTION public.get_company_transactions_day(
  p_tz text,
  p_owner_company_id uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH window AS (
    SELECT
      -- compute local midnight in tz then add 00:01
      (date_trunc('day', now() AT TIME ZONE p_tz) + time '00:01') AT TIME ZONE 'UTC' AS start_utc,
      ((date_trunc('day', now() AT TIME ZONE p_tz) + time '00:01') + interval '24 hours') AT TIME ZONE 'UTC' AS end_utc
  ),
  accounts AS (
    SELECT id FROM financial_accounts WHERE owner_company_id = p_owner_company_id
  ),
  tx AS (
    SELECT ft.*
    FROM financial_transactions ft, window
    WHERE ft.account_id = ANY (SELECT id FROM accounts)
      AND ft.created_at >= window.start_utc
      AND ft.created_at < window.end_utc
    ORDER BY ft.created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'rows', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM tx) t),
    'count', (SELECT count(*) FROM financial_transactions ft, window WHERE ft.account_id = ANY (SELECT id FROM accounts) AND ft.created_at >= window.start_utc AND ft.created_at < window.end_utc)
  );
$$;