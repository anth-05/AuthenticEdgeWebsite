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

    if (!token) {
        alert("Please sign in to complete your inquiry.");
        window.location.href = "login.html";
        return;
    }

    if (cart.length === 0) {
        alert("Your selection is empty.");
        return;
    }

    // 1. Collect ALL delivery info from the modal fields
    // Ensure the 'name' attributes in your HTML match these strings
    const deliveryInfo = `
--- GEGEVENS VOOR LEVERING ---
Naam: ${formData.get('voornaam')} ${formData.get('achternaam')}
Adres: ${formData.get('adres')}
Postcode/Stad: ${formData.get('postcode')} ${formData.get('stad')}
Land/Regio: ${formData.get('land')}, ${formData.get('regio')}
Maat: ${formData.get('maat')}
E-mail: ${formData.get('email')}
`;

    // 2. Collect ALL items currently in the selection
    const itemDetails = cart.map(item => 
        `- ${item.title} (${item.price || 'Contact for Price'})`
    ).join('\n');

    // 3. Combine everything into the final message block
    const finalMessage = `
Authentic Edge NL
NL15 REVO 9415 3189 96

${deliveryInfo}

--- GEKOZEN PRODUCTEN ---
${itemDetails}

Totaal aantal items: ${cart.length}
Overeengekomen: Afgesproken Bedrag + €7,25 verzendkosten per product + €1 Tikkie kosten.
`.trim();

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
            alert("Uw aanvraag is succesvol verzonden.");
            localStorage.removeItem('ae_cart');
            window.location.href = "user-messages.html";
        } else {
            throw new Error("Failed to send");
        }
    } catch (e) { 
        alert("Er is een fout opgetreden bij het verzenden. Probeer het later opnieuw."); 
    }
}

function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if(drawer) drawer.classList.add('open');
    if(overlay) overlay.classList.add('show');
}