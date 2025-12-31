import { API_BASE_URL } from "./config.js";

/* -------------------------------------------------------
    GLOBAL STATE
------------------------------------------------------- */
let allProducts = [];      // Raw data from server
let filteredProducts = []; // Data after search/filtering
let currentPage = 1;
const itemsPerPage = 10;

/* -------------------------------------------------------
    SELECTORS & INITIALIZATION
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    setupSearch(); // Initialize search listener
});

// Search Logic
function setupSearch() {
    const searchInput = document.getElementById("productSearchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        
        // Filter from the master list
        filteredProducts = allProducts.filter(p => 
            p.name.toLowerCase().includes(term) || 
            p.id.toString().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
        );

        currentPage = 1; // Reset to page 1 on search
        updateUI();
    });
}

/* -------------------------------------------------------
    IMAGE TYPE SWITCHERS
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
        if (urlInput) urlInput.required = isUrl;
        if (fileInput) fileInput.required = !isUrl;
    });
});

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
    LOAD PRODUCTS
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
        // Sort: Highest sort_index first
        allProducts.sort((a, b) => (b.sort_index || 0) - (a.sort_index || 0));
        
        // Initially, filtered products is just the full list
        filteredProducts = [...allProducts];

        if (!allProducts.length) {
            tbody.innerHTML = "<tr><td colspan='7'>No inventory recorded.</td></tr>";
            return;
        }

        updateUI();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='7'>Sync Error: ${err.message}</td></tr>`;
    }
}

/* -------------------------------------------------------
    RENDER LOGIC (Uses filteredProducts)
------------------------------------------------------- */
function renderTablePage() {
    const tbody = document.querySelector("#product-table tbody");
    if (!tbody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pagedProducts = filteredProducts.slice(startIndex, endIndex);

    if (pagedProducts.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:20px;'>No matching products found.</td></tr>";
        return;
    }

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

    // Re-attach listeners
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

function renderPaginationControls() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const pageNumbersDiv = document.getElementById('page-numbers');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (!pageNumbersDiv) return;
    pageNumbersDiv.innerHTML = "";

    // Hide pagination if only 1 page or 0 results
    if (totalPages <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        return;
    } else {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
    }

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
    nextBtn.disabled = (currentPage === totalPages);

    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; updateUI(); } };
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; updateUI(); } };
}

function updateUI() {
    renderTablePage();
    renderPaginationControls();
}

/* -------------------------------------------------------
    DELETE & MODAL LOGIC (Existing)
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

function openEditModal(p) {
    document.getElementById('edit-sort-index').value = p.sort_index || 0;
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("edit-name").value = p.name || "";
    document.getElementById("edit-description").value = p.description || "";
    document.getElementById("edit-image").value = p.image || "";
    document.getElementById("edit-gender").value = p.gender || "";
    document.getElementById("edit-quality").value = p.quality || "";
    document.getElementById("edit-availability").value = p.availability || "";

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
    FORM SUBMISSIONS (Existing)
------------------------------------------------------- */
document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const fd = new FormData(e.target);
    const sortIdx = document.getElementById('add-sort-index')?.value || 0;
    fd.append("sort_index", sortIdx);

    const imageType = e.target.querySelector('input[name="imageType"]:checked').value;
    if (imageType === "url") {
        fd.delete("imageUpload");
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });
        if (res.ok) { alert("Product published."); e.target.reset(); loadProducts(); }
    } catch (error) { console.error("Add failed:", error); }
});

document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    
    
    // Use the name attributes from HTML for basic fields
    const fd = new FormData(e.target);
    const sortIdx = document.getElementById('add-sort-index')?.value || 0;
    fd.append("sort_index", sortIdx);
    // Inside your submit listener:
    fd.append("is_most_wanted", document.getElementById("edit-most-wanted").checked);

    const imageType = e.target.querySelector('input[name="imageType"]:checked').value;
    
    if (imageType === "upload") {
        const fileIn = document.querySelector('input[name="imageUpload"]');
        if (fileIn.files[0]) {
            // MATCHING BACKEND: append as 'imageFile'
            fd.append("imageFile", fileIn.files[0]);
        }
        // Clean up the original name to avoid confusion
        fd.delete("imageUpload"); 
    } else {
        fd.delete("imageUpload");
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd // Browser handles Content-Type automatically
        });

        if (res.ok) { 
            alert("Product published."); 
            e.target.reset(); 
            loadProducts(); 
        } else {
            const errorData = await res.json();
            alert(`Upload failed: ${errorData.error || 'Check server logs'}`);
        }
    } catch (error) { 
        console.error("Add failed:", error); 
    }
});