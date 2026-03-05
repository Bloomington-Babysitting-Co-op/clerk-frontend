import { supabase } from "/js/supabase.js";

export async function mountBanner(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const { data, error } = await supabase.rpc('rpc_get_dashboard_banner');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.enabled) {
      el.classList.add('hidden');
      return;
    }

    el.classList.remove('hidden');
    el.innerHTML = `<div class="rounded shadow p-3 text-center">${row.text || ''}</div>`;
    const child = el.firstElementChild;
    if (child) {
      child.style.backgroundColor = row.bg_color || '#F87171';
      child.style.color = row.text_color || '#FFFFFF';
    }
  } catch (err) {
    console.error('Failed to load dashboard banner', err);
    el.classList.add('hidden');
  }
}
