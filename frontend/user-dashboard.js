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
    // We use the profile endpoint we created in the previous step
    const user = await api("/api/user/profile");

    // Update User Info
    document.getElementById("user-info").innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Joined:</strong> ${new Date(user.created_at).toDateString()}</p>
    `;

    // Handle Subscription Logic
    const subData = user.subscription || "none";
    const currentPlanEl = document.getElementById("current-plan");
    const statusEl = document.getElementById("sub-status");
    const requestedPlanEl = document.getElementById("requested-plan");

    if (subData.startsWith("Pending:")) {
      // If status is "Pending: Edge"
      currentPlanEl.textContent = "None (Inactive)";
      requestedPlanEl.textContent = subData.replace("Pending: ", "");
      statusEl.textContent = "Pending Review";
      statusEl.className = "status-pill pending";
    } else if (subData === "none") {
      currentPlanEl.textContent = "No Active Plan";
      requestedPlanEl.textContent = "None";
      statusEl.textContent = "Inactive";
      statusEl.className = "status-pill none";
    } else {
      // Active Plan (e.g., "Edge")
      currentPlanEl.textContent = subData;
      requestedPlanEl.textContent = "None";
      statusEl.textContent = "Active";
      statusEl.className = "status-pill active";
    }

  } catch (err) {
    console.error(err);
    document.getElementById("user-info").textContent = "Failed to load profile.";
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
