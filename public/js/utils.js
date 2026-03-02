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
            <a href="/requests.html" class="hover:text-blue-100">Requests</a>
            <a href="/ledger.html" class="hover:text-blue-100">Ledger</a>
            <a href="/profile.html" class="bg-white text-blue-700 hover:bg-blue-100 px-4 py-2 rounded">Profile</a>
          </div>
        </div>
      </nav>
    `;

    container.innerHTML = navbarHTML;
  } catch (error) {
    console.error("Error setting up navbar:", error);
  }
}
