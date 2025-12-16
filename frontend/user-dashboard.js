import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  loadSubscription();
  setupRequestButton();
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
/* -----------------------------------------------------------
   LOAD USER SUBSCRIPTION
----------------------------------------------------------- */
async function loadSubscription() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/subscription`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Failed to load subscription");

    const sub = await res.json();

    document.getElementById("current-plan").textContent =
      sub.current_plan || "None";

    document.getElementById("requested-plan").textContent =
      sub.requested_plan || "None";

    document.getElementById("sub-status").textContent =
      sub.status || "none";

  } catch (err) {
    console.error("❌ Failed to load subscription", err);
  }
}

/* -----------------------------------------------------------
   REQUEST SUBSCRIPTION CHANGE
----------------------------------------------------------- */
function setupRequestButton() {
  const btn = document.getElementById("request-sub-change-btn");

  if (!btn) {
    console.error("❌ Request button not found");
    return;
  }

  btn.addEventListener("click", async () => {
    const token = localStorage.getItem("token");
    const newPlan = document.getElementById("new-plan").value;

    try {
      // Get current subscription
      const res = await fetch(`${API_BASE_URL}/api/subscription`, {
        headers: { Authorization: "Bearer " + token }
      });

      const sub = await res.json();

      if (sub.status === "pending") {
        alert("You already have a pending request.");
        return;
      }

      if (sub.current_plan === newPlan) {
        alert("You are already on this plan.");
        return;
      }

      // Send request
      const req = await fetch(`${API_BASE_URL}/api/subscription/request`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan: newPlan })
      });

      if (!req.ok) {
  const err = await req.json();
  throw new Error(err.error || "Request failed");
}


      alert("✅ Subscription change request sent!");
      loadSubscription();

    } catch (err) {
      console.error("❌ Request failed", err);
      alert("Something went wrong.");
    }
  });
}
