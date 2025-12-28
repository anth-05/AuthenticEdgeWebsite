import { API_BASE_URL } from "./config.js";
import { addToCart } from "./cart.js";

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${productId}`);
        const product = await res.json();

        // Populate Page
        document.getElementById('productTitle').innerText = product.name;
        document.getElementById('productPrice').innerText = product.price || "Contact for Price";
        document.getElementById('productImage').src = product.image_url;
        document.getElementById('productDescription').innerText = product.description;
        document.getElementById('productCategory').innerText = product.category;

        // Button Click
        document.getElementById('messageBtn').onclick = () => {
            addToCart(product);
        };

    } catch (err) {
        console.error("Error loading product:", err);
    }
});