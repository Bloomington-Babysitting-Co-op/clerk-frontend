import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  setupNavbar,
  escapeHtml,
  formatDateOnly,
  toDateInputValue,
  toDateOnlyString,
  downloadCsv,
  setButtonTemporaryBusy,
  setFormError
} from "./utils.js";
// Client-side cache for ledger balances to enable fast filtering by family
let ledgerBalancesCache = null;

function formatLedgerTypeLabel(type) {
  const normalized = String(type || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "ad_hoc") return "Ad Hoc";
  if (normalized === "request") return "Request";
  if (normalized === "admin") return "Admin";
  return type || "";
}

function renderLedgerBalances(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!data || !data.length) {
    el.innerHTML = "<p class='text-gray-600'>No balances available.</p>";
    return;
  }

  el.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left">
            <th class="px-2 py-1 font-medium">Family Name</th>
            <th class="px-2 py-1 font-medium">Active This Month</th>
            <th class="px-2 py-1 font-medium">Hours Balance</th>
            <th class="px-2 py-1 font-medium">Month Start Balance</th>
            <th class="px-2 py-1 font-medium">Prior Month Start Balance</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr class="border-b">
              <td class="px-2 py-2">${escapeHtml(row.name)}</td>
              <td class="px-2 py-2 ${row.active_this_month ? 'text-green-600' : 'text-red-600'}">${row.active_this_month ? 'Yes' : 'No'}</td>
              <td class="px-2 py-2 ${Number(row.hours_balance) < 0 ? 'text-red-600' : 'text-green-600'} font-semibold">${Number(row.hours_balance).toFixed(2)} hours</td>
              <td class="px-2 py-2 ${Number(row.month_start_balance) < 0 ? 'text-red-600' : 'text-green-600'}">${Number(row.month_start_balance).toFixed(2)} hours</td>
              <td class="px-2 py-2 ${Number(row.prior_month_start_balance) < 0 ? 'text-red-600' : 'text-green-600'}">${Number(row.prior_month_start_balance).toFixed(2)} hours</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadLedgerBalancesInto(containerId) {
  const { data, error } = await supabase.rpc("rpc_list_ledger_balances");
  const el = document.getElementById(containerId);

  if (!el) return;

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    ledgerBalancesCache = [];
    return;
  }

  ledgerBalancesCache = Array.isArray(data) ? data : [];
  renderLedgerBalances(containerId, ledgerBalancesCache);
  return ledgerBalancesCache;
}

async function filterLedgerBalancesByFamily(containerId, familyId) {
  if (ledgerBalancesCache === null) {
    await loadLedgerBalancesInto(containerId);
  }

  if (!Array.isArray(ledgerBalancesCache)) {
    renderLedgerBalances(containerId, []);
    return [];
  }

  if (!familyId) {
    renderLedgerBalances(containerId, ledgerBalancesCache);
    return ledgerBalancesCache;
  }

  const sel = document.getElementById('ledger-family-select');
  const selectedText = sel ? sel.options[sel.selectedIndex]?.textContent : null;

  const filtered = ledgerBalancesCache.filter(row => {
    if (row.id !== undefined && row.id !== null) return String(row.id) === String(familyId);
    if (row.family_id !== undefined && row.family_id !== null) return String(row.family_id) === String(familyId);
    if (selectedText) return String(row.name) === String(selectedText);
    return false;
  });

  renderLedgerBalances(containerId, filtered);
  return filtered;
}

async function listLedgerInto(containerId, options = {}) {
  await requireAuth();

  const { startDate = null, endDate = null, familyId = null } = options;

  const { data, error } = await supabase.rpc("rpc_list_ledger_entries_filtered", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_family_id: familyId
  });

  const el = document.getElementById(containerId);

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  el.innerHTML = data.length
    ? `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left">
            <th class="px-2 py-1 font-medium">Date</th>
            <th class="px-2 py-1 font-medium">Hours</th>
            <th class="px-2 py-1 font-medium">From → To</th>
            <th class="px-2 py-1 font-medium">Notes</th>
            <th class="px-2 py-1 font-medium">Created By</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(e => `
            <tr class="border-b">
              <td class="px-2 py-2">${escapeHtml(formatDateOnly(e.date) || "")}</td>
              <td class="px-2 py-2">${Number(e.hours).toFixed(2)}</td>
              <td class="px-2 py-2">
                <span class="${e.from_family_name === null ? 'text-red-600' : ''}">${escapeHtml(e.from_family_name || 'N/A')}</span>
                <span class="px-1">→</span>
                <span class="${e.to_family_name === null ? 'text-red-600' : ''}">${escapeHtml(e.to_family_name || 'N/A')}</span>
              </td>
              <td class="px-2 py-2 md:w-1/2">${escapeHtml(e.notes || "")}</td>
              <td class="px-2 py-2">${e.request_id
                ? `<a href="/request-view.html?id=${encodeURIComponent(e.request_id)}" class="text-blue-600 hover:underline" rel="noopener" aria-label="View request">${escapeHtml(e.email)}</a>`
                : `<span>${escapeHtml(e.email)} (${escapeHtml(formatLedgerTypeLabel(e.type))})</span>`}
                </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
    : "<p class='text-gray-600'>No ledger entries yet.</p>";

  return data;
}

