import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  redirectIfNotLoggedIn();
  loadUserInfo();
  setupButtons();
});

/* -----------------------------------------------------------
   AUTH CHECK
----------------------------------------------------------- */
function redirectIfNotLoggedIn() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "user") {
    window.location.href = "login.html";
  }
}

/* -----------------------------------------------------------
   API REQUEST WRAPPER
----------------------------------------------------------- */
async function apiRequest(path, method = "GET", body = null) {
  const token = localStorage.getItem("token");

  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };

  if (body) options.body = JSON.stringify(body);

  const res = await fetch(API_BASE_URL + path, options);

  let data = {};
  try {
    data = await res.json();
  } catch (e) {}

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/* -----------------------------------------------------------
   LOAD USER INFORMATION
----------------------------------------------------------- */
async function loadUserInfo() {
  const box = document.getElementById("user-info");

  try {
    const { user } = await apiRequest("/api/user");

    box.innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Role:</strong> ${user.role}</p>
      <p><strong>Account Created:</strong> ${new Date(user.created_at).toLocaleString()}</p>
    `;
  } catch (err) {
    box.innerHTML = `<p class="error">Failed to load user info.</p>`;
    console.error(err);
  }
}

/* -----------------------------------------------------------
   BUTTON SETUP
----------------------------------------------------------- */
function setupButtons() {
  document.getElementById("update-email-btn")
    .addEventListener("click", updateEmail);

  document.getElementById("update-password-btn")
    .addEventListener("click", updatePassword);

  document.getElementById("delete-account-btn")
    .addEventListener("click", deleteAccount);
}

/* -----------------------------------------------------------
   UPDATE EMAIL
----------------------------------------------------------- */
async function updateEmail() {
  const newEmail = document.getElementById("new-email").value.trim();

  if (!newEmail) return alert("Please enter a new email.");

  try {
    await apiRequest("/api/user/email", "PUT", { email: newEmail });

    alert("Email updated successfully. Please log in again.");
    localStorage.clear();
    window.location.href = "login.html";
  } catch (err) {
    alert("Error updating email: " + err.message);
  }
}

/* -----------------------------------------------------------
   UPDATE PASSWORD
----------------------------------------------------------- */
async function updatePassword() {
  const newPass = document.getElementById("new-password").value.trim();

  if (!newPass) return alert("Password cannot be empty.");

  try {
    await apiRequest("/api/user/password", "PUT", { password: newPass });

    alert("Password updated successfully. Please log in again.");
    localStorage.clear();
    window.location.href = "login.html";
  } catch (err) {
    alert("Error updating password: " + err.message);
  }
}

/* -----------------------------------------------------------
   DELETE ACCOUNT
----------------------------------------------------------- */
async function deleteAccount() {
  if (!confirm("Are you sure you want to permanently delete your account?")) {
    return;
  }

  try {
    await apiRequest("/api/user", "DELETE");

    alert("Account deleted.");
    localStorage.clear();
    window.location.href = "register.html";
  } catch (err) {
    alert("Failed to delete account: " + err.message);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  loadSubscription();
  document
    .getElementById("request-sub-change-btn")
    .addEventListener("click", requestSubChange);
});

async function loadSubscription() {
  try {
    const data = await apiRequest("/api/subscription");

    document.getElementById("current-plan").textContent =
      data.current_plan || "None";

    document.getElementById("requested-plan").textContent =
      data.requested_plan || "None";

    document.getElementById("sub-status").textContent =
      data.status || "Inactive";

  } catch (err) {
    console.error("Failed to load subscription:", err);
    document.getElementById("sub-status").textContent = "Error";
  }
}
async function requestSubChange() {
  const newPlan = document.getElementById("new-plan").value;

  if (!confirm(`Request change to "${newPlan}" plan?`)) return;

  try {
    await apiRequest("/api/subscription/request", "POST", {
      plan: newPlan
    });

    alert("✅ Subscription change request sent!");

    // Reload subscription info
    loadSubscription();
  } catch (err) {
    alert("Failed to request change: " + err.message);
  }
}
