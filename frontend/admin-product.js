import { API_BASE_URL } from "./config.js";

/* -------------------------------------------------------
   IMAGE TYPE SWITCHER (URL ↔ FILE)
------------------------------------------------------- */
const radioGroup = document.querySelectorAll('input[name="imageType"]');
const urlRow = document.getElementById('image-url-row');
const uploadRow = document.getElementById('image-upload-row');

radioGroup.forEach(radio => {
    radio.addEventListener('change', () => {
        const isUrl = radio.value === "url";
        if (urlRow) urlRow.style.display = isUrl ? 'block' : 'none';
        if (uploadRow) uploadRow.style.display = isUrl ? 'none' : 'block';
    });
});

/* -------------------------------------------------------
   LOAD PRODUCTS INTO TABLE
------------------------------------------------------- */
async function loadProducts() {
    const token = localStorage.getItem("token");
    const tbody = document.querySelector("#product-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='7' class='loading-state'>Processing inventory...</td></tr>";

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Unauthorized access");

        const products = await res.json();
        
        if (!products.length) {
            tbody.innerHTML = "<tr><td colspan='7'>No inventory recorded.</td></tr>";
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>#${p.id}</td>
                <td><img src="${p.image}" alt="${p.name}" class="product-thumb"></td>
                <td><strong>${p.name}</strong></td>
                <td>${p.gender || "—"}</td>
                <td><span class="quality-tag">${p.quality || "Standard"}</span></td>
                <td>${p.availability || "In Stock"}</td>
                <td>
                    <div class="action-cell">
                        <button class="text-link-btn edit-btn" data-id="${p.id}">Edit</button>
                        <button class="text-link-btn delete-btn" data-id="${p.id}" style="color: #d00000;">Remove</button>
                    </div>
                </td>
            </tr>
        `).join("");

        // Attach Event Listeners
        tbody.querySelectorAll('.delete-btn').forEach(btn =>
            btn.addEventListener('click', () => deleteProduct(btn.dataset.id))
        );

        tbody.querySelectorAll('.edit-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                const product = products.find(item => item.id == btn.dataset.id);
                openEditModal(product);
            })
        );

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='7'>Sync Error: ${err.message}</td></tr>`;
    }
}

/* -------------------------------------------------------
   DELETE PRODUCT
------------------------------------------------------- */
async function deleteProduct(id) {
    if (!confirm("Remove this item from the collection?")) return;
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            loadProducts();
        } else {
            const err = await res.json();
            alert(err.error || "Action failed");
        }
    } catch (e) {
        console.error("Deletion error:", e);
    }
}

/* -------------------------------------------------------
   EDIT MODAL LOGIC
------------------------------------------------------- */
/* -------------------------------------------------------
   EDIT MODAL LOGIC
------------------------------------------------------- */
function openEditModal(p) {
    // Populate the hidden ID field
    document.getElementById("edit-product-id").value = p.id;
    
    // Populate text fields
    document.getElementById("edit-name").value = p.name || "";
    document.getElementById("edit-description").value = p.description || "";
    document.getElementById("edit-image").value = p.image || "";
    document.getElementById("edit-gender").value = p.gender || "";
    document.getElementById("edit-quality").value = p.quality || "";
    document.getElementById("edit-availability").value = p.availability || "";

    const modal = document.getElementById("edit-modal");
    if (modal) {
        modal.style.display = "flex";
    }
}

// Global scope for the cancel button
window.closeEditModal = () => {
    const modal = document.getElementById("edit-modal");
    if (modal) modal.style.display = "none";
};

/* -------------------------------------------------------
   SUBMIT UPDATE
------------------------------------------------------- */
document.getElementById("edit-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const id = document.getElementById("edit-product-id").value;

    const updatedProduct = {
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
            body: JSON.stringify(updatedProduct)
        });

        if (res.ok) {
            window.closeEditModal();
            loadProducts(); // Refresh the table
            alert("Inventory updated.");
        } else {
            const errData = await res.json();
            alert(`Error: ${errData.error || "Update failed"}`);
        }
    } catch (error) {
        console.error("Update failed:", error);
        alert("Server connection failed.");
    }
});
/* -------------------------------------------------------
   SUBMIT PRODUCT (ADD & UPDATE)
------------------------------------------------------- */
// Update Product
document.getElementById("edit-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const id = document.getElementById("edit-product-id").value;

    const updated = {
        name: document.getElementById("edit-name").value,
        description: document.getElementById("edit-description").value,
        image: document.getElementById("edit-image").value,
        gender: document.getElementById("edit-gender").value,
        quality: document.getElementById("edit-quality").value,
        availability: document.getElementById("edit-availability").value,
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
            window.closeEditModal();
            loadProducts();
        }
    } catch (error) {
        console.error("Update failed:", error);
    }
});

// Add Product
document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const form = e.target;
    const imageType = document.querySelector("input[name='imageType']:checked").value;

    const fd = new FormData();
    fd.append("name", form.name.value.trim());
    fd.append("description", form.description.value.trim());
    fd.append("gender", form.gender.value.trim());
    fd.append("quality", form.quality.value.trim());
    fd.append("availability", form.availability.value.trim());

    if (imageType === "upload") {
        const file = document.getElementById("imageUpload").files[0];
        if (!file) return alert("Select a file to upload.");
        fd.append("imageFile", file);
    } else {
        const url = document.getElementById("image").value.trim();
        if (!url) return alert("Enter image URL.");
        fd.append("image", url); // Note: Server.js expects 'image' for URL
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });

        if (res.ok) {
            form.reset();
            loadProducts();
            alert("Inventory Updated Successfully.");
        }
    } catch (error) {
        console.error("Add failed:", error);
    }
});

document.addEventListener("DOMContentLoaded", loadProducts);