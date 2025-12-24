import { API_BASE_URL } from "./config.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'collection.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const products = await response.json();
        
        // Use loose equality (==) or String conversion to ensure IDs match correctly
        const product = products.find(p => String(p.id) === String(productId));

        if (product) {
            renderProductDetails(product);
        } else {
            showError("Product Not Found");
        }
    } catch (err) {
        console.error("Connection Error:", err);
        showError("Unable to connect to archive");
    }
});

function showError(msg) {
    const titleElement = document.getElementById('productTitle');
    if (titleElement) titleElement.innerText = msg;
}

/**
 * Injects product data and sets up button listeners
 */
function renderProductDetails(product) {
    // 1. Update Image (Check for both possible property names)
    const imgElement = document.getElementById('productImage');
    if (imgElement) {
        imgElement.src = product.image_url || product.image || '';
        imgElement.alt = product.title || product.name || "Product Image";
    }

    // 2. Update Text Content (Handle potential 'undefined' by providing fallbacks)
    const title = product.title || product.name || "Untitled Product";
    const price = product.price || "Contact for Price";
    
    document.getElementById('productTitle').innerText = title;
    document.getElementById('productPrice').innerText = price;
    document.getElementById('productDescription').innerText = product.description || "No description available.";
    document.getElementById('productCategory').innerText = product.category || "";
    
    // 3. Update Status Tag
    const statusTag = document.getElementById('productStatus');
    const status = product.status || "Premium";
    statusTag.innerText = status;
    
    // 4. Handle Sold Out state
    const msgBtn = document.getElementById('messageBtn');
    if (status.toLowerCase() === 'sold out') {
        msgBtn.innerText = "Archive Only (Sold Out)";
        msgBtn.style.backgroundColor = "#ccc";
        msgBtn.style.cursor = "not-allowed";
        msgBtn.disabled = true;
    } else {
        // Set up Inquiry click listener only if item is available
        msgBtn.onclick = () => handleInquiry(title, price, product.id);
    }

    document.title = `${title} | Authentic Edge`;
}

/**
 * Sends inquiry message to admin
 */
async function handleInquiry(title, price, id) {
    const token = localStorage.getItem("token");
    
    if (!token) {
        alert("Please sign in to send an inquiry.");
        window.location.href = "login.html";
        return;
    }

    const inquiryMessage = `INQUIRY: ${title} (${price}). I would like more information regarding this piece.`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages/send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                message: inquiryMessage,
                productId: id 
            })
        });

        if (res.ok) {
            alert("Inquiry sent to our concierge team.");
        } else {
            const errorData = await res.json();
            alert(`Error: ${errorData.error || 'Failed to send inquiry.'}`);
        }
    } catch (err) {
        console.error("Inquiry failed", err);
        alert("Server error. Please try again later.");
    }
}