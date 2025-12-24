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
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import validator from 'validator';

// Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Use the same 'upload' middleware you used for products
app.post('/api/admin/reply', authenticateToken, upload.single('imageFile'), async (req, res) => {
    try {
        const { userId, message } = req.body;
        
        // Use the same file handling logic as your products
        // If your product logic saves to 'req.file.path' or 'req.file.location', do the same here
        const file_url = req.file ? req.file.path || req.file.location : null;

        const result = await pool.query(
            "INSERT INTO messages (user_id, sender, message, file_url) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, 'admin', message, file_url]
        );

        // Return the whole row so renderBubble can use it
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Call the function
app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM products WHERE id=$1 RETURNING image", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Deleted" });
  } catch (err) { respondServerError(res, err, "Delete failed"); }
});
/* ---------------- USER MANAGEMENT ROUTES ---------------- */
// Add this to your backend server.js
app.post('/api/messages/send', authenticateToken, async (req, res) => {
    const { message, productId } = req.body;
    // Logic to save message to your database goes here
    res.status(200).json({ success: true });
});
app.post('/api/messages', authenticateToken, upload.single('imageFile'), async (req, res) => {
    try {
        const userId = req.user.id; // Get ID from the token
        const { message } = req.body;
        
        // Handle the file exactly like the admin side
        const file_url = req.file ? req.file.path || req.file.location : null;

        // INSERT into the same table
        const result = await pool.query(
            "INSERT INTO messages (user_id, sender, message, file_url) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, 'user', message || "", file_url]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error("USER MESSAGE ERROR:", err.message);
        res.status(500).json({ error: "Failed to send message" });
    }
});
// UPDATE User Role
app.put("/api/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const result = await pool.query(
            "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role",
            [role, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "Role updated successfully", user: result.rows[0] });
    } catch (err) {
        respondServerError(res, err, "Failed to update user role");
    }
});

// DELETE User
app.delete("/api/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // The database schema uses ON DELETE CASCADE, 
        // so deleting the user will automatically remove their subscriptions and messages.
        const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User permanently removed" });
    } catch (err) {
        respondServerError(res, err, "Failed to delete user");
    }
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
// Your route MUST match the path the frontend is calling
// Example Node.js Backend Fix
app.get('/api/admin/conversations', authenticateToken, async (req, res) => {
    try {
        // 1. Perform the query
        const result = await pool.query(`
            SELECT DISTINCT u.id as user_id, u.email 
            FROM users u
            JOIN messages m ON u.id = m.user_id 
            ORDER BY u.email ASC
        `);
        
        // 2. Access the .rows property (Postgres returns an object, not an array)
        const conversations = result.rows;
        
        // 3. Send the array back to the frontend
        res.json(conversations);
    } catch (err) {
        console.error("DATABASE ERROR:", err.message);
        res.status(500).json({ error: "Database query failed", details: err.message });
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

/* ---------------- ADMIN & MESSAGE ROUTES ---------------- */
app.get("/api/users", authenticateToken, verifyAdmin, async (req, res) => {
  const result = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
  res.json(result.rows);
});

app.get("/api/stats", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'admin') as admins,
        COUNT(*) FILTER (WHERE role = 'user') as regular
      FROM users
    `);
    res.json({ 
      users: parseInt(stats.rows[0].total),
      admins: parseInt(stats.rows[0].admins),
      regularUsers: parseInt(stats.rows[0].regular)
    });
  } catch (err) {
    respondServerError(res, err, "Failed to fetch stats");
  }
});
// GET USER MESSAGES
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Extracted from JWT
        
        const result = await pool.query(
            "SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at ASC",
            [userId]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not retrieve messages" });
    }
});
app.get('/api/admin/messages/:userId', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            `SELECT sender, message, file_url, created_at
             FROM messages
             WHERE user_id = $1
             ORDER BY created_at ASC`,
            [userId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.delete('/api/admin/conversations/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        // This will delete all messages associated with that user
        await pool.query("DELETE FROM messages WHERE user_id = $1", [userId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.CONTACT_EMAIL,        // From your .env screenshot
    pass: process.env.CONTACT_EMAIL_PASSWORD // From your .env screenshot
  }
});

app.post("/api/contact", async (req, res) => {
const name = validator.escape(req.body.name);
  const email = validator.normalizeEmail(req.body.email);
  const message = validator.escape(req.body.message);

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  try {
    // 2. Resolve path to your template
    const templatePath = path.join(__dirname, 'emailTemplates', 'contact.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // 3. Inject data into the template placeholders
    htmlContent = htmlContent
      .replace('{{name}}', name)
      .replace('{{email}}', email)
      .replace('{{phone}}', phone)
      .replace('{{message}}', message);

    // 4. Configure and send the email
    const mailOptions = {
      from: `"${name}" <${process.env.CONTACT_EMAIL}>`,
      to: "anthilori25@gmail.com", // Change email
      replyTo: email,                //
      subject: `New Inquiry from ${name}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Email Sending Error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${req.body.recaptchaToken}`;
const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
const recaptchaData = await recaptchaRes.json();

if (!recaptchaData.success || recaptchaData.score < 0.5) {
  return res.status(403).json({ success: false, error: "Bot activity detected." });
}
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 contact requests per window
  message: { success: false, error: "Too many requests. Please try again later." }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));