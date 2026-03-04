import { supabase } from "/js/supabase.js";

let adminStatusCache = null;

export function monthValueFromDate(value) {
  if (!value) return "";
  return String(value).slice(0, 7);
}

export function formatDateTime(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleString();
}

export function formatTimeOnly(timeValue) {
  if (!timeValue) return "";
  const inputValue = toTimeInputValue(timeValue);
  if (!inputValue) return "";
  const date = new Date(`1970-01-01T${inputValue}:00`);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export function toNullableDate(value) {
  return value || null;
}

export function toDateOnlyString(value) {
  if (!value) return "";
  const asString = String(value);
  const isoMatch = asString.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return asString;
  return toDateInputValue(parsed);
}

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function toMinutes(timeValue) {
  const match = String(timeValue || "").match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

export function calculateHours(startTimeValue, endTimeValue) {
  const startMinutes = toMinutes(startTimeValue);
  const endMinutes = toMinutes(endTimeValue);
  if (startMinutes == null || endMinutes == null) return null;

  const minutesDiff = endMinutes - startMinutes;
  if (minutesDiff <= 0) return null;

  const quarterHours = Math.ceil(minutesDiff / 15);
  return quarterHours * 0.25;
}

export function toNumberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundUpToQuarter(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil(parsed * 4) / 4;
}

export function normalizeQuarterHoursInput(input) {
  if (!input) return;
  const raw = input.value;
  if (raw == null || raw === "") return;
  const rounded = roundUpToQuarter(raw);
  if (rounded == null) return;
  input.value = rounded.toFixed(2);
}

export function toCsvValue(value) {
  const asString = value == null ? "" : String(value);
  if (asString.includes(",") || asString.includes("\"") || asString.includes("\n")) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

export function downloadCsv(filename, rows) {
  const content = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function formatValidationErrors(errors) {
  if (!Array.isArray(errors)) return "";
  const values = errors.filter(Boolean);
  return values.map((error) => `• ${error}`).join("\n");
}

export function setFormError(target, messageOrErrors = "") {
  const element = typeof target === "string" ? document.getElementById(target) : target;
  if (!element) return;

  const message = Array.isArray(messageOrErrors)
    ? formatValidationErrors(messageOrErrors)
    : (messageOrErrors || "");

  element.textContent = message;
  if (message.includes("\n")) {
    element.classList.add("whitespace-pre-line");
  } else {
    element.classList.remove("whitespace-pre-line");
  }
}

export function setStatusText(target, message = "", isError = false) {
  const element = typeof target === "string" ? document.getElementById(target) : target;
  if (!element) return;
  element.textContent = message || "";
  element.className = isError ? "text-sm text-red-600 whitespace-pre-line" : "text-sm text-gray-700";
}

export function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}

export function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value ?? "";
  }
}

export function getCheckedValue(id) {
  const element = document.getElementById(id);
  return !!element?.checked;
}

export function setCheckedValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.checked = !!value;
  }
}

export function getAgeLabel(dateOfBirthValue) {
  if (!dateOfBirthValue) return "";

  const dateOfBirth = new Date(dateOfBirthValue);
  if (Number.isNaN(dateOfBirth.getTime())) return "";

  const today = new Date();
  let years = today.getFullYear() - dateOfBirth.getFullYear();
  let months = today.getMonth() - dateOfBirth.getMonth();

  if (today.getDate() < dateOfBirth.getDate()) {
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

export async function hasAdmin(forceRefresh = false) {
  if (!forceRefresh && adminStatusCache != null) {
    return adminStatusCache;
  }

  const { data, error } = await supabase.rpc("rpc_get_admin_status");
  if (error) {
    adminStatusCache = false;
    return false;
  }

  adminStatusCache = !!data;
  return adminStatusCache;
}

export async function setupNavbar(containerId) {
  try {
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container with id "${containerId}" not found`);
      return;
    }

    const adminBtn = await hasAdmin()
      ? `<a href="/admin.html" class="bg-red-600 text-white hover:bg-red-300 px-4 py-2 rounded">Admin</a>`
      : "";

    const navbarHTML = `
      <nav class="bg-indigo-600 text-white shadow">
        <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <a href="/" class="bg-white text-indigo-600 text-2xl font-bold hover:bg-blue-300 px-4 py-1 rounded" title="Go to dashboard">BBC Clerk</a>
          </div>
          <div class="flex gap-2 items-center">
            <a href="/requests.html" class="bg-white text-blue-600 hover:bg-blue-300 px-4 py-2 rounded">Requests</a>
            <a href="/ledger.html" class="bg-white text-blue-600 hover:bg-blue-300 px-4 py-2 rounded">Ledger</a>
            <a href="/families.html" class="bg-white text-blue-600 hover:bg-blue-300 px-4 py-2 rounded">Families</a>
            ${adminBtn}
          </div>
        </div>
      </nav>
    `;

    container.innerHTML = navbarHTML;
  } catch (error) {
    console.error("Error setting up navbar:", error);
  }
}
