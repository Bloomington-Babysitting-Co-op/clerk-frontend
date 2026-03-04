import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";
import { getCheckedValue, getInputValue, isAdminUiEnabled, setInputValue, setStatusText, toDateOnlyString } from "./utils.js";

let familiesCache = [];
let usersCache = [];

function familyOptionsHtml(selectedFamilyId = "") {
	return familiesCache
		.map((family) => `<option value="${family.id}" ${family.id === selectedFamilyId ? "selected" : ""}>${family.name || family.id}</option>`)
		.join("");
}

function renderFamilies() {
	const listEl = document.getElementById("families-admin-families-list");
	if (!listEl) return;

	if (!familiesCache.length) {
		listEl.innerHTML = "<p class='text-sm text-gray-600'>No families found.</p>";
		return;
	}

	listEl.innerHTML = familiesCache.map((family) => `
		<article class="border rounded p-4 bg-gray-50 space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 class="font-semibold text-lg">${family.name || "Unnamed family"}</h3>
				<span class="text-xs text-gray-600">Members: ${family.member_count ?? 0}</span>
			</div>
			<div class="grid md:grid-cols-3 gap-3">
				<label class="text-sm"><input id="family-active-${family.id}" type="checkbox" class="mr-2" ${family.is_active ? "checked" : ""}>Active</label>
				<label class="text-sm"><input id="family-admin-${family.id}" type="checkbox" class="mr-2" ${family.is_admin ? "checked" : ""}>Admin</label>
			</div>
			<div class="grid md:grid-cols-3 gap-3">
				<div>
					<label class="text-sm block mb-1">Date Joined</label>
					<input id="family-date-joined-${family.id}" type="date" class="border rounded p-2 w-full" value="${toDateOnlyString(family.admin_date_joined)}">
				</div>
				<div>
					<label class="text-sm block mb-1">Last Background Check</label>
					<input id="family-last-background-check-${family.id}" type="date" class="border rounded p-2 w-full" value="${toDateOnlyString(family.admin_last_background_check)}">
				</div>
				<div>
					<label class="text-sm block mb-1">Last Dues Payment</label>
					<input id="family-last-dues-payment-${family.id}" type="date" class="border rounded p-2 w-full" value="${toDateOnlyString(family.admin_last_dues_payment)}">
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				<button data-family-save="${family.id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">Save Family</button>
				<button data-family-delete="${family.id}" class="bg-red-600 text-white px-3 py-2 rounded text-sm ${family.can_delete ? "" : "opacity-50 cursor-not-allowed"}" ${family.can_delete ? "" : "disabled"}>Delete Family</button>
			</div>
		</article>
	`).join("");

	listEl.querySelectorAll("[data-family-save]").forEach((button) => {
		button.addEventListener("click", async () => {
			const familyId = button.getAttribute("data-family-save");
			await saveFamily(familyId);
		});
	});

	listEl.querySelectorAll("[data-family-delete]").forEach((button) => {
		button.addEventListener("click", async () => {
			const familyId = button.getAttribute("data-family-delete");
			if (!familyId) return;
			if (!window.confirm("Delete this family and linked users? This only works for eligible families.")) return;
			await deleteFamily(familyId);
		});
	});
}

function renderUsers() {
	const listEl = document.getElementById("families-admin-users-list");
	if (!listEl) return;

	if (!usersCache.length) {
		listEl.innerHTML = "<p class='text-sm text-gray-600'>No users found.</p>";
		return;
	}

	listEl.innerHTML = usersCache.map((user) => `
		<article class="border rounded p-4 bg-gray-50 space-y-2">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="font-medium">${user.email || user.user_id}</p>
				<span class="text-xs ${user.family_is_active ? "text-green-700" : "text-red-700"}">${user.family_is_active ? "Family active" : "Family inactive"}</span>
			</div>
			<div class="grid md:grid-cols-[1fr_auto_auto] gap-2 items-center">
				<select id="user-family-${user.user_id}" class="border rounded p-2">${familyOptionsHtml(user.family_id)}</select>
				<button data-user-move="${user.user_id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">Save Family</button>
				<button data-user-delete="${user.user_id}" class="bg-red-600 text-white px-3 py-2 rounded text-sm ${user.can_delete ? "" : "opacity-50 cursor-not-allowed"}" ${user.can_delete ? "" : "disabled"}>Delete User</button>
			</div>
		</article>
	`).join("");

	listEl.querySelectorAll("[data-user-move]").forEach((button) => {
		button.addEventListener("click", async () => {
			const userId = button.getAttribute("data-user-move");
			await saveUserFamily(userId);
		});
	});

	listEl.querySelectorAll("[data-user-delete]").forEach((button) => {
		button.addEventListener("click", async () => {
			const userId = button.getAttribute("data-user-delete");
			if (!userId) return;
			if (!window.confirm("Delete this user? This only works when their family is eligible for deletion.")) return;
			await deleteUser(userId);
		});
	});
}

