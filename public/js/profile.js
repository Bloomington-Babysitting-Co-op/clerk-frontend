import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";

function setText(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  el.className = isError ? "text-sm text-red-600" : "text-sm text-gray-700";
}

function setLinkedFamilyEmails(emails) {
  const el = document.getElementById("profile-linked-family-emails");
  if (!el) return;
  if (!emails.length) {
    el.textContent = "No linked login emails yet.";
    return;
  }
  el.textContent = emails.join(", ");
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function bool(id) {
  const el = document.getElementById(id);
  return !!el?.checked;
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function setBool(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function monthValueFromDate(value) {
  if (!value) return "";
  return String(value).slice(0, 7);
}

function createChildRow(child = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-3 grid md:grid-cols-2 gap-3";
  wrapper.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Name</label>
      <input data-child-field="name" type="text" class="border p-2 w-full rounded" value="${child.name || ""}">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">DOB (Month/Year)</label>
      <input data-child-field="date_of_birth" type="month" class="border p-2 w-full rounded" value="${monthValueFromDate(child.date_of_birth)}">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Dietary restrictions</label>
      <textarea data-child-field="dietary_restrictions" class="border p-2 w-full rounded" rows="2">${child.dietary_restrictions || ""}</textarea>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Pet issues</label>
      <textarea data-child-field="pet_issues" class="border p-2 w-full rounded" rows="2">${child.pet_issues || ""}</textarea>
    </div>
    <div class="md:col-span-2 flex justify-end">
      <button type="button" data-remove-child class="bg-red-600 text-white px-3 py-2 rounded">Remove Child</button>
    </div>
  `;

  const removeBtn = wrapper.querySelector('[data-remove-child]');
  if (removeBtn) {
    removeBtn.onclick = () => {
      const list = document.getElementById("profile-children-list");
      if (!list) return;
      wrapper.remove();
      if (!list.children.length) {
        list.appendChild(createChildRow({}));
      }
    };
  }

  return wrapper;
}

function renderChildren(children = []) {
  const list = document.getElementById("profile-children-list");
  if (!list) return;
  list.innerHTML = "";
  const rows = children.length ? children : [{}];
  rows.forEach((child) => list.appendChild(createChildRow(child)));
}

function addBlankChildRow() {
  const list = document.getElementById("profile-children-list");
  if (!list) return;
  list.appendChild(createChildRow({}));
}

function collectChildrenPayload() {
  const list = document.getElementById("profile-children-list");
  if (!list) return { children: [], error: "" };

  const rows = Array.from(list.children);
  const children = [];

  for (const row of rows) {
    const name = row.querySelector('[data-child-field="name"]')?.value?.trim() || "";
    const dateOfBirth = row.querySelector('[data-child-field="date_of_birth"]')?.value || "";
    const dietaryRestrictions = row.querySelector('[data-child-field="dietary_restrictions"]')?.value?.trim() || "";
    const petIssues = row.querySelector('[data-child-field="pet_issues"]')?.value?.trim() || "";

    const hasAnyValue = !!(name || dateOfBirth || dietaryRestrictions || petIssues);
    if (!hasAnyValue) continue;

    if (!name) {
      return { children: [], error: "Each child entry needs a name." };
    }

    children.push({
      name,
      date_of_birth: dateOfBirth,
      dietary_restrictions: dietaryRestrictions,
      pet_issues: petIssues
    });
  }

  return { children, error: "" };
}

function createEmergencyContactRow(contact = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-3 grid md:grid-cols-2 gap-3";
  wrapper.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Name</label>
      <input data-emergency-contact-field="name" type="text" class="border p-2 w-full rounded" value="${contact.name || ""}">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Phone</label>
      <input data-emergency-contact-field="phone" type="text" class="border p-2 w-full rounded" value="${contact.phone || ""}">
    </div>
    <div class="md:col-span-2 flex justify-end">
      <button type="button" data-remove-emergency-contact class="bg-red-600 text-white px-3 py-2 rounded">Remove Contact</button>
    </div>
  `;

  const removeBtn = wrapper.querySelector('[data-remove-emergency-contact]');
  if (removeBtn) {
    removeBtn.onclick = () => {
      const list = document.getElementById("profile-emergency-contacts-list");
      if (!list) return;
      wrapper.remove();
      if (!list.children.length) {
        list.appendChild(createEmergencyContactRow({}));
      }
    };
  }

  return wrapper;
}

function renderEmergencyContacts(contacts = []) {
  const list = document.getElementById("profile-emergency-contacts-list");
  if (!list) return;
  list.innerHTML = "";
  const rows = contacts.length ? contacts : [{}];
  rows.forEach((contact) => list.appendChild(createEmergencyContactRow(contact)));
}

function addBlankEmergencyContactRow() {
  const list = document.getElementById("profile-emergency-contacts-list");
  if (!list) return;
  list.appendChild(createEmergencyContactRow({}));
}

function collectEmergencyContactsPayload() {
  const list = document.getElementById("profile-emergency-contacts-list");
  if (!list) return { emergencyContacts: [], error: "" };

  const rows = Array.from(list.children);
  const emergencyContacts = [];

  for (const row of rows) {
    const name = row.querySelector('[data-emergency-contact-field="name"]')?.value?.trim() || "";
    const phone = row.querySelector('[data-emergency-contact-field="phone"]')?.value?.trim() || "";

    const hasAnyValue = !!(name || phone);
    if (!hasAnyValue) continue;

    if (!name || !phone) {
      return { emergencyContacts: [], error: "Each emergency contact needs both a name and phone." };
    }

    emergencyContacts.push({
      name,
      phone
    });
  }

  return { emergencyContacts, error: "" };
}

async function mountProfilePage() {
  const session = await requireAuth();
  const userEmail = session.user.email || "";

  setVal("profile-email", userEmail);
  setVal("profile-parent-name", "");
  setVal("profile-phone", "");

  const saveBtn = document.getElementById("profile-save-btn");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const { children, error: childrenError } = collectChildrenPayload();
      if (childrenError) {
        setText("profile-save-message", childrenError, true);
        return;
      }

      const { emergencyContacts, error: emergencyContactsError } = collectEmergencyContactsPayload();
      if (emergencyContactsError) {
        setText("profile-save-message", emergencyContactsError, true);
        return;
      }

      const { error: parentError } = await supabase.rpc("rpc_upsert_my_parent_profile", {
        p_name: val("profile-parent-name"),
        p_phone: val("profile-phone"),
        p_notify_new_request: bool("notify-new-request"),
        p_notify_unoffered_48h: bool("notify-unoffered-48h"),
        p_notify_request_offered: bool("notify-request-offered"),
        p_notify_offer_cancelled_or_edited: bool("notify-offer-cancelled-edited"),
        p_notify_ledger_debtor: bool("notify-ledger-debtor"),
        p_notify_midmonth_inactive: bool("notify-midmonth-inactive")
      });
      if (parentError) {
        setText("profile-save-message", parentError.message, true);
        return;
      }

      const payload = {
        p_name: val("profile-family-name"),
        p_address: val("profile-address"),
        p_emergency_contacts: emergencyContacts,
        p_pets: val("profile-pets"),
        p_family_photo_url: val("profile-family-photo-url"),
        p_business_information: val("profile-business-information")
      };

      const { error } = await supabase.rpc("rpc_upsert_my_family_details", payload);
      if (error) {
        setText("profile-save-message", error.message, true);
        return;
      }

      const { error: childrenSaveError } = await supabase.rpc("rpc_replace_my_family_children", {
        p_children: children
      });

      if (childrenSaveError) {
        setText("profile-save-message", childrenSaveError.message, true);
        return;
      }

      setText("profile-save-message", "Profile saved.");
    };
  }

  const addChildBtn = document.getElementById("profile-add-child-btn");
  if (addChildBtn) {
    addChildBtn.onclick = () => addBlankChildRow();
  }

  const addEmergencyContactBtn = document.getElementById("profile-add-emergency-contact-btn");
  if (addEmergencyContactBtn) {
    addEmergencyContactBtn.onclick = () => addBlankEmergencyContactRow();
  }

  const logoutBtn = document.getElementById("profile-logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location = "/";
    };
  }

  const refreshLinkedFamilyEmails = async () => {
    const { data, error } = await supabase.rpc("rpc_list_my_family_emails");
    if (error) {
      setText("profile-account-message", error.message, true);
      return;
    }
    const emails = (Array.isArray(data) ? data : [])
      .map((row) => row?.email)
      .filter(Boolean);
    setLinkedFamilyEmails(emails);
  };

  try {
    const { data: isAdminData, error: isAdminError } = await supabase.rpc("rpc_is_admin");
    if (!isAdminError && isAdminData) {
      const adminLink = document.getElementById("profile-admin-link");
      if (adminLink) adminLink.style.display = "inline-block";
    }

    const { data: profileData, error: profileError } = await supabase.rpc("rpc_get_my_family_details");
    const { data: childrenData, error: childrenLoadError } = await supabase.rpc("rpc_list_my_family_children");
    const { data: parentData, error: parentLoadError } = await supabase.rpc("rpc_get_my_parent_profile");

    if (profileError) throw profileError;
    if (childrenLoadError) throw childrenLoadError;
    if (parentLoadError) throw parentLoadError;

    const profile = Array.isArray(profileData) ? profileData[0] : profileData;
    const children = Array.isArray(childrenData) ? childrenData : [];
    const parent = Array.isArray(parentData) ? parentData[0] : parentData;

    if (parent) {
      setVal("profile-parent-name", parent.name || "");
      setVal("profile-phone", parent.phone || "");
      setBool("notify-new-request", parent.notify_new_request);
      setBool("notify-unoffered-48h", parent.notify_unoffered_48h);
      setBool("notify-request-offered", parent.notify_request_offered);
      setBool("notify-offer-cancelled-edited", parent.notify_offer_cancelled_or_edited);
      setBool("notify-ledger-debtor", parent.notify_ledger_debtor);
      setBool("notify-midmonth-inactive", parent.notify_midmonth_inactive);
    }

    if (profile) {
      setVal("profile-family-name", profile.name);
      setVal("profile-address", profile.address);
      renderEmergencyContacts(Array.isArray(profile.emergency_contacts) ? profile.emergency_contacts : []);
      setVal("profile-pets", profile.pets);
      setVal("profile-family-photo-url", profile.family_photo_url);
      setVal("profile-business-information", profile.business_information);

    } else {
      renderEmergencyContacts([]);
    }

    renderChildren(children.map((child) => ({
      name: child.name,
      date_of_birth: monthValueFromDate(child.date_of_birth),
      dietary_restrictions: child.dietary_restrictions,
      pet_issues: child.pet_issues
    })));
  } catch (error) {
    setText("profile-save-message", error?.message || "Failed to load profile.", true);
  }

  await refreshLinkedFamilyEmails();

  const updateEmailBtn = document.getElementById("profile-update-email-btn");
  if (updateEmailBtn) {
    updateEmailBtn.onclick = async () => {
      const newEmail = val("profile-new-email").trim();
      if (!newEmail) {
        setText("profile-account-message", "Enter a new email first.", true);
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        setText("profile-account-message", error.message, true);
        return;
      }
      setText("profile-account-message", "Email update requested. Check inbox for confirmation.");
    };
  }

  const updatePasswordBtn = document.getElementById("profile-update-password-btn");
  if (updatePasswordBtn) {
    updatePasswordBtn.onclick = async () => {
      const newPassword = val("profile-new-password");
      if (!newPassword || newPassword.length < 6) {
        setText("profile-account-message", "Password must be at least 6 characters.", true);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setText("profile-account-message", error.message, true);
        return;
      }
      setText("profile-account-message", "Password updated.");
      setVal("profile-new-password", "");
    };
  }

}

window.mountProfilePage = mountProfilePage;

export { mountProfilePage };
