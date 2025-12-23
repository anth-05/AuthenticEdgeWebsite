# 🛡️ Authentic Edge: Editorial Membership & Concierge Platform

Authentic Edge is a high-end, full-stack web application designed for exclusive product discovery and personalized member services. It features a robust **Admin Editorial Dashboard**, a **Membership Subscription System**, and a real-time **Concierge Chat** powered by Socket.io.

---

## 🚀 Core Features

### 👤 Member Experience
* **Concierge Chat:** Real-time messaging with administration for personalized inquiries.
* **Curated Collection:** Browse high-quality products with detailed metadata (quality, gender, availability).
* **Membership Tiers:** Apply for different subscription levels (Silver, Gold, Platinum) with admin approval workflows.
* **Account Management:** Self-service email and password updates.

### 🛠️ Admin Editorial Dashboard
* **Inventory Control:** Full CRUD for products with Cloudinary image upload integration.
* **Membership Queue:** Review, approve, or decline pending subscription requests.
* **User Management:** Oversee the user database and manage administrative roles.
* **Unified Inbox:** A centralized chat interface to respond to all member inquiries in real-time.

---

## 🏗️ Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 (Editorial UI) |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Real-time** | Socket.io |
| **Authentication** | JWT (JSON Web Tokens) & Bcrypt hashing |
| **File Storage** | Cloudinary (via Multer) |

---

## 🛠️ Installation & Setup

### 1. Prerequisites
* Node.js (v16 or higher)
* PostgreSQL database
* Cloudinary Account (for product images)

### 2. Backend Configuration
Create a `.env` file in the root directory:
```env
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_super_secret_key
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret