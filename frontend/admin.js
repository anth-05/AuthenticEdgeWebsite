import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupProductForm();
  loadDashboard();
});

/* ---------------------------
     PRODUCT FORM SETUP
--------------------------- */
function setupProductForm() {
  const productForm = document.getElementById("product-form");
  if (productForm) {
    productForm.addEventListener("submit", handleAddProduct);
  }
}

/* ---------------------------
       LOAD DASHBOARD
--------------------------- */
async function loadDashboard() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Access denied! Admins only.");
    window.location.href = "login.html";
    return;
  }

  try {
    // Verify session
    const verify = await fetch(`${API_BASE_URL}/api/protected`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!verify.ok) {
      alert("Session expired. Please log in again.");
      logout();
      return;
    }

    // Load stats
    await loadStats();

    // Fetch users
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

/* ---------------------------
        LOAD STATS
--------------------------- */
async function loadStats() {
  const token = localStorage.getItem("token");

  if (!token) return;

  const response = await fetch(`${API_BASE_URL}/api/stats`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    }
  });

  const data = await response.json();

  if (response.ok) {
    document.getElementById("user-count").textContent = data.users;
    document.getElementById("admin-count").textContent = data.admins;
    document.getElementById("regular-count").textContent = data.regularUsers;
  } else {
    console.error("Failed to load stats:", data.error);
  }
}

/* ---------------------------
    RENDER RECENT USERS
--------------------------- */
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

/* ---------------------------
    RENDER ALL USERS
--------------------------- */
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

/* ---------------------------
      UPDATE USER ROLE
--------------------------- */
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
      alert("User role updated!");
      loadDashboard();
    } else {
      alert("Failed to update user role.");
    }
  } catch (error) {
    alert("Error updating user role: " + error.message);
  }
}

/* ---------------------------
      DELETE USER
--------------------------- */
async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      alert("User deleted!");
      loadDashboard();
    } else {
      alert("Failed to delete user.");
    }
  } catch (error) {
    alert("Error deleting user: " + error.message);
  }
}

/* ---------------------------
    ADD PRODUCT (NO MULTER)
--------------------------- */
async function handleAddProduct(event) {
  event.preventDefault();

  const token = localStorage.getItem("token");
  const form = event.target;

  const name = form.productName.value.trim();
  const imageUrl = form.productImageUrl.value.trim();
  const imageFile = form.productImageUpload.files[0];
  const quality = form.productQuality.value.trim();
  const description = form.productDescription.value.trim();
  const gender = form.productGender.value;
  const availability = form.productAvailability.value;

  if (!name || !quality) {
    alert("Please provide required fields: Name and Quality.");
    return;
  }

  let finalImage = null;

  // Use file name OR URL
  if (imageFile) finalImage = imageFile.name;
  else if (imageUrl) finalImage = imageUrl;

  const body = {
    name,
    description,
    image: finalImage,
    gender,
    quality,
    availability
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      alert("Product added successfully!");
      form.reset();
    } else {
      alert("Failed to add product.");
    }
  } catch (error) {
    alert("Error connecting to server.");
  }
}

/* ---------------------------
          LOGOUT
--------------------------- */
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
