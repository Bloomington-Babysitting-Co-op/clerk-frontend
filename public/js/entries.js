import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";

function populateUserOptions(selectEl, profiles, selectedValue = "") {
  selectEl.innerHTML = profiles
    .map(profile => `<option value="${profile.id}" ${profile.id === selectedValue ? "selected" : ""}>${profile.family_name}</option>`)
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
  const [{ data: profiles, error: profilesError }, { data: completed, error: completedError }] = await Promise.all([
    supabase.rpc("rpc_list_profiles_for_entry"),
    supabase.rpc("rpc_list_completed_sits_for_prefill")
  ]);

  if (profilesError) throw profilesError;
  if (completedError) throw completedError;

  return { profiles: profiles || [], completed: completed || [] };
}

function wirePrefill(completed, fromSelect, toSelect, hoursInput, timestampInput) {
  const prefillSelect = document.getElementById("prefill-request");
  if (!prefillSelect) return;

  prefillSelect.onchange = () => {
    const selected = completed.find(item => item.request_id === prefillSelect.value);
    if (!selected) return;
    fromSelect.value = selected.from_user;
    toSelect.value = selected.to_user;
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
      timestampInput.value = `${y}-${m}-${d}T${hh}:${mm}`;
    }
  };
}

function parseTimestamp(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function validateEntry(fromUser, toUser, hoursValue) {
  if (!fromUser || !toUser) return "Both users are required.";
  if (fromUser === toUser) return "From and To users must be different.";
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours) || hours <= 0) return "Hours must be greater than zero.";
  return "";
}

async function mountNewEntryPage() {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const { data: isAdmin, error: adminError } = await supabase.rpc("rpc_is_admin");
    if (adminError) throw adminError;

    const { profiles, completed } = await loadFormData();

    const adminOnlyNote = document.getElementById("entry-admin-note");
    const prefillSelect = document.getElementById("prefill-request");
    const fromSelect = document.getElementById("from-user");
    const toSelect = document.getElementById("to-user");
    const hoursInput = document.getElementById("hours");
    const timestampInput = document.getElementById("timestamp");
    const toUserHelp = document.getElementById("to-user-help");
    const timestampHelp = document.getElementById("timestamp-help");
    const createBtn = document.getElementById("create-entry-btn");

    if (adminOnlyNote) {
      adminOnlyNote.style.display = isAdmin ? "block" : "none";
    }

    const prefillItems = isAdmin
      ? completed
      : completed.filter(item => item.to_user === userId);

    prefillSelect.innerHTML = [
      "<option value=''>Manual / Free Form</option>",
      ...prefillItems.map(item => {
        const ts = item.completed_at ? new Date(item.completed_at).toLocaleString() : "Unknown time";
        const notes = item.notes || "No notes";
        return `<option value="${item.request_id}">${ts} — ${notes}</option>`;
      })
    ].join("");

    populateUserOptions(fromSelect, profiles);
    const currentUserProfile = profiles.find(p => p.id === userId);
    populateUserOptions(toSelect, profiles, isAdmin ? "" : userId);

    if (!isAdmin) {
      toSelect.value = userId;
      toSelect.disabled = true;
      if (toUserHelp) {
        toUserHelp.textContent = `Recipient is fixed to you (${currentUserProfile?.family_name || "current user"}).`;
      }
      if (timestampInput) {
        timestampInput.disabled = true;
      }
      if (timestampHelp) {
        timestampHelp.textContent = "Timestamp is set automatically for non-admin submissions.";
      }
    } else {
      toSelect.disabled = false;
      if (toUserHelp) {
        toUserHelp.textContent = "As admin, you can set recipient to any user.";
      }
      if (timestampInput) {
        timestampInput.disabled = false;
      }
      if (timestampHelp) {
        timestampHelp.textContent = "Optional override for entry timestamp.";
      }
    }

    wirePrefill(prefillItems, fromSelect, toSelect, hoursInput, timestampInput);

    createBtn.onclick = async () => {
      setError("entry-error", "");
      const requestId = prefillSelect.value || null;
      const fromUser = fromSelect.value;
      const toUser = isAdmin ? toSelect.value : userId;
      const validationError = validateEntry(fromUser, toUser, hoursInput.value);
      if (validationError) {
        setError("entry-error", validationError);
        return;
      }

      const { error } = await supabase.rpc("rpc_create_manual_ledger_entry", {
        p_request: requestId,
        p_from_user: fromUser,
        p_to_user: toUser,
        p_hours: Number(hoursInput.value),
        p_timestamp: isAdmin ? parseTimestamp(timestampInput.value) : null
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

    const { profiles } = await loadFormData();
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
    const timestampInput = document.getElementById("timestamp");
    const saveBtn = document.getElementById("save-entry-btn");

    populateUserOptions(fromSelect, profiles, entry.from_user);
    populateUserOptions(toSelect, profiles, entry.to_user);
    hoursInput.value = entry.hours;

    const dt = new Date(entry.timestamp);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    timestampInput.value = `${y}-${m}-${d}T${hh}:${mm}`;

    saveBtn.onclick = async () => {
      setError("entry-error", "");
      const fromUser = fromSelect.value;
      const toUser = toSelect.value;
      const validationError = validateEntry(fromUser, toUser, hoursInput.value);
      if (validationError) {
        setError("entry-error", validationError);
        return;
      }

      const { error: saveError } = await supabase.rpc("rpc_update_ledger_entry", {
        p_entry_id: id,
        p_from_user: fromUser,
        p_to_user: toUser,
        p_hours: Number(hoursInput.value),
        p_timestamp: parseTimestamp(timestampInput.value)
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
