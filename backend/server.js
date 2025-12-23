import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import http from "http";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-html";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { Server } from "socket.io";

dotenv.config();
const { Pool } = pkg;

const app = express();
const server = http.createServer(app);

/* ===========================
   DATABASE
=========================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===========================
   MIDDLEWARE
=========================== */
app.use(express.json());

app.use(cors({
  origin: [
    "http://localhost:5500",
    "https://authenticedgewebsite.onrender.com"
  ],
  credentials: true
}));

/* ===========================
   RATE LIMITING
=========================== */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
});

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5
});

/* ===========================
   AUTH HELPERS
=========================== */
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

/* ===========================
   CLOUDINARY UPLOADS
=========================== */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "authentic_edge_products",
    allowed_formats: ["jpg", "png", "webp"]
  }
});
const upload = multer({ storage });

/* ===========================
   AUTH ROUTES
=========================== */
app.post("/api/register", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password, role) VALUES ($1,$2,'user') RETURNING id",
      [email, hashed]
    );
    res.status(201).json({ success: true, userId: result.rows[0].id });
  } catch {
    res.status(400).json({ error: "User already exists" });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.json({ token, role: user.role, userId: user.id });
});

/* ===========================
   USER ROUTES
=========================== */
app.get("/api/user", authenticateToken, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, created_at FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(rows[0]);
});

app.put("/api/user/email", authenticateToken, async (req, res) => {
  const email = sanitize(req.body.email);
  await pool.query("UPDATE users SET email=$1 WHERE id=$2", [email, req.user.id]);
  res.json({ success: true });
});

app.put("/api/user/password", authenticateToken, async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashed, req.user.id]);
  res.json({ success: true });
});

app.delete("/api/user", authenticateToken, async (req, res) => {
  await pool.query("DELETE FROM users WHERE id=$1", [req.user.id]);
  res.json({ success: true });
});

/* ===========================
   PRODUCTS
=========================== */
app.get("/api/products", async (_, res) => {
  const { rows } = await pool.query("SELECT * FROM products ORDER BY id DESC");
  res.json(rows);
});

app.post(
  "/api/products",
  authenticateToken,
  verifyAdmin,
  upload.single("imageFile"),
  async (req, res) => {
    const data = {
      name: sanitize(req.body.name),
      description: sanitize(req.body.description || ""),
      gender: sanitize(req.body.gender || ""),
      quality: sanitize(req.body.quality || ""),
      availability: sanitize(req.body.availability || ""),
      image: req.file?.path || req.body.image
    };

    await pool.query(
      `INSERT INTO products (name,description,gender,quality,availability,image)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      Object.values(data)
    );

    res.json({ success: true });
  }
);

// ===============================
// ADMIN MESSAGES
// ===============================

// ADMIN: list conversations (latest message per user)
app.get("/api/admin/conversations", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id AS user_id,
        u.email,
        m.message,
        m.created_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT message, created_at
        FROM messages
        WHERE user_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      ORDER BY m.created_at DESC NULLS LAST
    `);

    res.json(rows);
  } catch (err) {
    console.error("Admin conversations error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// ADMIN: fetch message history with a user
app.get("/api/admin/messages/:userId", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at ASC",
      [req.params.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin messages fetch error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});


/* ===========================
   SUBSCRIPTIONS
=========================== */
app.get("/api/subscription", authenticateToken, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id=$1",
    [req.user.id]
  );
  res.json(rows[0] || {});
});

app.post("/api/subscription/request", authenticateToken, async (req, res) => {
  const plan = sanitize(req.body.plan);

  await pool.query(
    `
    INSERT INTO subscriptions (user_id, requested_plan, status)
    VALUES ($1,$2,'pending')
    ON CONFLICT (user_id)
    DO UPDATE SET requested_plan=$2, status='pending'
    `,
    [req.user.id, plan]
  );

  res.json({ success: true });
});

app.get("/api/admin/subscriptions", authenticateToken, verifyAdmin, async (_, res) => {
  const { rows } = await pool.query(`
    SELECT s.*, u.email
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status='pending'
  `);
  res.json(rows);
});

app.post("/api/admin/subscriptions/:userId", authenticateToken, verifyAdmin, async (req, res) => {
  const status = req.body.action === "approve" ? "active" : "rejected";
  await pool.query(
    "UPDATE subscriptions SET status=$1 WHERE user_id=$2",
    [status, req.params.userId]
  );
  res.json({ success: true });
});

/* ===========================
   CONTACT
=========================== */
app.post("/api/contact", contactLimiter, async (req, res) => {
  await pool.query(
    "INSERT INTO contact_messages (name,email,phone,message) VALUES ($1,$2,$3,$4)",
    [
      sanitize(req.body.name),
      sanitize(req.body.email),
      sanitize(req.body.phone || ""),
      sanitize(req.body.message)
    ]
  );
  res.json({ success: true });
});

/* ===========================
   SOCKET.IO (SECURE + PERSISTENT)
=========================== */
const io = new Server(server, { cors: { origin: "*" } });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = user;
    next();
  });
});
io.on("connection", (socket) => {

  // Admin joins global notification room
  socket.on("join", (room) => {
    socket.join(room);
  });

  // USER → ADMIN
  socket.on("user_msg", async ({ userId, text }) => {
    try {
      await pool.query(
        "INSERT INTO messages (user_id, sender, message) VALUES ($1,'user',$2)",
        [userId, text]
      );

      io.to("admin_global").emit("admin_notification", {
        user_id: userId,
        sender: "user",
        message: text,
        created_at: new Date()
      });
    } catch (err) {
      console.error("User message save failed:", err);
    }
  });

  // ADMIN → USER
  socket.on("admin_reply", async ({ userId, text }) => {
    try {
      await pool.query(
        "INSERT INTO messages (user_id, sender, message) VALUES ($1,'admin',$2)",
        [userId, text]
      );

      io.to(userId.toString()).emit("new_msg", {
        sender: "admin",
        message: text,
        created_at: new Date()
      });
    } catch (err) {
      console.error("Admin reply save failed:", err);
    }
  });

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender TEXT CHECK(sender IN ('user', 'admin')) NOT NULL,
    message TEXT,
    file_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    
/* ===========================
   START SERVER
=========================== */
server.listen(5000, () => {
  console.log("✅ Authentic Edge server running on port 5000");
});
