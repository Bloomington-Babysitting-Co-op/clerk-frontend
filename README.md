# Bloomington Babysitting Co-op Clerk - Frontend
Created for Cloudflare Pages + Supabase + Resend.

## Setup
### Backend Configuration
1. [Setup the Supabase backend](https://github.com/Bloomington-Babysitting-Co-op/clerk-backend)
2. Update `public/js/config.js` with:
   * supabaseUrl
   * supabaseKey

### Local Development
To set up a local development environment that replicates Cloudflare Pages:
1. Clone this repo
2. [Install Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
   ```
   npm i -D wrangler@latest
   ```
3. Modify `public\js\config.js` to point at the desired backend (remote or local)
4. Start the local development server
   ```
   npx wrangler pages dev public
   ```
5. Open a browser to http://localhost:8788 to view the application

## Deploy
1. Confirm that `public\js\config.js` is pointed to the remote backend
2. Push this folder to GitHub.
3. Create a Cloudflare Pages project.
4. Set "Build output directory" to `public`.
5. Deploy.
