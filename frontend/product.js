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
    if (!filterContainer) return;

    // 1. Create a set of unique brands found in descriptions
    // We split by spaces and take the first word, but we clean it of punctuation
    const brandSet = new Set();
    
    allProducts.forEach(p => {
        if (p.description) {
            // Extract the first word and remove non-alphanumeric chars (like commas)
            const firstWord = p.description.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-0]/g, "").toUpperCase();
            if (firstWord) brandSet.add(firstWord);
        }
    });

    // 2. Convert Set to Array and Sort
    const brands = Array.from(brandSet).sort();

    // 3. Build the HTML
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
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const filterValue = e.target.getAttribute('data-filter');

            if (filterValue === 'ALL') {
                renderGrid(allProducts);
            } else {
                // BUG FIX: Use .includes() so it finds the brand even if it's not the only word
                const filtered = allProducts.filter(p => {
                    const desc = (p.description || "").toUpperCase();
                    return desc.includes(filterValue); 
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