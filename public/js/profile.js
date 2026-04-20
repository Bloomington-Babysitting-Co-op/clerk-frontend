import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import {
  setupNavbar,
  formatDateOnly,
  formatValidationErrors,
  monthValueFromDate,
  getCheckedValue,
  setCheckedValue,
  getInputValue,
  setInputValue,
  setStatusText,
  getSignedUrl
} from "./utils.js";

// Helpers for client-side image resizing and upload
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

async function resizeImageFile(file, maxDim = 750, mimeType = 'image/jpeg', quality = 0.9) {
  const img = await loadImageFromFile(file);
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      // If requested mime differs from original and we want jpeg, blob will be jpeg
      resolve(blob);
    }, mimeType, quality);
  });
}

async function uploadToStorage(blob, destPath) {
  try {
    const bucket = 'family-photos';
    // upload
    const res = await supabase.storage.from(bucket).upload(destPath, blob, { upsert: true });
    // handle different response shapes
    if (res.error) throw res.error;
    // Return internal storage path (do not expose public URL)
    // Store only the object path so frontend can request a signed URL when needed.
    return `${destPath}`;
  } catch (err) {
    throw err;
  }
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
      <label class="block text-sm font-medium mb-1">Car Seat requirements</label>
      <select data-child-field="car_seat" class="border p-2 w-full rounded">
        <option value="">Select a car seat</option>
        <option value="Infant" ${child.car_seat === "Infant" ? "selected" : ""}>Infant</option>
        <option value="Rear-facing" ${child.car_seat === "Rear-facing" ? "selected" : ""}>Rear-facing</option>
        <option value="Forward-facing" ${child.car_seat === "Forward-facing" ? "selected" : ""}>Forward-facing</option>
        <option value="Booster" ${child.car_seat === "Booster" ? "selected" : ""}>Booster</option>
        <option value="None" ${child.car_seat === "None" ? "selected" : ""}>None</option>
      </select>
    </div>
    <div class="md:col-span-2">
      <label class="block text-sm font-medium mb-1">Notes</label>
      <textarea data-child-field="notes" class="border p-2 w-full rounded" rows="2">${child.notes || ""}</textarea>
    </div>
    <div class="md:col-span-2 flex justify-start">
      <button type="button" data-remove-child class="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded">Remove Child</button>
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
    const carSeat = row.querySelector('[data-child-field="car_seat"]')?.value?.trim() || "";
    const notes = row.querySelector('[data-child-field="notes"]')?.value?.trim() || "";

    const hasAnyValue = !!(name || dateOfBirth || allergies || carSeat || notes);
    if (!hasAnyValue) continue;

    if (!name || !dateOfBirth) {
      errors.push(`Child row ${index + 1} needs both a name and month of birth.`);
      continue;
    }

    children.push({
      name,
      date_of_birth: dateOfBirth,
      allergies,
      car_seat: carSeat,
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
    <div class="md:col-span-2 flex justify-start">
      <button type="button" data-remove-emergency-contact class="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded">Remove Contact</button>
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
  setupNavbar("navbar");
  const session = await requireAuth();
  const userEmail = session.user.email || "";

  let currentFamilyId = null;
  let currentFamilyPhotoPath = null;

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

      const { error: parentError } = await supabase.rpc("rpc_update_my_parent_profile", {
        p_name: parentName,
        p_phone: phone,
        p_email_endmonth_summary: getCheckedValue("email-endmonth-summary"),
        p_email_midmonth_inactive: getCheckedValue("email-midmonth-inactive"),
        p_email_ledger_change: getCheckedValue("email-ledger-change"),
        p_email_other_request_new: getCheckedValue("email-other-request-new"),
        p_email_other_request_unoffered: getCheckedValue("email-other-request-unoffered"),
        p_email_other_request_expiring: getCheckedValue("email-other-request-expiring"),
        p_email_my_request_offered: getCheckedValue("email-my-request-offered"),
        p_email_my_request_unoffered: getCheckedValue("email-my-request-unoffered"),
        p_email_my_request_expiring: getCheckedValue("email-my-request-expiring"),
        p_email_my_request_expired: getCheckedValue("email-my-request-expired"),
        p_email_my_offer_assigned: getCheckedValue("email-my-offer-assigned"),
        p_email_my_offer_change: getCheckedValue("email-my-offer-change"),
        p_email_my_offer_completed: getCheckedValue("email-my-offer-completed")
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
        p_notes: getInputValue("profile-notes")
      };

      const { error } = await supabase.rpc("rpc_update_my_family_details", payload);
      if (error) {
        setStatusText("profile-save-message", error.message, true);
        return;
      }

      const { error: childrenSaveError } = await supabase.rpc("rpc_merge_my_family_children", {
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
      setCheckedValue("email-endmonth-summary", parent.email_endmonth_summary);
      setCheckedValue("email-midmonth-inactive", parent.email_midmonth_inactive);
      setCheckedValue("email-ledger-change", parent.email_ledger_change);
      setCheckedValue("email-other-request-new", parent.email_other_request_new);
      setCheckedValue("email-other-request-unoffered", parent.email_other_request_unoffered);
      setCheckedValue("email-other-request-expiring", parent.email_other_request_expiring);
      setCheckedValue("email-my-request-offered", parent.email_my_request_offered);
      setCheckedValue("email-my-request-unoffered", parent.email_my_request_unoffered);
      setCheckedValue("email-my-request-expiring", parent.email_my_request_expiring);
      setCheckedValue("email-my-request-expired", parent.email_my_request_expired);
      setCheckedValue("email-my-offer-assigned", parent.email_my_offer_assigned);
      setCheckedValue("email-my-offer-change", parent.email_my_offer_change);
      setCheckedValue("email-my-offer-completed", parent.email_my_offer_completed);
    }

    if (profile) {
      setInputValue("profile-family-name", profile.name);
      setInputValue("profile-address", profile.address);
      renderEmergencyContacts(Array.isArray(profile.emergency_contacts) ? profile.emergency_contacts : []);
      setInputValue("profile-pets", profile.pets);
      // store internal link in hidden input; preview image shown if available
      setInputValue("profile-family-photo-storage-path", profile.family_photo_storage_path);
      currentFamilyId = profile.id;
      const preview = document.getElementById('profile-photo-preview');
      const placeholder = document.getElementById('profile-photo-placeholder');
      if (profile.family_photo_storage_path) {
        // request signed URL to preview
        currentFamilyPhotoPath = profile.family_photo_storage_path;
        try {
          const signed = await getSignedUrl(profile.family_photo_storage_path, 60);
          if (preview) { preview.src = signed; preview.classList.remove('hidden'); }
          if (placeholder) { placeholder.classList.add('hidden'); }
        } catch (err) {
          // fall back to hiding preview
        }
      }
      setInputValue("profile-notes", profile.notes);

      // populate admin metadata (uneditable)
      const joinedEl = document.getElementById('profile-admin-joined');
      const bgEl = document.getElementById('profile-admin-background');
      const duesEl = document.getElementById('profile-admin-dues');
      if (joinedEl) joinedEl.textContent = formatDateOnly(profile.admin_date_joined) || 'N/A';
      if (bgEl) bgEl.textContent = formatDateOnly(profile.admin_last_background_check) || 'N/A';
      if (duesEl) duesEl.textContent = formatDateOnly(profile.admin_last_dues_payment) || 'N/A';

    } else {
      renderEmergencyContacts([]);
    }

    renderChildren(children.map((child) => ({
      name: child.name,
      date_of_birth: monthValueFromDate(child.date_of_birth),
      allergies: child.allergies,
      car_seat: child.car_seat,
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

  // Photo input & upload handling
  const photoInput = document.getElementById('profile-photo-input');
  const chooseBtn = document.getElementById('profile-photo-choose-btn');
  const filenameEl = document.getElementById('profile-photo-filename');
  const previewImg = document.getElementById('profile-photo-preview');
  const placeholder = document.getElementById('profile-photo-placeholder');
  const uploadBtn = document.getElementById('profile-photo-upload-btn');
  const photoMsg = document.getElementById('profile-photo-message');
  const deleteBtn = document.getElementById('profile-photo-delete-btn');


  if (photoInput) {
    // Wire a custom choose button to the native input click
    if (chooseBtn) {
      chooseBtn.onclick = () => photoInput.click();
    }

    photoInput.onchange = () => {
      const file = photoInput.files && photoInput.files[0];
      // update filename display
      if (filenameEl) filenameEl.textContent = file ? file.name : 'No file chosen';
      if (!file) return;
      // quick preview (not uploaded yet)
      try {
        const url = URL.createObjectURL(file);
        if (previewImg) { previewImg.src = url; previewImg.classList.remove('hidden'); }
        if (placeholder) { placeholder.classList.add('hidden'); }
      } catch (e) {
        // ignore
      }
    };
  }

  if (uploadBtn) {
    uploadBtn.onclick = async () => {
      if (!photoInput || !photoInput.files || !photoInput.files[0]) {
        if (photoMsg) photoMsg.textContent = 'Select an image first.';
        return;
      }
      const file = photoInput.files[0];
      if (!file.type.startsWith('image/')) {
        if (photoMsg) photoMsg.textContent = 'Please select an image file.';
        return;
      }

      try {
        if (photoMsg) { photoMsg.textContent = 'Resizing image...'; }
        // resize to max 750x750
        const blob = await resizeImageFile(file, 750, 'image/jpeg', .9);

        if (photoMsg) photoMsg.textContent = 'Uploading...';

        const destPath = `${currentFamilyId}.jpg`;
        const storagePath = await uploadToStorage(blob, destPath);

        // persist family_photo_storage_path to DB
        try {
          const { error: rpcError } = await supabase.rpc("rpc_update_my_family_photo", {
            p_family_photo_storage_path: storagePath
          });
          if (rpcError) {
            console.error('rpc_update_my_family_photo error', rpcError);
            if (photoMsg) photoMsg.textContent = `Upload saved but DB update failed: ${rpcError.message}`;
          }
        } catch (e) {
          console.error('rpc_update_my_family_photo threw', e);
          if (photoMsg) photoMsg.textContent = 'Upload saved but DB update failed.';
        }
        // request signed URL for preview
        try {
          const signed = await getSignedUrl(storagePath, 60);
          if (previewImg) { previewImg.src = signed; previewImg.classList.remove('hidden'); }
          if (placeholder) { placeholder.classList.add('hidden'); }
          if (photoMsg) photoMsg.textContent = 'Upload successful.';
        } catch (err) {
          if (photoMsg) photoMsg.textContent = 'Upload saved but preview failed.';
        }
      } catch (err) {
        console.error(err);
        if (photoMsg) photoMsg.textContent = err?.message || 'Upload failed.';
      }
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!currentFamilyPhotoPath) {
        if (photoMsg) photoMsg.textContent = 'No uploaded photo to delete.';
        return;
      }

      if (!confirm('Delete the family photo? This cannot be undone.')) return;

      try {
        if (photoMsg) photoMsg.textContent = 'Deleting photo...';
        const bucket = 'family-photos';
        // attempt to remove from storage
        const { data: removeData, error: removeError } = await supabase.storage.from(bucket).remove([currentFamilyPhotoPath]);
        if (removeError) {
          console.error('storage remove error', removeError);
          if (photoMsg) photoMsg.textContent = `Failed to delete storage object: ${removeError.message}`;
          return;
        }

        // clear DB reference
        try {
          const { error: rpcError } = await supabase.rpc('rpc_update_my_family_photo', { p_family_photo_storage_path: null });
          if (rpcError) {
            console.error('rpc_update_my_family_photo error', rpcError);
            if (photoMsg) photoMsg.textContent = `Deleted file but DB update failed: ${rpcError.message}`;
            // still proceed to update UI
          }
        } catch (e) {
          console.error('rpc_update_my_family_photo threw', e);
          if (photoMsg) photoMsg.textContent = 'Deleted file but DB update failed.';
        }

        // update UI
        currentFamilyPhotoPath = null;
        if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
        if (placeholder) { placeholder.classList.remove('hidden'); }
        if (filenameEl) filenameEl.textContent = 'No file chosen';
        if (photoMsg) photoMsg.textContent = 'Photo deleted.';
      } catch (err) {
        console.error(err);
        if (photoMsg) photoMsg.textContent = err?.message || 'Failed to delete photo.';
      }
    };
  }
}

export { mountProfilePage };
