import { API_BASE_URL } from "./config.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'product.html';
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
    const imgElement = document.getElementById('productImage');
    if (imgElement) {
        imgElement.src = product.image_url || product.image || '';
        imgElement.alt = product.title || product.name || "Product Image";
    }

    const title = product.title || product.name || "Untitled Product";
    const price = product.price || "Contact for Price";
    
    document.getElementById('productTitle').innerText = title;
    document.getElementById('productPrice').innerText = price;
    document.getElementById('productDescription').innerText = product.description || "No description available.";
    document.getElementById('productCategory').innerText = product.category || "";
    
    const statusTag = document.getElementById('productStatus');
    const status = product.status || "Premium";
    statusTag.innerText = status;
    
    const msgBtn = document.getElementById('messageBtn');
    
    if (status.toLowerCase() === 'sold out') {
        msgBtn.innerText = "Archive Only (Sold Out)";
        msgBtn.style.backgroundColor = "#ccc";
        msgBtn.style.cursor = "not-allowed";
        msgBtn.disabled = true;
    } else {
        // CHANGE THIS LINE: 
        // Instead of handleInquiry, call your exported addToCart function
        msgBtn.innerText = "Add to Selection";
        msgBtn.onclick = () => addToCart(product);
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
    // Redirect to the chat page so they can see the message in the stream
    window.location.href = "user-messages.html"; 
    }
    } catch (err) {
        console.error("Inquiry failed", err);
        alert("Server error. Please try again later.");
    }
}
export function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    
    // Avoid duplicates
    if (!cart.some(item => item.id === product.id)) {
        cart.push({
            id: product.id,
            title: product.name || product.title,
            price: product.price,
            image: product.image || product.image_url
        });
        localStorage.setItem('ae_cart', JSON.stringify(cart));
    }
    alert("Product added to your selection.");
}
function initCartUI() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const closeBtn = document.getElementById('closeCart');
    const trigger = document.getElementById('cartTrigger');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const toggle = () => {
        drawer.classList.toggle('open');
        overlay.classList.toggle('show');
    };

    if (closeBtn) closeBtn.onclick = toggle;
    if (overlay) overlay.onclick = toggle;
    if (trigger) trigger.onclick = toggle;

    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) return alert("Selection is empty.");
            
            // Switch from Drawer to Modal
            drawer.classList.remove('open');
            overlay.classList.remove('show');
            document.getElementById('checkoutModal').style.display = 'flex';
        };
    }
}

function initModalLogic() {
    const modal = document.getElementById('checkoutModal');
    const form = document.getElementById('checkoutForm');
    const closeBtn = document.getElementById('closeModal');

    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            await processInquiry(formData);
        };
    }
}

function refreshCartDisplay() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartBadge');

    if (badge) badge.innerText = cart.length;
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<p style="padding: 20px; color: #888;">No items selected.</p>';
        return;
    }

    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}">
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <p>${item.price}</p>
                <button class="remove-link" onclick="removeFromSelection(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

// Global scope for HTML onclick access
window.removeFromSelection = (index) => {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ae_cart', JSON.stringify(cart));
    refreshCartDisplay();
};

async function processInquiry(formData) {
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

    if (!token) return (window.location.href = "login.html");

    const message = `Authentic Edge NL\nNL15 REVO 9415 3189 96\n\n` +
        `Client: ${formData.get('voornaam')} ${formData.get('achternaam')}\n` +
        `Address: ${formData.get('adres')}, ${formData.get('postcode')}\n` +
        `Size: ${formData.get('maat')}\n\n` +
        `ITEMS:\n` + cart.map(i => `• ${i.title} (${i.price})`).join('\n') +
        `\n\nTotal + Shipping (€7,25 per product) + Tikkie (€1).`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages/send`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ message })
        });

        if (res.ok) {
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        }
    } catch (e) { alert("Submission error."); }
}

function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    
    // Use optional chaining or if-checks
    if (drawer && overlay) {
        drawer.classList.add('open');
        overlay.classList.add('show');
    }
}