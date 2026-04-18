import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  setupNavbar,
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
    await setupNavbar("navbar");

    const requests = await loadRequestsForEntry();

    // Load families so we can identify the current user's family and list others
    let families = [];
    try {
      const { data: famData, error: famError } = await supabase.rpc("rpc_list_families_all");
      if (famError) throw famError;
      families = famData || [];
    } catch (err) {
      // non-fatal: families may be empty which only affects Ad Hoc behavior
      families = [];
    }

    const requestSelect = document.getElementById("request-select");
    const fromFamilyInput = document.getElementById("from-family");
    const toFamilyInput = document.getElementById("to-family");
    const fromFamilyIdInput = document.getElementById("from-family-id");
    const toFamilyIdInput = document.getElementById("to-family-id");
    const entryDateInput = document.getElementById("entry-date");
    const hoursInput = document.getElementById("entry-hours");
    const addDriveTimeCheckbox = document.getElementById("entry-add-drive-time");
    const addMealServedCheckbox = document.getElementById("entry-add-meal-served");
    const addDriveTimeLabel = document.getElementById("entry-add-drive-time-label");
    const addMealServedLabel = document.getElementById("entry-add-meal-served-label");
    const notesInput = document.getElementById("entry-notes");
    const createBtn = document.getElementById("create-entry-btn");

    if (hoursInput) {
      hoursInput.addEventListener("input", () => normalizeQuarterHoursInput(hoursInput));
      hoursInput.addEventListener("change", () => normalizeQuarterHoursInput(hoursInput));
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

    // hide and uncheck optional checkboxes by default
    if (addDriveTimeCheckbox) {
      addDriveTimeCheckbox.checked = false;
      if (addDriveTimeLabel) addDriveTimeLabel.style.display = 'none';
      else addDriveTimeCheckbox.style.display = 'none';
    }
    if (addMealServedCheckbox) {
      addMealServedCheckbox.checked = false;
      if (addMealServedLabel) addMealServedLabel.style.display = 'none';
      else addMealServedCheckbox.style.display = 'none';
    }

    // Build request select with an explicit Ad Hoc option (value: 'ad_hoc')
    requestSelect.innerHTML = [
      "<option value='' selected>Please select...</option>",
      "<option value='ad_hoc'>Ad Hoc</option>",
      ...requests.map(item => {
        const requestDate = item.request_date || "No request date";
        const notes = item.notes || "No notes";
        return `<option value="${item.request_id}">${requestDate} — ${notes}</option>`;
      })
    ].join("");

    // helpers to manage swapping the to-family input into a select for Ad Hoc
    const originalToFamilyDisplay = toFamilyInput; // keep reference for restore
    originalToFamilyDisplay.style.display = '';
    originalToFamilyDisplay.classList.add('bg-gray-100');
    let toFamilySelect = null;
    const myFamily = families.find(f => f.is_my_family) || null;

    function buildToFamilySelect(otherFamilies) {
      const sel = document.createElement('select');
      sel.id = 'to-family-select';
      sel.className = originalToFamilyDisplay.className || '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Please select...';
      sel.appendChild(defaultOpt);
      otherFamilies.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        sel.appendChild(opt);
      });
      sel.onchange = () => {
        toFamilyIdInput.value = sel.value || '';
      };
      return sel;
    }

    requestSelect.onchange = () => {
      const val = requestSelect.value;

      // If Ad Hoc is selected, prefill from-family to user's family and show to-family select
      if (val === 'ad_hoc') {
        // set from-family to current user's family (if known)
        if (myFamily) {
          fromFamilyIdInput.value = myFamily.id || '';
          fromFamilyInput.value = myFamily.name || '';
        } else {
          fromFamilyIdInput.value = '';
          fromFamilyInput.value = '';
        }
        fromFamilyInput.readOnly = true;

        // show to-family select populated with families excluding myFamily
        const otherFamilies = families.filter(f => !f.is_my_family);
        // hide original display input and remove gray background class so select won't look gray
        originalToFamilyDisplay.style.display = 'none';
        originalToFamilyDisplay.classList.remove('bg-gray-100');
        // remove existing select if any
        if (toFamilySelect && toFamilySelect.parentNode) toFamilySelect.parentNode.removeChild(toFamilySelect);
        toFamilySelect = buildToFamilySelect(otherFamilies);
        originalToFamilyDisplay.parentNode.insertBefore(toFamilySelect, originalToFamilyDisplay.nextSibling);
        toFamilyIdInput.value = '';
        // hide optional checkboxes for ad-hoc
        if (addDriveTimeCheckbox) {
          addDriveTimeCheckbox.checked = false;
          if (addDriveTimeLabel) addDriveTimeLabel.style.display = 'none';
          else addDriveTimeCheckbox.style.display = 'none';
        }
        if (addMealServedCheckbox) {
          addMealServedCheckbox.checked = false;
          if (addMealServedLabel) addMealServedLabel.style.display = 'none';
          else addMealServedCheckbox.style.display = 'none';
        }
        return;
      }

      // If no selection (Please select...), clear fields and restore to-family display
      if (!val) {
        fromFamilyIdInput.value = "";
        toFamilyIdInput.value = "";
        fromFamilyInput.value = "";
        toFamilyInput.value = "";
        fromFamilyInput.readOnly = false;
        if (toFamilySelect && toFamilySelect.parentNode) toFamilySelect.parentNode.removeChild(toFamilySelect);
        toFamilySelect = null;
        originalToFamilyDisplay.style.display = '';
        originalToFamilyDisplay.classList.add('bg-gray-100');
        // hide optional checkboxes when no request selected
        if (addDriveTimeCheckbox) {
          addDriveTimeCheckbox.checked = false;
          if (addDriveTimeLabel) addDriveTimeLabel.style.display = 'none';
          else addDriveTimeCheckbox.style.display = 'none';
        }
        if (addMealServedCheckbox) {
          addMealServedCheckbox.checked = false;
          if (addMealServedLabel) addMealServedLabel.style.display = 'none';
          else addMealServedCheckbox.style.display = 'none';
        }
        return;
      }

      // Otherwise a real request id is selected
      const selected = requests.find((item) => item.request_id === val);
      if (!selected) {
        // fallback: clear
        fromFamilyIdInput.value = "";
        toFamilyIdInput.value = "";
        fromFamilyInput.value = "";
        toFamilyInput.value = "";
        fromFamilyInput.readOnly = false;
        if (toFamilySelect && toFamilySelect.parentNode) toFamilySelect.parentNode.removeChild(toFamilySelect);
        toFamilySelect = null;
        originalToFamilyDisplay.style.display = '';
        originalToFamilyDisplay.classList.add('bg-gray-100');
        // hide optional checkboxes for unknown selection
        if (addDriveTimeCheckbox) {
          addDriveTimeCheckbox.checked = false;
          if (addDriveTimeLabel) addDriveTimeLabel.style.display = 'none';
          else addDriveTimeCheckbox.style.display = 'none';
        }
        if (addMealServedCheckbox) {
          addMealServedCheckbox.checked = false;
          if (addMealServedLabel) addMealServedLabel.style.display = 'none';
          else addMealServedCheckbox.style.display = 'none';
        }
        return;
      }

      // restore any replaced UI
      fromFamilyIdInput.value = selected.from_family_id || "";
      toFamilyIdInput.value = selected.to_family_id || "";
      fromFamilyInput.value = selected.from_family_name || "";
      toFamilyInput.value = selected.to_family_name || "";
      fromFamilyInput.readOnly = false;
      if (toFamilySelect && toFamilySelect.parentNode) toFamilySelect.parentNode.removeChild(toFamilySelect);
      toFamilySelect = null;
      originalToFamilyDisplay.style.display = '';
      originalToFamilyDisplay.classList.add('bg-gray-100');

      const baseHours = selected.hours != null ? Number(selected.hours) : 0;
      const hasDriveTime = selected.drive_time;
      const hasMealServed = selected.meal_served;

      if (selected.request_type === 'babysit') {
        if (addDriveTimeCheckbox) {
          addDriveTimeCheckbox.checked = hasDriveTime;
          if (addDriveTimeLabel) addDriveTimeLabel.style.display = '';
          else addDriveTimeCheckbox.style.display = '';
        }
        if (addMealServedCheckbox) {
          addMealServedCheckbox.checked = hasMealServed;
          if (addMealServedLabel) addMealServedLabel.style.display = '';
          else addMealServedCheckbox.style.display = '';
        }
      } else {
        if (addDriveTimeCheckbox) {
          addDriveTimeCheckbox.checked = false;
          if (addDriveTimeLabel) addDriveTimeLabel.style.display = 'none';
          else addDriveTimeCheckbox.style.display = 'none';
        }
        if (addMealServedCheckbox) {
          addMealServedCheckbox.checked = false;
          if (addMealServedLabel) addMealServedLabel.style.display = 'none';
          else addMealServedCheckbox.style.display = 'none';
        }
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
        p_from_family_id: fromFamilyId,
        p_to_family_id: toFamilyId,
        p_type: requestSelect.value === 'ad_hoc' ? "ad_hoc" : "request",
        p_date: toNullableDate(entryDateInput.value),
        p_hours: Number(hoursInput.value),
        p_notes: notesInput ? notesInput.value : null,
        p_request_id: requestSelect.value !== 'ad_hoc' ? requestSelect.value : null,
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
