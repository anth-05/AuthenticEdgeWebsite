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

    // === SUBS TABLE ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        current_plan TEXT,          
        requested_plan TEXT,        
        status TEXT CHECK(status IN ('active', 'pending', 'none')) DEFAULT 'none',
        updated_at TIMESTAMP DEFAULT NOW()
    );`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        sender TEXT NOT NULL CHECK(sender IN ('user', 'admin')),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        status TEXT DEFAULT 'unread'
    );`)

    console.log("📦 Subscriptions table ready");
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


// Update Email user
app.put("/api/user/email", authenticateToken, async (req, res) => {
  const { email } = req.body;

  try {
    await pool.query("UPDATE users SET email = $1 WHERE id = $2", [
      email,
      req.user.id,
    ]);
    res.json({ message: "Email updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update email" });
  }
});

// Update password user
app.put("/api/user/password", authenticateToken, async (req, res) => {
  const { password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashed,
      req.user.id,
    ]);
    res.json({ message: "Password updated" });
  } catch {
    res.status(500).json({ error: "Failed to update password" });
  }
});

// Delete account user
app.delete("/api/user/delete", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);
    res.json({ message: "Account deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete account" });
  }
});
async function getSubscription(userId) {
  const result = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  return result.rows[0];
}
app.get("/api/subscription", authenticateToken, async (req, res) => {
  try {
    let sub = await getSubscription(req.user.id);

    if (!sub) {
      // Create "none" subscription if missing
      await pool.query(
        `INSERT INTO subscriptions (user_id, current_plan, status)
         VALUES ($1, $2, $3)`,
        [req.user.id, null, "none"]
      );
      sub = await getSubscription(req.user.id);
    }

    res.json(sub);
  } catch (err) {
    console.error("Subscription fetch error:", err);
    res.status(500).json({ error: "Failed to load subscription" });
  }
});
app.post("/api/subscription/request", authenticateToken, async (req, res) => {
  const { plan } = req.body;

  if (!plan)
    return res.status(400).json({ error: "Plan selection required" });

  try {
    let sub = await getSubscription(req.user.id);

    if (!sub) {
      // Create subscription record if not exists
      await pool.query(
        `INSERT INTO subscriptions (user_id, current_plan, status)
         VALUES ($1, $2, $3)`,
        [req.user.id, null, "none"]
      );
      sub = await getSubscription(req.user.id);
    }

    await pool.query(
      `UPDATE subscriptions
       SET requested_plan = $1, status = 'pending', updated_at = NOW()
       WHERE user_id = $2`,
      [plan, req.user.id]
    );

    res.json({ message: "Your subscription change request is pending approval." });
  } catch (err) {
    console.error("Sub request error:", err);
    res.status(500).json({ error: "Failed to request subscription change" });
  }
});
app.get("/api/admin/subscriptions/pending", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.user_id, s.current_plan, s.requested_plan, s.status, u.email
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       WHERE s.status = 'pending'
       ORDER BY s.updated_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load pending requests" });
  }
});
app.put("/api/admin/subscriptions/:id/approve", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const sub = await pool.query("SELECT * FROM subscriptions WHERE id = $1", [id]);
    const s = sub.rows[0];

    if (!s) return res.status(404).json({ error: "Subscription not found" });

    await pool.query(
      `UPDATE subscriptions
       SET current_plan = requested_plan,
           requested_plan = NULL,
           status = 'active',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ message: "Subscription plan updated successfully." });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ error: "Failed to approve subscription" });
  }
});
app.put("/api/admin/subscriptions/:id/reject", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE subscriptions
       SET requested_plan = NULL,
           status = 'active',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ message: "Subscription request rejected." });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: "Failed to reject request" });
  }
});
app.post("/api/messages/send", authenticateToken, async (req, res) => {
  const { message, toUser } = req.body;

  const sender = req.user.role === "admin" ? "admin" : "user";
  const userId = req.user.role === "admin" ? toUser : req.user.id;

  await pool.query(
    `INSERT INTO messages (user_id, sender, message) VALUES ($1, $2, $3)`,
    [userId, sender, message]
  );

  res.json({ success: true });
});
app.get("/api/messages/:userId", verifyAdmin, async (req, res) => {
  const { userId } = req.params;
  const result = await pool.query(
    "SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  );
  res.json(result.rows);
});
app.get("/api/messages", authenticateToken, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at ASC",
    [req.user.id]
  );
  res.json(result.rows);
});
