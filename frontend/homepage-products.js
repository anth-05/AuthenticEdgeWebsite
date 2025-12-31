import { API_BASE_URL } from "./config.js";
async function loadHomepageProducts() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        const allProducts = await res.json();

        // 1. New Arrivals (Top 4 latest)
        const newArrivals = allProducts.slice(0, 4);
        renderGrid(document.getElementById('featured-product-grid'), newArrivals);

        // 2. Most Wanted (Filtered by your admin choice)
        const mostWanted = allProducts.filter(p => p.is_most_wanted === true);
        renderGrid(document.getElementById('most-wanted-grid'), mostWanted);
    } 
    catch (err) {
        console.error("Error loading grids:", err);
    }
}

// Re-usable render function to keep your code clean
function renderGrid(container, productList) {
    if (!container) return;
    if (productList.length === 0) {
        container.innerHTML = "<div class='empty-msg'>Selection arriving soon.</div>";
        return;
    }

    container.innerHTML = productList.map(p => `
        <div class="product-card">
            <a href="single-product.html?id=${p.id}">
                <div class="product-img-frame">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <div class="product-details">
                    <h3>${p.name}</h3>
                    <p class="product-meta">${p.quality || 'Archive'}</p>
                </div>
            </a>
        </div>
    `).join("");
}

document.addEventListener("DOMContentLoaded", loadHomepageProducts);