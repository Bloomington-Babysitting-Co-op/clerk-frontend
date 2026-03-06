import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  normalizeQuarterHoursInput,
  setFormError,
  toDateInputValue,
  toDateOnlyString,
  toNullableDate,
  toNumberOrZero
} from "./utils.js";

async function loadRequestsForEntry() {
  const { data, error } = await supabase.rpc("rpc_list_requests_for_entry");
  if (error) throw error;
  return data || [];
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
    const today = toDateInputValue();
    if (entryDateValue > today) {
      errors.push("Entry date cannot be in the future.");
    }
  }
  return errors;
}

async function mountNewEntryPage() {
  try {
    await requireAuth();

    const requests = await loadRequestsForEntry();

    const requestSelect = document.getElementById("request-select");
    const fromFamilyInput = document.getElementById("from-family");
    const toFamilyInput = document.getElementById("to-family");
    const fromFamilyIdInput = document.getElementById("from-family-id");
    const toFamilyIdInput = document.getElementById("to-family-id");
    const entryDateInput = document.getElementById("entry-date");
    const hoursInput = document.getElementById("entry-hours");
    const addDriveTimeCheckbox = document.getElementById("entry-add-drive-time");
    const addMealServedCheckbox = document.getElementById("entry-add-meal-served");
    const notesInput = document.getElementById("entry-notes");
    const createBtn = document.getElementById("create-entry-btn");

    if (hoursInput) {
      hoursInput.addEventListener("input", () => normalizeQuarterHoursInput(hoursInput));
      hoursInput.addEventListener("change", () => normalizeQuarterHoursInput(hoursInput));
    }

    if (!requests.length) {
      requestSelect.innerHTML = "<option value=''>No completed requests available</option>";
      requestSelect.disabled = true;
      createBtn.disabled = true;
      createBtn.classList.add("opacity-60", "cursor-not-allowed");
      setFormError("entry-error", "No completed requests are available for selection. An entry cannot be created.");
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
      ...requests.map(item => {
        const requestDate = item.request_date || "No request date";
        const notes = item.notes || "No notes";
        return `<option value="${item.request_id}">${requestDate} — ${notes}</option>`;
      })
    ].join("");

    requestSelect.onchange = () => {
      const selected = requests.find((item) => item.request_id === requestSelect.value);
      if (!selected) {
        fromFamilyIdInput.value = "";
        toFamilyIdInput.value = "";
        fromFamilyInput.value = "";
        toFamilyInput.value = "";
        return;
      }

      fromFamilyIdInput.value = selected.from_family_id || "";
      toFamilyIdInput.value = selected.to_family_id || "";
      fromFamilyInput.value = selected.from_family_name || "";
      toFamilyInput.value = selected.to_family_name || "";

      const baseHours = selected.hours != null ? Number(selected.hours) : 0;
      const hasDriveTime = selected.drive_time;
      const hasMealServed = selected.meal_served;

      if (addDriveTimeCheckbox) {
        addDriveTimeCheckbox.checked = hasDriveTime;
      }

      if (addMealServedCheckbox) {
        addMealServedCheckbox.checked = hasMealServed;
      }

      const adjustedHours = baseHours + (hasDriveTime ? 0.5 : 0) + (hasMealServed ? 0.5 : 0);
      hoursInput.value = toNumberOrZero(adjustedHours).toFixed(2);
      normalizeQuarterHoursInput(hoursInput);

      if (selected.request_date) {
        entryDateInput.value = toDateOnlyString(selected.request_date);
      }
    };

    createBtn.onclick = async () => {
      setFormError("entry-error", "");
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
        setFormError("entry-error", validationErrors);
        return;
      }

      const { error } = await supabase.rpc("rpc_create_ledger_entry", {
        p_request_id: requestId,
        p_from_family_id: fromFamilyId,
        p_to_family_id: toFamilyId,
        p_entry_date: toNullableDate(entryDateInput.value),
        p_hours: Number(hoursInput.value),
        p_notes: notesInput ? notesInput.value : null
      });

      if (error) {
        setFormError("entry-error", error.message);
      } else {
        window.location = "/ledger.html";
      }
    };
  } catch (error) {
    setFormError("entry-error", error.message || "Unable to load page.");
  }
}

export { mountNewEntryPage };
