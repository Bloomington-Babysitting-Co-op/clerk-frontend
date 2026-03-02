import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { formatDateTime } from "./utils.js";

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
  return Number((ms / (1000 * 60 * 60)).toFixed(2));
}

function getRequestFormValuesFromRequest(request) {
  return {
    request_type: request.request_type || "babysit",
    sit_location: request.sit_location || "requester_house",
    meal_required: !!request.meal_required,
    meal_prepared_by_sitter: !!request.meal_prepared_by_sitter,
    sitters_kids_welcome: !!request.sitters_kids_welcome,
    selected_child_ids: [],
    available_children: [],
    origin: request.origin || "",
    destination: request.destination || "",
    flexible_date: !!request.flexible_date,
    flexible_start_time: !!request.flexible_start_time,
    flexible_end_time: !!request.flexible_end_time,
    request_date: request.request_date || toDateInputFromIso(request.start_time),
    start_time: toTimeInputFromIso(request.start_time),
    end_time: toTimeInputFromIso(request.end_time),
    hours: request.hours ?? "",
    notes: request.notes || ""
  };
}

function getDefaultRequestFormValues() {
  return {
    request_type: "babysit",
    sit_location: "requester_house",
    meal_required: false,
    meal_prepared_by_sitter: false,
    sitters_kids_welcome: false,
    selected_child_ids: [],
    available_children: [],
    origin: "",
    destination: "",
    flexible_date: false,
    flexible_start_time: false,
    flexible_end_time: false,
    request_date: "",
    start_time: "",
    end_time: "",
    hours: "",
    notes: ""
  };
}

