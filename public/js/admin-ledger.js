import { supabase } from "./supabase.js";
import { isAdminUiEnabled, setFormError } from "./utils.js";

async function loadFamilies() {
  const { data, error } = await supabase.rpc("rpc_admin_list_families");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function populateMultiSelect(selectEl, families) {
  selectEl.innerHTML = families.map(f => `<option value="${f.id}">${f.name || f.id}</option>`).join("");
}

function getSelectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map(opt => opt.value);
}

function isDivisibleByQuarter(num) {
  return Math.abs((num * 100) % 25) < 1e-6;
}

async function mountAdminEntriesPage() {
  if (!(await isAdminUiEnabled())) {
    window.location.href = "/profile.html";
    return;
  }
  const fromSelect = document.getElementById("from-families");
  const toSelect = document.getElementById("to-families");
  const hoursInput = document.getElementById("mass-entry-hours");
  const dateInput = document.getElementById("mass-entry-date");
  const notesInput = document.getElementById("mass-entry-notes");
  const form = document.getElementById("mass-ledger-form");
  const errorEl = document.getElementById("mass-entry-error");
  const successEl = document.getElementById("mass-entry-success");

  const families = await loadFamilies();
  populateMultiSelect(fromSelect, families);
  populateMultiSelect(toSelect, families);

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    successEl.textContent = "";
    const fromFamilies = getSelectedValues(fromSelect);
    const toFamilies = getSelectedValues(toSelect);
    const hours = parseFloat(hoursInput.value);
    const entryDate = dateInput.value;
    const notes = notesInput.value;

    if ((!fromFamilies.length && !toFamilies.length) || !hours || !entryDate) {
      setFormError(errorEl, "Select at least one 'From' or 'To' family, and enter hours and date.");
      return;
    }
    if (!isDivisibleByQuarter(hours)) {
      setFormError(errorEl, "Hours must be divisible by 0.25.");
      return;
    }

    // Prepare all pairs
    const pairs = [];
    if (fromFamilies.length && toFamilies.length) {
      fromFamilies.forEach(fromId => {
        toFamilies.forEach(toId => {
          pairs.push({ from_family_id: fromId, to_family_id: toId });
        });
      });
    } else if (fromFamilies.length) {
      fromFamilies.forEach(fromId => {
        pairs.push({ from_family_id: fromId, to_family_id: null });
      });
    } else if (toFamilies.length) {
      toFamilies.forEach(toId => {
        pairs.push({ from_family_id: null, to_family_id: toId });
      });
    }

    let created = 0, failed = 0;
    for (const pair of pairs) {
      const { error } = await supabase.rpc("rpc_admin_create_ledger_entry", {
        p_from_family_id: pair.from_family_id,
        p_to_family_id: pair.to_family_id,
        p_hours: hours,
        p_entry_date: entryDate,
        p_notes: notes
      });
      if (error) failed++;
      else created++;
    }
    if (created) successEl.textContent = `Created ${created} ledger entr${created === 1 ? 'y' : 'ies'}.`;
    if (failed) setFormError(errorEl, `Failed to create ${failed} entr${failed === 1 ? 'y' : 'ies'}.`);
  };
}

export { mountAdminEntriesPage };
