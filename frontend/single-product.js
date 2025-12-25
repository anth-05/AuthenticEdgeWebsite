import { API_BASE_URL } from "./config.js";

// Initialize UI listeners automatically
document.addEventListener('DOMContentLoaded', () => {
    initCartUI();
    initModalLogic();
    refreshCartDisplay();
});

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
    
    // Open the drawer immediately so the user knows it worked
    openCartDrawer();
    refreshCartDisplay();
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
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('show');
}