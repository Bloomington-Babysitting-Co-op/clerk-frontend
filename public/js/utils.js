import { supabase } from "./supabase.js";

export function formatDateTime(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleString();
}

export async function setupNavbar(containerId) {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container with id "${containerId}" not found`);
      return;
    }

    const navbarHTML = `
      <nav class="bg-blue-600 text-white shadow">
        <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <a href="/" class="text-xl font-bold">BBC Ledger</a>
          <div class="flex gap-6 items-center">
            <a href="/request_new.html" class="hover:text-blue-100">New Request</a>
            <a href="/request_view.html" class="hover:text-blue-100">View Requests</a>
            <a href="/ledger.html" class="hover:text-blue-100">Ledger</a>
            ${session 
              ? `<button id="logout-btn" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Log Out</button>` 
              : `<a href="/login.html" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Log In</a>`
            }
          </div>
        </div>
      </nav>
    `;

    container.innerHTML = navbarHTML;
    console.log("Navbar rendered successfully");

    if (session) {
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          await supabase.auth.signOut();
          window.location = "/";
        });
      }
    }
  } catch (error) {
    console.error("Error setting up navbar:", error);
  }
}
