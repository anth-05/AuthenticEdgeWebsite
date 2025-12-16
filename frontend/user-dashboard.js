import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  loadSubscription();
  setupRequestButton();
});

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