function getRequestFormHtml(prefix, values, options = {}) {
  const submitLabel = options.submitLabel || "Save";
  const showCancel = !!options.showCancel;
  const disableType = !!options.disableType;

  return `
    <div class="space-y-2">
      <label class="block mb-2 font-semibold">Request Type</label>
      <select id="${prefix}-request-type" class="border p-2 w-full mb-4" ${disableType ? "disabled" : ""}>
        <option value="babysit" ${values.request_type === "babysit" ? "selected" : ""}>Babysit</option>
        <option value="drive" ${values.request_type === "drive" ? "selected" : ""}>Drive</option>
        <option value="favor" ${values.request_type === "favor" ? "selected" : ""}>Favor</option>
      </select>

      <div id="${prefix}-babysit-fields">
        <label class="block mb-2 font-semibold">Sit Location</label>
        <select id="${prefix}-sit-location" class="border p-2 w-full mb-4">
          <option value="requester_house" ${values.sit_location === "requester_house" ? "selected" : ""}>Requester's House</option>
          <option value="sitter_house" ${values.sit_location === "sitter_house" ? "selected" : ""}>Sitter's House</option>
          <option value="either" ${values.sit_location === "either" ? "selected" : ""}>Either</option>
        </select>

        <label class="inline-flex items-center gap-2 mb-2">
          <input type="checkbox" id="${prefix}-meal-required" ${values.meal_required ? "checked" : ""}>
          <span>Meal required</span>
        </label>

        <label id="${prefix}-meal-prepared-wrapper" class="inline-flex items-center gap-2 mb-2 ml-2">
          <input type="checkbox" id="${prefix}-meal-prepared-by-sitter" ${values.meal_prepared_by_sitter ? "checked" : ""}>
          <span>Meal prepared by sitter</span>
        </label>

        <label class="inline-flex items-center gap-2 mb-4">
          <input type="checkbox" id="${prefix}-sitters-kids-welcome" ${values.sitters_kids_welcome ? "checked" : ""}>
          <span>Sitter's kids welcome</span>
        </label>

        <label class="block mb-2 font-semibold">Children</label>
        <div id="${prefix}-children-select" class="border rounded p-3 mb-4 space-y-2">
          ${Array.isArray(values.available_children) && values.available_children.length
            ? values.available_children.map((child) => {
                const selected = Array.isArray(values.selected_child_ids) && values.selected_child_ids.includes(child.id);
                return `
                  <label class="flex items-start gap-2">
                    <input type="checkbox" data-child-id="${child.id}" ${selected ? "checked" : ""}>
                    <span>${child.name || "Unnamed child"}${child.date_of_birth ? ` (${String(child.date_of_birth).slice(0, 7)})` : ""}</span>
                  </label>
                `;
              }).join("")
            : '<p class="text-sm text-gray-600">No children available for selection.</p>'}
        </div>
      </div>

      <div id="${prefix}-drive-fields">
        <label class="block mb-2 font-semibold">Origin</label>
        <input type="text" id="${prefix}-origin" value="${values.origin}" class="border p-2 w-full mb-4">

        <label class="block mb-2 font-semibold">Destination</label>
        <input type="text" id="${prefix}-destination" value="${values.destination}" class="border p-2 w-full mb-4">
      </div>

      <label class="block mb-2 font-semibold">Description</label>
      <textarea id="${prefix}-notes" class="border p-2 w-full mb-4" required>${values.notes}</textarea>

      <div class="flex items-center justify-between mb-2">
        <label class="font-semibold">Request Date</label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" id="${prefix}-flexible-date" ${values.flexible_date ? "checked" : ""}>
          <span>Flexible</span>
        </label>
      </div>
      <input type="date" id="${prefix}-request-date" value="${values.request_date}" class="border p-2 w-full mb-4">

      <div class="flex items-center justify-between mb-2">
        <label class="font-semibold">Start Time (Optional)</label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" id="${prefix}-flexible-start-time" ${values.flexible_start_time ? "checked" : ""}>
          <span>Flexible</span>
        </label>
      </div>
      <input type="time" id="${prefix}-start-time" value="${values.start_time}" class="border p-2 w-full mb-4">

      <div id="${prefix}-end-time-section">
        <div class="flex items-center justify-between mb-2">
          <label class="font-semibold">End Time (Optional)</label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" id="${prefix}-flexible-end-time" ${values.flexible_end_time ? "checked" : ""}>
            <span>Flexible</span>
          </label>
        </div>
        <input type="time" id="${prefix}-end-time" value="${values.end_time}" class="border p-2 w-full mb-4">
      </div>

      <p id="${prefix}-babysit-hours-note" class="text-sm text-gray-600 mb-4">
        Hours will be auto-calculated from start and end time when both are provided.
      </p>

      <div id="${prefix}-hours-wrapper">
        <label class="block mb-2 font-semibold">Hours (Optional)</label>
        <input type="number" step="0.25" min="0" id="${prefix}-hours" value="${values.hours}" class="border p-2 w-full mb-4">
      </div>

      <div class="mt-6 flex gap-2">
        <button id="${prefix}-submit-btn" class="bg-blue-600 text-white px-4 py-2 ${showCancel ? "" : "w-full "}rounded hover:bg-blue-700">${submitLabel}</button>
        ${showCancel ? `<button id="${prefix}-cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>` : ""}
      </div>

      <p id="${prefix}-error" class="text-red-600 mt-2"></p>
    </div>
  `;
}

function initRequestFormInteractions(prefix) {
  const requestType = document.getElementById(`${prefix}-request-type`);
  const babysitFields = document.getElementById(`${prefix}-babysit-fields`);
  const mealRequired = document.getElementById(`${prefix}-meal-required`);
  const driveFields = document.getElementById(`${prefix}-drive-fields`);
  const mealPreparedWrapper = document.getElementById(`${prefix}-meal-prepared-wrapper`);
  const hoursWrapper = document.getElementById(`${prefix}-hours-wrapper`);
  const babysitHoursNote = document.getElementById(`${prefix}-babysit-hours-note`);
  const endTimeSection = document.getElementById(`${prefix}-end-time-section`);
  const endTimeInput = document.getElementById(`${prefix}-end-time`);
  const flexibleEndTimeInput = document.getElementById(`${prefix}-flexible-end-time`);

  function refreshFormVisibility() {
    const isBabysit = requestType.value === "babysit";
    const isDrive = requestType.value === "drive";
    babysitFields.style.display = isBabysit ? "block" : "none";
    mealPreparedWrapper.style.display = isBabysit && mealRequired.checked ? "inline-flex" : "none";
    driveFields.style.display = isDrive ? "block" : "none";
    endTimeSection.style.display = isDrive ? "none" : "block";
    if (isDrive) {
      endTimeInput.value = "";
      flexibleEndTimeInput.checked = false;
    }
    hoursWrapper.style.display = isBabysit ? "none" : "block";
    babysitHoursNote.style.display = isBabysit ? "block" : "none";
  }

  requestType.addEventListener("change", refreshFormVisibility);
  mealRequired.addEventListener("change", refreshFormVisibility);
  refreshFormVisibility();
}

function readRequestFormValues(prefix) {
  const childIds = Array.from(document.querySelectorAll(`#${prefix}-children-select [data-child-id]:checked`))
    .map((input) => input.getAttribute("data-child-id"))
    .filter(Boolean);

  return {
    request_type: document.getElementById(`${prefix}-request-type`).value,
    sit_location: document.getElementById(`${prefix}-sit-location`).value,
    meal_required: document.getElementById(`${prefix}-meal-required`).checked,
    meal_prepared_by_sitter: document.getElementById(`${prefix}-meal-prepared-by-sitter`).checked,
    sitters_kids_welcome: document.getElementById(`${prefix}-sitters-kids-welcome`).checked,
    selected_child_ids: childIds,
    origin: document.getElementById(`${prefix}-origin`).value,
    destination: document.getElementById(`${prefix}-destination`).value,
    flexible_date: document.getElementById(`${prefix}-flexible-date`).checked,
    flexible_start_time: document.getElementById(`${prefix}-flexible-start-time`).checked,
    flexible_end_time: document.getElementById(`${prefix}-flexible-end-time`).checked,
    request_date: document.getElementById(`${prefix}-request-date`).value,
    start_time: document.getElementById(`${prefix}-start-time`).value,
    end_time: document.getElementById(`${prefix}-end-time`).value,
    hours: document.getElementById(`${prefix}-hours`).value,
    notes: document.getElementById(`${prefix}-notes`).value
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

  if ((requestType === "babysit" || requestType === "drive") && !values.request_date && !values.flexible_date) {
    return { error: "Date is required for babysit and drive requests." };
  }

  if ((values.start_time || values.end_time) && !values.request_date && !values.flexible_date) {
    return { error: "Date is required when start or end time is provided, unless date is marked flexible." };
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
      p_flexible_date: !!values.flexible_date,
      p_flexible_start_time: !!values.flexible_start_time,
      p_flexible_end_time: !!values.flexible_end_time,
      p_request_date: values.request_date || null,
      p_start_time: startIso,
      p_end_time: endIso,
      p_hours: payloadHours,
      p_sit_location: isBabysit ? (values.sit_location || null) : null,
      p_meal_required: isBabysit ? !!values.meal_required : false,
      p_meal_prepared_by_sitter: isBabysit ? !!values.meal_prepared_by_sitter : false,
      p_sitters_kids_welcome: isBabysit ? !!values.sitters_kids_welcome : false,
      p_child_ids: isBabysit ? (values.selected_child_ids || []) : null,
      p_origin: isDrive ? (values.origin || null) : null,
      p_destination: isDrive ? (values.destination || null) : null
    }
  };
}

