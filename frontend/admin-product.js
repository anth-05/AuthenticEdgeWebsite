import { API_BASE_URL } from "./config.js";

/* -------------------------------------------------------
    GLOBAL STATE
------------------------------------------------------- */
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 10;

/* -------------------------------------------------------
    SELECTORS & INITIALIZATION
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    setupSearch();
});

function setupSearch() {
    const searchInput = document.getElementById("productSearchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        filteredProducts = allProducts.filter(p => 
            p.name.toLowerCase().includes(term) || 
            p.id.toString().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
        );
        currentPage = 1;
        updateUI();
    });
}

/* -------------------------------------------------------
    IMAGE TYPE SWITCHERS
------------------------------------------------------- */
const handleImageToggle = (radioGroupName, urlRowId, uploadRowId) => {
    const radios = document.querySelectorAll(`input[name="${radioGroupName}"]`);
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isUrl = radio.value === "url";
            document.getElementById(urlRowId).style.display = isUrl ? 'block' : 'none';
            document.getElementById(uploadRowId).style.display = isUrl ? 'none' : 'block';
        });
    });
};

handleImageToggle('imageType', 'image-url-row', 'image-upload-row');
handleImageToggle('editImageType', 'edit-image-url-row', 'edit-upload-row');

/* -------------------------------------------------------
    LOAD & RENDER
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
        allProducts.sort((a, b) => (b.sort_index || 0) - (a.sort_index || 0));
        filteredProducts = [...allProducts];

        updateUI();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='7'>Sync Error: ${err.message}</td></tr>`;
    }
}

function renderTablePage() {
    const tbody = document.querySelector("#product-table tbody");
    if (!tbody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const pagedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    tbody.innerHTML = pagedProducts.map(p => `
        <tr>
            <td data-label="ID/Sort">#${p.id} <br><small>Order: ${p.sort_index || 0}</small></td>
            <td data-label="Preview"><img src="${p.image}" alt="${p.name}" class="product-thumb"></td>
            <td data-label="Product">
                <strong>${p.name}</strong>
                ${p.is_most_wanted ? '<br><span class="badge-wanted">★ MOST WANTED</span>' : ''}
            </td>
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

    attachActionListeners();
}

function attachActionListeners() {
    document.querySelectorAll('.delete-btn').forEach(btn =>
        btn.onclick = () => deleteProduct(btn.dataset.id)
    );
    document.querySelectorAll('.edit-btn').forEach(btn =>
        btn.onclick = () => {
            const product = allProducts.find(item => item.id == btn.dataset.id);
            openEditModal(product);
        }
    );
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
    document.getElementById('edit-sort-index').value = p.sort_index || 0;

    // Handle the "Most Wanted" toggle in Edit only
    const mwCheckbox = document.getElementById("edit-is-most-wanted");
    if (mwCheckbox) mwCheckbox.checked = p.is_most_wanted === true;

    document.getElementById("edit-modal").style.display = "flex";
}

window.closeEditModal = () => {
    document.getElementById("edit-modal").style.display = "none";
};

/* -------------------------------------------------------
    FORM SUBMISSIONS
------------------------------------------------------- */

// ADD PRODUCT (Cleaner, no Most Wanted here)
document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const fd = new FormData(e.target);
    
    // Ensure file is appended as 'imageFile' for Multer
    const imageType = e.target.querySelector('input[name="imageType"]:checked').value;
    if (imageType === "upload") {
        const fileIn = e.target.querySelector('input[name="imageUpload"]');
        if (fileIn.files[0]) fd.append("imageFile", fileIn.files[0]);
    }
    fd.delete("imageUpload");

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });
        if (res.ok) { 
            alert("Product published."); 
            e.target.reset(); 
            loadProducts(); 
        }
    } catch (error) { console.error("Add failed:", error); }
});

// EDIT PRODUCT (Includes Most Wanted)
document.getElementById("edit-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const id = document.getElementById("edit-product-id").value;
    const fd = new FormData(e.target);

    // Explicitly add Most Wanted boolean
    const mwCheckbox = document.getElementById("edit-is-most-wanted");
    fd.append("is_most_wanted", mwCheckbox ? mwCheckbox.checked : false);

    // Correct file field for Multer
    const imageType = e.target.querySelector('input[name="editImageType"]:checked').value;
    if (imageType === "upload") {
        const fileIn = document.getElementById('edit-image-upload');
        if (fileIn.files[0]) fd.append("imageFile", fileIn.files[0]);
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });
        if (res.ok) { 
            alert("Product updated."); 
            closeEditModal(); 
            loadProducts(); 
        }
    } catch (error) { console.error("Update error:", error); }
});

// Helper UI updates
function updateUI() {
    renderTablePage();
    renderPaginationControls();
}

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

function renderPaginationControls() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const pageNumbersDiv = document.getElementById('page-numbers');
    if (!pageNumbersDiv) return;
    pageNumbersDiv.innerHTML = "";
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const span = document.createElement('span');
        span.innerText = i;
        span.className = `page-num ${i === currentPage ? 'active' : ''}`;
        span.onclick = () => { currentPage = i; updateUI(); };
        pageNumbersDiv.appendChild(span);
    }
}