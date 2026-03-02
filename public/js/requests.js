import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { formatDateTime } from "./utils.js";
import { formatRequestStatusLabel, getRequestStatusTextClass, renderRequestListCard } from "./request-cards.js";

function toDateInputFromIso(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputFromIso(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

function calculateHours(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso) - new Date(startIso);
  if (ms <= 0) return null;
  const quarterHours = Math.ceil(ms / (15 * 60 * 1000));
  return quarterHours * 0.25;
}

function getChildAgeLabel(dateOfBirthValue) {
  if (!dateOfBirthValue) return "";

  const dateOfBirth = new Date(dateOfBirthValue);
  if (Number.isNaN(dateOfBirth.getTime())) return "";

  const today = new Date();
  let years = today.getFullYear() - dateOfBirth.getFullYear();
  let months = today.getMonth() - dateOfBirth.getMonth();

  if (today.getDate() < dateOfBirth.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) {
    return "0y 0m";
  }

  return `${years}y ${months}m`;
}

function getRequestFormValuesFromRequest(request) {
  return {
    request_type: request.request_type || "babysit",
    notes: request.notes || "",
    request_date: request.request_date || toDateInputFromIso(request.start_time),
    start_time: toTimeInputFromIso(request.start_time),
    end_time: toTimeInputFromIso(request.end_time),
    flexible_date: !!request.flexible_date,
    flexible_start_time: !!request.flexible_start_time,
    flexible_end_time: !!request.flexible_end_time,
    hours: request.hours ?? "",
    sit_location: request.sit_location || "requester_house",
    meal_required: !!request.meal_required,
    meal_prepared_by_sitter: !!request.meal_prepared_by_sitter,
    sitters_children_welcome: !!request.sitters_children_welcome,
    selected_child_ids: [],
    available_children: [],
    origin: request.origin || "",
    destination: request.destination || ""
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
    sit_location: "requester_house",
    meal_required: false,
    meal_prepared_by_sitter: false,
    sitters_children_welcome: false,
    selected_child_ids: [],
    available_children: [],
    origin: "",
    destination: ""
  };
}

function getRequestFormHtml(prefix, values, options = {}) {
  const submitLabel = options.submitLabel || "Save";
  const showCancel = !!options.showCancel;
  const disableType = !!options.disableType;
  const readOnly = !!options.readOnly;
  const showActions = options.showActions !== false;
  const disabledAttr = readOnly ? "disabled" : "";
  const readOnlyFieldClass = readOnly ? "bg-gray-100 text-gray-700" : "";

  return `
    <div class="space-y-2">
      <label class="block mb-2 font-semibold">Request Type <span class="text-red-600">*</span></label>
      <select id="${prefix}-request-type" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${(disableType || readOnly) ? "disabled" : ""}>
        <option value="babysit" ${values.request_type === "babysit" ? "selected" : ""}>Babysit</option>
        <option value="drive" ${values.request_type === "drive" ? "selected" : ""}>Drive</option>
        <option value="favor" ${values.request_type === "favor" ? "selected" : ""}>Favor</option>
      </select>

      <label class="block mb-2 font-semibold">Description <span class="text-red-600">*</span></label>
      <textarea id="${prefix}-notes" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" required ${disabledAttr}>${values.notes}</textarea>

      <div class="flex items-center justify-between mb-2">
        <label class="font-semibold">Request Date <span class="text-red-600">*</span></label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" id="${prefix}-flexible-date" ${values.flexible_date ? "checked" : ""} ${disabledAttr}>
          <span>Flexible</span>
        </label>
      </div>
      <input type="date" id="${prefix}-request-date" value="${values.request_date}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" required ${disabledAttr}>

      <div class="flex items-center justify-between mb-2">
          <label class="font-semibold">Start Time</label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" id="${prefix}-flexible-start-time" ${values.flexible_start_time ? "checked" : ""} ${disabledAttr}>
          <span>Flexible</span>
        </label>
      </div>
      <input type="time" id="${prefix}-start-time" value="${values.start_time}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>

      <div id="${prefix}-end-time-section">
        <div class="flex items-center justify-between mb-2">
          <label class="font-semibold">End Time</label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" id="${prefix}-flexible-end-time" ${values.flexible_end_time ? "checked" : ""} ${disabledAttr}>
            <span>Flexible</span>
          </label>
        </div>
        <input type="time" id="${prefix}-end-time" value="${values.end_time}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
      </div>

      <div id="${prefix}-hours-wrapper">
        <label class="block mb-2 font-semibold">Hours</label>
        <input type="number" step="0.25" min="0" id="${prefix}-hours" value="${values.hours}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
      </div>

      <div id="${prefix}-babysit-fields">
        <label class="block mb-2 font-semibold">Sit Location</label>
        <select id="${prefix}-sit-location" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
          <option value="requester_house" ${values.sit_location === "requester_house" ? "selected" : ""}>Requester's House</option>
          <option value="sitter_house" ${values.sit_location === "sitter_house" ? "selected" : ""}>Sitter's House</option>
          <option value="either" ${values.sit_location === "either" ? "selected" : ""}>Either</option>
        </select>

        <label class="inline-flex items-center gap-2 mb-2">
          <input type="checkbox" id="${prefix}-meal-required" ${values.meal_required ? "checked" : ""} ${disabledAttr}>
          <span>Meal required</span>
        </label>

        <label id="${prefix}-meal-prepared-wrapper" class="inline-flex items-center gap-2 mb-2 ml-2">
          <input type="checkbox" id="${prefix}-meal-prepared-by-sitter" ${values.meal_prepared_by_sitter ? "checked" : ""} ${disabledAttr}>
          <span>Meal prepared by sitter</span>
        </label>

        <label class="flex items-center gap-2 mb-4">
          <input type="checkbox" id="${prefix}-sitters-children-welcome" ${values.sitters_children_welcome ? "checked" : ""} ${disabledAttr}>
          <span>Sitter's children welcome</span>
        </label>

        <label class="block mb-2 font-semibold">Children</label>
        <div id="${prefix}-children-select" class="border rounded p-3 mb-4 space-y-2">
          ${Array.isArray(values.available_children) && values.available_children.length
            ? values.available_children.map((child) => {
                const selected = Array.isArray(values.selected_child_ids) && values.selected_child_ids.includes(child.id);
                const ageLabel = getChildAgeLabel(child.date_of_birth);
                return `
                  <label class="flex items-center gap-2">
                    <input type="checkbox" data-child-id="${child.id}" ${selected ? "checked" : ""} ${disabledAttr}>
                    <span>${child.name || "Unnamed child"}${ageLabel ? ` (${ageLabel})` : ""}</span>
                  </label>
                `;
              }).join("")
            : '<p class="text-sm text-gray-600">No children available for selection.</p>'}
        </div>
      </div>

      <div id="${prefix}-drive-fields">
        <label class="block mb-2 font-semibold">Origin</label>
        <input type="text" id="${prefix}-origin" value="${values.origin}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>

        <label class="block mb-2 font-semibold">Destination</label>
        <input type="text" id="${prefix}-destination" value="${values.destination}" class="border p-2 w-full mb-4 ${readOnlyFieldClass}" ${disabledAttr}>
      </div>

      ${showActions ? `
      <div class="mt-6 flex gap-2">
        <button id="${prefix}-submit-btn" class="bg-blue-600 text-white px-4 py-2 ${showCancel ? "" : "w-full "}rounded hover:bg-blue-700">${submitLabel}</button>
        ${showCancel ? `<button id="${prefix}-cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>` : ""}
      </div>
      ` : ""}

      <p id="${prefix}-error" class="text-red-600 mt-2"></p>
    </div>
  `;
}

function initRequestFormInteractions(prefix) {
  const requestType = document.getElementById(`${prefix}-request-type`);
  const requestDateInput = document.getElementById(`${prefix}-request-date`);
  const startTimeInput = document.getElementById(`${prefix}-start-time`);
  const endTimeSection = document.getElementById(`${prefix}-end-time-section`);
  const endTimeInput = document.getElementById(`${prefix}-end-time`);
  const flexibleEndTimeInput = document.getElementById(`${prefix}-flexible-end-time`);
  const hoursWrapper = document.getElementById(`${prefix}-hours-wrapper`);
  const hoursInput = document.getElementById(`${prefix}-hours`);
  const babysitFields = document.getElementById(`${prefix}-babysit-fields`);
  const mealRequired = document.getElementById(`${prefix}-meal-required`);
  const mealPreparedBySitter = document.getElementById(`${prefix}-meal-prepared-by-sitter`);
  const mealPreparedWrapper = document.getElementById(`${prefix}-meal-prepared-wrapper`);
  const driveFields = document.getElementById(`${prefix}-drive-fields`);

  function refreshCalculatedHours() {
    if (requestType.value !== "babysit") {
      return;
    }

    const startIso = combineDateAndTime(requestDateInput.value, startTimeInput.value);
    const endIso = combineDateAndTime(requestDateInput.value, endTimeInput.value);
    const autoHours = calculateHours(startIso, endIso);
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
    hoursInput.classList.toggle("bg-gray-100", isBabysit);
    hoursInput.classList.toggle("text-gray-700", isBabysit);
    babysitFields.style.display = isBabysit ? "block" : "none";
    if (isBabysit && !mealRequired.checked) {
      mealPreparedBySitter.checked = false;
    }
    mealPreparedWrapper.style.display = isBabysit && mealRequired.checked ? "inline-flex" : "none";
    driveFields.style.display = isDrive ? "block" : "none";
    refreshCalculatedHours();
  }

  requestType.addEventListener("change", refreshFormVisibility);
  mealRequired.addEventListener("change", refreshFormVisibility);
  requestDateInput.addEventListener("change", refreshCalculatedHours);
  startTimeInput.addEventListener("change", refreshCalculatedHours);
  endTimeInput.addEventListener("change", refreshCalculatedHours);
  refreshFormVisibility();
}

function readRequestFormValues(prefix) {
  const childIds = Array.from(document.querySelectorAll(`#${prefix}-children-select [data-child-id]:checked`))
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
    sit_location: document.getElementById(`${prefix}-sit-location`).value,
    meal_required: document.getElementById(`${prefix}-meal-required`).checked,
    meal_prepared_by_sitter: document.getElementById(`${prefix}-meal-prepared-by-sitter`).checked,
    sitters_children_welcome: document.getElementById(`${prefix}-sitters-children-welcome`).checked,
    selected_child_ids: childIds,
    origin: document.getElementById(`${prefix}-origin`).value,
    destination: document.getElementById(`${prefix}-destination`).value
  };
}

