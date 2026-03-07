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
4. Create a `.env` (reference [example.env](./example.env)) with values taken from `npx supabase status`
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
1. Push this folder to GitHub
2. Create a Cloudflare Pages project
3. Set "Build output directory" to `public`
4. Deploy
5. Add [Cloudflare Pages secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets) with values taken from [Supabase Project Settings dashboard](https://supabase.com/dashboard/project/_/settings/api-keys)
