import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";

function populateUserOptions(selectEl, families, selectedValue = "") {
  selectEl.innerHTML = families
    .map((family) => `<option value="${family.id}" ${family.id === selectedValue ? "selected" : ""}>${family.name}</option>`)
    .join("");
}

function setError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  if (id === "entry-error") {
    el.classList.add("whitespace-pre-line");
  }
}

async function ensureAdmin() {
  await requireAuth();
  const { data, error } = await supabase.rpc("rpc_get_admin_status");
  if (error) throw error;
  if (!data) {
    throw new Error("Admin access required.");
  }
}

async function loadFamiliesForEntry() {
  const { data, error } = await supabase.rpc("rpc_list_families_for_entry");
  if (error) throw error;
  return data || [];
}

async function loadCompletedRequestsForEntry() {
  const { data, error } = await supabase.rpc("rpc_list_requests_completed_for_entry");
  if (error) throw error;
  return data || [];
}

function parseEntryDate(value) {
  if (!value) return null;
  return value;
}

function toDateInputValueFromDateString(dateValue) {
  if (!dateValue) return "";
  return dateValue;
}

function toDateInputValueFromStoredDate(dateValue) {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 10);
}

function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundUpToQuarter(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil(parsed * 4) / 4;
}

function normalizeEntryHoursInput(hoursInput) {
  if (!hoursInput) return;
  const raw = hoursInput.value;
  if (raw == null || raw === "") return;
  const rounded = roundUpToQuarter(raw);
  if (rounded == null) return;
  hoursInput.value = rounded.toFixed(2);
}

function validateEntry({ fromFamilyId, toFamilyId, hoursValue, entryDateValue }) {
  const errors = [];
  if (!fromFamilyId) errors.push("From Family is required.");
  if (!toFamilyId) errors.push("To Family is required.");
  if (fromFamilyId && toFamilyId && fromFamilyId === toFamilyId) {
    errors.push("From and To families must be different.");
  }
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours) || hours <= 0) errors.push("Hours must be greater than zero.");
  if (!entryDateValue) errors.push("Entry date is required.");
  if (entryDateValue) {
    const today = toLocalDateString();
    if (entryDateValue > today) {
      errors.push("Entry date cannot be in the future.");
    }
  }
  return errors;
}

