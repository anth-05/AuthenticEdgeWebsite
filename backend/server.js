import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import http from "http";
import multer from "multer";
import { Server } from "socket.io";

dotenv.config();
const { Pool } = pkg;

const app = express();
const server = http.createServer(app);

const upload = multer({ dest: "uploads/" });

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

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

/* ---------------- SOCKET.IO ---------------- */
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

io.on("connection", socket => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join", roomId => {
    const room =
      roomId === "admin_global" ? "admin_global" : `user_${roomId}`;
    socket.join(room);
    console.log(`➡️ Joined room: ${room}`);
  });

  socket.on("user_msg", async ({ userId, message }) => {
    try {
      const { rows } = await pool.query(
        "INSERT INTO messages (user_id, sender, message, status) VALUES ($1,'user',$2,'unread') RETURNING *",
        [userId, message]
      );

      io.to("admin_global").emit("admin_notification", rows[0]);
    } catch (err) {
      console.error("user_msg error:", err);
    }
  });

  socket.on("admin_reply", async ({ userId, text }) => {
    try {
      const { rows } = await pool.query(
        "INSERT INTO messages (user_id, sender, message, status) VALUES ($1,'admin',$2,'read') RETURNING *",
        [userId, text]
      );

      io.to(`user_${userId}`).emit("new_msg", rows[0]);
    } catch (err) {
      console.error("admin_reply error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

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

/* ---------------- AUTH ROUTES ---------------- */
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

/* ---------------- USER MESSAGES ---------------- */
app.get("/api/messages", authenticateToken, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
    [req.user.id]
  );
  res.json(rows);
});

/* ---------------- ADMIN MESSAGES ---------------- */
app.get(
  "/api/admin/conversations",
  authenticateToken,
  verifyAdmin,
  async (req, res) => {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (m.user_id)
        m.user_id, u.email, m.message, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      ORDER BY m.user_id, m.created_at DESC
    `);
    res.json(rows);
  }
);

app.get(
  "/api/admin/messages/:userId",
  authenticateToken,
  verifyAdmin,
  async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM messages WHERE user_id=$1 ORDER BY created_at ASC",
      [req.params.userId]
    );

    await pool.query(
      "UPDATE messages SET status='read' WHERE user_id=$1 AND sender='user'",
      [req.params.userId]
    );

    res.json(rows);
  }
);



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