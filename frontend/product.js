import { API_BASE_URL } from "./config.js";

let allProducts = [];
let filteredProducts = [];
let itemsToShow = 30;

// Current filter state -- brand filter and search combine (AND), not override
let activeFilter = "ALL";
let searchQuery = "";

// 1. Fixed Brands List
const FIXED_BRANDS = [
    "NIKE", "ADIDAS", "ASICS", "LOUIS VUITTON", "PRADA",
    "RICK OWENS", "CHANEL", "DIOR", "LANVIN", "MAISON MIHARA",
    "PUMA", "TIMBERLAND", "AIRPODS", "DSN", "ALO",
    "OC", "LULULEMON", "ESSENTIALS", "Canada Goose", "Moncler", "Ralph Lauren","Burberry", "Parajumpers"
];

async function loadProducts() {
    const grid = document.getElementById("product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        allProducts = await res.json();

        if (allProducts.length > 0) {
            renderFixedFilters();
            applyFilters();
        } else {
            grid.innerHTML = `<p class="empty-msg">The archives are currently empty.</p>`;
        }
    } catch (err) {
        grid.innerHTML = `<p class="empty-msg">Archive sync unavailable.</p>`;
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

// Recompute filteredProducts from BOTH the active brand filter and the
// search query together, so neither one silently overrides the other.
function applyFilters() {
    let result = allProducts;

    if (activeFilter !== "ALL") {
        const regex = new RegExp(`\\b${activeFilter}\\b`, 'i');
        result = result.filter(p => regex.test(p.name.toUpperCase()));
    }

    if (searchQuery) {
        const query = searchQuery.toUpperCase();
        result = result.filter(p => {
            const name = p.name.toUpperCase();
            const desc = (p.description || "").toUpperCase();
            return name.includes(query) || desc.includes(query);
        });
    }

    filteredProducts = result;
    renderInitialGrid();
}

// Logic to handle the "30 products per page" requirement
function renderInitialGrid() {
    itemsToShow = 30;
    const toRender = filteredProducts.slice(0, itemsToShow);
    renderGrid(toRender);
    updateResultsMeta();
    updateLoadMoreVisibility();
}

function updateResultsMeta() {
    const meta = document.getElementById("resultsMeta");
    if (!meta) return;

    if (filteredProducts.length === 0) {
        meta.textContent = "";
        return;
    }

    const count = filteredProducts.length;
    const noun = count === 1 ? "piece" : "pieces";
    const parts = [`${count} ${noun}`];
    if (activeFilter !== "ALL") parts.push(activeFilter);
    if (searchQuery) parts.push(`"${searchQuery}"`);
    meta.textContent = parts.length > 1
        ? `${count} ${noun} — ${parts.slice(1).join(", ")}`
        : `${count} ${noun}`;
}

function renderFixedFilters() {
    const filterContainer = document.getElementById("dynamic-filters");
    if (!filterContainer) return;

    let filterHTML = `<li><button class="filter-btn active" data-filter="ALL">ALL</button></li>`;
    filterHTML += FIXED_BRANDS.map(brand => `
        <li><button class="filter-btn" data-filter="${brand}">${brand}</button></li>
    `).join('');

    filterContainer.innerHTML = filterHTML;

    // Use a timeout to ensure the browser has calculated the width
    // before we force it to the left.
    setTimeout(() => {
        filterContainer.scrollLeft = 0;
        // Verify with a second method for mobile browsers
        filterContainer.scrollTo({ left: 0, behavior: 'instant' });

        // Refresh arrow visibility (if you used the code from the previous step)
        if (typeof updateArrowVisibility === "function") {
            updateArrowVisibility();
        }
    }, 10);

    setupFilterEvents();
}

function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.currentTarget;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');

            activeFilter = target.getAttribute('data-filter');
            applyFilters();
        };
    });
}

function isSoldOut(p) {
    return (p.availability || "").toLowerCase().includes("sold");
}

function renderGrid(products) {
    const grid = document.getElementById("product-grid");
    if (!grid) return;

    if (products.length === 0) {
        const hasActiveQuery = activeFilter !== "ALL" || searchQuery;
        grid.innerHTML = hasActiveQuery
            ? `<p class="empty-msg">No pieces match your search.<span class="clear-link" id="clearFiltersLink">Clear search &amp; filters</span></p>`
            : `<p class="empty-msg">The archives are currently empty.</p>`;

        const clearLink = document.getElementById("clearFiltersLink");
        if (clearLink) clearLink.onclick = resetFiltersAndSearch;
        return;
    }

    grid.innerHTML = products.map((p, i) => {
        const soldOut = isSoldOut(p);
        return `
        <a href="single-product.html?id=${p.id}" class="product-card-link">
            <div class="product-card ${soldOut ? 'is-sold-out' : ''}">
                <div class="product-img-frame">
                    ${soldOut ? '<span class="sold-out-tag">Sold Out</span>' : ''}
                    <img src="${p.image}" alt="${p.name}" loading="${i < 8 ? 'eager' : 'lazy'}" decoding="async">
                </div>
                <div class="product-details">
                    <span class="product-cat">${p.quality}</span>
                    <h3>${p.name}</h3>
                </div>
            </div>
        </a>
    `;
    }).join('');
}

function resetFiltersAndSearch() {
    activeFilter = "ALL";
    searchQuery = "";

    const searchInput = document.getElementById("archiveSearch");
    if (searchInput) searchInput.value = "";
    toggleClearButton();

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.filter-btn[data-filter="ALL"]');
    if (allBtn) allBtn.classList.add('active');

    applyFilters();
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

// Search Logic -- combines with the active brand filter instead of
// silently replacing it (see applyFilters).
const searchInput = document.getElementById('archiveSearch');
const clearSearchBtn = document.getElementById('clearSearch');

function toggleClearButton() {
    if (!clearSearchBtn || !searchInput) return;
    clearSearchBtn.classList.toggle('show', searchInput.value.length > 0);
}

if (searchInput) {
    searchInput.oninput = (e) => {
        searchQuery = e.target.value.trim();
        toggleClearButton();
        applyFilters();
    };
}

if (clearSearchBtn) {
    clearSearchBtn.onclick = () => {
        searchQuery = "";
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }
        toggleClearButton();
        applyFilters();
    };
}

window.onload = () => {
    setupScrollArrows();
    loadProducts();
};
