import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";

function populateUserOptions(selectEl, families, selectedValue = "") {
  selectEl.innerHTML = families
    .map((family) => `<option value="${family.id}" ${family.id === selectedValue ? "selected" : ""}>${family.name}</option>`)
    .join("");
}

function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || "";
}

async function ensureAdmin() {
  await requireAuth();
  const { data, error } = await supabase.rpc("rpc_is_admin");
  if (error) throw error;
  if (!data) {
    throw new Error("Admin access required.");
  }
}

async function loadFormData() {
  const [{ data: families, error: familiesError }, { data: completed, error: completedError }] = await Promise.all([
    supabase.rpc("rpc_list_families_for_entry"),
    supabase.rpc("rpc_list_completed_sits_for_prefill")
  ]);

  if (familiesError) throw familiesError;
  if (completedError) throw completedError;

  return { families: families || [], completed: completed || [] };
}

function wirePrefill(completed, fromSelect, toSelect, hoursInput, entryDateInput) {
  const prefillSelect = document.getElementById("prefill-request");
  if (!prefillSelect) return;

  prefillSelect.onchange = () => {
    const selected = completed.find(item => item.request_id === prefillSelect.value);
    if (!selected) return;
    fromSelect.value = selected.from_family_id;
    toSelect.value = selected.to_family_id;
    if (selected.hours != null) {
      hoursInput.value = Number(selected.hours).toFixed(2);
    }
    if (selected.completed_at) {
      const dt = new Date(selected.completed_at);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      const mm = String(dt.getMinutes()).padStart(2, "0");
      entryDateInput.value = `${y}-${m}-${d}T${hh}:${mm}`;
    }
  };
}

function parseEntryDate(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function validateEntry(fromFamilyId, toFamilyId, hoursValue, entryDateValue) {
  if (!fromFamilyId || !toFamilyId) return "Both families are required.";
  if (fromFamilyId === toFamilyId) return "From and To families must be different.";
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours) || hours <= 0) return "Hours must be greater than zero.";
  if (!entryDateValue) return "Entry date is required.";
  return "";
}

async function mountNewEntryPage() {
  try {
    await requireAuth();
    const { data: currentFamilyId, error: currentFamilyError } = await supabase.rpc("rpc_current_family_id");
    if (currentFamilyError) throw currentFamilyError;
    if (!currentFamilyId) throw new Error("Unable to resolve current family.");
    const { data: isAdmin, error: adminError } = await supabase.rpc("rpc_is_admin");
    if (adminError) throw adminError;

    const { families, completed } = await loadFormData();

    const adminOnlyNote = document.getElementById("entry-admin-note");
    const prefillSelect = document.getElementById("prefill-request");
    const fromSelect = document.getElementById("from-user");
    const toSelect = document.getElementById("to-user");
    const hoursInput = document.getElementById("hours");
    const entryDateInput = document.getElementById("entry-date");
    const toUserHelp = document.getElementById("to-user-help");
    const entryDateHelp = document.getElementById("entry-date-help");
    const createBtn = document.getElementById("create-entry-btn");

    if (adminOnlyNote) {
      adminOnlyNote.style.display = isAdmin ? "block" : "none";
    }

    const prefillItems = isAdmin
      ? completed
      : completed.filter(item => item.to_family_id === currentFamilyId);

    prefillSelect.innerHTML = [
      "<option value=''>Manual / Free Form</option>",
      ...prefillItems.map(item => {
        const ts = item.completed_at ? new Date(item.completed_at).toLocaleString() : "Unknown time";
        const notes = item.notes || "No notes";
        return `<option value="${item.request_id}">${ts} — ${notes}</option>`;
      })
    ].join("");

    populateUserOptions(fromSelect, families);
    const currentFamily = families.find((family) => family.id === currentFamilyId);
    populateUserOptions(toSelect, families, isAdmin ? "" : currentFamilyId);

    if (!isAdmin) {
      toSelect.value = currentFamilyId;
      toSelect.disabled = true;
      if (toUserHelp) {
        toUserHelp.textContent = `Recipient is fixed to you (${currentFamily?.name || "current user"}).`;
      }
      if (entryDateHelp) {
        entryDateHelp.textContent = "Entry date is required.";
      }
    } else {
      toSelect.disabled = false;
      if (toUserHelp) {
        toUserHelp.textContent = "As admin, you can set recipient to any family.";
      }
      if (entryDateHelp) {
        entryDateHelp.textContent = "Entry date is required.";
      }
    }

    wirePrefill(prefillItems, fromSelect, toSelect, hoursInput, entryDateInput);

    createBtn.onclick = async () => {
      setError("entry-error", "");
      const requestId = prefillSelect.value || null;
      const fromFamilyId = fromSelect.value;
      const toFamilyId = isAdmin ? toSelect.value : currentFamilyId;
      const validationError = validateEntry(fromFamilyId, toFamilyId, hoursInput.value, entryDateInput.value);
      if (validationError) {
        setError("entry-error", validationError);
        return;
      }

      const { error } = await supabase.rpc("rpc_create_manual_ledger_entry", {
        p_request_id: requestId,
        p_from_family_id: fromFamilyId,
        p_to_family_id: toFamilyId,
        p_hours: Number(hoursInput.value),
        p_entry_date: parseEntryDate(entryDateInput.value)
      });

      if (error) {
        setError("entry-error", error.message);
      } else {
        window.location = "/ledger.html";
      }
    };
  } catch (error) {
    setError("entry-error", error.message || "Unable to load page.");
  }
}

async function mountEditEntryPage() {
  try {
    await ensureAdmin();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      setError("entry-error", "Missing entry id.");
      return;
    }

    const { families } = await loadFormData();
    const { data, error } = await supabase.rpc("rpc_get_ledger_entry", { p_entry_id: id });
    if (error) throw error;

    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) {
      setError("entry-error", "Ledger entry not found.");
      return;
    }

    const fromSelect = document.getElementById("from-user");
    const toSelect = document.getElementById("to-user");
    const hoursInput = document.getElementById("hours");
    const entryDateInput = document.getElementById("entry-date");
    const saveBtn = document.getElementById("save-entry-btn");

    populateUserOptions(fromSelect, families, entry.from_family_id);
    populateUserOptions(toSelect, families, entry.to_family_id);
    hoursInput.value = entry.hours;

    const dt = new Date(entry.entry_date);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    entryDateInput.value = `${y}-${m}-${d}T${hh}:${mm}`;

    saveBtn.onclick = async () => {
      setError("entry-error", "");
      const fromFamilyId = fromSelect.value;
      const toFamilyId = toSelect.value;
      const validationError = validateEntry(fromFamilyId, toFamilyId, hoursInput.value, entryDateInput.value);
      if (validationError) {
        setError("entry-error", validationError);
        return;
      }

      const { error: saveError } = await supabase.rpc("rpc_update_ledger_entry", {
        p_entry_id: id,
        p_from_family_id: fromFamilyId,
        p_to_family_id: toFamilyId,
        p_hours: Number(hoursInput.value),
        p_entry_date: parseEntryDate(entryDateInput.value)
      });

      if (saveError) {
        setError("entry-error", saveError.message);
      } else {
        window.location = "/ledger.html";
      }
    };
  } catch (error) {
    setError("entry-error", error.message || "Unable to load page.");
  }
}

window.mountNewEntryPage = mountNewEntryPage;
window.mountEditEntryPage = mountEditEntryPage;

export { mountNewEntryPage, mountEditEntryPage };
