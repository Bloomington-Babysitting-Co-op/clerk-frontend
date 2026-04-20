import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  setupNavbar,
  resizeTextarea,
  formatDateTime,
  toDateInputValue,
  toTimeInputValue,
  getAgeLabel,
  calculateHours,
  downloadCsv,
  setButtonTemporaryBusy,
  setFormError,
  escapeHtml,
  normalizeQuarterHoursInput
} from "./utils.js";
import { getRequestStatusTextClass, formatTitleCase, renderRequestListCard } from "./request-cards.js";

function getRequestFormValuesFromRequest(request) {
  return {
    request_type: request.type || "babysit",
    notes: request.notes || "",
    request_date: request.date || "",
    start_time: toTimeInputValue(request.start_time),
    end_time: toTimeInputValue(request.end_time),
    flexible_date: !!request.flexible_date,
    flexible_start_time: !!request.flexible_start_time,
    flexible_end_time: !!request.flexible_end_time,
    hours: request.hours ?? "",
    retainer_hours: request.retainer_hours ?? 0,
    sit_location: request.sit_location || "requester_house",
    meal_required: !!request.meal_required,
    meal_prepared_by_sitter: !!request.meal_prepared_by_sitter,
    sitters_children_welcome: !!request.sitters_children_welcome,
    pets_are_present: !!request.pets_are_present,
    selected_child_ids: [],
    available_children: [],
    origin: request.origin || "",
    destination: request.destination || "",
    adult_count: request.adult_count ?? 0
  };
}

function getDefaultRequestFormValues() {
  return {
    request_type: "babysit",
    notes: "",
    request_date: "",
    start_time: "",
    end_time: "",
    flexible_date: false,
    flexible_start_time: false,
    flexible_end_time: false,
    hours: "",
    retainer_hours: 0,
    sit_location: "requester_house",
    meal_required: false,
    meal_prepared_by_sitter: false,
    sitters_children_welcome: false,
    pets_are_present: false,
    selected_child_ids: [],
    available_children: [],
    origin: "",
    destination: "",
    adult_count: 0
  };
}

