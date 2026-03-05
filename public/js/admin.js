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
  toDateOnlyString,
  escapeHtml
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

let familiesCache = [];
let usersCache = [];
let showInactiveFamilies = false;
let showInactiveUsers = false;

function initShowInactiveToggle() {
  const famToggle = document.querySelector('.show-inactive-families-toggle');
  const userToggle = document.querySelector('.show-inactive-users-toggle');

  if (famToggle) {
    famToggle.checked = !!showInactiveFamilies;
    famToggle.addEventListener('change', (ev) => {
      showInactiveFamilies = !!ev.target.checked;
      renderFamilies();
    });
  }

  if (userToggle) {
    userToggle.checked = !!showInactiveUsers;
    userToggle.addEventListener('change', (ev) => {
      showInactiveUsers = !!ev.target.checked;
      renderUsers();
    });
  }
}

function familyOptionsHtml(selectedFamilyId = "") {
  const placeholderSelected = !selectedFamilyId;
  const placeholder = `<option value="" ${placeholderSelected ? "selected" : ""}>--- Unassigned ---</option>`;
  const options = familiesCache
    .map((family) => `<option value="${family.id}" ${family.id === selectedFamilyId ? "selected" : ""}>${family.name || family.id}</option>`)
    .join("");
  return placeholder + options;
}

