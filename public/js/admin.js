import { supabase } from "/js/supabase.js";
import { requireAdmin, requireAuth } from "/js/auth.js";
import {
  setupNavbar,
  hasAdmin,
  setFormError,
  getCheckedValue,
  getInputValue,
  setInputValue,
  setStatusText,
  toDateOnlyString
} from "/js/utils.js";

// --- Ledger admin (mass entries) ---
async function loadFamiliesForLedger() {
  const { data, error } = await supabase.rpc("rpc_admin_list_families");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function populateMultiSelect(selectEl, families) {
  selectEl.innerHTML = families.map(f => `<option value="${f.id}">${f.name || f.id}</option>`).join("");
}

function getSelectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map(opt => opt.value);
}

function isDivisibleByQuarter(num) {
  return Math.abs((num * 100) % 25) < 1e-6;
}

async function mountAdminEntriesPage() {
  if (!(await hasAdmin())) {
    window.location.href = "/profile.html";
    return;
  }
  const fromSelect = document.getElementById("from-families");
  const toSelect = document.getElementById("to-families");
  const hoursInput = document.getElementById("mass-entry-hours");
  const dateInput = document.getElementById("mass-entry-date");
  const notesInput = document.getElementById("mass-entry-notes");
  const form = document.getElementById("mass-ledger-form");
  const errorEl = document.getElementById("mass-entry-error");
  const successEl = document.getElementById("mass-entry-success");

  const families = await loadFamiliesForLedger();
  populateMultiSelect(fromSelect, families);
  populateMultiSelect(toSelect, families);

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    successEl.textContent = "";
    const fromFamilies = getSelectedValues(fromSelect);
    const toFamilies = getSelectedValues(toSelect);
    const hours = parseFloat(hoursInput.value);
    const entryDate = dateInput.value;
    const notes = notesInput.value;

    if ((!fromFamilies.length && !toFamilies.length) || !hours || !entryDate) {
      setFormError(errorEl, "Select at least one 'From' or 'To' family, and enter hours and date.");
      return;
    }
    if (!isDivisibleByQuarter(hours)) {
      setFormError(errorEl, "Hours must be divisible by 0.25.");
      return;
    }

    const pairs = [];
    if (fromFamilies.length && toFamilies.length) {
      fromFamilies.forEach(fromId => {
        toFamilies.forEach(toId => {
          pairs.push({ from_family_id: fromId, to_family_id: toId });
        });
      });
    } else if (fromFamilies.length) {
      fromFamilies.forEach(fromId => {
        pairs.push({ from_family_id: fromId, to_family_id: null });
      });
    } else if (toFamilies.length) {
      toFamilies.forEach(toId => {
        pairs.push({ from_family_id: null, to_family_id: toId });
      });
    }

    let created = 0, failed = 0;
    for (const pair of pairs) {
      const { error } = await supabase.rpc("rpc_admin_create_ledger_entry", {
        p_from_family_id: pair.from_family_id,
        p_to_family_id: pair.to_family_id,
        p_hours: hours,
        p_entry_date: entryDate,
        p_notes: notes
      });
      if (error) failed++;
      else created++;
    }
    if (created) successEl.textContent = `Created ${created} ledger entr${created === 1 ? 'y' : 'ies'}.`;
    if (failed) setFormError(errorEl, `Failed to create ${failed} entr${failed === 1 ? 'y' : 'ies'}.`);
  };
}

// --- Families admin (edit/create) ---
let familiesCache = [];
let usersCache = [];

function familyOptionsHtml(selectedFamilyId = "") {
  return familiesCache
    .map((family) => `<option value="${family.id}" ${family.id === selectedFamilyId ? "selected" : ""}>${family.name || family.id}</option>`)
    .join("");
}