function getRequestFormHtml(prefix, values, options = {}) {
  const submitLabel = options.submitLabel || "Save";
  const showCancel = !!options.showCancel;
  const disableType = !!options.disableType;
  const readOnly = !!options.readOnly;
  const showActions = options.showActions !== false;
  const disabledAttr = readOnly ? "disabled" : "";
  const readOnlyFieldClass = readOnly ? "bg-gray-100 text-gray-800" : "";

  return `
    <div class="space-y-2">
      <label class="block mb-2 font-semibold">Request Type <span class="text-red-600">*</span></label>
      <select id="${prefix}-request-type" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${(disableType || readOnly) ? "disabled" : ""}>
        <option value="babysit" ${values.request_type === "babysit" ? "selected" : ""}>Babysit</option>
        <option value="drive" ${values.request_type === "drive" ? "selected" : ""}>Drive</option>
        <option value="favor" ${values.request_type === "favor" ? "selected" : ""}>Favor</option>
      </select>

      <label class="block mb-2 font-semibold">Description <span class="text-red-600">*</span></label>
      <textarea id="${prefix}-notes" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" required ${disabledAttr}>${escapeHtml(values.notes)}</textarea>

      <div class="flex items-center justify-between mb-2">
        <label class="font-semibold">Request Date <span class="text-red-600">*</span></label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" id="${prefix}-flexible-date" ${values.flexible_date ? "checked" : ""} ${disabledAttr}>
          <span>Flexible</span>
        </label>
      </div>
      <input type="date" id="${prefix}-request-date" value="${escapeHtml(values.request_date)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" required ${disabledAttr}>

      <div class="flex items-center justify-between mb-2">
          <label class="font-semibold">Start Time</label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" id="${prefix}-flexible-start-time" ${values.flexible_start_time ? "checked" : ""} ${disabledAttr}>
          <span>Flexible</span>
        </label>
      </div>
      <input type="time" id="${prefix}-start-time" value="${escapeHtml(values.start_time)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>

      <div id="${prefix}-end-time-section">
        <div class="flex items-center justify-between mb-2">
          <label class="font-semibold">End Time</label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" id="${prefix}-flexible-end-time" ${values.flexible_end_time ? "checked" : ""} ${disabledAttr}>
            <span>Flexible</span>
          </label>
        </div>
        <input type="time" id="${prefix}-end-time" value="${escapeHtml(values.end_time)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
      </div>

      <div id="${prefix}-hours-wrapper">
        <label class="block mb-2 font-semibold">Hours</label>
        <input type="number" step="0.25" min="0" id="${prefix}-hours" value="${escapeHtml(values.hours)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
      </div>

      <label class="block mb-2 font-semibold">Retainer Hours</label>
      <input type="number" step="0.25" min="0" id="${prefix}-retainer-hours" value="${escapeHtml(values.retainer_hours)}" class="border p-2 w-full mb-1 ${readOnlyFieldClass}" ${disabledAttr}>
      <p class="text-xs text-gray-500 mb-4">Set this value if backup sitters are required. These hours will automatically be credited to the assigned backup sitters upon completion.</p>

      <div id="${prefix}-babysit-fields">
        <label class="block mb-2 font-semibold">Sit Location</label>
        <select id="${prefix}-sit-location" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
          <option value="requester_house" ${values.sit_location === "requester_house" ? "selected" : ""}>Requester's House</option>
          <option value="sitter_house" ${values.sit_location === "sitter_house" ? "selected" : ""}>Sitter's House</option>
          <option value="either" ${values.sit_location === "either" ? "selected" : ""}>Either</option>
        </select>

        <div class="mb-2">
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" id="${prefix}-meal-required" ${values.meal_required ? "checked" : ""} ${disabledAttr}>
            <span>Meal required</span>
          </label>
          <label id="${prefix}-meal-prepared-wrapper" class="inline-flex items-center gap-2 ml-2">
            <input type="checkbox" id="${prefix}-meal-prepared-by-sitter" ${values.meal_prepared_by_sitter ? "checked" : ""} ${disabledAttr}>
            <span>Meal prepared by sitter</span>
          </label>
        </div>

        <div class="mb-4">
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" id="${prefix}-sitters-children-welcome" ${values.sitters_children_welcome ? "checked" : ""} ${disabledAttr}>
            <span>Sitter's children welcome</span>
          </label>
          <label id="${prefix}-pets-present-wrapper" class="inline-flex items-center gap-2 ml-2">
            <input type="checkbox" id="${prefix}-pets-are-present" ${values.pets_are_present ? "checked" : ""} ${disabledAttr}>
            <span>Pets are present</span>
          </label>
        </div>

        <label class="block mb-2 font-semibold">Children</label>
        <div id="${prefix}-babysit-children-select" class="border rounded p-3 mb-4 space-y-2">
          ${Array.isArray(values.available_children) && values.available_children.length
            ? values.available_children.map((child) => {
                const selected = Array.isArray(values.selected_child_ids) && values.selected_child_ids.includes(child.id);
                const ageLabel = getAgeLabel(child.date_of_birth);
                const allergiesText = (child.allergies || "").trim();
                const notesText = (child.notes || "").trim();
                return `
                  <label class="flex items-center gap-2">
                    <input type="checkbox" data-child-id="${child.id}" ${selected ? "checked" : ""} ${disabledAttr}>
                    <span>${escapeHtml(child.name || "Unnamed child")}${ageLabel ? ` (${escapeHtml(ageLabel)})` : ""}
                      ${allergiesText ? `<span class="block font-semibold text-gray-800">Allergies: ${escapeHtml(allergiesText)}</span>` : ""}
                      ${notesText ? `<span class="block italic text-gray-800">Notes: ${escapeHtml(notesText)}</span>` : ""}
                    </span>
                  </label>
                `;
              }).join("")
            : '<p class="text-sm text-gray-600">No children selected.</p>'}
        </div>
      </div>

      <div id="${prefix}-drive-fields">
        <label class="block mb-2 font-semibold">Origin</label>
        <input type="text" id="${prefix}-origin" value="${escapeHtml(values.origin)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>

        <label class="block mb-2 font-semibold">Destination</label>
        <input type="text" id="${prefix}-destination" value="${escapeHtml(values.destination)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>

        <label class="block mb-2 font-semibold">Adults</label>
        <input type="number" step="1" min="0" id="${prefix}-adult-count" value="${escapeHtml(values.adult_count)}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>

        <label class="block mb-2 font-semibold">Children</label>
        <div id="${prefix}-drive-children-select" class="border rounded p-3 mb-4 space-y-2">
          ${Array.isArray(values.available_children) && values.available_children.length
            ? values.available_children.map((child) => {
                const selected = Array.isArray(values.selected_child_ids) && values.selected_child_ids.includes(child.id);
                const ageLabel = getAgeLabel(child.date_of_birth);
                const carseatText = (child.car_seat || "").trim();
                const notesText = (child.notes || "").trim();
                return `
                  <label class="flex items-center gap-2">
                    <input type="checkbox" data-child-id="${child.id}" ${selected ? "checked" : ""} ${disabledAttr}>
                    <span>${escapeHtml(child.name || "Unnamed child")}${ageLabel ? ` (${escapeHtml(ageLabel)})` : ""}
                      ${carseatText ? `<span class="block font-semibold text-gray-800">Car Seat: ${escapeHtml(carseatText)}</span>` : ""}
                      ${notesText ? `<span class="block italic text-gray-800">Notes: ${escapeHtml(notesText)}</span>` : ""}
                    </span>
                  </label>
                `;
              }).join("")
            : '<p class="text-sm text-gray-600">No children selected.</p>'}
        </div>
      </div>

      ${showActions ? `
      <div class="mt-6 flex gap-2">
        <button id="${prefix}-submit-btn" class="bg-blue-600 text-white px-4 py-2 ${showCancel ? "" : "w-full "}rounded hover:bg-blue-700">${submitLabel}</button>
        ${showCancel ? `<button id="${prefix}-cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>` : ""}
      </div>
      ` : ""}

      <p id="${prefix}-error" class="text-red-600 mt-2 whitespace-pre-line"></p>
    </div>
  `;
}

