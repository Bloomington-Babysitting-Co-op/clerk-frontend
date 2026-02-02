import { supabase } from "/js/supabase.js";
import { formatDateTime } from "/js/utils.js";

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
        const { data: ledger, error: ledgerError } = await supabase
          .from("ledger_entries")
          .select("hours, from_user, to_user");

        if (ledgerError) throw ledgerError;

        const userId = this.session.user.id;
        let balance = 0;
        if (ledger) {
          ledger.forEach(e => {
            if (e.to_user === userId) balance += parseFloat(e.hours);
            if (e.from_user === userId) balance -= parseFloat(e.hours);
          });
        }
        this.hoursBalance = balance.toFixed(2);

        // Get user's future requests
        const now = new Date().toISOString();
        const { data: userRequests } = await supabase
          .from("requests")
          .select("id, start_time, end_time, status, notes")
          .eq("owner", userId)
          .gte("end_time", now)
          .order("start_time", { ascending: true });

        if (userRequests) {
          const container = document.getElementById("user-requests-list");
          container.innerHTML = userRequests.length
            ? userRequests.map(r => `
              <div class="border p-4 mb-2 rounded">
                <p class="font-semibold text-gray-700">${r.status}</p>
                <p class="text-sm text-gray-600">${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
                <p class="mt-1">${r.notes || ""}</p>
                <a href="/request_view.html?id=${r.id}" class="text-blue-600 underline text-sm">View</a>
              </div>
            `).join("")
            : "<p class='text-gray-600'>No future requests submitted.</p>";
        }

        // Get active requests from other users
        const { data: otherRequests } = await supabase
          .from("requests")
          .select("id, owner, start_time, end_time, status, notes")
          .eq("status", "open")
          .neq("owner", userId)
          .gte("end_time", now)
          .order("start_time", { ascending: true });

        if (otherRequests) {
          const container = document.getElementById("other-requests-list");
          container.innerHTML = otherRequests.length
            ? otherRequests.map(r => `
              <div class="border p-4 mb-2 rounded">
                <p class="text-sm text-gray-600">${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
                <p class="mt-1">${r.notes || ""}</p>
                <a href="/request_view.html?id=${r.id}" class="text-blue-600 underline text-sm">View & Accept</a>
              </div>
            `).join("")
            : "<p class='text-gray-600'>No available requests at the moment.</p>";
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
    window.location = "/";
  }
  return data.session;
}

// Alpine needs these on window
window.authState = authState;
window.loginForm = loginForm;
window.dashboardState = dashboardState;
window.requireAuth = requireAuth;
