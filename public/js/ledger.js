import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { downloadCsv, setFormError, toDateInputValue, toDateOnlyString, formatDateOnly, escapeHtml } from "./utils.js";

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
    ? data.map(e => {
      const dateDisplay = formatDateOnly(e.entry_date) || "";
      const fromTo = `${e.from_family_name || e.from_family_id || ''} → ${e.to_family_name || e.to_family_id || ''}`;
      const notes = e.notes || "";
      const createdBy = e.request_id
        ? `<a href="/request-view.html?id=${encodeURIComponent(e.request_id)}" class="text-sm text-blue-600 hover:underline" rel="noopener" aria-label="View request">Created by: ${escapeHtml(e.email)}</a>`
        : `<span class="text-sm text-red-600">Created by Admin: ${escapeHtml(e.email)}</span>`;

      return `
      <div class="py-3">
        <div class="grid grid-cols-1 md:flex md:items-center md:gap-3">
          <div class="text-sm text-gray-800 font-medium md:flex-none">${escapeHtml(dateDisplay)}</div>
          <div class="text-lg text-blue-600 font-bold md:flex-none">${escapeHtml(String(e.hours))} hrs</div>
          <div class="text-sm text-gray-800 md:flex-none">${escapeHtml(fromTo)}</div>
          <div class="text-sm text-gray-800 truncate md:flex-1 md:mx-2">${escapeHtml(notes)}</div>
          <div class="text-right md:flex-none">${createdBy}</div>
        </div>
      </div>
    `}).join('<hr class="border-t border-gray-200 my-2"/>')
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

  const now = new Date();
  const defaultStartDate = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEndDate = toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  if (startInput) {
    startInput.value = defaultStartDate;
  }

  if (endInput) {
    endInput.value = defaultEndDate;
  }

  const familySelect = document.getElementById("ledger-family-select");
  if (familySelect) {
    try {
      const { data: familiesData, error: familiesError } = await supabase.rpc("rpc_list_families_for_entry");
      if (!familiesError && Array.isArray(familiesData)) {
        familiesData.forEach((f) => {
          const opt = document.createElement("option");
          opt.value = f.id;
          opt.textContent = f.name || f.id;
          familySelect.appendChild(opt);
        });
      }
    } catch (e) {
      // ignore
    }
  }

  let currentRows = await listLedgerInto("ledger-list", {
    startDate: startInput?.value || null,
    endDate: endInput?.value || null,
    familyId: familySelect?.value || null
  });
  await loadLedgerBalancesInto("ledger-balances");

  if (applyBtn) {
    applyBtn.onclick = async () => {
      try {
        setFormError(ledgerError, "");
        const startDate = startInput?.value || null;
        const endDate = endInput?.value || null;
        currentRows = await listLedgerInto("ledger-list", { startDate, endDate, familyId: familySelect?.value || null });
      } catch (error) {
        setFormError(ledgerError, error.message);
      }
    };
  }

  if (exportBtn) {
    // default to bg-green-600
    exportBtn.classList.add("bg-green-600");
    exportBtn.onclick = () => {
      const prevAria = exportBtn.getAttribute("aria-label");
      const prevDisabled = exportBtn.disabled;
      exportBtn.setAttribute("aria-label", "Exporting...");
      exportBtn.classList.remove("bg-green-600");
      exportBtn.classList.add("bg-green-300");
      exportBtn.disabled = true;
      setTimeout(() => {
        if (prevAria === null) exportBtn.removeAttribute("aria-label"); else exportBtn.setAttribute("aria-label", prevAria);
        exportBtn.classList.remove("bg-green-300");
        exportBtn.classList.add("bg-green-600");
        exportBtn.disabled = prevDisabled;
      }, 2000);

      if (!currentRows || !currentRows.length) {
        setFormError(ledgerError, "No rows to export for selected date range.");
        return;
      }
      setFormError(ledgerError, "");
      const rows = [
        ["id", "entry_date", "hours", "from_family_name", "to_family_name", "notes", "request_id"],
        ...currentRows.map(row => [
          row.id,
          toDateOnlyString(row.entry_date),
          row.hours,
          row.from_family_name || row.from_family_id || "",
          row.to_family_name || row.to_family_id || "",
          row.notes || "",
          row.request_id || ""
        ])
      ];
      downloadCsv("ledger_export.csv", rows);
    };
  }
}

export { listLedgerInto, loadLedgerBalancesInto, mountLedgerPage };
