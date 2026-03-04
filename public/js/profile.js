import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  formatValidationErrors,
  getCheckedValue,
  getInputValue,
  monthValueFromDate,
  setCheckedValue,
  setInputValue,
  setStatusText
} from "./utils.js";

function setLinkedFamilyEmails(emails) {
  const el = document.getElementById("profile-linked-family-emails");
  if (!el) return;
  if (!emails.length) {
    el.textContent = "No linked login emails yet.";
    return;
  }
  el.textContent = emails.join(", ");
}

function createChildRow(child = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-3 grid md:grid-cols-2 gap-3";
  wrapper.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Name <span class="text-red-600">*</span></label>
      <input data-child-field="name" type="text" class="border p-2 w-full rounded" value="${child.name || ""}" required>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Month of Birth <span class="text-red-600">*</span></label>
      <input data-child-field="date_of_birth" type="month" class="border p-2 w-full rounded" value="${monthValueFromDate(child.date_of_birth)}" required>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Allergies/Dietary restrictions</label>
      <textarea data-child-field="allergies" class="border p-2 w-full rounded" rows="2">${child.allergies || ""}</textarea>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes</label>
      <textarea data-child-field="notes" class="border p-2 w-full rounded" rows="2">${child.notes || ""}</textarea>
    </div>
    <div class="md:col-span-2 flex justify-end">
      <button type="button" data-remove-child class="bg-red-600 text-white px-2 py-0.5 rounded">Remove Child</button>
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
  if (!list) return { children: [], errors: [] };

  const rows = Array.from(list.children);
  const children = [];
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const name = row.querySelector('[data-child-field="name"]')?.value?.trim() || "";
    const dateOfBirth = row.querySelector('[data-child-field="date_of_birth"]')?.value || "";
    const allergies = row.querySelector('[data-child-field="allergies"]')?.value?.trim() || "";
    const notes = row.querySelector('[data-child-field="notes"]')?.value?.trim() || "";

    const hasAnyValue = !!(name || dateOfBirth || allergies || notes);
    if (!hasAnyValue) continue;

    if (!name || !dateOfBirth) {
      errors.push(`Child row ${index + 1} needs both a name and month of birth.`);
      continue;
    }

    children.push({
      name,
      date_of_birth: dateOfBirth,
      allergies,
      notes
    });
  }

  if (!children.length && !errors.length) {
    errors.push("At least one child with name and month of birth is required.");
  }

  return { children, errors };
}

function createEmergencyContactRow(contact = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-3 grid md:grid-cols-2 gap-3";
  wrapper.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Name <span class="text-red-600">*</span></label>
      <input data-emergency-contact-field="name" type="text" class="border p-2 w-full rounded" value="${contact.name || ""}" required>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Phone <span class="text-red-600">*</span></label>
      <input data-emergency-contact-field="phone" type="text" class="border p-2 w-full rounded" value="${contact.phone || ""}" required>
    </div>
    <div class="md:col-span-2 flex justify-end">
      <button type="button" data-remove-emergency-contact class="bg-red-600 text-white px-2 py-0.5 rounded">Remove Contact</button>
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
  if (!list) return { emergencyContacts: [], errors: [] };

  const rows = Array.from(list.children);
  const emergencyContacts = [];
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const name = row.querySelector('[data-emergency-contact-field="name"]')?.value?.trim() || "";
    const phone = row.querySelector('[data-emergency-contact-field="phone"]')?.value?.trim() || "";

    const hasAnyValue = !!(name || phone);
    if (!hasAnyValue) continue;

    if (!name || !phone) {
      errors.push(`Emergency contact row ${index + 1} needs both a name and phone.`);
      continue;
    }

    emergencyContacts.push({
      name,
      phone
    });
  }

  if (!emergencyContacts.length && !errors.length) {
    errors.push("At least one emergency contact with name and phone is required.");
  }

  return { emergencyContacts, errors };
}

