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
    
    if (!tbody) return;

    tbody.innerHTML = `
        <tr><td colspan="5" class="loading-state" style="text-align:center; padding: 40px; font-size: 0.8rem; letter-spacing: 0.1em; color: #999;">
            SYNCING MEMBERSHIP QUEUE...
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
                    <td colspan="5" class="empty-state" style="text-align:center; padding: 40px; color: #999; font-size: 0.8rem;">
                        NO PENDING AUTHORIZATIONS.
                    </td>
                </tr>
            `;
            return;
        }

        // Mapping rows with data-label for Mobile Card Support
        tbody.innerHTML = pending.map(req => `
            <tr>
                <td data-label="User Identity">
                    <div style="text-align: left;">
                        <strong style="display: block; font-size: 0.9rem;">${req.email}</strong>
                        <span style="font-size: 0.7rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em;">UID: ${req.user_id}</span>
                    </div>
                </td>
                <td data-label="Current Tier">
                    <span class="status" style="border-color: #eee; color: #666;">
                        ${req.current_plan || "None"}
                    </span>
                </td>
                <td data-label="Requested Tier">
                    <span class="status approved" style="background: #000; color: #fff; border: none;">
                        ${req.requested_plan || "—"}
                    </span>
                </td>
                <td data-label="Status">
                    <span class="status pending">
                        ${req.status.toUpperCase()}
                    </span>
                </td>
                <td data-label="Actions">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="approve-btn" 
                            onclick="handleAction('${req.user_id}', 'approve')">
                            Approve
                        </button>
                        <button class="reject-btn" 
                            onclick="handleAction('${req.user_id}', 'reject')">
                            Decline
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Subscription sync error:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="color: #000; text-align: center; padding: 40px; font-size: 0.75rem; font-weight: 700;">
                    SYSTEM ERROR: UNABLE TO LOAD QUEUE.
                </td>
            </tr>
        `;
    }
}

/* =========================
   ACTION HANDLER
========================= */
window.handleAction = async (userId, action) => {
    const token = localStorage.getItem("token");
    const msg = action === "approve"
        ? "Authorize this membership upgrade?"
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

        // Success refresh
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
            localStorage.clear();
            window.location.href = "login.html";
        });
    }
}