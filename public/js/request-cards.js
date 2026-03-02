function formatRequestTypeLabel(requestType) {
  const normalized = String(requestType || "").toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRequestDateLine(request) {
  const dateLabel = request.request_date
    ? new Date(`${request.request_date}T00:00:00`).toLocaleDateString()
    : "No date";
  return request.flexible_date ? `${dateLabel} (Flexible)` : dateLabel;
}

function formatTimeOnly(isoValue) {
  if (!isoValue) return "";
  return new Date(isoValue).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function formatRequestTimeRangeLine(request) {
  const start = formatTimeOnly(request.start_time);
  const end = formatTimeOnly(request.end_time);
  const timeLabel = start && end ? `${start} - ${end}` : "Time not specified";
  const timeFlexible = request.flexible_start_time || request.flexible_end_time;
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
  const href = options.href || `/request_view.html?id=${request.id}`;
  const statusClass = options.statusClass || getRequestStatusTextClass(request.status);

  return `
    <a href="${href}" class="block border p-4 mb-2 rounded hover:shadow transition">
      <p class="font-semibold ${statusClass}">${formatRequestStatusLabel(request.status)}</p>
      <p class="text-sm text-gray-600">${formatRequestTypeLabel(request.request_type)}</p>
      <p class="text-sm text-gray-600">${formatRequestDateLine(request)}</p>
      <p class="text-sm text-gray-600">${formatRequestTimeRangeLine(request)}</p>
    </a>
  `;
}

export { getRequestStatusTextClass, formatRequestStatusLabel, renderRequestListCard };
