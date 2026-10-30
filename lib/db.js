// SanzuFreelance — lapisan data (PostgreSQL via DATABASE_URL, mis. Neon).
// Tanpa DATABASE_URL, db() melempar error berisi "DATABASE_URL" sehingga
// api/index.js mengembalikan 503 yang jujur. TIDAK ADA mode demo dan TIDAK
// ADA data hardcode: semua tabel dibuat kosong saat boot.
// Skema yang sama tertulis di schema.sql.
import crypto from "node:crypto";
import { DEFAULT_SETTINGS } from "./logic.js";

let pool = null;
async function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diatur");
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1|%2F/.test(process.env.DATABASE_URL)
        ? undefined
        : { rejectUnauthorized: false },
      max: 3,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users(
        id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '',
        email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        payment_method TEXT NOT NULL DEFAULT '',
        payment_number TEXT NOT NULL DEFAULT '',
        payment_holder TEXT NOT NULL DEFAULT '',
        referral_code TEXT UNIQUE, referred_by TEXT,
        state TEXT NOT NULL DEFAULT 'Menunggu',
        admin_reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS sessions(
        token TEXT PRIMARY KEY, user_id TEXT, role TEXT NOT NULL DEFAULT 'member',
        expires_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS submissions(
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, room TEXT NOT NULL,
        email_address TEXT NOT NULL, quality TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'Menunggu',
        member_note TEXT NOT NULL DEFAULT '', admin_note TEXT NOT NULL DEFAULT '',
        paid_rate INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS withdrawals(
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, method TEXT NOT NULL,
        number_snapshot TEXT NOT NULL DEFAULT '', amount INTEGER NOT NULL,
        fee INTEGER NOT NULL DEFAULT 0, net INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Menunggu Transfer',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ);
      CREATE TABLE IF NOT EXISTS referral_claims(
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, target INTEGER NOT NULL,
        reward INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Menunggu Konfirmasi',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ);
      CREATE TABLE IF NOT EXISTS notifications(
        id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sub_email_lower ON submissions(lower(email_address));
      CREATE INDEX IF NOT EXISTS idx_wd_user ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
      INSERT INTO meta(key,value) VALUES('submission_seq',0) ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key,value) VALUES('withdrawal_seq',0) ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key,value) VALUES('claim_seq',0) ON CONFLICT(key) DO NOTHING;
    `);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await pool.query(
        `INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING`,
        [k, JSON.stringify(v)],
      );
    }
  }
  return pool;
}

const newId = (prefix) => `${prefix}${crypto.randomBytes(4).toString("hex")}`;
async function nextSeq(key) {
  const p = await db();
  const r = await p.query(`UPDATE meta SET value=value+1 WHERE key=$1 RETURNING value`, [key]);
  return r.rows[0].value;
}
export async function nextSubmissionId() {
  return `SF-${String(await nextSeq("submission_seq")).padStart(4, "0")}`;
}
export async function nextWithdrawalId() {
  return `WD-${String(await nextSeq("withdrawal_seq")).padStart(4, "0")}`;
}
async function nextClaimId() {
  return `RC-${String(await nextSeq("claim_seq")).padStart(4, "0")}`;
}

// ---------------- settings ----------------
export async function getSettings() {
  const p = await db();
  const r = await p.query(`SELECT key,value FROM settings`);
  const out = { ...DEFAULT_SETTINGS };
  for (const row of r.rows) {
    try { out[row.key] = JSON.parse(row.value); } catch { /* abaikan nilai rusak */ }
  }
  return out;
}
export async function setSettings(settings) {
  const p = await db();
  for (const [k, v] of Object.entries(settings)) {
    await p.query(
      `INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,
      [k, JSON.stringify(v)],
    );
  }
  return getSettings();
}

// ---------------- users ----------------
export async function createUser({ display_name, email, pass_hash, role = "member", referral_code = null, referred_by = null, state = "Menunggu" }) {
  const p = await db();
  const id = newId("U");
  try {
    await p.query(
      `INSERT INTO users(id,display_name,email,pass_hash,role,referral_code,referred_by,state)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, display_name, email, pass_hash, role, referral_code, referred_by, state],
    );
  } catch (e) {
    if (e.code === "23505") return null;
    throw e;
  }
  return getUserById(id);
}
export async function getUserByEmail(email) {
  const p = await db();
  const r = await p.query(`SELECT * FROM users WHERE lower(email)=lower($1)`, [email]);
  return r.rows[0] || null;
}
export async function getUserById(id) {
  const p = await db();
  const r = await p.query(`SELECT * FROM users WHERE id=$1`, [id]);
  return r.rows[0] || null;
}
export async function getUserByReferralCode(code) {
  const p = await db();
  const r = await p.query(`SELECT * FROM users WHERE referral_code=$1 AND role='member'`, [code]);
  return r.rows[0] || null;
}
export async function hasAnyAdmin() {
  const p = await db();
  const r = await p.query(`SELECT 1 FROM users WHERE role='admin' LIMIT 1`);
  return r.rows.length > 0;
}
// Tampilan member untuk dirinya sendiri: nomor pembayaran selalu dimask.
export function publicUser(u, maskFn) {
  if (!u) return null;
  return {
    id: u.id, display_name: u.display_name, email: u.email, role: u.role,
    state: u.state, payment_method: u.payment_method,
    payment_number: maskFn ? maskFn(u.payment_number) : "",
    payment_holder: u.payment_holder, referral_code: u.referral_code,
    created_at: u.created_at,
  };
}
// Tampilan admin: nomor lengkap memang diperlukan admin untuk transfer manual.
// pass_hash TIDAK PERNAH ikut ke browser di fungsi mana pun.
export function adminUser(u) {
  if (!u) return null;
  const { pass_hash, ...rest } = u;
  return rest;
}
export async function updateUserProfile(id, { display_name, payment_method, payment_number, payment_holder }) {
  const p = await db();
  await p.query(
    `UPDATE users SET display_name=$2,payment_method=$3,payment_number=$4,payment_holder=$5 WHERE id=$1`,
    [id, display_name, payment_method, payment_number, payment_holder],
  );
  return getUserById(id);
}
export async function updateUserState(id, state, reason = "") {
  const p = await db();
  const r = await p.query(
    `UPDATE users SET state=$2, admin_reason=$3, updated_at=now() WHERE id=$1 AND role='member' RETURNING *`, [id, state, reason],
  );
  return r.rows[0] || null;
}
// Statistik per anggota untuk halaman Pemeriksaan (akurat dari database,
// tidak dibatasi 100 baris seperti daftar pengajuan).
export async function getReviewPeople() {
  const p = await db();
  const r = await p.query(`
    SELECT u.id, u.display_name, u.email, u.state,
      COUNT(s.id)::int AS total,
      COUNT(*) FILTER (WHERE s.stage='Menunggu')::int AS waiting,
      COUNT(*) FILTER (WHERE s.stage IN ('Diperiksa','Diproses'))::int AS in_process,
      COUNT(*) FILTER (WHERE s.stage='Diterima')::int AS accepted,
      COUNT(*) FILTER (WHERE s.stage='Ditolak')::int AS rejected
    FROM users u LEFT JOIN submissions s ON s.user_id=u.id
    WHERE u.role='member' GROUP BY u.id ORDER BY u.created_at DESC`);
  const totals = await p.query(`
    SELECT COUNT(DISTINCT user_id)::int AS members_with_submissions,
      COUNT(*)::int AS total_submissions,
      COUNT(*) FILTER (WHERE stage='Menunggu')::int AS waiting
    FROM submissions`);
  return { people: r.rows, totals: totals.rows[0] };
}
export async function listMembers() {
  const p = await db();
  const r = await p.query(`
    SELECT u.*,
      (SELECT COUNT(*)::int FROM submissions s WHERE s.user_id=u.id) AS total_submissions,
      (SELECT COUNT(*)::int FROM submissions s WHERE s.user_id=u.id AND s.stage='Diterima') AS accepted_submissions
    FROM users u WHERE u.role='member' ORDER BY u.created_at DESC`);
  return r.rows;
}

// ---------------- sessions ----------------
export async function createSession(userId, role, token, expiresAt) {
  const p = await db();
  await p.query(`INSERT INTO sessions(token,user_id,role,expires_at) VALUES($1,$2,$3,$4)`, [token, userId, role, expiresAt]);
}
export async function getSession(token) {
  const p = await db();
  const r = await p.query(`SELECT * FROM sessions WHERE token=$1 AND expires_at>now()`, [token]);
  return r.rows[0] || null;
}
export async function deleteSession(token) {
  const p = await db();
  await p.query(`DELETE FROM sessions WHERE token=$1`, [token]);
}

// ---------------- submissions ----------------
export async function createSubmissions(userId, room, emails, memberNote) {
  const p = await db();
  const client = await p.connect();
  const ids = [];
  try {
    await client.query("BEGIN");
    for (const email of emails) {
      const seq = await client.query(`UPDATE meta SET value=value+1 WHERE key='submission_seq' RETURNING value`);
      const id = `SF-${String(seq.rows[0].value).padStart(4, "0")}`;
      await client.query(
        `INSERT INTO submissions(id,user_id,room,email_address,quality,member_note) VALUES($1,$2,$3,$4,$5,$6)`,
        [id, userId, room, email, room, memberNote || ""],
      );
      ids.push(id);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return ids;
}
export async function listSubmissionsByUser(userId, limit = 100) {
  const p = await db();
  const r = await p.query(`SELECT * FROM submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, [userId, limit]);
  return r.rows;
}
export async function listSubmissionsAdmin({ stage, quality, search, user_id }) {
  const p = await db();
  const conds = [];
  const params = [];
  if (user_id) { params.push(user_id); conds.push(`s.user_id=$${params.length}`); }
  if (stage) { params.push(stage); conds.push(`s.stage=$${params.length}`); }
  if (quality) { params.push(quality); conds.push(`s.quality=$${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(s.id ILIKE $${params.length} OR s.email_address ILIKE $${params.length} OR u.display_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const r = await p.query(
    `SELECT s.*, u.display_name AS member_name, u.email AS member_email
     FROM submissions s LEFT JOIN users u ON u.id=s.user_id ${where}
     ORDER BY s.created_at DESC LIMIT 100`, params);
  return r.rows;
}
export async function getSubmissionById(id) {
  const p = await db();
  const r = await p.query(`SELECT * FROM submissions WHERE id=$1`, [id]);
  return r.rows[0] || null;
}
export async function updateSubmission(id, { stage, quality, paid_rate, admin_note }) {
  const p = await db();
  const r = await p.query(
    `UPDATE submissions SET stage=$2, quality=$3, paid_rate=$4, admin_note=$5, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, stage, quality, paid_rate, admin_note ?? ""],
  );
  return r.rows[0] || null;
}
export async function countTodaySubmissions(userId) {
  const p = await db();
  const r = await p.query(
    `SELECT COUNT(*)::int AS c FROM submissions WHERE user_id=$1
     AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date`,
    [userId],
  );
  return r.rows[0].c;
}
export async function findExistingActiveEmails(emails) {
  const p = await db();
  if (!emails.length) return [];
  const r = await p.query(
    `SELECT email_address FROM submissions WHERE lower(email_address)=ANY($1) AND stage<>'Ditolak'`,
    [emails.map((e) => e.toLowerCase())],
  );
  return r.rows.map((row) => row.email_address);
}
export async function getSummary(userId) {
  const p = await db();
  const r = await p.query(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE stage='Diterima')::int AS accepted,
      COUNT(*) FILTER (WHERE stage IN ('Menunggu','Diperiksa','Diproses'))::int AS in_process,
      COUNT(*) FILTER (WHERE stage='Ditolak')::int AS rejected
    FROM submissions WHERE user_id=$1`, [userId]);
  return r.rows[0];
}
export async function getBalance(userId) {
  const p = await db();
  const earned = await p.query(`SELECT COALESCE(SUM(paid_rate),0)::int AS s FROM submissions WHERE user_id=$1 AND stage='Diterima'`, [userId]);
  const bonus = await p.query(`SELECT COALESCE(SUM(reward),0)::int AS s FROM referral_claims WHERE user_id=$1 AND status='Dibayarkan'`, [userId]);
  const reserved = await p.query(`SELECT COALESCE(SUM(amount),0)::int AS s FROM withdrawals WHERE user_id=$1 AND status IN ('Menunggu Transfer','Selesai')`, [userId]);
  const e = earned.rows[0].s, b = bonus.rows[0].s, res = reserved.rows[0].s;
  return { earned: e, bonus: b, reserved: res, available: e + b - res };
}

// ---------------- withdrawals ----------------
export async function hasActiveWithdrawal(userId) {
  const p = await db();
  const r = await p.query(`SELECT 1 FROM withdrawals WHERE user_id=$1 AND status='Menunggu Transfer' LIMIT 1`, [userId]);
  return r.rows.length > 0;
}
export async function createWithdrawal({ id, userId, method, numberSnapshot, amount, fee, net }) {
  const p = await db();
  await p.query(
    `INSERT INTO withdrawals(id,user_id,method,number_snapshot,amount,fee,net) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [id, userId, method, numberSnapshot, amount, fee, net],
  );
  const r = await p.query(`SELECT * FROM withdrawals WHERE id=$1`, [id]);
  return r.rows[0];
}
export async function listWithdrawalsByUser(userId) {
  const p = await db();
  const r = await p.query(`SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId]);
  return r.rows;
}
export async function listWithdrawalsAdmin() {
  const p = await db();
  const r = await p.query(
    `SELECT w.*, u.display_name AS member_name, u.email AS member_email
     FROM withdrawals w LEFT JOIN users u ON u.id=w.user_id ORDER BY w.created_at DESC LIMIT 100`);
  return r.rows;
}
// Idempoten: hanya berjalan bila masih Menunggu Transfer.
export async function decideWithdrawal(id, decision) {
  const p = await db();
  const r = await p.query(
    `UPDATE withdrawals SET status=$2, decided_at=now() WHERE id=$1 AND status='Menunggu Transfer' RETURNING *`,
    [id, decision],
  );
  return r.rows[0] || null;
}

// ---------------- referral ----------------
export async function getReferralForUser(user) {
  const p = await db();
  const subs = (await p.query(`SELECT * FROM users WHERE referred_by=$1 AND role='member' ORDER BY created_at ASC`, [user.id])).rows;
  const list = [];
  let total = 0;
  for (const s of subs) {
    const c = await p.query(`SELECT COUNT(*)::int AS n FROM submissions WHERE user_id=$1 AND stage='Diterima'`, [s.id]);
    total += c.rows[0].n;
    list.push({ id: s.id, display_name: s.display_name, email: s.email, validSold: c.rows[0].n });
  }
  return { subordinates: list, validSold: total };
}
export async function getActiveClaim(userId) {
  const p = await db();
  const r = await p.query(
    `SELECT * FROM referral_claims WHERE user_id=$1 AND status IN ('Menunggu Konfirmasi','Dibayarkan') ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return r.rows[0] || null;
}
export async function createReferralClaim(userId, target, reward) {
  const id = await nextClaimId();
  const p = await db();
  await p.query(`INSERT INTO referral_claims(id,user_id,target,reward) VALUES($1,$2,$3,$4)`, [id, userId, target, reward]);
  const r = await p.query(`SELECT * FROM referral_claims WHERE id=$1`, [id]);
  return r.rows[0];
}
export async function listReferralClaims() {
  const p = await db();
  const r = await p.query(
    `SELECT c.*, u.display_name AS member_name, u.email AS member_email
     FROM referral_claims c LEFT JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 100`);
  return r.rows;
}
export async function listReferralProgress() {
  const members = await listMembers();
  const out = [];
  const p = await db();
  for (const m of members) {
    const c = await p.query(
      `SELECT COUNT(*)::int AS n FROM submissions s JOIN users u ON u.id=s.user_id
       WHERE u.referred_by=$1 AND s.stage='Diterima'`, [m.id]);
    out.push({ id: m.id, display_name: m.display_name, email: m.email, referral_code: m.referral_code, validSold: c.rows[0].n });
  }
  return out;
}
// Idempoten: hanya berjalan bila masih Menunggu Konfirmasi.
export async function decideReferralClaim(id, decision) {
  const p = await db();
  const r = await p.query(
    `UPDATE referral_claims SET status=$2, decided_at=now() WHERE id=$1 AND status='Menunggu Konfirmasi' RETURNING *`,
    [id, decision],
  );
  return r.rows[0] || null;
}

// ---------------- notifications ----------------
export async function createNotification(userId, type, title, body) {
  const p = await db();
  await p.query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,$2,$3,$4)`, [userId, type, title, body]);
}
export async function notifyAllActiveMembers(type, title, body) {
  const p = await db();
  await p.query(
    `INSERT INTO notifications(user_id,type,title,body)
     SELECT id,$1,$2,$3 FROM users WHERE role='member' AND state='Aktif'`,
    [type, title, body],
  );
}
export async function listNotifications(userId) {
  const p = await db();
  const r = await p.query(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [userId]);
  return r.rows;
}

// ---------------- admin stats ----------------
export async function getAdminStats() {
  const p = await db();
  const q = async (sql) => (await p.query(sql)).rows[0].c;
  return {
    waiting: await q(`SELECT COUNT(*)::int AS c FROM submissions WHERE stage='Menunggu'`),
    checking: await q(`SELECT COUNT(*)::int AS c FROM submissions WHERE stage='Diperiksa'`),
    payouts_waiting: await q(`SELECT COUNT(*)::int AS c FROM withdrawals WHERE status='Menunggu Transfer'`),
    new_members: await q(`SELECT COUNT(*)::int AS c FROM users WHERE role='member' AND state='Menunggu'`),
    total_members: await q(`SELECT COUNT(*)::int AS c FROM users WHERE role='member'`),
    accepted: await q(`SELECT COUNT(*)::int AS c FROM submissions WHERE stage='Diterima'`),
  };
}
