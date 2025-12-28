import { API_BASE_URL } from "./config.js";
import { addToCart } from "./cart.js";

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    // 1. Validate Product ID exists in URL
    if (!productId) {
        console.error("No product ID provided in URL");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${productId}`);
        
        // 2. CHECK RESPONSE: If status is 404 or 500, throw error instead of parsing
        if (!res.ok) {
            throw new Error(`Product not found (Status: ${res.status})`);
        }

        const product = await res.json();

        // 3. POPULATE PAGE with safety fallbacks
        const els = {
            title: document.getElementById('productTitle'),
            price: document.getElementById('productPrice'),
            image: document.getElementById('productImage'),
            desc: document.getElementById('productDescription'),
            cat: document.getElementById('productCategory'),
            btn: document.getElementById('messageBtn')
        };

        if (els.title) els.title.innerText = product.name || product.title || "Unknown Product";
        if (els.price) els.price.innerText = product.price || "Contact for Price";
        if (els.image) els.image.src = product.image_url || product.image || "";
        if (els.desc) els.desc.innerText = product.description || "No description available for this archive piece.";
        if (els.cat) els.cat.innerText = product.category || "Premium Archive";

        // 4. ADD TO SELECTION EVENT
        if (els.btn) {
            els.btn.onclick = () => {
                addToCart(product);
            };
        }

    } catch (err) {
        // 5. USER-FRIENDLY ERROR UI
        console.error("Error loading product:", err);
        const mainContainer = document.querySelector('.product-info-column');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="error-state" style="padding: 40px 0;">
                    <h1 class="product-name">Product Unavailable</h1>
                    <p class="description-text">We couldn't retrieve this item from the archives. It may have been moved or removed.</p>
                    <a href="product.html" class="primary-btn" style="display:inline-block; text-decoration:none; text-align:center;">Back to Collection</a>
                </div>
            `;
        }
    }
});