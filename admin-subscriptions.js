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
    const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions/pending`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();
    const table = document.getElementById("sub-table-body");
    table.innerHTML = "";

    if (data.length === 0) {
      table.innerHTML = `<tr><td colspan="5" class="empty">No pending requests.</td></tr>`;
      return;
    }

    data.forEach(req => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${req.email}</td>
        <td>${req.current_plan || "-"}</td>
        <td><strong>${req.requested_plan}</strong></td>
        <td>${req.status}</td>
        <td>
          <button class="approve-btn" onclick="approve(${req.id})">Approve</button>
          <button class="reject-btn" onclick="rejectReq(${req.id})">Reject</button>
        </td>
      `;
      table.appendChild(row);
    });

  } catch (err) {
    console.error("Error loading subscription requests:", err);
  }
}

window.approve = async function (id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions/${id}/approve`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token }
  });

  if (res.ok) {
    alert("Approved!");
    loadRequests();
  }
};

window.rejectReq = async function (id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/api/admin/subscriptions/${id}/reject`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token }
  });

  if (res.ok) {
    alert("Rejected");
    loadRequests();
  }
};

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
