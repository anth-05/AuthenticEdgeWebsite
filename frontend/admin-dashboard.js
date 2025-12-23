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

  recent.innerHTML = users
    .slice(-5)
    .reverse()
    .map(u => `
      <tr>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
      </tr>
    `).join("");

  all.innerHTML = users.map(u => `
    <tr>
      <td>#${u.id}</td>
      <td>${u.email}</td>
      <td>
        <select onchange="updateUserRole(${u.id}, this.value)">
          <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td>
        <button onclick="deleteUser(${u.id})" style="color:red;">Remove</button>
      </td>
    </tr>
  `).join("");
}

/* =========================
   ACTIONS
========================= */
window.updateUserRole = async (id, role) => {
  const token = localStorage.getItem("token");

  await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ role })
  });

  loadDashboardData();
};

window.deleteUser = async (id) => {
  if (!confirm("Delete this user permanently?")) return;
  const token = localStorage.getItem("token");

  await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  loadDashboardData();
};

/* =========================
   LOGOUT
========================= */
function setupLogout() {
  document.querySelectorAll("#logout-btn").forEach(btn =>
    btn.addEventListener("click", logout)
  );
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
