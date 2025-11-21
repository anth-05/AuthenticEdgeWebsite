document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    name: document.querySelector("input[type='text']").value,
    email: document.querySelector("input[type='email']").value,
    phone: document.querySelector("input[type='tel']").value,
    description: document.querySelector("textarea").value
  };

  const res = await fetch("https://authenticedgewebsite.onrender.com/api/contact", {
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