import { supabase } from "/js/supabase.js";
import { formatDateTime } from "/js/utils.js";

function formatDashboardSchedule(request) {
  if (request.start_time && request.end_time) {
    return `${formatDateTime(request.start_time)} → ${formatDateTime(request.end_time)}`;
  }
  if (request.request_date) {
    return new Date(`${request.request_date}T00:00:00`).toLocaleDateString();
  }
  return "Date/time flexible";
}

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
    completedSitThisMonth: false,

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
        // Get hours balance
        const { data: balance, error: balanceError } = await supabase.rpc("rpc_get_hours_balance");
        if (balanceError) throw balanceError;
        this.hoursBalance = Number(balance ?? 0).toFixed(2);

        // Get user's future requests
        const { data: userRequests, error: userRequestsError } = await supabase.rpc("rpc_list_user_future_requests");
        if (userRequestsError) throw userRequestsError;

        const { data: completedSitThisMonth, error: completedSitError } = await supabase.rpc("rpc_has_completed_sit_this_month");
        if (completedSitError) throw completedSitError;
        this.completedSitThisMonth = !!completedSitThisMonth;

        if (userRequests) {
          const container = document.getElementById("user-requests-list");
          if (container) {
            container.innerHTML = userRequests.length
              ? userRequests.map(r => `
                <div class="border p-4 mb-2 rounded">
                  <p class="font-semibold text-gray-700">${r.status}</p>
                  <p class="text-sm text-gray-600">${formatDashboardSchedule(r)}</p>
                  <p class="text-sm text-gray-600">Type: ${r.request_type || "other"}</p>
                  <p class="mt-1">${r.notes || ""}</p>
                  <a href="/request_view.html?id=${r.id}" class="text-blue-600 underline text-sm">View</a>
                </div>
              `).join("")
              : "<p class='text-gray-600'>No future requests submitted.</p>";
          }
        }

        // Get active requests from other users
        const { data: otherRequests, error: otherRequestsError } = await supabase.rpc("rpc_list_open_other_requests");
        if (otherRequestsError) throw otherRequestsError;

        if (otherRequests) {
          const container = document.getElementById("other-requests-list");
          if (container) {
            container.innerHTML = otherRequests.length
              ? otherRequests.map(r => `
                <div class="border p-4 mb-2 rounded">
                  <p class="text-sm text-gray-600">${formatDashboardSchedule(r)}</p>
                  <p class="text-sm text-gray-600">Type: ${r.request_type || "other"}</p>
                  <p class="mt-1">${r.notes || ""}</p>
                  <a href="/request_view.html?id=${r.id}" class="text-blue-600 underline text-sm">View & Accept</a>
                </div>
              `).join("")
              : "<p class='text-gray-600'>No available requests at the moment.</p>";
          }
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
  return data.session;
}

// Alpine needs these on window
window.authState = authState;
window.loginForm = loginForm;
window.dashboardState = dashboardState;
window.requireAuth = requireAuth;

// Module exports
export { authState, loginForm, dashboardState, requireAuth };
