import { API_BASE_URL } from "./config.js";

// --- UI Handlers for form input type ---
document.querySelectorAll('input[name="imageType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const showUrl = e.target.value === 'url';
    document.getElementById('image-url-row').style.display = showUrl ? '' : 'none';
    document.getElementById('image-upload-row').style.display = showUrl ? 'none' : '';
  });
});

// --- PRODUCTS TABLE/CRUD ---
async function loadProducts() {
  const token = localStorage.getItem("token");
  const tbody = document.querySelector("#product-table tbody");
  tbody.innerHTML = "<tr><td colspan='7' role='row'><em>Loading products...</em></td></tr>";

  try {
    const res = await fetch(`${API_BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch products");
    const products = await res.json();

    if (products.length === 0) {
      tbody.innerHTML = "<tr><td colspan='7'>No products found.</td></tr>";
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td><img src="${p.image}" alt="${p.name}" class="product-thumb"></td>
        <td>${p.name}</td>
        <td>${p.gender || ""}</td>
        <td>${p.quality || ""}</td>
        <td>${p.availability || ""}</td>
        <td>
          <button data-id="${p.id}" class="edit-btn">Edit</button>
          <button data-id="${p.id}" class="delete-btn">Delete</button>
        </td>
      </tr>
    `).join("");

    // Add event handlers for Edit and Delete
    tbody.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', async function () {
        if (!confirm('Are you sure you want to delete this product?')) return;
        await deleteProduct(btn.dataset.id);
      })
    );

    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', function () {
        // You need to show a modal or form here, prefill, and handle update
        alert('Edit product functionality not implemented yet.');
      })
    );
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan='7'>Error loading products: ${error.message}</td></tr>`;
  }
}

// --- Delete Product ---
async function deleteProduct(id) {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      alert("✅ Product deleted!");
      loadProducts();
    } else {
      const err = await res.json();
      alert(`❌ Unable to delete: ${err.error || res.statusText}`);
    }
  } catch (err) {
    alert(`❌ Error deleting: ${err.message}`);
  }
}

// --- Add Product ---
document.getElementById("add-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const imageType = document.querySelector('input[name="imageType"]:checked').value;
  const data = {
    name: document.getElementById("name").value.trim(),
    description: document.getElementById("description").value.trim(),
    gender: document.getElementById("gender").value.trim(),
    quality: document.getElementById("quality").value.trim(),
    availability: document.getElementById("availability").value.trim(),
  };

  let body, headers;

  if (imageType === "upload") {
    const imageFile = document.getElementById('imageUpload').files[0];
    if (!imageFile) {
      alert("Please upload an image file.");
      return;
    }
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    formData.append("imageFile", imageFile);
    body = formData;
    headers = { Authorization: `Bearer ${token}` };
  } else {
    const imageUrl = document.getElementById("image").value.trim();
    if (!imageUrl) {
      alert("Please supply an image URL.");
      return;
    }
    data.image = imageUrl;
    body = JSON.stringify(data);
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }

  if (!data.name) {
    alert("Please provide the product name.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers,
      body
    });

    if (res.ok) {
      alert("✅ Product added successfully!");
      e.target.reset();
      loadProducts();
      document.querySelector('input[name="imageType"][value="url"]').checked = true;
      document.getElementById('image-url-row').style.display = '';
      document.getElementById('image-upload-row').style.display = 'none';
    } else {
      const err = await res.json();
      alert(`❌ Failed to add product: ${err.error || res.statusText}`);
    }
  } catch (error) {
    alert(`❌ Failed to add product: ${error.message}`);
  }
});

document.addEventListener("DOMContentLoaded", loadProducts);
