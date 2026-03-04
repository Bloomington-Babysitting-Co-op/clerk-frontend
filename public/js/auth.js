import { supabase } from "/js/supabase.js";
import { renderRequestListCard } from "/js/request-cards.js";
import { isAdminUiEnabled } from "/js/utils.js";

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

    async login() {
      const { error } = await supabase.auth.signInWithPassword({
        email: this.email,
        password: this.password
      });

      if (error) {
        this.error = error.message;
      } else {
        const { data: isActive, error: activeError } = await supabase.rpc("rpc_is_current_family_active");
        if (activeError || !isActive) {
          await supabase.auth.signOut();
          this.error = activeError?.message || "Your family is inactive. Please contact an admin.";
          return;
        }
        window.location = "/";
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
        const { data: isActive, error: activeError } = await supabase.rpc("rpc_is_current_family_active");
        if (activeError || !isActive) {
          await supabase.auth.signOut();
          this.error = activeError?.message || "Your family is inactive. Please contact an admin.";
          return;
        }
        window.location.reload();
      }
    },

    async loadData() {
      try {
        // Get hours balance
        const { data: balance, error: balanceError } = await supabase.rpc("rpc_get_hours_balance");
        if (balanceError) throw balanceError;
        this.hoursBalance = Number(balance ?? 0).toFixed(2);

        // Get user's future requests
        const { data: userRequests, error: userRequestsError } = await supabase.rpc("rpc_list_requests_my_family_future");
        if (userRequestsError) throw userRequestsError;

        const { data: activeThisMonth, error: activeError } = await supabase.rpc("rpc_has_completed_sit_this_month");
        if (activeError) throw activeError;
        this.activeThisMonth = !!activeThisMonth;

        if (userRequests) {
          const container = document.getElementById("family-requests-list");
          if (container) {
            container.innerHTML = userRequests.length
              ? userRequests.map((r) => renderRequestListCard(r)).join("")
              : "<p class='text-gray-600'>No future requests submitted.</p>";
          }
        }

        const submittedOffersContainer = document.getElementById("family-offers-list");
        const { data: submittedOffers, error: submittedOffersError } = await supabase.rpc("rpc_list_offers_my_submitted");
        const submittedOffersList = Array.isArray(submittedOffers) ? submittedOffers : [];

        if (submittedOffersContainer) {
          submittedOffersContainer.innerHTML = (!submittedOffersError && submittedOffersList.length)
            ? submittedOffersList.map((r) => renderRequestListCard(r)).join("")
            : "<p class='text-gray-600'>No submitted offers at the moment.</p>";
        }

        // Get all open requests
        const otherRequestsContainer = document.getElementById("other-requests-list");
        const { data: otherRequests, error: otherRequestsError } = await supabase.rpc("rpc_list_requests_other_open");
        const otherRequestsList = Array.isArray(otherRequests) ? otherRequests : [];

        if (otherRequestsContainer) {
          otherRequestsContainer.innerHTML = (!otherRequestsError && otherRequestsList.length)
            ? otherRequestsList.map((r) => renderRequestListCard(r)).join("")
            : "<p class='text-gray-600'>No open requests at the moment.</p>";
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

  const { data: isActive, error: activeError } = await supabase.rpc("rpc_is_current_family_active");
  if (activeError || !isActive) {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
    throw new Error(activeError?.message || "Your family is inactive. Please contact an admin.");
  }

  return data.session;
}

async function requireAdmin() {
  await requireAuth();
  const showAdminUi = await isAdminUiEnabled();
  if (!showAdminUi) {
    throw new Error("Admin access requires admin mode to be enabled in the navbar.");
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
