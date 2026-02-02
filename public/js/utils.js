export function formatDateTime(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleString();
}
