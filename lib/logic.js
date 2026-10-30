// SanzuFreelance — fungsi murni (tanpa database), dipakai api/index.js dan
// diuji test/test-logic.mjs. Semua aturan bisnis inti tinggal di sini supaya
// gampang dites tanpa Postgres.
import crypto from "node:crypto";

export const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const STAGES = ["Menunggu", "Diperiksa", "Diproses", "Diterima", "Ditolak"];
export const QUALITIES = ["Good", "Captcha", "Disabled / Verify"];
export const ROOMS = ["Good", "Captcha"];
export const FINAL_STAGES = ["Diterima", "Ditolak"];
export const CREDENTIAL_RE =
  /\b(password|passwd|kata\s*sandi|otp|recovery\s*code|kode\s*pemulihan)\s*[:=]/i;

// Validasi satu batch pengajuan. Mengembalikan { error } atau { emails }
// dengan alamat sudah di-trim dan dilowercase (Gmail tidak peka huruf besar).
export function validateSubmissionBatch(input, dailyLimit) {
  const raw = Array.isArray(input)
    ? input
    : String(input || "").split(/[\s,;]+/);
  const emails = raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (!emails.length)
    return { error: "Masukkan minimal satu alamat @gmail.com sebelum mengirim." };
  if (emails.length > 50)
    return { error: "Maksimal 50 alamat per pengajuan." };
  if (Number.isInteger(dailyLimit) && emails.length > dailyLimit)
    return { error: `Melebihi batas harian ${dailyLimit} alamat per anggota.` };
  const invalid = emails.filter((e) => !GMAIL_RE.test(e));
  if (invalid.length)
    return {
      error: `Hanya alamat @gmail.com yang diperbolehkan. ${invalid.length} entri tidak valid: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? " ..." : ""}`,
    };
  if (new Set(emails).size !== emails.length)
    return { error: "Terdapat alamat yang sama lebih dari sekali. Hapus duplikat terlebih dahulu." };
  return { emails };
}

export function containsCredentialPattern(note) {
  return CREDENTIAL_RE.test(String(note || ""));
}

// Biaya admin bertingkat: < Rp50.000 = 0, Rp50.000–100.000 = tier1, > Rp100.000 = tier2.
export function feeFor(amount, tier1, tier2) {
  const n = Number(amount);
  if (n < 50000) return 0;
  if (n <= 100000) return Number(tier1) || 0;
  return Number(tier2) || 0;
}
export function feeForMethod(amount, fees, method) {
  const f = method === "SeaBank" ? fees.seabank : fees.dana;
  return feeFor(amount, f.tier1, f.tier2);
}

// Saldo tersedia = penghasilan dari pengajuan Diterima + bonus referral yang
// sudah Dibayarkan − nominal penarikan yang Menunggu Transfer atau Selesai.
export function calcBalance({ earned = 0, bonus = 0, pending = 0, completed = 0 } = {}) {
  return Number(earned) + Number(bonus) - Number(pending) - Number(completed);
}

// Aturan transisi review. finalStage/finalQuality adalah nilai sesudah diubah
// (bila stage/quality tidak diubah, pakai nilai lama — itu diurus handler).
export function canReview({ fromStage, finalStage, finalQuality }) {
  if (FINAL_STAGES.includes(fromStage))
    return { ok: false, error: `Pengajuan yang sudah ${fromStage} bersifat final dan tidak bisa diubah lagi.` };
  if (!STAGES.includes(finalStage))
    return { ok: false, error: "Tahap tidak valid." };
  if (!QUALITIES.includes(finalQuality))
    return { ok: false, error: "Klasifikasi tidak valid." };
  if (finalStage === "Diterima" && !["Good", "Captcha"].includes(finalQuality))
    return { ok: false, error: "Pengajuan dengan klasifikasi Disabled / Verify tidak boleh ditandai Diterima." };
  return { ok: true };
}

export function maskNumber(n) {
  const s = String(n || "");
  if (s.length < 6) return "••••";
  return `${s.slice(0, 3)}••••${s.slice(-3)}`;
}

export function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = crypto.randomBytes(6);
  for (const b of buf) out += chars[b % chars.length];
  return `SF-${out}`;
}

