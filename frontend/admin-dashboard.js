import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", loadDashboard);

document.getElementById('logout-btn').addEventListener('click', logout);

async function loadDashboard() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Access denied! Admins only.");
    window.location.href = "login.html";
    return;
  }

  const verify = await fetch(`${API_BASE_URL}/api/protected`, {
    headers: { Authorization: "Bearer " + token }
  });

  if (!verify.ok) {
    alert("Session expired. Please log in again.");
    logout();
    return;
  }

  const verifyData = await verify.json();
  document.getElementById("welcome-message").textContent = `Welcome, ${verifyData.user.email} (${verifyData.user.role})`;

  const statsRes = await fetch(`${API_BASE_URL}/api/stats`, { headers: { Authorization: "Bearer " + token } });
  const statsData = await statsRes.json();

  document.getElementById("user-count").textContent = statsData.users;
  document.getElementById("admin-count").textContent = statsData.admins;
  document.getElementById("regular-count").textContent = statsData.regularUsers;

  const usersRes = await fetch(`${API_BASE_URL}/api/users`, { headers: { Authorization: "Bearer " + token } });
  const users = await usersRes.json();

  renderRecentUsers(users);
  renderAllUsers(users);
}

function renderRecentUsers(users) {
  const recentTbody = document.querySelector("#recent-users tbody");
  recentTbody.innerHTML = "";
  const recent = users.slice(0, 5);
  recent.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.role}</td>
      <td>${new Date(u.created_at).toLocaleString()}</td>
    `;
    recentTbody.appendChild(tr);
  });
}

function renderAllUsers(users) {
  const manageTbody = document.querySelector("#all-users tbody");
  manageTbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.email}</td>
      <td>
        <select onchange="updateUserRole(${u.id}, this.value)">
          <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td><button class="delete-btn" data-userid="${u.id}">Delete</button></td>
    `;
    manageTbody.appendChild(tr);
  });

  // Delegated event handler for delete buttons
  manageTbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteUser(e.target.dataset.userid);
    });
  });
}

async function updateUserRole(id, role) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ role })
  });

  if (res.ok) {
    alert("✅ User role updated successfully!");
    loadDashboard();
  } else {
    alert("❌ Failed to update user role.");
  }
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });

  if (res.ok) {
    alert("🗑️ User deleted!");
    loadDashboard();
  } else {
    alert("❌ Failed to delete user.");
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
