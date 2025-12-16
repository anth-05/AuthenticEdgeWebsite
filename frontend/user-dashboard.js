import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  loadSubscription();
  setupRequestButton();
});

/* -----------------------------------------------------------
   LOAD SUBSCRIPTION INFO
----------------------------------------------------------- */
async function loadSubscription() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/subscription`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await res.json();

    document.getElementById("current-plan").textContent =
      data.current_plan || "None";

    document.getElementById("requested-plan").textContent =
      data.requested_plan || "None";

    document.getElementById("sub-status").textContent =
      data.status || "none";

  } catch (err) {
    console.error("❌ Failed to load subscription:", err);
  }
}

/* -----------------------------------------------------------
   REQUEST CHANGE
----------------------------------------------------------- */
function setupRequestButton() {
  const btn = document.getElementById("request-sub-change-btn");

  btn.addEventListener("click", async () => {
    const token = localStorage.getItem("token");
    const newPlan = document.getElementById("new-plan").value;

    try {
      // 1️⃣ Get current subscription
      const res = await fetch(`${API_BASE_URL}/api/subscription`, {
        headers: { Authorization: "Bearer " + token }
      });

      const sub = await res.json();

      // 2️⃣ Guard checks
      if (sub.status === "pending") {
        alert("You already have a pending request.");
        return;
      }

      if (sub.current_plan === newPlan) {
        alert("You are already on this plan.");
        return;
      }

      // 3️⃣ Send request
      const reqRes = await fetch(
        `${API_BASE_URL}/api/subscription/request`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ plan: newPlan })
        }
      );

      if (!reqRes.ok) {
        throw new Error("Request failed");
      }

      alert("✅ Subscription change requested!");

      // 4️⃣ Refresh UI
      loadSubscription();

    } catch (err) {
      console.error("❌ Subscription request failed:", err);
      alert("Something went wrong.");
    }
  });
}
