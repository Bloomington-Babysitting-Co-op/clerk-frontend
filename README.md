# Bloomington Babysitting Co-op Ledger – Cloudflare Pages + Supabase (RPC + Triggers)

## Setup

1. Create a Supabase project.
2. Apply schema, RLS, triggers, and RPC functions (see `pg_schema.sql`).
3. Update `js/supabase.js` with:
   - SUPABASE_URL
   - PUBLIC_ANON_KEY

## Deploy

1. Push this folder to GitHub.
2. Create a Cloudflare Pages project.
3. Set "Build output directory" to `public`.
4. Deploy.

Auth, requests, and ledger will all work via Supabase REST + RPC + Postgres triggers.
