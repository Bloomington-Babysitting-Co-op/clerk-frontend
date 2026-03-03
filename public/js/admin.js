import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { getInputValue, setInputValue, setStatusText } from "./utils.js";

function setLinkedFamilyEmails(emails) {
  const el = document.getElementById("admin-linked-family-emails");
  if (!el) return;
  if (!emails.length) {
    el.textContent = "No linked login emails yet.";
    return;
  }
  el.textContent = emails.join(", ");
}

async function mountAdminPage() {
  await requireAuth();

  const { data: isAdmin, error: adminError } = await supabase.rpc("rpc_get_admin_status");
  if (adminError) {
    setStatusText("admin-save-message", adminError.message, true);
    return;
  }

  if (!isAdmin) {
    window.location.href = "/profile.html";
    return;
  }

  let profile = null;

  const refreshLinkedFamilyEmails = async () => {
      const { data, error } = await supabase.rpc("rpc_list_my_family_emails");
    if (error) {
      setStatusText("admin-family-message", error.message, true);
      return;
    }

    const emails = (Array.isArray(data) ? data : [])
      .map((row) => row?.email)
      .filter(Boolean);
    setLinkedFamilyEmails(emails);
  };

  const refreshProfile = async () => {
    const { data, error } = await supabase.rpc("rpc_get_my_family_details");
    if (error) {
      setStatusText("admin-save-message", error.message, true);
      return;
    }

    profile = Array.isArray(data) ? data[0] : data;
    if (!profile) return;

    setInputValue("admin-date-joined", profile.admin_date_joined);
    setInputValue("admin-last-background-check", profile.admin_last_background_check);
    setInputValue("admin-last-dues-payment", profile.admin_last_dues_payment);
    setInputValue("admin-notes", profile.admin_general_notes);
  };

  await Promise.all([refreshLinkedFamilyEmails(), refreshProfile()]);

  const linkEmailBtn = document.getElementById("admin-link-family-email-btn");
  if (linkEmailBtn) {
    linkEmailBtn.onclick = async () => {
      const emailToLink = getInputValue("admin-link-family-email").trim();
      if (!emailToLink) {
        setStatusText("admin-family-message", "Enter an email to link first.", true);
        return;
      }

        const { error } = await supabase.rpc("rpc_add_family_member_by_email", {
        p_email: emailToLink
      });

      if (error) {
        setStatusText("admin-family-message", error.message, true);
        return;
      }

      setInputValue("admin-link-family-email", "");
      await refreshLinkedFamilyEmails();
      setStatusText("admin-family-message", "Linked login email added to this family.");
    };
  }

  const saveBtn = document.getElementById("admin-save-btn");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (!profile) {
        setStatusText("admin-save-message", "Family details not loaded yet.", true);
        return;
      }

      const payload = {
        p_name: profile.name,
        p_address: profile.address,
        p_emergency_contacts: profile.emergency_contacts,
        p_pets: profile.pets,
        p_family_photo_url: profile.family_photo_url,
        p_business_information: profile.business_information,
        p_admin_date_joined: getInputValue("admin-date-joined") || null,
        p_admin_last_background_check: getInputValue("admin-last-background-check") || null,
        p_admin_last_dues_payment: getInputValue("admin-last-dues-payment") || null,
        p_admin_general_notes: getInputValue("admin-notes")
      };

      const { error } = await supabase.rpc("rpc_upsert_my_family_details", payload);
      if (error) {
        setStatusText("admin-save-message", error.message, true);
        return;
      }

      await refreshProfile();
      setStatusText("admin-save-message", "Admin fields saved.");
    };
  }
}

export { mountAdminPage };
