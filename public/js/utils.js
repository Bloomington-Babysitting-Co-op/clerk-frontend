import { supabase } from "/js/supabase.js";

const ADMIN_STORAGE_KEY = "bbc_clerk_admin_enabled";
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

export function setAdminEnabled(value) {
  if (value) {
    window.sessionStorage.setItem(ADMIN_STORAGE_KEY, "true");
  } else {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  }
}

export function isAdminEnabled() {
  return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) === "true";
}

export async function hasAdminPrivileges(forceRefresh = false) {
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

export async function isAdminUiEnabled() {
  const hasPrivileges = await hasAdminPrivileges();
  return hasPrivileges && isAdminEnabled();
}

export async function setupNavbar(containerId) {
  try {
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container with id "${containerId}" not found`);
      return;
    }

    const hasPrivileges = await hasAdminPrivileges();
    const showAdminUi = hasPrivileges && isAdminEnabled();
    const navbarColorClass = showAdminUi ? "bg-rose-900" : "bg-indigo-600";

    const adminToggleButtonHtml = hasPrivileges
      ? `
          <button
            id="navbar-admin-toggle"
            type="button"
            aria-pressed="${showAdminUi ? "true" : "false"}"
            class="${showAdminUi ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-white text-blue-600 hover:bg-blue-300"} p-2 rounded"
            title="Toggle admin mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10" aria-hidden="true">
              <path fill-rule="evenodd" d="M11.49 3.17c.38-1.56 2.63-1.56 3.01 0a1.53 1.53 0 0 0 2.29.95c1.36-.8 2.95.79 2.15 2.15a1.53 1.53 0 0 0 .95 2.29c1.56.38 1.56 2.63 0 3.01a1.53 1.53 0 0 0-.95 2.29c.8 1.36-.79 2.95-2.15 2.15a1.53 1.53 0 0 0-2.29.95c-.38 1.56-2.63 1.56-3.01 0a1.53 1.53 0 0 0-2.29-.95c-1.36.8-2.95-.79-2.15-2.15a1.53 1.53 0 0 0-.95-2.29c-1.56-.38-1.56-2.63 0-3.01a1.53 1.53 0 0 0 .95-2.29c-.8-1.36.79-2.95 2.15-2.15a1.53 1.53 0 0 0 2.29-.95ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
            </svg>
          </button>
        `
      : "";

    const navbarHTML = `
      <nav class="${navbarColorClass} text-white shadow">
        <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <a href="/" class="bg-white text-blue-600 hover:bg-blue-300 p-2 rounded" title="Go to dashboard">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10" aria-hidden="true">
                <path d="M10.55 2.53a2.25 2.25 0 0 1 2.9 0l7.5 6.5a2.25 2.25 0 0 1-1.48 3.97h-.22V19.5A2.5 2.5 0 0 1 16.75 22h-2.5a.75.75 0 0 1-.75-.75V17a.75.75 0 0 0-.75-.75h-1.5A.75.75 0 0 0 10.5 17v4.25a.75.75 0 0 1-.75.75h-2.5a2.5 2.5 0 0 1-2.5-2.5V13h-.22a2.25 2.25 0 0 1-1.48-3.97l7.5-6.5Z" />
              </svg>
            </a>
            <a href="/" class="text-xl font-bold">BBC Clerk</a>
            ${adminToggleButtonHtml}
          </div>
          <div class="flex gap-2 items-center">
            <a href="/requests.html" class="bg-white text-blue-600 hover:bg-blue-300 px-4 py-2 rounded">Requests</a>
            <a href="/ledger.html" class="bg-white text-blue-600 hover:bg-blue-300 px-4 py-2 rounded">Ledger</a>
            <a href="/families.html" class="bg-white text-blue-600 hover:bg-blue-300 px-4 py-2 rounded">Families</a>
          </div>
        </div>
      </nav>
    `;

    container.innerHTML = navbarHTML;

    const adminToggleButton = container.querySelector("#navbar-admin-toggle");
    if (adminToggleButton) {
      adminToggleButton.addEventListener("click", () => {
        setAdminEnabled(!isAdminEnabled());
        window.location.reload();
      });
    }
  } catch (error) {
    console.error("Error setting up navbar:", error);
  }
}
