import { API_BASE_URL } from "./config.js";

let allProducts = [];

// 1. Define your fixed brands here
const FIXED_BRANDS = ["NIKE", "ADIDAS", "JORDAN", "YEEZY", "VINTAGE"];

async function loadProducts() {
    const grid = document.getElementById("product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        allProducts = await res.json();
        
        if (allProducts.length > 0) {
            renderFixedFilters(); // Use the new fixed generator
            renderGrid(allProducts);
        } else {
            grid.innerHTML = `<p class="empty-msg">The archives are currently empty.</p>`;
        }
    } catch (err) {
        grid.innerHTML = `<p>Archive sync unavailable.</p>`;
    }
}

function renderFixedFilters() {
    const filterContainer = document.getElementById("dynamic-filters");
    if (!filterContainer) return;

    // Build HTML using the FIXED_BRANDS array
    let filterHTML = `<li><button class="filter-btn active" data-filter="ALL">All</button></li>`;
    filterHTML += FIXED_BRANDS.map(brand => `
        <li><button class="filter-btn" data-filter="${brand}">${brand}</button></li>
    `).join('');

    filterContainer.innerHTML = filterHTML;
    setupFilterEvents();
}

function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target;
            // UI State Update
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');

            const filterValue = target.getAttribute('data-filter');

            if (filterValue === 'ALL') {
                renderGrid(allProducts);
            } else {
                // Filter products that contain the brand name anywhere in the title
                const filtered = allProducts.filter(p => 
                    p.name.toUpperCase().includes(filterValue)
                );
                renderGrid(filtered);
            }
        };
    });
}

function renderGrid(products) {
    const grid = document.getElementById("product-grid");
    if (!grid) return;
    
    grid.innerHTML = products.map(p => `
        <a href="single-product.html?id=${p.id}" class="product-card-link">
            <div class="product-card">
                <div class="product-img-frame">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <div class="product-details">
                    <span class="product-cat">${p.quality}</span>
                    <h3>${p.name}</h3>
                </div>
            </div>
        </a>
    `).join('');
}

// Search Logic
document.getElementById('archiveSearch').oninput = (e) => {
    const query = e.target.value.toUpperCase();
    const filtered = allProducts.filter(p => {
        const name = p.name.toUpperCase();
        const desc = (p.description || "").toUpperCase();
        return name.includes(query) || desc.includes(query);
    });
    renderGrid(filtered);
};

window.onload = loadProducts;