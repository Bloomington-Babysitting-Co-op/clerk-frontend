import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { formatDateTime } from "./utils.js";

async function listRequestsInto(containerId) {
  await requireAuth();

  const { data, error } = await supabase
    .from("requests")
    .select("id, start_time, end_time, status, notes")
    .order("start_time", { ascending: true });

  const el = document.getElementById(containerId);

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  el.innerHTML = data.length
    ? data.map(r => `
      <div class="bg-white border p-4 rounded-lg shadow hover:shadow-lg transition">
        <p class="font-semibold text-lg text-gray-800">${r.status}</p>
        <p class="text-sm text-gray-600 mt-1">${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
        <p class="text-gray-700 mt-2">${r.notes || ""}</p>
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

  const { data: r, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    el.innerHTML = `<p class='text-red-600'>${error.message}</p>`;
    return;
  }

  const userId = session.user.id;
  const canAccept = r.status === "open" && r.owner !== userId;
  const canComplete = r.status === "accepted" && (r.owner === userId || r.accepted_by === userId);
  const canEdit = r.owner === userId && r.status === "open";

  const startDatetime = new Date(r.start_time).toISOString().slice(0, 16);
  const endDatetime = new Date(r.end_time).toISOString().slice(0, 16);

  el.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow max-w-2xl">
      <h1 class="text-3xl font-bold mb-4">Request Details</h1>
      <p class="mb-2"><span class="font-semibold">Status:</span> <span class="text-lg text-blue-600 font-semibold">${r.status}</span></p>
      
      <div id="view-mode">
        <p class="mb-2"><span class="font-semibold">Time:</span> ${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
        <p class="mb-4 mt-4 text-gray-700">${r.notes || ""}</p>

        <div class="mt-6 flex gap-2">
          ${canAccept ? `<button id="accept-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Accept</button>` : ""}
          ${canComplete ? `<button id="complete-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Complete</button>` : ""}
          ${canEdit ? `<button id="edit-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Edit</button>` : ""}
        </div>
      </div>

      <div id="edit-mode" style="display: none;">
        <label class="block mb-2 font-semibold">Start Time</label>
        <input type="datetime-local" id="edit-start-time" value="${startDatetime}" class="border p-2 w-full mb-4">

        <label class="block mb-2 font-semibold">End Time</label>
        <input type="datetime-local" id="edit-end-time" value="${endDatetime}" class="border p-2 w-full mb-4">

        <label class="block mb-2 font-semibold">Notes</label>
        <textarea id="edit-notes" class="border p-2 w-full mb-4">${r.notes || ""}</textarea>

        <div class="mt-6 flex gap-2">
          <button id="save-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
          <button id="cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
        </div>
      </div>

      <p id="request-error" class="text-red-600 mt-4"></p>
    </div>
  `;

  if (canAccept) {
    document.getElementById("accept-btn").onclick = () => acceptRequest(id);
  }
  if (canComplete) {
    document.getElementById("complete-btn").onclick = () => completeRequest(id);
  }
  if (canEdit) {
    document.getElementById("edit-btn").onclick = () => toggleEditMode(true);
    document.getElementById("cancel-btn").onclick = () => toggleEditMode(false);
    document.getElementById("save-btn").onclick = () => saveRequest(id);
  }

  function toggleEditMode(isEditing) {
    document.getElementById("view-mode").style.display = isEditing ? "none" : "block";
    document.getElementById("edit-mode").style.display = isEditing ? "block" : "none";
  }

  async function saveRequest(requestId) {
    const startTime = document.getElementById("edit-start-time").value;
    const endTime = document.getElementById("edit-end-time").value;
    const notes = document.getElementById("edit-notes").value;

    const { error } = await supabase
      .from("requests")
      .update({
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        notes: notes
      })
      .eq("id", requestId);

    if (error) {
      document.getElementById("request-error").textContent = error.message;
    } else {
      window.location.reload();
    }
  }
}

async function acceptRequest(id) {
  const { error } = await supabase.rpc("accept_request", { p_request_id: id });
  if (error) {
    document.getElementById("request-error").textContent = error.message;
  } else {
    window.location.reload();
  }
}

async function completeRequest(id) {
  const { error } = await supabase.rpc("complete_request", { p_request_id: id });
  if (error) {
    document.getElementById("request-error").textContent = error.message;
  } else {
    window.location.reload();
  }
}

function newRequestForm() {
  return {
    start_time: "",
    end_time: "",
    notes: "",
    error: "",

    async create() {
      const session = await requireAuth();
      const userId = session.user.id;

      const { error } = await supabase.from("requests").insert({
        owner: userId,
        start_time: this.start_time,
        end_time: this.end_time,
        notes: this.notes,
        status: "open"
      });

      if (error) {
        this.error = error.message;
      } else {
        window.location = "/";
      }
    }
  };
}

// Expose Alpine components + functions
window.listRequestsInto = listRequestsInto;
window.loadRequestInto = loadRequestInto;
window.newRequestForm = newRequestForm;

// Module exports
export { listRequestsInto, loadRequestInto, newRequestForm };
