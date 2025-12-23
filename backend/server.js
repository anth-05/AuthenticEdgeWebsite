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
import multer from "multer";
import { Server } from "socket.io"; // Import Server
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app); // Create the server from Express
const io = new Server(server, {
  cors: {
    origin: "*", // Allows your frontend to connect
    methods: ["GET", "POST"]
  }
});

// IMPORTANT: Use server.listen, NOT app.listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ---------- Configuration ----------
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5500,https://authenticedgewebsite-1.onrender.com")
  .split(",")
  .map(s => s.trim());

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: function (origin, callback) {
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


// ---------- Database pool ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ---------- Cloudinary / Multer Setup ----------
let upload;
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: { folder: "products", allowed_formats: ["jpg", "png", "webp"] },
  });
  upload = multer({ storage: cloudStorage });
} else {
    // Basic local fallback
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    upload = multer({ dest: "uploads/" }); 
}

// ---------- Auth Helpers ----------
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = payload;
    next();
  });
}

function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// ==========================================
// 🚀 REAL-TIME CHAT ENGINE (Matches user-chat.js)
// ==========================================
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // 1. Join Room
  // user-chat.js emits "join" with userId (e.g., "5")
  // admin-messages.js emits "join" with "admin_global"
  socket.on("join", (roomOrId) => {
    // If it's the admin, join the global room
    if (roomOrId === "admin_global") {
        socket.join("admin_global");
        console.log("Admin joined global chat");
    } else {
        // If it's a user, prefix their ID to create a unique room
        const userRoom = `user_${roomOrId}`;
        socket.join(userRoom);
        console.log(`User joined room: ${userRoom}`);
    }
  });

  // 2. User Sends Message (Matches user-chat.js)
  socket.on("user_msg", async (data) => {
    // Client sends: { userId, message }
    const { userId, message } = data; 
    
    try {
      // Save to DB
      const result = await pool.query(
        "INSERT INTO messages (user_id, sender, message, status) VALUES ($1, 'user', $2, 'unread') RETURNING *",
        [userId, message]
      );
      const savedMsg = result.rows[0];

      // Broadcast to Admin Dashboard
      io.to("admin_global").emit("admin_notification", savedMsg);
      
    } catch (err) {
      console.error("User msg error:", err);
    }
  });

  // 3. Admin Replies (Matches admin-messages.js)
  socket.on("admin_reply", async (data) => {
    // Admin sends: { userId, text }
    const { userId, text } = data;

    try {
      // Save to DB
      const result = await pool.query(
        "INSERT INTO messages (user_id, sender, message, status) VALUES ($1, 'admin', $2, 'read') RETURNING *",
        [userId, text]
      );
      const savedMsg = result.rows[0];

      // Send to the specific User's room
      io.to(`user_${userId}`).emit("new_msg", savedMsg);
      
    } catch (err) {
      console.error("Admin reply error:", err);
    }
  });
});

// ==========================================
// 📡 API ROUTES
// ==========================================

// --- AUTH ---
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password, role) VALUES ($1,$2,$3)", [email, hashed, role || "user"]);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: "Registration failed" }); }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
        return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: "24h" });
    // IMPORTANT: Sending userId back so user-chat.js can use it
    res.json({ token, role: rows[0].role, userId: rows[0].id });
  } catch (err) { res.status(500).json({ error: "Login error" }); }
});

// --- ADMIN MESSAGING (Matches admin-messages.js) ---
app.get("/api/admin/conversations", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT ON (m.user_id) 
                m.user_id, u.email, m.message, m.created_at
            FROM messages m
            JOIN users u ON m.user_id = u.id
            ORDER BY m.user_id, m.created_at DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: "Inbox error" }); }
});

app.get("/api/admin/messages/:userId", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { rows } = await pool.query("SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
        await pool.query("UPDATE messages SET status = 'read' WHERE user_id = $1 AND sender = 'user'", [userId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: "Chat history error" }); }
});

// --- PRODUCTS ---
app.get("/api/products", async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(rows);
});

app.post("/api/products", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
    const { name, description, gender, quality, availability, image } = req.body;
    const finalImage = req.file ? req.file.path : image;
    await pool.query(
        "INSERT INTO products (name, description, image, gender, quality, availability) VALUES ($1,$2,$3,$4,$5,$6)",
        [name, description, finalImage, gender, quality, availability]
    );
    res.json({ success: true });
});

app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
    await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
    res.json({ success: true });
});

// --- ADMIN DASHBOARD DATA ---
app.get("/api/admin/users", authenticateToken, verifyAdmin, async (req, res) => {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
    const stats = {
        totalUsers: rows.length,
        adminUsers: rows.filter(u => u.role === 'admin').length,
        regularUsers: rows.filter(u => u.role === 'user').length
    };
    res.json({ stats, users: rows });
});

app.delete("/api/admin/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
    await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
    res.json({ success: true });
});

// --- USER PROFILE & SUBSCRIPTIONS ---
app.get("/api/user", authenticateToken, async (req, res) => {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users WHERE id=$1", [req.user.id]);
    res.json({ user: rows[0] });
});

app.get("/api/subscription", authenticateToken, async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM subscriptions WHERE user_id=$1", [req.user.id]);
    res.json(rows[0] || { status: 'none', current_plan: 'None' });
});

app.post("/api/subscription/request", authenticateToken, async (req, res) => {
    const { plan } = req.body;
    // Upsert logic for subscription request
    await pool.query(`
        INSERT INTO subscriptions (user_id, requested_plan, status) VALUES ($1, $2, 'pending')
        ON CONFLICT (user_id) DO UPDATE SET requested_plan = $2, status = 'pending'
    `, [req.user.id, plan]);
    res.json({ success: true });
});

app.get("/api/admin/subscriptions", authenticateToken, verifyAdmin, async (req, res) => {
    const { rows } = await pool.query(`
        SELECT s.*, u.email FROM subscriptions s JOIN users u ON s.user_id = u.id WHERE s.status = 'pending'
    `);
    res.json(rows);
});

app.post("/api/admin/subscriptions/:userId", authenticateToken, verifyAdmin, async (req, res) => {
    const { action } = req.body;
    const status = action === 'approve' ? 'active' : 'rejected';
    await pool.query("UPDATE subscriptions SET status = $1 WHERE user_id = $2", [status, req.params.userId]);
    res.json({ success: true });
});

// --- CONTACT ---
app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body;
    // Logic to send email or save to DB
    console.log(`Contact from ${name}: ${message}`);
    res.json({ success: true });
});


server.listen(PORT, () => console.log(`🚀 System Online on Port ${PORT}`));