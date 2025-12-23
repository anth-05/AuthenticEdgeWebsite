import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  if (checkAuth()) {
    loadUserInfo();
    loadSubscription();
    setupButtons();
  }
});

/**
 * Security: Redirect if not logged in
 */
function checkAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "user") {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

/**
 * Global API Wrapper: Handles headers and token injection
 */
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

  const res = await fetch(`${API_BASE_URL}${path}`, options);
  
  if (res.status === 401) {
    logout();
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Action failed");
  return data;
}

/**
 * Profile Management: Load and Render User Data
 */
async function loadUserInfo() {
  const infoBox = document.getElementById("user-info");
  if (!infoBox) return;

  try {
    const { user } = await apiRequest("/api/user");
    
    infoBox.innerHTML = `
      <div class="profile-detail">
        <label>Account Identity</label>
        <p>${user.email}</p>
      </div>
      <div class="profile-detail">
        <label>Membership Date</label>
        <p>${new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    `;
  } catch (err) {
    infoBox.innerHTML = `<p class="error-text">Identity sync failed.</p>`;
  }
}

/**
 * Subscription Management: Sync Status
 */
async function loadSubscription() {
  try {
    const sub = await apiRequest("/api/subscription");

    const currentEl = document.getElementById("current-plan");
    const requestedEl = document.getElementById("requested-plan");
    const statusEl = document.getElementById("sub-status");

    if (currentEl) currentEl.textContent = sub.current_plan || "Standard Access";
    if (requestedEl) requestedEl.textContent = sub.requested_plan || "None";
    
    if (statusEl) {
      statusEl.textContent = sub.status.toUpperCase();
      statusEl.className = `status-pill ${sub.status.toLowerCase()}`;
    }
  } catch (err) {
    console.error("Subscription Sync Error:", err);
  }
}

/**
 * Event Listeners: Setup UI Actions
 */
function setupButtons() {
  // Update Email
  document.getElementById("update-email-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("new-email").value.trim();
    if (!email) return alert("Email required.");
    
    try {
      await apiRequest("/api/user/email", "PUT", { email });
      alert("Email updated. Please sign in with your new identity.");
      logout();
    } catch (e) { alert(e.message); }
  });

  // Update Password
  document.getElementById("update-password-btn")?.addEventListener("click", async () => {
    const password = document.getElementById("new-password").value.trim();
    if (password.length < 6) return alert("Security: Password too short.");
    
    try {
      await apiRequest("/api/user/password", "PUT", { password });
      alert("Password secured. Please sign in again.");
      logout();
    } catch (e) { alert(e.message); }
  });

  // Delete Account
  document.getElementById("delete-account-btn")?.addEventListener("click", async () => {
    if (!confirm("This will permanently remove your membership and history. Proceed?")) return;
    
    try {
      await apiRequest("/api/user", "DELETE");
      alert("Account closed.");
      logout();
    } catch (e) { alert(e.message); }
  });

  // Request New Plan
  document.getElementById("request-sub-change-btn")?.addEventListener("click", async () => {
    const newPlan = document.getElementById("new-plan")?.value;
    
    try {
      await apiRequest("/api/subscription/request", "POST", { plan: newPlan });
      alert("Membership request transmitted.");
      loadSubscription();
    } catch (e) { alert(e.message); }
  });
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}