function initRequestFormInteractions(prefix) {
  const requestType = document.getElementById(`${prefix}-request-type`);
  const requestDateInput = document.getElementById(`${prefix}-request-date`);
  const startTimeInput = document.getElementById(`${prefix}-start-time`);
  const flexibleStartTimeInput = document.getElementById(`${prefix}-flexible-start-time`);
  const endTimeSection = document.getElementById(`${prefix}-end-time-section`);
  const endTimeInput = document.getElementById(`${prefix}-end-time`);
  const flexibleEndTimeInput = document.getElementById(`${prefix}-flexible-end-time`);
  const hoursWrapper = document.getElementById(`${prefix}-hours-wrapper`);
  const hoursInput = document.getElementById(`${prefix}-hours`);
  const babysitFields = document.getElementById(`${prefix}-babysit-fields`);
  const mealRequired = document.getElementById(`${prefix}-meal-required`);
  const mealPreparedBySitter = document.getElementById(`${prefix}-meal-prepared-by-sitter`);
  const mealPreparedWrapper = document.getElementById(`${prefix}-meal-prepared-wrapper`);
  const sittersChildrenWelcome = document.getElementById(`${prefix}-sitters-children-welcome`);
  const petsArePresent = document.getElementById(`${prefix}-pets-are-present`);
  const petsPresentWrapper = document.getElementById(`${prefix}-pets-present-wrapper`);
  const driveFields = document.getElementById(`${prefix}-drive-fields`);
  const retainerHoursInput = document.getElementById(`${prefix}-retainer-hours`);
  const flexibleStartInitiallyDisabled = flexibleStartTimeInput.disabled;
  const flexibleEndInitiallyDisabled = flexibleEndTimeInput.disabled;

  function refreshTimeFlexControls() {
    const hasStartTime = !!startTimeInput.value;
    if (!hasStartTime) {
      flexibleStartTimeInput.checked = false;
    }
    flexibleStartTimeInput.disabled = flexibleStartInitiallyDisabled || !hasStartTime;

    const hasEndTime = !!endTimeInput.value;
    if (!hasEndTime) {
      flexibleEndTimeInput.checked = false;
    }
    flexibleEndTimeInput.disabled = flexibleEndInitiallyDisabled || !hasEndTime;
  }

  function refreshCalculatedHours() {
    if (requestType.value !== "babysit") {
      return;
    }

    const autoHours = calculateHours(startTimeInput.value, endTimeInput.value);
    hoursInput.value = autoHours ?? "";
  }

  function refreshFormVisibility() {
    const isBabysit = requestType.value === "babysit";
    const isDrive = requestType.value === "drive";
    endTimeSection.style.display = isDrive ? "none" : "block";
    if (isDrive) {
      endTimeInput.value = "";
      flexibleEndTimeInput.checked = false;
    }
    hoursWrapper.style.display = "block";
    hoursInput.readOnly = isBabysit;
    const hoursGray = isBabysit || hoursInput.disabled;
    hoursInput.classList.toggle("bg-gray-100", hoursGray);
    hoursInput.classList.toggle("text-gray-800", hoursGray);
    babysitFields.style.display = isBabysit ? "block" : "none";
    if (isBabysit && !mealRequired.checked) {
      mealPreparedBySitter.checked = false;
    }
    mealPreparedWrapper.style.display = isBabysit && mealRequired.checked ? "inline-flex" : "none";
    if (isBabysit && !sittersChildrenWelcome.checked) {
      petsArePresent.checked = false;
    }
    petsPresentWrapper.style.display = isBabysit && sittersChildrenWelcome.checked ? "inline-flex" : "none";
    driveFields.style.display = isDrive ? "block" : "none";
    refreshTimeFlexControls();
    refreshCalculatedHours();
  }

  requestType.addEventListener("change", refreshFormVisibility);
  mealRequired.addEventListener("change", refreshFormVisibility);
  sittersChildrenWelcome.addEventListener("change", refreshFormVisibility);
  requestDateInput.addEventListener("change", refreshCalculatedHours);
  startTimeInput.addEventListener("input", refreshTimeFlexControls);
  endTimeInput.addEventListener("input", refreshTimeFlexControls);
  startTimeInput.addEventListener("change", refreshCalculatedHours);
  endTimeInput.addEventListener("change", refreshCalculatedHours);
  if (retainerHoursInput) {
    retainerHoursInput.addEventListener("change", () => normalizeQuarterHoursInput(retainerHoursInput));
  }
  refreshFormVisibility();
}

