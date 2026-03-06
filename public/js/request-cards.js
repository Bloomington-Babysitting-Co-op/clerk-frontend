import { formatTimeOnly } from "./utils.js";

function getRequestStatusTextClass(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "open") return "text-blue-600";
  if (normalized === "offered") return "text-yellow-600";
  if (normalized === "assigned") return "text-green-600";
  if (normalized === "completed") return "text-black";
  if (normalized === "cancelled" || normalized === "expired") return "text-red-600";
  return "text-gray-800";
}

function formatRequestStatusLabel(status) {
  const normalized = String(status || "unknown").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRequestTypeLabel(requestType) {
  const normalized = String(requestType || "").toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRequestDateLine(request) {
  const requestDate = request.date;
  const dateLabel = requestDate
    ? new Date(`${requestDate}T00:00:00`).toLocaleDateString()
    : "No date";
  return request.flexible_date ? `${dateLabel} (Flexible)` : dateLabel;
}

function formatRequestTimeRangeLine(request) {
  const start = formatTimeOnly(request.start_time) || "TBD";
  const end = formatTimeOnly(request.end_time) || "TBD";
  const timeFlexible = request.flexible_start_time || request.flexible_end_time;
  const timeLabel = `${start} - ${end}`;
  return timeFlexible ? `${timeLabel} (Flexible)` : timeLabel;
}

function renderRequestListCard(request, options = {}) {
  const requestsExtHtml = (typeof window !== "undefined" && (window.location.pathname || "").includes("requests"))
    ? `<div class="hidden sm:flex items-center gap-x-10">
         <div class="font-semibold text-green-600 whitespace-nowrap">${request.hours ? `${request.hours}` : "TBD"} hours</div>
         <div class="text-gray-800 break-words">${request.notes}</div>
       </div>`
    : "";

  return `
    <a href="/request-view.html?id=${request.id}" class="flex items-center border p-4 mb-2 rounded hover:shadow transition gap-x-10">
      <div class="min-w-0">
        <p class="font-semibold">${request.family_name}</p>
        <p class="font-semibold flex items-center gap-2">
          <span class="${getRequestStatusTextClass(request.status)}">${formatRequestStatusLabel(request.status)}</span>
          <span class="text-gray-800">${formatRequestTypeLabel(request.type)}</span>
        </p>
        <p class="text-sm text-gray-800">${formatRequestDateLine(request)} • ${formatRequestTimeRangeLine(request)}</p>
      </div>
      ${requestsExtHtml}
    </a>
  `;
}

export { getRequestStatusTextClass, formatRequestStatusLabel, renderRequestListCard };
