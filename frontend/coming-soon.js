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

const API_URL = API_BASE_URL;
const token = localStorage.getItem("token");

document.querySelectorAll(".sub-card").forEach(card => {
  card.addEventListener("click", async () => {
    const plan = card.dataset.plan;

    // 1️⃣ Not logged in → redirect
    if (!token) {
      localStorage.setItem("selectedPlan", plan);
      window.location.href = "login.html";
      return;
    }

    // 2️⃣ Logged in → check subscription
    const res = await fetch(`${API_URL}/api/subscription`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const sub = await res.json();

    // 3️⃣ Already has active subscription
    if (sub.current_plan) {
      alert(
        "You already have an active subscription.\n\n" +
        "To change your plan, go to User Settings."
      );
      return;
    }

    // 4️⃣ No subscription yet → create request
    await fetch(`${API_URL}/api/subscription/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });

    alert("Subscription request sent!");
  });
});

