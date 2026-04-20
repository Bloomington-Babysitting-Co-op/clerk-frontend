import { supabase } from "/js/supabase.js";
import { requireAuth } from "./auth.js";
import {
  setupNavbar,
  escapeHtml,
  formatDateOnly,
  getAgeLabel,
  downloadCsv,
  setButtonTemporaryBusy,
  getSignedUrl
} from "/js/utils.js";

function renderRowsOrFallback(items, renderItem, fallback) {
  if (!Array.isArray(items) || !items.length) {
    return `<p class=\"text-sm text-gray-600\">${escapeHtml(fallback)}</p>`;
  }
  return items.map(renderItem).join("");
}

function renderFamilyCard(family, idx) {
  const parents = Array.isArray(family.parents) ? family.parents : [];
  const emergencyContacts = Array.isArray(family.emergency_contacts) ? family.emergency_contacts : [];
  const children = Array.isArray(family.children) ? family.children : [];
  const addressValue = (family.address || "").trim();
  const mapsUrl = addressValue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressValue)}` : "";

  // article starts collapsed; content placed inside .family-content
  const idAttr = escapeHtml(String(family.id ?? family.family_id ?? idx));
  return `
    <article class="family-card bg-white rounded-lg shadow" data-family-id="${idAttr}">
      <header class="family-header flex items-center p-4 cursor-pointer">
        <button type="button" class="family-toggle-btn w-6 h-6 flex items-center justify-center mr-3 bg-gray-100 hover:bg-gray-200 rounded border" aria-expanded="false" aria-pressed="false" aria-label="Expand family">+</button>
        <h2 class="text-2xl font-bold">${escapeHtml(family.family_name || "Unnamed family")}</h2>
        <div class="ml-auto flex items-center space-x-3 text-xs">
          <span class="text-gray-800">Joined ${escapeHtml(formatDateOnly(family.joined_date) || "N/A")}</span>
          ${family.is_admin ? `<span class="bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center">Admin</span>` : ''}
        </div>
      </header>

      <div class="family-content hidden p-6 space-y-4">
        <div>
          <p class="text-sm font-semibold text-gray-800">Address</p>
          <p class="text-gray-800">${addressValue
            ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-600">${escapeHtml(addressValue)}</a>`
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
                    <p><span class="font-medium">Car Seat:</span> ${escapeHtml(child?.car_seat || "None")}</p>
                    <p><span class="font-medium">Notes:</span> ${escapeHtml(child?.notes || "None")}</p>
                  </div>
                `;
              },
              "No children"
            )}
          </div>
        </div>

        <div class="grid md:grid-cols-3 gap-3">
          <div class="md:col-span-1">
            <p class="text-sm font-semibold text-gray-800">Pets</p>
            <p class="text-gray-800">${escapeHtml(family.pets || "Not provided")}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm font-semibold text-gray-800">Notes</p>
            <p class="text-gray-800">${escapeHtml(family.notes || "Not provided")}</p>
          </div>
        </div>

        <div class="mt-3">
          <p class="text-sm font-semibold text-gray-800">Family Photo</p>
          ${family.family_photo_storage_path ? `
              <img data-storage-path="${escapeHtml(family.family_photo_storage_path)}" alt="Family photo" class="mt-2 object-cover rounded border" />
            ` : `<p class="text-gray-800">Not provided</p>`}
        </div>
      </div>
    </article>
  `;
}

