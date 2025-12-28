import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
  loadDashboardData();
  setupLogout();
});

/* =========================
   AUTH CHECK
========================= */
function checkAdminAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token || role !== "admin") {
    window.location.href = "login.html";
  }
}

/* =========================
   DASHBOARD DATA
========================= */
async function loadDashboardData() {
  const token = localStorage.getItem("token");

  try {
    const [usersRes, statsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${API_BASE_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    if (!usersRes.ok || !statsRes.ok) {
      logout();
      return;
    }

    const users = await usersRes.json();
    const stats = await statsRes.json();

    updateStatsUI(stats);
    renderUserTables(users);

  } catch (err) {
    console.error("Admin dashboard load failed:", err);
  }
}

/* =========================
   STATS UI
========================= */
function updateStatsUI(stats) {
  document.getElementById("user-count").textContent = stats.users || 0;
  document.getElementById("admin-count").textContent = stats.admins || 0;
  document.getElementById("regular-count").textContent = stats.regularUsers || 0;
}
/* =========================
   USERS TABLES
========================= */
function renderUserTables(users) {
  const recent = document.querySelector("#recent-users tbody");
  const all = document.querySelector("#all-users tbody");

  // 1. Recent Users Table (Last 5)
  if (recent) {
    recent.innerHTML = users
      .slice(-5)
      .reverse()
      .map(u => `
        <tr>
          <td data-label="Email">${u.email}</td>
          <td data-label="Role"><span class="admin-badge">${u.role}</span></td>
          <td data-label="Registered At">${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
      `).join("");
  }

  // 2. Manage Users Table (All)
  if (all) {
    all.innerHTML = users.map(u => {
      // PLAN LOGIC
      const currentPlan = u.current_plan || "NO ACTIVE SUB";
      const requestedPlan = u.requested_plan;
      const subStatus = (u.status || "none").toLowerCase();

      // Determine if there is a pending request to display
      const requestBadge = (requestedPlan && requestedPlan !== "None") 
        ? `<div style="font-size: 0.6rem; color: #d00000; margin-top: 5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
             PENDING: ${requestedPlan}
           </div>` 
        : "";

      return `
        <tr>
          <td data-label="User ID">#${u.id}</td>
          <td data-label="Email">
            <strong>${u.email}</strong>
            <div style="font-size: 0.6rem; color: #999; margin-top: 2px;">Joined: ${new Date(u.created_at).toLocaleDateString()}</div>
          </td>
          <td data-label="Subscription">
            <span class="status-pill ${subStatus}" 
                  style="display: inline-block; padding: 4px 10px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 2px; 
                         background: ${subStatus === 'active' ? '#000' : '#eeeeee'}; 
                         color: ${subStatus === 'active' ? '#fff' : '#888888'};">
              ${currentPlan}
            </span>
            ${requestBadge}
          </td>
          <td data-label="Role">
            <select onchange="updateUserRole(${u.id}, this.value)" style="padding: 6px; font-size: 0.75rem; font-family: inherit; border: 1px solid #eeeeee; background: #fff; cursor: pointer;">
              <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </td>
          <td data-label="Actions">
            <div style="display: flex; justify-content: center; align-items: center;">
                <button onclick="deleteUser(${u.id})" class="delete-x" title="Delete User">×</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }
}
/* =========================
   ACTIONS
========================= */
window.updateUserRole = async (id, role) => {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ role })
    });

    if (res.ok) {
        loadDashboardData();
    }
  } catch (err) {
    console.error("Failed to update role:", err);
  }
};

window.deleteUser = async (id) => {
  if (!confirm("Permanently remove this user? This cannot be undone.")) return;
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
        loadDashboardData();
    }
  } catch (err) {
    console.error("Failed to delete user:", err);
  }
};