function readRequestFormValues(prefix) {
  const childIds = Array.from(document.querySelectorAll(`#${prefix}-babysit-children-select [data-child-id]:checked, #${prefix}-drive-children-select [data-child-id]:checked`))
    .map((input) => input.getAttribute("data-child-id"))
    .filter(Boolean);

  return {
    request_type: document.getElementById(`${prefix}-request-type`).value,
    notes: document.getElementById(`${prefix}-notes`).value,
    request_date: document.getElementById(`${prefix}-request-date`).value,
    start_time: document.getElementById(`${prefix}-start-time`).value,
    end_time: document.getElementById(`${prefix}-end-time`).value,
    flexible_date: document.getElementById(`${prefix}-flexible-date`).checked,
    flexible_start_time: document.getElementById(`${prefix}-flexible-start-time`).checked,
    flexible_end_time: document.getElementById(`${prefix}-flexible-end-time`).checked,
    hours: document.getElementById(`${prefix}-hours`).value,
    retainer_hours: document.getElementById(`${prefix}-retainer-hours`).value,
    sit_location: document.getElementById(`${prefix}-sit-location`).value,
    meal_required: document.getElementById(`${prefix}-meal-required`).checked,
    meal_prepared_by_sitter: document.getElementById(`${prefix}-meal-prepared-by-sitter`).checked,
    sitters_children_welcome: document.getElementById(`${prefix}-sitters-children-welcome`).checked,
    pets_are_present: document.getElementById(`${prefix}-pets-are-present`).checked,
    selected_child_ids: childIds,
    origin: document.getElementById(`${prefix}-origin`).value,
    destination: document.getElementById(`${prefix}-destination`).value,
    adult_count: document.getElementById(`${prefix}-adult-count`).value
  };
}

function normalizeFormPayload(values, options = {}) {
  const requestType = options.requestTypeOverride || values.request_type;
  const description = (values.notes || "").trim();
  const errors = [];

  if (!requestType || !["babysit", "drive", "favor"].includes(requestType)) {
    errors.push("Request type is required.");
  }

  if (!description) {
    errors.push("Description is required.");
  }

  if (values.request_date) {
    const today = toDateInputValue();
    if (values.request_date < today) {
      errors.push("Request date cannot be in the past.");
    }
  }

  if (!values.request_date) {
    errors.push("Request date is required.");
  }

  const startTimeValue = values.start_time || null;
  const endTimeValue = values.end_time || null;

  if (startTimeValue && endTimeValue && calculateHours(startTimeValue, endTimeValue) === null) {
    errors.push("End time must be after start time.");
  }

  const autoHours = requestType === "babysit" ? calculateHours(startTimeValue, endTimeValue) : null;
  const manualHours = requestType !== "babysit" && values.hours !== "" ? Number(values.hours) : null;
  const payloadHours = autoHours ?? manualHours;
  const retainerHours = values.retainer_hours !== "" ? Number(values.retainer_hours) : 0;

  if (payloadHours !== null && (!Number.isFinite(payloadHours) || payloadHours <= 0)) {
    errors.push("Hours must be greater than zero.");
  }

  if (!Number.isFinite(retainerHours)) {
    errors.push("Retainer hours must be a number.");
  } else if (retainerHours < 0) {
    errors.push("Retainer hours must be zero or greater.");
  } else if (Math.abs((retainerHours * 4) - Math.round(retainerHours * 4)) > 1e-9) {
    errors.push("Retainer hours must be in 0.25 hour increments.");
  }

  if (errors.length > 0) {
    return { errors };
  }

  const isBabysit = requestType === "babysit";
  const isDrive = requestType === "drive";

  return {
    payload: {
      p_type: requestType,
      p_notes: description,
      p_date: values.request_date || null,
      p_start_time: startTimeValue,
      p_end_time: endTimeValue,
      p_flexible_date: !!values.flexible_date,
      p_flexible_start_time: !!values.flexible_start_time,
      p_flexible_end_time: !!values.flexible_end_time,
      p_hours: payloadHours,
      p_retainer_hours: retainerHours,
      p_sit_location: isBabysit ? (values.sit_location || null) : null,
      p_meal_required: isBabysit ? !!values.meal_required : false,
      p_meal_prepared_by_sitter: isBabysit ? !!values.meal_prepared_by_sitter : false,
      p_sitters_children_welcome: isBabysit ? !!values.sitters_children_welcome : false,
      p_pets_are_present: isBabysit ? !!values.pets_are_present : false,
      p_child_ids: isBabysit || isDrive ? (values.selected_child_ids || []) : null,
      p_origin: isDrive ? (values.origin || null) : null,
      p_destination: isDrive ? (values.destination || null) : null,
      p_adult_count: isDrive ? (parseInt(values.adult_count, 10) || 0) : null
    }
  };
}

async function listRequestsInto(containerId, options = {}) {
  setupNavbar("navbar");
  await requireAuth();

  const {
    startDate = null,
    endDate = null,
    familyId = null
  } = options;

  const { data, error } = await supabase.rpc("rpc_list_requests_filtered", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_family_id: familyId
  });

  const el = document.getElementById(containerId);

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return [];
  }

  el.innerHTML = data.length
    ? data.map((r) => renderRequestListCard(r)).join("")
    : "<p class='text-gray-600'>No requests yet.</p>";

  return data;
}

