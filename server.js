import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  pub,
  getAllEntries,
  getEntriesByHostel,
  getEntriesByRoom,
  getEntryById,
  findDuplicate,
  createEntry,
  updateEntry,
  deleteEntry,
  deleteAllEntries,
} from "./db.js";

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "https://room-finder-abuad.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── GET /api/entries ─────────────────────────────────────────────────────────
app.get("/api/entries", async (req, res) => {
  try {
    const { hostel, room } = req.query;
    let rows;

    if (hostel && room) {
      rows = await getEntriesByRoom(hostel, room);
    } else if (hostel) {
      rows = await getEntriesByHostel(hostel);
    } else {
      rows = await getAllEntries();
    }

    res.json({ success: true, count: rows.length, data: rows.map(pub) });
  } catch (err) {
    console.error("GET /api/entries:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch entries" });
  }
});

// ─── GET /api/entries/:id ─────────────────────────────────────────────────────
app.get("/api/entries/:id", async (req, res) => {
  try {
    const entry = await getEntryById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true, data: pub(entry) });
  } catch (err) {
    console.error("GET /api/entries/:id:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch entry" });
  }
});

// ─── POST /api/entries ────────────────────────────────────────────────────────
app.post("/api/entries", async (req, res) => {
  try {
    const { hostel, room, name, phone, whatsapp, bio, image } = req.body;

    if (!hostel || !room || !name) {
      return res.status(400).json({
        success: false,
        message: "Hostel, room, and name are required.",
      });
    }

    const dupeId = await findDuplicate(hostel, room, name);
    if (dupeId) {
      return res.status(409).json({
        success: false,
        message: "You have already added your details for this room.",
      });
    }

    const { entry, editToken } = await createEntry({ hostel, room, name, phone, whatsapp, bio, image });

    res.status(201).json({
      success: true,
      message: "Entry created",
      data: entry,
      editToken, // returned once — client saves this to edit/delete later
    });
  } catch (err) {
    console.error("POST /api/entries:", err.message);
    res.status(500).json({ success: false, message: "Failed to create entry" });
  }
});

// ─── PUT /api/entries/:id ─────────────────────────────────────────────────────
app.put("/api/entries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { editToken, adminPassword: reqAdminPassword, name, phone, whatsapp, bio, image } = req.body;

    const entry = await getEntryById(id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });

    const isAdmin = reqAdminPassword === ADMIN_PASSWORD;
    const isOwner = editToken && entry.editToken === editToken;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorised to edit this entry" });
    }

    const updated = await updateEntry(id, { name, phone, whatsapp, bio, image });
    res.json({ success: true, message: "Entry updated", data: updated });
  } catch (err) {
    console.error("PUT /api/entries/:id:", err.message);
    res.status(500).json({ success: false, message: "Failed to update entry" });
  }
});

// ─── DELETE /api/entries/:id ──────────────────────────────────────────────────
app.delete("/api/entries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { editToken, adminPassword } = req.body;

    const entry = await getEntryById(id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });

    const isAdmin = adminPassword === ADMIN_PASSWORD;
    const isOwner = editToken && entry.editToken === editToken;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorised" });
    }

    await deleteEntry(id);
    res.json({ success: true, message: "Entry deleted" });
  } catch (err) {
    console.error("DELETE /api/entries/:id:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete entry" });
  }
});

// ─── DELETE /api/entries (admin — clear all) ──────────────────────────────────
app.delete("/api/entries", async (req, res) => {
  try {
    const { adminPassword } = req.body;
    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    await deleteAllEntries();
    res.json({ success: true, message: "All entries cleared" });
  } catch (err) {
    console.error("DELETE /api/entries:", err.message);
    res.status(500).json({ success: false, message: "Failed to clear entries" });
  }
});

// ─── POST /api/admin/login ────────────────────────────────────────────────────
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Authenticated" });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    pid: process.pid,
    started: new Date().toISOString(),
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`🚀  Server ready on http://localhost:${PORT}`);
});
