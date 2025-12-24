import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";


dotenv.config();
const { Pool } = pkg;
const app = express();
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 800, crop: "limit" }],
  },
});

const upload = multer({ storage });

/* ---------------- CONFIG ---------------- */
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5500,https://authenticedgewebsite-1.onrender.com"
)
  .split(",")
  .map(o => o.trim());

/* ---------------- MIDDLEWARE ---------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

/* ---------------- DATABASE ---------------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

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
  if (req.user.role !== "admin") return res.sendStatus(403);
  next();
}

/* ---------------- AUTH ---------------- */

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: rows[0].id, role: rows[0].role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.json({ token, userId: rows[0].id, role: rows[0].role });
});
// GET ALL USERS
app.get("/api/users", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// GET DASHBOARD STATS
app.get("/api/stats", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const totalUsers = await pool.query("SELECT COUNT(*) FROM users");
        const adminUsers = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        const regularUsers = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'user'");

        res.json({
            users: parseInt(totalUsers.rows[0].count),
            admins: parseInt(adminUsers.rows[0].count),
            regularUsers: parseInt(regularUsers.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// UPDATE USER ROLE
app.put("/api/users/:id", authenticateToken, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
        res.json({ message: "Role updated" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});
/* ---------------- MESSAGES ---------------- */
// In your server.js
app.put(
  "/api/products/:id",
  authenticateToken,
  verifyAdmin,
  upload.single("imageFile"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, gender, quality, availability, image } = req.body;

      const finalImage = req.file ? req.file.path : image;

      const result = await pool.query(
        `UPDATE products 
         SET name=$1, description=$2, image=$3, gender=$4, quality=$5, availability=$6
         WHERE id=$7 RETURNING *`,
        [name, description, finalImage, gender, quality, availability, id]
      );

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  }
);

/* ---------------- USER ROUTES ---------------- */

// User fetches their own history
app.get("/api/messages", authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// User sends a message
app.post("/api/messages", authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        const { rows } = await pool.query(
            `INSERT INTO messages (user_id, sender, message, status)
             VALUES ($1, 'user', $2, 'unread') RETURNING *`,
            [req.user.id, message]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to send message" });
    }
});

/* ---------------- ADMIN ROUTES ---------------- */

// Admin fetch all conversations for sidebar
app.get("/api/admin/conversations", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT DISTINCT ON (m.user_id)
                m.user_id, u.email, m.message, m.created_at
            FROM messages m
            JOIN users u ON u.id = m.user_id
            ORDER BY m.user_id, m.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
});

// Admin fetch full history for a specific user
app.get("/api/admin/messages/:userId", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { rows } = await pool.query(
            "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
            [userId]
        );

        // Mark user messages as read when admin opens the chat
        await pool.query(
            "UPDATE messages SET status='read' WHERE user_id=$1 AND sender='user'",
            [userId]
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});
app.post(
  "/api/products",
  authenticateToken,
  verifyAdmin,
  upload.single("imageFile"),
  async (req, res) => {
    try {
      const { name, description, gender, quality, availability, image } = req.body;

      // Cloudinary file URL OR manual URL
      const finalImage = req.file ? req.file.path : image;

      await pool.query(
        `INSERT INTO products 
         (name, description, image, gender, quality, availability)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [name, description, finalImage, gender, quality, availability]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Failed to create product" });
    }
  }
);

// Admin reply to a user (FIXED 404 ROUTE)
app.post("/api/admin/reply", authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { userId, message } = req.body;
        if (!userId || !message) return res.status(400).json({ error: "Missing data" });

        const { rows } = await pool.query(
            `INSERT INTO messages (user_id, sender, message, status, created_at)
             VALUES ($1, 'admin', $2, 'read', NOW()) RETURNING *`,
            [userId, message]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error("Admin reply error:", err);
        res.status(500).json({ error: "Server failed to save reply" });
    }
});
/* ---------------- PRODUCTS ---------------- */
app.get("/api/products", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM products ORDER BY created_at DESC"
  );
  res.json(rows);
});

app.post(
  "/api/products",
  authenticateToken,
  verifyAdmin,
  upload.single("imageFile"),
  async (req, res) => {
    const { name, description, gender, quality, availability, image } = req.body;
    const finalImage = req.file ? req.file.path : image;

    await pool.query(
      `INSERT INTO products (name, description, image, gender, quality, availability)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [name, description, finalImage, gender, quality, availability]
    );

    res.json({ success: true });
  }
);

/* ---------------- START ---------------- */
app.listen(PORT, () =>
  console.log(`🚀 REST server running on port ${PORT}`)
);
