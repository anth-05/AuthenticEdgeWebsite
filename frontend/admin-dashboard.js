import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    // Check Auth first
    checkAdminAuth();
    
    // Load Data
    loadDashboardData();
    
    // Setup Product Form
    const productForm = document.getElementById("product-form");
    if (productForm) {
        productForm.addEventListener("submit", handleAddProduct);
    }
});

/**
 * Security Gate
 */
function checkAdminAuth() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
        window.location.href = "login.html";
    }
}

/**
 * Orchestrator: Loads stats and users in parallel
 */
async function loadDashboardData() {
    const token = localStorage.getItem("token");

    try {
        const [statsRes, usersRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_BASE_URL}/api/users`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);

        if (statsRes.status === 401 || usersRes.status === 401) {
            logout();
            return;
        }

        const stats = await statsRes.json();
        const users = await usersRes.json();

        updateStatsUI(stats);
        renderUserTables(users);

    } catch (error) {
        console.error("Dashboard Sync Error:", error);
    }
}

/**
 * UI Updates: Stats Cards
 */
function updateStatsUI(data) {
    // Matches the IDs from our editorial dashboard layout
    const totalU = document.getElementById("user-count") || document.getElementById("totalUsers");
    const totalA = document.getElementById("admin-count") || document.getElementById("totalAdmins");
    const totalR = document.getElementById("regular-count") || document.getElementById("totalRegularUsers");

    if (totalU) totalU.textContent = data.users;
    if (totalA) totalA.textContent = data.admins;
    if (totalR) totalR.textContent = data.regularUsers;
}

/**
 * UI Updates: Tables
 */
function renderUserTables(users) {
    const recentTbody = document.querySelector("#recent-users tbody");
    const allUsersTbody = document.querySelector("#all-users tbody");

    // 1. Recent Users (Top 5)
    if (recentTbody) {
        recentTbody.innerHTML = users.slice(0, 5).map(u => `
            <tr>
                <td><strong>${u.email}</strong></td>
                <td><span class="status-badge">${u.role}</span></td>
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
                    <select class="editorial-select" onchange="window.updateUserRole(${u.id}, this.value)">
                        <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                </td>
                <td>
                    <button class="delete-link" onclick="window.deleteUser(${u.id})">Remove</button>
                </td>
            </tr>
        `).join('');
    }
}

/**
 * Actions: Role Update
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

        if (res.ok) loadDashboardData();
    } catch (error) {
        console.error("Role update failed:", error);
    }
};

/**
 * Actions: Delete User
 */
window.deleteUser = async (id) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) loadDashboardData();
    } catch (error) {
        console.error("Deletion failed:", error);
    }
};

/**
 * Actions: Product Upload
 */
async function handleAddProduct(event) {
    event.preventDefault();
    const token = localStorage.getItem("token");
    const formData = new FormData(event.target);

    // If your HTML names are different from the keys expected by the server, 
    // the server.js we just built expects: name, description, gender, quality, availability
    // and a file field named "imageFile"

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            alert("Product Added");
            event.target.reset();
        }
    } catch (error) {
        console.error("Product upload error:", error);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}