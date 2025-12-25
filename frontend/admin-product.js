import { API_BASE_URL } from "./config.js";

/* -------------------------------------------------------
   IMAGE TYPE SWITCHER (URL ↔ FILE)
------------------------------------------------------- */
const radioGroup = document.querySelectorAll('input[name="imageType"]');
const urlRow = document.getElementById('image-url-row');
const uploadRow = document.getElementById('image-upload-row');
const urlInput = document.querySelector('input[name="image"]');
const fileInput = document.querySelector('input[name="imageUpload"]');

radioGroup.forEach(radio => {
    radio.addEventListener('change', () => {
        const isUrl = radio.value === "url";
        if (urlRow) urlRow.style.display = isUrl ? 'block' : 'none';
        if (uploadRow) uploadRow.style.display = isUrl ? 'none' : 'block';

        if (isUrl) {
            if (urlInput) urlInput.required = true;
            if (fileInput) { fileInput.required = false; fileInput.value = ""; }
        } else {
            if (urlInput) { urlInput.required = false; urlInput.value = ""; }
            if (fileInput) fileInput.required = true;
        }
    });
});

/* -------------------------------------------------------
   LOAD PRODUCTS INTO TABLE (Sorted by Custom Order)
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
        let products = await res.json();
        
        // --- ADDED: SORT LOGIC FOR ADMIN TABLE ---
        products.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));

        if (!products.length) {
            tbody.innerHTML = "<tr><td colspan='7'>No inventory recorded.</td></tr>";
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>#${p.id} <br><small style="color:#888">Order: ${p.sort_index || 0}</small></td>
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
    if (!confirm("Remove this item?")) return;
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) loadProducts();
    } catch (e) { console.error(e); }
}

/* -------------------------------------------------------
   OPEN EDIT MODAL
------------------------------------------------------- */
function openEditModal(p) {
    // Fixed: changed 'product' to 'p' to match function parameter
    document.getElementById('edit-sort-index').value = p.sort_index || 0;
    
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("edit-name").value = p.name || "";
    document.getElementById("edit-description").value = p.description || "";
    document.getElementById("edit-image").value = p.image || "";
    document.getElementById("edit-gender").value = p.gender || "";
    document.getElementById("edit-quality").value = p.quality || "";
    document.getElementById("edit-availability").value = p.availability || "";

    document.querySelector('input[name="editImageType"][value="url"]').checked = true;
    if (editUrlRow) editUrlRow.style.display = 'block';
    if (editUploadRow) editUploadRow.style.display = 'none';

    const modal = document.getElementById("edit-modal");
    if (modal) modal.style.display = "flex";
}

window.closeEditModal = () => {
    const modal = document.getElementById("edit-modal");
    if (modal) modal.style.display = "none";
};

/* -------------------------------------------------------
   SUBMIT ADD PRODUCT (Including Sort Order)
------------------------------------------------------- */
document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const form = e.target;
    const fd = new FormData();

    const imageType = form.querySelector('input[name="imageType"]:checked').value;
    
    fd.append("name", form.elements["name"].value.trim());
    fd.append("description", form.elements["description"].value.trim());
    fd.append("gender", form.elements["gender"].value.trim());
    fd.append("quality", form.elements["quality"].value.trim());
    fd.append("availability", form.elements["availability"]?.value.trim() || "In Stock");
    
    // --- ADDED: GRAB SORT INDEX FROM ADD FORM ---
    const sortIdx = form.querySelector('#add-sort-index')?.value || 0;
    fd.append("sort_index", sortIdx);

    if (imageType === "upload") {
        const fileIn = form.querySelector('input[name="imageUpload"]');
        if (fileIn.files[0]) fd.append("imageFile", fileIn.files[0]); 
    } else {
        fd.append("image", form.elements["image"].value.trim()); 
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
        }
    } catch (error) { console.error("Add failed:", error); }
});

/* -------------------------------------------------------
   EDIT MODAL IMAGE SWITCHER
------------------------------------------------------- */
const editRadioGroup = document.querySelectorAll('input[name="editImageType"]');
const editUrlRow = document.getElementById('edit-image-url-row');
const editUploadRow = document.getElementById('edit-image-upload-row');

editRadioGroup.forEach(radio => {
    radio.addEventListener('change', () => {
        const isUrl = radio.value === "url";
        if (editUrlRow) editUrlRow.style.display = isUrl ? 'block' : 'none';
        if (editUploadRow) editUploadRow.style.display = isUrl ? 'none' : 'block';
    });
});

/* -------------------------------------------------------
   SUBMIT EDIT PRODUCT (Including Sort Order)
------------------------------------------------------- */
document.getElementById("edit-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const id = document.getElementById("edit-product-id").value;

    const fd = new FormData();
    fd.append("name", document.getElementById("edit-name").value.trim());
    fd.append("description", document.getElementById("edit-description").value.trim());
    fd.append("gender", document.getElementById("edit-gender").value.trim());
    fd.append("quality", document.getElementById("edit-quality").value.trim());
    fd.append("availability", document.getElementById("edit-availability").value.trim());
    
    // --- ADDED: GRAB SORT INDEX FROM EDIT MODAL ---
    fd.append("sort_index", document.getElementById("edit-sort-index").value);

    const imageType = document.querySelector('input[name="editImageType"]:checked').value;
    
    if (imageType === "upload") {
        const fileIn = document.getElementById('edit-image-upload');
        if (fileIn.files[0]) fd.append("imageFile", fileIn.files[0]);
    } else {
        fd.append("image", document.getElementById("edit-image").value.trim());
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });

        if (res.ok) {
            alert("Product updated successfully.");
            closeEditModal();
            loadProducts();
        }
    } catch (error) { console.error("Update error:", error); }
});

document.addEventListener("DOMContentLoaded", loadProducts);