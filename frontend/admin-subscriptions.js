import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
  loadRequests();
});

/* =========================
   AUTH
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
    <tr><td colspan="5" class="loading-state">
      Checking membership queue...
    </td></tr>
  `;

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch subscription requests");

    const pending = await res.json();

    if (!pending.length) {
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
            ${req.current_plan ?? "Standard"}
          </span>
        </td>
        <td>
          <span class="plan-badge requested">
            ${req.requested_plan ?? "—"}
          </span>
        </td>
        <td>
          <span class="status-pill pending">
            ${req.status}
          </span>
        </td>
        <td>
          <button class="approve-btn"
            onclick="handleAction(${req.user_id}, 'approve')">
            Approve
          </button>
          <button class="reject-btn"
            onclick="handleAction(${req.user_id}, 'reject')">
            Decline
          </button>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Subscription sync error:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Error loading requests.</td>
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
    ? "Approve this subscription?"
    : "Reject this subscription request?";

  if (!confirm(msg)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions/${userId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Action failed");
    }

    loadRequests();

  } catch (err) {
    alert(err.message);
  }
};

/* =========================
   LOGOUT
========================= */
window.logout = () => {
  localStorage.clear();
  window.location.href = "login.html";
};
