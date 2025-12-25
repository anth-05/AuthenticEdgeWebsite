import { API_BASE_URL } from "./config.js";

// Initialize UI listeners as soon as the module loads
document.addEventListener('DOMContentLoaded', () => {
    setupCartUI();
    setupModalListeners();
    renderCartItems();
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
    // Open UI automatically
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('show');
    renderCartItems();
}

function setupCartUI() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const closeBtn = document.getElementById('closeCart');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const toggle = () => {
        drawer.classList.toggle('open');
        overlay.classList.toggle('show');
    };

    if (closeBtn) closeBtn.onclick = toggle;
    if (overlay) overlay.onclick = toggle;
    
    // Clicking "Submit Inquiry" opens the Info Modal
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) return alert("Your selection is empty.");
            
            drawer.classList.remove('open');
            overlay.classList.remove('show');
            document.getElementById('checkoutModal').style.display = 'flex';
        };
    }
}

function setupModalListeners() {
    const modal = document.getElementById('checkoutModal');
    const form = document.getElementById('checkoutForm');
    const closeBtn = document.getElementById('closeModal');

    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await sendInquiryWithDetails(new FormData(form));
        };
    }
}

export function renderCartItems() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartBadge');
    
    if (badge) badge.innerText = cart.length;
    if (!list) return;

    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">
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

async function sendInquiryWithDetails(formData) {
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

    if (!token) {
        alert("Please sign in first.");
        window.location.href = "login.html";
        return;
    }

    // Prepare the text block exactly as requested
    const details = `Authentic Edge NL\nNL15 REVO 9415 3189 96\n\n` +
        `Voornaam: ${formData.get('voornaam')}\n` +
        `Achternaam: ${formData.get('achternaam')}\n` +
        `Adres: ${formData.get('adres')}\n` +
        `Maat: ${formData.get('maat')}\n\n` +
        `SELECTION:\n` + cart.map(i => `- ${i.title} (${i.price})`).join('\n') +
        `\n\nShipping: Akkoord met voorwaarden (+€7,25 per product).`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/messages/send`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ message: details })
        });

        if (res.ok) {
            alert("Inquiry successfully sent!");
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        }
    } catch (err) {
        alert("Failed to send.");
    }
}