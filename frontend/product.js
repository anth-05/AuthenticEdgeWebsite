import { API_BASE_URL } from "./config.js";

let allProducts = [];

// 1. Updated list with your specific brands
const FIXED_BRANDS = [
    "NIKE", "ADIDAS", "ASICS", "LOUIS VUITTON", "PRADA", 
    "RICK OWENS", "CHANEL", "DIOR", "LANVIN", "MAISON MIHARA", 
    "PUMA", "TIMBERLAND", "APPLE", "DYSON", "ALO", 
    "OC", "LULULEMON", "ESSENTIALS"
];

async function loadProducts() {
    const grid = document.getElementById("product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        allProducts = await res.json();
        
        if (allProducts.length > 0) {
            renderFixedFilters(); 
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
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');

            const filterValue = target.getAttribute('data-filter');

            if (filterValue === 'ALL') {
                renderGrid(allProducts);
            } else {
                // Matches the brand name anywhere in the product title
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
function setupScrollArrows() {
    const list = document.getElementById("dynamic-filters");
    const leftArrow = document.getElementById("scrollLeft");
    const rightArrow = document.getElementById("scrollRight");

    if (!list || !leftArrow || !rightArrow) return;

    // Amount to scroll on each click
    const scrollAmount = 300; 

    leftArrow.onclick = () => {
        list.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    };

    rightArrow.onclick = () => {
        list.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    };

    // Optional: Hide/Show arrows based on scroll position
    list.onscroll = () => {
        leftArrow.style.opacity = list.scrollLeft > 0 ? "1" : "0";
        leftArrow.style.pointerEvents = list.scrollLeft > 0 ? "auto" : "none";
        
        const maxScroll = list.scrollWidth - list.clientWidth;
        rightArrow.style.opacity = list.scrollLeft >= maxScroll ? "0" : "1";
        rightArrow.style.pointerEvents = list.scrollLeft >= maxScroll ? "none" : "auto";
    };
}

// CALL THIS INSIDE window.onload OR AFTER renderFixedFilters()

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

window.onload = () => {setupScrollArrows(); loadProducts(); };