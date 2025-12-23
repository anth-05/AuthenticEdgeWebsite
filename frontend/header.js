function initMenu() {
  const nav = document.getElementById("header-buttons");
  if (!nav) return; // Safety check

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Base navigation links
  let menuHTML = `
    <a href="index.html">Home</a>
    <a href="product.html">Products</a>
    <a href="subscription.html">Subscriptions</a>
    <a href="contact.html">Contact</a>
  `;

  // Auth-based links
  if (!token) {
    menuHTML += `
      <a href="login.html">Login</a>
      <a href="register.html" class="nav-cta">Register</a>
    `;
  } else {
    if (role === "admin") {
      menuHTML += `<a href="admin-dashboard.html">Admin</a>`;
    } else {
      menuHTML += `<a href="user-dashboard.html">Account</a>`;
    }
    menuHTML += `<a href="#" id="logout-btn" class="logout-link">Logout</a>`;
  }

  nav.innerHTML = menuHTML;

  // Logout Logic
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Only clear auth data, not the whole localStorage (best practice)
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = "index.html";
    });
  }

  // Mobile Toggle Logic
  const menuToggle = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      navMenu.classList.toggle("active");
      // Change icon from hamburger to X when active
      menuToggle.textContent = navMenu.classList.contains("active") ? "✕" : "☰";
    });
  }
}

// Initialization
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMenu);
} else {
  initMenu();
}