async function loadFamilies() {
	const { data, error } = await supabase.rpc("rpc_admin_list_families");
	if (error) throw error;
	familiesCache = Array.isArray(data) ? data : [];
	renderFamilies();

	const familySelect = document.getElementById("families-admin-new-user-family");
	if (familySelect) {
		familySelect.innerHTML = familyOptionsHtml();
	}
}

async function loadUsers() {
	const { data, error } = await supabase.rpc("rpc_admin_list_users");
	if (error) throw error;
	usersCache = Array.isArray(data) ? data : [];
	renderUsers();
}

async function refreshAll() {
	await loadFamilies();
	await loadUsers();
}

async function saveFamily(familyId) {
	if (!familyId) return;

	const payload = {
		p_family_id: familyId,
		p_is_active: getCheckedValue(`family-active-${familyId}`),
		p_is_admin: getCheckedValue(`family-admin-${familyId}`),
		p_admin_date_joined: getInputValue(`family-date-joined-${familyId}`) || null,
		p_admin_last_background_check: getInputValue(`family-last-background-check-${familyId}`) || null,
		p_admin_last_dues_payment: getInputValue(`family-last-dues-payment-${familyId}`) || null
	};

	const { error } = await supabase.rpc("rpc_admin_update_family", payload);
	if (error) {
		setStatusText("families-admin-families-status", error.message, true);
		return;
	}

	setStatusText("families-admin-families-status", "Family updated.");
	await refreshAll();
}

async function deleteFamily(familyId) {
	const { error } = await supabase.rpc("rpc_admin_delete_family", { p_family_id: familyId });
	if (error) {
		setStatusText("families-admin-families-status", error.message, true);
		return;
	}

	setStatusText("families-admin-families-status", "Family deleted.");
	await refreshAll();
}

async function saveUserFamily(userId) {
	if (!userId) return;
	const familySelect = document.getElementById(`user-family-${userId}`);
	const familyId = familySelect?.value;

	const { error } = await supabase.rpc("rpc_admin_update_user_family", {
		p_user_id: userId,
		p_family_id: familyId
	});

	if (error) {
		setStatusText("families-admin-users-status", error.message, true);
		return;
	}

	setStatusText("families-admin-users-status", "User family updated.");
	await refreshAll();
}

async function deleteUser(userId) {
	const { error } = await supabase.rpc("rpc_admin_delete_user", { p_user_id: userId });
	if (error) {
		setStatusText("families-admin-users-status", error.message, true);
		return;
	}

	setStatusText("families-admin-users-status", "User deleted.");
	await refreshAll();
}

async function wireCreateFamily() {
	const createFamilyBtn = document.getElementById("families-admin-create-family-btn");
	if (!createFamilyBtn) return;

	createFamilyBtn.onclick = async () => {
		const name = getInputValue("families-admin-new-family-name").trim();
		if (!name) {
			setStatusText("families-admin-family-create-status", "Family name is required.", true);
			return;
		}

		const { error } = await supabase.rpc("rpc_admin_create_family", { p_name: name });
		if (error) {
			setStatusText("families-admin-family-create-status", error.message, true);
			return;
		}

		setInputValue("families-admin-new-family-name", "");
		setStatusText("families-admin-family-create-status", "Family created.");
		await refreshAll();
	};
}

async function wireCreateUser() {
	const createUserBtn = document.getElementById("families-admin-create-user-btn");
	if (!createUserBtn) return;

	createUserBtn.onclick = async () => {
		const email = getInputValue("families-admin-new-user-email").trim();
		const password = getInputValue("families-admin-new-user-password");
		const name = getInputValue("families-admin-new-user-name").trim();
		const phone = getInputValue("families-admin-new-user-phone").trim();
		const familyId = getInputValue("families-admin-new-user-family");

		if (!email || !password || !familyId) {
			setStatusText("families-admin-user-create-status", "Email, password, and family are required.", true);
			return;
		}

		const { error } = await supabase.rpc("rpc_admin_create_user", {
			p_email: email,
			p_password: password,
			p_family_id: familyId,
			p_name: name || null,
			p_phone: phone || null
		});

		if (error) {
			setStatusText("families-admin-user-create-status", error.message, true);
			return;
		}

		setInputValue("families-admin-new-user-email", "");
		setInputValue("families-admin-new-user-password", "");
		setInputValue("families-admin-new-user-name", "");
		setInputValue("families-admin-new-user-phone", "");
		setStatusText("families-admin-user-create-status", "User created.");
		await refreshAll();
	};
}

async function mountFamiliesAdminPage() {
	await requireAuth();

	const showAdminUi = await isAdminUiEnabled();
	if (!showAdminUi) {
		window.location.href = "/profile.html";
		return;
	}

	await wireCreateFamily();
	await wireCreateUser();
	await refreshAll();
}

export { mountFamiliesAdminPage };
