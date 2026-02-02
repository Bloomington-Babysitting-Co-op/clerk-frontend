import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { formatDateTime } from "./utils.js";

async function listLedgerInto(containerId) {
  await requireAuth();

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("timestamp, hours, from_user, to_user")
    .order("timestamp", { ascending: false });

  const el = document.getElementById(containerId);

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  el.innerHTML = data.length
    ? data.map(e => `
      <div class="bg-white border p-4 rounded-lg shadow">
        <p class="font-semibold text-gray-800">${formatDateTime(e.timestamp)}</p>
        <p class="text-lg text-blue-600 font-bold mt-2">${e.hours} hours</p>
        <p class="text-sm text-gray-600 mt-1">${e.from_user} → ${e.to_user}</p>
      </div>
    `).join("")
    : "<p class='text-gray-600'>No ledger entries yet.</p>";
}

window.listLedgerInto = listLedgerInto;

// Module exports
export { listLedgerInto };
