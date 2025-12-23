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
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-html";
import fetch from "node-fetch";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const { Pool } = pkg; 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);

// ---------- Socket.io Setup ----------
const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGINS || "http://localhost:5500").split(","),
    methods: ["GET", "POST"]
  }
});

// ---------- Configuration ----------
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5500,https://authenticedgewebsite-1.onrender.com")
  .split(",")
  .map(s => s.trim());

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
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
}));

// ---------- Database pool ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ---------- Multer / Cloudinary Configuration ----------
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PRODUCTS_UPLOAD_DIR = path.join(UPLOADS_DIR, "products");
if (!fs.existsSync(PRODUCTS_UPLOAD_DIR)) fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

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
  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRODUCTS_UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  upload = multer({ storage: diskStorage });
}

// ---------- Auth Middlewares ----------
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

// ---------- Real-time Logic (Socket.io) ----------
io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.join(`room_${userId}`);
  });

  socket.on("user_message", async (data) => {
    const { userId, text } = data;
    const { rows } = await pool.query(
      "INSERT INTO messages (user_id, sender, message) VALUES ($1, 'user', $2) RETURNING *",
      [userId, text]
    );
    io.emit("admin_notification", rows[0]);
    io.to(`room_${userId}`).emit("new_message", rows[0]);
  });

  socket.on("admin_reply", async (data) => {
    const { userId, text } = data;
    const { rows } = await pool.query(
      "INSERT INTO messages (user_id, sender, message) VALUES ($1, 'admin', $2) RETURNING *",
      [userId, text]
    );
    io.to(`room_${userId}`).emit("new_message", rows[0]);
  });
});

// ---------- ROUTES ----------

// 1. AUTH
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
    return res.status(400).json({ error: "Invalid login" });
  }
  const user = rows[0];
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "24h" });
  res.json({ token, role: user.role, userId: user.id });
});
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;
  // Use your transporter to send an email here
  res.json({ success: true, message: "Email sent" });
});

// 2. USER SUBSCRIPTIONS
app.get("/api/subscription", authenticateToken, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM subscriptions WHERE user_id=$1", [req.user.id]);
  res.json(rows[0] || { current_plan: "Free", status: "none" });
});

app.post("/api/subscription/request", authenticateToken, async (req, res) => {
  const { plan } = req.body;
  await pool.query(`
    INSERT INTO subscriptions (user_id, requested_plan, status, updated_at)
    VALUES ($1, $2, 'pending', NOW())
    ON CONFLICT (user_id) DO UPDATE SET requested_plan=$2, status='pending', updated_at=NOW()
  `, [req.user.id, plan]);
  res.json({ success: true });
});

// 3. ADMIN SUBSCRIPTIONS
app.get("/api/admin/subscriptions", authenticateToken, verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT s.*, u.email FROM subscriptions s 
    JOIN users u ON u.id = s.user_id 
    WHERE s.status = 'pending'
  `);
  res.json(rows);
});

app.post("/api/admin/subscriptions/:userId", authenticateToken, verifyAdmin, async (req, res) => {
  const { action } = req.body; // 'approve' or 'reject'
  if (action === "approve") {
    await pool.query("UPDATE subscriptions SET current_plan=requested_plan, requested_plan=NULL, status='active' WHERE user_id=$1", [req.params.userId]);
  } else {
    await pool.query("UPDATE subscriptions SET requested_plan=NULL, status='none' WHERE user_id=$1", [req.params.userId]);
  }
  res.json({ success: true });
});

// 4. MESSAGES (Admin View)
app.get("/api/admin/conversations", authenticateToken, verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (user_id) user_id, message, created_at, u.email 
    FROM messages m JOIN users u ON u.id = m.user_id 
    ORDER BY user_id, created_at DESC
  `);
  res.json(rows);
});

app.get("/api/admin/messages/:userId", authenticateToken, verifyAdmin, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC", [req.params.userId]);
  res.json(rows);
});

// 5. PRODUCTS (CRUD)
app.get("/api/products", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
  res.json(rows);
});

app.post("/api/products", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
  const { name, description, gender, quality, availability } = req.body;
  const image = req.file ? (req.file.path || `/uploads/products/${req.file.filename}`) : req.body.image;
  const { rows } = await pool.query(
    "INSERT INTO products (name, description, image, gender, quality, availability) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [name, description, image, gender, quality, availability]
  );
  res.json(rows[0]);
});

app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ---------- Start Server ----------
server.listen(PORT, () => console.log(`🚀 Concierge Server live on port ${PORT}`));