function renderFamilies() {
  const listEl = document.getElementById("families-admin-edit-list");
  if (!listEl) return;

  if (!familiesCache.length) {
    listEl.innerHTML = "<p class='text-sm text-gray-600'>No families found.</p>";
    return;
  }

  listEl.innerHTML = familiesCache.map((family) => `
    <article class="family-admin-card rounded bg-gray-50 shadow-sm" data-family-id="${family.id}">
      <header class="family-admin-header flex items-center p-3 cursor-pointer">
        <button type="button" class="family-toggle-btn w-6 h-6 flex items-center justify-center mr-3 bg-gray-100 rounded border" aria-expanded="false" aria-pressed="false" aria-label="Expand family">+</button>
        <h3 class="font-semibold text-lg">${family.name || "Unnamed family"}</h3>
        <span class="ml-auto text-xs text-gray-600">${family.member_count ?? 0} Users</span>
        <span class="ml-auto text-xs ${family.is_active ? "text-green-700" : "text-red-700"}">${family.is_active ? "Active" : "Inactive"}</span>
        <span class="ml-auto text-xs "text-red-700">${family.is_admin ? "Admin" : ""}</span>
      </header>
      <div class="family-admin-content hidden p-4 space-y-3">
        <div class="grid md:grid-cols-3 gap-3">
          <div>
            <label class="text-sm block mb-1">Date Joined</label>
            <input id="family-date-joined-${family.id}" type="date" class="border rounded p-2 w-full" value="${toDateOnlyString(family.admin_date_joined)}">
          </div>
          <div>
            <label class="text-sm block mb-1">Last Background Check</label>
            <input id="family-last-background-check-${family.id}" type="date" class="border rounded p-2 w-full" value="${toDateOnlyString(family.admin_last_background_check)}">
          </div>
          <div>
            <label class="text-sm block mb-1">Last Dues Payment</label>
            <input id="family-last-dues-payment-${family.id}" type="date" class="border rounded p-2 w-full" value="${toDateOnlyString(family.admin_last_dues_payment)}">
          </div>
        </div>
        <div class="grid md:grid-cols-3 gap-3">
          <label class="text-sm"><input id="family-active-${family.id}" type="checkbox" class="mr-2" ${family.is_active ? "checked" : ""}>Active</label>
          <label class="text-sm"><input id="family-admin-${family.id}" type="checkbox" class="mr-2" ${family.is_admin ? "checked" : ""}>Admin</label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button data-family-save="${family.id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">Save Family</button>
          <button data-family-delete="${family.id}" class="bg-red-600 text-white px-3 py-2 rounded text-sm ${family.can_delete ? "" : "opacity-50 cursor-not-allowed"}" ${family.can_delete ? "" : "disabled"}>Delete Family</button>
        </div>
      </div>
    </article>
  `).join("");

  listEl.querySelectorAll("[data-family-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const familyId = button.getAttribute("data-family-save");
      await saveFamily(familyId);
    });
  });

  listEl.querySelectorAll("[data-family-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const familyId = button.getAttribute("data-family-delete");
      if (!familyId) return;
      if (!window.confirm("Delete this family and linked users? This only works for eligible families.")) return;
      await deleteFamily(familyId);
    });
  });

  // attach collapse/expand behavior similar to public families page
  function setAdminArticleExpanded(article, expanded) {
    const btn = article.querySelector('.family-toggle-btn');
    const content = article.querySelector('.family-admin-content');
    if (!btn || !content) return;
    if (expanded) {
      btn.textContent = "-";
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Collapse family');
      content.classList.remove('hidden');
    } else {
      btn.textContent = "+";
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Expand family');
      content.classList.add('hidden');
    }
  }

  const adminArticles = Array.from(listEl.querySelectorAll('.family-admin-card'));
  adminArticles.forEach((article) => {
    const header = article.querySelector('.family-admin-header');
    const btn = article.querySelector('.family-toggle-btn');
    // start collapsed
    setAdminArticleExpanded(article, false);

    const toggle = (ev) => {
      ev && ev.preventDefault();
      const content = article.querySelector('.family-admin-content');
      const isHidden = content.classList.contains('hidden');
      setAdminArticleExpanded(article, isHidden);
    };

    if (header) header.addEventListener('click', toggle);
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(e); });
  });

  const familiesToggleAllBtn = document.getElementById('families-admin-toggle-all');
  function updateFamiliesToggleAll() {
    if (!familiesToggleAllBtn) return;
    const anyHidden = adminArticles.some(a => a.querySelector('.family-admin-content').classList.contains('hidden'));
    familiesToggleAllBtn.textContent = anyHidden ? '+' : '-';
    familiesToggleAllBtn.setAttribute('aria-pressed', anyHidden ? 'false' : 'true');
    familiesToggleAllBtn.setAttribute('aria-label', anyHidden ? 'Expand all families' : 'Collapse all families');
  }
  if (familiesToggleAllBtn) {
    updateFamiliesToggleAll();
    familiesToggleAllBtn.addEventListener('click', () => {
      const anyHidden = adminArticles.some(a => a.querySelector('.family-admin-content').classList.contains('hidden'));
      adminArticles.forEach((a) => setAdminArticleExpanded(a, anyHidden));
      updateFamiliesToggleAll();
    });
  }
  adminArticles.forEach((article) => {
    const header = article.querySelector('.family-admin-header');
    const btn = article.querySelector('.family-toggle-btn');
    if (header) header.addEventListener('click', () => setTimeout(updateFamiliesToggleAll, 0));
    if (btn) btn.addEventListener('click', () => setTimeout(updateFamiliesToggleAll, 0));
  });
}

