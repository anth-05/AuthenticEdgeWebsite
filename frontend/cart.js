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

    if (els.trigger) els.trigger.onclick = openCart;
    if (els.close) els.close.onclick = closeCart;
    if (els.overlay) els.overlay.onclick = closeCart;

    if (els.checkout) {
        els.checkout.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) return;
            closeCart();
            document.getElementById('checkoutModal').style.display = 'flex';
        };
    }
}

export function openCart() {
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

export function refreshCartUI() {
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartBadge');
    const totalCount = document.getElementById('totalItemsCount');

    if (badge) badge.innerText = cart.length;
    if (totalCount) totalCount.innerText = `Total Selection: ${cart.length}`;
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
function initConciergeUI() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    const trigger = document.getElementById('cartTrigger');
    const closeBtn = document.getElementById('closeCart');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const modal = document.getElementById('checkoutModal');
    const closeModal = document.getElementById('closeModal');

    // Drawer Controls
    if (trigger) trigger.onclick = openDrawer;
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (overlay) overlay.onclick = closeDrawer;

    // Transition from Drawer to Modal
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
            if (cart.length === 0) return alert("Your selection is empty.");

            closeDrawer(); // Close the right-side sidebar
            if (modal) modal.style.display = 'flex'; // Open the centered modal
        };
    }

    // Modal Controls
    if (closeModal) {
        closeModal.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Close modal if user clicks outside the content box
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}
/**
 * Processes the final inquiry after the user fills out the modal form.
 */
async function processInquiry(formData) {
    const token = localStorage.getItem("token");
    const cart = JSON.parse(localStorage.getItem('ae_cart')) || [];

    if (!token) {
        alert("Please sign in to submit your selection.");
        window.location.href = "login.html";
        return;
    }

    // Format the product list for the message
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

// Attach to the form inside initConciergeUI
const form = document.getElementById('checkoutForm');
if (form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        await processInquiry(data);
    };
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

window.removeFromSelection = (index) => {
    let cart = JSON.parse(localStorage.getItem('ae_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ae_cart', JSON.stringify(cart));
    refreshCartUI();
};