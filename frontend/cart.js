import { API_BASE_URL } from "./config.js";

document.addEventListener('DOMContentLoaded', () => {
    initCartEvents();
    initModalLogic();
    refreshCartUI();
});

export function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    if (!cart.find(item => item.id === product.id)) {
        cart.push({
            id: product.id,
            title: product.name || product.title,
            price: product.price,
            image: product.image || product.image_url
        });
        localStorage.setItem('ae_cart', JSON.stringify(cart));
    }
    openCart();
    refreshCartUI();
}

function initCartEvents() {
    const els = {
        overlay: document.getElementById('cartOverlay'),
        drawer: document.getElementById('cartDrawer'),
        close: document.getElementById('closeCart'),
        trigger: document.getElementById('cartTrigger'),
        checkout: document.getElementById('checkoutBtn')
    };

    const closeCart = () => {
        els.drawer.classList.remove('open');
        els.overlay.classList.remove('show');
        document.body.style.overflow = '';
    };

    const openCartInternal = () => {
        els.drawer.classList.add('open');
        els.overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    };

    if (els.trigger) els.trigger.onclick = openCartInternal;
    if (els.close) els.close.onclick = closeCart;
    if (els.overlay) els.overlay.onclick = closeCart;

    if (els.checkout) {
        els.checkout.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) {
                alert("Your selection is empty.");
                return;
            }
            closeCart(); // Close sidebar first
            // Only now show the modal
            document.getElementById('checkoutModal').style.display = 'flex';
        };
    }
}

export function openCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

export function refreshCartUI() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartBadge');
    const totalCount = document.getElementById('totalItemsCount');

    if (badge) badge.innerText = cart.length;
    if (totalCount) totalCount.innerText = `Total Selection: ${cart.length}`;
    
    // Hide or show the selection trigger button based on items
    const trigger = document.getElementById('cartTrigger');
    if (trigger) {
        trigger.style.display = cart.length > 0 ? 'flex' : 'none';
    }

    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#888; margin-top:50px;">Your selection is empty.</p>`;
        return;
    }

    list.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.title}">
            <div class="cart-item-info">
                <h4 style="margin:0; font-size:14px;">${item.title}</h4>
                <p style="margin:4px 0; color:#666; font-size:13px;">${item.price || 'Price on request'}</p>
                <button class="remove-btn" onclick="removeFromSelection(${index})">Remove</button>
            </div>
        </div>
    `).join('');
}

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

async function processInquiry(formData) {
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

    if (!token) {
        alert("Please sign in to submit your selection.");
        window.location.href = "login.html";
        return;
    }

    const productList = cart.map((item, index) => 
        `${index + 1}. ${item.title.toUpperCase()} - ${item.price || 'Contact for Price'}`
    ).join('\n');

    const message = `
📦 NEW SELECTION INQUIRY
-------------------------
👤 CUSTOMER
Name: ${formData.get('voornaam')} ${formData.get('achternaam')}
Email: ${formData.get('email')}
Size: ${formData.get('maat')}
Budget: ${formData.get('budget')}

📍 SHIPPING
Address: ${formData.get('adres')}, ${formData.get('postcode')} ${formData.get('stad')}
Region/Country: ${formData.get('regio')}, ${formData.get('land')}

🛒 ITEMS
${productList}
-------------------------
TOTAL ITEMS: ${cart.length}
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

window.removeFromSelection = (index) => {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ae_cart', JSON.stringify(cart));
    refreshCartUI();
};