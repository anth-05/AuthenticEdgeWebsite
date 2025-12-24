/**
 * Navigation & Auth Logic
 */
function initMenu() {
    const nav = document.getElementById("header-buttons");
    if (!nav) return;

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    // 1. Define Universal Links (Editorial Style)
    let menuHTML = `
        <a href="index.html" class="nav-link">Home</a>
        <a href="product.html" class="nav-link">Products</a>
        <a href="subscription.html" class="nav-link">Subscription</a>
    `;

    // 2. Conditional Auth Links
    if (!token) {
        menuHTML += `
            <a href="contact.html" class="nav-link">Contact</a>
            <a href="login.html" class="nav-link">Sign In</a>
            <a href="register.html" class="nav-cta">Register</a>
        `;
    } else {
        // Show Messages tab for logged-in users and admins
        // This replaces the floating chat bubble approach
        menuHTML += `
            <a href="user-messages.html" class="nav-link msg-link">
                Concierge <span id="nav-msg-dot" class="dot hidden"></span>
            </a>
        `;

        // Direct to appropriate dashboard
        if (role === "admin") {
            menuHTML += `<a href="admin-dashboard.html" class="nav-link admin-link">Dashboard</a>`;
        } else {
            menuHTML += `<a href="user-dashboard.html" class="nav-link">Account</a>`;
        }
        
        menuHTML += `<a href="#" id="logout-btn" class="nav-link logout-link">Sign Out</a>`;
    }

    nav.innerHTML = menuHTML;

    // 3. Setup Interactions
    setupLogout();
    setupMobileMenu();
}

/**
 * Handle Logout
 */
function setupLogout() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("userId"); 
            window.location.href = "index.html";
        });
    }
}

/**
 * Responsive Navigation Toggle
 */
function setupMobileMenu() {
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    
    if (menuToggle && navMenu) {
        menuToggle.onclick = () => {
            navMenu.classList.toggle("active");
            menuToggle.innerHTML = navMenu.classList.contains("active") ? "&times;" : "&#9776;";
        };
        
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove("active");
                menuToggle.innerHTML = "&#9776;";
            });
        });
    }
}

// Initial Run
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenu);
} else {
    initMenu();
}