document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();

    const countryCode = document.querySelector(".country-code").value;
    const phoneNumber = document.querySelector(".phone-input").value;

  const data = {
    name: document.getElementById("contactName").value,
    email: document.querySelector("input[type='email']").value,
    phone: `${countryCode} ${phoneNumber}`,
    description: document.querySelector("textarea").value
  };

  const res = await fetch("https://authenticedgewebsite.onrender.com/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const json = await res.json();

  if (json.success) {
    alert("Your message has been sent!");
  } else {
    alert("Error sending message.");
  }
});