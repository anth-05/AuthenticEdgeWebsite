import { API_BASE_URL } from "./config.js";

// AUTO-INITIALIZE UI
document.addEventListener('DOMContentLoaded', () => {
    initCartUI();
    initModalLogic();
    refreshCartDisplay();
});

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
    
    openCartDrawer();
    refreshCartDisplay();
}

function initCartUI() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const closeBtn = document.getElementById('closeCart');
    const trigger = document.getElementById('cartTrigger');
    const checkoutBtn = document.getElementById('checkoutBtn');

    // Add this guard clause
    if (!drawer || !overlay) return; 

    const closeDrawer = () => {
        drawer.classList.remove('open');
        overlay.classList.remove('show');
    };
    const openDrawer = () => {
        drawer.classList.add('open');
        overlay.classList.add('show');
    };

    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (overlay) overlay.onclick = closeDrawer;
    if (trigger) trigger.onclick = openDrawer;

    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) return alert("Selection is empty.");
            
            closeDrawer();
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

export function refreshCartDisplay() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    
    // 1. Update the Header Badge (Top Right)
    const badge = document.getElementById('cartBadge');
    if (badge) badge.innerText = cart.length;

    // 2. Update the "Total Items: X" in the Drawer (Bottom)
    const totalItemsText = document.getElementById('totalItemsCount'); 
    if (totalItemsText) {
        totalItemsText.innerText = `Total Items: ${cart.length}`;
    }

    const list = document.getElementById('cartItemsList');
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = '<p style="padding: 20px; color: #888;">No items selected.</p>';
        return;
    }

    // 3. Render items and fix the "undefined" price issue
    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}" style="width:60px; height:60px; object-fit:cover;">
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <p>${item.price || "Contact for Price"}</p> <button class="remove-link" onclick="removeFromSelection(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

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

    // Format the product list with numbering and clear spacing
    const productList = cart.map((item, index) => 
        `${index + 1}. PRODUCT: ${item.title.toUpperCase()}\n   PRICE: ${item.price || 'Contact for Price'}`
    ).join('\n\n');

    // The structured template for the producer
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
            alert("Inquiry successfully sent!");
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        }
    } catch (e) { 
        alert("Error sending inquiry."); 
    }
}

function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if(drawer) drawer.classList.add('open');
    if(overlay) overlay.classList.add('show');
}