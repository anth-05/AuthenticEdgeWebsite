import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import http from "http";

const { Pool } = pkg;

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://authenticedgewebsite-1.onrender.com",
      "http://localhost:5500",
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Database pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });
  
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

function verifyAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    next();
  });
}

// Routes

// Email route
app.post("/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    // Load HTML template
    const templatePath = path.join(__dirname, "emailTemplates", "contact.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace placeholders
    htmlTemplate = htmlTemplate
      .replace("{{name}}", name)
      .replace("{{email}}", email)
      .replace("{{phone}}", phone || "Not provided")
      .replace("{{message}}", message);

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.CONTACT_EMAIL}>`,
      to: process.env.CONTACT_EMAIL,
      subject: `New Contact Message from ${name}`,
      html: htmlTemplate,    // <--- send HTML
    });

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ success: false, message: "Email failed to send" });
  }
});


app.listen(3000, () => console.log("Server running"));
// Get products (admin only)
app.get("/api/products", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, description, image, gender, quality, availability, created_at FROM products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Add product (admin only)
app.post("/api/products", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, image, gender, quality, availability } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Product name is required." });
    }

    const { rows } = await pool.query(
      `INSERT INTO products (name, description, image, gender, quality, availability)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description, image, gender, quality, availability]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Failed to add product:", err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Delete product (admin only)
app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM products WHERE id = $1", [id]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Update product (admin only)
app.put("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, gender, quality, availability } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, image=$3, gender=$4, quality=$5, availability=$6
       WHERE id=$7 RETURNING *`,
      [name, description, image, gender, quality, availability, id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Product not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// User register
app.post("/api/register", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const { rowCount } = await pool.query("SELECT 1 FROM users WHERE email=$1", [
      email,
    ]);
    if (rowCount > 0)
      return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (email, password, role) VALUES ($1,$2,$3)",
      [email, hashed, role || "user"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// User login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (rows.length === 0)
      return res.status(400).json({ error: "Invalid login" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid login" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Database initialization & server start
(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'user')) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      gender TEXT,
      quality TEXT,
      availability TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      current_plan TEXT,
      requested_plan TEXT,
      status TEXT CHECK(status IN ('active','pending','none')) DEFAULT 'none',
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      sender TEXT CHECK(sender IN ('user','admin')) NOT NULL,
      message TEXT,
      file_url TEXT,
      status TEXT DEFAULT 'unread',
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    // Create default users if missing
    let result = await pool.query("SELECT 1 FROM users WHERE email='admin'");
    if (result.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (email, password, role) VALUES ($1,$2,$3)",
        ["admin", await bcrypt.hash("admin123", 10), "admin"]
      );
    }
    result = await pool.query("SELECT 1 FROM users WHERE email='user'");
    if (result.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (email, password, role) VALUES ($1,$2,$3)",
        ["user", await bcrypt.hash("user123", 10), "user"]
      );
    }

    server.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
    );
  } catch (err) {
    console.error("❌ Database init failed:", err);
    process.exit(1);
  }
})();