export function referralProgress(validSold, target) {
  const t = Number(target) || 0;
  return { validSold: Number(validSold) || 0, target: t, pct: t > 0 ? Math.min(100, Math.floor(((Number(validSold) || 0) / t) * 100)) : 0 };
}

// Klaim referral baru hanya boleh bila: target tercapai DAN tidak ada klaim
// berstatus Menunggu Konfirmasi atau Dibayarkan (klaim yang Ditolak boleh
// diajukan ulang).
export function canClaim({ validSold, target, activeClaim }) {
  if (activeClaim)
    return { ok: false, error: "Masih ada klaim referral yang menunggu konfirmasi atau sudah dibayarkan." };
  if ((Number(validSold) || 0) < (Number(target) || 0))
    return { ok: false, error: `Target referral belum tercapai (${validSold || 0}/${target}).` };
  return { ok: true };
}

const isInt = (v) => Number.isInteger(v) && v >= 0;
export function validateProfile({ display_name, payment_method, payment_number, payment_holder }) {
  const name = String(display_name || "").trim();
  if (!name) return { error: "Nama tampilan wajib diisi." };
  if (name.length > 100) return { error: "Nama tampilan maksimal 100 karakter." };
  const method = payment_method || "";
  if (method && !["DANA", "SeaBank"].includes(method))
    return { error: "Metode pembayaran harus DANA atau SeaBank." };
  const number = String(payment_number || "").trim();
  if (method) {
    if (!/^[0-9]{8,20}$/.test(number))
      return { error: "Nomor pembayaran harus 8–20 digit angka." };
    if (method === "SeaBank" && !String(payment_holder || "").trim())
      return { error: "Nama pemilik rekening SeaBank wajib diisi." };
  }
  return { ok: true, display_name: name, payment_method: method, payment_number: number, payment_holder: String(payment_holder || "").trim() };
}

export function validateWithdraw({ amount, balance, fee }) {
  if (!Number.isInteger(amount) || amount < 1)
    return { error: "Nominal penarikan minimal Rp1." };
  if (amount > balance)
    return { error: "Nominal penarikan melebihi saldo tersedia." };
  if (fee >= amount)
    return { error: "Biaya admin tidak boleh sama atau lebih besar dari nominal penarikan." };
  return { ok: true };
}

export const DEFAULT_SETTINGS = {
  rate_good: 4300,
  rate_captcha: 3500,
  daily_limit: 50,
  store_open: true,
  withdraw_enabled: true,
  withdraw_dana: true,
  withdraw_seabank: true,
  fee_dana_tier1: 0,
  fee_dana_tier2: 0,
  fee_seabank_tier1: 0,
  fee_seabank_tier2: 0,
  referral_enabled: true,
  referral_target: 50,
  referral_reward: 10000,
  telegram_url: "",
};

const INT_KEYS = [
  "rate_good", "rate_captcha", "fee_dana_tier1", "fee_dana_tier2",
  "fee_seabank_tier1", "fee_seabank_tier2", "referral_target", "referral_reward",
];
const BOOL_KEYS = [
  "store_open", "withdraw_enabled", "withdraw_dana", "withdraw_seabank", "referral_enabled",
];

// Validasi + normalisasi pengaturan admin. Input boleh parsial; nilai yang
// tidak dikirim diambil dari current.
export function validateSettings(input, current = DEFAULT_SETTINGS) {
  const merged = { ...current, ...(input || {}) };
  for (const k of INT_KEYS) {
    const v = Number(merged[k]);
    if (!Number.isInteger(v) || v < 0) return { error: `Nilai ${k} harus bilangan bulat >= 0.` };
    merged[k] = v;
  }
  const limit = Number(merged.daily_limit);
  if (!Number.isInteger(limit) || limit < 1)
    return { error: "Batas harian harus bilangan bulat >= 1." };
  merged.daily_limit = limit;
  for (const k of BOOL_KEYS) merged[k] = merged[k] === true || merged[k] === "true" || merged[k] === 1;
  merged.telegram_url = String(merged.telegram_url || "").trim();
  if (merged.telegram_url && !/^https?:\/\//i.test(merged.telegram_url))
    return { error: "Link grup Telegram harus diawali http:// atau https://." };
  return { ok: true, settings: merged };
}
