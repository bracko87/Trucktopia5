/*
  docs/run-sql-and-js.md

  Purpose:
  - Explain the error "syntax error at or near 'function'" and provide clear steps to:
    1) Run the SQL migration that creates the city_distances table in Supabase (SQL editor).
    2) Run the Node script that computes and inserts distances (terminal / Node 18+).

  Reason for the error:
  - The Supabase SQL editor only accepts SQL. JavaScript contains keywords like "function" which cause SQL syntax errors.
  - Do NOT paste JS files into the SQL editor.

  Steps to fix and run:

  1) Run the SQL migration (create the table)
     - Open Supabase → Database → SQL editor.
     - Paste the SQL from sql/002_create_city_distances.sql (or run the file) and execute it.
     - Expected: table "city_distances" is created with the unordered-pair unique index.

  2) Run the distance calculation script locally (Node 18+)
     - Ensure Node 18+ so global fetch is available.
     - From your project root run (example):
         export SUPABASE_URL="https://xyz.supabase.co"
         export SUPABASE_SERVICE_KEY="your-service-role-key"
         export BATCH_DELAY_MS=25    # optional
         node scripts/calc-city-distances.js
     - The script performs:
         • Fetch cities with lat/lon
         • Computes Haversine distance for each unordered unique pair
         • Inserts rows into city_distances via Supabase PostgREST
     - If you use Windows Powershell, set env vars with:
         $env:SUPABASE_URL="https://xyz.supabase.co"
         $env:SUPABASE_SERVICE_KEY="your-service-role-key"
         node scripts/calc-city-distances.js

  3) Troubleshooting
     - If you get permissions errors inserting into city_distances, ensure you used the Supabase service_role key (SUPABASE_SERVICE_KEY).
     - If Node complains about fetch, upgrade to Node 18+ or use the supabase-js client variant (ask me for that).
     - Don't paste .js content into the SQL editor — paste only the SQL migration for creation.

  4) Want a DB-only approach?
     - I can write a SQL stored-procedure (PL/pgSQL) to compute distances inside Postgres, but that will require running heavy pairwise logic inside the DB. Reply "SQL stored-proc" if you want that.

  Summary:
  - Error cause: running JS in SQL editor.
  - Fix: run the SQL migration in the SQL editor; run the JS script from terminal with proper env vars.

  Next suggestion:
  - If you'd like, I can:
      • Provide a supabase-js (Node) client variant of the calc script, or
      • Provide a PL/pgSQL stored-proc to compute distances entirely inside the database.
    Reply "Supabase client" or "SQL stored-proc" to choose.
*/