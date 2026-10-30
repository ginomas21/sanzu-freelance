// Auth SanzuFreelance: email+password (hash scrypt salt:hash), sesi = token
// acak yang disimpan di tabel sessions dan dikirim lewat cookie httpOnly.
// Ada DUA cookie yang dipisah total: sz_user (member, 30 hari) dan sz_admin
// (admin dari database, 12 jam). Sesi member tidak berlaku untuk endpoint
// admin dan sebaliknya — pemisahan ini dicek di api/index.js lewat role sesi.
import crypto from "node:crypto";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(":");
    const calc = crypto.scryptSync(String(password), salt, 64).toString("hex");
    const a = Buffer.from(calc);
    const b = Buffer.from(hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
export function newToken() {
  return crypto.randomBytes(32).toString("hex");
}
function cookie(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
export function userCookie(token) {
  return cookie("sz_user", token, 30 * 24 * 3600);
}
export function adminCookie(token) {
  return cookie("sz_admin", token, 12 * 3600);
}
export function clearUserCookie() {
  return "sz_user=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
export function clearAdminCookie() {
  return "sz_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
function readCookie(req, name) {
  const c = (req.headers && (req.headers.cookie || req.headers.Cookie)) || "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
export function readUserToken(req) {
  return readCookie(req, "sz_user");
}
export function readAdminToken(req) {
  return readCookie(req, "sz_admin");
}
// ADMIN_KEY hanya dipakai untuk bootstrap admin pertama (endpoint
// admin-setup). Login harian admin TIDAK memakai kunci ini, melainkan
// email+password akun admin dari database.
export function checkAdminKey(key) {
  const k = process.env.ADMIN_KEY || "";
  if (!k) return false;
  const a = Buffer.from(String(key || ""));
  const b = Buffer.from(k);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
