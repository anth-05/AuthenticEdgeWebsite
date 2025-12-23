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
const ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "https://authenticedgewebsite.onrender.com", // Your Backend
    "https://authenticedgewebsite-1.onrender.com/" // ADD YOUR ACTUAL FRONTEND URL HERE
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("Blocked by CORS:", origin); // Helps you debug in Render logs
            callback(new Error("CORS not allowed"));
        }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}));
// ---------- Middleware ----------
app.use(express.json());
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));

// ---------- Database pool ----------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ---------- Cloudinary Setup ----------
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}
const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: "products", allowed_formats: ["jpg", "png", "webp"] },
});
const upload = multer({ storage });

// ---------- Auth Middlewares ----------
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: "Session expired" });
        req.user = payload;
        next();
    });
}

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    next();
};

// ---------- Socket.io (Concierge) ----------
io.on("connection", (socket) => {
    socket.on("join", (userId) => {
        socket.join(`room_${userId}`);
    });

    socket.on("user_message", async (data) => {
        const { userId, text } = data;
        const result = await pool.query(
            "INSERT INTO messages (user_id, sender, message) VALUES ($1, 'user', $2) RETURNING *",
            [userId, text]
        );
        const savedMsg = result.rows[0];
        // Notify Admins in real-time
        io.emit("admin_notification", savedMsg);
        // Send back to the user's specific room
        io.to(`room_${userId}`).emit("new_message", savedMsg);
    });

    socket.on("admin_reply", async (data) => {
        const { userId, text } = data;
        const result = await pool.query(
            "INSERT INTO messages (user_id, sender, message) VALUES ($1, 'admin', $2) RETURNING *",
            [userId, text]
        );
        io.to(`room_${userId}`).emit("new_message", result.rows[0]);
    });
});

// ---------- ROUTES ----------

// 1. AUTH & REGISTRATION
app.post("/api/register", async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role",
            [email, hashedPassword, role || "user"]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: "Email already exists" });
    }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
        return res.status(400).json({ error: "Invalid credentials" });
    }
    const user = rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, role: user.role, userId: user.id });
});

// 2. USER PROFILE & SETTINGS
app.get("/api/user", authenticateToken, async (req, res) => {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users WHERE id=$1", [req.user.id]);
    res.json({ user: rows[0] });
});

app.put("/api/user/email", authenticateToken, async (req, res) => {
    const { email } = req.body;
    await pool.query("UPDATE users SET email=$1 WHERE id=$2", [email, req.user.id]);
    res.json({ success: true });
});

app.put("/api/user/password", authenticateToken, async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashedPassword, req.user.id]);
    res.json({ success: true });
});

app.delete("/api/user", authenticateToken, async (req, res) => {
    await pool.query("DELETE FROM users WHERE id=$1", [req.user.id]);
    res.json({ success: true });
});

// 3. SUBSCRIPTIONS
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

// 4. ADMIN DASHBOARD
app.get("/api/admin/subscriptions", authenticateToken, verifyAdmin, async (req, res) => {
    const { rows } = await pool.query(`
        SELECT s.*, u.email FROM subscriptions s 
        JOIN users u ON u.id = s.user_id 
        WHERE s.status = 'pending'
    `);
    res.json(rows);
});

app.post("/api/admin/subscriptions/:userId", authenticateToken, verifyAdmin, async (req, res) => {
    const { action } = req.body;
    if (action === "approve") {
        await pool.query("UPDATE subscriptions SET current_plan=requested_plan, requested_plan=NULL, status='active' WHERE user_id=$1", [req.params.userId]);
    } else {
        await pool.query("UPDATE subscriptions SET requested_plan=NULL, status='none' WHERE user_id=$1", [req.params.userId]);
    }
    res.json({ success: true });
});

// 5. PRODUCTS
app.get("/api/products", async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(rows);
});

app.post("/api/products", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
    const { name, description, gender, quality, availability } = req.body;
    const image = req.file ? req.file.path : req.body.image;
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

// 6. CONTACT
app.post("/api/contact", async (req, res) => {
    // Basic implementation - verify frontend sends (name, email, message)
    res.json({ success: true, message: "Editorial team notified." });
});
// ---------- ADMIN: USER MANAGEMENT ----------

// Get all stats and user lists for the Admin Dashboard
app.get("/api/admin/users", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        // Fetch all users
        const usersResult = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
        const users = usersResult.rows;

        // Calculate stats
        const totalUsers = users.length;
        const adminUsers = users.filter(u => u.role === 'admin').length;
        const regularUsers = totalUsers - adminUsers;

        res.json({
            stats: { totalUsers, adminUsers, regularUsers },
            users: users // This populates the "Manage Users" and "Recent Users" tables
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Admin: Delete a user
app.delete("/api/admin/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});
// Ensure this matches exactly what your user-dashboard.js expects
app.get("/api/user", authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT id, email, role, created_at FROM users WHERE id = $1", 
            [req.user.id]
        );
        
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });

        // The frontend expects { user: { ... } }
        res.json({ user: rows[0] }); 
    } catch (err) {
        res.status(500).json({ error: "Database sync error" });
    }
});

server.listen(PORT, () => console.log(`🚀 Authentic Edge Backend live on port ${PORT}`));