function normalizeFormPayload(values, options = {}) {
  const requestType = options.requestTypeOverride || values.request_type;
  const description = (values.notes || "").trim();

  if (!requestType || !["babysit", "drive", "favor"].includes(requestType)) {
    return { error: "Request type is required." };
  }

  if (!description) {
    return { error: "Description is required." };
  }

  if (values.request_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(`${values.request_date}T00:00:00`);
    if (requestedDate < today) {
      return { error: "Request date cannot be in the past." };
    }
  }

  if (!values.request_date) {
    return { error: "Request date is required." };
  }

  const startIso = combineDateAndTime(values.request_date, values.start_time);
  const endIso = combineDateAndTime(values.request_date, values.end_time);

  if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
    return { error: "End time must be after start time." };
  }

  if (values.meal_prepared_by_sitter && !values.meal_required) {
    return { error: "Meal cannot be prepared by sitter unless meal is required." };
  }

  const autoHours = requestType === "babysit" ? calculateHours(startIso, endIso) : null;
  const manualHours = requestType !== "babysit" && values.hours !== "" ? Number(values.hours) : null;
  const payloadHours = autoHours ?? manualHours;

  if (payloadHours !== null && (!Number.isFinite(payloadHours) || payloadHours <= 0)) {
    return { error: "Hours must be greater than zero." };
  }

  const isBabysit = requestType === "babysit";
  const isDrive = requestType === "drive";

  return {
    payload: {
      p_request_type: requestType,
      p_notes: description,
      p_request_date: values.request_date || null,
      p_start_time: startIso,
      p_end_time: endIso,
      p_flexible_date: !!values.flexible_date,
      p_flexible_start_time: !!values.flexible_start_time,
      p_flexible_end_time: !!values.flexible_end_time,
      p_hours: payloadHours,
      p_sit_location: isBabysit ? (values.sit_location || null) : null,
      p_meal_required: isBabysit ? !!values.meal_required : false,
      p_meal_prepared_by_sitter: isBabysit ? !!values.meal_prepared_by_sitter : false,
      p_sitters_children_welcome: isBabysit ? !!values.sitters_children_welcome : false,
      p_child_ids: isBabysit ? (values.selected_child_ids || []) : null,
      p_origin: isDrive ? (values.origin || null) : null,
      p_destination: isDrive ? (values.destination || null) : null
    }
  };
}

