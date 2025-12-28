import { API_BASE_URL } from "./config.js";

/* -------------------------------------------------------
   GLOBAL STATE FOR PAGINATION
------------------------------------------------------- */
let allProducts = [];
let currentPage = 1;
const itemsPerPage = 10;

/* -------------------------------------------------------
   SELECTORS
------------------------------------------------------- */
// Add Form Selectors
const radioGroup = document.querySelectorAll('input[name="imageType"]');
const urlRow = document.getElementById('image-url-row');
const uploadRow = document.getElementById('image-upload-row');
const urlInput = document.querySelector('input[name="image"]');
const fileInput = document.querySelector('input[name="imageUpload"]');

// Edit Modal Selectors
const editUrlRow = document.getElementById('edit-image-url-row');
const editUploadRow = document.getElementById('edit-image-upload-row');
const editRadioGroup = document.querySelectorAll('input[name="editImageType"]');

/* -------------------------------------------------------
   IMAGE TYPE SWITCHERS (URL ↔ FILE)
------------------------------------------------------- */
// Main Add Form Switcher
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

// Edit Modal Switcher
editRadioGroup.forEach(radio => {
    radio.addEventListener('change', () => {
        const isUrl = radio.value === "url";
        if (editUrlRow) editUrlRow.style.display = isUrl ? 'block' : 'none';
        if (editUploadRow) editUploadRow.style.display = isUrl ? 'none' : 'block';
    });
});

/* -------------------------------------------------------
   LOAD PRODUCTS (FETCH & SORT)
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
        allProducts = await res.json();
        
        // Sort: Highest sort_index appears first
        allProducts.sort((a, b) => (b.sort_index || 0) - (a.sort_index || 0));

        if (!allProducts.length) {
            tbody.innerHTML = "<tr><td colspan='7'>No inventory recorded.</td></tr>";
            return;
        }

        renderTablePage();
        renderPaginationControls();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='7'>Sync Error: ${err.message}</td></tr>`;
    }
}

/* -------------------------------------------------------
   RENDER TABLE (SLICE BY PAGE)
------------------------------------------------------- */
function renderTablePage() {
    const tbody = document.querySelector("#product-table tbody");
    if (!tbody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pagedProducts = allProducts.slice(startIndex, endIndex);

    // Inside renderTablePage pagedProducts.map:
    tbody.innerHTML = pagedProducts.map(p => `
        <tr>
            <td data-label="ID/Sort">#${p.id} <br><small>Order: ${p.sort_index || 0}</small></td>
            <td data-label="Preview"><img src="${p.image}" alt="${p.name}" class="product-thumb"></td>
            <td data-label="Product"><strong>${p.name}</strong></td>
            <td data-label="Gender">${p.gender || "—"}</td>
            <td data-label="Quality">${p.quality || "Standard"}</td>
            <td data-label="Status">${p.availability || "In Stock"}</td>
            <td data-label="Actions">
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
            const product = allProducts.find(item => item.id == btn.dataset.id);
            openEditModal(product);
        })
    );
}

/* -------------------------------------------------------
   PAGINATION CONTROLS (Max 4 numbers)
------------------------------------------------------- */
function renderPaginationControls() {
    const totalPages = Math.ceil(allProducts.length / itemsPerPage);
    const pageNumbersDiv = document.getElementById('page-numbers');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (!pageNumbersDiv) return;
    pageNumbersDiv.innerHTML = "";

    const maxVisible = 4;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = startPage + maxVisible - 1;

    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const span = document.createElement('span');
        span.innerText = i;
        span.className = `page-num ${i === currentPage ? 'active' : ''}`;
        span.onclick = () => {
            currentPage = i;
            updateUI();
        };
        pageNumbersDiv.appendChild(span);
    }

    prevBtn.disabled = (currentPage === 1);
    nextBtn.disabled = (currentPage === totalPages || totalPages === 0);

    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            updateUI();
        }
    };

    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateUI();
        }
    };
}

function updateUI() {
    renderTablePage();
    renderPaginationControls();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
   MODAL LOGIC
------------------------------------------------------- */
function openEditModal(p) {
    document.getElementById('edit-sort-index').value = p.sort_index || 0;
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("edit-name").value = p.name || "";
    document.getElementById("edit-description").value = p.description || "";
    document.getElementById("edit-image").value = p.image || "";
    document.getElementById("edit-gender").value = p.gender || "";
    document.getElementById("edit-quality").value = p.quality || "";
    document.getElementById("edit-availability").value = p.availability || "";

    // Reset view to URL by default
    const urlRadio = document.querySelector('input[name="editImageType"][value="url"]');
    if (urlRadio) urlRadio.checked = true;
    
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
   FORM SUBMISSIONS
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

/* -------------------------------------------------------
   BACK TO TOP & INITIALIZATION
------------------------------------------------------- */
const initBackToTop = () => {
    const topBtn = document.getElementById("backToTop");
    if (!topBtn) return;
    window.addEventListener("scroll", () => {
        if (window.pageYOffset > 400) topBtn.classList.add("active");
        else topBtn.classList.remove("active");
    });
    topBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
};

initBackToTop();
document.addEventListener("DOMContentLoaded", loadProducts);