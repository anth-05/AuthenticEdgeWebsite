import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Security check
    checkAdminAuth();
    
    // 2. Load Stats and User Data
    loadDashboardData();
    
    // 3. Setup Product Form (if exists on this page)
    const productForm = document.getElementById("product-form");
    if (productForm) {
        productForm.addEventListener("submit", handleAddProduct);
    }

    // 4. Setup Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
});

/**
 * Security Gate: Immediate check for token and role
 */
function checkAdminAuth() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
        window.location.href = "login.html";
    }
}

/**
 * Orchestrator: Fetches stats and user list
 * Note: server.js uses /api/admin/users for the dashboard data
 */
async function loadDashboardData() {
    const token = localStorage.getItem("token");

    try {
        // We use the specific admin route that returns stats AND users in one go
        const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
            logout();
            return;
        }

        const data = await res.json();

        // data structure from server.js: { stats: {...}, users: [...] }
        updateStatsUI(data.stats);
        renderUserTables(data.users);

    } catch (error) {
        console.error("Dashboard Sync Error:", error);
    }
}

/**
 * UI Updates: Stats Cards
 * Matches IDs in admin-dashboard.html: user-count, admin-count, regular-count
 */
function updateStatsUI(stats) {
    const totalU = document.getElementById("user-count");
    const totalA = document.getElementById("admin-count");
    const totalR = document.getElementById("regular-count");

    if (totalU) totalU.textContent = stats.totalUsers || 0;
    if (totalA) totalA.textContent = stats.adminUsers || 0;
    if (totalR) totalR.textContent = stats.regularUsers || 0;
}

/**
 * UI Updates: Tables
 */
function renderUserTables(users) {
    const recentTbody = document.querySelector("#recent-users tbody");
    const allUsersTbody = document.querySelector("#all-users tbody");

    // 1. Recent Users (Latest 5 based on created_at)
    if (recentTbody) {
        recentTbody.innerHTML = users
            .slice(-5) // Get last 5
            .reverse() // Newest first
            .map(u => `
                <tr>
                    <td><strong>${u.email}</strong></td>
                    <td><span class="admin-badge">${u.role}</span></td>
                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
    }

    // 2. Management Table
    if (allUsersTbody) {
        allUsersTbody.innerHTML = users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td>${u.email}</td>
                <td>
                    <select class="action-btn" onchange="window.updateUserRole(${u.id}, this.value)">
                        <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                </td>
                <td>
                    <button class="delete-btn" onclick="window.deleteUser(${u.id})" style="color: red; border: none; background: none; cursor: pointer;">Remove</button>
                </td>
            </tr>
        `).join('');
    }
}

/**
 * Action: Delete User
 * Route matches server.js: DELETE /api/admin/users/:id
 */
window.deleteUser = async (id) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            loadDashboardData(); // Refresh UI
        } else {
            alert("Failed to delete user.");
        }
    } catch (error) {
        console.error("Deletion failed:", error);
    }
};

/**
 * Action: Handle Product Form (Multipart for Image Support)
 */
async function handleAddProduct(event) {
    event.preventDefault();
    const token = localStorage.getItem("token");
    const formData = new FormData(event.target);

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData // Browser sets content-type to multipart/form-data automatically
        });

        if (res.ok) {
            alert("Product successfully published to collection.");
            event.target.reset();
        } else {
            const err = await res.json();
            alert(err.error || "Upload failed.");
        }
    } catch (error) {
        console.error("Product upload error:", error);
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "login.html";
}