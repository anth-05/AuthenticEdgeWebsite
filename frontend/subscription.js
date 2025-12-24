import { API_BASE_URL } from "./config.js";
import { openModal } from "./modal.js"; // Ensure this path is correct

const cards = document.querySelectorAll(".sub-card");

cards.forEach(card => {
    const btn = card.querySelector(".btn-select");

    btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const planName = card.querySelector("h3").innerText;
        const token = localStorage.getItem("token");

        // FIX: Match the IDs in your HTML
        const modal = document.getElementById("custom-modal"); // Changed from auth-modal
        const authLinks = document.getElementById("auth-links");
        const confirmBtn = document.getElementById("modal-confirm");
        const cancelBtn = document.getElementById("modal-cancel");

        // STATE 1: Logged Out
        if (!token) {
            if (modal) {
                document.getElementById("modal-title").textContent = "Membership Required";
                document.getElementById("modal-message").textContent = "Please log in or create an account to choose your membership plan.";
                
                // Toggle visibility
                if (confirmBtn) confirmBtn.style.display = "none";
                if (cancelBtn) cancelBtn.style.display = "none";
                if (authLinks) authLinks.style.display = "flex";
                
                modal.style.display = "flex";
            }
            return;
        }

    try {
      const userRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await userRes.json();

      // STATE 2: Already Subscribed
      if (userData.status === 'active') {
        alert(`You already have an active ${userData.current_plan} plan.`);
        window.location.href = "user-dashboard.html";
        return;
      }

      // STATE 3: Confirm Request
      // Using your custom openModal instead of window.confirm
      openModal(
        "Confirm Selection",
        `Are you sure you want to request the ${planName} plan?`,
        async () => {
          const subRes = await fetch(`${API_BASE_URL}/api/subscription/request`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ plan: planName })
          });

          if (subRes.ok) {
            alert("Request Sent! Redirecting to dashboard...");
            window.location.href = "user-dashboard.html";
          }
        },
        "Submit Request"
      );

    } catch (err) {
      console.error(err);
    }
  });
});