async function mountRequestsPage() {
  setupNavbar("navbar");
  await requireAuth();

  const startInput = document.getElementById("requests-start-date");
  const endInput = document.getElementById("requests-end-date");
  const familySelect = document.getElementById("requests-family-select");
  const applyBtn = document.getElementById("requests-apply-filter-btn");
  const exportBtn = document.getElementById("requests-export-csv-btn");
  const errorEl = document.getElementById("requests-error");

  if (startInput) startInput.value = toDateInputValue();
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

  let currentRows = await listRequestsInto("requests-list", {
    startDate: startInput?.value || null,
    endDate: endInput?.value || null,
    familyId: familySelect?.value || null
  });

  if (applyBtn) {
    applyBtn.onclick = async () => {
      try {
        setFormError(errorEl, "");
        currentRows = await listRequestsInto("requests-list", {
          startDate: startInput?.value || null,
          endDate: endInput?.value || null,
          familyId: familySelect?.value || null
        });
      } catch (error) {
        setFormError(errorEl, error.message);
      }
    };
  }

  if (exportBtn) {
    exportBtn.onclick = () => {
      setButtonTemporaryBusy(exportBtn);

      if (!currentRows || !currentRows.length) {
        setFormError(errorEl, "No rows to export for selected filters.");
        return;
      }
      setFormError(errorEl, "");
      const rows = [
        ["ID", "Date", "Type", "Status", "Family Name", "Hours", "Notes"],
        ...currentRows.map((row) => [
          row.id,
          row.date || "",
          row.type || "",
          row.status || "",
          row.family_name || "",
          row.hours ?? "",
          row.notes || ""
        ])
      ];
      downloadCsv("requests_export.csv", rows);
    };
  }
}