function renderUsers() {
  const listEl = document.getElementById("users-admin-edit-list");
  if (!listEl) return;

  if (!usersCache.length) {
    listEl.innerHTML = "<p class='text-sm text-gray-600'>No users found.</p>";
    return;
  }

  listEl.innerHTML = usersCache.map((user) => `
      <article class="user-admin-card rounded bg-gray-50 shadow-sm" data-user-id="${user.user_id}">
        <header class="user-admin-header flex items-center p-3 cursor-pointer">
          <button type="button" class="user-toggle-btn w-6 h-6 flex items-center justify-center mr-3 bg-gray-100 rounded border" aria-expanded="false" aria-pressed="false" aria-label="Expand user">+</button>
          <p class="font-medium">${user.email || user.user_id}</p>
          <span class="ml-auto text-xs ${user.family_is_active ? "text-green-700" : "text-red-700"}">Family ${user.family_is_active ? "Active" : "Inactive"}</span>
        </header>
        <div class="user-admin-content hidden p-3">
          <div class="grid md:grid-cols-[1fr_auto_auto] gap-2 items-center">
            <select id="user-family-${user.user_id}" class="border rounded p-2">${familyOptionsHtml(user.family_id)}</select>
            <button data-user-move="${user.user_id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">Save Family</button>
            <button data-user-delete="${user.user_id}" class="bg-red-600 text-white px-3 py-2 rounded text-sm ${user.can_delete ? "" : "opacity-50 cursor-not-allowed"}" ${user.can_delete ? "" : "disabled"}>Delete User</button>
          </div>
        </div>
      </article>
  `).join("");

  listEl.querySelectorAll("[data-user-move]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-user-move");
      await saveUserFamily(userId);
    });
  });

  listEl.querySelectorAll("[data-user-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-user-delete");
      if (!userId) return;
      if (!window.confirm("Delete this user? This only works when their family is eligible for deletion.")) return;
      await deleteUser(userId);
    });
  });

  // attach collapse/expand behavior for users
  function setUserArticleExpanded(article, expanded) {
    const btn = article.querySelector('.user-toggle-btn');
    const content = article.querySelector('.user-admin-content');
    if (!btn || !content) return;
    if (expanded) {
      btn.textContent = "-";
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Collapse user');
      content.classList.remove('hidden');
    } else {
      btn.textContent = "+";
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Expand user');
      content.classList.add('hidden');
    }
  }

  const userArticles = Array.from(listEl.querySelectorAll('.user-admin-card'));
  userArticles.forEach((article) => {
    const header = article.querySelector('.user-admin-header');
    const btn = article.querySelector('.user-toggle-btn');
    setUserArticleExpanded(article, false);

    const toggle = (ev) => {
      ev && ev.preventDefault();
      const content = article.querySelector('.user-admin-content');
      const isHidden = content.classList.contains('hidden');
      setUserArticleExpanded(article, isHidden);
    };

    if (header) header.addEventListener('click', toggle);
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(e); });
  });

  const usersToggleAllBtn = document.getElementById('users-admin-toggle-all');
  function updateUsersToggleAll() {
    if (!usersToggleAllBtn) return;
    const anyHidden = userArticles.some(a => a.querySelector('.user-admin-content').classList.contains('hidden'));
    usersToggleAllBtn.textContent = anyHidden ? '+' : '-';
    usersToggleAllBtn.setAttribute('aria-pressed', anyHidden ? 'false' : 'true');
    usersToggleAllBtn.setAttribute('aria-label', anyHidden ? 'Expand all users' : 'Collapse all users');
  }
  if (usersToggleAllBtn) {
    updateUsersToggleAll();
    usersToggleAllBtn.addEventListener('click', () => {
      const anyHidden = userArticles.some(a => a.querySelector('.user-admin-content').classList.contains('hidden'));
      userArticles.forEach((a) => setUserArticleExpanded(a, anyHidden));
      updateUsersToggleAll();
    });
  }
  userArticles.forEach((article) => {
    const header = article.querySelector('.user-admin-header');
    const btn = article.querySelector('.user-toggle-btn');
    if (header) header.addEventListener('click', () => setTimeout(updateUsersToggleAll, 0));
    if (btn) btn.addEventListener('click', () => setTimeout(updateUsersToggleAll, 0));
  });
}

