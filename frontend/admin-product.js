import { API_BASE_URL } from "./config.js";

/* -------------------------------------------------------
   IMAGE TYPE SWITCHER (URL ↔ FILE)
------------------------------------------------------- */
document.querySelectorAll('input[name="imageType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isUrl = radio.value === "url";
    document.getElementById('image-url-row').style.display = isUrl ? '' : 'none';
    document.getElementById('image-upload-row').style.display = isUrl ? 'none' : '';
  });
});

/* -------------------------------------------------------
   LOAD PRODUCTS INTO TABLE
------------------------------------------------------- */
async function loadProducts() {
  const token = localStorage.getItem("token");
  const tbody = document.querySelector("#product-table tbody");
  tbody.innerHTML = "<tr><td colspan='7'><em>Loading...</em></td></tr>";

  try {
    const res = await fetch(`${API_BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch products");

    const products = await res.json();
    if (!products.length) {
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
          <button class="edit-btn" data-id="${p.id}">Edit</button>
          <button class="delete-btn" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `).join("");

    // Bind delete
    tbody.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if (confirm("Delete this product?")) deleteProduct(btn.dataset.id);
      })
    );

    // Bind edit
    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const product = products.find(p => p.id == btn.dataset.id);
        openEditModal(product);
      })
    );

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan='7'>Error: ${err.message}</td></tr>`;
  }
}

/* -------------------------------------------------------
   DELETE PRODUCT
------------------------------------------------------- */
async function deleteProduct(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      alert("🗑️ Product deleted.");
      loadProducts();
    } else {
      const err = await res.json();
      alert("❌ " + (err.error || "Failed to delete"));
    }
  } catch (e) {
    alert("❌ Error deleting: " + e.message);
  }
}

/* -------------------------------------------------------
   EDIT MODAL
------------------------------------------------------- */
function openEditModal(p) {
  document.getElementById("edit-product-id").value = p.id;
  document.getElementById("edit-name").value = p.name;
  document.getElementById("edit-description").value = p.description || "";
  document.getElementById("edit-image").value = p.image || "";
  document.getElementById("edit-gender").value = p.gender || "";
  document.getElementById("edit-quality").value = p.quality || "";
  document.getElementById("edit-availability").value = p.availability || "";

  document.getElementById("edit-modal").style.display = "block";
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
}

document.getElementById("edit-cancel").addEventListener("click", closeEditModal);

/* -------------------------------------------------------
   SUBMIT EDITED PRODUCT
------------------------------------------------------- */
document.getElementById("edit-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const id = document.getElementById("edit-product-id").value;

  const updated = {
    name: document.getElementById("edit-name").value.trim(),
    description: document.getElementById("edit-description").value.trim(),
    image: document.getElementById("edit-image").value.trim(),
    gender: document.getElementById("edit-gender").value.trim(),
    quality: document.getElementById("edit-quality").value.trim(),
    availability: document.getElementById("edit-availability").value.trim(),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updated)
    });

    if (res.ok) {
      alert("✅ Product updated!");
      closeEditModal();
      loadProducts();
    } else {
      const err = await res.json();
      alert("❌ " + (err.error || "Update failed"));
    }
  } catch (error) {
    alert("❌ " + error.message);
  }
});

/* -------------------------------------------------------
   ADD NEW PRODUCT (URL OR FILE)
------------------------------------------------------- */
document.getElementById("add-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const form = e.target;

  const imageType = document.querySelector("input[name='imageType']:checked").value;

  const baseData = {
    name: form.name.value.trim(),
    description: form.description.value.trim(),
    gender: form.gender.value.trim(),
    quality: form.quality.value.trim(),
    availability: form.availability.value.trim(),
  };

  if (!baseData.name) {
    return alert("Product name is required.");
  }

  let body;
  let headers;

  // ---- FILE UPLOAD ----
  if (imageType === "upload") {
    const file = document.getElementById("imageUpload").files[0];
    if (!file) return alert("Upload an image file.");

    const fd = new FormData();
    Object.entries(baseData).forEach(([k, v]) => fd.append(k, v));
    fd.append("imageFile", file);

    body = fd;
    headers = { Authorization: `Bearer ${token}` };
  }

  // ---- URL UPLOAD ----
  else {
    const url = document.getElementById("image").value.trim();
    if (!url) return alert("Enter an image URL.");
    baseData.image = url;

    body = JSON.stringify(baseData);
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers,
      body
    });

    const data = await res.json();

    if (res.ok) {
      alert("✅ Product added!");
      form.reset();
      loadProducts();

      document.querySelector('input[name="imageType"][value="url"]').checked = true;
      document.getElementById('image-url-row').style.display = '';
      document.getElementById('image-upload-row').style.display = 'none';
    } else {
      alert("❌ " + (data.error || "Failed to add product"));
    }

  } catch (error) {
    alert("❌ " + error.message);
  }
});

/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", loadProducts);