async function loadRequestInto(containerId) {
  setupNavbar("navbar");
  await requireAuth();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const el = document.getElementById(containerId);

  if (!id) {
    el.innerHTML = "<p>Missing id.</p>";
    return;
  }

  const { data: requestData, error } = await supabase.rpc("rpc_get_request", {
    p_request_id: id
  });

  const r = Array.isArray(requestData) ? requestData[0] : requestData;

  if (error || !r) {
    el.innerHTML = `<p class='text-red-600'>${error?.message || "Request not found."}</p>`;
    return;
  }

  // Fetch offers for this request
  const { data: offersData, error: offersError } = await supabase.rpc("rpc_list_offers", {
    p_request_id: id
  });

  const { data: requestChildrenData, error: requestChildrenError } = await supabase.rpc("rpc_list_request_children", {
    p_request_id: id
  });

  if (offersError) {
    el.innerHTML = `<p class='text-red-600'>${offersError.message}</p>`;
    return;
  }

  if (requestChildrenError) {
    el.innerHTML = `<p class='text-red-600'>${requestChildrenError.message}</p>`;
    return;
  }

  const offers = Array.isArray(offersData) ? offersData : [];
  const requestChildren = Array.isArray(requestChildrenData) ? requestChildrenData : [];

  const { data: currentFamilyId, error: currentFamilyError } = await supabase.rpc("rpc_my_family_id");
  if (currentFamilyError || !currentFamilyId) {
    el.innerHTML = `<p class='text-red-600'>${currentFamilyError?.message || "Unable to resolve current family."}</p>`;
    return;
  }
  
  const requesterId = r.requester_family_id;
  const requesterFamilyName = r.requester_family_name;
  const isRequester = requesterId === currentFamilyId;
  const hasRetainer = Number(r.retainer_hours) > 0;
  const assignedOfferCount = offers.filter((offer) => offer.assign_order != null).length;
  const canOffer = r.status === "open" && !isRequester;
  const canOfferWhenOffered = (
    r.status === "offered"
    || (r.status === "assigned" && hasRetainer && assignedOfferCount < 3)
  ) && !isRequester;
  const myOffer = offers?.find((offer) => offer.family_id === currentFamilyId) || null;
  const hasAlreadyOffered = !!myOffer;
  const canEditMyOffer = hasAlreadyOffered && !isRequester && (r.status === "open" || r.status === "offered" || r.status === "assigned");
  const canCancelMyOffer = hasAlreadyOffered && !isRequester && (r.status === "open" || r.status === "offered" || r.status === "assigned");
  const canAssignOffer = isRequester && (r.status === "offered" || r.status === "assigned");
  const canUnassignOffer = isRequester && r.status === "assigned";
  const canEdit = isRequester && (r.status === "open" || r.status === "offered" || r.status === "assigned");
  const canCancelRequest = isRequester && (r.status === "open" || r.status === "offered" || r.status === "assigned");
  const viewFormValues = getRequestFormValuesFromRequest(r);
  const editFormValues = getRequestFormValuesFromRequest(r);
  const selectedChildIds = requestChildren.map((child) => child.id);
  viewFormValues.selected_child_ids = selectedChildIds;
  viewFormValues.available_children = requestChildren;
  editFormValues.selected_child_ids = selectedChildIds;

  if (canEdit) {
    const { data: familyChildrenData, error: familyChildrenError } = await supabase.rpc("rpc_list_my_family_children");
    if (familyChildrenError) {
      el.innerHTML = `<p class='text-red-600'>${familyChildrenError.message}</p>`;
      return;
    }
    editFormValues.available_children = Array.isArray(familyChildrenData) ? familyChildrenData : [];
  }

  el.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow max-w-3xl mx-auto w-full">
      <h1 id="request-page-title" class="text-3xl font-bold mb-4">Request Details</h1>
      <div class="mb-2 text-gray-800 text-sm">Created ${formatDateTime(r.created_at)}</div>
      <div class="mb-2 font-semibold text-gray-800">${escapeHtml(requesterFamilyName)}</div>
      <div class="mb-4 font-semibold ${getRequestStatusTextClass(r.status)}">${formatTitleCase(r.status)}</div>

      <div id="view-mode">
        ${getRequestFormHtml("view-request", viewFormValues, { disableType: true, readOnly: true, showActions: false })}
        <div class="mt-6 flex gap-2">
          ${isRequester
            ? `
              <button id="edit-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${canEdit ? "" : "opacity-60 cursor-not-allowed"}" ${canEdit ? "" : "disabled"}>Edit Request</button>
              <button id="cancel-request-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 ${canCancelRequest ? "" : "opacity-60 cursor-not-allowed"}" ${canCancelRequest ? "" : "disabled"}>Cancel Request</button>
            `
            : ((canEditMyOffer || canCancelMyOffer)
              ? `
                ${canEditMyOffer ? `<button id="edit-offer-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Edit Offer</button>` : ""}
                ${canCancelMyOffer ? `<button id="cancel-offer-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Cancel Offer</button>` : ""}
              `
              : ((canOffer || (canOfferWhenOffered && !hasAlreadyOffered))
                ? `<button id="offer-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Offer to Help</button>`
                : ""))}
        </div>
        ${isRequester && !canEdit ? `<p class="text-sm text-gray-600 mt-2">Only open, offered, or assigned requests can be edited or cancelled.</p>` : ""}
      </div>

      <div id="edit-mode" style="display: none;">
        ${getRequestFormHtml("edit-request", editFormValues, { submitLabel: "Save Request", showCancel: true, disableType: true })}
      </div>

      ${offers && offers.length > 0 ? `
        <div class="mt-8 pt-8 border-t">
          <h2 class="text-2xl font-bold mb-4">Offers (${offers.length})</h2>
          <div class="space-y-3">
            ${offers.map((offer) => {
              const isAssignedOffer = offer.assign_order != null;
              const label = offer.assign_order === 1 ? "Primary" : offer.assign_order === 2 ? "Secondary" : "Tertiary";
              const assignedBadgeLabel = !isAssignedOffer
                ? null
                : `Assigned${hasRetainer ? " " + label : ""}`;
              const bgClass = offer.assign_order === 1 ? "bg-green-100 border-green-300"
                : offer.assign_order === 2 ? "bg-green-50 border-green-300"
                : offer.assign_order === 3 ? "bg-green-50/25 border-green-300"
                : "bg-gray-50";
              const canSimpleAssign = canAssignOffer && !hasRetainer && !isAssignedOffer;
              const canSlotAssign = canAssignOffer && hasRetainer;
              const canUnassignThis = canUnassignOffer && isAssignedOffer;
              let assignButtonsHtml = "";

              if (canSlotAssign) {
                const maxOptionOrder = isAssignedOffer
                  ? Math.max(1, Math.min(3, assignedOfferCount))
                  : Math.max(1, Math.min(3, assignedOfferCount + 1));
                const buttonRows = [];

                for (let order = 1; order <= maxOptionOrder; order += 1) {
                  const orderLabel = order === 1 ? "Primary" : order === 2 ? "Secondary" : "Tertiary";
                  const isSelected = isAssignedOffer && offer.assign_order === order;
                  if (isSelected) continue;
                  buttonRows.push(`
                    <button
                      class="assign-offer-btn text-sm bg-green-600 text-white px-3 py-2 hover:bg-green-700"
                      data-offer-id="${offer.id}"
                      data-assign-order="${order}"
                    >
                      ${orderLabel}
                    </button>
                  `);
                }

                if (buttonRows.length > 0) {
                  assignButtonsHtml = `
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-medium text-gray-700">Assign</span>
                      <div class="inline-flex overflow-hidden rounded border border-green-600 bg-green-600 divide-x divide-white">
                        ${buttonRows.join("")}
                      </div>
                    </div>
                  `;
                }
              }

              return `
              <div class="${bgClass} p-4 rounded border">
                <p class="font-semibold text-gray-800 mb-1">${escapeHtml(offer.family_name)}</p>
                <p class="text-sm text-gray-600 mb-1">Hours Balance: ${offer.hours_balance ?? 0}</p>
                <p class="text-sm text-gray-600 mb-1">Used this month: ${offer.active_this_month ? "Yes" : "No"}</p>
                <p class="text-sm text-gray-600 mb-1">Offered At: ${formatDateTime(offer.created_at)}</p>
                <p class="text-gray-800"><em>${escapeHtml(offer.notes || "No notes")}</em></p>
                ${assignedBadgeLabel ? `<p class="text-green-600 mt-3 font-semibold">${assignedBadgeLabel}</p>` : ""}
                <div class="mt-3 flex gap-2 items-center">
                  ${canSimpleAssign
                    ? `<button class="assign-offer-btn bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700" data-offer-id="${offer.id}" data-assign-order="1">Assign</button>`
                    : ""}
                  ${assignButtonsHtml}
                  ${canUnassignThis
                    ? `<button class="unassign-offer-btn bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700" data-offer-id="${offer.id}">Unassign</button>`
                    : ""}
                </div>
              </div>
            `;
            }).join("")}
          </div>
        </div>
      ` : ""}

      <p id="request-error" class="text-red-600 mt-4"></p>
    </div>

    <div id="offer-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 50;">
      <div class="bg-white p-6 rounded-lg shadow max-w-md w-full">
        <textarea id="offer-notes" placeholder="Add Notes (Optional)" class="border p-2 w-full mb-4 h-24"></textarea>
        <div class="flex gap-2">
          <button id="offer-submit-btn" class="bg-blue-600 text-white px-4 py-2 rounded flex-1 hover:bg-blue-700">Submit Offer</button>
          <button id="offer-cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded flex-1 hover:bg-gray-500">Cancel</button>
        </div>
      </div>
    </div>
  `;

  let offerEditMode = false;
  let editingOfferId = null;

  // Event listeners
  if (document.getElementById("offer-btn")) {
    document.getElementById("offer-btn").onclick = () => {
      offerEditMode = false;
      editingOfferId = null;
      const notesInput = document.getElementById("offer-notes");
      if (notesInput) notesInput.value = "";
      const submitBtn = document.getElementById("offer-submit-btn");
      if (submitBtn) submitBtn.textContent = "Submit Offer";
      document.getElementById("offer-modal").style.display = "flex";
        try { resizeTextarea(document.getElementById("offer-modal")); } catch (e) { /* ignore */ }
    };
  }

  if (document.getElementById("edit-offer-btn")) {
    document.getElementById("edit-offer-btn").onclick = () => {
      offerEditMode = true;
      editingOfferId = myOffer?.id || null;
      const notesInput = document.getElementById("offer-notes");
      if (notesInput) notesInput.value = myOffer?.notes || "";
      const submitBtn = document.getElementById("offer-submit-btn");
      if (submitBtn) submitBtn.textContent = "Save Offer";
      document.getElementById("offer-modal").style.display = "flex";
      try { resizeTextarea(document.getElementById("offer-modal")); } catch (e) { /* ignore */ }
    };
  }

  if (document.getElementById("cancel-offer-btn")) {
    document.getElementById("cancel-offer-btn").onclick = () => cancelOffer(myOffer?.id || null);
  }

  if (document.getElementById("offer-submit-btn")) {
    document.getElementById("offer-submit-btn").onclick = () => {
      if (offerEditMode && editingOfferId) {
        return updateOffer(editingOfferId);
      }
      return submitOffer(id);
    };
  }

  if (document.getElementById("offer-cancel-btn")) {
    document.getElementById("offer-cancel-btn").onclick = () => {
      document.getElementById("offer-modal").style.display = "none";
    };
  }

  document.querySelectorAll(".assign-offer-btn").forEach((button) => {
    button.onclick = async () => {
      const offerId = button.getAttribute("data-offer-id");
      const assignOrder = parseInt(button.getAttribute("data-assign-order"), 10);
      if (!offerId || !assignOrder) return;
      await assignOffer(offerId, assignOrder);
    };
  });

  document.querySelectorAll(".unassign-offer-btn").forEach((button) => {
    button.onclick = async () => {
      const offerId = button.getAttribute("data-offer-id");
      if (!offerId) return;
      await unassignOffer(offerId);
    };
  });

  initRequestFormInteractions("view-request");

  if (document.getElementById("edit-btn")) {
    document.getElementById("edit-btn").onclick = () => toggleEditMode(true);
  }

  if (document.getElementById("cancel-request-btn")) {
    document.getElementById("cancel-request-btn").onclick = () => cancelRequest(id);
  }

  if (document.getElementById("edit-request-cancel-btn")) {
    document.getElementById("edit-request-cancel-btn").onclick = () => toggleEditMode(false);
  }

  initRequestFormInteractions("edit-request");

  if (document.getElementById("edit-request-submit-btn")) {
    document.getElementById("edit-request-submit-btn").onclick = () => saveRequest(id);
  }

  function toggleEditMode(isEditing) {
    const titleEl = document.getElementById("request-page-title");
    if (titleEl) {
      titleEl.textContent = isEditing ? "Edit Request" : "Request Details";
    }
    document.getElementById("view-mode").style.display = isEditing ? "none" : "block";
    document.getElementById("edit-mode").style.display = isEditing ? "block" : "none";
      if (isEditing) {
        try { resizeTextarea(document.getElementById("edit-mode")); } catch (e) { /* ignore */ }
      }
  }

  async function saveRequest(requestId) {
    const values = readRequestFormValues("edit-request");
    const { payload, errors } = normalizeFormPayload(values, {
      requestTypeOverride: r.type
    });

    if (errors?.length) {
      setFormError("edit-request-error", errors);
      return;
    }

    const { error } = await supabase.rpc("rpc_update_request", {
      p_request_id: requestId,
      p_date: payload.p_date,
      p_flexible_date: payload.p_flexible_date,
      p_flexible_start_time: payload.p_flexible_start_time,
      p_flexible_end_time: payload.p_flexible_end_time,
      p_start_time: payload.p_start_time,
      p_end_time: payload.p_end_time,
      p_notes: payload.p_notes,
      p_hours: payload.p_hours,
      p_retainer_hours: payload.p_retainer_hours,
      p_sit_location: payload.p_sit_location,
      p_meal_required: payload.p_meal_required,
      p_meal_prepared_by_sitter: payload.p_meal_prepared_by_sitter,
      p_sitters_children_welcome: payload.p_sitters_children_welcome,
      p_pets_are_present: payload.p_pets_are_present,
      p_child_ids: payload.p_child_ids,
      p_origin: payload.p_origin,
      p_destination: payload.p_destination,
      p_adult_count: payload.p_adult_count
    });

    if (error) {
      setFormError("edit-request-error", error.message);
    } else {
      window.location.reload();
    }
  }

  async function submitOffer(requestId) {
    const notes = document.getElementById("offer-notes").value;

    const { error } = await supabase.rpc("rpc_create_offer", {
      p_request_id: requestId,
      p_notes: notes
    });

    if (error) {
      setFormError("request-error", error.message);
    } else {
      window.location.reload();
    }
  }

  async function assignOffer(offerId, assignOrder) {
    const label = assignOrder === 1 ? "Primary" : assignOrder === 2 ? "Secondary" : "Tertiary";
    const willReorder = offers.some((offer) => offer.id !== offerId && offer.assign_order === assignOrder);
    const isTargetOfferAssigned = offers.some((offer) => offer.id === offerId && offer.assign_order != null);
    const isTertiaryAssigned = offers.some((offer) => offer.assign_order === 3);

    let confirmMessage = "Are you sure you want to assign this offer";

    if (!hasRetainer) {
      confirmMessage += "?";

      if (willReorder) {
        confirmMessage += `\n\nThis will unassign the currently assigned family.`;
      }
    } else {
      confirmMessage += ` as ${label}?`

      if (willReorder) {
        confirmMessage += "\n\nThis will change assignment order for other families";

        if (!isTargetOfferAssigned && isTertiaryAssigned) {
          confirmMessage += " and unassign the currently assigned tertiary offer.";
        } else {
          confirmMessage += ".";
        }
      }
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return false;

    const { error } = await supabase.rpc("rpc_assign_offer", {
      p_offer_id: offerId,
      p_assign_order: assignOrder
    });

    if (error) {
      setFormError("request-error", error.message);
      return false;
    } else {
      window.location.reload();
      return true;
    }
  }

  async function unassignOffer(offerId) {
    const confirmed = window.confirm("Are you sure you want to unassign this offer?");
    if (!confirmed) return;

    const { error } = await supabase.rpc("rpc_unassign_offer", {
      p_offer_id: offerId
    });

    if (error) {
      setFormError("request-error", error.message);
    } else {
      window.location.reload();
    }
  }

  async function updateOffer(offerId) {
    const notes = document.getElementById("offer-notes").value;

    const { error } = await supabase.rpc("rpc_update_offer", {
      p_offer_id: offerId,
      p_notes: notes
    });

    if (error) {
      setFormError("request-error", error.message);
    } else {
      window.location.reload();
    }
  }

  async function cancelOffer(offerId) {
    if (!offerId) return;
    const confirmed = window.confirm("Are you sure you want to cancel this offer?");
    if (!confirmed) return;

    const { error } = await supabase.rpc("rpc_cancel_offer", {
      p_offer_id: offerId
    });

    if (error) {
      setFormError("request-error", error.message);
    } else {
      window.location.reload();
    }
  }

  async function cancelRequest(requestId) {
    const confirmed = window.confirm("Are you sure you want to cancel this request?");
    if (!confirmed) return;

    const { error } = await supabase.rpc("rpc_cancel_request", {
      p_request_id: requestId
    });

    if (error) {
      setFormError("request-error", error.message);
    } else {
      window.location.reload();
    }
  }

}

async function mountNewRequestForm(containerId) {
  setupNavbar("navbar");
  await requireAuth();
  const container = document.getElementById(containerId);
  if (!container) return;

  const values = getDefaultRequestFormValues();
  const { data: familyChildrenData, error: familyChildrenError } = await supabase.rpc("rpc_list_my_family_children");
  if (familyChildrenError) {
    container.innerHTML = `<p class='text-red-600'>${familyChildrenError.message}</p>`;
    return;
  }
  values.available_children = Array.isArray(familyChildrenData) ? familyChildrenData : [];
  container.innerHTML = `
    ${getRequestFormHtml("new-request", values, {
    submitLabel: "Create Request",
    showCancel: false,
    disableType: false
  })}
  `;

  initRequestFormInteractions("new-request");

  document.getElementById("new-request-submit-btn").onclick = async () => {
    const formValues = readRequestFormValues("new-request");
    const { payload, errors } = normalizeFormPayload(formValues);

    if (errors?.length) {
      setFormError("new-request-error", errors);
      return;
    }

    const { error } = await supabase.rpc("rpc_create_request", payload);

    if (error) {
      setFormError("new-request-error", error.message);
    } else {
      window.location = "/requests.html";
    }
  };
}

export { listRequestsInto, loadRequestInto, mountNewRequestForm, mountRequestsPage };
