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
// Using __dirname ensures it looks relative to where server.js is located
const { Pool } = pkg;
const app = express();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 contact requests per window
  message: { success: false, error: "Too many requests. Please try again later." }
});

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

app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
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
    // 1. Add is_most_wanted to the destructuring
    const { name, description = "", image: imageUrl, gender, quality, availability, is_most_wanted } = req.body;
    if (!name) return res.status(400).json({ error: "Product name is required." });

    let finalImage = imageUrl || null;
    if (req.file) {
      finalImage = req.file.path || req.file.secure_url || `/uploads/products/${req.file.filename}`;
    }

    // 2. Updated SQL to include is_most_wanted ($7)
    const { rows } = await pool.query(
      `INSERT INTO products (name, description, image, gender, quality, availability, is_most_wanted)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        sanitize(name), 
        sanitize(description), 
        finalImage, 
        sanitize(gender), 
        sanitize(quality), 
        sanitize(availability),
        is_most_wanted === 'true' || is_most_wanted === true // Convert string "true" from FormData to Boolean
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) { respondServerError(res, err, "Failed to add product"); }
});
app.put("/api/products/:id", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM products WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    
    // 1. Add is_most_wanted to the destructuring
    const { name, description, image: imageUrl, gender, quality, availability, sort_index, is_most_wanted } = req.body;
    let finalImage = imageUrl || existing.rows[0].image;

    if (req.file) {
      finalImage = req.file.path || req.file.secure_url || `/uploads/products/${req.file.filename}`;
    }

// $1:name, $2:description, $3:image, $4:gender, $5:quality, $6:availability, $7:sort_index, $8:is_most_wanted
// WHERE id=$9

const result = await pool.query(
  `UPDATE products 
   SET name=$1, description=$2, image=$3, gender=$4, quality=$5, availability=$6, sort_index=$7, is_most_wanted=$8
   WHERE id=$9 RETURNING *`, 
  [
    sanitize(name),          // $1
    sanitize(description),   // $2
    finalImage,              // $3
    sanitize(gender),        // $4
    sanitize(quality),       // $5
    sanitize(availability),  // $6
    parseInt(sort_index) || 0, // $7
    is_most_wanted === 'true' || is_most_wanted === true, // $8 (Must be Boolean)
    id                       // $9
  ]
);
    
    res.json(result.rows[0]);
  } catch (err) { 
    respondServerError(res, err, "Failed to update product"); 
  }
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
app.patch("/api/products/:id/toggle-wanted", authenticateToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_most_wanted } = req.body;
  try {
    const result = await pool.query(
      "UPDATE products SET is_most_wanted = $1 WHERE id = $2 RETURNING *",
      [
        // CRASH PROTECTION: Ensure it's a boolean
        is_most_wanted === 'true' || is_most_wanted === true, 
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to toggle status");
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
    try {
        const userId = req.user.id; // From the JWT token
        const { message, productId } = req.body;

        // Insert into the same messages table we used before
        const result = await pool.query(
            "INSERT INTO messages (user_id, sender, message, status) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, 'user', message, 'unread'] // Admin sees 'unread'
        );

        res.json({ success: true, message: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to process inquiry" });
    }
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
    const { id } = req.params;
    const client = await pool.connect(); // Use a client for a transaction

    try {
        await client.query('BEGIN');

        // 1. Delete subscriptions first (Manual Cascade)
        await client.query("DELETE FROM subscriptions WHERE user_id = $1", [id]);

        // 2. Delete messages (if any)
        await client.query("DELETE FROM messages WHERE user_id = $1", [id]);

        // 3. Delete the actual user
        const result = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found" });
        }

        await client.query('COMMIT');
        res.json({ message: "User and all related data permanently removed" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Delete Error:", err);
        res.status(500).json({ error: "Database conflict: Could not delete user." });
    } finally {
        client.release();
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
/* ---------------- GET SINGLE PRODUCT BY ID ---------------- */
app.get("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        // Ensure ID is a number to prevent basic SQL injection or errors
        const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found in archives." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        respondServerError(res, err, "Failed to fetch single product");
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
        // We select the user info and a count of messages where is_read is false
        // and the sender is NOT the admin (meaning it's from the user).
        const result = await pool.query(`
            SELECT 
                u.id as user_id, 
                u.email,
                (
                    SELECT COUNT(*)::int 
                    FROM messages m2 
                    WHERE m2.user_id = u.id 
                    AND m2.is_read = false 
                    AND m2.sender != 'admin'
                ) as unread_count
            FROM users u
            JOIN messages m ON u.id = m.user_id 
            GROUP BY u.id, u.email
            ORDER BY unread_count DESC, u.email ASC
        `);
        
        res.json(result.rows);
    } catch (err) {
        console.error("DATABASE ERROR:", err.message);
        res.status(500).json({ 
            error: "Database query failed", 
            details: err.message 
        });
    }
});
// POST to Approve or Reject
app.post("/api/admin/subscriptions/:userId", authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied" });
    
    const { userId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    try {
        let messageText = "";

        if (action === 'approve') {
            // 1. Get the plan name before nullifying it to use in the message
            const planRes = await pool.query('SELECT requested_plan FROM subscriptions WHERE user_id = $1', [userId]);
            const planName = planRes.rows[0]?.requested_plan || "Premium";

            // 2. Update Subscription
            await pool.query(`
                UPDATE subscriptions 
                SET current_plan = requested_plan, 
                    requested_plan = NULL, 
                    status = 'active', 
                    updated_at = NOW() 
                WHERE user_id = $1`, [userId]);
            
            messageText = `Your subscription for ${planName} has been approved! You now have full access.`;
        } else {
            // Update Subscription for Rejection
            await pool.query(`
                UPDATE subscriptions 
                SET requested_plan = NULL, 
                    status = CASE WHEN current_plan IS NOT NULL THEN 'active' ELSE 'none' END, 
                    updated_at = NOW() 
                WHERE user_id = $1`, [userId]);

            messageText = "Your subscription request was not approved. Please contact support if you have questions.";
        }

        // 3. AUTO-MESSAGE: This triggers the "unread notification" for the user
        // We set is_read = false (for the user) and sender = 'admin'
        await pool.query(`
            INSERT INTO messages (user_id, sender, message, is_read, created_at)
            VALUES ($1, 'admin', $2, false, NOW())
        `, [userId, messageText]);

        res.json({ success: true, message: "Subscription updated and user notified." });
    } catch (err) {
        console.error("SUBSCRIPTION ERROR:", err.message);
        res.status(500).json({ error: "Action failed" });
    }
});
// POST: /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // 1. Basic Validation
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        
        // 2. Check if user already exists (Correct PostgreSQL syntax)
        const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
        
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: "Email already registered." });
        }

        // 3. Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Save to Database
        const newUser = await pool.query(`
            INSERT INTO users (email, password, role)
            VALUES ($1, $2, $3)
            RETURNING id, email, role, created_at
        `, [email.toLowerCase(), hashedPassword, role || 'user']);
        
        console.log(`New user registered: ${email}`);

        // 2. Prepare the confirmation email
        const mailOptions = {
            from: '"Authentic Edge" <authenticedge@gmail.com>',
            to: email,
            subject: 'Welcome to the Archives | Authentic Edge',
            html: `
                <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #eee;">
                    <h1 style="text-transform: uppercase; letter-spacing: 3px; font-size: 20px; text-align: center;">Welcome to the Edge</h1>
                    <p style="color: #666; line-height: 1.6; text-align: center;">Your membership has been successfully activated. You now have exclusive access to our Products.</p>
                    <div style="text-align: center; margin-top: 30px;">

                           style="background: #000;                         <a href="https://authenticedgewebsite-1.onrender.com/login.html" color: #fff; padding: 15px 30px; text-decoration: none; text-transform: uppercase; font-size: 11px; font-weight: 700; border-radius: 100px;">
                           Access Your Account
                        </a>
                    </div>
                </div>
            `
        };

        // 3. Send the email
        await transporter.sendMail(mailOptions);

        // 5. Success Response
        res.status(201).json({ 
            success: true,
            message: "Registration successful. Confirmation email sent.",
            user: newUser.rows[0]
        });

    } catch (err) {
        console.error("Server Registration Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
    
});

/* ---------------- ADMIN & MESSAGE ROUTES ---------------- */
// GET All Users for Admin (With Subscription Data)
app.get("/api/users", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, 
                u.email, 
                u.role, 
                u.created_at,
                s.current_plan, 
                s.requested_plan, 
                s.status
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            ORDER BY u.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        respondServerError(res, err, "Failed to fetch users");
    }
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
// Add this to your backend server file
app.post("/api/admin/read/:userId", authenticateToken, async (req, res) => {
    const { userId } = req.params;

    // Optional: Check if admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        await pool.query(`
            UPDATE messages 
            SET is_read = true 
            WHERE user_id = $1 AND sender != 'admin'
        `, [userId]);

        res.json({ success: true, message: "Messages marked as read" });
    } catch (err) {
        console.error("MARK READ ERROR:", err.message);
        res.status(500).json({ error: "Failed to update read status" });
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

app.post("/api/contact", contactLimiter, async (req, res) => {
    // 1. Sanitize and Extract all fields
    const name = validator.escape(req.body.name || "");
    const email = validator.normalizeEmail(req.body.email || "");
    const message = validator.escape(req.body.message || "");
    const phone = validator.escape(req.body.phone || "");
    const recaptchaToken = req.body.recaptchaToken; // Ensure frontend sends this

    if (!validator.isEmail(email)) {
        return res.status(400).json({ error: "Invalid email address" });
    }

    try {
        // 2. VERIFY RECAPTCHA FIRST
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`;
        const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
        const recaptchaData = await recaptchaRes.json();

        // Now you can safely check recaptchaData
        if (!recaptchaData.success || recaptchaData.score < 0.5) {
            return res.status(403).json({ success: false, error: "Bot activity detected." });
        }

        // 3. Resolve path to your template
        const templatePath = path.join(__dirname, 'emailTemplates', 'contact.html');dotenv.config();

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found at ${templatePath}`);
        }
        

        let htmlContent = fs.readFileSync(templatePath, 'utf8');
        // 4. Inject data into the template
        htmlContent = htmlContent
            .replace('{{name}}', name)
            .replace('{{email}}', email)
            .replace('{{phone}}', phone)
            .replace('{{message}}', message);

        // 5. Configure and send the email
        const mailOptions = {
            from: `"Authentic Edge Contact" <${process.env.CONTACT_EMAIL}>`,
            to: "authenticedgeinfo@gmail.com", 
            replyTo: email, 
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

app.post('/api/messages/bulk-inquiry', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; 
        const { items, customNote } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Cart is empty" });
        }

        // 1. Format the cart items for DB and Email
        const itemList = items.map(item => `• ${item.title} (${item.price || 'Price on Request'})`).join('\n');
        const finalMessage = `NEW CONCIERGE SELECTION:\n${itemList}\n\nClient Note: ${customNote || 'No additional notes.'}`;

        // 2. Insert into Database for Chat History
        const result = await pool.query(
            "INSERT INTO messages (user_id, sender, message, status) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, 'user', finalMessage, 'unread']
        );

        // 3. ALERT THE ADMIN (Optional but Highly Recommended)
        const mailOptions = {
            from: `"Concierge Alert" <${process.env.CONTACT_EMAIL}>`,
            to: "authenticedgeinfo@gmail.com", // Your personal email
            subject: `New Mail from User #${userId}`,
            text: `A user has submitted a new selection:\n\n${finalMessage}`
        };
        
        // Use a non-blocking await or handle error silently so message still sends to DB
        transporter.sendMail(mailOptions).catch(e => console.error("Admin Email Alert Failed", e));

        res.json({ 
            success: true, 
            message: "Your selection has been sent! We will get back to you shortly.",
            data: result.rows[0] 
        });

    } catch (err) {
        console.error("Bulk Message Error:", err);
        res.status(500).json({ error: "Failed to send inquiry" });
    }
});
// POST route to blast the Valentine email to all members
app.post("/api/admin/valentijn-blast", async (req, res) => {
    const { adminKey } = req.body;

    // 1. Basic Security check
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        // 2. Fetch all members from your DB
        // Replace 'User' with your actual database model/query
        const users = await db.collection('users').find({}).toArray(); 
        const emails = users.map(u => u.email);

        // 3. Load the template
        const templatePath = path.join(__dirname, 'emailTemplates', 'valentijn.html');
        const htmlContent = fs.readFileSync(templatePath, 'utf8');

        // 4. Send the emails
        // Note: For many users, use a loop with a small delay to avoid spam filters
        for (const email of emails) {
            await transporter.sendMail({
                from: `"Authentic Edge" <${process.env.CONTACT_EMAIL}>`,
                to: email,
                subject: "🌹 A Valentijn Special from Us!",
                html: htmlContent
            });
            // Optional: wait 500ms between emails to stay under provider limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        res.json({ success: true, message: `Sent to ${emails.length} members.` });

    } catch (error) {
        console.error("Blast Error:", error);
        res.status(500).json({ error: "Failed to send mass email" });
    }
    // curl -X POST http://localhost:5000/api/admin/valentijn-blast \
    //  -H "Content-Type: application/json" \
    //  -d '{"adminKey": "your_actual_secret_key_here"}'
});
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));