async function mountProfilePage() {
  const session = await requireAuth();
  const userEmail = session.user.email || "";

  setInputValue("profile-email", userEmail);
  setInputValue("profile-parent-name", "");
  setInputValue("profile-phone", "");

  const saveBtn = document.getElementById("profile-save-btn");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const parentName = getInputValue("profile-parent-name").trim();
      const phone = getInputValue("profile-phone").trim();
      const familyName = getInputValue("profile-family-name").trim();
      const address = getInputValue("profile-address").trim();
      const validationErrors = [];

      if (!parentName) {
        validationErrors.push("Parent Name is required.");
      }

      if (!phone) {
        validationErrors.push("Phone is required.");
      }

      if (!familyName) {
        validationErrors.push("Family Name is required.");
      }

      if (!address) {
        validationErrors.push("Address is required.");
      }

      const { children, errors: childrenErrors } = collectChildrenPayload();
      if (childrenErrors.length) {
        validationErrors.push(...childrenErrors);
      }

      const { emergencyContacts, errors: emergencyContactsErrors } = collectEmergencyContactsPayload();
      if (emergencyContactsErrors.length) {
        validationErrors.push(...emergencyContactsErrors);
      }

      if (validationErrors.length) {
        setStatusText("profile-save-message", formatValidationErrors(validationErrors), true);
        return;
      }

      const { error: parentError } = await supabase.rpc("rpc_upsert_my_parent_profile", {
        p_name: parentName,
        p_phone: phone,
        p_notify_new_request: getCheckedValue("notify-new-request"),
        p_notify_unoffered_48h: getCheckedValue("notify-unoffered-48h"),
        p_notify_request_offered: getCheckedValue("notify-request-offered"),
        p_notify_offer_cancelled_or_edited: getCheckedValue("notify-offer-cancelled-edited"),
        p_notify_ledger_debtor: getCheckedValue("notify-ledger-debtor"),
        p_notify_midmonth_inactive: getCheckedValue("notify-midmonth-inactive")
      });
      if (parentError) {
        setStatusText("profile-save-message", parentError.message, true);
        return;
      }

      const payload = {
        p_name: familyName,
        p_address: address,
        p_emergency_contacts: emergencyContacts,
        p_pets: getInputValue("profile-pets"),
        p_family_photo_url: getInputValue("profile-family-photo-url"),
        p_notes: getInputValue("profile-notes")
      };

      const { error } = await supabase.rpc("rpc_upsert_my_family_details", payload);
      if (error) {
        setStatusText("profile-save-message", error.message, true);
        return;
      }

      const { error: childrenSaveError } = await supabase.rpc("rpc_replace_my_family_children", {
        p_children: children
      });

      if (childrenSaveError) {
        setStatusText("profile-save-message", childrenSaveError.message, true);
        return;
      }

      setStatusText("profile-save-message", "Profile saved.");
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
      setStatusText("profile-account-message", error.message, true);
      return;
    }
    const emails = (Array.isArray(data) ? data : [])
      .map((row) => row?.email)
      .filter(Boolean);
    setLinkedFamilyEmails(emails);
  };

  try {
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
      setInputValue("profile-parent-name", parent.name || "");
      setInputValue("profile-phone", parent.phone || "");
      setCheckedValue("notify-new-request", parent.notify_new_request);
      setCheckedValue("notify-unoffered-48h", parent.notify_unoffered_48h);
      setCheckedValue("notify-request-offered", parent.notify_request_offered);
      setCheckedValue("notify-offer-cancelled-edited", parent.notify_offer_cancelled_or_edited);
      setCheckedValue("notify-ledger-debtor", parent.notify_ledger_debtor);
      setCheckedValue("notify-midmonth-inactive", parent.notify_midmonth_inactive);
    }

    if (profile) {
      setInputValue("profile-family-name", profile.name);
      setInputValue("profile-address", profile.address);
      renderEmergencyContacts(Array.isArray(profile.emergency_contacts) ? profile.emergency_contacts : []);
      setInputValue("profile-pets", profile.pets);
      setInputValue("profile-family-photo-url", profile.family_photo_url);
      setInputValue("profile-notes", profile.notes);

    } else {
      renderEmergencyContacts([]);
    }

    renderChildren(children.map((child) => ({
      name: child.name,
      date_of_birth: monthValueFromDate(child.date_of_birth),
      allergies: child.allergies,
      notes: child.notes
    })));
  } catch (error) {
    setStatusText("profile-save-message", error?.message || "Failed to load profile.", true);
  }

  await refreshLinkedFamilyEmails();

  const updateEmailBtn = document.getElementById("profile-update-email-btn");
  if (updateEmailBtn) {
    updateEmailBtn.onclick = async () => {
      const newEmail = getInputValue("profile-new-email").trim();
      if (!newEmail) {
        setStatusText("profile-account-message", "Enter a new email first.", true);
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        setStatusText("profile-account-message", error.message, true);
        return;
      }
      setStatusText("profile-account-message", "Email update requested. Check inbox for confirmation.");
    };
  }

  const updatePasswordBtn = document.getElementById("profile-update-password-btn");
  if (updatePasswordBtn) {
    updatePasswordBtn.onclick = async () => {
      const newPassword = getInputValue("profile-new-password");
      if (!newPassword || newPassword.length < 6) {
        setStatusText("profile-account-message", "Password must be at least 6 characters.", true);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setStatusText("profile-account-message", error.message, true);
        return;
      }
      setStatusText("profile-account-message", "Password updated.");
      setInputValue("profile-new-password", "");
    };
  }

}

export { mountProfilePage };
