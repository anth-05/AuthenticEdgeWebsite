import { API_BASE_URL } from "./config.js";
import { openModal } from "./modal.js";

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = API_BASE_URL;
  const cards = document.querySelectorAll(".sub-card");

  cards.forEach(card => {
    card.addEventListener("click", async () => {
      const plan = card.dataset.plan;
      const token = localStorage.getItem("token");

      // 🔐 Not logged in
      if (!token) {
        openModal(
          "Account Required",
          "You need an account to subscribe.\nLog in to continue.",
          () => window.location.href = "login.html"
        );
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Subscription check failed");

        const sub = await res.json();

        if (sub.status !== "none") {
        openModal(
          "Subscription Exists",
          "You already have or requested a subscription.\nManage it in your dashboard?",
          () => window.location.href = "user-dashboard.html"
        );
        return;
        }
        // ✅ status === "none" → allow new subscription
        openModal(
          "Choose your plan in account dashboard",
          "You can now choose a plan in your account dashboard.",
          () => window.location.href = "user-dashboard.html"
        );
      } catch (err) {
        console.error("❌ Subscription error:", err);
        alert("Something went wrong. Please try again.");
      }
    });
  });
});
