import { formatTimeOnly } from "./utils.js";

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

function getRequestStatusTextClass(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "open") return "text-blue-600";
  if (normalized === "offered") return "text-yellow-600";
  if (normalized === "assigned") return "text-green-600";
  if (normalized === "completed") return "text-black";
  if (normalized === "cancelled" || normalized === "expired") return "text-red-600";
  return "text-gray-700";
}

function formatRequestStatusLabel(status) {
  const normalized = String(status || "unknown").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function renderRequestListCard(request, options = {}) {
  const href = options.href || `/request-view.html?id=${request.id}`;
  const statusClass = options.statusClass || getRequestStatusTextClass(request.status);
  const requestTypeLabel = formatRequestTypeLabel(request.type);
  const requestDateLine = formatRequestDateLine(request);
  const requestTimeLine = formatRequestTimeRangeLine(request);
  const familyName = request.family_name || "Unknown family";

  return `
    <a href="${href}" class="block border p-4 mb-2 rounded hover:shadow transition">
      <p class="font-semibold text-gray-600 mb-1">${familyName}</p>
      <p class="font-semibold flex items-center gap-2">
        <span class="${statusClass}">${formatRequestStatusLabel(request.status)}</span>
        <span class="text-gray-600">${requestTypeLabel}</span>
      </p>
      <p class="text-sm text-gray-600">${requestDateLine} • ${requestTimeLine}</p>
    </a>
  `;
}

export { getRequestStatusTextClass, formatRequestStatusLabel, renderRequestListCard };
