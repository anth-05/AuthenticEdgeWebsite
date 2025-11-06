// ==============================
// IMPORTS & SETUP
// ==============================
const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

let db;

// ==============================
// DATABASE INITIALIZATION
// ==============================
(async () => {
  db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  // === USERS TABLE ===
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'user')) NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // === PRODUCTS TABLE ===
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      gender TEXT,
      quality TEXT,
      availability TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ Database ready (users & products)");

  // === DEFAULT ACCOUNTS ===
  const admin = await db.get("SELECT * FROM users WHERE email = ?", ["admin"]);
  if (!admin) {
    const hashed = await bcrypt.hash("admin123", 10);
    await db.run(
      "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
      ["admin", hashed, "admin"]
    );
    console.log("👑 Default admin: admin / admin123");
  }

  const user = await db.get("SELECT * FROM users WHERE email = ?", ["user"]);
  if (!user) {
    const hashed = await bcrypt.hash("user123", 10);
    await db.run(
      "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
      ["user", hashed, "user"]
    );
    console.log("👤 Default user: user / user123");
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();

// ==============================
// AUTH MIDDLEWARE
// ==============================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

function verifyAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admins only" });
    }
    next();
  });
}

// ==============================
// AUTH ROUTES
// ==============================

// Register
app.post("/api/register", async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  try {
    const existing = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    if (existing)
      return res.status(400).json({ error: "Email is already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.run(
      "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
      [email, hashed, role || "user"]
    );
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ message: "Login successful", role: user.role, token });
});

// Protected test route
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: `Welcome ${req.user.role}!`, user: req.user });
});

// ==============================
// ADMIN DASHBOARD ROUTES
// ==============================

// Dashboard stats
app.get("/api/stats", verifyAdmin, async (req, res) => {
  try {
    const users = await db.get("SELECT COUNT(*) AS count FROM users");
    const admins = await db.get("SELECT COUNT(*) AS count FROM users WHERE role='admin'");
    const regular = await db.get("SELECT COUNT(*) AS count FROM users WHERE role='user'");

    res.json({
      users: users.count,
      admins: admins.count,
      regularUsers: regular.count,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Recent users
app.get("/api/recent-users", verifyAdmin, async (req, res) => {
  try {
    const users = await db.all(
      "SELECT email, role, created_at FROM users ORDER BY id DESC LIMIT 5"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recent users" });
  }
});

// Manage users
app.get("/api/users", verifyAdmin, async (req, res) => {
  try {
    const users = await db.all(
      "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Update user role
app.put("/api/users/:id", verifyAdmin, async (req, res) => {
  const { role } = req.body;
  const { id } = req.params;
  await db.run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  res.json({ message: "User role updated" });
});

// Delete user
app.delete("/api/users/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  await db.run("DELETE FROM users WHERE id = ?", [id]);
  res.json({ message: "User deleted" });
});

// ==============================
// PRODUCT ROUTES
// ==============================

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await db.all("SELECT * FROM products ORDER BY created_at DESC");
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to load products" });
  }
});

// Get single product
app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const product = await db.get("SELECT * FROM products WHERE id = ?", [id]);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// Add new product (admin)
app.post("/api/products", verifyAdmin, async (req, res) => {
  const { name, description, image, gender, quality, availability } = req.body;
  await db.run(
    "INSERT INTO products (name, description, image, gender, quality, availability) VALUES (?, ?, ?, ?, ?, ?)",
    [name, description, image, gender, quality, availability]
  );
  res.json({ message: "Product added successfully" });
});

// Delete product (admin)
app.delete("/api/products/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  await db.run("DELETE FROM products WHERE id = ?", [id]);
  res.json({ message: "Product deleted successfully" });
});