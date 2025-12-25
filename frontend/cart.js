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
            <img src="${item.image}" alt="${item.title}" style="width:50px; height:50px; object-fit:cover;">
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <p>${item.price}</p>
                <button class="remove-link" onclick="removeFromSelection(${index})">Remove</button>
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

    const message = `Authentic Edge NL\nNL15 REVO 9415 3189 96\n\n` +
        `Voornaam: ${formData.get('voornaam')}\n` +
        `Achternaam: ${formData.get('achternaam')}\n` +
        `Adres: ${formData.get('adres')}\n` +
        `Maat: ${formData.get('maat')}\n\n` +
        `GEKOZEN PRODUCTEN:\n` + cart.map(i => `• ${i.title} (${i.price})`).join('\n') +
        `\n\nVerzendkosten: €7,25 per product. Tikkie: +€1.`;

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
    if(drawer) drawer.classList.add('open');
    if(overlay) overlay.classList.add('show');
}