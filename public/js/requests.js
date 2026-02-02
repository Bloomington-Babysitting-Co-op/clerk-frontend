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
      <div class="border p-4 mb-2">
        <p class="font-semibold">${r.status}</p>
        <p>${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
        <p>${r.notes || ""}</p>
        <a href="/request_view.html?id=${r.id}" class="text-blue-600 underline">View</a>
      </div>
    `).join("")
    : "<p>No requests yet.</p>";
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

  el.innerHTML = `
    <h1 class="text-xl font-bold mb-4">Request</h1>
    <p>Status: <span class="font-semibold">${r.status}</span></p>
    <p>${formatDateTime(r.start_time)} → ${formatDateTime(r.end_time)}</p>
    <p class="mt-2">${r.notes || ""}</p>

    <div class="mt-4 space-x-2">
      ${canAccept ? `<button id="accept-btn" class="bg-blue-600 text-white px-4 py-2">Accept</button>` : ""}
      ${canComplete ? `<button id="complete-btn" class="bg-green-600 text-white px-4 py-2">Complete</button>` : ""}
    </div>

    <p id="request-error" class="text-red-600 mt-2"></p>
  `;

  if (canAccept) {
    document.getElementById("accept-btn").onclick = () => acceptRequest(id);
  }
  if (canComplete) {
    document.getElementById("complete-btn").onclick = () => completeRequest(id);
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
        window.location = "/requests.html";
      }
    }
  };
}

// Expose Alpine components + functions
window.listRequestsInto = listRequestsInto;
window.loadRequestInto = loadRequestInto;
window.newRequestForm = newRequestForm;
