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
      <div class="border p-4 mb-2">
        <p>${formatDateTime(e.timestamp)}</p>
        <p>${e.hours} hours</p>
        <p>${e.from_user} → ${e.to_user}</p>
      </div>
    `).join("")
    : "<p>No ledger entries yet.</p>";
}

window.listLedgerInto = listLedgerInto;
