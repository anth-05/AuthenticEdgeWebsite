import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import http from "http";
import { Server } from "socket.io";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const { Pool } = pkg;
const app = express();
const server = http.createServer(app);

// 1. DATABASE SETUP
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render/Heroku
});

// 2. SOCKET.IO SETUP
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 3. CLOUDINARY STORAGE (For Product Images)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: "authentic_edge_products", allowed_formats: ["jpg", "png", "webp"] }
});
const upload = multer({ storage: storage });

// 4. MIDDLEWARE
app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access denied" });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
    next();
};

// 5. AUTHENTICATION ROUTES
app.post("/api/register", async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING id, email, role",
            [email, hashedPassword]
        );
        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(400).json({ error: "User already exists or database error" });
    }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

        const validPass = await bcrypt.compare(password, rows[0].password);
        if (!validPass) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, role: rows[0].role });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// 6. PRODUCT MANAGEMENT (Supports URL & Upload)
app.get("/api/products", async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(rows);
});

app.post("/api/products", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
    const { name, description, gender, quality, availability, image } = req.body;
    const imageUrl = req.file ? req.file.path : image; // Use uploaded file path or provided URL

    try {
        await pool.query(
            "INSERT INTO products (name, description, gender, quality, availability, image) VALUES ($1, $2, $3, $4, $5, $6)",
            [name, description, gender, quality, availability, imageUrl]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save product" });
    }
});

// 7. ADMIN DASHBOARD & USER MGMT
app.get("/api/admin/data", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const users = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
        const totalUsers = users.rowCount;
        const adminUsers = users.rows.filter(u => u.role === 'admin').length;
        const regularUsers = totalUsers - adminUsers;

        res.json({
            stats: { totalUsers, adminUsers, regularUsers },
            users: users.rows
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});

app.delete("/api/admin/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// 8. SUBSCRIPTION MANAGEMENT
app.get("/api/admin/subscriptions", authenticateToken, verifyAdmin, async (req, res) => {
    const { rows } = await pool.query(`
        SELECT s.*, u.email 
        FROM subscriptions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.status = 'pending'
    `);
    res.json(rows);
});

app.post("/api/admin/subscriptions/:userId", authenticateToken, verifyAdmin, async (req, res) => {
    const { action } = req.body;
    const status = action === 'approve' ? 'active' : 'rejected';
    try {
        await pool.query("UPDATE subscriptions SET status = $1 WHERE user_id = $2", [status, req.params.userId]);
        if (action === 'approve') {
            await pool.query("UPDATE users SET tier = 'premium' WHERE id = $1", [req.params.userId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Sync failed" });
    }
});

// 9. CONTACT FORM
app.post("/api/contact", async (req, res) => {
    const { name, email, phone, message } = req.body;
    try {
        await pool.query(
            "INSERT INTO contact_messages (name, email, phone, message) VALUES ($1, $2, $3, $4)",
            [name, email, phone, message]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Message failed to send" });
    }
});

// 10. REAL-TIME CHAT (Socket.io)
io.on("connection", (socket) => {
    socket.on("join", (room) => socket.join(room));

    socket.on("user_msg", async (data) => {
        // Save to DB logic here
        io.to("admin_global").emit("admin_notification", data);
    });

    socket.on("admin_reply", async (data) => {
        // Save to DB logic here
        io.to(data.userId).emit("new_msg", data);
    });
});

server.listen(5000, () => console.log(">>> SYSTEM OPERATIONAL ON PORT 5000"));