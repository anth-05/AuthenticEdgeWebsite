document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Block unauthorized access
  if (!token || role !== "admin") {
    alert("Admins only. Redirecting...");
    window.location.href = "login.html";
    return;
  }

  // Verify token with backend
  try {
    const res = await fetch(`${API_BASE_URL}/api/protected`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      alert("Session expired. Please log in again.");
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    // (Optional) Show admin name somewhere:
    const el = document.getElementById("admin-info");
    if (el) el.textContent = `${data.user.email} (Admin)`;

  } catch (error) {
    console.error("Protect error:", error);
    alert("Cannot connect to server.");
  }
});

// GLOBAL LOGOUT FUNCTION
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