async function mountNewEntryPage() {
  try {
    await requireAuth();
    const { data: currentFamilyId, error: currentFamilyError } = await supabase.rpc("rpc_get_family_id");
    if (currentFamilyError) throw currentFamilyError;
    if (!currentFamilyId) throw new Error("Unable to resolve current family.");

    const [families, completed] = await Promise.all([
      loadFamiliesForEntry(),
      loadCompletedRequestsForEntry()
    ]);

    const requestSelect = document.getElementById("request-select");
    const fromFamilyInput = document.getElementById("from-family");
    const toFamilyInput = document.getElementById("to-family");
    const fromFamilyIdInput = document.getElementById("from-family-id");
    const toFamilyIdInput = document.getElementById("to-family-id");
    const entryDateInput = document.getElementById("entry-date");
    const hoursInput = document.getElementById("entry-hours");
    const addDriveTimeCheckbox = document.getElementById("entry-add-drive-time");
    const addMealServedCheckbox = document.getElementById("entry-add-meal-served");
    const createBtn = document.getElementById("create-entry-btn");

    if (hoursInput) {
      hoursInput.addEventListener("input", () => normalizeEntryHoursInput(hoursInput));
      hoursInput.addEventListener("change", () => normalizeEntryHoursInput(hoursInput));
    }

    const familiesById = new Map(families.map((family) => [family.id, family.name || family.id]));

    const requestItems = completed.filter(item => item.to_family_id === currentFamilyId);

    if (!requestItems.length) {
      requestSelect.innerHTML = "<option value=''>No completed requests available</option>";
      requestSelect.disabled = true;
      createBtn.disabled = true;
      createBtn.classList.add("opacity-60", "cursor-not-allowed");
      setError("entry-error", "No completed requests are available for selection. An entry cannot be created.");
      return;
    }

    if (addDriveTimeCheckbox) {
      addDriveTimeCheckbox.onchange = () => {
        const current = toNumberOrZero(hoursInput.value);
        const next = addDriveTimeCheckbox.checked ? current + 0.5 : current - 0.5;
        hoursInput.value = next.toFixed(2);
      };
    }

    if (addMealServedCheckbox) {
      addMealServedCheckbox.onchange = () => {
        const current = toNumberOrZero(hoursInput.value);
        const next = addMealServedCheckbox.checked ? current + 0.5 : current - 0.5;
        hoursInput.value = next.toFixed(2);
      };
    }

    requestSelect.innerHTML = [
      "<option value='' selected>Select a completed request</option>",
      ...requestItems.map(item => {
        const requestDate = item.request_date || "No request date";
        const notes = item.notes || "No notes";
        return `<option value="${item.request_id}">${requestDate} — ${notes}</option>`;
      })
    ].join("");

    requestSelect.onchange = () => {
      const selected = requestItems.find((item) => item.request_id === requestSelect.value);
      if (!selected) {
        fromFamilyIdInput.value = "";
        toFamilyIdInput.value = "";
        fromFamilyInput.value = "";
        toFamilyInput.value = "";
        return;
      }

      fromFamilyIdInput.value = selected.from_family_id || "";
      toFamilyIdInput.value = selected.to_family_id || "";
      fromFamilyInput.value = familiesById.get(selected.from_family_id) || selected.from_family_id || "";
      toFamilyInput.value = familiesById.get(selected.to_family_id) || selected.to_family_id || "";

      const baseHours = selected.hours != null ? Number(selected.hours) : 0;
      const hasDriveTime = selected.sit_location === "requester_house";
      const hasMealServed = !!selected.meal_required;

      if (addDriveTimeCheckbox) {
        addDriveTimeCheckbox.checked = hasDriveTime;
      }

      if (addMealServedCheckbox) {
        addMealServedCheckbox.checked = hasMealServed;
      }

      const adjustedHours = baseHours + (hasDriveTime ? 0.5 : 0) + (hasMealServed ? 0.5 : 0);
      hoursInput.value = toNumberOrZero(adjustedHours).toFixed(2);
      normalizeEntryHoursInput(hoursInput);

      if (selected.request_date) {
        entryDateInput.value = toDateInputValueFromDateString(selected.request_date);
      }
    };

    createBtn.onclick = async () => {
      setError("entry-error", "");
      const requestId = requestSelect.value || null;
      const fromFamilyId = fromFamilyIdInput.value || "";
      const toFamilyId = toFamilyIdInput.value || "";
      const validationErrors = validateEntry({
        fromFamilyId,
        toFamilyId,
        hoursValue: hoursInput.value,
        entryDateValue: entryDateInput.value
      });
      if (validationErrors.length) {
        setError("entry-error", `• ${validationErrors.join("\n• ")}`);
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

    const families = await loadFamiliesForEntry();
    const { data, error } = await supabase.rpc("rpc_get_ledger_entry", { p_entry_id: id });
    if (error) throw error;

    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) {
      setError("entry-error", "Ledger entry not found.");
      return;
    }

    const fromSelect = document.getElementById("from-family");
    const toSelect = document.getElementById("to-family");
    const entryDateInput = document.getElementById("entry-date");
    const hoursInput = document.getElementById("entry-hours");
    const saveBtn = document.getElementById("save-entry-btn");

    if (hoursInput) {
      hoursInput.addEventListener("input", () => normalizeEntryHoursInput(hoursInput));
      hoursInput.addEventListener("change", () => normalizeEntryHoursInput(hoursInput));
    }

    populateUserOptions(fromSelect, families, entry.from_family_id);
    populateUserOptions(toSelect, families, entry.to_family_id);
    hoursInput.value = entry.hours;
    normalizeEntryHoursInput(hoursInput);

    entryDateInput.value = toDateInputValueFromStoredDate(entry.entry_date);

    saveBtn.onclick = async () => {
      setError("entry-error", "");
      const fromFamilyId = fromSelect.value;
      const toFamilyId = toSelect.value;
      const validationErrors = validateEntry({
        fromFamilyId,
        toFamilyId,
        hoursValue: hoursInput.value,
        entryDateValue: entryDateInput.value
      });
      if (validationErrors.length) {
        setError("entry-error", `• ${validationErrors.join("\n• ")}`);
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

export { mountNewEntryPage, mountEditEntryPage };
