import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";

function setText(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  el.className = isError ? "text-sm text-red-600" : "text-sm text-gray-700";
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

async function mountProfilePage() {
  const session = await requireAuth();
  const userEmail = session.user.email || "";

  setVal("profile-current-email", userEmail);

  const [{ data: isAdmin, error: adminError }, { data: profileData, error: profileError }] = await Promise.all([
    supabase.rpc("rpc_is_admin"),
    supabase.rpc("rpc_get_my_profile_details")
  ]);

  if (adminError) throw adminError;
  if (profileError) throw profileError;

  const profile = Array.isArray(profileData) ? profileData[0] : profileData;

  if (isAdmin) {
    const adminSection = document.getElementById("profile-admin-section");
    if (adminSection) adminSection.style.display = "block";
  }

  if (profile) {
    setVal("profile-family-name", profile.family_name);
    setVal("profile-phone", profile.phone);
    setVal("profile-parent-member-names", profile.parent_member_names);
    setVal("profile-member-emails", profile.member_emails);
    setVal("profile-member-phones", profile.member_phones);
    setVal("profile-address", profile.address);
    setVal("profile-emergency-contact-names", profile.emergency_contact_names);
    setVal("profile-emergency-contact-phones", profile.emergency_contact_phones);
    setVal("profile-children-details", profile.children_details);
    setVal("profile-pets", profile.pets);
    setVal("profile-family-photo-url", profile.family_photo_url);
    setVal("profile-business-information", profile.business_information);

    setBool("notify-new-request", profile.notify_new_request);
    setBool("notify-unoffered-48h", profile.notify_unoffered_48h);
    setBool("notify-request-offered", profile.notify_request_offered);
    setBool("notify-offer-cancelled-edited", profile.notify_offer_cancelled_or_edited);
    setBool("notify-ledger-debtor", profile.notify_ledger_debtor);
    setBool("notify-midmonth-inactive", profile.notify_midmonth_inactive);

    setVal("admin-date-joined", profile.admin_date_joined);
    setVal("admin-last-background-check", profile.admin_last_background_check);
    setVal("admin-last-dues-payment", profile.admin_last_dues_payment);
    setVal("admin-general-notes", profile.admin_general_notes);
  }

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

  const saveBtn = document.getElementById("profile-save-btn");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const payload = {
        p_family_name: val("profile-family-name"),
        p_phone: val("profile-phone"),
        p_parent_member_names: val("profile-parent-member-names"),
        p_member_emails: val("profile-member-emails"),
        p_member_phones: val("profile-member-phones"),
        p_address: val("profile-address"),
        p_emergency_contact_names: val("profile-emergency-contact-names"),
        p_emergency_contact_phones: val("profile-emergency-contact-phones"),
        p_children_details: val("profile-children-details"),
        p_pets: val("profile-pets"),
        p_family_photo_url: val("profile-family-photo-url"),
        p_business_information: val("profile-business-information"),
        p_notify_new_request: bool("notify-new-request"),
        p_notify_unoffered_48h: bool("notify-unoffered-48h"),
        p_notify_request_offered: bool("notify-request-offered"),
        p_notify_offer_cancelled_or_edited: bool("notify-offer-cancelled-edited"),
        p_notify_ledger_debtor: bool("notify-ledger-debtor"),
        p_notify_midmonth_inactive: bool("notify-midmonth-inactive"),
        p_admin_date_joined: val("admin-date-joined") || null,
        p_admin_last_background_check: val("admin-last-background-check") || null,
        p_admin_last_dues_payment: val("admin-last-dues-payment") || null,
        p_admin_general_notes: val("admin-general-notes")
      };

      const { error } = await supabase.rpc("rpc_upsert_my_profile_details", payload);
      if (error) {
        setText("profile-save-message", error.message, true);
        return;
      }

      setText("profile-save-message", "Profile saved.");
    };
  }

  const logoutBtn = document.getElementById("profile-logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location = "/";
    };
  }
}

window.mountProfilePage = mountProfilePage;

export { mountProfilePage };