async function mountLedgerPage() {
  setupNavbar("navbar");
  await requireAuth();

  const startInput = document.getElementById("ledger-start-date");
  const endInput = document.getElementById("ledger-end-date");
  const familySelect = document.getElementById("ledger-family-select");
  const applyBtn = document.getElementById("ledger-apply-filter-btn");
  const exportBtn = document.getElementById("ledger-export-csv-btn");
  const ledgerError = document.getElementById("ledger-error");

  const now = new Date();

  if (startInput) startInput.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  if (endInput) endInput.value = "";

  // Populate family select
  if (familySelect) {
    try {
      const { data: familiesData, error: familiesError } = await supabase.rpc("rpc_list_families_all");
      if (!familiesError && Array.isArray(familiesData)) {
        familiesData.sort((a, b) => (b.is_my_family ? 1 : 0) - (a.is_my_family ? 1 : 0));
        familiesData.forEach((f) => {
          const opt = document.createElement("option");
          opt.value = f.id;
          opt.textContent = f.name || f.id;
          familySelect.appendChild(opt);
        });
      }
    } catch (e) {
      // ignore population errors — select stays as "All Families"
    }
  }

  await loadLedgerBalancesInto("ledger-balances");

  let appliedFamily = null;

  let currentRows = await listLedgerInto("ledger-list", {
    startDate: startInput?.value || null,
    endDate: endInput?.value || null,
    familyId: familySelect?.value || null
  });

  if (applyBtn) {
    applyBtn.onclick = async () => {
      try {
        setFormError(ledgerError, "");
        const startDate = startInput?.value || null;
        const endDate = endInput?.value || null;
        appliedFamily = familySelect?.value || null;
        await filterLedgerBalancesByFamily('ledger-balances', appliedFamily);
        currentRows = await listLedgerInto("ledger-list", { startDate, endDate, familyId: appliedFamily });
      } catch (error) {
        setFormError(ledgerError, error.message);
      }
    };
  }

  if (exportBtn) {
    exportBtn.onclick = async () => {
      setButtonTemporaryBusy(exportBtn);

      if (!currentRows || !currentRows.length) {
        setFormError(ledgerError, "No rows to export for selected filters.");
        return;
      }
      setFormError(ledgerError, "");
      // Build balances header & rows (filtered by currently-selected family)
      const balancesHeader = ["Family Name", "Active This Month", "Hours Balance", "Month Start Balance", "Prior Month Start Balance"];
      let balancesRows = [];
      try {
        const filteredBalances = await filterLedgerBalancesByFamily('ledger-balances', appliedFamily);
        balancesRows = Array.isArray(filteredBalances) ? filteredBalances.map(b => [
          b.name || "",
          b.active_this_month ? 'Yes' : 'No',
          Number(b.hours_balance || 0).toFixed(2) + ' hours',
          Number(b.month_start_balance || 0).toFixed(2) + ' hours',
          Number(b.prior_month_start_balance || 0).toFixed(2) + ' hours'
        ]) : [];
      } catch (e) {
        balancesRows = [];
      }

      // Build entries header & rows
      const entriesHeader = ["ID", "Date", "Hours", "From Family Name", "To Family Name", "Notes", "Created By", "Request ID"];
      const entriesRows = Array.isArray(currentRows) ? currentRows.map(row => [
        row.id,
        toDateOnlyString(row.date),
        row.hours,
        row.from_family_name || "",
        row.to_family_name || "",
        row.notes || "",
        row.email || "",
        row.request_id || ""
      ]) : [];

      const hasEntries = entriesRows && entriesRows.length;
      const hasBalances = balancesRows && balancesRows.length;
      if (!hasEntries && !hasBalances) {
        setFormError(ledgerError, "No rows to export for selected filters.");
        return;
      }

      // Pad balance rows so every row has the same number of columns as entries
      const padCount = Math.max(0, entriesHeader.length - balancesHeader.length);
      const paddedBalancesHeader = [...balancesHeader, ...Array(padCount).fill("")];
      const paddedBalancesRows = balancesRows.map(r => [...r, ...Array(padCount).fill("")]);

      const fullColCount = entriesHeader.length;
      const emptySeparator = Array(fullColCount).fill("");

      const combinedRows = [
        paddedBalancesHeader,
        ...paddedBalancesRows,
        emptySeparator,
        entriesHeader,
        ...entriesRows
      ];

      downloadCsv("ledger_export.csv", combinedRows);
    };
  }
}

export { loadLedgerBalancesInto, listLedgerInto, mountLedgerPage };
