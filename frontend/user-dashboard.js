import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    alert("You must be logged in.");
    window.location.href = "login.html";
    return;
  }

  // OPTIONAL: don't let admin see user dashboard
  if (role === "admin") {
    window.location.href = "admin-dashboard.html";
    return;
  }

  // Load user information
  try {
    const res = await fetch(`${API_BASE_URL}/api/protected`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) {
      alert("Session expired. Please log in again.");
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    renderUserInfo(data.user);

  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
}

function renderUserInfo(user) {
  document.getElementById("user-info").innerHTML = `
    <p><strong>Email:</strong> ${user.email}</p>
    <p><strong>Role:</strong> ${user.role}</p>
    <p><strong>Account Created:</strong> ${new Date(user.created_at).toLocaleString()}</p>
  `;
}

// ======================
// UPDATE EMAIL
// ======================
async function updateEmail() {
  const newEmail = document.getElementById("new-email").value.trim();
  const token = localStorage.getItem("token");

  if (!newEmail) {
    alert("Enter a valid email.");
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/user/email`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ email: newEmail }),
  });

  if (res.ok) {
    alert("Email updated! Please log in again.");
    localStorage.clear();
    window.location.href = "login.html";
  } else {
    alert("Failed to update email.");
  }
}

// ======================
// UPDATE PASSWORD
// ======================
async function updatePassword() {
  const newPassword = document.getElementById("new-password").value.trim();
  const token = localStorage.getItem("token");

  if (!newPassword) {
    alert("Enter a valid password.");
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/user/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ password: newPassword }),
  });

  if (res.ok) {
    alert("Password changed successfully.");
  } else {
    alert("Failed to update password.");
  }
}

// ======================
// DELETE ACCOUNT
// ======================
async function deleteAccount() {
  if (!confirm("Are you sure? This action cannot be undone.")) return;

  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/api/user/delete`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token,
    },
  });

  if (res.ok) {
    alert("Your account has been deleted.");
    localStorage.clear();
    window.location.href = "index.html";
  } else {
    alert("Failed to delete account.");
  }
}

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});
