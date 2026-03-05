import { supabase } from "/js/supabase.js";
import { escapeHtml } from "/js/utils.js";

export async function mountLinks(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const { data, error } = await supabase.rpc('rpc_get_dashboard_links');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    // group by row
    const grouped = {};
    for (const r of rows) {
      const row = Number(r.link_row) || 1;
      grouped[row] = grouped[row] || [];
      grouped[row].push(r);
    }

    // sort rows by row number
    const rowKeys = Object.keys(grouped).map(Number).sort((a,b)=>a-b);
    if (!rowKeys.length) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = rowKeys.map((rk) => {
      const items = grouped[rk]
        .slice()
        .sort((a,b) => Number(a.link_order || 0) - Number(b.link_order || 0))
        .map((it, idx) => `
          <a href="${escapeHtml(it.link_url || '#')}" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-700">${escapeHtml(it.link_text || it.link_url || '')}</a>
          ${idx < grouped[rk].length - 1 ? '<span class="mx-2 text-gray-400">•</span>' : ''}
        `).join('');
      return `<div class="text-blue-600">${items}</div>`;
    }).join('');
  } catch (err) {
    console.error('Failed to load dashboard links', err);
  }
}
