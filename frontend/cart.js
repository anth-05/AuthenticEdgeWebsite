import { API_BASE_URL } from "./config.js";

// Initialize cart from storage
let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

/**
 * Adds a product to the cart and updates UI
 */
export function addToCart(product) {
    if (cart.some(item => item.id === product.id)) {
        // Open drawer even if already added so user knows where it is
        toggleCartDrawer(true);
        return;
    }

    cart.push({
        id: product.id,
        title: product.title || product.name,
        price: product.price,
        image: product.image_url || product.image
    });

    saveAndRefresh();
    toggleCartDrawer(true);
}

/**
 * Removes an item by index
 */
export function removeFromCart(index) {
    cart.splice(index, 1);
    saveAndRefresh();
}

/**
 * Clears entire cart
 */
export function clearCart() {
    cart = [];
    saveAndRefresh();
}

function saveAndRefresh() {
    localStorage.setItem('ae_cart', JSON.stringify(cart));
    updateCartUI();
    renderCartDrawer();
}

/**
 * Updates the floating badge count
 */
function updateCartUI() {
    const cartCount = document.getElementById('cartBadge');
    if (cartCount) cartCount.innerText = cart.length;
}

/**
 * Generates the HTML for the sidebar list
 */
export function renderCartDrawer() {
    const list = document.getElementById('cartItemsList');
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<p class="empty-msg">Your selection is empty.</p>';
        return;
    }

    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}">
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <p>${item.price}</p>
                <button class="remove-link" onclick="handleRemove(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

/**
 * Formats cart into ONE message and sends to the existing message table
 */
export async function submitCartInquiry() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please sign in to submit your selection.");
        window.location.href = "login.html";
        return;
    }

    if (cart.length === 0) {
        alert("Selection is empty.");
        return;
    }

    // Convert selection array into a single clean text block
    const itemListString = cart.map(i => `• ${i.title} (${i.price})`).join('\n');
    const finalInquiry = `CONCIERGE SELECTION INQUIRY:\n\n${itemListString}\n\nI would like more information on these pieces.`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages/send`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                message: finalInquiry 
            })
        });

        if (res.ok) {
            alert("Inquiry sent to our concierge team.");
            clearCart();
            window.location.href = "user-messages.html";
        } else {
            throw new Error("Failed to send");
        }
    } catch (err) {
        console.error(err);
        alert("Failed to send inquiry. Please try again.");
    }
}

/**
 * Helper to open/close drawer
 */
function toggleCartDrawer(isOpen) {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (isOpen) {
        drawer?.classList.add('open');
        overlay?.classList.add('show');
    } else {
        drawer?.classList.remove('open');
        overlay?.classList.remove('show');
    }
}
// Function to show the modal instead of sending immediately
export function openCheckoutModal() {
    document.getElementById('checkoutModal').style.display = 'flex';
}

// Handle the final form submission
document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    const formData = new FormData(e.target);
    
    // 1. Gather form data into a readable string
    let clientInfo = "--- LEVERINGSGEGEVENS ---\n";
    formData.forEach((value, key) => {
        clientInfo += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
    });

    // 2. Format cart items
    const itemList = cart.map(i => `• ${i.title} (${i.price})`).join('\n');

    // 3. Combine everything
    const finalMessage = `NIEUWE BESTELLING INQUIRY:\n\n${clientInfo}\n\nGEKOZEN PRODUCTEN:\n${itemList}\n\nOvereengekomen: Akkoord met verzendvoorwaarden.`;

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
            alert("Bestelling succesvol verzonden! We nemen contact met u op via de chat.");
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        }
    } catch (err) {
        alert("Fout bij verzenden. Probeer het opnieuw.");
    }
});

// Make remove function globally accessible for the inline HTML buttons
window.handleRemove = (index) => removeFromCart(index);