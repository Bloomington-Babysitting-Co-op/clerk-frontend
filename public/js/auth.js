import { supabase } from "/js/supabase.js";
import { renderRequestListCard } from "/js/request-cards.js";
import { hasAdmin } from "/js/utils.js";

function authState() {
  return {
    session: null,

    async init() {
      const { data } = await supabase.auth.getSession();
      this.session = data.session;
    },

    async logout() {
      await supabase.auth.signOut();
      window.location = "/";
    }
  };
}

function loginForm() {
  return {
    email: "",
    password: "",
    error: "",
    resetting: false,

    async login() {
      const { error } = await supabase.auth.signInWithPassword({
        email: this.email,
        password: this.password
      });

      if (error) {
        this.error = error.message;
      } else {
        const { data: isActive, error: activeError } = await supabase.rpc("rpc_my_is_active");
        if (activeError || !isActive) {
          await supabase.auth.signOut();
          this.error = "Inactive login credentials";
          return;
        }
        window.location = "/";
      }
    },

    async forgotPassword() {
      if (!this.email || !this.email.trim()) {
        this.error = 'Enter your email to reset password.';
        return;
      }
      const email = this.email.trim();
      const ok = window.confirm(`Send password reset email to ${email}?`);
      if (!ok) return;
      this.resetting = true;
      this.error = '';
      try {
        const resp = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          this.error = result?.error || 'Failed to send reset email';
        } else {
          this.error = 'Password reset email sent.';
        }
      } catch (err) {
        this.error = err?.message || 'Failed to send reset email';
      } finally {
        this.resetting = false;
      }
    }
  };
}

function dashboardState() {
  return {
    session: null,
    email: "",
    password: "",
    error: "",
    hoursBalance: 0,
    activeThisMonth: false,

    async init() {
      const { data } = await supabase.auth.getSession();
      this.session = data.session;

      if (this.session) {
        await this.loadData();
      }
    },

    async login() {
      const { error } = await supabase.auth.signInWithPassword({
        email: this.email,
        password: this.password
      });

      if (error) {
        this.error = error.message;
      } else {
        window.location.reload();
      }
    },

    async loadData() {
      try {
        const { data: balance, error: balanceError } = await supabase.rpc("rpc_my_hours_balance");
        if (balanceError) throw balanceError;
        this.hoursBalance = Number(balance ?? 0).toFixed(2);

        const { data: activeThisMonth, error: activeError } = await supabase.rpc("rpc_my_active_this_month");
        if (activeError) throw activeError;
        this.activeThisMonth = !!activeThisMonth;

        // Get all available requests
        const otherRequestsContainer = document.getElementById("other-requests-list");
        const { data: otherRequests, error: otherRequestsError } = await supabase.rpc("rpc_list_other_requests");
        const otherRequestsList = Array.isArray(otherRequests) ? otherRequests : [];

        if (otherRequestsContainer) {
          otherRequestsContainer.innerHTML = (!otherRequestsError && otherRequestsList.length)
            ? otherRequestsList.map((r) => renderRequestListCard(r)).join("")
            : "<p class='text-gray-600'>No available requests.</p>";
        }

        // Get user's future requests
        const { data: userRequests, error: userRequestsError } = await supabase.rpc("rpc_list_my_requests");
        if (userRequestsError) throw userRequestsError;

        if (userRequests) {
          const container = document.getElementById("family-requests-list");
          if (container) {
            container.innerHTML = userRequests.length
              ? userRequests.map((r) => renderRequestListCard(r)).join("")
              : "<p class='text-gray-600'>No future requests submitted.</p>";
          }
        }

        // Get user's submitted offers
        const submittedOffersContainer = document.getElementById("family-offers-list");
        const { data: submittedOffers, error: submittedOffersError } = await supabase.rpc("rpc_list_my_offers");
        const submittedOffersList = Array.isArray(submittedOffers) ? submittedOffers : [];

        if (submittedOffersContainer) {
          submittedOffersContainer.innerHTML = (!submittedOffersError && submittedOffersList.length)
            ? submittedOffersList.map((r) => renderRequestListCard(r)).join("")
            : "<p class='text-gray-600'>No submitted offers.</p>";
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    }
  };
}

async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = "/login.html";
    throw new Error("Not authenticated");
  }

  const { data: isActive, error: activeError } = await supabase.rpc("rpc_my_is_active");
  if (activeError || !isActive) {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
    throw new Error(activeError?.message || "Inactive login credentials");
  }

  return data.session;
}

async function requireAdmin() {
  await requireAuth();
  if (!(await hasAdmin())) {
    throw new Error("Admin access required.");
  }
  return true;
}

// Alpine needs these on window
window.authState = authState;
window.loginForm = loginForm;
window.dashboardState = dashboardState;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;

// Module exports
export { authState, loginForm, dashboardState, requireAuth, requireAdmin };
