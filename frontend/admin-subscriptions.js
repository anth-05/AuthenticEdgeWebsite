import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    checkAdminAuth();
    loadRequests();
    setupLogout();
});

/* =========================
   AUTH CHECK
========================= */
function checkAdminAuth() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    // Ensure both token exists and user is an admin
    if (!token || role !== "admin") {
        window.location.href = "login.html";
    }
}

/* =========================
   LOAD REQUESTS
========================= */
async function loadRequests() {
    const token = localStorage.getItem("token");
    const tbody = document.getElementById("sub-table-body");
    
    if (!tbody) {
        console.error("Critical Error: 'sub-table-body' not found in the DOM.");
        return;
    }

    tbody.innerHTML = `
        <tr><td colspan="5" class="loading-state">
            Checking membership queue...
        </td></tr>
    `;

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });

        if (!res.ok) throw new Error("Failed to fetch subscription requests");

        const pending = await res.json();

        if (!pending || pending.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        Membership queue is empty.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = pending.map(req => `
            <tr>
                <td>
                    <strong>${req.email}</strong>
                    <div class="muted">ID: ${req.user_id}</div>
                </td>
                <td>
                    <span class="plan-badge current">
                        ${req.current_plan || "None"}
                    </span>
                </td>
                <td>
                    <span class="plan-badge requested">
                        ${req.requested_plan || "—"}
                    </span>
                </td>
                <td>
                    <span class="status-pill pending">
                        ${req.status}
                    </span>
                </td>
                <td>
                    <button class="approve-btn" 
                        onclick="handleAction('${req.user_id}', 'approve')">
                        Approve
                    </button>
                    <button class="reject-btn" 
                        onclick="handleAction('${req.user_id}', 'reject')">
                        Decline
                    </button>
                </td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Subscription sync error:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="color: #d9534f; padding: 20px;">
                    Error loading requests. Ensure the Admin API endpoint is active.
                </td>
            </tr>
        `;
    }
}

/* =========================
   ACTION HANDLER
   (Attached to window for HTML onclick compatibility)
========================= */
window.handleAction = async (userId, action) => {
    const token = localStorage.getItem("token");
    const msg = action === "approve"
        ? "Authorize this tier change?"
        : "Decline this subscription request?";

    if (!confirm(msg)) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions/${userId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Action failed");
        }

        // Refresh the list immediately upon success
        loadRequests();

    } catch (err) {
        console.error("Action error:", err);
        alert(err.message);
    }
};

/* =========================
   LOGOUT LOGIC
========================= */
function setupLogout() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            window.logout();
        });
    }
}

window.logout = () => {
    localStorage.clear();
    window.location.href = "login.html";
};