import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-html";
import fetch from "node-fetch";

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);

// ---------- Configuration ----------
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5500,https://authenticedgewebsite-1.onrender.com")
  .split(",")
  .map(s => s.trim());

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (mobile apps, curl)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ---------- Helpers / Middleware ----------
function respondServerError(res, err, msg = "Server error") {
  console.error(msg, err);
  return res.status(500).json({ error: msg });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = payload; // { id, email, role }
    next();
  });
}

function verifyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Missing user" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// ---------- Rate limiters ----------
const contactLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { success: false, message: "Too many requests" } });

// ---------- Email transport ----------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CONTACT_EMAIL,
    pass: process.env.CONTACT_EMAIL_PASSWORD,
  },
});

// ---------- Routes: Public ----------
app.get("/", (req, res) => res.json({ ok: true, message: "API is up" }));

app.post("/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, message, recaptcha } = req.body;
    if (!name || !email || !message) return res.status(400).json({ success: false, message: "Missing fields" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: "Invalid email" });

    // verify recaptcha token (client must send `recaptcha` field)
    if (!process.env.RECAPTCHA_SECRET) {
      console.warn("RECAPTCHA_SECRET not set — skipping recaptcha verification");
    } else {
      if (!recaptcha) return res.status(400).json({ success: false, message: "Missing recaptcha token" });

      const verify = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptcha}`,
        { method: "POST" }
      );
      const out = await verify.json();
      if (!out.success || (out.score !== undefined && out.score < 0.5)) {
        return res.status(400).json({ success: false, message: "reCAPTCHA failed" });
      }
    }

    const cleanMessage = sanitize(message);

    // Load email template if exists
    let htmlTemplate = `

New contact message
Name: ${name}
Email: ${email}
Phone: ${phone || "Not provided"}
Message: ${cleanMessage}
`;
    const templatePath = path.join(__dirname, "emailTemplates", "contact.html");
    if (fs.existsSync(templatePath)) {
      htmlTemplate = fs.readFileSync(templatePath, "utf8")
        .replace(/{{name}}/g, name)
        .replace(/{{email}}/g, email)
        .replace(/{{phone}}/g, phone || "Not provided")
        .replace(/{{message}}/g, cleanMessage);
    }

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.CONTACT_EMAIL}>`,
      to: process.env.CONTACT_EMAIL,
      subject: `New Contact Message from ${name}`,
      html: htmlTemplate,
    });

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    respondServerError(res, err, "Email failed to send");
  }
});

// ---------- Routes: Auth ----------
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const { rowCount } = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (rowCount > 0) return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password, role) VALUES ($1,$2,$3)", [email, hashed, role || "user"]);
    res.json({ success: true });
  } catch (err) {
    respondServerError(res, err, "Registration failed");
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (rows.length === 0) return res.status(400).json({ error: "Invalid login" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid login" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || "1h" });

    res.json({ token, role: user.role });
  } catch (err) {
    respondServerError(res, err, "Login failed");
  }
});

// ---------- Routes: User info (protected) ----------
// Keep /api/protected for compatibility, and also expose /api/user
app.get("/api/protected", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users WHERE id=$1", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    respondServerError(res, err, "Failed to fetch user");
  }
});

app.get("/api/user", authenticateToken, async (req, res) => {
  // Same as /api/protected but with a different route name
  try {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users WHERE id=$1", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    respondServerError(res, err, "Failed to fetch user");
  }
});

// Update email/password/delete account
app.put("/api/user/email", authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });
    await pool.query("UPDATE users SET email=$1 WHERE id=$2", [email, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    respondServerError(res, err, "Failed to update email");
  }
});

app.put("/api/user/password", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Missing password" });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashed, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    respondServerError(res, err, "Failed to update password");
  }
});

app.delete("/api/user", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=$1", [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    respondServerError(res, err, "Failed to delete account");
  }
});

// ---------- Routes: Admin (users/products/stats) ----------
app.get("/api/users", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    respondServerError(res, err, "Failed to fetch users");
  }
});

app.put("/api/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Missing role" });
    const result = await pool.query("UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, role", [role, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to update user");
  }
});

app.delete("/api/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM users WHERE id=$1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    respondServerError(res, err, "Failed to delete user");
  }
});

// Stats route for admin dashboard
app.get("/api/stats", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const usersRes = await pool.query("SELECT COUNT(*)::int FROM users");
    const adminsRes = await pool.query("SELECT COUNT(*)::int FROM users WHERE role='admin'");
    const regularRes = await pool.query("SELECT COUNT(*)::int FROM users WHERE role='user'");
    res.json({ users: usersRes.rows[0].count, admins: adminsRes.rows[0].count, regularUsers: regularRes.rows[0].count });
  } catch (err) {
    respondServerError(res, err, "Failed to fetch stats");
  }
});

// ---------- Routes: Products (admin) ----------
app.get("/api/products", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, description, image, gender, quality, availability, created_at FROM products ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    respondServerError(res, err, "Failed to fetch products");
  }
});

app.post("/api/products", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, image, gender, quality, availability } = req.body;
    if (!name) return res.status(400).json({ error: "Product name is required." });
    const { rows } = await pool.query(`INSERT INTO products (name, description, image, gender, quality, availability) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [
      name, description, image, gender, quality, availability
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to add product");
  }
});

app.put("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, gender, quality, availability } = req.body;
    const result = await pool.query(`UPDATE products SET name=$1, description=$2, image=$3, gender=$4, quality=$5, availability=$6 WHERE id=$7 RETURNING *`, [
      name, description, image, gender, quality, availability, id
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json(result.rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to update product");
  }
});

app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM products WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    respondServerError(res, err, "Failed to delete product");
  }
});

// ---------- Optional: Subscriptions & Messages scaffold ----------
// (Implement real business logic as needed)
app.get("/api/subscriptions", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM subscriptions WHERE user_id=$1", [req.user.id]);
    res.json(rows);
  } catch (err) {
    respondServerError(res, err, "Failed to fetch subscriptions");
  }
});

app.get("/api/messages", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
    res.json(rows);
  } catch (err) {
    respondServerError(res, err, "Failed to fetch messages");
  }
});

// ---------- Database initialization ----------
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

    // Seed default accounts (only if truly missing)
    let result = await pool.query("SELECT 1 FROM users WHERE email='admin'");
    if (result.rowCount === 0) {
      await pool.query("INSERT INTO users (email, password, role) VALUES ($1,$2,$3)", ["admin", await bcrypt.hash("admin123", 10), "admin"]);
    }
    result = await pool.query("SELECT 1 FROM users WHERE email='user'");
    if (result.rowCount === 0) {
      await pool.query("INSERT INTO users (email, password, role) VALUES ($1,$2,$3)", ["user", await bcrypt.hash("user123", 10), "user"]);
    }

    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Database init failed:", err);
    process.exit(1);
  }
})();

// ---------- Global error handler (optional) ----------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Unexpected server error" });
});
