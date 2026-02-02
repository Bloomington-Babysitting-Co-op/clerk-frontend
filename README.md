# Bloomington Babysitting Co-op Ledger
Created for Cloudflare Pages + Supabase + Resend.

## Features
* User Auth managed by Supabase
* Email notifications from Resend
* Dashboard
   * User's current hour balance
   * An indication of whether the user has completed a sit request yet this calendar month
   * User's submitted future sit requests
   * All user's unclaimed future sit requests
   * Links to other sites like google drive, google map, google group
* Ledger
   * All completed sits from all users
   * All user's current hours balance
* Requests
   * All requests and their status
* View Request
   * An individual request details
      * The date and time of the request
      * A description of the request
      * The request type (babysit, drive, favor, other)
   * If the request owner, be able to click to accept a claim
      * This triggers an email to the claimant
   * If not the request owner, be able to click to submit a claim
      * This triggers an email to the owner
* New Request
   * Create a new sit request
      * Type of the request (babysit, drive, favor, other)
         * If babysit, whether the sit is at the sitter's or goer's house
         * If babysit, whether meal will need to be served
      * Description of the request (required)
      * Include a checkbox to toggle, "open for any date" or "open for alternatives"
      * Date of the request (required for babysit and drive, otherwise optional)
      * Start Time of the request (optional)
      * Hours offered for the request (optional)
* User panel
   * Change email
   * Change password
   * Change notification preferences
      * Get emailed if a new request available for claiming
      * Get emailed if a request is 48 hours out and still unclaimed
      * Get emailed if a request they submitted has been claimed
      * Get emailed mid-month if they have not used yet
   * Update profile
      * Add parent/member names, emails, phone numbers, address
      * Add emergency contact names, phone numbers
      * Add children names and birth month/year so age can be calculated
      * Upload family photo?
      * Add business information
* Admin panel
   * User creation
   * User deactivation/reactivation
   * Manual ledger adjustments to change any user's hours balance
   * Admin only user notes, but visible to end users in their profile
      * Date joined
      * Date last background check completed
      * Date last dues payment
      * General notes
   * Send email to all active users
   * Create/edit and make active/inactive a banner message that appears under the navbar
   * Create/edit the external links section on user's dashboard

## Setup
### Backend Configuration
1. [Setup the Supabase backend](https://github.com/Bloomington-Babysitting-Co-op/ledger-backend)
2. Update `public/js/supabase.js` with:
   * SUPABASE_URL
   * PUBLIC_ANON_KEY

### Local Development
To set up a local development environment that replicates Cloudflare Pages:
1. Clone this repo
2. [Install Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
   ```
   npm i -D wrangler@latest
   ```
3. Start the local development server
   ```
   npx wrangler pages dev public
   ```
4. Open a browser to http://localhost:8788 to view the application

## Deploy
1. Push this folder to GitHub.
2. Create a Cloudflare Pages project.
3. Set "Build output directory" to `public`.
4. Deploy.
