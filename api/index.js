// SanzuFreelance — SATU dispatcher (hemat fungsi Vercel Hobby, maks 12).
// Semua endpoint lewat /api?action=<nama>.
//   GET  publik: public-settings
//   GET  member: me, submissions, notifications, referral
//   GET  admin: admin-stats, admin-submissions, admin-members, admin-withdrawals,
//        admin-referrals, admin-settings
//   POST member: register, login, logout, update-profile, submit, withdraw, referral-claim
//   POST admin: admin-setup (bootstrap sekali, pakai ADMIN_KEY), admin-login,
//        admin-logout, admin-review, admin-member-state, admin-withdrawal-decide,
//        admin-referral-decide, admin-settings
// Login admin DAN member sama-sama dari database (tabel users, kolom role).
// ADMIN_KEY hanya untuk bootstrap admin pertama dan tidak dipakai untuk login
// harian. Sesi member (cookie sz_user, role 'member') tidak bisa mengakses
// endpoint admin, dan sesi admin (cookie sz_admin, role 'admin') tidak bisa
// dipakai sebagai member. pass_hash tidak pernah dikirim ke browser.
import { readJson, bad, isDbDown } from "../lib/http.js";
import {
  hashPassword, verifyPassword, newToken, userCookie, adminCookie,
  clearUserCookie, clearAdminCookie, readUserToken, readAdminToken, checkAdminKey,
} from "../lib/auth.js";
import {
  getSettings, setSettings, createUser, getUserByEmail, getUserById,
  getUserByReferralCode, hasAnyAdmin, publicUser, adminUser, updateUserProfile,
  updateUserState, listMembers, createSession, getSession, deleteSession,
  createSubmissions, listSubmissionsByUser, listSubmissionsAdmin, getSubmissionById,
  updateSubmission, countTodaySubmissions, findExistingActiveEmails, getSummary,
  getBalance, hasActiveWithdrawal, createWithdrawal, listWithdrawalsByUser,
  listWithdrawalsAdmin, decideWithdrawal, getReferralForUser, getActiveClaim, getReviewPeople,
  createReferralClaim, listReferralClaims, listReferralProgress, decideReferralClaim,
  createNotification, notifyAllActiveMembers, listNotifications, getAdminStats,
  nextSubmissionId, nextWithdrawalId,
} from "../lib/db.js";
import {
  EMAIL_RE, GMAIL_RE, ROOMS, STAGES, QUALITIES, validateSubmissionBatch,
  containsCredentialPattern, feeForMethod, calcBalance, canReview, maskNumber,
  generateReferralCode, referralProgress, canClaim, validateProfile,
  validateWithdraw, validateSettings,
} from "../lib/logic.js";

const DB_DOWN = "Database belum terhubung. Admin perlu menyiapkan database dulu.";

