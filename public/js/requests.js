import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { formatDateTime } from "./utils.js";

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

  const { data: requestData, error } = await supabase.rpc("rpc_get_request", {
    p_request_id: id
  });

  const r = Array.isArray(requestData) ? requestData[0] : requestData;

  if (error || !r) {
    el.innerHTML = `<p class='text-red-600'>${error?.message || "Request not found."}</p>`;
    return;
  }

  // Fetch claims for this request
  const { data: claimsData, error: claimsError } = await supabase.rpc("rpc_list_claims", {
    p_request_id: id
  });

  if (claimsError) {
    el.innerHTML = `<p class='text-red-600'>${claimsError.message}</p>`;
    return;
  }

  const claims = claimsData || [];

  const userId = session.user.id;
  const isOwner = r.owner === userId;
  const canClaim = r.status === "open" && !isOwner;
  const canClaimWhenClaimed = r.status === "claimed" && !isOwner;
  const hasAlreadyClaimed = claims?.some(c => c.user_id === userId);
  const canSelectWinner = isOwner && r.status === "claimed";
  const canComplete = r.status === "accepted" && (isOwner || r.accepted_by === userId);
  const canEdit = isOwner && r.status === "open";

  const startDatetime = new Date(r.start_time).toISOString().slice(0, 16);
  const endDatetime = new Date(r.end_time).toISOString().slice(0, 16);

  el.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow max-w-4xl">
      <h1 class="text-3xl font-bold mb-4">Request Details</h1>
      <p class="mb-2"><span class="font-semibold">Status:</span> <span class="text-lg text-blue-600 font-semibold">${r.status}</span></p>
      
      <div id="view-mode">
        <p class="mb-2"><span class="font-semibold">Time:</span> ${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
        <p class="mb-4 mt-4 text-gray-700">${r.notes || ""}</p>

        <div class="mt-6 flex gap-2">
          ${canClaim ? `<button id="claim-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Claim</button>` : ""}
          ${canClaimWhenClaimed && !hasAlreadyClaimed ? `<button id="claim-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add Claim</button>` : ""}
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

      ${claims && claims.length > 0 ? `
        <div class="mt-8 pt-8 border-t">
          <h2 class="text-2xl font-bold mb-4">Claims (${claims.length})</h2>
          <div class="space-y-3">
            ${claims.map((claim, index) => `
              <div class="bg-gray-50 p-4 rounded border">
                <p class="text-sm text-gray-600 mb-1">Claimed ${formatDateTime(claim.created_at)}</p>
                <p class="text-gray-700">${claim.comment || "<em>No comment</em>"}</p>
                ${canSelectWinner ? `<button class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm select-winner-btn" data-claim-id="${claim.id}">Select as Winner</button>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <p id="request-error" class="text-red-600 mt-4"></p>
    </div>

    <div id="claim-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50;">
      <div class="bg-white p-6 rounded-lg shadow max-w-md w-full">
        <h2 class="text-xl font-bold mb-4">Add a Comment (Optional)</h2>
        <textarea id="claim-comment" placeholder="Why do you want to claim this request?" class="border p-2 w-full mb-4 h-24"></textarea>
        <div class="flex gap-2">
          <button id="claim-submit-btn" class="bg-blue-600 text-white px-4 py-2 rounded flex-1 hover:bg-blue-700">Claim</button>
          <button id="claim-cancel-btn" class="bg-gray-400 text-white px-4 py-2 rounded flex-1 hover:bg-gray-500">Cancel</button>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  if (document.getElementById("claim-btn")) {
    document.getElementById("claim-btn").onclick = () => {
      document.getElementById("claim-modal").style.display = "flex";
    };
  }

  if (document.getElementById("claim-submit-btn")) {
    document.getElementById("claim-submit-btn").onclick = () => submitClaim(id);
  }

  if (document.getElementById("claim-cancel-btn")) {
    document.getElementById("claim-cancel-btn").onclick = () => {
      document.getElementById("claim-modal").style.display = "none";
    };
  }

  const selectWinnerBtns = document.querySelectorAll(".select-winner-btn");
  selectWinnerBtns.forEach(btn => {
    btn.onclick = () => selectWinner(id, btn.dataset.claimId);
  });

  if (document.getElementById("edit-btn")) {
    document.getElementById("edit-btn").onclick = () => toggleEditMode(true);
  }

  if (document.getElementById("cancel-btn")) {
    document.getElementById("cancel-btn").onclick = () => toggleEditMode(false);
  }

  if (document.getElementById("save-btn")) {
    document.getElementById("save-btn").onclick = () => saveRequest(id);
  }

  if (document.getElementById("complete-btn")) {
    document.getElementById("complete-btn").onclick = () => completeRequest(id);
  }

  function toggleEditMode(isEditing) {
    document.getElementById("view-mode").style.display = isEditing ? "none" : "block";
    document.getElementById("edit-mode").style.display = isEditing ? "block" : "none";
  }

  async function saveRequest(requestId) {
    const startTime = document.getElementById("edit-start-time").value;
    const endTime = document.getElementById("edit-end-time").value;
    const notes = document.getElementById("edit-notes").value;

    const { error } = await supabase.rpc("rpc_update_request", {
      p_request_id: requestId,
      p_start_time: new Date(startTime).toISOString(),
      p_end_time: new Date(endTime).toISOString(),
      p_notes: notes
    });

    if (error) {
      document.getElementById("request-error").textContent = error.message;
    } else {
      window.location.reload();
    }
  }

  async function submitClaim(requestId) {
    const comment = document.getElementById("claim-comment").value;

    const { error } = await supabase.rpc("rpc_claim_request", {
      p_request_id: requestId,
      p_comment: comment
    });

    if (error) {
      document.getElementById("request-error").textContent = error.message;
    } else {
      window.location.reload();
    }
  }

  async function selectWinner(requestId, claimId) {
    const { error } = await supabase.rpc("rpc_select_request_winner", {
      p_request_id: requestId,
      p_claim_id: claimId
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

function newRequestForm() {
  return {
    start_time: "",
    end_time: "",
    notes: "",
    error: "",

    async create() {
      await requireAuth();

      const { error } = await supabase.rpc("rpc_create_request", {
        p_start_time: this.start_time,
        p_end_time: this.end_time,
        p_notes: this.notes
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
