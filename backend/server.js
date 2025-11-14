// ==============================
// IMPORTS & SETUP
// ==============================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";

const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: [
    "https://authenticedge.netlify.app", // ✅ Your Netlify URL
    "http://localhost:5500" // (optional for local testing)
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ==============================
// DATABASE INITIALIZATION
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render
});

(async () => {
  try {
    // === USERS TABLE ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // === PRODUCTS TABLE ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image TEXT,
        gender TEXT,
        quality TEXT,
        availability TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Database ready (users & products)");

    // === DEFAULT ACCOUNTS ===
    const admin = await pool.query("SELECT * FROM users WHERE email = $1", ["admin"]);
    if (admin.rows.length === 0) {
      const hashed = await bcrypt.hash("admin123", 10);
      await pool.query(
        "INSERT INTO users (email, password, role) VALUES ($1, $2, $3)",
        ["admin", hashed, "admin"]
      );
      console.log("👑 Default admin: admin / admin123");
    }

    const user = await pool.query("SELECT * FROM users WHERE email = $1", ["user"]);
    if (user.rows.length === 0) {
      const hashed = await bcrypt.hash("user123", 10);
      await pool.query(
        "INSERT INTO users (email, password, role) VALUES ($1, $2, $3)",
        ["user", hashed, "user"]
      );
      console.log("👤 Default user: user / user123");
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
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
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: "Email is already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id",
      [email, hashed, role || "user"]
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
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
app.get("/api/stats", verifyAdmin, async (req, res) => {
  try {
    const users = await pool.query("SELECT COUNT(*) AS count FROM users");
    const admins = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role='admin'");
    const regular = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role='user'");

    res.json({
      users: users.rows[0].count,
      admins: admins.rows[0].count,
      regularUsers: regular.rows[0].count
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/recent-users", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT email, role, created_at FROM users ORDER BY id DESC LIMIT 5"
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch recent users" });
  }
});

app.get("/api/users", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to load users" });
  }
});

app.put("/api/users/:id", verifyAdmin, async (req, res) => {
  const { role } = req.body;
  const { id } = req.params;
  await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
  res.json({ message: "User role updated" });
});

app.delete("/api/users/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  res.json({ message: "User deleted" });
});

// ==============================
// PRODUCT ROUTES
// ==============================
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  const product = result.rows[0];
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

app.post("/api/products", verifyAdmin, async (req, res) => {
  const { name, description, image, gender, quality, availability } = req.body;
  await pool.query(
    "INSERT INTO products (name, description, image, gender, quality, availability) VALUES ($1, $2, $3, $4, $5, $6)",
    [name, description, image, gender, quality, availability]
  );
  res.json({ message: "Product added successfully" });
});

app.delete("/api/products/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM products WHERE id = $1", [id]);
  res.json({ message: "Product deleted successfully" });
});