async function loadFamilies() {
  const { data, error } = await supabase.rpc("rpc_admin_list_families");
  if (error) throw error;
  familiesCache = Array.isArray(data) ? data : [];
  renderFamilies();
}

async function loadUsers() {
  const { data, error } = await supabase.rpc("rpc_admin_list_users");
  if (error) throw error;
  usersCache = Array.isArray(data) ? data : [];
  renderUsers();
}

async function refreshAll() {
  await loadFamilies();
  await loadUsers();
}

async function saveFamily(familyId) {
  if (!familyId) return;

  const payload = {
    p_family_id: familyId,
    p_is_active: getCheckedValue(`family-active-${familyId}`),
    p_is_admin: getCheckedValue(`family-admin-${familyId}`),
    p_admin_date_joined: getInputValue(`family-date-joined-${familyId}`) || null,
    p_admin_last_background_check: getInputValue(`family-last-background-check-${familyId}`) || null,
    p_admin_last_dues_payment: getInputValue(`family-last-dues-payment-${familyId}`) || null
  };

  const { error } = await supabase.rpc("rpc_admin_update_family", payload);
  if (error) {
    setStatusText("families-admin-edit-status", error.message, true);
    return;
  }

  setStatusText("families-admin-edit-status", "Family updated.");
  await refreshAll();
}

async function deleteFamily(familyId) {
  const { error } = await supabase.rpc("rpc_admin_delete_family", { p_family_id: familyId });
  if (error) {
    setStatusText("families-admin-edit-status", error.message, true);
    return;
  }

  setStatusText("families-admin-edit-status", "Family deleted.");
  await refreshAll();
}

async function saveUserFamily(userId) {
  if (!userId) return;
  const familySelect = document.getElementById(`user-family-${userId}`);
  const familyId = familySelect?.value;

  const { error } = await supabase.rpc("rpc_admin_update_user_family", {
    p_user_id: userId,
    p_family_id: familyId
  });

  if (error) {
    setStatusText("users-admin-edit-status", error.message, true);
    return;
  }

  setStatusText("users-admin-edit-status", "User family updated.");
  await refreshAll();
}

async function deleteUser(userId) {
  const resp = await fetch("/api/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    setStatusText("users-admin-edit-status", result?.error || "Error deleting user", true);
    return;
  }

  setStatusText("users-admin-edit-status", "User deleted.");
  await refreshAll();
}

async function wireCreateFamily() {
  const createFamilyBtn = document.getElementById("families-admin-create-family-btn");
  if (!createFamilyBtn) return;

  createFamilyBtn.onclick = async () => {
    const name = getInputValue("families-admin-new-family-name").trim();
    if (!name) {
      setStatusText("family-admin-create-status", "Family name is required.", true);
      return;
    }

    const { error } = await supabase.rpc("rpc_admin_create_family", { p_name: name });
    if (error) {
      setStatusText("family-admin-create-status", error.message, true);
      return;
    }

    setInputValue("families-admin-new-family-name", "");
    setStatusText("family-admin-create-status", "Family created.");
    await refreshAll();
  };
}

async function wireCreateUser() {
  const createUserBtn = document.getElementById("families-admin-create-user-btn");
  if (!createUserBtn) return;

  createUserBtn.onclick = async () => {
    const email = getInputValue("families-admin-new-user-email").trim();
    const password = getInputValue("families-admin-new-user-password");

    if (!email || !password) {
      setStatusText("user-admin-create-status", "Email and password are required.", true);
      return;
    }

    const resp = await fetch("/api/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setStatusText("user-admin-create-status", result?.error || "Error creating user", true);
      return;
    }

    setInputValue("families-admin-new-user-email", "");
    setInputValue("families-admin-new-user-password", "");
    setStatusText("user-admin-create-status", "User created.");
    await refreshAll();
  };
}

async function mountFamiliesAdminPage() {
  await requireAuth();

    if (!(await hasAdmin())) {
    window.location.href = "/profile.html";
    return;
  }

  await wireCreateFamily();
  await wireCreateUser();
  await refreshAll();
}

export async function mountAdminPage() {
  await setupNavbar("navbar");
  await requireAdmin();
  await mountAdminEntriesPage();
  await mountFamiliesAdminPage();
}
