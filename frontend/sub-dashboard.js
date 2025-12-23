import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    loadSubscription();
});

/**
 * Security: Ensure user is logged in
 */
function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
    }
}

/**
 * Fetch and Render Subscription Details
 */
async function loadSubscription() {
    const token = localStorage.getItem("token");
    const container = document.querySelector(".subscription-card"); // Assuming your container class

    try {
        const res = await fetch(`${API_BASE_URL}/api/subscription`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Could not retrieve membership data.");

        const data = await res.json();

        // 1. Update Text Content
        const planEl = document.getElementById("current-plan");
        const reqEl = document.getElementById("requested-plan");
        const statusEl = document.getElementById("sub-status");

        if (planEl) planEl.textContent = data.current_plan || "Free Tier";
        if (reqEl) reqEl.textContent = data.requested_plan || "No pending changes";
        
        // 2. Handle Status Styling
        if (statusEl) {
            statusEl.textContent = formatStatus(data.status);
            statusEl.className = `status-badge ${data.status.toLowerCase()}`;
        }

        // 3. Optional: UI feedback for pending state
        if (data.status === 'pending') {
            showPendingAlert(data.requested_plan);
        }

    } catch (err) {
        console.error("Subscription Load Error:", err);
    }
}

/**
 * Helper: Make status text look editorial
 */
function formatStatus(status) {
    const statusMap = {
        'pending': 'Under Review',
        'active': 'Verified Member',
        'none': 'Standard Access',
        'rejected': 'Application Declined'
    };
    return statusMap[status.toLowerCase()] || status;
}

/**
 * UI: Notification for pending requests
 */
function showPendingAlert(plan) {
    const alertBox = document.getElementById("pending-notification");
    if (alertBox) {
        alertBox.innerHTML = `
            <div class="editorial-alert">
                <p>Your request for <strong>${plan}</strong> is currently being processed by our concierge team.</p>
            </div>
        `;
        alertBox.classList.remove("hidden");
    }
}