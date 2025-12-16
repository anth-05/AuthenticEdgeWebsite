import { API_BASE_URL } from "./config.js";

const token = localStorage.getItem("token");

async function loadSubscription() {
  const res = await fetch(`${API_BASE_URL}/api/subscription`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  document.getElementById("current-plan").textContent = data.current_plan || "None";
  document.getElementById("requested-plan").textContent = data.requested_plan || "—";
  document.getElementById("sub-status").textContent = data.status;
}

loadSubscription();