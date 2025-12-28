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
        console.log(`Fetching product from: ${API_BASE_URL}/api/products/${productId}`);
        const res = await fetch(`${API_BASE_URL}/api/products/${productId}`);
        
        // 2. CHECK RESPONSE: Stop here if 404 to avoid the "Unexpected token <" error
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(`Product ID ${productId} does not exist in the database.`);
            }
            throw new Error(`Server Error: ${res.status}`);
        }

        const product = await res.json();

        // 3. POPULATE PAGE
        const els = {
            title: document.getElementById('productTitle'),
            price: document.getElementById('productPrice'),
            image: document.getElementById('productImage'),
            desc: document.getElementById('productDescription'),
            cat: document.getElementById('productCategory'),
            btn: document.getElementById('messageBtn')
        };

        if (els.title) els.title.innerText = product.name || product.title;
        if (els.price) els.price.innerText = product.price || "Contact for Price";
        if (els.image) els.image.src = product.image_url || product.image;
        if (els.desc) els.desc.innerText = product.description || "No description available.";
        if (els.cat) els.cat.innerText = product.category || "Premium Archive";

        // 4. ADD TO SELECTION
        if (els.btn) {
            els.btn.onclick = () => addToCart(product);
        }

    } catch (err) {
        // 5. GRACEFUL ERROR UI
        console.error("Error loading product:", err.message);
        
        const mainContainer = document.querySelector('.product-info-column');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="error-state" style="padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                    <h1 class="product-name" style="font-size: 1.5rem;">Archive Item Not Found</h1>
                    <p class="description-text">The product with ID <strong>${productId}</strong> could not be located.</p>
                    <a href="product.html" class="primary-btn" style="display:block; text-align:center; text-decoration:none; margin-top:20px;">Return to Shop</a>
                </div>
            `;
        }
    }
});