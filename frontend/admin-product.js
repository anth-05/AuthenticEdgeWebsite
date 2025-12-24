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
        if (res.ok) loadProducts();
    } catch (e) {
        console.error("Deletion error:", e);
    }
}

/* -------------------------------------------------------
   EDIT MODAL LOGIC
------------------------------------------------------- */
function openEditModal(p) {
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("edit-name").value = p.name || "";
    document.getElementById("edit-description").value = p.description || "";
    document.getElementById("edit-image").value = p.image || "";
    document.getElementById("edit-gender").value = p.gender || "";
    document.getElementById("edit-quality").value = p.quality || "";
    document.getElementById("edit-availability").value = p.availability || "";

    const modal = document.getElementById("edit-modal");
    if (modal) modal.style.display = "flex";
}

window.closeEditModal = () => {
    const modal = document.getElementById("edit-modal");
    if (modal) modal.style.display = "none";
};

// Update Logic
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

/* -------------------------------------------------------
   ADD PRODUCT FUNCTION (FIXED ACCESSORS)
------------------------------------------------------- */
document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const form = e.target;
    
    // Safer way to find checked radio
    const imageType = form.querySelector('input[name="imageType"]:checked').value;

    const fd = new FormData();
    // Use .elements to avoid "undefined" errors
    fd.append("name", form.elements["name"].value.trim());
    fd.append("description", form.elements["description"].value.trim());
    fd.append("gender", form.elements["gender"].value.trim());
    fd.append("quality", form.elements["quality"].value.trim());
    fd.append("availability", form.elements["availability"].value.trim() || "In Stock");

    if (imageType === "upload") {
        const fileInput = form.querySelector('input[name="imageUpload"]');
        if (!fileInput.files[0]) return alert("Please select a file.");
        fd.append("imageFile", fileInput.files[0]); 
    } else {
        const imageUrl = form.elements["image"].value.trim();
        if (!imageUrl) return alert("Please enter a URL.");
        fd.append("image", imageUrl); 
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });

        if (res.ok) {
            alert("Product published.");
            form.reset();
            loadProducts();
        } else {
            const errorText = await res.text();
            console.error("Server says:", errorText);
        }
    } catch (error) {
        console.error("Add failed:", error);
    }
});

document.addEventListener("DOMContentLoaded", loadProducts);