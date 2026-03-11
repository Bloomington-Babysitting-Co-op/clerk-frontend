# Bloomington Babysitting Co-op Clerk - Frontend
Created for Cloudflare Pages + Supabase + Resend.

## Setup
### Local Development
To set up a local development environment that replicates Cloudflare Pages:
1. Clone this repo
2. Install dependencies
   ```
   npm install -upgrade
   ```
3. [Setup the Supabase backend](https://github.com/Bloomington-Babysitting-Co-op/clerk-backend)
4. Create a `.env` (reference [example.env](./example.env))
   * Local values taken from running `npx supabase status`
   * Remote values taken from [Supabase Project Settings dashboard](https://supabase.com/dashboard/project/_/settings/api-keys)
5. Generate the `_env.js`
   ```
   npm run generate-env
   ```
6. Start the local development server
   ```
   npx wrangler pages dev public
   ```
7. Open a browser to http://localhost:8788 to view the application

## Deploy
1. Push changes to `main` branch to GitHub

### Initial Setup
1. Create a Cloudflare Pages project
   * Project name: `bbc-clerk`
   * Production branch: `main`
   * Build command: `npm run generate-env`
   * Build output directory: `public`
   * Environment variables: add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` with remote values from `.env`
   * Click "Save and Deploy"
2. Go to the project settings and add `SUPABASE_SECRET_KEY` as a secret with remote value from `.env`
3. Force a deploy (either by pushing another commit, or using a deploy hook)