function formatSitLocation(value) {
  if (value === "sitter_house") return "At sitter's house";
  if (value === "requester_house") return "At requester's house";
  if (value === "either") return "Either";
  return "Not specified";
}

async function listRequestsInto(containerId) {
  await requireAuth();

  const { data, error } = await supabase.rpc("rpc_list_requests");

  const el = document.getElementById(containerId);

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  el.innerHTML = data.length
    ? data.map((r) => renderRequestListCard(r)).join("")
    : "<p class='text-gray-600'>No requests yet.</p>";
}

async function loadRequestInto(containerId) {
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

  const offers = offersData || [];
  const requestChildren = Array.isArray(requestChildrenData) ? requestChildrenData : [];

  const { data: currentFamilyId, error: currentFamilyError } = await supabase.rpc("rpc_current_family_id");
  if (currentFamilyError || !currentFamilyId) {
    el.innerHTML = `<p class='text-red-600'>${currentFamilyError?.message || "Unable to resolve current family."}</p>`;
    return;
  }

  const requesterId = r.requester_family_id;
  const isRequester = requesterId === currentFamilyId;
  const canOffer = r.status === "open" && !isRequester;
  const canOfferWhenOffered = r.status === "offered" && !isRequester;
  const hasAlreadyOffered = offers?.some(c => c.family_id === currentFamilyId);
  const canAssignOffer = isRequester && r.status === "offered";
  const canEdit = isRequester && r.status === "open";
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
    <div class="bg-white p-6 rounded-lg shadow max-w-4xl">
      <h1 id="request-page-title" class="text-3xl font-bold mb-4">Request Details</h1>
      <p class="font-semibold mb-4">Status: <span class="${getRequestStatusTextClass(r.status)}">${formatRequestStatusLabel(r.status)}</span></p>

      <div id="view-mode">
        ${getRequestFormHtml("view-request", viewFormValues, { disableType: true, readOnly: true, showActions: false })}
        <div class="mt-6 flex gap-2">
          ${isRequester
            ? `<button id="edit-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${canEdit ? "" : "opacity-60 cursor-not-allowed"}" ${canEdit ? "" : "disabled"}>Edit Request</button>`
            : ((canOffer || (canOfferWhenOffered && !hasAlreadyOffered))
              ? `<button id="offer-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Offer to Help</button>`
              : "")}
        </div>
        ${isRequester && !canEdit ? `<p class="text-sm text-gray-600 mt-2">Only open requests can be edited.</p>` : ""}
      </div>

      <div id="edit-mode" style="display: none;">
        ${getRequestFormHtml("edit-request", editFormValues, { submitLabel: "Save Request", showCancel: true, disableType: true })}
      </div>

      ${offers && offers.length > 0 ? `
        <div class="mt-8 pt-8 border-t">
          <h2 class="text-2xl font-bold mb-4">Offers (${offers.length})</h2>
          <div class="space-y-3">
            ${offers.map((offer) => {
              const isAssignedOffer = !!r.assignee_family_id && offer.family_id === r.assignee_family_id;
              return `
              <div class="${isAssignedOffer ? "bg-green-100 border-green-300" : "bg-gray-50"} p-4 rounded border">
                <p class="font-semibold text-gray-800 mb-1">${offer.family_name || "Unknown family"}</p>
                <p class="text-sm text-gray-600 mb-1">Offered ${formatDateTime(offer.created_at)}</p>
                <p class="text-sm text-gray-600 mb-1">Current Hours Balance: ${offer.hours_balance ?? 0}</p>
                <p class="text-sm text-gray-600 mb-1">Used this month: ${offer.has_used_this_month ? "Yes" : "No"}</p>
                <p class="text-gray-700">${offer.comment || "<em>No comment</em>"}</p>
                ${isAssignedOffer ? `<p class="text-sm text-green-700 mt-3 font-semibold">Accepted Offer</p>` : ""}
                ${canAssignOffer && !isAssignedOffer
                  ? `<button class="assign-offer-btn mt-3 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700" data-offer-id="${offer.id}">Accept Offer</button>`
                  : ""}
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
        <h2 class="text-xl font-bold mb-4">Add a Comment (Optional)</h2>
        <textarea id="offer-comment" placeholder="Why do you want to offer help for this request?" class="border p-2 w-full mb-4 h-24"></textarea>
        <div class="flex gap-2">
          <button id="offer-submit-btn" class="bg-blue-600 text-white px-4 py-2 rounded flex-1 hover:bg-blue-700">Submit Offer</button>
          <button id="offer-cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded flex-1 hover:bg-gray-500">Cancel</button>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  if (document.getElementById("offer-btn")) {
    document.getElementById("offer-btn").onclick = () => {
      document.getElementById("offer-modal").style.display = "flex";
    };
  }

  if (document.getElementById("offer-submit-btn")) {
    document.getElementById("offer-submit-btn").onclick = () => submitOffer(id);
  }

  if (document.getElementById("offer-cancel-btn")) {
    document.getElementById("offer-cancel-btn").onclick = () => {
      document.getElementById("offer-modal").style.display = "none";
    };
  }

  document.querySelectorAll(".assign-offer-btn").forEach((button) => {
    button.onclick = async () => {
      const offerId = button.getAttribute("data-offer-id");
      if (!offerId) return;
      await assignOffer(id, offerId);
    };
  });

  initRequestFormInteractions("view-request");

  if (document.getElementById("edit-btn")) {
    document.getElementById("edit-btn").onclick = () => toggleEditMode(true);
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
  }

  async function saveRequest(requestId) {
    const values = readRequestFormValues("edit-request");
    const { payload, error: validationError } = normalizeFormPayload(values, {
      requestTypeOverride: r.request_type
    });

    if (validationError) {
      document.getElementById("edit-request-error").textContent = validationError;
      return;
    }

    const { error } = await supabase.rpc("rpc_update_request", {
      p_request_id: requestId,
      p_request_date: payload.p_request_date,
      p_flexible_date: payload.p_flexible_date,
      p_flexible_start_time: payload.p_flexible_start_time,
      p_flexible_end_time: payload.p_flexible_end_time,
      p_start_time: payload.p_start_time,
      p_end_time: payload.p_end_time,
      p_notes: payload.p_notes,
      p_hours: payload.p_hours,
      p_sit_location: payload.p_sit_location,
      p_meal_required: payload.p_meal_required,
      p_meal_prepared_by_sitter: payload.p_meal_prepared_by_sitter,
      p_sitters_children_welcome: payload.p_sitters_children_welcome,
      p_child_ids: payload.p_child_ids,
      p_origin: payload.p_origin,
      p_destination: payload.p_destination
    });

    if (error) {
      document.getElementById("edit-request-error").textContent = error.message;
    } else {
      window.location.reload();
    }
  }

  async function submitOffer(requestId) {
    const comment = document.getElementById("offer-comment").value;

    const { error } = await supabase.rpc("rpc_offer_request", {
      p_request_id: requestId,
      p_comment: comment
    });

    if (error) {
      document.getElementById("request-error").textContent = error.message;
    } else {
      window.location.reload();
    }
  }

  async function assignOffer(requestId, offerId) {
    const { error } = await supabase.rpc("rpc_select_request_winner", {
      p_request_id: requestId,
      p_offer_id: offerId
    });

    if (error) {
      document.getElementById("request-error").textContent = error.message;
    } else {
      window.location.reload();
    }
  }

}

async function mountNewRequestForm(containerId) {
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
  container.innerHTML = getRequestFormHtml("new-request", values, {
    submitLabel: "Create Request",
    showCancel: false,
    disableType: false
  });

  initRequestFormInteractions("new-request");

  document.getElementById("new-request-submit-btn").onclick = async () => {
    const formValues = readRequestFormValues("new-request");
    const { payload, error: validationError } = normalizeFormPayload(formValues);

    if (validationError) {
      document.getElementById("new-request-error").textContent = validationError;
      return;
    }

    const { error } = await supabase.rpc("rpc_create_request", payload);

    if (error) {
      document.getElementById("new-request-error").textContent = error.message;
    } else {
      window.location = "/";
    }
  };
}

// Expose functions
window.listRequestsInto = listRequestsInto;
window.loadRequestInto = loadRequestInto;
window.mountNewRequestForm = mountNewRequestForm;

// Module exports
export { listRequestsInto, loadRequestInto, mountNewRequestForm };
