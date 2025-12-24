import { API_BASE_URL } from "./config.js";

let allProducts = [];

async function loadProducts() {
    const grid = document.getElementById("product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        allProducts = await res.json();
        
        if (allProducts.length > 0) {
            generateDynamicFilters();
            renderGrid(allProducts);
        } else {
            grid.innerHTML = `<p class="empty-msg">The archives are currently empty.</p>`;
        }
    } catch (err) {
        grid.innerHTML = `<p>Archive sync unavailable.</p>`;
    }
}

function generateDynamicFilters() {
    const filterContainer = document.getElementById("dynamic-filters");
    
    // 1. Extract the first word from every description as the "Brand"
    // We filter out empty descriptions and normalize to Uppercase
    const brands = allProducts
        .map(p => p.description ? p.description.trim().split(' ')[0].toUpperCase() : null)
        .filter((brand, index, self) => brand && self.indexOf(brand) === index); // Remove duplicates

    // 2. Create the "All" button first
    let filterHTML = `<li><button class="filter-btn active" data-filter="ALL">All</button></li>`;

    // 3. Create buttons for each unique brand found (e.g., NIKE, DYSON, ADIDAS)
    filterHTML += brands.map(brand => `
        <li><button class="filter-btn" data-filter="${brand}">${brand}</button></li>
    `).join('');

    filterContainer.innerHTML = filterHTML;

    // 4. Attach Click Events to new buttons
    setupFilterEvents();
}

function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const filterValue = e.target.getAttribute('data-filter');

            if (filterValue === 'ALL') {
                renderGrid(allProducts);
            } else {
                const filtered = allProducts.filter(p => {
                    const brandInDesc = p.description ? p.description.trim().split(' ')[0].toUpperCase() : "";
                    return brandInDesc === filterValue;
                });
                renderGrid(filtered);
            }
        };
    });
}

// Keep your existing renderGrid function here...
function renderGrid(products) {
    const grid = document.getElementById("product-grid");
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