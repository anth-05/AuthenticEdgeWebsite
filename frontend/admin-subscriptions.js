import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", loadRequests);

async function loadRequests() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Admins only.");
    window.location.href = "login.html";
    return;
  }

  try {
    // ✅ Correct backend route
    const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await res.json();

    // ✅ Show only pending requests
    const pending = data.filter(r => r.status === "pending");

    const table = document.getElementById("sub-table-body");
    table.innerHTML = "";

    if (pending.length === 0) {
      table.innerHTML = `
        <tr>
          <td colspan="5" class="empty">No pending requests.</td>
        </tr>`;
      return;
    }

    pending.forEach(req => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${req.email}</td>
        <td>${req.current_plan || "-"}</td>
        <td><strong>${req.requested_plan}</strong></td>
        <td>${req.status}</td>
        <td>
          <button class="approve-btn" data-user="${req.user_id}">Approve</button>
          <button class="reject-btn" data-user="${req.user_id}">Reject</button>
        </td>
      `;

      table.appendChild(row);
    });

    // ✅ Attach listeners AFTER render
    document.querySelectorAll(".approve-btn").forEach(btn => {
      btn.addEventListener("click", () =>
        handleAction(btn.dataset.user, "approve")
      );
    });

    document.querySelectorAll(".reject-btn").forEach(btn => {
      btn.addEventListener("click", () =>
        handleAction(btn.dataset.user, "reject")
      );
    });

  } catch (err) {
    console.error("❌ Error loading subscription requests:", err);
    alert("Failed to load subscription requests.");
  }
}

/* -----------------------------------------------------------
   APPROVE / REJECT HANDLER
----------------------------------------------------------- */
async function handleAction(userId, action) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/admin/subscriptions/${userId}`,
      {
        method: "POST", // ✅ backend expects POST
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action }) // "approve" or "reject"
      }
    );

    if (!res.ok) {
      throw new Error("Action failed");
    }

    alert(action === "approve" ? "Approved!" : "Rejected");
    loadRequests(); // refresh table

  } catch (err) {
    console.error(`❌ Failed to ${action} request:`, err);
    alert("Something went wrong.");
  }
}

/* -----------------------------------------------------------
   LOGOUT
----------------------------------------------------------- */
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
