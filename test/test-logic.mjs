// Uji fungsi murni SanzuFreelance — jalan tanpa database: node test/test-logic.mjs
import assert from "node:assert";
import {
  validateSubmissionBatch, containsCredentialPattern, feeFor, feeForMethod,
  calcBalance, canReview, maskNumber, canClaim, validateProfile,
  validateWithdraw, validateSettings,
} from "../lib/logic.js";

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`PASS: ${name}`); };

// --- Validasi batch email ---
ok("batch valid dilowercase dan diterima", () => {
  const r = validateSubmissionBatch(["Test@Gmail.com", "b@gmail.com"], 50);
  assert.deepEqual(r.emails, ["test@gmail.com", "b@gmail.com"]);
});
ok("batch kosong ditolak", () => {
  assert.match(validateSubmissionBatch([], 50).error, /minimal satu/);
});
ok("batch duplikat (beda huruf besar) ditolak", () => {
  assert.match(validateSubmissionBatch(["a@gmail.com", "A@gmail.com"], 50).error, /sama lebih dari sekali/);
});
ok("batch non-gmail ditolak", () => {
  assert.match(validateSubmissionBatch(["a@yahoo.com", "b@gmail.com"], 50).error, /Hanya alamat @gmail\.com/);
});
ok("batch > 50 per pengajuan ditolak", () => {
  const many = Array.from({ length: 51 }, (_, i) => `u${i}@gmail.com`);
  assert.match(validateSubmissionBatch(many, 100).error, /Maksimal 50/);
});
ok("batch melebihi batas harian ditolak", () => {
  const many = Array.from({ length: 11 }, (_, i) => `u${i}@gmail.com`);
  assert.match(validateSubmissionBatch(many, 10).error, /batas harian 10/);
});

// --- Detektor pola kredensial (fungsi masih ada, tapi API TIDAK lagi menolak
// catatan berisi password sejak keputusan Arka 2026-10-30: admin butuh password
// akun untuk diserahkan ke pembeli; catatan hanya tampil di panel admin) ---
ok("detektor: catatan berisi password terdeteksi", () => { assert.equal(containsCredentialPattern("password: rahasia"), true); });
ok("detektor: catatan berisi kata sandi= terdeteksi", () => { assert.equal(containsCredentialPattern("kata sandi=abc"), true); });
ok("detektor: catatan berisi otp: terdeteksi", () => { assert.equal(containsCredentialPattern("otp: 123456"), true); });
ok("catatan biasa diterima", () => { assert.equal(containsCredentialPattern("akun dari HP lama"), false); });

// --- Fee bertingkat ---
const fees = { dana: { tier1: 2000, tier2: 5000 }, seabank: { tier1: 1000, tier2: 3000 } };
ok("fee di bawah 50rb = 0", () => { assert.equal(feeFor(49999, 2000, 5000), 0); });
ok("fee 50rb dan 100rb = tier1", () => {
  assert.equal(feeFor(50000, 2000, 5000), 2000);
  assert.equal(feeFor(100000, 2000, 5000), 2000);
});
ok("fee di atas 100rb = tier2", () => { assert.equal(feeFor(100001, 2000, 5000), 5000); });
ok("fee per metode berbeda", () => {
  assert.equal(feeForMethod(75000, fees, "DANA"), 2000);
  assert.equal(feeForMethod(75000, fees, "SeaBank"), 1000);
  assert.equal(feeForMethod(200000, fees, "SeaBank"), 3000);
});

// --- Saldo ---
ok("saldo = diterima + bonus - menunggu - selesai", () => {
  assert.equal(calcBalance({ earned: 100000, bonus: 10000, pending: 20000, completed: 30000 }), 60000);
});
ok("saldo nol bila belum ada apa-apa", () => { assert.equal(calcBalance({}), 0); });

// --- Transisi review ---
ok("Menunggu -> Diterima (Good) valid", () => {
  assert.equal(canReview({ fromStage: "Menunggu", finalStage: "Diterima", finalQuality: "Good" }).ok, true);
});
ok("Diproses -> Diterima (Captcha) valid", () => {
  assert.equal(canReview({ fromStage: "Diproses", finalStage: "Diterima", finalQuality: "Captcha" }).ok, true);
});
ok("Diterima (Disabled) tidak valid", () => {
  const r = canReview({ fromStage: "Diperiksa", finalStage: "Diterima", finalQuality: "Disabled / Verify" });
  assert.equal(r.ok, false);
  assert.match(r.error, /Disabled/);
});
ok("pengajuan final tidak bisa diubah lagi", () => {
  assert.equal(canReview({ fromStage: "Diterima", finalStage: "Ditolak", finalQuality: "Good" }).ok, false);
  assert.equal(canReview({ fromStage: "Ditolak", finalStage: "Diterima", finalQuality: "Good" }).ok, false);
});
ok("Menunggu -> Diperiksa dan Diperiksa -> Diproses valid", () => {
  assert.equal(canReview({ fromStage: "Menunggu", finalStage: "Diperiksa", finalQuality: "Good" }).ok, true);
  assert.equal(canReview({ fromStage: "Diperiksa", finalStage: "Diproses", finalQuality: "Captcha" }).ok, true);
});

// --- Mask nomor, klaim referral, profil, penarikan, pengaturan ---
ok("mask nomor: 3 awal + •••• + 3 akhir", () => {
  assert.equal(maskNumber("081234567890"), "081••••890");
});
ok("klaim referral: target tercapai dan tanpa klaim aktif = boleh", () => {
  assert.equal(canClaim({ validSold: 50, target: 50, activeClaim: null }).ok, true);
});
ok("klaim referral: belum target = tidak boleh", () => {
  assert.equal(canClaim({ validSold: 49, target: 50, activeClaim: null }).ok, false);
});
ok("klaim referral: ada klaim aktif = tidak boleh", () => {
  assert.equal(canClaim({ validSold: 60, target: 50, activeClaim: { status: "Menunggu Konfirmasi" } }).ok, false);
});
ok("profil: SeaBank tanpa nama pemilik ditolak", () => {
  assert.match(validateProfile({ display_name: "Budi", payment_method: "SeaBank", payment_number: "12345678", payment_holder: "" }).error, /Nama pemilik/);
});
ok("profil: nomor bukan digit ditolak", () => {
  assert.match(validateProfile({ display_name: "Budi", payment_method: "DANA", payment_number: "0812abc", payment_holder: "" }).error, /8–20 digit/);
});
ok("penarikan: melebihi saldo ditolak; fee >= nominal ditolak", () => {
  assert.match(validateWithdraw({ amount: 60000, balance: 50000, fee: 0 }).error, /melebihi saldo/);
  assert.match(validateWithdraw({ amount: 1000, balance: 5000, fee: 1000 }).error, /Biaya admin/);
});
ok("pengaturan: angka negatif dan limit 0 ditolak", () => {
  assert.match(validateSettings({ rate_good: -1 }).error, /rate_good/);
  assert.match(validateSettings({ daily_limit: 0 }).error, /Batas harian/);
});

console.log(`\nSemua ${n} kasus test-logic PASS.`);
