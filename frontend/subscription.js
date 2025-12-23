// subscription.js
import { API_BASE_URL } from "./config.js";
import { openModal } from "./modal.js";

const cards = document.querySelectorAll(".sub-card");
const token = localStorage.getItem("token");

cards.forEach(card => {
  card.addEventListener("click", async () => {
    const plan = card.dataset.plan;
    if (!plan) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/subscription/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      openModal("Request Sent", "Your membership request has been submitted.");
    } catch (err) {
      alert(err.message);
    }
  });
});
