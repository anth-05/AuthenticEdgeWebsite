import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons
      tabButtons.forEach(btn => btn.classList.remove("active"));
      // Hide all tab content
      tabContents.forEach(content => content.classList.remove("active"));

      // Activate clicked button and relevant tab content
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });})

  // Load dashboard data after tabs setup
  loadDashboard();

  // Setup logout button listener
  document.getElementById("logout-btn").addEventListener("click", logout);

  // Setup product form submit handler if exists
  const productForm = document.getElementById("product-form");
  if (productForm) {
    productForm.addEventListener("submit", handleAddProduct);
  }
});

async function loadDashboard() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Access denied! Admins only.");
    window.location.href = "login.html";
    return;
  }

  const verify = await fetch(`${API_BASE_URL}/api/protected`, {
    headers: { Authorization: "Bearer " + token }
  });

  if (!verify.ok) {
    alert("Session expired. Please log in again.");
    logout();
    return;
  }

  const verifyData = await verify.json();
  document.getElementById("welcome-message").textContent = `Welcome, ${verifyData.user.email} (${verifyData.user.role})`;

  const statsRes = await fetch(`${API_BASE_URL}/api/stats`, { headers: { Authorization: `Bearer ${token}` } });
  const statsData = await statsRes.json();

  document.getElementById("user-count").textContent = statsData.users;
  document.getElementById("admin-count").textContent = statsData.admins;
  document.getElementById("regular-count").textContent = statsData.regularUsers;

  const usersRes = await fetch(`${API_BASE_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
  const users = await usersRes.json();

  renderRecentUsers(users);
  renderAllUsers(users);
}

function renderRecentUsers(users) {
  const recentTbody = document.querySelector("#recent-users tbody");
  recentTbody.innerHTML = "";
  const recent = users.slice(0, 5);
  recent.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.role}</td>
      <td>${new Date(u.created_at).toLocaleString()}</td>
    `;
    recentTbody.appendChild(tr);
  });
}

function renderAllUsers(users) {
  const manageTbody = document.querySelector("#all-users tbody");
  manageTbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.email}</td>
      <td>
        <select onchange="updateUserRole(${u.id}, this.value)">
          <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td><button class="delete-btn" data-userid="${u.id}">Delete</button></td>
    `;
    manageTbody.appendChild(tr);
  });

  // Delegated event handler for delete buttons
  manageTbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteUser(e.target.dataset.userid);
    });
  });
}

async function updateUserRole(id, role) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ role })
  });

  if (res.ok) {
    alert("✅ User role updated successfully!");
    loadDashboard();
  } else {
    alert("❌ Failed to update user role.");
  }
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    alert("🗑️ User deleted!");
    loadDashboard();
  } else {
    alert("❌ Failed to delete user.");
  }
}

// Handle adding product from the product form
async function handleAddProduct(event) {
  event.preventDefault();

  const token = localStorage.getItem("token");

  const form = event.target;
  const name = form.productName.value.trim();
  const imageUrl = form.productImageUrl.value.trim();
  const imageFile = form.productImageUpload.files[0];
  const quality = form.productQuality.value.trim();
  const description = form.productDescription.value.trim();

  if (!name || !quality) {
    alert("Please provide required fields: Name and Quality.");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("quality", quality);
  formData.append("description", description);

  if (imageFile) {
    formData.append("imageFile", imageFile);
  } else if (imageUrl) {
    formData.append("imageUrl", imageUrl);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (res.ok) {
      alert("✅ Product added successfully!");
      form.reset();
    } else {
      alert("❌ Failed to add product.");
    }
  } catch (err) {
    alert("❌ Error connecting to server.");
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.dashboard-tabs .tab-link');
  const mainContent = document.getElementById('main-content');

  // Define content for each page (simplified example)
  const pagesContent = {
    home: `<section><h1>Home</h1><p>Welcome to the Home page.</p></section>`,
    products: `<section><h1>Product Management</h1><p>Manage your products here.</p></section>`,
    dashboard: `<section><h1>Dashboard</h1><p>Analytics and summaries here.</p></section>`,
    logout: `<section><h1>Logout</h1><p>You are logged out.</p></section>`
  };

  function activateTab(tab) {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Get the target from href hash (e.g. #home)
    const target = tab.getAttribute('href').substring(1);
    mainContent.innerHTML = pagesContent[target] || '<p>Page not found.</p>';
  }

  // Initialize first tab content
  if (tabs.length > 0) activateTab(tabs[0]);

  // Add click event to all tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      activateTab(tab);
    });
  });
});
document.addEventListener('DOMContentLoaded', () => {
  // Handle mobile tabs only
  if (window.innerWidth <= 600) {
    const mobileTabs = document.querySelectorAll('.mobile-tabs .tab-link');
    const mainContent = document.getElementById('main-content');

    const pagesContent = {
      home: '<section><h1>Home</h1><p>Welcome to Home.</p></section>',
      products: '<section><h1>Products</h1><p>Manage your Products.</p></section>',
      dashboard: '<section><h1>Dashboard</h1><p>Your Analytics here.</p></section>',
      logout: '<section><h1>Logout</h1><p>You are logged out.</p></section>'
    };

    function activateTab(tab) {
      mobileTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('href').substring(1);
      mainContent.innerHTML = pagesContent[target] || '<p>Page not found.</p>';
    }

    if (mobileTabs.length > 0) activateTab(mobileTabs[0]);

    mobileTabs.forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        activateTab(tab);
      });
    });
  }
});
