import { API_BASE_URL } from "./config.js";

async function loadFeaturedProducts() {
    const grid = document.getElementById("featured-product-grid");
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`);
        const allProducts = await res.json();
        
        // Take only the first 4 products for the homepage
        const featured = allProducts.slice(0, 4);

        if (featured.length > 0) {
            grid.innerHTML = featured.map(p => `
                <a href="single-product.html?id=${p.id}" class="product-card-link">
                    <div class="product-card">
                        <div class="product-img-frame">
                            <img src="${p.image}" alt="${p.name}">
                        </div>
                        <div class="product-details">
                            <span class="product-cat">${p.quality || 'Premium'}</span>
                            <h3>${p.name}</h3>
                        </div>
                    </div>
                </a>
            `).join('');
        } else {
            grid.innerHTML = `<p>No products available.</p>`;
        }
    } catch (err) {
        grid.innerHTML = `<p>Unable to load featured products.</p>`;
    }
}

window.addEventListener('DOMContentLoaded', loadFeaturedProducts);