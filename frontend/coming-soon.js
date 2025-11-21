import { API_BASE_URL } from "./config.js";

const subModal = document.getElementById("sub-modal");
const loginModal = document.getElementById("login-modal");

const modalTitle = document.getElementById("modal-title");
const modalText = document.getElementById("modal-text");

let currentPlan = null;

// ===== Show modal =====
function openModal(modal) {
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("show"), 10);
}

function closeModal(modal) {
  modal.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 250);
}

document.getElementById("login-confirm").onclick = () => {
  closeModal(loginModal);
  window.location.href = "login.html";
};

document.getElementById("login-cancel").onclick = () => {
  closeModal(loginModal);
  window.location.href = "register.html";
};

document.getElementById("modal-cancel").onclick = () => {
  closeModal(subModal);
};

document.getElementById("modal-confirm").onclick = async () => {
  closeModal(subModal);
  subscribe(currentPlan);
};

// ===== Subscription click handling =====
const cards = document.querySelectorAll(".sub-card");
cards.forEach(card => {
  card.addEventListener("click", () => {
    const token = localStorage.getItem("token");
    currentPlan = card.querySelector("h3").innerText.trim();

    // Not logged in → show login modal
    if (!token) {
      openModal(loginModal);
      return;
    }

    // Logged in → show confirm modal
    modalTitle.innerText = `Subscribe to ${currentPlan}?`;
    modalText.innerText = `Do you want to subscribe to the “${currentPlan}” plan?`;
    openModal(subModal);
  });
});

// ===== Call backend =====
async function subscribe(plan) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/subscription/change`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plan })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to subscribe.");
      return;
    }

    alert(`Your subscription request for "${plan}" has been submitted.`);
    window.location.href = "user-dashboard.html";

  } catch (err) {
    alert("Server connection error.");
  }
}
await fetch(`${API_BASE_URL}/api/messages/send`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    message: `User requested subscription plan: ${plan}`
  })
});
