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
        <a href="about-us.html" class="nav-link">About Us</a>
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
                Contact <span id="nav-msg-dot" class="dot hidden"></span>
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
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const cartTrigger = document.getElementById('cartTrigger');

function toggleCart() {
    cartDrawer.classList.toggle('open');
    cartOverlay.classList.toggle('show');
}

// Check if the cart elements exist before adding listeners
if (cartTrigger) {
    cartTrigger.addEventListener('click', toggleCart);
}

if (cartOverlay) {
    cartOverlay.addEventListener('click', toggleCart);
}

/* =========================
   BACK TO TOP LOGIC
========================= */
const initBackToTop = () => {
    const topBtn = document.getElementById("backToTop");

    if (!topBtn) return;

    window.addEventListener("scroll", () => {
        // Show button after scrolling 400px
        if (window.pageYOffset > 400) {
            topBtn.classList.add("active");
        } else {
            topBtn.classList.remove("active");
        }
    });

    topBtn.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
};

// Call the function
initBackToTop();