import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
  loadDashboard();
  setupProductForm();
});

/**
 * Security: Immediate check for token and role
 */
function checkAdminAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token || role !== "admin") {
    window.location.href = "login.html";
  }
}

/**
 * Main Dashboard Loader
 */
async function loadDashboardData() {
    try {
        const data = await apiRequest("/api/admin/users"); // Calls the route we just added
        
        // Update Stats Counters
        document.getElementById("total-users").textContent = data.stats.totalUsers;
        document.getElementById("admin-users").textContent = data.stats.adminUsers;
        document.getElementById("regular-users").textContent = data.stats.regularUsers;

        // Populate Tables (Recent and Manage)
        renderUserTables(data.users);
    } catch (err) {
        console.error("Dashboard sync failed:", err);
    }
}

/**
 * UI: Render top 5 newest users
 */
function renderRecentUsers(users) {
  const recentTbody = document.querySelector("#recent-users tbody");
  if (!recentTbody) return;

  recentTbody.innerHTML = users.slice(0, 5).map(u => `
    <tr>
      <td><strong>${u.email}</strong></td>
      <td><span class="role-badge">${u.role}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
    </tr>
  `).join("");
}

/**
 * UI: Render full management table
 */
function renderAllUsers(users) {
  const manageTbody = document.querySelector("#all-users tbody");
  if (!manageTbody) return;

  manageTbody.innerHTML = users.map(u => `
    <tr>
      <td>#${u.id}</td>
      <td>${u.email}</td>
      <td>
        <select class="editorial-select" onchange="window.updateUserRole(${u.id}, this.value)">
          <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td>
        <button class="text-link-btn" onclick="window.deleteUser(${u.id})">Remove</button>
      </td>
    </tr>
  `).join("");
}

/**
 * Action: Change user role (Globally scoped for HTML access)
 */
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
    if (res.ok) loadDashboard();
  } catch (error) {
    console.error("Role update failed:", error);
  }
};

/**
 * Action: Delete user (Globally scoped for HTML access)
 */
window.deleteUser = async (id) => {
  if (!confirm("Are you sure? This user will be permanently removed.")) return;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) loadDashboard();
  } catch (error) {
    console.error("Delete failed:", error);
  }
};

/**
 * Action: Handle Product Form (Multipart for Image Support)
 */
function setupProductForm() {
  const form = document.getElementById("product-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    
    // We use FormData to handle the file upload correctly
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData // Note: No 'Content-Type' header, browser sets it automatically for FormData
      });

      if (res.ok) {
        alert("Product added to collection.");
        form.reset();
        if (typeof loadProducts === "function") loadProducts(); // Refresh product list if on same page
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add product.");
      }
    } catch (error) {
      console.error("Network error adding product:", error);
    }
  });
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}