import { API_BASE_URL } from "./config.js";

console.log("✅ Subscriptions JS loaded");

const modal = document.getElementById("custom-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalConfirm = document.getElementById("modal-confirm");
const modalCancel = document.getElementById("modal-cancel");

let confirmAction = null;
let cancelAction = null;

// ===== Modal helpers =====
function openModal(title, message, onConfirm, onCancel = null) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  confirmAction = onConfirm;
  cancelAction = onCancel;
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  confirmAction = null;
  cancelAction = null;
}

modalConfirm.onclick = () => {
  if (confirmAction) confirmAction();
  closeModal();
};

modalCancel.onclick = () => {
  if (cancelAction) cancelAction();
  closeModal(); // always just return
};

// ===== Main logic =====
document.addEventListener("DOMContentLoaded", () => {
  const API_URL = API_BASE_URL;
  const cards = document.querySelectorAll(".sub-card");

  console.log("🧩 Cards found:", cards.length);

  cards.forEach(card => {
    card.addEventListener("click", async () => {
      const plan = card.dataset.plan;
      const token = localStorage.getItem("token");

      console.log("👉 Clicked plan:", plan);

      // 🔐 NOT LOGGED IN
      if (!token) {
        openModal(
          "Account Required",
          "You need an account to subscribe.\nLog in to continue.",
          () => (window.location.href = "login.html")
          // Cancel = do nothing
        );
        return;
      }

      try {
        // 📡 Check subscription
        const res = await fetch(`${API_URL}/api/subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Subscription check failed");

        const sub = await res.json();

        // 👤 ALREADY SUBSCRIBED
        if (sub.current_plan) {
          openModal(
            "Active Subscription",
            "You already have a subscription.\nGo to Account Settings to change it?",
            () => (window.location.href = "user-dashboard.html")
            // Cancel = return
          );
          return;
        }

        // ✅ CONFIRM NEW SUBSCRIPTION
        openModal(
          "Confirm Subscription",
          `Subscribe to the "${plan}" plan?`,
          async () => {
            const createRes = await fetch(
              `${API_URL}/api/subscription/request`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ plan })
              }
            );

            if (!createRes.ok) {
              alert("Something went wrong. Please try again.");
              return;
            }

            alert("✅ Subscription request sent!");
          }
          // Cancel = return
        );
      } catch (err) {
        console.error("❌ Subscription error:", err);
        alert("Something went wrong. Please try again.");
      }
    });
  });
});
