import { API_BASE_URL } from "./config.js";

// AUTO-INITIALIZE UI
document.addEventListener('DOMContentLoaded', () => {
    initCartUI();
    initModalLogic();
    refreshCartDisplay();
});

/**
 * Adds a product to the selection and opens the sidebar.
 */
export function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    
    if (!cart.some(item => item.id === product.id)) {
        cart.push({
            id: product.id,
            title: product.name || product.title,
            price: product.price,
            image: product.image || product.image_url
        });
        localStorage.setItem('ae_cart', JSON.stringify(cart));
    }
    
    openCartDrawer(); // Ensure drawer slides in from the right
    refreshCartDisplay();
}

/**
 * Sets up listeners for opening/closing the sidebar drawer.
 */
function initCartUI() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const closeBtn = document.getElementById('closeCart');
    const trigger = document.getElementById('cartTrigger');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!drawer || !overlay) return; 

    const closeDrawer = () => {
        drawer.classList.remove('open');
        overlay.classList.remove('show');
        document.body.style.overflow = 'auto'; // Re-enable scroll
    };

    const openDrawer = () => {
        drawer.classList.add('open');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    };

    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (overlay) overlay.onclick = closeDrawer;
    if (trigger) trigger.onclick = openDrawer;

    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) return alert("Your selection is empty.");
            
            closeDrawer();
            document.getElementById('checkoutModal').style.display = 'flex';
        };
    }
}

/**
 * Handles the checkout modal visibility and submission.
 */
function initModalLogic() {
    const modal = document.getElementById('checkoutModal');
    const form = document.getElementById('checkoutForm');
    const closeBtn = document.getElementById('closeModal');

    if (!modal) return;

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Close modal if clicking outside content
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            await processInquiry(formData);
        };
    }
}

/**
 * Renders items inside the right-side drawer.
 */
export function refreshCartDisplay() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    
    // 1. Update Badge Count
    const badge = document.getElementById('cartBadge');
    if (badge) badge.innerText = cart.length;

    // 2. Update Total Items Counter
    const totalItemsText = document.getElementById('totalItemsCount'); 
    if (totalItemsText) {
        totalItemsText.innerText = `Total Items: ${cart.length}`;
    }

    const list = document.getElementById('cartItemsList');
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<p class="empty-msg" style="padding: 40px 0; color: #888; text-align: center;">Your selection is empty.</p>';
        return;
    }

    // 3. Render Cart Items with updated class names for CSS alignment
    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}">
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <p>${item.price || "Contact for Price"}</p> 
                <button class="remove-btn" onclick="removeFromSelection(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

/**
 * Removes item and refreshes UI.
 */
window.removeFromSelection = (index) => {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ae_cart', JSON.stringify(cart));
    refreshCartDisplay();
};

/**
 * Formats and sends the inquiry to the backend.
 */
async function processInquiry(formData) {
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

    if (!token) {
        alert("Please sign in to submit your selection.");
        window.location.href = "login.html";
        return;
    }

    const productList = cart.map((item, index) => 
        `${index + 1}. PRODUCT: ${item.title.toUpperCase()}\n   PRICE: ${item.price || 'Contact for Price'}`
    ).join('\n\n');

    const message = `
📦 NEW SELECTION INQUIRY: AUTHENTIC EDGE
------------------------------------------

👤 CUSTOMER DETAILS
Name:       ${formData.get('voornaam')} ${formData.get('achternaam')}
Email:      ${formData.get('email') || 'Not provided'}
Size:       ${formData.get('maat')}
Max Budget: ${formData.get('budget') || 'Not specified'}

📍 SHIPPING ADDRESS
Address:    ${formData.get('adres')}
Postcode:   ${formData.get('postcode')}
City:       ${formData.get('stad')}
Country:    ${formData.get('land')}

🛒 SELECTED ITEMS (${cart.length} total)
------------------------------------------
${productList}

------------------------------------------
Shipping (€7.25 p.p.) + €1 Tikkie fee.
------------------------------------------
`.trim();

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
            alert("Selection sent! We will contact you soon.");
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        } else {
            const err = await res.json();
            alert(`Error: ${err.error || "Could not send inquiry."}`);
        }
    } catch (e) { 
        alert("Server error. Please try again later."); 
    }
}

/**
 * Helper to force open the right drawer.
 */
export function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if(drawer) drawer.classList.add('open');
    if(overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}