async function mountFamiliesPage(containerId) {
  setupNavbar("navbar");
  await requireAuth();
  const container = document.getElementById(containerId);
  if (!container) return;

  const { data, error } = await supabase.rpc("rpc_list_families_active");

  if (error) {
    container.innerHTML = `<p class=\"text-red-600\">${escapeHtml(error.message)}</p>`;
    return;
  }

  const families = Array.isArray(data) ? data : [];
  container.innerHTML = families.length
    ? families.map((family, i) => renderFamilyCard(family, i)).join("")
    : "<p class='text-gray-600'>No families found.</p>";

  // attach toggle behavior
  function setArticleExpanded(article, expanded) {
    const btn = article.querySelector('.family-toggle-btn');
    const content = article.querySelector('.family-content');
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

  const articles = Array.from(container.querySelectorAll('.family-card'));
  articles.forEach((article) => {
    const header = article.querySelector('.family-header');
    const btn = article.querySelector('.family-toggle-btn');
    // start collapsed
    setArticleExpanded(article, false);

    const toggle = (ev) => {
      ev && ev.preventDefault();
      const content = article.querySelector('.family-content');
      const isHidden = content.classList.contains('hidden');
      setArticleExpanded(article, isHidden);
    };

    if (header) header.addEventListener('click', toggle);
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(e); });
  });

  // toggle-all button
  const toggleAllBtn = document.getElementById('families-toggle-all');
  function updateFamiliesToggleAll() {
    if (!toggleAllBtn) return;
    const anyHidden = articles.some(a => a.querySelector('.family-content').classList.contains('hidden'));
    toggleAllBtn.textContent = anyHidden ? '+' : '-';
    toggleAllBtn.setAttribute('aria-pressed', anyHidden ? 'false' : 'true');
    toggleAllBtn.setAttribute('aria-label', anyHidden ? 'Expand all families' : 'Collapse all families');
  }

  if (toggleAllBtn) {
    updateFamiliesToggleAll();
    toggleAllBtn.addEventListener('click', () => {
      const anyHidden = articles.some(a => a.querySelector('.family-content').classList.contains('hidden'));
      articles.forEach((a) => setArticleExpanded(a, anyHidden));
      updateFamiliesToggleAll();
    });
  }

  // find all images with data-storage-path and replace src with signed URL
  const imgs = Array.from(container.querySelectorAll('img[data-storage-path]'));
  imgs.forEach(async (img) => {
    const path = img.getAttribute('data-storage-path');
    if (!path) return;
    const signed = await getSignedUrl(path, 60);
    if (signed) img.src = signed;
  });

  // ensure per-item toggles update the toggle-all button state
  articles.forEach((article) => {
    const observerHeader = article.querySelector('.family-header');
    if (observerHeader) observerHeader.addEventListener('click', () => setTimeout(updateFamiliesToggleAll, 0));
    const btn = article.querySelector('.family-toggle-btn');
    if (btn) btn.addEventListener('click', () => setTimeout(updateFamiliesToggleAll, 0));
  });

  const exportBtn = document.getElementById('families-export-csv');
  if (exportBtn) {
    exportBtn.onclick = () => {
      setButtonTemporaryBusy(exportBtn);

      const rows = [
        ["Family Name", "Address", "Parent Name", "Parent Email", "Parent Phone", "Emergency Contact Name", "Emergency Contact Phone", "Child Name", "Child Age", "Child Allergies", "Child Car Seat", "Child Notes", "Pets", "Family Notes"]
      ];

      (Array.isArray(families) ? families : []).forEach((family) => {
        const parents = Array.isArray(family.parents) ? family.parents : [];
        const emergencyContacts = Array.isArray(family.emergency_contacts) ? family.emergency_contacts : [];
        const children = Array.isArray(family.children) ? family.children : [];

        const rowCount = Math.max(parents.length, emergencyContacts.length, children.length, 1);

        for (let i = 0; i < rowCount; i++) {
          const parent = parents[i] || {};
          const contact = emergencyContacts[i] || {};
          const child = children[i] || {};

          const childAge = getAgeLabel(child?.date_of_birth) || "";

          rows.push([
            i === 0 ? (family.family_name || family.name || '') : '',
            i === 0 ? (family.address || '') : '',
            parent.name || '',
            parent.email || '',
            parent.phone || '',
            contact.name || '',
            contact.phone || '',
            child.name || '',
            childAge,
            child.allergies || '',
            child.car_seat || '',
            child.notes || '',
            i === 0 ? (family.pets || '') : '',
            i === 0 ? (family.notes || '') : ''
          ]);
        }
      });

      downloadCsv("families_export.csv", rows);
    };
  }
}

export { mountFamiliesPage };
