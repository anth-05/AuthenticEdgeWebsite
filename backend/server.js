import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import path from "path";
import fs from "fs";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const { Pool } = pkg;
const app = express();

/* ---------------- DIRECTORY SETUP ---------------- */
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PRODUCTS_UPLOAD_DIR = path.join(UPLOADS_DIR, "products");
if (!fs.existsSync(PRODUCTS_UPLOAD_DIR)) {
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

/* ---------------- CONFIG ---------------- */
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5500,https://authenticedgewebsite-1.onrender.com"
).split(",").map(o => o.trim());

/* ---------------- MIDDLEWARE ---------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
// In server.js - ensure this is near the top
app.use(express.static(path.join(__dirname, 'public'))); 
// OR if your files are in the root:
app.use(express.static(__dirname));

/* ---------------- DATABASE ---------------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/* ---------------- HELPER FUNCTIONS ---------------- */
const sanitize = (str) => (typeof str === 'string' ? str.trim() : str);

const respondServerError = (res, err, message) => {
  console.error(message, err);
  res.status(500).json({ error: message, details: err.message });
};

/* ---------------- STORAGE CONFIG ---------------- */
let upload;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "products",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    },
  });
  upload = multer({ storage: cloudStorage, limits: { fileSize: 8 * 1024 * 1024 } });
  console.log("Uploads: using Cloudinary storage.");
} else {
  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRODUCTS_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    }
  });
  upload = multer({ storage: diskStorage, limits: { fileSize: 8 * 1024 * 1024 } });
  console.log("Uploads: using local disk storage.");
}

/* ---------------- AUTH HELPERS ---------------- */
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function verifyAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.sendStatus(403);
  next();
}

/* ---------------- AUTH ROUTES ---------------- */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, userId: rows[0].id, role: rows[0].role });
  } catch (err) { respondServerError(res, err, "Login failed"); }
});

/* ---------------- PRODUCT ROUTES ---------------- */
app.get("/api/products", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) { respondServerError(res, err, "Failed to fetch products"); }
});

app.post("/api/products", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
  try {
    const { name, description = "", image: imageUrl, gender, quality, availability } = req.body;
    if (!name) return res.status(400).json({ error: "Product name is required." });

    let finalImage = imageUrl || null;
    if (req.file) {
      finalImage = req.file.path || req.file.secure_url || `/uploads/products/${req.file.filename}`;
    }

    const { rows } = await pool.query(
      `INSERT INTO products (name, description, image, gender, quality, availability)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sanitize(name), sanitize(description), finalImage, sanitize(gender), sanitize(quality), sanitize(availability)]
    );
    res.status(201).json(rows[0]);
  } catch (err) { respondServerError(res, err, "Failed to add product"); }
});

app.put("/api/products/:id", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM products WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    
    const { name, description, image: imageUrl, gender, quality, availability } = req.body;
    let finalImage = imageUrl || existing.rows[0].image;

    if (req.file) {
      finalImage = req.file.path || req.file.secure_url || `/uploads/products/${req.file.filename}`;
      // Logic to delete old local file could go here
    }

    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, image=$3, gender=$4, quality=$5, availability=$6
       WHERE id=$7 RETURNING *`,
      [sanitize(name), sanitize(description), finalImage, sanitize(gender), sanitize(quality), sanitize(availability), id]
    );
    res.json(result.rows[0]);
  } catch (err) { respondServerError(res, err, "Failed to update product"); }
});

app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM products WHERE id=$1 RETURNING image", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Deleted" });
  } catch (err) { respondServerError(res, err, "Delete failed"); }
});
// subscription route
// 1. Get User Profile (to check current sub status)
app.get("/api/user/profile", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; 

        // We JOIN the users table with the subscriptions table
        const result = await pool.query(
            `SELECT 
                u.email, 
                u.created_at, 
                s.current_plan, 
                s.requested_plan, 
                s.status
             FROM users u
             LEFT JOIN subscriptions s ON u.id = s.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("DATABASE ERROR ON PROFILE JOIN:", err.message);
        res.status(500).json({ error: "Failed to fetch profile", details: err.message });
    }
});

// 2. Handle Subscription Request
app.post("/api/subscription/request", authenticateToken, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.id;

        await pool.query(
            `INSERT INTO subscriptions (user_id, requested_plan, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (user_id) 
             DO UPDATE SET requested_plan = $2, status = 'pending', updated_at = NOW()`,
            [userId, plan]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Request failed" });
    }
});
app.post("/api/subscription/request", authenticateToken, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.id;

        // If the plan is "Cancellation", the admin will see it in the 'requested_plan' column
        await pool.query(
            `INSERT INTO subscriptions (user_id, requested_plan, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (user_id) 
             DO UPDATE SET requested_plan = $2, status = 'pending', updated_at = NOW()`,
            [userId, plan]
        );

        res.json({ success: true, message: "Request updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to process subscription request" });
    }
});
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, role, subscription, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
// GET all pending or active subscription requests for Admin
app.get("/api/admin/subscriptions", authenticateToken, async (req, res) => {
    // Basic security check
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied" });

    try {
        const result = await pool.query(`
            SELECT 
                u.id as user_id, 
                u.email, 
                s.current_plan, 
                s.requested_plan, 
                s.status
            FROM users u
            JOIN subscriptions s ON u.id = s.user_id
            WHERE s.status = 'pending'
            ORDER BY s.updated_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST to Approve or Reject
app.post("/api/admin/subscriptions/:userId", authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied" });
    
    const { userId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    try {
        if (action === 'approve') {
            // Move requested_plan to current_plan and set status to active
            await pool.query(`
                UPDATE subscriptions 
                SET current_plan = requested_plan, 
                    requested_plan = NULL, 
                    status = 'active', 
                    updated_at = NOW() 
                WHERE user_id = $1`, [userId]);
        } else {
            // Reset request but keep current plan as is
            await pool.query(`
                UPDATE subscriptions 
                SET requested_plan = NULL, 
                    status = CASE WHEN current_plan IS NOT NULL THEN 'active' ELSE 'none' END, 
                    updated_at = NOW() 
                WHERE user_id = $1`, [userId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Action failed" });
    }
});
// profile route
app.get("/api/user/profile", authenticateToken, async (req, res) => {
    try {
        // req.user.id comes from your authenticateToken middleware
        const result = await pool.query(
            "SELECT email, subscription, created_at FROM users WHERE id = $1",
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Profile Fetch Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ---------------- ADMIN & MESSAGE ROUTES ---------------- */
app.get("/api/users", authenticateToken, verifyAdmin, async (req, res) => {
  const result = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
  res.json(result.rows);
});

app.get("/api/stats", authenticateToken, verifyAdmin, async (req, res) => {
  const total = await pool.query("SELECT COUNT(*) FROM users");
  res.json({ users: parseInt(total.rows[0].count) });
});

app.post("/api/messages", authenticateToken, async (req, res) => {
  const { rows } = await pool.query("INSERT INTO messages (user_id, sender, message) VALUES ($1, 'user', $2) RETURNING *", [req.user.id, req.body.message]);
  res.json(rows[0]);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));