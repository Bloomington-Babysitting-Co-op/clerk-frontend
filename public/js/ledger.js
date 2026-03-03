import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { formatDateTime } from "./utils.js";

function toCsvValue(value) {
  const asString = value == null ? "" : String(value);
  if (asString.includes(",") || asString.includes("\"") || asString.includes("\n")) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

function downloadCsv(filename, rows) {
  const content = rows.map(row => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function listLedgerInto(containerId, options = {}) {
  await requireAuth();

  const { startDate = null, endDate = null, showEditLinks = false } = options;

  const { data, error } = await supabase.rpc("rpc_list_ledger_entries_filtered", {
    p_start_date: startDate,
    p_end_date: endDate
  });

  const el = document.getElementById(containerId);

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  el.innerHTML = data.length
    ? data.map(e => `
      <div class="bg-white border p-4 rounded-lg shadow">
        <p class="font-semibold text-gray-800">${formatDateTime(e.entry_date)}</p>
        <p class="text-lg text-blue-600 font-bold mt-2">${e.hours} hours</p>
        <p class="text-sm text-gray-600 mt-1">${e.from_family_name || e.from_family_id} → ${e.to_family_name || e.to_family_id}</p>
        ${showEditLinks ? `<div class="mt-2"><a href="/entry_edit.html?id=${e.id}" class="text-blue-600 underline text-sm">Edit Entry</a></div>` : ""}
      </div>
    `).join("")
    : "<p class='text-gray-600'>No ledger entries yet.</p>";

  return data;
}

async function loadLedgerBalancesInto(containerId) {
  const { data, error } = await supabase.rpc("rpc_list_ledger_balances");
  const el = document.getElementById(containerId);

  if (!el) return;

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  el.innerHTML = data.length
    ? data.map(row => `
      <div class="flex justify-between border-b py-2 text-sm">
        <span class="font-medium">${row.name || row.family_id}</span>
        <span class="font-semibold ${Number(row.hours_balance) < 0 ? "text-red-600" : "text-green-700"}">${Number(row.hours_balance).toFixed(2)} hrs</span>
      </div>
    `).join("")
    : "<p class='text-gray-600'>No balances available.</p>";
}

async function mountLedgerPage() {
  await requireAuth();

  const startInput = document.getElementById("ledger-start-date");
  const endInput = document.getElementById("ledger-end-date");
  const applyBtn = document.getElementById("ledger-apply-filter-btn");
  const exportBtn = document.getElementById("ledger-export-csv-btn");
  const ledgerError = document.getElementById("ledger-error");

  const { data: isAdmin } = await supabase.rpc("rpc_get_admin_status");

  const now = new Date();
  const defaultStartDate = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEndDate = toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  if (startInput) {
    startInput.value = defaultStartDate;
  }

  if (endInput) {
    endInput.value = defaultEndDate;
  }

  let currentRows = await listLedgerInto("ledger-list", {
    startDate: startInput?.value || null,
    endDate: endInput?.value || null,
    showEditLinks: !!isAdmin
  });
  await loadLedgerBalancesInto("ledger-balances");

  if (applyBtn) {
    applyBtn.onclick = async () => {
      try {
        ledgerError.textContent = "";
        const startDate = startInput?.value || null;
        const endDate = endInput?.value || null;
        currentRows = await listLedgerInto("ledger-list", { startDate, endDate, showEditLinks: !!isAdmin });
      } catch (error) {
        ledgerError.textContent = error.message;
      }
    };
  }

  if (exportBtn) {
    exportBtn.onclick = () => {
      if (!currentRows || !currentRows.length) {
        ledgerError.textContent = "No rows to export for selected date range.";
        return;
      }
      ledgerError.textContent = "";
      const rows = [
        ["id", "request_id", "entry_date", "hours", "from_family_id", "to_family_id"],
        ...currentRows.map(row => [row.id, row.request_id || "", row.entry_date, row.hours, row.from_family_id, row.to_family_id])
      ];
      downloadCsv("ledger_export.csv", rows);
    };
  }
}

window.listLedgerInto = listLedgerInto;
window.mountLedgerPage = mountLedgerPage;
window.loadLedgerBalancesInto = loadLedgerBalancesInto;

// Module exports
export { listLedgerInto, loadLedgerBalancesInto, mountLedgerPage };