function formatRequestSchedule(request) {
  const hasStartAndEnd = request.start_time && request.end_time;
  if (hasStartAndEnd) {
    return `${formatDateTime(request.start_time)} → ${formatDateTime(request.end_time)}`;
  }
  if (request.request_date) {
    return new Date(`${request.request_date}T00:00:00`).toLocaleDateString();
  }
  return "Date/time flexible";
}

function formatSitLocation(value) {
  if (value === "sitter_house") return "At sitter's house";
  if (value === "requester_house") return "At requester's house";
  if (value === "either") return "Either";
  return "Not specified";
}

function formatRequestFlexibility(request) {
  const labels = [];
  if (request.flexible_date) labels.push("Date");
  if (request.flexible_start_time) labels.push("Start");
  if (request.flexible_end_time) labels.push("End");
  return labels.length ? `Flexible: ${labels.join(", ")}` : "Flexible: None";
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
    ? data.map(r => `
      <div class="bg-white border p-4 rounded-lg shadow hover:shadow-lg transition">
        <p class="font-semibold text-lg text-gray-800">${r.status}</p>
        <p class="text-sm text-gray-600 mt-1">${formatRequestSchedule(r)}</p>
        <p class="text-sm text-gray-600 mt-1">Type: ${r.request_type}</p>
        <p class="text-sm text-gray-600 mt-1">${formatRequestFlexibility(r)}</p>
        <p class="text-gray-700 mt-2">${r.notes || ""}</p>
        ${r.hours ? `<p class="text-sm text-gray-600 mt-1">Hours: ${r.hours}</p>` : ""}
        <a href="/request_view.html?id=${r.id}" class="text-blue-600 underline text-sm mt-3 inline-block">View Details</a>
      </div>
    `).join("")
    : "<p class='text-gray-600'>No requests yet.</p>";
}

