import { API_BASE_URL } from "./config.js";

let allProducts = [];

async function loadProducts() {
    const grid = document.getElementById("product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        allProducts = await res.json();
        
        if (allProducts.length > 0) {
            // Re-enabling the dynamic filter generation
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
    if (!filterContainer) return;

    // Extract unique first words and clean them
    const brandSet = new Set();
    allProducts.forEach(p => {
        if (p.name) {
            // regex removes non-alphanumeric chars to prevent "Nike," or "Adidas!"
            const firstWord = p.name.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            if (firstWord) brandSet.add(firstWord);
        }
    });

    const brands = Array.from(brandSet).sort();

    // Build the HTML for the tab buttons
    let filterHTML = `<li><button class="filter-btn active" data-filter="ALL">All</button></li>`;
    filterHTML += brands.map(brand => `
        <li><button class="filter-btn" data-filter="${brand}">${brand}</button></li>
    `).join('');

    filterContainer.innerHTML = filterHTML;
    setupFilterEvents();
}

function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            // UI Update
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const filterValue = e.target.getAttribute('data-filter');

            if (filterValue === 'ALL') {
                renderGrid(allProducts);
            } else {
                // Filters by checking if the first word matches the selected tab
                const filtered = allProducts.filter(p => {
                    const name = (p.name || "").toUpperCase();
                    // We use startsWith to strictly follow the "first word" tab logic
                    return name.startsWith(filterValue); 
                });
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