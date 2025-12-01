import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupProductForm();
  loadDashboard();
});


function setupProductForm() {
  const productForm = document.getElementById("product-form");
  if (productForm) {
    productForm.addEventListener("submit", handleAddProduct);
  }
}

async function loadDashboard() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Access denied! Admins only.");
    window.location.href = "login.html";
    return;
  }

  try {
    const verify = await fetch(`${API_BASE_URL}/api/protected`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!verify.ok) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }
    const verifyData = await verify.json();
    document.getElementById("welcome-message").textContent = `Welcome, ${verifyData.user.email} (${verifyData.user.role})`;

    const statsRes = await fetch(`${API_BASE_URL}/api/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const statsData = await statsRes.json();

    document.getElementById("user-count").textContent = statsData.users;
    document.getElementById("admin-count").textContent = statsData.admins;
    document.getElementById("regular-count").textContent = statsData.regularUsers;

    const usersRes = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const users = await usersRes.json();

    renderRecentUsers(users);
    renderAllUsers(users);

  } catch (error) {
    console.error("Dashboard loading failed:", error);
    alert("Failed to load dashboard data. Please try again.");
  }
}

function renderRecentUsers(users) {
  const recentTbody = document.querySelector("#recent-users tbody");
  recentTbody.innerHTML = "";
  users.slice(0, 5).forEach(u => {
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

  manageTbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      deleteUser(e.target.dataset.userid);
    });
  });
}

async function updateUserRole(id, role) {
  const token = localStorage.getItem("token");

  try {
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
  } catch (error) {
    alert("❌ Error updating user role: " + error.message);
  }
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const token = localStorage.getItem("token");

  try {
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
  } catch (error) {
    alert("❌ Error deleting user: " + error.message);
  }
}

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
  } catch (error) {
    alert("❌ Error connecting to server.");
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