async function getMember(req) {
  const token = readUserToken(req);
  if (!token) return null;
  const s = await getSession(token);
  if (!s || s.role !== "member" || !s.user_id) return null;
  const u = await getUserById(s.user_id);
  if (!u || u.role !== "member") return null;
  return u;
}
async function getAdmin(req) {
  const token = readAdminToken(req);
  if (!token) return null;
  const s = await getSession(token);
  if (!s || s.role !== "admin" || !s.user_id) return null;
  const u = await getUserById(s.user_id);
  if (!u || u.role !== "admin") return null;
  return u;
}
function publicSettings(s) {
  return {
    rate_good: s.rate_good, rate_captcha: s.rate_captcha, daily_limit: s.daily_limit,
    store_open: s.store_open, withdraw_enabled: s.withdraw_enabled,
    withdraw_dana: s.withdraw_dana, withdraw_seabank: s.withdraw_seabank,
    fee_dana_tier1: s.fee_dana_tier1, fee_dana_tier2: s.fee_dana_tier2,
    fee_seabank_tier1: s.fee_seabank_tier1, fee_seabank_tier2: s.fee_seabank_tier2,
    referral_enabled: s.referral_enabled, referral_target: s.referral_target,
    referral_reward: s.referral_reward, telegram_url: s.telegram_url,
  };
}
function referralOrigin(req) {
  const origin = req.headers && (req.headers.origin || req.headers.Origin);
  if (origin) return String(origin).replace(/\/$/, "");
  const host = req.headers && req.headers.host;
  if (host) return `https://${host}`;
  return "";
}
function setCookie(res, value) {
  res.setHeader("Set-Cookie", value);
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const action = url.searchParams.get("action") || "";
    const body = req.method === "POST" ? await readJson(req) : {};

    // ---------- GET publik ----------
    if (req.method === "GET" && action === "public-settings") {
      const s = await getSettings();
      return res.status(200).json({ settings: publicSettings(s) });
    }

    // ---------- GET member ----------
    if (req.method === "GET" && action === "me") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      const bal = await getBalance(u.id);
      const sum = await getSummary(u.id);
      const ref = await getReferralForUser(u);
      const settings = await getSettings();
      const claim = await getActiveClaim(u.id);
      return res.status(200).json({
        user: publicUser(u, maskNumber),
        balance: bal.available, balance_detail: bal,
        summary: { total: sum.total, accepted: sum.accepted, in_process: sum.in_process, rejected: sum.rejected },
        referral: {
          code: u.referral_code,
          link: u.referral_code && referralOrigin(req) ? `${referralOrigin(req)}/?ref=${u.referral_code}` : "",
          ...referralProgress(ref.validSold, settings.referral_target),
          reward: settings.referral_reward, claim_status: claim ? claim.status : "",
        },
      });
    }
    if (req.method === "GET" && action === "submissions") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      return res.status(200).json({ submissions: await listSubmissionsByUser(u.id) });
    }
    if (req.method === "GET" && action === "notifications") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      return res.status(200).json({ notifications: await listNotifications(u.id) });
    }
    if (req.method === "GET" && action === "referral") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      const ref = await getReferralForUser(u);
      const settings = await getSettings();
      const claim = await getActiveClaim(u.id);
      const origin = referralOrigin(req);
      return res.status(200).json({
        code: u.referral_code,
        link: u.referral_code && origin ? `${origin}/?ref=${u.referral_code}` : "",
        subordinates: ref.subordinates,
        ...referralProgress(ref.validSold, settings.referral_target),
        reward: settings.referral_reward, enabled: settings.referral_enabled,
        claim: claim || null,
      });
    }

    // ---------- GET admin ----------
    if (req.method === "GET" && action === "admin-stats") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      return res.status(200).json({ stats: await getAdminStats() });
    }
    if (req.method === "GET" && action === "admin-submissions") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      return res.status(200).json({
        submissions: await listSubmissionsAdmin({
          stage: url.searchParams.get("stage") || "",
          quality: url.searchParams.get("quality") || "",
          search: url.searchParams.get("search") || "",
          user_id: url.searchParams.get("user_id") || "",
        }),
      });
    }
    if (req.method === "GET" && action === "admin-review-people") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      return res.status(200).json(await getReviewPeople());
    }
    if (req.method === "GET" && action === "admin-members") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      return res.status(200).json({ members: (await listMembers()).map(adminUser) });
    }
    if (req.method === "GET" && action === "admin-withdrawals") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      return res.status(200).json({ withdrawals: await listWithdrawalsAdmin() });
    }
    if (req.method === "GET" && action === "admin-referrals") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      const settings = await getSettings();
      return res.status(200).json({
        claims: await listReferralClaims(),
        progress: await listReferralProgress(),
        target: settings.referral_target, reward: settings.referral_reward,
      });
    }
    if (req.method === "GET" && action === "admin-settings") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      return res.status(200).json({ settings: await getSettings() });
    }

    // ---------- POST member ----------
    if (req.method === "POST" && action === "register") {
      const display_name = String(body.display_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const refCode = String(body.referral_code || "").trim();
      if (!display_name || display_name.length > 100) return bad(res, 400, "Nama tampilan wajib diisi (maksimal 100 karakter).");
      if (!EMAIL_RE.test(email)) return bad(res, 400, "Format email tidak valid.");
      if (password.length < 8) return bad(res, 400, "Password minimal 8 karakter.");
      let referred_by = null;
      if (refCode) {
        const referrer = await getUserByReferralCode(refCode);
        if (!referrer) return bad(res, 400, "Kode referral tidak ditemukan.");
        referred_by = referrer.id;
      }
      // Kode referral unik; bila bentrok (sangat jarang), buat ulang sekali.
      let code = generateReferralCode();
      if (await getUserByReferralCode(code)) code = generateReferralCode();
      const created = await createUser({
        display_name, email, pass_hash: hashPassword(password),
        role: "member", referral_code: code, referred_by, state: "Menunggu",
      });
      if (!created) return bad(res, 400, "Email sudah terdaftar.");
      return res.status(200).json({ ok: true, state: "Menunggu", message: "Pendaftaran berhasil. Akun menunggu persetujuan admin." });
    }
    if (req.method === "POST" && action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const u = await getUserByEmail(email);
      if (!u || u.role !== "member" || !verifyPassword(String(body.password || ""), u.pass_hash))
        return bad(res, 401, "Email atau password salah.");
      if (u.state === "Nonaktif") return bad(res, 403, "Akun dinonaktifkan oleh admin.");
      const token = newToken();
      await createSession(u.id, "member", token, new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString());
      setCookie(res, userCookie(token));
      return res.status(200).json({ ok: true, user: publicUser(u, maskNumber) });
    }
    if (req.method === "POST" && action === "logout") {
      const token = readUserToken(req);
      if (token) await deleteSession(token);
      setCookie(res, clearUserCookie());
      return res.status(200).json({ ok: true });
    }
    if (req.method === "POST" && action === "update-profile") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      const v = validateProfile(body);
      if (v.error) return bad(res, 400, v.error);
      const updated = await updateUserProfile(u.id, v);
      return res.status(200).json({ ok: true, user: publicUser(updated, maskNumber) });
    }
    if (req.method === "POST" && action === "submit") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      if (u.state === "Menunggu") return bad(res, 403, "Akunmu masih menunggu persetujuan admin.");
      if (u.state !== "Aktif") return bad(res, 403, "Akunmu dinonaktifkan admin.");
      const settings = await getSettings();
      if (!settings.store_open) return bad(res, 403, "Setoran sedang ditutup admin.");
      const room = String(body.room || "");
      if (!ROOMS.includes(room)) return bad(res, 400, "Room harus Good atau Captcha.");
      const rawEmails = Array.isArray(body.emails) ? body.emails : String(body.emails || body.bulk || "");
      const v = validateSubmissionBatch(rawEmails, settings.daily_limit);
      if (v.error) return bad(res, 400, v.error);
      const note = String(body.member_note || "");
      if (containsCredentialPattern(note))
        return bad(res, 400, "Jangan masukkan password, OTP, atau kode pemulihan. Yang disetor hanya alamat emailnya.");
      const today = await countTodaySubmissions(u.id);
      if (today + v.emails.length > settings.daily_limit)
        return bad(res, 400, `Melebihi batas harian ${settings.daily_limit} alamat (hari ini sudah ${today}).`);
      const existing = await findExistingActiveEmails(v.emails);
      if (existing.length)
        return bad(res, 400, `Alamat berikut sudah pernah disetor dan belum ditolak: ${existing.slice(0, 3).join(", ")}${existing.length > 3 ? " ..." : ""}`);
      const ids = await createSubmissions(u.id, room, v.emails, note);
      return res.status(200).json({ ok: true, ids, count: ids.length });
    }
    if (req.method === "POST" && action === "withdraw") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      if (u.state === "Menunggu") return bad(res, 403, "Akunmu masih menunggu persetujuan admin.");
      if (u.state !== "Aktif") return bad(res, 403, "Akunmu dinonaktifkan admin.");
      const settings = await getSettings();
      if (!settings.withdraw_enabled) return bad(res, 403, "Penarikan sedang dinonaktifkan admin.");
      const method = String(body.method || u.payment_method || "");
      if (!["DANA", "SeaBank"].includes(method)) return bad(res, 400, "Metode penarikan harus DANA atau SeaBank.");
      if (method === "DANA" && !settings.withdraw_dana) return bad(res, 403, "Penarikan via DANA sedang dinonaktifkan admin.");
      if (method === "SeaBank" && !settings.withdraw_seabank) return bad(res, 403, "Penarikan via SeaBank sedang dinonaktifkan admin.");
      if (u.payment_method !== method || !/^[0-9]{8,20}$/.test(u.payment_number || ""))
        return bad(res, 400, "Lengkapi dulu metode dan nomor pembayaran di Profil sesuai metode yang dipilih.");
      if (method === "SeaBank" && !u.payment_holder) return bad(res, 400, "Nama pemilik rekening SeaBank wajib diisi di Profil.");
      if (await hasActiveWithdrawal(u.id))
        return bad(res, 400, "Masih ada satu penarikan yang menunggu transfer. Tunggu sampai diputuskan admin.");
      const amount = Number(body.amount);
      const bal = await getBalance(u.id);
      const fee = feeForMethod(amount, {
        dana: { tier1: settings.fee_dana_tier1, tier2: settings.fee_dana_tier2 },
        seabank: { tier1: settings.fee_seabank_tier1, tier2: settings.fee_seabank_tier2 },
      }, method);
      const vw = validateWithdraw({ amount, balance: bal.available, fee });
      if (vw.error) return bad(res, 400, vw.error);
      const id = await nextWithdrawalId();
      const wd = await createWithdrawal({
        id, userId: u.id, method, numberSnapshot: u.payment_number,
        amount, fee, net: amount - fee,
      });
      return res.status(200).json({
        ok: true,
        withdrawal: { ...wd, number_snapshot: maskNumber(wd.number_snapshot) },
        note: "Pengajuan penarikan dibuat. Admin akan transfer manual, lalu menandai Selesai.",
      });
    }
    if (req.method === "POST" && action === "referral-claim") {
      const u = await getMember(req);
      if (!u) return bad(res, 401, "Belum login sebagai anggota.");
      if (u.state === "Menunggu") return bad(res, 403, "Akunmu masih menunggu persetujuan admin.");
      if (u.state !== "Aktif") return bad(res, 403, "Akunmu dinonaktifkan admin.");
      const settings = await getSettings();
      if (!settings.referral_enabled) return bad(res, 403, "Program referral sedang dinonaktifkan admin.");
      const ref = await getReferralForUser(u);
      const active = await getActiveClaim(u.id);
      const c = canClaim({ validSold: ref.validSold, target: settings.referral_target, activeClaim: active });
      if (!c.ok) return bad(res, 400, c.error);
      const claim = await createReferralClaim(u.id, settings.referral_target, settings.referral_reward);
      return res.status(200).json({ ok: true, claim });
    }

    // ---------- POST admin ----------
    if (req.method === "POST" && action === "admin-setup") {
      // Bootstrap SEKALI SAJA: wajib ADMIN_KEY dari env + belum ada admin.
      if (!checkAdminKey(body.admin_key)) return bad(res, 403, "ADMIN_KEY salah atau belum diatur di server.");
      if (await hasAnyAdmin()) return bad(res, 409, "Akun admin sudah ada. Endpoint ini hanya untuk admin pertama.");
      const display_name = String(body.display_name || "Admin").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!EMAIL_RE.test(email)) return bad(res, 400, "Format email tidak valid.");
      if (password.length < 8) return bad(res, 400, "Password admin minimal 8 karakter.");
      const created = await createUser({
        display_name, email, pass_hash: hashPassword(password),
        role: "admin", referral_code: null, referred_by: null, state: "Aktif",
      });
      if (!created) return bad(res, 400, "Email sudah terdaftar.");
      return res.status(200).json({ ok: true, message: "Akun admin pertama dibuat. Selanjutnya login admin pakai email+password ini, bukan ADMIN_KEY." });
    }
    if (req.method === "POST" && action === "admin-login") {
      const email = String(body.email || "").trim().toLowerCase();
      const u = await getUserByEmail(email);
      if (!u || u.role !== "admin" || !verifyPassword(String(body.password || ""), u.pass_hash))
        return bad(res, 401, "Email atau password admin salah.");
      if (u.state !== "Aktif") return bad(res, 403, "Akun admin tidak aktif.");
      const token = newToken();
      await createSession(u.id, "admin", token, new Date(Date.now() + 12 * 3600 * 1000).toISOString());
      setCookie(res, adminCookie(token));
      return res.status(200).json({ ok: true, admin: { id: u.id, display_name: u.display_name, email: u.email } });
    }
    if (req.method === "POST" && action === "admin-logout") {
      const token = readAdminToken(req);
      if (token) await deleteSession(token);
      setCookie(res, clearAdminCookie());
      return res.status(200).json({ ok: true });
    }
    if (req.method === "POST" && action === "admin-review") {
      const admin = await getAdmin(req);
      if (!admin) return bad(res, 401, "Belum login sebagai admin.");
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : (body.id ? [String(body.id)] : []);
      if (!ids.length) return bad(res, 400, "Pilih minimal satu pengajuan.");
      const hasStage = body.stage !== undefined && body.stage !== "";
      const hasQuality = body.quality !== undefined && body.quality !== "";
      if (!hasStage && !hasQuality) return bad(res, 400, "Tentukan tahap dan/atau klasifikasi baru.");
      if (hasStage && !STAGES.includes(body.stage)) return bad(res, 400, "Tahap tidak valid.");
      if (hasQuality && !QUALITIES.includes(body.quality)) return bad(res, 400, "Klasifikasi tidak valid.");
      const settings = await getSettings();
      const planned = [];
      for (const id of ids) {
        const sub = await getSubmissionById(id);
        if (!sub) return bad(res, 404, `Pengajuan ${id} tidak ditemukan.`);
        const finalStage = hasStage ? body.stage : sub.stage;
        const finalQuality = hasQuality ? body.quality : sub.quality;
        const chk = canReview({ fromStage: sub.stage, finalStage, finalQuality });
        if (!chk.ok) return bad(res, 400, `${id}: ${chk.error}`);
        let paid = Number(sub.paid_rate) || 0;
        if (finalStage === "Diterima") paid = finalQuality === "Good" ? settings.rate_good : settings.rate_captcha;
        if (finalStage === "Ditolak") paid = 0;
        planned.push({ sub, finalStage, finalQuality, paid });
      }
      const updated = [];
      for (const p of planned) {
        const row = await updateSubmission(p.sub.id, {
          stage: p.finalStage, quality: p.finalQuality, paid_rate: p.paid,
          admin_note: body.admin_note !== undefined ? String(body.admin_note) : p.sub.admin_note,
        });
        // Notifikasi ke pemilik, sesuai perubahan yang terjadi.
        if (p.finalStage === "Diperiksa" && p.sub.stage !== "Diperiksa")
          await createNotification(p.sub.user_id, "checking", `${p.sub.id} sedang diperiksa`, "Admin mulai memeriksa pengajuanmu.");
        if (p.finalQuality !== p.sub.quality)
          await createNotification(p.sub.user_id, "classification", `${p.sub.id}: ${p.finalQuality}`, `Klasifikasi diperbarui dari ${p.sub.quality} menjadi ${p.finalQuality}.`);
        if (["Diterima", "Ditolak"].includes(p.finalStage) && p.sub.stage !== p.finalStage)
          await createNotification(p.sub.user_id, "final", `${p.sub.id} ${p.finalStage}`, p.finalStage === "Diterima" ? `Pengajuan diterima. Saldo bertambah Rp${p.paid.toLocaleString("id-ID")}.` : "Pengajuan ditolak admin.");
        updated.push(row);
      }
      return res.status(200).json({ ok: true, updated: updated.map((r) => r.id) });
    }
    if (req.method === "POST" && action === "admin-member-state") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      const state = String(body.state || "");
      if (!["Menunggu", "Aktif", "Nonaktif"].includes(state)) return bad(res, 400, "Status anggota tidak valid.");
      const reason = String(body.reason || "").trim();
      const target = await updateUserState(String(body.user_id || ""), state, reason);
      if (!target) return bad(res, 404, "Anggota tidak ditemukan (atau target adalah akun admin).");
      // Jejak persetujuan: updated_at + admin_reason anggota berubah di
      // database, dan anggota menerima notifikasi tentang keputusan ini.
      if (state === "Aktif")
        await createNotification(target.id, "member-state", "Akunmu disetujui", "Admin menyetujui pendaftaranmu. Kamu sekarang bisa setor dan menarik saldo.");
      else if (state === "Nonaktif")
        await createNotification(target.id, "member-state", "Akun dinonaktifkan", "Admin menonaktifkan akunmu. Setor dan penarikan ditutup sampai diaktifkan lagi." + (reason ? ` Alasan admin: ${reason}` : ""));
      else
        await createNotification(target.id, "member-state", "Pendaftaran masih menunggu", "Pendaftaranmu masih menunggu persetujuan admin.");
      return res.status(200).json({ ok: true, member: adminUser(target) });
    }
    if (req.method === "POST" && action === "admin-withdrawal-decide") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      const decision = String(body.decision || "");
      if (!["Selesai", "Ditolak"].includes(decision)) return bad(res, 400, "Keputusan harus Selesai atau Ditolak.");
      const wd = await decideWithdrawal(String(body.id || ""), decision);
      if (!wd) return bad(res, 409, "Penarikan sudah diputuskan sebelumnya atau tidak ditemukan.");
      return res.status(200).json({ ok: true, withdrawal: wd });
    }
    if (req.method === "POST" && action === "admin-referral-decide") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      const decision = String(body.decision || "");
      if (!["Dibayarkan", "Ditolak"].includes(decision)) return bad(res, 400, "Keputusan harus Dibayarkan atau Ditolak.");
      const claim = await decideReferralClaim(String(body.id || ""), decision);
      if (!claim) return bad(res, 409, "Klaim sudah diputuskan sebelumnya atau tidak ditemukan.");
      return res.status(200).json({ ok: true, claim });
    }
    if (req.method === "POST" && action === "admin-settings") {
      if (!(await getAdmin(req))) return bad(res, 401, "Belum login sebagai admin.");
      const current = await getSettings();
      const v = validateSettings(body.settings || body, current);
      if (v.error) return bad(res, 400, v.error);
      const prevOpen = current.store_open;
      const saved = await setSettings(v.settings);
      if (prevOpen !== v.settings.store_open) {
        await notifyAllActiveMembers(
          "store",
          v.settings.store_open ? "Setoran dibuka" : "Setoran ditutup",
          v.settings.store_open ? "Admin membuka layanan pengajuan." : "Admin menutup layanan pengajuan untuk sementara.",
        );
      }
      return res.status(200).json({ ok: true, settings: publicSettings(saved) });
    }

    return bad(res, 404, "Aksi tidak ditemukan.");
  } catch (e) {
    if (isDbDown(e)) return bad(res, 503, DB_DOWN);
    console.error(e);
    return bad(res, 500, "Terjadi kesalahan di server. Coba lagi nanti.");
  }
}
