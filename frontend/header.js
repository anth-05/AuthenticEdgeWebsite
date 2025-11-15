  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("header-buttons");
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    let menuHTML = `
      <a href="index.html">Home</a>
      <a href="coming-soon.html">Products</a>
      <a href="contact.html">Contact</a>
    `;

    if (!token) {
      // NOT LOGGED IN
      menuHTML += `
        <a href="login.html">Login</a>
        <a href="register.html">Register</a>
      `;
    } else {
      // LOGGED IN
      if (role === "admin") {
        menuHTML += `<a href="admin-dashboard.html">Admin Dashboard</a>`;
      } else {
        menuHTML += `<a href="user-dashboard.html">Account</a>`;
      }

      menuHTML += `<a href="#" id="logout-btn">Logout</a>`;
    }

    nav.innerHTML = menuHTML;

    // Logout handler
    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "index.html";
      });
    }

    // Mobile menu toggle
    document.querySelector(".menu-toggle").addEventListener("click", () => {
      document.querySelector(".nav-menu").classList.toggle("active");
    });
  });