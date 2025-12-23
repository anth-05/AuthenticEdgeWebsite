import { API_BASE_URL } from "./config.js";

document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerText : "Send";

  // 1. Collect Data
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
    // UI Feedback: Disable button while sending
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Transmitting...";
    }

    // 3. API Call
    // Note: ensure your server.js has an app.post("/api/contact") to match this
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
      throw new Error(result.error || "Server error");
    }

  } catch (error) {
    console.error("Contact form error:", error);
    alert("Communication failed. Please try again later or contact us directly via email.");
  } finally {
    // Reset button state
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
    }
  }
});