  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = "index.html";
    });
  }
  import { API_BASE_URL } from "./config.js";

    document.getElementById("registerBtn").addEventListener("click", register);
async function register() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // Basic validation
  if (!email || !password) {
    alert("Please fill in all fields.");
    return;
  }
  if (!email.includes("@") || !email.includes(".")) {
    alert("Please enter a valid email address.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: "user" })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Account created successfully! Redirecting to login...");
      window.location.replace("login.html");
    } else {
      alert(data.error || "Registration failed.");
    }
  } catch (err) {
    console.error(err);
    alert("Something went wrong. Please try again later.");
  }
}