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
// Optional Cloudinary
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

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

// ---------- Uploads folders (local fallback) ----------
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PRODUCTS_UPLOAD_DIR = path.join(UPLOADS_DIR, "products");
if (!fs.existsSync(PRODUCTS_UPLOAD_DIR)) {
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });
}
// serve uploads statically
app.use("/uploads", express.static(UPLOADS_DIR));

// ---------- Database pool ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ---------- Configure Multer storage (Cloudinary if configured) ----------
let upload; // multer instance

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  // Cloudinary configured -> use CloudinaryStorage
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
      // you can add transformation here if desired
    },
  });

  upload = multer({ storage: cloudStorage, limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB
  console.log("Uploads: using Cloudinary storage.");
} else {
  // Local disk storage fallback
  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRODUCTS_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      cb(null, name);
    }
  });
  upload = multer({ storage: diskStorage, limits: { fileSize: 8 * 1024 * 1024 } });
  console.log("Uploads: using local disk storage at", PRODUCTS_UPLOAD_DIR);
}

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

// ---------- Rate limiter ----------
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

// contact route (unchanged)
app.post("/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, message, recaptcha } = req.body;
    if (!name || !email || !message) return res.status(400).json({ success: false, message: "Missing fields" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: "Invalid email" });

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

// admin review sub request
// USER: get own subscription
app.get("/api/subscription", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM subscriptions WHERE user_id=$1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({
        current_plan: null,
        requested_plan: null,
        status: "none",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to fetch subscription");
  }
});

// admin approve sub request
// ADMIN: approve / reject subscription
app.post(
  "/api/admin/subscriptions/:userId",
  authenticateToken,
  verifyAdmin,
  async (req, res) => {
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    try {
      if (action === "approve") {
        await pool.query(
          `
          UPDATE subscriptions
          SET current_plan = requested_plan,
              requested_plan = NULL,
              status = 'active',
              updated_at = NOW()
          WHERE user_id = $1
        `,
          [req.params.userId]
        );
      }

      if (action === "reject") {
        await pool.query(
          `
          UPDATE subscriptions
          SET requested_plan = NULL,
              status = 'active',
              updated_at = NOW()
          WHERE user_id = $1
        `,
          [req.params.userId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      respondServerError(res, err, "Failed to process subscription");
    }
  }
);


// sub scription update route (scaffold)
// POST /api/subscription/request
// USER: request subscription change (NO auto-approval)
app.post("/api/subscription/request", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: "Plan is required" });
    }

    // Fetch existing subscription
    const { rows } = await pool.query(
      "SELECT * FROM subscriptions WHERE user_id = $1",
      [userId]
    );

    const sub = rows[0];

    // Prevent duplicate pending requests
    if (sub && sub.status === "pending") {
      return res.status(400).json({ error: "You already have a pending request" });
    }

    // Create row if missing
    if (!sub) {
      await pool.query(
        `
        INSERT INTO subscriptions (user_id, requested_plan, status)
        VALUES ($1, $2, 'pending')
        `,
        [userId, plan]
      );
    } else {
      await pool.query(
        `
        UPDATE subscriptions
        SET requested_plan = $1,
            status = 'pending',
            updated_at = NOW()
        WHERE user_id = $2
        `,
        [plan, userId]
      );
    }

    res.json({ message: "Subscription request sent for admin approval" });
  } catch (err) {
    respondServerError(res, err, "Failed to request subscription change");
  }
});




// ADMIN: get all pending subscription requests
app.get(
  "/api/admin/subscriptions",
  authenticateToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          s.user_id,
          u.email,
          s.current_plan,
          s.requested_plan,
          s.status
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'pending'
        ORDER BY s.updated_at DESC
      `);

      res.json(rows);
    } catch (err) {
      respondServerError(res, err, "Failed to fetch admin subscriptions");
    }
  }
);

// ---------- Routes: Auth (unchanged) ----------
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

// ---------- Protected user routes ----------
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
  try {
    const { rows } = await pool.query("SELECT id, email, role, created_at FROM users WHERE id=$1", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    respondServerError(res, err, "Failed to fetch user");
  }
});

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

// ---------- Admin routes (users/stats) ----------
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

// ADMIN: get all pending subscription requests
app.get(
  "/api/admin/subscriptions",
  authenticateToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          s.user_id,
          u.email,
          s.current_plan,
          s.requested_plan,
          s.status
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'pending'
        ORDER BY s.updated_at DESC
      `);

      res.json(rows);
    } catch (err) {
      respondServerError(res, err, "Failed to fetch admin subscriptions");
    }
  }
);


