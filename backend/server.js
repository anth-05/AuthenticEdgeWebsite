// ==============================
// IMPORTS & SETUP
// ==============================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import multer from "multer";
import http from "http";
import { Server } from "socket.io";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


const { Pool } = pkg;

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.use(cors({
  origin: [
    "https://authenticedge.netlify.app",
    "http://localhost:5500"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Static for file uploads
app.use("/uploads", express.static("uploads"));

// ==============================
// SOCKET.IO
// ==============================
const io = new Server(server, {
  cors: { origin: "*" }
});

const adminSockets = new Map();
const userSockets = new Map();

io.on("connection", socket => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("register", ({ userId, role }) => {
    if (role === "admin") adminSockets.set(userId, socket.id);
    else userSockets.set(userId, socket.id);
  });

  socket.on("sendMessage", async data => {
    const { userId, sender, message, fileUrl } = data;

    await pool.query(
      `INSERT INTO messages (user_id, sender, message, file_url)
       VALUES ($1, $2, $3, $4)`,
      [userId, sender, message, fileUrl || null]
    );

    if (sender === "user") {
      adminSockets.forEach(sock => io.to(sock).emit("newMessage", data));
    }

    if (sender === "admin") {
      const sock = userSockets.get(userId);
      if (sock) io.to(sock).emit("newMessage", data);
    }
  });
});

// ==============================
// DATABASE
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize tables
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'user')) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        current_plan TEXT,
        requested_plan TEXT,
        status TEXT CHECK(status IN ('active','pending','none')) DEFAULT 'none',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sender TEXT CHECK(sender IN ('user','admin')) NOT NULL,
        message TEXT,
        file_url TEXT,
        status TEXT DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("📦 Tables ready");

    // Create default accounts
    const admin = await pool.query("SELECT 1 FROM users WHERE email='admin'");
    if (admin.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (email, password, role) VALUES ($1,$2,$3)",
        ["admin", await bcrypt.hash("admin123", 10), "admin"]
      );
    }

    const user = await pool.query("SELECT 1 FROM users WHERE email='user'");
    if (user.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (email, password, role) VALUES ($1,$2,$3)",
        ["user", await bcrypt.hash("user123", 10), "user"]
      );
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

  } catch (err) {
    console.error("❌ Database init failed:", err);
  }
})();

// ==============================
// AUTH MIDDLEWARE
// ==============================
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
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

// ==============================
// AUTH ROUTES
// ==============================
app.post("/api/register", async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const found = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (found.rowCount > 0)
      return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (email, password, role) VALUES ($1,$2,$3)",
      [email, hashed, role || "user"]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: "Invalid login" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid login" });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token, role: user.role });
});

// ==============================
// SUBSCRIPTIONS
// ==============================
async function getSubscription(userId) {
  const result = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id=$1 LIMIT 1",
    [userId]
  );
  return result.rows[0];
}

app.get("/api/subscription", authenticateToken, async (req, res) => {
  let sub = await getSubscription(req.user.id);

  if (!sub) {
    await pool.query(
      `INSERT INTO subscriptions (user_id, current_plan, status)
       VALUES ($1,$2,$3)`,
      [req.user.id, null, "none"]
    );
    sub = await getSubscription(req.user.id);
  }

  res.json(sub);
});

app.post("/api/subscription/request", authenticateToken, async (req, res) => {
  const { plan } = req.body;

  await pool.query(
    `UPDATE subscriptions SET requested_plan=$1, status='pending'
     WHERE user_id=$2`,
    [plan, req.user.id]
  );

  res.json({ message: "Request submitted" });
});

// Admin view pending
app.get("/api/admin/subscriptions/pending", verifyAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT s.*, u.email FROM subscriptions s
    JOIN users u ON s.user_id=u.id
    WHERE status='pending'
  `);
  res.json(result.rows);
});

// Approve
app.put("/api/admin/subscriptions/:id/approve", verifyAdmin, async (req, res) => {
  await pool.query(`
    UPDATE subscriptions
    SET current_plan=requested_plan,
        requested_plan=NULL,
        status='active'
    WHERE id=$1
  `, [req.params.id]);

  res.json({ message: "Approved" });
});

// Reject
app.put("/api/admin/subscriptions/:id/reject", verifyAdmin, async (req, res) => {
  await pool.query(`
    UPDATE subscriptions
    SET requested_plan=NULL,
        status='active'
    WHERE id=$1
  `, [req.params.id]);

  res.json({ message: "Rejected" });
});

// ==============================
// CHAT (MESSAGES)
// ==============================
app.get("/api/messages", authenticateToken, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
    [req.user.id]
  );
  res.json(result.rows);
});

app.get("/api/messages/:userId", verifyAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
    [req.params.userId]
  );
  res.json(result.rows);
});

// Unread count for admin
app.get("/api/messages-unread", verifyAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT COUNT(*) FROM messages WHERE status='unread'"
  );
  res.json({ count: Number(result.rows[0].count) });
});

// ==============================
// FILE UPLOADS (for chat)
// ==============================
const upload = multer({ dest: "uploads/" });

app.post("/api/messages/upload", upload.single("file"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});
