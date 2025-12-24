import { API_BASE_URL } from "./config.js";

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

// Protect Route
if (!token || role !== "user") {
  window.location.href = "login.html";
}

/* =========================
   API HELPER
========================= */
async function api(path, method = "GET", body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : null
  });

  if (res.status === 401) logout();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API Error");
  return data;
}

/* =========================
   LOAD PROFILE & SUBSCRIPTION
========================= */
async function loadUserData() {
  try {
    const data = await api("/api/user/profile");

    // Update Identity Info
    document.getElementById("user-info").innerHTML = `
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Joined:</strong> ${new Date(data.created_at).toDateString()}</p>
    `;

    // Update Subscription UI elements
    const currentPlanEl = document.getElementById("current-plan");
    const statusEl = document.getElementById("sub-status");
    const requestedPlanEl = document.getElementById("requested-plan");

    // Map the new table columns to the UI
    currentPlanEl.textContent = data.current_plan || "No Active Tier";
    requestedPlanEl.textContent = data.requested_plan || "None";
    
    // Set Status Pill
    const currentStatus = data.status || "none";
    statusEl.textContent = currentStatus.toUpperCase();
    
    // Apply the correct CSS class (pending, active, none)
    statusEl.className = `status-pill ${currentStatus}`;

  } catch (err) {
    console.error("Dashboard Load Error:", err);
    document.getElementById("user-info").textContent = "Error loading secure data.";
  }
}
// Run loader
loadUserData();

/* =========================
   SUBSCRIPTION CHANGE REQUEST
========================= */
document.getElementById("request-sub-change-btn")
  ?.addEventListener("click", async () => {
    const plan = document.getElementById("new-plan").value;
    try {
      await api("/api/subscription/request", "POST", { plan });
      alert("Your request for the " + plan + " plan has been submitted!");
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });

/* =========================
   UPDATE EMAIL
========================= */
document.getElementById("update-email-btn")
  ?.addEventListener("click", async () => {
    const email = document.getElementById("new-email").value;
    if (!email) return alert("Enter a new email.");
    await api("/api/user/email", "PUT", { email });
    alert("Email updated.");
    location.reload();
  });

/* =========================
   UPDATE PASSWORD
========================= */
document.getElementById("update-password-btn")
  ?.addEventListener("click", async () => {
    const password = document.getElementById("new-password").value;
    if (!password) return alert("Enter a new password.");
    await api("/api/user/password", "PUT", { password });
    alert("Password updated.");
    document.getElementById("new-password").value = "";
  });
/* =========================
   CANCEL SUBSCRIPTION
========================= */
document.getElementById("cancel-sub-btn")
  ?.addEventListener("click", async () => {
    const confirmCancel = confirm("Are you sure you want to request a cancellation of your current membership?");
    
    if (confirmCancel) {
      try {
        // We reuse the request endpoint but pass 'Cancellation' as the plan
        await api("/api/subscription/request", "POST", { plan: "Cancellation" });
        alert("Cancellation request submitted. Our team will process it shortly.");
        location.reload();
      } catch (err) {
        alert("Error submitting request: " + err.message);
      }
    }
  });
/* =========================
   DELETE ACCOUNT
========================= */
document.getElementById("delete-account-btn")
  ?.addEventListener("click", async () => {
    if (!confirm("This will permanently delete your account. Continue?")) return;
    await api("/api/user", "DELETE");
    logout();
  });

/* =========================
   LOGOUT
========================= */
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