async function loadRequestInto(containerId) {
  const session = await requireAuth();
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

  const userId = session.user.id;
  const requesterId = r.requester_family_id;
  const isRequester = requesterId === userId;
  const canOffer = r.status === "open" && !isRequester;
  const canOfferWhenOffered = r.status === "offered" && !isRequester;
  const hasAlreadyOffered = offers?.some(c => c.family_id === userId);
  const canSelectWinner = isRequester && r.status === "offered";
  const canComplete = r.status === "assigned" && (isRequester || r.assignee_family_id === userId);
  const canEdit = isRequester && r.status === "open";
  const canCancel = isRequester && ["open", "offered", "assigned"].includes(r.status);
  const editFormValues = getRequestFormValuesFromRequest(r);
  const selectedChildIds = requestChildren.map((child) => child.id);
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
      <h1 class="text-3xl font-bold mb-4">Request Details</h1>
      <p class="mb-2"><span class="font-semibold">Status:</span> <span class="text-lg text-blue-600 font-semibold">${r.status}</span></p>
      <p class="mb-2"><span class="font-semibold">Type:</span> ${r.request_type}</p>
      ${r.request_date ? `<p class="mb-2"><span class="font-semibold">Date:</span> ${new Date(`${r.request_date}T00:00:00`).toLocaleDateString()}</p>` : ""}
      <p class="mb-2"><span class="font-semibold">Date flexible:</span> ${r.flexible_date ? "Yes" : "No"}</p>
      <p class="mb-2"><span class="font-semibold">Start time flexible:</span> ${r.flexible_start_time ? "Yes" : "No"}</p>
      <p class="mb-2"><span class="font-semibold">End time flexible:</span> ${r.flexible_end_time ? "Yes" : "No"}</p>
      ${r.hours ? `<p class="mb-2"><span class="font-semibold">Hours:</span> ${r.hours}</p>` : ""}
      ${r.request_type === "babysit" ? `<p class="mb-2"><span class="font-semibold">Sit location:</span> ${formatSitLocation(r.sit_location)}</p>` : ""}
      ${r.request_type === "babysit" ? `<p class="mb-2"><span class="font-semibold">Meal required:</span> ${r.meal_required ? "Yes" : "No"}</p>` : ""}
      ${r.request_type === "babysit" && r.meal_required ? `<p class="mb-2"><span class="font-semibold">Meal prepared by sitter:</span> ${r.meal_prepared_by_sitter ? "Yes" : "No"}</p>` : ""}
      ${r.request_type === "babysit" ? `<p class="mb-2"><span class="font-semibold">Sitter's kids welcome:</span> ${r.sitters_kids_welcome ? "Yes" : "No"}</p>` : ""}
      ${r.request_type === "babysit" ? `<p class="mb-2"><span class="font-semibold">Children:</span> ${requestChildren.length ? requestChildren.map((child) => child.name || "Unnamed child").join(", ") : "None selected"}</p>` : ""}
      ${r.request_type === "drive" ? `<p class="mb-2"><span class="font-semibold">Origin:</span> ${r.origin || "Not specified"}</p>` : ""}
      ${r.request_type === "drive" ? `<p class="mb-2"><span class="font-semibold">Destination:</span> ${r.destination || "Not specified"}</p>` : ""}
      
      <div id="view-mode">
        <p class="mb-2"><span class="font-semibold">Time:</span> ${formatRequestSchedule(r)}</p>
        <p class="mb-4 mt-4 text-gray-700"><span class="font-semibold">Description:</span> ${r.notes || ""}</p>

        <div class="mt-6 flex gap-2">
          ${canOffer ? `<button id="offer-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Offer to Help</button>` : ""}
          ${canOfferWhenOffered && !hasAlreadyOffered ? `<button id="offer-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add Offer</button>` : ""}
          ${canComplete ? `<button id="complete-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Complete</button>` : ""}
          ${canEdit ? `<button id="edit-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Edit</button>` : ""}
          ${canCancel ? `<button id="cancel-request-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Cancel Request</button>` : ""}
        </div>
      </div>

      <div id="edit-mode" style="display: none;">
        ${getRequestFormHtml("edit-request", editFormValues, { submitLabel: "Save", showCancel: true, disableType: true })}
      </div>

      ${offers && offers.length > 0 ? `
        <div class="mt-8 pt-8 border-t">
          <h2 class="text-2xl font-bold mb-4">Offers (${offers.length})</h2>
          <div class="space-y-3">
            ${offers.map((offer, index) => `
              <div class="bg-gray-50 p-4 rounded border">
                <p class="text-sm text-gray-600 mb-1">Offered ${formatDateTime(offer.created_at)}</p>
                <p class="text-gray-700">${offer.comment || "<em>No comment</em>"}</p>
                ${canSelectWinner ? `<button class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm select-winner-btn" data-offer-id="${offer.id}">Select as Winner</button>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <p id="request-error" class="text-red-600 mt-4"></p>
    </div>

    <div id="offer-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50;">
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

  const selectWinnerBtns = document.querySelectorAll(".select-winner-btn");
  selectWinnerBtns.forEach(btn => {
    btn.onclick = () => selectWinner(id, btn.dataset.offerId);
  });

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

  if (document.getElementById("complete-btn")) {
    document.getElementById("complete-btn").onclick = () => completeRequest(id);
  }

  if (document.getElementById("cancel-request-btn")) {
    document.getElementById("cancel-request-btn").onclick = () => cancelRequest(id);
  }

  function toggleEditMode(isEditing) {
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
      p_sitters_kids_welcome: payload.p_sitters_kids_welcome,
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

  async function selectWinner(requestId, offerId) {
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

async function completeRequest(id) {
  const { error } = await supabase.rpc("rpc_complete_request", {
    p_request_id: id
  });
  
  if (error) {
    document.getElementById("request-error").textContent = error.message;
  } else {
    window.location.reload();
  }
}

async function cancelRequest(id) {
  const { error } = await supabase.rpc("rpc_cancel_request", {
    p_request_id: id
  });

  if (error) {
    document.getElementById("request-error").textContent = error.message;
  } else {
    window.location.reload();
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
