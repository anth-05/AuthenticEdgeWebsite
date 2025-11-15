document.querySelectorAll('input[name="imageType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const showUrl = e.target.value === 'url';
    document.getElementById('image-url-row').style.display = showUrl ? '' : 'none';
    document.getElementById('image-upload-row').style.display = showUrl ? 'none' : '';
  });
});

document.getElementById("add-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  const imageType = document.querySelector('input[name="imageType"]:checked').value;

  // Collect other fields
  const data = {
    name: document.getElementById("name").value.trim(),
    description: document.getElementById("description").value.trim(),
    gender: document.getElementById("gender").value.trim(),
    quality: document.getElementById("quality").value.trim(),
    availability: document.getElementById("availability").value.trim(),
  };

  let body, headers;

  if (imageType === "upload") {
    const imageFile = document.getElementById('imageUpload').files[0];
    if (!imageFile) {
      alert("Please upload an image file.");
      return;
    }
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    formData.append("imageFile", imageFile);
    body = formData;
    headers = { Authorization: `Bearer ${token}` }; // No Content-Type for FormData!
  } else {
    const imageUrl = document.getElementById("image").value.trim();
    if (!imageUrl) {
      alert("Please supply an image URL.");
      return;
    }
    data.image = imageUrl;
    body = JSON.stringify(data);
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }

  if (!data.name) {
    alert("Please provide the product name.");
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers,
    body
  });

  if (res.ok) {
    alert("✅ Product added successfully!");
    e.target.reset();
    loadProducts();
    // Reset the radio selection and toggle back to default
    document.querySelector('input[name="imageType"][value="url"]').checked = true;
    document.getElementById('image-url-row').style.display = '';
    document.getElementById('image-upload-row').style.display = 'none';
  } else {
    alert("❌ Failed to add product.");
  }
});
