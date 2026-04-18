import { formatTimeOnly, escapeHtml } from "./utils.js";

function getRequestStatusTextClass(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "open") return "text-blue-600";
  if (normalized === "offered") return "text-yellow-600";
  if (normalized === "assigned") return "text-green-600";
  if (normalized === "completed") return "text-black";
  if (normalized === "cancelled" || normalized === "expired") return "text-red-600";
  return "text-gray-800";
}

function formatTitleCase(value) {
  const normalized = String(value || "unknown").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRequestDateLine(request) {
  const dateLabel = new Date(`${request.date}T00:00:00`).toLocaleDateString();
  const dateFlex = request.flexible_date ? ` <span class="text-xs text-gray-400">(flex)</span>` : '';
  return `${dateLabel}${dateFlex}`;
}

function formatRequestTimeLine(request) {
  const start = formatTimeOnly(request.start_time) || "TBD";
  const end = formatTimeOnly(request.end_time) || "TBD";
  let timeLabel = start;
  if (request.type.toLowerCase() !== 'drive') timeLabel += ` - ${end}`;
  const timeFlex = (request.flexible_start_time || request.flexible_end_time) ? ` <span class="text-xs text-gray-400">(flex)</span>` : '';
  return `${timeLabel}${timeFlex}`;
}

function renderRequestListCard(request, options = {}) {
  const bgColorClass = request.bg_color ? `bg-${String(request.bg_color).toLowerCase()}-100` : "";
  const requestsExtHtml = (typeof window !== "undefined" && (window.location.pathname || "").includes("requests"))
    ? `<div class="hidden sm:flex items-center gap-x-10">
         <div class="min-w-20 font-semibold text-green-600 whitespace-nowrap">${request.hours ? `${request.hours}` : "TBD"} hours</div>
         <div class="text-gray-800 break-words">${escapeHtml(request.notes)}</div>
       </div>`
    : "";

  return `
    <a href="/request-view.html?id=${request.id}" class="flex items-center border p-4 mb-2 rounded hover:shadow transition gap-x-10 ${bgColorClass}">
      <div class="min-w-70">
        <p class="font-semibold">${escapeHtml(request.family_name)}</p>
        <p class="font-semibold flex items-center gap-2">
          <span class="${getRequestStatusTextClass(request.status)}">${formatTitleCase(request.status)}</span>
          <span class="text-gray-800">${formatTitleCase(request.type)}</span>
        </p>
        <p class="text-sm text-gray-800">${formatRequestDateLine(request)} • ${formatRequestTimeLine(request)}</p>
      </div>
      ${requestsExtHtml}
    </a>
  `;
}

export { getRequestStatusTextClass, formatTitleCase, renderRequestListCard };
