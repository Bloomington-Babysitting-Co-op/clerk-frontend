import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  setupNavbar,
  escapeHtml,
  formatDateOnly,
  toDateInputValue,
  toDateOnlyString,
  downloadCsv,
  withButtonBusy,
  setFormError,
  hasAdmin,
  mountMultiselect,
  normalizeDateRangeInputs
} from "./utils.js";
let stickyColumnObserver = null;

function formatMonthLabel(monthStart) {
  const [year, month] = String(monthStart).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Pivot long-form balance rows into month columns (newest first) and one entry per family.
function pivotLedgerBalances(rows) {
  const monthKeys = [];
  const families = [];
  const familyIndex = new Map();

  (rows || []).forEach((row) => {
    const monthKey = String(row.month_start).slice(0, 10);
    if (!monthKeys.includes(monthKey)) monthKeys.push(monthKey);

    let family = familyIndex.get(row.id);
    if (!family) {
      family = { id: row.id, name: row.name, hours_balance: row.hours_balance, byMonth: {} };
      familyIndex.set(row.id, family);
      families.push(family);
    }
    family.byMonth[monthKey] = row;
  });

  monthKeys.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const months = monthKeys.map((key) => ({ key, label: formatMonthLabel(key) }));
  return { months, families };
}

function formatLedgerTypeLabel(type) {
  const normalized = String(type || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "ad_hoc") return "Ad Hoc";
  if (normalized === "request") return "Request";
  if (normalized === "admin") return "Admin";
  return type || "";
}

function renderLedgerDeleteIcon(entry, isAdmin, myFamilyId) {
  const ownFamilyEntry = entry.created_by_family_id != null && myFamilyId != null
    && String(entry.created_by_family_id) === String(myFamilyId);
  if (!isAdmin && !ownFamilyEntry) return "";

  const canDelete = !!entry.can_delete;
  const colorClass = canDelete
    ? "text-red-600 hover:text-red-800"
    : "text-gray-300";
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;

  if (!canDelete) {
    return `<span class="${colorClass} inline-flex" title="No longer eligible for deletion">${icon}</span>`;
  }

  return `<button type="button" class="${colorClass} inline-flex" data-delete-ledger-id="${escapeHtml(String(entry.id))}" title="Delete this ledger entry">${icon}</button>`;
}

async function deleteLedgerEntry(entry) {
  const message = `Delete this ledger entry?\n\nDate: ${formatDateOnly(entry.date) || ""}\nHours: ${Number(entry.hours).toFixed(2)}\nFrom \u2192 To: ${entry.from_family_name || "N/A"} \u2192 ${entry.to_family_name || "N/A"}\nNotes: ${entry.notes || "(none)"}`;

  if (!window.confirm(message)) return;

  const { error } = await supabase.rpc("rpc_delete_ledger_entry", { p_entry_id: entry.id });

  if (error) {
    setFormError("ledger-error", error.message);
    return;
  }

  window.location.reload();
}

function renderLedgerBalances(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (stickyColumnObserver) {
    stickyColumnObserver.disconnect();
    stickyColumnObserver = null;
  }

  if (!data || !data.length) {
    el.innerHTML = "<p class='text-gray-600'>No balances available.</p>";
    return;
  }

  const { months, families } = pivotLedgerBalances(data);

  const fmt = (v, pair) => {
    const n = Number(v);
    const color = n > 0 ? 'text-green-600' : n < 0 ? 'text-red-600' : 'text-gray-600';
    return pair !== undefined && n === 0 && Number(pair) === 0 ? color + ' bg-gray-100' : color;
  };
  const nbr = (v) => Number(v || 0).toFixed(2);

  // Sticky cells need an opaque background so scrolled month columns don't show through.
  const sticky1 = "sticky left-0 z-10 bg-white";
  const sticky2 = "sticky z-10 bg-white shadow-[inset_-1px_0_0_#e5e7eb]";

  const monthCells = (row) => months.map(({ key }) => {
    const m = row.byMonth[key] || {};
    return `
              <td class="px-2 py-2 border-l ${fmt(m.credits, m.debits)}">${nbr(m.credits)}</td>
              <td class="px-2 py-2 ${fmt(m.debits, m.credits)}">${nbr(m.debits)}</td>
              <td class="px-2 py-2 ${fmt(m.admin)}">${nbr(m.admin)}</td>
              <td class="px-2 py-2 ${fmt(m.start_balance)}">${nbr(m.start_balance)}</td>`;
  }).join('');

  el.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm whitespace-nowrap">
        <thead>
          <tr class="text-left">
            <th class="${sticky1} px-2 py-1 font-medium align-bottom" rowspan="2" data-sticky-col="1">Family Name</th>
            <th class="${sticky2} px-2 py-1 font-medium align-bottom" rowspan="2" data-sticky-col="2">Hours Balance</th>
            ${months.map(({ label }) => `<th class="px-2 py-1 font-medium text-center border-l" colspan="4"><span class="block w-full bg-blue-50 rounded-full px-4 py-0.5" style="letter-spacing: 0.3em">${escapeHtml(label)}</span></th>`).join('')}
          </tr>
          <tr class="text-left">
            ${months.map(() => `
            <th class="px-2 py-1 font-medium border-l">Credits</th>
            <th class="px-2 py-1 font-medium">Debits</th>
            <th class="px-2 py-1 font-medium">Admin</th>
            <th class="px-2 py-1 font-medium">Start Balance</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${families.map(row => `
            <tr class="border-t">
              <td class="${sticky1} px-2 py-2" data-sticky-col="1">${escapeHtml(row.name)}</td>
              <td class="${sticky2} px-2 py-2 font-semibold ${fmt(row.hours_balance)}" data-sticky-col="2">${nbr(row.hours_balance)}</td>
              ${monthCells(row)}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // The second locked column sits immediately right of the first, whose width depends on the family names.
  const firstCol = el.querySelector('th[data-sticky-col="1"]');
  const secondColCells = el.querySelectorAll('[data-sticky-col="2"]');
  const positionSecondCol = () => {
    const left = `${firstCol.getBoundingClientRect().width}px`;
    secondColCells.forEach((cell) => { cell.style.left = left; });
  };
  positionSecondCol();
  if (firstCol && typeof ResizeObserver !== "undefined") {
    stickyColumnObserver = new ResizeObserver(positionSecondCol);
    stickyColumnObserver.observe(firstCol);
  }
}

async function loadLedgerBalancesInto(containerId, startDate = null, endDate = null, familyId = null) {
  const { data, error } = await supabase.rpc("rpc_list_ledger_balances_filtered", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_family_id: familyId
  });
  const el = document.getElementById(containerId);

  if (!el) return [];

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${escapeHtml(error.message)}</p>`;
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  renderLedgerBalances(containerId, rows);
  return rows;
}

async function listLedgerInto(containerId, options = {}) {
  await requireAuth();

  const { startDate = null, endDate = null, familyId = null, direction = null, types = null } = options;

  const [{ data, error }, isAdmin, { data: myFamilyId }] = await Promise.all([
    supabase.rpc("rpc_list_ledger_entries_filtered", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_family_id: familyId,
      p_direction: direction,
      p_types: types
    }),
    hasAdmin(),
    supabase.rpc("rpc_my_family_id")
  ]);

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
            <th class="px-2 py-1 font-medium whitespace-nowrap">Date</th>
            <th class="px-2 py-1 font-medium whitespace-nowrap">Hours</th>
            <th class="px-2 py-1 font-medium whitespace-nowrap">From → To</th>
            <th class="px-2 py-1 font-medium w-full">Notes</th>
            <th class="px-2 py-1 font-medium whitespace-nowrap">Created By</th>
            <th class="px-2 py-1 font-medium text-center"><span class="sr-only">Delete</span></th>
          </tr>
        </thead>
        <tbody>
          ${data.map(e => `
            <tr class="border-t">
              <td class="px-2 py-2 whitespace-nowrap">${escapeHtml(formatDateOnly(e.date) || "")}</td>
              <td class="px-2 py-2 whitespace-nowrap">${Number(e.hours).toFixed(2)}</td>
              <td class="px-2 py-2 whitespace-nowrap">
                <span class="${e.from_family_name === null ? 'text-red-600' : ''}">${escapeHtml(e.from_family_name || 'N/A')}</span>
                <span class="px-1">→</span>
                <span class="${e.to_family_name === null ? 'text-red-600' : ''}">${escapeHtml(e.to_family_name || 'N/A')}</span>
              </td>
              <td class="px-2 py-2 min-w-48">${escapeHtml(e.notes || "")}</td>
              <td class="px-2 py-2 whitespace-nowrap">${e.request_id
                ? `<a href="/request-view.html?id=${encodeURIComponent(e.request_id)}" class="text-blue-600 hover:underline" rel="noopener" aria-label="View request">${escapeHtml(e.email)}</a>`
                : `<span>${escapeHtml(e.email)} (${escapeHtml(formatLedgerTypeLabel(e.type))})</span>`}
                </td>
              <td class="px-2 py-2 text-center">${renderLedgerDeleteIcon(e, isAdmin, myFamilyId)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
    : "<p class='text-gray-600'>No ledger entries yet.</p>";

  el.querySelectorAll('[data-delete-ledger-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = data.find((e) => String(e.id) === btn.getAttribute('data-delete-ledger-id'));
      if (entry) deleteLedgerEntry(entry);
    });
  });

  return data;
}

