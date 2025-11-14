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

async function requestSubChange() {
  const plan = document.getElementById("new-plan").value;

  const res = await fetch(`${API_BASE_URL}/api/subscription/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });

  const data = await res.json();
  alert(data.message);
  loadSubscription();
}
