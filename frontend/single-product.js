/**
 * SINGLE PRODUCT LOADER
 * This script identifies the product from the URL and populates the UI.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the Product ID from the URL (e.g., ?id=33)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = '/collection'; // Redirect if no ID found
        return;
    }

    // 2. Fetch all products (Replace with your actual API endpoint if different)
    // For now, we fetch the same JSON used in your collection grid
    fetch('/api/products') 
        .then(response => response.json())
        .then(products => {
            // 3. Find the specific product
            const product = products.find(p => p.id == productId);

            if (product) {
                renderProductDetails(product);
            } else {
                document.getElementById('productTitle').innerText = "Product Not Found";
            }
        })
        .catch(err => {
            console.error("Error loading product:", err);
            document.getElementById('productTitle').innerText = "Error Loading Archive";
        });
});

/**
 * Injects the product data into the HTML elements
 */
function renderProductDetails(product) {
    // Update Image
    const imgElement = document.getElementById('productImage');
    imgElement.src = product.image_url || product.image;
    imgElement.alt = product.title;

    // Update Text Content
    document.getElementById('productTitle').innerText = product.title;
    document.getElementById('productPrice').innerText = product.price;
    document.getElementById('productDescription').innerText = product.description;
    document.getElementById('productCategory').innerText = product.category || "Archive";
    
    // Update Status Tag
    const statusTag = document.getElementById('productStatus');
    statusTag.innerText = product.status || "Premium";
    
    // Handle Sold Out state visually
    if (product.status && product.status.toLowerCase() === 'sold out') {
        const msgBtn = document.getElementById('messageBtn');
        msgBtn.innerText = "Archive Only (Sold Out)";
        msgBtn.style.backgroundColor = "#ccc";
        msgBtn.style.cursor = "not-allowed";
        msgBtn.disabled = true;
    }

    // Update Browser Tab Title
    document.title = `${product.title} | Authentic Edge`;
}