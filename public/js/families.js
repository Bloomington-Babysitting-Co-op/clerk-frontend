import { supabase } from "/js/supabase.js";
import { getAgeLabel } from "/js/utils.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
        <button type="button" class="family-toggle-btn w-6 h-6 flex items-center justify-center mr-3 bg-gray-100 rounded border" aria-expanded="false">+</button>
        <h2 class="text-2xl font-bold">${escapeHtml(family.family_name || "Unnamed family")}</h2>
      </header>

      <div class="family-content hidden p-6 space-y-4">
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
            <p class="text-sm font-semibold text-gray-700">Notes</p>
            <p class="text-gray-800">${escapeHtml(family.notes || "Not provided")}</p>
          </div>
        </div>
      </div>
    </article>
  `;
}

async function mountFamiliesPage(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { data, error } = await supabase.rpc("rpc_list_families_full");

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
      content.classList.remove('hidden');
    } else {
      btn.textContent = "+";
      btn.setAttribute('aria-expanded', 'false');
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

  // expand / collapse all buttons (if present on page)
  const expandAllBtn = document.getElementById('expand-all-btn');
  const collapseAllBtn = document.getElementById('collapse-all-btn');
  if (expandAllBtn) expandAllBtn.addEventListener('click', () => articles.forEach((a) => setArticleExpanded(a, true)));
  if (collapseAllBtn) collapseAllBtn.addEventListener('click', () => articles.forEach((a) => setArticleExpanded(a, false)));
}

export { mountFamiliesPage };