// ---------- Products routes (supports file upload or url) ----------
// GET
app.get("/api/products", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, description, image, gender, quality, availability, created_at FROM products ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    respondServerError(res, err, "Failed to fetch products");
  }
});

// POST (multipart/form-data with imageFile OR JSON with image URL)
app.post("/api/products", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
  try {
    const { name, description = "", image: imageUrl, gender = null, quality = null, availability = null } = req.body;
    if (!name) return res.status(400).json({ error: "Product name is required." });

    // Determine final image URL/path:
    let finalImage = null;
    if (req.file) {
      // If using Cloudinary storage, multer's file.path will be a remote url
      // If using disk storage, multer's file.filename is local filename under uploads/products
      finalImage = (req.file.path) ? req.file.path :
                   (req.file.secure_url) ? req.file.secure_url :
                   `/uploads/products/${req.file.filename}`;
    } else if (imageUrl) {
      finalImage = imageUrl;
    }

    const sName = sanitize(name);
    const sDescription = sanitize(description);
    const sGender = gender ? sanitize(gender) : null;
    const sQuality = quality ? sanitize(quality) : null;
    const sAvailability = availability ? sanitize(availability) : null;

    const { rows } = await pool.query(
      `INSERT INTO products (name, description, image, gender, quality, availability)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sName, sDescription, finalImage, sGender, sQuality, sAvailability]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to add product");
  }
});

// PUT (supports file upload too)
app.put("/api/products/:id", authenticateToken, verifyAdmin, upload.single("imageFile"), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM products WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    const existingProduct = existing.rows[0];

    // fields (when multipart/form-data they come in req.body)
    const { 
      name = existingProduct.name,
      description = existingProduct.description,
      image: imageUrl = existingProduct.image,
      gender = existingProduct.gender,
      quality = existingProduct.quality,
      availability = existingProduct.availability
    } = req.body;

    // Determine final image
    let finalImage = imageUrl;
    if (req.file) {
      finalImage = (req.file.path) ? req.file.path :
                   (req.file.secure_url) ? req.file.secure_url :
                   `/uploads/products/${req.file.filename}`;

      // Remove old local file if it exists and was stored locally
      if (existingProduct.image && existingProduct.image.startsWith("/uploads/products/")) {
        try {
          const oldPath = path.join(process.cwd(), existingProduct.image);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (err) {
          console.warn("Could not remove old image:", err);
        }
      }
    }

    const sName = sanitize(name);
    const sDescription = sanitize(description);
    const sGender = gender ? sanitize(gender) : null;
    const sQuality = quality ? sanitize(quality) : null;
    const sAvailability = availability ? sanitize(availability) : null;

    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, image=$3, gender=$4, quality=$5, availability=$6
       WHERE id=$7 RETURNING *`,
      [sName, sDescription, finalImage, sGender, sQuality, sAvailability, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    respondServerError(res, err, "Failed to update product");
  }
});

// DELETE
app.delete("/api/products/:id", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM products WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    const product = existing.rows[0];

    const result = await pool.query("DELETE FROM products WHERE id=$1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });

    // Remove local file if it exists and is in our uploads folder
    if (product.image && product.image.startsWith("/uploads/products/")) {
      try {
        const delPath = path.join(process.cwd(), product.image);
        if (fs.existsSync(delPath)) fs.unlinkSync(delPath);
      } catch (err) {
        console.warn("Failed to delete product image:", err);
      }
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    respondServerError(res, err, "Failed to delete product");
  }
});

// ---------- Subscriptions & Messages (scaffold) ----------

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

      current_plan TEXT,
      requested_plan TEXT,

      status TEXT
        CHECK (status IN ('active', 'pending', 'none'))
        DEFAULT 'none',

      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);


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

// ---------- Global error handler ----------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Unexpected server error" });
});