async function mountLedgerPage() {
  setupNavbar("navbar");

  const startInput = document.getElementById("ledger-start-date");
  const endInput = document.getElementById("ledger-end-date");
  const familySelect = document.getElementById("ledger-family-select");
  const directionSelect = document.getElementById("ledger-direction-select");
  const applyBtn = document.getElementById("ledger-apply-filter-btn");
  const exportBtn = document.getElementById("ledger-export-csv-btn");
  const ledgerError = document.getElementById("ledger-error");

  const now = new Date();

  if (startInput) startInput.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  if (endInput) endInput.value = "";

  const typeFilter = mountMultiselect(document.getElementById("ledger-type-filter"), {
    label: "Types",
    options: [
      { value: "babysit", label: "Babysit", checked: true },
      { value: "drive", label: "Drive", checked: true },
      { value: "favor", label: "Favor", checked: true },
      { value: "ad_hoc", label: "Ad Hoc", checked: true },
      { value: "admin", label: "Admin", checked: false }
    ]
  });

  const syncDirectionState = () => {
    if (!directionSelect) return;
    directionSelect.disabled = !familySelect?.value;
    if (directionSelect.disabled) directionSelect.value = "";
  };
  familySelect?.addEventListener("change", syncDirectionState);
  syncDirectionState();

  await requireAuth();

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

  const getEntryFilters = () => {
    normalizeDateRangeInputs(startInput, endInput);
    return {
      startDate: startInput?.value || null,
      endDate: endInput?.value || null,
      familyId: familySelect?.value || null,
      direction: directionSelect?.value || null,
      types: typeFilter.getSelected()
    };
  };

  const initialFilters = getEntryFilters();
  let currentBalances = await loadLedgerBalancesInto("ledger-balances", initialFilters.startDate, initialFilters.endDate, initialFilters.familyId);
  let currentRows = await listLedgerInto("ledger-list", initialFilters);

  if (applyBtn) {
    applyBtn.onclick = async () => {
      try {
        setFormError(ledgerError, "");
        const filters = getEntryFilters();
        currentBalances = await loadLedgerBalancesInto('ledger-balances', filters.startDate, filters.endDate, filters.familyId);
        currentRows = await listLedgerInto("ledger-list", filters);
      } catch (error) {
        setFormError(ledgerError, error.message);
      }
    };
  }

  if (exportBtn) {
    exportBtn.onclick = () => withButtonBusy(exportBtn, "Exporting...", async () => {
      if (!currentRows || !currentRows.length) {
        setFormError(ledgerError, "No rows to export for selected filters.");
        return;
      }
      setFormError(ledgerError, "");
      // Build balances header & rows from the currently-applied filters
      const { months, families } = pivotLedgerBalances(currentBalances);
      const n2 = (v) => Number(v || 0).toFixed(2);
      const balancesHeader = [
        "Family Name",
        "Hours Balance",
        ...months.flatMap(({ label }) => [`${label} Credits`, `${label} Debits`, `${label} Admin`, `${label} Start Balance`])
      ];
      const balancesRows = families.map(f => [
        f.name || "",
        n2(f.hours_balance),
        ...months.flatMap(({ key }) => {
          const m = f.byMonth[key] || {};
          return [n2(m.credits), n2(m.debits), n2(m.admin), n2(m.start_balance)];
        })
      ]);

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
    }, {
      ariaLabel: "Exporting...",
      busyClass: "bg-green-300",
      idleClass: "bg-green-600",
      minDurationMs: 2000
    });
  }
}

export { loadLedgerBalancesInto, listLedgerInto, mountLedgerPage };
