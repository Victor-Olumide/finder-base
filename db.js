/**
 * Firestore data access layer — drop-in replacement for the old SQLite db.js.
 * All functions are async and mirror the previous synchronous better-sqlite3 API.
 */
import { db } from "./firebase.js";
import { randomUUID } from "crypto";

const COL = "entries";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip the internal editToken before sending to clients */
export function pub(entry) {
  if (!entry) return entry;
  const { editToken, ...safe } = entry;
  return safe;
}

/** Convert a Firestore DocumentSnapshot → plain object (includes id) */
function docToEntry(doc) {
  return { id: doc.id, ...doc.data() };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Get all entries, newest first */
export async function getAllEntries() {
  const snap = await db
    .collection(COL)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map(docToEntry);
}

/** Get all entries for a specific hostel, newest first */
export async function getEntriesByHostel(hostel) {
  const snap = await db
    .collection(COL)
    .where("hostelLower", "==", hostel.toLowerCase())
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map(docToEntry);
}

/** Get all entries for a specific hostel + room, newest first */
export async function getEntriesByRoom(hostel, room) {
  const snap = await db
    .collection(COL)
    .where("hostelLower", "==", hostel.toLowerCase())
    .where("roomLower", "==", room.toLowerCase())
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map(docToEntry);
}

/** Get a single entry by id */
export async function getEntryById(id) {
  const doc = await db.collection(COL).doc(id).get();
  if (!doc.exists) return null;
  return docToEntry(doc);
}

/** Check for a duplicate (same name in same hostel+room, case-insensitive) */
export async function findDuplicate(hostel, room, name) {
  const snap = await db
    .collection(COL)
    .where("hostelLower", "==", hostel.toLowerCase())
    .where("roomLower", "==", room.toLowerCase())
    .where("nameLower", "==", name.toLowerCase())
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Create a new entry. Returns { entry (public), editToken } */
export async function createEntry({ hostel, room, name, phone, whatsapp, bio, image }) {
  const id = randomUUID();
  const editToken = randomUUID();
  const createdAt = new Date().toISOString();

  const data = {
    hostel,
    room,
    name,
    phone: phone || "",
    whatsapp: whatsapp || "",
    bio: bio || "",
    image: image || "",
    editToken,
    createdAt,
    // lowercase shadow fields for case-insensitive queries
    hostelLower: hostel.toLowerCase(),
    roomLower: room.toLowerCase(),
    nameLower: name.toLowerCase(),
  };

  await db.collection(COL).doc(id).set(data);
  return { entry: pub({ id, ...data }), editToken };
}

/** Update an existing entry. Returns the updated public entry. */
export async function updateEntry(id, { name, phone, whatsapp, bio, image }) {
  const updates = {};
  if (name !== undefined)     { updates.name = name;         updates.nameLower = name.toLowerCase(); }
  if (phone !== undefined)    updates.phone = phone;
  if (whatsapp !== undefined) updates.whatsapp = whatsapp;
  if (bio !== undefined)      updates.bio = bio;
  if (image !== undefined)    updates.image = image;

  await db.collection(COL).doc(id).update(updates);
  const updated = await getEntryById(id);
  return pub(updated);
}

/** Delete a single entry by id */
export async function deleteEntry(id) {
  await db.collection(COL).doc(id).delete();
}

/** Delete ALL entries in the collection */
export async function deleteAllEntries() {
  const snap = await db.collection(COL).get();
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
