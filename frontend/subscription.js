import { API_BASE_URL } from "./config.js";

const cards = document.querySelectorAll(".sub-card");

cards.forEach(card => {
  const btn = card.querySelector(".btn-select");
  
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const planName = card.querySelector("h3").innerText;
    const token = localStorage.getItem("token");

    // STATE 1: Logged Out
    if (!token) {
      document.getElementById("auth-modal").style.display = "flex";
      return;
    }

    try {
      // Get user profile to check existing subscription
      const userRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await userRes.json();

      // STATE 2: Logged In & Already Subscribed
      if (userData.subscription && userData.subscription !== 'none') {
        if (confirm(`You currently have the ${userData.subscription} plan. Go to settings to manage your subscription?`)) {
          window.location.href = "settings.html";
        }
        return;
      }

      // STATE 3: Logged In & No Subscription
      if (confirm(`Are you sure you want to select the ${planName} plan?`)) {
        const subRes = await fetch(`${API_BASE_URL}/api/subscription/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ plan: planName })
        });

        if (subRes.ok) {
          alert("Request Sent! We will contact you shortly to finalize your membership.");
        } else {
          const errData = await subRes.json();
          throw new Error(errData.error || "Request failed");
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
});