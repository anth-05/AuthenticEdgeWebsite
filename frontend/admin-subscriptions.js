import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    checkAdminAuth();
    loadRequests();
});

/**
 * Security & Auth check
 */
function checkAdminAuth() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
        window.location.href = "login.html";
    }
}

/**
 * Load and Render Pending Requests
 */
async function loadRequests() {
    const token = localStorage.getItem("token");
    const tbody = document.getElementById("sub-table-body");
    
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='5' class='loading-state'>Checking membership queue...</td></tr>";

    try {
        // The backend /api/admin/subscriptions already filters for 'pending'
        const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to sync requests.");

        const pending = await res.json();

        if (pending.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <p>The membership queue is currently empty.</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = pending.map(req => `
            <tr>
                <td>
                    <div class="user-cell">
                        <strong>${req.email}</strong>
                        <small>ID: ${req.user_id}</small>
                    </div>
                </td>
                <td><span class="plan-badge current">${req.current_plan || "None"}</span></td>
                <td><span class="plan-badge requested">${req.requested_plan}</span></td>
                <td><span class="status-pill pending">${req.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="approve-btn" onclick="window.handleAction(${req.user_id}, 'approve')">Approve</button>
                        <button class="reject-btn" onclick="window.handleAction(${req.user_id}, 'reject')">Decline</button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("❌ Subscription load error:", err);
        tbody.innerHTML = `<tr><td colspan="5">Error: ${err.message}</td></tr>`;
    }
}

/**
 * Handle Approval/Rejection Action
 */
window.handleAction = async (userId, action) => {
    const token = localStorage.getItem("token");
    const confirmMsg = action === 'approve' 
        ? "Grant membership to this user?" 
        : "Decline this membership request?";

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions/${userId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action }) 
        });

        if (res.ok) {
            // Smoothly refresh the table
            loadRequests();
        } else {
            const errorData = await res.json();
            alert(`Error: ${errorData.error || "Action failed"}`);
        }
    } catch (err) {
        console.error(`❌ Failed to ${action}:`, err);
    }
};

/**
 * Logout utility
 */
window.logout = () => {
    localStorage.clear();
    window.location.href = "login.html";
};