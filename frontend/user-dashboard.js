import { API_BASE_URL } from "./config.js";

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

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
  if (!res.ok) throw new Error(data.error);
  return data;
}

/* =========================
   LOAD USER
========================= */
(async () => {
  try {
    const res = await api("/api/user");
    const user = res.user;

    document.getElementById("user-info").innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Joined:</strong> ${new Date(user.created_at).toDateString()}</p>
    `;
  } catch {
    document.getElementById("user-info").textContent = "Failed to load profile.";
  }
})();

/* =========================
   LOAD SUBSCRIPTION
========================= */
(async () => {
  try {
    const sub = await api("/api/subscription");

    document.getElementById("current-plan").textContent =
      sub.current_plan ?? "Standard";

    document.getElementById("requested-plan").textContent =
      sub.requested_plan ?? "None";

    const statusEl = document.getElementById("sub-status");
    statusEl.textContent = sub.status ?? "none";
    statusEl.className = `status-pill ${sub.status || "none"}`;
  } catch {}
})();

/* =========================
   SUBSCRIPTION REQUEST
========================= */
document.getElementById("request-sub-change-btn")
  ?.addEventListener("click", async () => {
    const plan = document.getElementById("new-plan").value;
    await api("/api/subscription/request", "POST", { plan });
    alert("Subscription request submitted for review.");
    location.reload();
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
