import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", initDashboard);

const logoutBtn = document.getElementById("logout-btn");
const updateEmailBtn = document.getElementById("update-email-btn");
const updatePasswordBtn = document.getElementById("update-password-btn");
const deleteAccountBtn = document.getElementById("delete-account-btn");

logoutBtn.addEventListener("click", logout);
updateEmailBtn.addEventListener("click", updateEmail);
updatePasswordBtn.addEventListener("click", updatePassword);
deleteAccountBtn.addEventListener("click", deleteAccount);

async function initDashboard() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    alert("You must be logged in.");
    window.location.href = "login.html";
    return;
  }

  // Redirect admins to admin dashboard
  if (role === "admin") {
    window.location.href = "admin-dashboard.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/protected`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      alert("Session expired. Please log in again.");
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    renderUserInfo(data.user);
    // Optionally, load subscription info, chat messages, etc here or separate functions

  } catch (err) {
    console.error("Error loading dashboard:", err);
    alert("Failed to load user data. Please try again later.");
  }
}

function renderUserInfo(user) {
  const infoBox = document.getElementById("user-info");
  infoBox.innerHTML = `
    <p><strong>Email:</strong> ${user.email}</p>
    <p><strong>Role:</strong> ${user.role}</p>
    <p><strong>Account Created:</strong> ${new Date(user.created_at).toLocaleString()}</p>
  `;
}

async function updateEmail() {
  const newEmail = document.getElementById("new-email").value.trim();
  if (!newEmail) {
    alert("Enter a valid email.");
    return;
  }
  await updateUserData("email", newEmail, "Email updated! Please log in again.");
}

async function updatePassword() {
  const newPassword = document.getElementById("new-password").value.trim();
  if (!newPassword) {
    alert("Enter a valid password.");
    return;
  }
  await updateUserData("password", newPassword, "Password changed successfully.");
}

async function updateUserData(field, value, successMessage) {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Session expired. Please log in again.");
    window.location.href = "login.html";
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/${field}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      alert(successMessage);
      if (field === "email") {
        localStorage.clear();
        window.location.href = "login.html";
      }
    } else {
      alert(`Failed to update ${field}.`);
    }
  } catch (error) {
    console.error(`Error updating ${field}:`, error);
    alert(`Error updating ${field}. Please try again.`);
  }
}

async function deleteAccount() {
  if (!confirm("Are you sure? This action cannot be undone.")) return;

  const token = localStorage.getItem("token");
  if (!token) {
    alert("Session expired. Please log in again.");
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/user/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      alert("Your account has been deleted.");
      localStorage.clear();
      window.location.href = "index.html";
    } else {
      alert("Failed to delete account.");
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    alert("Error deleting account. Please try again.");
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
