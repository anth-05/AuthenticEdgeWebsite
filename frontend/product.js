import { API_BASE_URL } from "./config.js";

let allProducts = [];
let filteredProducts = []; 
let itemsToShow = 30;

// 1. Fixed Brands List
const FIXED_BRANDS = [
    "Valentijn","NIKE", "ADIDAS", "ASICS", "LOUIS VUITTON", "PRADA", 
    "RICK OWENS", "CHANEL", "DIOR", "LANVIN", "MAISON MIHARA", 
    "PUMA", "TIMBERLAND", "AIRPODS", "DSN", "ALO", 
    "OC", "LULULEMON", "ESSENTIALS", "Canada Goose", "Monlcer", "Raph Lauren","Burberry", "Parajumpers"
];

async function loadProducts() {
    const grid = document.getElementById("product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        allProducts = await res.json();
        filteredProducts = allProducts; // Default state
        
        if (allProducts.length > 0) {
            renderFixedFilters(); 
            renderInitialGrid(); // Load first 30
        } else {
            grid.innerHTML = `<p class="empty-msg">The archives are currently empty.</p>`;
        }
    } catch (err) {
        grid.innerHTML = `<p>Archive sync unavailable.</p>`;
    }
}
function updateArrowVisibility() {
    const list = document.getElementById("dynamic-filters");
    const leftArrow = document.getElementById("scrollLeft");
    const rightArrow = document.getElementById("scrollRight");

    if (!list || !leftArrow || !rightArrow) return;

    // Show left arrow only if we have scrolled right
    leftArrow.style.opacity = list.scrollLeft > 5 ? "1" : "0";
    leftArrow.style.pointerEvents = list.scrollLeft > 5 ? "auto" : "none";

    // Show right arrow only if there is more content to the right
    const maxScroll = list.scrollWidth - list.clientWidth;
    rightArrow.style.opacity = list.scrollLeft >= maxScroll - 5 ? "0" : "1";
    rightArrow.style.pointerEvents = list.scrollLeft >= maxScroll - 5 ? "none" : "auto";
}

// Logic to handle the "30 products per page" requirement
function renderInitialGrid() {
    itemsToShow = 30; 
    const toRender = filteredProducts.slice(0, itemsToShow);
    renderGrid(toRender);
    updateLoadMoreVisibility();
}

function renderFixedFilters() {
    const filterContainer = document.getElementById("dynamic-filters");
    if (!filterContainer) return;

    let filterHTML = `<li><button class="filter-btn active" data-filter="ALL">ALL</button></li>`;
    filterHTML += FIXED_BRANDS.map(brand => `
        <li><button class="filter-btn" data-filter="${brand}">${brand}</button></li>
    `).join('');

    filterContainer.innerHTML = filterHTML;
    
    // Reset scroll and check arrow visibility immediately
    filterContainer.scrollLeft = 0;
    updateArrowVisibility(); 

    setupFilterEvents();
}

function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.currentTarget;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');

            const filterValue = target.getAttribute('data-filter');

            if (filterValue === 'ALL') {
                filteredProducts = allProducts;
            } else {
                // Whole Word Match Logic
                const regex = new RegExp(`\\b${filterValue}\\b`, 'i'); 
                filteredProducts = allProducts.filter(p => 
                    regex.test(p.name.toUpperCase())
                );
            }
            renderInitialGrid();
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

// Handle the "Load More" button appearance and logic
function updateLoadMoreVisibility() {
    let btn = document.getElementById("load-more-btn");
    const container = document.querySelector(".collection-grid-section .container");

    if (!btn && container) {
        btn = document.createElement("button");
        btn.id = "load-more-btn";
        btn.className = "load-more-btn";
        btn.innerText = "LOAD MORE PRODUCTS";
        container.appendChild(btn);
        
        btn.onclick = () => {
            itemsToShow += 30;
            renderGrid(filteredProducts.slice(0, itemsToShow));
            updateLoadMoreVisibility();
        };
    }

    if (btn) {
        btn.style.display = itemsToShow >= filteredProducts.length ? "none" : "block";
    }
}

function setupScrollArrows() {
    const list = document.getElementById("dynamic-filters");
    const leftArrow = document.getElementById("scrollLeft");
    const rightArrow = document.getElementById("scrollRight");

    if (!list || !leftArrow || !rightArrow) return;

    leftArrow.onclick = () => {
        list.scrollBy({ left: -300, behavior: 'smooth' });
    };

    rightArrow.onclick = () => {
        list.scrollBy({ left: 300, behavior: 'smooth' });
    };

    // Update arrows every time the user scrolls
    list.onscroll = () => updateArrowVisibility();
}

// Search Logic
document.getElementById('archiveSearch').oninput = (e) => {
    const query = e.target.value.toUpperCase();
    filteredProducts = allProducts.filter(p => {
        const name = p.name.toUpperCase();
        const desc = (p.description || "").toUpperCase();
        return name.includes(query) || desc.includes(query);
    });
    renderInitialGrid();
};

window.onload = () => {
    setupScrollArrows(); 
    loadProducts(); 
};