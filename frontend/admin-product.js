import { API_BASE_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", initProductsPage);

async function initProductsPage() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Verify admin access
  if (!token || role !== "admin") {
    alert("Access denied! Admins only.");
    window.location.href = "login.html";
    return;
  }

  // Verify session validity
  const verify = await fetch(`${API_BASE_URL}/api/protected`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!verify.ok) {
    alert("Session expired. Please log in again.");
    logout();
    return;
  }

  const verifyData = await verify.json();
  const welcomeMessage = document.getElementById("welcome-message");
  if (welcomeMessage) {
    welcomeMessage.textContent = `Welcome, ${verifyData.user.email} (${verifyData.user.role})`;
  }

  await loadProducts();

  // Attach form submit event handler
  const form = document.getElementById("add-product-form");
  if (form) {
    form.addEventListener("submit", addProductHandler);
  }
}

// Load all products and render table
async function loadProducts() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    alert("Failed to load products.");
    return;
  }

  const products = await res.json();
  const tbody = document.querySelector("#product-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td><img src="${p.image}" alt="${p.name}" class="product-thumb" loading="lazy"/></td>
      <td>${p.name}</td>
      <td>${p.gender || "-"}</td>
      <td>${p.quality || "-"}</td>
      <td>${p.availability || "-"}</td>
      <td>
        <button class="edit-btn" data-id="${p.id}">Edit</button>
        <button class="delete-btn" data-id="${p.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach event listeners for the action buttons
  tbody.querySelectorAll(".edit-btn").forEach(button => {
    button.addEventListener("click", () => {
      editProduct(button.dataset.id);
    });
  });

  tbody.querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.id);
    });
  });
}

// Handle add product form submission
async function addProductHandler(e) {
  e.preventDefault();

  const token = localStorage.getItem("token");

  const data = {
    name: document.getElementById("name").value.trim(),
    description: document.getElementById("description").value.trim(),
    image: document.getElementById("image").value.trim(),
    gender: document.getElementById("gender").value.trim(),
    quality: document.getElementById("quality").value.trim(),
    availability: document.getElementById("availability").value.trim(),
  };

  // Basic validation on required fields
  if (!data.name || !data.image) {
    alert("Please fill in both Product Name and Image URL.");
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    alert("✅ Product added successfully!");
    e.target.reset();
    await loadProducts();
  } else {
    alert("❌ Failed to add product.");
  }
}

// Edit product by prompt to change name
async function editProduct(id) {
  const newName = prompt("Enter new product name:");
  if (!newName) return;

  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name: newName })
  });

  if (res.ok) {
    alert("✅ Product updated!");
    await loadProducts();
  } else {
    alert("❌ Failed to update product.");
  }
}

// Delete a product after confirmation
async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    alert("🗑️ Product deleted!");
    await loadProducts();
  } else {
    alert("❌ Failed to delete product.");
  }
}

// Logout function
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

export { logout };
document.querySelectorAll('input[name="imageType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const showUrl = e.target.value === 'url';
    document.getElementById('image-url-row').style.display = showUrl ? '' : 'none';
    document.getElementById('image-upload-row').style.display = showUrl ? 'none' : '';
  });
});

document.getElementById("add-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const imageType = document.querySelector('input[name="imageType"]:checked').value;

  let data = {
    name: document.getElementById("name").value.trim(),
    description: document.getElementById("description").value.trim(),
    gender: document.getElementById("gender").value.trim(),
    quality: document.getElementById("quality").value.trim(),
    availability: document.getElementById("availability").value.trim(),
  };

  let body, headers;

  if (imageType === "upload") {
    // Use FormData for file upload  
    const imageFile = document.getElementById('imageUpload').files[0];
    if (!imageFile) {
      alert("Please upload an image file.");
      return;
    }
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    formData.append("imageFile", imageFile);
    body = formData;
    headers = { Authorization: `Bearer ${token}` }; // No Content-Type for FormData!
  } else {
    // Use URL field
    const imageUrl = document.getElementById("image").value.trim();
    if (!imageUrl) {
      alert("Please supply an image URL.");
      return;
    }
    data.image = imageUrl;
    body = JSON.stringify(data);
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }

  const res = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers,
    body
  });

  if (res.ok) {
    alert("✅ Product added successfully!");
    e.target.reset();
    loadProducts();
  } else {
    alert("❌ Failed to add product.");
  }
});
