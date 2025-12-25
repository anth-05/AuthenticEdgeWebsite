import { API_BASE_URL } from "./config.js";
import { addToCart, submitCartInquiry } from "./cart.js";

// Inside your renderProductDetails function, update the button:
const msgBtn = document.getElementById('messageBtn');
msgBtn.onclick = () => addToCart(product);

// Inside your setupCartUI function:
const checkoutBtn = document.getElementById('checkoutBtn');
checkoutBtn.onclick = submitCartInquiry;
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'collection.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        const products = await response.json();
        const product = products.find(p => String(p.id) === String(productId));

        if (product) {
            renderProductDetails(product);
        } else {
            showError("Product Not Found");
        }
    } catch (err) {
        showError("Unable to connect to archive");
    }

    setupCartUI();
});

/**
 * Basic Cart UI Toggle
 */
function setupCartUI() {
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    const closeCart = document.getElementById('closeCart');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const toggle = () => {
        cartDrawer.classList.toggle('open');
        cartOverlay.classList.toggle('show');
        renderCartItems(); 
    };

    if (closeCart) closeCart.onclick = toggle;
    if (cartOverlay) cartOverlay.onclick = toggle;
    if (checkoutBtn) checkoutBtn.onclick = sendInquiry;
}

function renderProductDetails(product) {
    const title = product.title || product.name || "Untitled Product";
    const price = product.price || "Contact for Price";
    
    // Update labels
    document.getElementById('productTitle').innerText = title;
    document.getElementById('productPrice').innerText = price;
    document.getElementById('productDescription').innerText = product.description || "";
    
    const imgElement = document.getElementById('productImage');
    if (imgElement) imgElement.src = product.image_url || product.image || '';

    const msgBtn = document.getElementById('messageBtn');
    if ((product.status || "").toLowerCase() === 'sold out') {
        msgBtn.innerText = "Sold Out";
        msgBtn.disabled = true;
    } else {
        msgBtn.innerText = "Add to Selection";
        msgBtn.onclick = () => {
            addToSelection(product);
            // Open the drawer automatically
            document.getElementById('cartDrawer').classList.add('open');
            document.getElementById('cartOverlay').classList.add('show');
        };
    }
}

// --- CORE CART LOGIC ---

function addToSelection(product) {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    if (!cart.some(item => item.id === product.id)) {
        cart.push({
            id: product.id,
            title: product.title || product.name,
            price: product.price,
            image: product.image_url || product.image
        });
        localStorage.setItem('ae_cart', JSON.stringify(cart));
        renderCartItems();
    }
}

function renderCartItems() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    const list = document.getElementById('cartItemsList');
    
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<p class="empty-msg">No items selected.</p>';
        return;
    }

    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}" style="width:50px; height:50px; object-fit:cover;">
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <p>${item.price}</p>
                <button class="remove-link" onclick="removeFromCart(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

window.removeFromCart = (index) => {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ae_cart', JSON.stringify(cart));
    renderCartItems();
};

/**
 * Sends whatever is in the cart to the internal messages table
 */
async function sendInquiry() {
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

    if (!token) {
        alert("Please sign in to send an inquiry.");
        window.location.href = "login.html";
        return;
    }

    if (cart.length === 0) return;

    // Convert selection array into one text message
    const listString = cart.map(i => `- ${i.title} (${i.price})`).join('\n');
    const finalMessage = `I am interested in the following selection:\n\n${listString}`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages/send`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ message: finalMessage })
        });

        if (res.ok) {
            alert("Selection sent to concierge.");
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        }
    } catch (err) {
        alert("Server error. Please try again.");
    }
}