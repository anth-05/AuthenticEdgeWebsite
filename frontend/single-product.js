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
        
        // This check prevents the "Unexpected token N" error
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const products = await response.json();
        const product = products.find(p => p.id == productId);

        if (product) {
            renderProductDetails(product);
        } else {
            document.getElementById('productTitle').innerText = "Product Not Found";
        }
    } catch (err) {
        console.error("Connection Error:", err);
        document.getElementById('productTitle').innerText = "Unable to connect to archive";
    }
});

function showError(msg) {
    document.getElementById('productTitle').innerText = msg;
}

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
    async function handleInquiry() {
    const token = localStorage.getItem("token");
    
    // 1. Check if user is logged in
    if (!token) {
        alert("Please sign in to send an inquiry.");
        window.location.href = "login.html";
        return;
    }

    const title = document.getElementById('productTitle').innerText;
    const price = document.getElementById('productPrice').innerText;
    const productId = new URLSearchParams(window.location.search).get('id');

    // 2. Construct a professional "Concierge" message
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
                productId: productId // Optional: send ID if your DB supports it
            })
        });

        if (res.ok) {
            alert("Inquiry sent to our concierge team.");
            // Optional: Redirect them to their own messages page to see the chat
            // window.location.href = "messages.html"; 
        }
    } catch (err) {
        console.error("Inquiry failed", err);
    }
}

document.getElementById('messageBtn').onclick = handleInquiry;
    // Update Browser Tab Title
    document.title = `${product.title} | Authentic Edge`;
}