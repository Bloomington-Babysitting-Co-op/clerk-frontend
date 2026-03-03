import { supabase } from "/js/supabase.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAgeLabel(dateOfBirthValue) {
  if (!dateOfBirthValue) return "";

  const dob = new Date(dateOfBirthValue);
  if (Number.isNaN(dob.getTime())) return "";

  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();

  if (today.getDate() < dob.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) {
    return "0y 0m";
  }

  return `${years}y ${months}m`;
}

function renderRowsOrFallback(items, renderItem, fallback) {
  if (!Array.isArray(items) || !items.length) {
    return `<p class=\"text-sm text-gray-600\">${escapeHtml(fallback)}</p>`;
  }
  return items.map(renderItem).join("");
}

function renderFamilyCard(family) {
  const parents = Array.isArray(family.parents) ? family.parents : [];
  const emergencyContacts = Array.isArray(family.emergency_contacts) ? family.emergency_contacts : [];
  const children = Array.isArray(family.children) ? family.children : [];
  const addressValue = (family.address || "").trim();
  const mapsUrl = addressValue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressValue)}` : "";

  return `
    <article class="bg-white p-6 rounded-lg shadow space-y-4">
      <h2 class="text-2xl font-bold">${escapeHtml(family.family_name || "Unnamed family")}</h2>

      <div>
        <p class="text-sm font-semibold text-gray-700">Address</p>
        <p class="text-gray-800">${addressValue
          ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-700">${escapeHtml(addressValue)}</a>`
          : "Not provided"}</p>
      </div>

      <div class="grid md:grid-cols-3 gap-3">
        <div class="border rounded p-3 space-y-2">
          <h3 class="font-semibold">Parent</h3>
          ${renderRowsOrFallback(
            parents,
            (parent) => `
              <div class="text-sm text-gray-800 border rounded p-2 bg-gray-50">
                <p><span class="font-medium">Name:</span> ${escapeHtml(parent?.name || "Not provided")}</p>
                <p><span class="font-medium">Email:</span> ${escapeHtml(parent?.email || "Not provided")}</p>
                <p><span class="font-medium">Phone:</span> ${escapeHtml(parent?.phone || "Not provided")}</p>
              </div>
            `,
            "No parent records"
          )}
        </div>

        <div class="border rounded p-3 space-y-2">
          <h3 class="font-semibold">Emergency Contact</h3>
          ${renderRowsOrFallback(
            emergencyContacts,
            (contact) => `
              <div class="text-sm text-gray-800 border rounded p-2 bg-gray-50">
                <p><span class="font-medium">Name:</span> ${escapeHtml(contact?.name || "Not provided")}</p>
                <p><span class="font-medium">Phone:</span> ${escapeHtml(contact?.phone || "Not provided")}</p>
              </div>
            `,
            "No emergency contacts"
          )}
        </div>

        <div class="border rounded p-3 space-y-2">
          <h3 class="font-semibold">Children</h3>
          ${renderRowsOrFallback(
            children,
            (child) => {
              const ageLabel = getAgeLabel(child?.date_of_birth);
              return `
                <div class="text-sm text-gray-800 border rounded p-2 bg-gray-50">
                  <p><span class="font-medium">Name:</span> ${escapeHtml(child?.name || "Unnamed child")}${ageLabel ? ` (${escapeHtml(ageLabel)})` : ""}</p>
                  <p><span class="font-medium">Allergies:</span> ${escapeHtml(child?.allergies || "None")}</p>
                  <p><span class="font-medium">Notes:</span> ${escapeHtml(child?.notes || "None")}</p>
                </div>
              `;
            },
            "No children"
          )}
        </div>
      </div>

      <div class="grid md:grid-cols-3 gap-3">
        <div>
          <p class="text-sm font-semibold text-gray-700">Pets</p>
          <p class="text-gray-800">${escapeHtml(family.pets || "Not provided")}</p>
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-700">Family Photo URL</p>
          <p class="text-gray-800 break-all">${escapeHtml(family.family_photo_url || "Not provided")}</p>
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-700">Business Information</p>
          <p class="text-gray-800">${escapeHtml(family.business_information || "Not provided")}</p>
        </div>
      </div>
    </article>
  `;
}

async function mountFamiliesPage(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const adminLink = document.getElementById("families-admin-link");
  const { data: isAdminData, error: isAdminError } = await supabase.rpc("rpc_get_admin_status");
  if (!isAdminError && isAdminData && adminLink) {
    adminLink.style.display = "inline-block";
  }

  const { data, error } = await supabase.rpc("rpc_list_families_full");

  if (error) {
    container.innerHTML = `<p class=\"text-red-600\">${escapeHtml(error.message)}</p>`;
    return;
  }

  const families = Array.isArray(data) ? data : [];
  container.innerHTML = families.length
    ? families.map((family) => renderFamilyCard(family)).join("")
    : "<p class='text-gray-600'>No families found.</p>";
}

window.mountFamiliesPage = mountFamiliesPage;

export { mountFamiliesPage };
