* [x] User Auth managed by Supabase
* [ ] Email notifications from Resend
* [ ] Dashboard
   * [ ] User's current hour balance
   * [ ] An indication of whether the user has completed a sit request yet this calendar month
   * [ ] User's submitted future sit requests
   * [ ] All user's unclaimed future sit requests
   * [ ] Links to other sites like google drive, google map, google group
* [ ] Ledger
   * [ ] All completed sits from all users
   * [ ] All user's current hours balance
   * [ ] Export to csv option with date ranges selectable
* [ ] New Entry
   * [ ] Show past completed claims that can be selected to prefill the form
   * [ ] If prefill is not selected, allow free form entry
* [ ] Edit Entry
   * [ ] Only available to admin
* [ ] Requests
   * [ ] All requests and their status
* [ ] View Request
   * [ ] An individual request details
      * [ ] The date and time of the request
      * [ ] A description of the request
      * [ ] The request type (babysit, drive, favor, other)
   * [ ] If not the request owner, be able to click to submit a claim
   * [ ] If the request owner, be able to click to accept a claim
   * [ ] If the request owner, be able to cancel or edit the request (but not change it's type)
* [ ] New Request
   * [ ] Create a new sit request
      * [ ] Type of the request (babysit, drive, favor, other)
         * [ ] If babysit, sit location (at the sitter's or goer's house, or either)
         * [ ] If babysit, whether meal will need to be served
            * [ ] If meal is served, whether it will be prepared by the sitter
         * [ ] If babysit, are sitter's kids welcome
         * [ ] Allergies or pet concerns
      * [ ] Description of the request (required)
      * [ ] Include a checkbox to toggle, "open for any date" or "open for alternatives"
      * [ ] Date of the request (required for babysit and drive, otherwise optional)
      * [ ] Start and End Time of the request (optional)
      * [ ] Hours offered for the request (if type is sit, hours are calculated automatically based on other options selected and if start/end time are provided)
* [ ] User panel
   * [ ] Change email
   * [ ] Change password
   * [ ] Change notification preferences
      * [ ] Get emailed if a new request available for claiming
      * [ ] Get emailed if a request is 48 hours out and still unclaimed
      * [ ] Get emailed if a request they submitted has had a claim
      * [ ] Get emailed if a request they claimed was cancelled or edited by the requestor
      * [ ] Get emailed if a entry was submitted with them as the debtor
      * [ ] Get emailed mid-month if they have not used yet
   * [ ] Update profile
      * [ ] Add parent/member names, emails, phone numbers, address
      * [ ] Add emergency contact names, phone numbers
      * [ ] Add children names
         * [ ] Add birth month/year so age can be calculated
         * [ ] Add allergies
      * [ ] Add pets
      * [ ] Upload family photo?
      * [ ] Add business information
* [ ] Admin panel
   * [ ] User creation
   * [ ] User deactivation/reactivation
   * [ ] Manual ledger adjustments to change any user's hours balance
   * [ ] Admin only user notes, but visible to end users in their profile
      * [ ] Date joined
      * [ ] Date last background check completed
      * [ ] Date last dues payment
      * [ ] General notes
   * [ ] Send email to all active users
   * [ ] Create/edit and make active/inactive a banner message that appears under the navbar
   * [ ] Create/edit the external links section on user's dashboard