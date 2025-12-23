import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }
});

async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const submitBtn = document.getElementById("registerBtn");

  // 1. Enhanced Validation
  if (!email || !password) {
    alert("Please provide both email and password.");
    return;
  }

  if (password.length < 6) {
    alert("Security requirement: Password must be at least 6 characters.");
    return;
  }

  try {
    // UI Feedback
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Processing Application...";
    }

    // 2. API Call
    const res = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email, 
        password, 
        role: "user" // Default role
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Membership created successfully. Welcome to Authentic Edge.");
      window.location.replace("login.html");
    } else {
      alert(data.error || "Registration encountered an issue.");
    }
  } catch (err) {
    console.error("Registration Error:", err);
    alert("Connection error. Please check your internet and try again.");
  } finally {
    // Reset UI state
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Register";
    }
  }
}