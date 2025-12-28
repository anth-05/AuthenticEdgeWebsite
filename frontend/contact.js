import { API_BASE_URL } from "./config.js";

// Use the key found in your HTML
const SITE_KEY = "6LfBhRQsAAAAANIKzqgbUZnKkNAH09Tgfd0d3s9I";

document.getElementById("contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : "Send";

    // 1. Collect Data First
    const countryCode = document.querySelector(".country-code")?.value || "";
    const phoneNumber = document.querySelector(".phone-input")?.value || "";

    const data = {
        name: document.getElementById("contactName").value.trim(),
        email: document.querySelector("input[type='email']").value.trim(),
        phone: `${countryCode} ${phoneNumber}`.trim(),
        message: document.getElementById("contactDescription").value.trim(),
    };

    // 2. Simple Validation
    if (!data.name || !data.email || !data.message) {
        alert("Please fill in all required fields.");
        return;
    }

    try {
        // UI Feedback
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Transmitting...";
        }

        // 3. Execute reCAPTCHA and Send Data
        grecaptcha.ready(function() {
            grecaptcha.execute(SITE_KEY, { action: 'submit' }).then(async function(token) {
                
                // Add the token to your data object
                data.recaptchaToken = token;

                // Perform the fetch inside the reCAPTCHA promise
                const res = await fetch(`${API_BASE_URL}/api/contact`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });

                const result = await res.json();

                if (res.ok && result.success) {
                    alert("Thank you. Your inquiry has been received by the editorial team.");
                    e.target.reset();
                    window.location.reload();
                } else {
                    // Handle specific error from server (like "Bot activity detected")
                    alert(result.error || "Communication failed. Please try again.");
                    resetButton(submitBtn, originalBtnText);
                }
            });
        });

    } catch (error) {
        console.error("Contact form error:", error);
        alert("Communication failed. Please try again later.");
        resetButton(submitBtn, originalBtnText);
    }
});

// Helper to reset button state
function resetButton(btn, text) {
    if (btn) {
        btn.disabled = false;
        btn.innerText = text;
    }
}