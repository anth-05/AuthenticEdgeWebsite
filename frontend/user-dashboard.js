// user-dashboard.js
import { API_BASE_URL } from "./config.js";

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "user") {
  window.location.href = "login.html";
}

// API helper
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

// Load identity
(async () => {
  try {
    const user = await api("/api/user");
    document.getElementById("user-info").innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Joined:</strong> ${new Date(user.created_at).toDateString()}</p>
    `;
  } catch {
    document.getElementById("user-info").textContent = "Failed to load profile.";
  }
})();

// Load subscription
(async () => {
  try {
    const sub = await api("/api/subscription");
    document.getElementById("current-plan").textContent = sub.current_plan ?? "Standard";
    document.getElementById("requested-plan").textContent = sub.requested_plan ?? "None";
    document.getElementById("sub-status").textContent = sub.status ?? "None";
  } catch {}
})();

// Request change
document.getElementById("request-sub-change-btn")?.addEventListener("click", async () => {
  const plan = document.getElementById("new-plan").value;
  await api("/api/subscription/request", "POST", { plan });
  alert("Request submitted");
  location.reload();
});

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