function renderFamilies() {
  const listEl = document.getElementById("families-admin-edit-list");
  if (!listEl) return;

  if (!familiesCache.length) {
    listEl.innerHTML = "<p class='text-sm text-gray-600'>No families found.</p>";
    return;
  }

  const visibleFamilies = showInactiveFamilies ? familiesCache : familiesCache.filter(f => f.is_active !== false);
  if (!visibleFamilies.length) {
    listEl.innerHTML = "<p class='text-sm text-gray-600'>No families found.</p>";
    return;
  }

  listEl.innerHTML = visibleFamilies.map((family) => `
    <article class="family-admin-card rounded bg-gray-50 shadow-sm" data-family-id="${family.id}">
      <header class="family-admin-header flex items-center p-3 cursor-pointer">
        <button type="button" class="family-toggle-btn w-6 h-6 flex items-center justify-center mr-3 bg-gray-100 rounded border" aria-expanded="false" aria-pressed="false" aria-label="Expand family">+</button>
        <div class="flex-1">
          <h3 class="font-semibold text-lg">${family.name || "Unnamed family"}</h3>
        </div>
        <div class="flex items-center space-x-3 text-xs">
          <span class="text-gray-600">${(family.member_count ?? 0) === 1 ? "1 User" : (family.member_count ?? 0) + " Users"}</span>
          <span class="${family.is_active ? "text-green-700" : "text-red-700"}">${family.is_active ? "Active" : "Inactive"}</span>
          ${family.is_admin ? `<span class="bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center">Admin</span>` : ""}
        </div>
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
        <div class="flex flex-wrap gap-2 md:col-span-3 mt-2">
          <button data-family-save="${family.id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">Save Family</button>
          ${family.can_delete ? `<button data-family-delete="${family.id}" class="bg-red-600 text-white px-3 py-2 rounded text-sm">Delete Family</button>` : ''}
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
      if (!window.confirm("Delete this family?")) return;
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

  // remove delete buttons from the DOM for families that are not deletable
  adminArticles.forEach((article) => {
    const familyId = article.getAttribute('data-family-id');
    const family = familiesCache.find(f => f.id === familyId) || {};
    if (!family.can_delete) {
      const delBtn = article.querySelector(`[data-family-delete="${familyId}"]`);
      if (delBtn) delBtn.remove();
    }
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

  const visibleUsers = showInactiveUsers ? usersCache : usersCache.filter(u => u.family_is_active !== false);
  if (!visibleUsers.length) {
    listEl.innerHTML = "<p class='text-sm text-gray-600'>No users found.</p>";
    return;
  }

  listEl.innerHTML = visibleUsers.map((user) => `
      <article class="user-admin-card rounded bg-gray-50 shadow-sm" data-user-id="${user.user_id}">
        <header class="user-admin-header flex items-center p-3 cursor-pointer">
          <button type="button" class="user-toggle-btn w-6 h-6 flex items-center justify-center mr-3 bg-gray-100 rounded border" aria-expanded="false" aria-pressed="false" aria-label="Expand user">+</button>
          <p class="font-medium">${user.email || user.user_id}</p>
          <span class="ml-auto text-xs text-${user.family_is_active === true ? 'green' : user.family_is_active === false ? 'red' : 'yellow'}-700">Family ${user.family_is_active === true ? 'Active' : user.family_is_active === false ? 'Inactive' : 'Unassigned'}</span>
        </header>
        <div class="user-admin-content hidden p-3">
          <div class="grid md:grid-cols-[auto_auto_auto] gap-2 items-center">
            <div>
              <label class="text-sm block mb-1">Family</label>
              <select id="user-family-${user.user_id}" class="border rounded p-2">${familyOptionsHtml(user.family_id)}</select>
            </div>
            <div>
              <label class="text-sm block mb-1">Email</label>
              <input id="user-admin-edit-email-${user.user_id}" type="email" class="border rounded p-2" value="${user.email || ""}">
            </div>
            <button data-user-reset="${user.user_id}" class="bg-yellow-600 text-white px-3 py-2 rounded text-sm self-center">Reset Password</button>
            <div class="flex flex-wrap gap-2 md:col-span-3 mt-2">
              <button data-user-save="${user.user_id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">Save User</button>
              ${user.can_delete ? `<button data-user-delete="${user.user_id}" class="bg-red-600 text-white px-3 py-2 rounded text-sm">Delete User</button>` : ''}
            </div>
          </div>
        </div>
      </article>
  `).join("");

  listEl.querySelectorAll("[data-user-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-user-save");
      await saveUser(userId);
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

  listEl.querySelectorAll("[data-user-reset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-user-reset");
      if (!userId) return;
      // use current input value if present
      const emailInput = document.getElementById(`user-admin-edit-email-${userId}`);
      const email = (emailInput?.value || "").trim();
      if (!email) {
        setStatusText('users-admin-edit-status', 'No email provided for this user', true);
        return;
      }
      const confirmed = window.confirm(`Send password reset email to ${email}?`);
      if (!confirmed) return;

      // disable button while in-flight
      const btn = button;
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      try {
        const resp = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setStatusText('users-admin-edit-status', result?.error || 'Failed to send reset email', true);
          return;
        }
        setStatusText('users-admin-edit-status', 'Password reset email sent.');
      } catch (err) {
        setStatusText('users-admin-edit-status', err?.message || 'Failed to send reset email', true);
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
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

  // remove delete buttons from the DOM for users that are not deletable
  userArticles.forEach((article) => {
    const userId = article.getAttribute('data-user-id');
    const user = usersCache.find(u => u.user_id === userId) || {};
    if (!user.can_delete) {
      const delBtn = article.querySelector(`[data-user-delete="${userId}"]`);
      if (delBtn) delBtn.remove();
    }
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

  if (!familyId) {
    setStatusText("users-admin-edit-status", "Select a family before saving.", true);
    return;
  }

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

async function saveUser(userId) {
  if (!userId) return;
  const saveBtn = document.querySelector(`[data-user-save="${userId}"]`);
  const emailInput = document.getElementById(`user-admin-edit-email-${userId}`);
  const newEmail = (emailInput?.value || "").trim();

  const originalUser = usersCache.find(u => u.user_id === userId) || {};
  const originalEmail = (originalUser.email || "").trim();

  // disable button + optimistic UI
  let prevBtnText = null;
  if (saveBtn) {
    prevBtnText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    // Only update email if it actually changed
    if (newEmail && newEmail !== originalEmail) {
      const confirmed = window.confirm(`Change user email from "${originalEmail || '(blank)'}" to "${newEmail}"? This will update the authentication email.`);
      if (!confirmed) {
        setStatusText('users-admin-edit-status', 'Email change cancelled.');
        return;
      }

      try {
        const resp = await fetch('/api/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, email: newEmail })
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setStatusText('users-admin-edit-status', result?.error || 'Failed to update user email', true);
          return;
        }
      } catch (err) {
        setStatusText('users-admin-edit-status', err?.message || 'Failed to update user email', true);
        return;
      }
    }

    await saveUserFamily(userId);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = prevBtnText || 'Save User';
    }
  }
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
  const createUserBtn = document.getElementById("users-admin-create-user-btn");
  if (!createUserBtn) return;

  createUserBtn.onclick = async () => {
    const email = getInputValue("users-admin-new-user-email").trim();
    const password = getInputValue("users-admin-new-user-password");

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

    setInputValue("users-admin-new-user-email", "");
    setInputValue("users-admin-new-user-password", "");
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
  // initialize the Show Inactive toggle handlers before initial render
  initShowInactiveToggle();
  await refreshAll();
}

// Admin banner management
async function loadAdminBannerSettings() {
  try {
    const { data, error } = await supabase.rpc('rpc_get_dashboard_banner');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    const enabledEl = document.getElementById('admin-banner-enabled');
    const textEl = document.getElementById('admin-banner-text');
    const bgEl = document.getElementById('admin-banner-bg');
    const textColorEl = document.getElementById('admin-banner-text-color');
    if (enabledEl) enabledEl.checked = !!row.enabled;
    if (textEl) textEl.value = row.text || '';
    if (bgEl) bgEl.value = row.bg_color || '#F87171';
    if (textColorEl) textColorEl.value = row.text_color || '#FFFFFF';
  } catch (err) {
    console.error('Failed loading banner settings', err);
  }
}

function wireAdminBannerForm() {
  const saveBtn = document.getElementById('admin-banner-save');
  if (!saveBtn) return;
  saveBtn.onclick = async () => {
    const enabled = !!document.getElementById('admin-banner-enabled')?.checked;
    const text = document.getElementById('admin-banner-text')?.value || '';
    const bg = document.getElementById('admin-banner-bg')?.value || '#F87171';
    const txtColor = document.getElementById('admin-banner-text-color')?.value || '#FFFFFF';
    const statusEl = document.getElementById('admin-banner-status');
    if (statusEl) statusEl.textContent = '';

    const { error } = await supabase.rpc('rpc_admin_upsert_dashboard_banner', {
      p_enabled: enabled,
      p_text: text,
      p_bg_color: bg,
      p_text_color: txtColor
    });
    if (error) {
      if (statusEl) statusEl.textContent = error.message;
      return;
    }
    if (statusEl) statusEl.textContent = 'Saved.';
  };
}

// Admin links management
function appendAdminLinkRow(url = '', text = '', row = 1, order = 0) {
  const listEl = document.getElementById('admin-links-list');
  if (!listEl) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'grid md:grid-cols-6 gap-2 items-center border rounded p-2';
  wrapper.innerHTML = `
    <input class="col-span-2 border p-1 rounded" data-link-url value="${escapeHtml(url)}">
    <input class="col-span-2 border p-1 rounded" data-link-text value="${escapeHtml(text)}">
    <input class="border p-1 rounded" type="number" min="1" data-link-row value="${escapeHtml(row)}">
    <input class="border p-1 rounded" type="number" min="0" data-link-order value="${escapeHtml(order)}">
    <div class="md:col-span-6 flex gap-2 mt-2">
      <button type="button" class="bg-yellow-600 text-white px-2 py-1 rounded" data-link-move-up>Up</button>
      <button type="button" class="bg-yellow-600 text-white px-2 py-1 rounded" data-link-move-down>Down</button>
      <button type="button" class="bg-red-600 text-white px-2 py-1 rounded" data-link-remove>Remove</button>
    </div>
  `;

  listEl.appendChild(wrapper);

  wrapper.querySelector('[data-link-remove]').onclick = () => wrapper.remove();
  wrapper.querySelector('[data-link-move-up]').onclick = () => {
    const prev = wrapper.previousElementSibling;
    if (prev) listEl.insertBefore(wrapper, prev);
  };
  wrapper.querySelector('[data-link-move-down]').onclick = () => {
    const next = wrapper.nextElementSibling;
    if (next) listEl.insertBefore(next, wrapper);
  };
}

async function loadAdminLinksSettings() {
  try {
    const { data, error } = await supabase.rpc('rpc_get_dashboard_links');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    const listEl = document.getElementById('admin-links-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    rows.sort((a,b) => (a.link_row - b.link_row) || (a.link_order - b.link_order));
    rows.forEach((r, idx) => appendAdminLinkRow(r.link_url, r.link_text, r.link_row, r.link_order));
  } catch (err) {
    console.error('Failed to load admin links', err);
  }
}

function wireAdminLinksForm() {
  const addBtn = document.getElementById('admin-link-add');
  if (addBtn) {
    addBtn.onclick = () => {
      const url = document.getElementById('admin-link-url')?.value || '';
      const text = document.getElementById('admin-link-text')?.value || '';
      const row = parseInt(document.getElementById('admin-link-row')?.value || '1', 10) || 1;
      const order = parseInt(document.getElementById('admin-link-order')?.value || '0', 10) || 0;
      appendAdminLinkRow(url, text, row, order);
    };
  }

  const saveBtn = document.getElementById('admin-links-save');
  if (!saveBtn) return;
  saveBtn.onclick = async () => {
    const statusEl = document.getElementById('admin-links-status');
    if (statusEl) statusEl.textContent = '';
    const listEl = document.getElementById('admin-links-list');
    if (!listEl) return;
    const rows = Array.from(listEl.children).map((rowEl, idx) => {
      const url = rowEl.querySelector('[data-link-url]')?.value || '';
      const text = rowEl.querySelector('[data-link-text]')?.value || '';
      const r = parseInt(rowEl.querySelector('[data-link-row]')?.value || '1', 10) || 1;
      const ord = parseInt(rowEl.querySelector('[data-link-order]')?.value || '0', 10) || 0;
      return { url, text, row: r, order: ord };
    });

    try {
      const { error } = await supabase.rpc('rpc_admin_upsert_dashboard_links', { p_links: JSON.stringify(rows) });
      if (error) {
        if (statusEl) statusEl.textContent = error.message;
        return;
      }
      if (statusEl) statusEl.textContent = 'Saved.';
    } catch (err) {
      console.error('Failed to save links', err);
      if (statusEl) statusEl.textContent = err.message || 'Save failed';
    }
  };
}

export async function mountAdminPage() {
  await setupNavbar("navbar");
  await requireAdmin();
  await mountAdminEntriesPage();
  await mountFamiliesAdminPage();
  await loadAdminBannerSettings();
  wireAdminBannerForm();
  await loadAdminLinksSettings();
  wireAdminLinksForm();
}
