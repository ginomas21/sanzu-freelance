// SanzuFreelance — dashboard admin.
// Tampilan ini mengikuti file demo admin (SanzuFreelance_Web_Dasboard_Admin):
// layout sidebar + topbar + mobile bar, urutan menu, label, kartu statistik,
// tabel pemeriksaan dengan checkbox massal + filter, panel Anggota/Penarikan/
// Referral, dan form Pengaturan dipertahankan. Yang diganti: data demo hardcode
// -> data dari /api, dan klik/tombol demo -> endpoint API. CSS-nya ada di
// admin.css (diambil dari file demo, tanpa baris import font yang rusak dan
// tanpa logo base64). Pengecualian yang disengaja: label "DATA SIMULASI"
// dihapus karena datanya sekarang nyata, dan tombol switcher Anggota/Admin
// dihapus karena peran dipisah lewat login (admin tidak bisa menyamar jadi
// anggota dari dashboard ini).
const $ = (s, el = document) => el.querySelector(s);
const money = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso)).replace(",", " •");
  } catch { return String(iso); }
};
const esc = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a4 4 0 0 1 0 7M18 15a6 6 0 0 1 4 6"/>',
  wallet: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M16 14h6v4h-6a2 2 0 0 1 0-4Z"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9c-4-1-6-4-4-6 2-2 4 1 4 6Zm0 0c4-1 6-4 4-6-2-2-4 1-4 6Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m10 2 1 2h2l1-2 3 2-.5 2.4 1.5 1.5L20.5 7 22 10l-2 1v2l2 1-1.5 3-2.5-.5-1.5 1.5L17 20.5 14 22l-1-2h-2l-1 2-3-1.5.5-2.5L6 16.5 3.5 17 2 14l2-1v-2l-2-1 1.5-3 2.5.5L7.5 6 7 3.5z"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  coins: '<circle cx="8" cy="9" r="6"/><path d="M8 6v6M5.5 8h5M13 8a6 6 0 1 1-2 11"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.2v.5"/>',
  store: '<path d="M4 7h16l-1.5 13h-13z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
};
const ico = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true">${ICON[name] || ICON.home}</svg>`;
const stageTag = (s) => `<span class="admin-tag ${s === "Diterima" ? "good" : s === "Ditolak" ? "bad" : s === "Menunggu" ? "wait" : s === "Diperiksa" ? "checking" : "processing"}">${esc(s)}</span>`;
const qualityTag = (s) => `<span class="admin-tag ${s === "Good" ? "good" : s === "Captcha" ? "wait" : "bad"}">${esc(s)}</span>`;
const memberStateTag = (s) => s === "Aktif" ? `<span class="admin-tag good">Aktif</span>` : s === "Menunggu" ? `<span class="admin-tag wait">Menunggu</span>` : `<span class="admin-tag bad">Nonaktif</span>`;
const adminTitle = (eyebrow, title, desc) => `<div class="admin-page-title"><div><div class="admin-eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div></div>`;
const adminGuide = (title, desc) => `<div class="admin-guide"><span class="guide-dot">${ico("info")}</span><div><strong>${title}</strong><p>${desc}</p></div></div>`;
const statCard = (title, val, desc, icon, kind = "") => `<div class="admin-stat ${kind}"><div class="admin-stat-head"><span>${title}</span><span class="admin-stat-ico">${ico(icon)}</span></div><strong>${val}</strong><small>${desc}</small></div>`;

async function api(action, opts = {}) {
  const r = await fetch(`/api?action=${action}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || `Gagal memuat (${r.status})`);
  return data;
}
function showToast(msg) {
  const root = $("#toast-root");
  root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  setTimeout(() => { if (root.firstChild) root.innerHTML = ""; }, 4200);
}
function showMsg(el, text, kind = "error") {
  if (!el) return;
  el.innerHTML = text ? `<div class="${kind === "ok" ? "okbox" : "error"}" style="margin:12px 0">${esc(text)}</div>` : "";
}
function openModal(html) {
  $("#modal-root").innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal admin-modal">${html}</div></div>`;
}
function closeModal() { $("#modal-root").innerHTML = ""; }

let tab = "home", admin = null;
let reviewMemberId = null, reviewQuery = "", reviewFilter = "Semua", picked = new Set();
let membersFilter = "Semua";
let settingsSection = "setoran";
const NAV = [
  ["home", "Beranda Admin", "home"], ["reviews", "Pemeriksaan", "clipboard"],
  ["members", "Anggota", "users"], ["withdrawals", "Penarikan", "wallet"],
  ["referral", "Referral", "gift"], ["settings", "Pengaturan", "settings"],
];
const STAGES = ["Menunggu", "Diperiksa", "Diproses", "Diterima", "Ditolak"];
const QUALITIES = ["Good", "Captcha", "Disabled / Verify"];

function renderShell() {
  $("#sidebar").innerHTML = `<div class="brand"><div><div class="brand-title">SanzuFreelance</div><div class="brand-sub">DIGITAL WORKSPACE</div></div></div><div class="side-label">MENU UTAMA</div>${NAV.map(([key, label, icon]) => `<button class="nav-item ${tab === key ? "active" : ""}" data-tab="${key}">${ico(icon)}<span>${label}</span></button>`).join("")}<div class="side-bottom"><div class="profile-chip"><div class="avatar avatar-default">${ico("user")}</div><div><div style="font-size:12px;font-weight:800">${esc(admin ? admin.display_name : "Admin")}</div><div class="tiny-muted">Administrator</div></div></div></div>`;
  $("#mobile-nav").innerHTML = NAV.map(([key, label, icon]) => `<button class="${tab === key ? "active" : ""}" data-tab="${key}">${ico(icon)}<span>${label}</span></button>`).join("");
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
  $("#top-heading").textContent = NAV.find(([k]) => k === tab)?.[1] || "Beranda";
}
function setTab(t) { tab = t; render(); }

async function render() {
  renderShell();
  const page = $("#page");
  try {
    if (tab === "home") {
      const [stats, subs, settings] = await Promise.all([api("admin-stats"), api("admin-submissions"), api("admin-settings")]);
      const latest = subs.submissions.slice(0, 4);
      page.innerHTML = `${adminTitle("PUSAT OPERASIONAL", "Selamat datang, Admin", "Semua pekerjaan penting hari ini tersedia dalam satu halaman.")}
        <div class="admin-stat-grid">
          ${statCard("Menunggu Pemeriksaan", stats.stats.waiting, "Perlu kamu tinjau", "clock", "violet")}
          ${statCard("Sedang Diperiksa", stats.stats.checking, "Pemeriksaan berlangsung", "clipboard", "blue")}
          ${statCard("Penarikan", stats.stats.payouts_waiting, "Menunggu transfer manual", "wallet", "cyan")}
          ${statCard("Pendaftaran Baru", stats.stats.new_members, "Butuh persetujuan", "users", "violet")}
        </div>
        <div class="admin-section-title"><div><h2>Mulai dari sini</h2><p>Urutan kerja yang paling praktis untuk operasional harian.</p></div></div>
        <div class="admin-action-grid">
          <button class="admin-action" data-go="reviews"><span class="admin-action-icon">${ico("clipboard")}</span><span><b>1. Periksa pengajuan</b><small>Pilih satu atau banyak entri sekaligus</small></span><span class="admin-action-arrow">→</span></button>
          <button class="admin-action" data-go="members"><span class="admin-action-icon">${ico("users")}</span><span><b>2. Setujui anggota</b><small>Tinjau siapa saja yang bisa mengakses</small></span><span class="admin-action-arrow">→</span></button>
          <button class="admin-action" data-go="withdrawals"><span class="admin-action-icon">${ico("wallet")}</span><span><b>3. Proses penarikan</b><small>Transfer manual lalu konfirmasi selesai</small></span><span class="admin-action-arrow">→</span></button>
          <button class="admin-action" data-go="settings"><span class="admin-action-icon">${ico("settings")}</span><span><b>4. Kelola tarif & aturan</b><small>Ubah harga dan batas pengajuan</small></span><span class="admin-action-arrow">→</span></button>
        </div>
        <div class="admin-two-col">
          <section class="admin-panel"><div class="admin-panel-head"><h2>Pengajuan terbaru</h2><button class="admin-text-btn" data-go="reviews">Lihat semua →</button></div><div class="admin-list">${latest.length ? latest.map((x) => `<div class="admin-list-row"><div><b>${esc(x.id)} <span class="admin-mini-name">· ${esc(x.member_name || "")}</span></b><small>${fmtDate(x.created_at)} WIB</small></div>${stageTag(x.stage)}</div>`).join("") : `<p class="admin-muted">Belum ada pengajuan.</p>`}</div></section>
          <section class="admin-panel"><div class="admin-panel-head"><h2>Informasi tarif aktif</h2></div><div class="admin-rate"><span>Room Good</span><strong>${money(settings.settings.rate_good)}</strong></div><div class="admin-rate"><span>Room Captcha</span><strong>${money(settings.settings.rate_captcha)}</strong></div><p class="admin-muted">Saldo anggota hanya bertambah setelah pengajuan berstatus Diterima.</p><button class="admin-outline" data-go="settings">Kelola tarif</button></section>
        </div>
        ${adminGuide("Tips operasional", "Mulailah dari antrean pemeriksaan, lalu lanjutkan ke penarikan dan pengelolaan anggota.")}`;
      page.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.go)));
    } else if (tab === "reviews") {
      await renderReviews(page);
    } else if (tab === "members") {
      const { members } = await api("admin-members");
      const waiting = members.filter((m) => m.state === "Menunggu").length;
      const shown = membersFilter === "Semua" ? members : members.filter((m) => m.state === membersFilter);
      page.innerHTML = `${adminTitle("KELOLA AKSES", "Manajemen Anggota", "Kamu memutuskan siapa yang boleh menggunakan SanzuFreelance.")}
        ${adminGuide("Akses berdasarkan persetujuan", "Pendaftar baru tidak bisa mengajukan pekerjaan sampai kamu mengaktifkan keanggotaannya. Persetujuan harus dijaga oleh sistem autentikasi dan database.")}
        <section class="admin-panel"><div class="admin-panel-head"><h2>Daftar Anggota</h2><span class="admin-count">${waiting} menunggu persetujuan</span></div>
        <div class="admin-controls"><label class="admin-filter-wrap">Status<select id="members-filter">${["Semua", "Menunggu", "Aktif", "Nonaktif"].map((s) => `<option ${membersFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select></label></div>
        <div class="admin-table-scroll"><table class="admin-data-table"><thead><tr><th>Anggota</th><th>Daftar</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>${shown.map((p) => `<tr><td><b>${esc(p.display_name)}</b><small>${esc(p.email)}</small>${p.admin_reason ? `<small style="color:#ffcf93">Alasan terakhir: ${esc(p.admin_reason)}</small>` : ""}</td><td>${fmtDate(p.created_at)}</td><td>${memberStateTag(p.state)}</td><td><button class="admin-small-btn" data-member="${p.id}">Kelola</button></td></tr>`).join("") || `<tr><td colspan="4" class="admin-empty">Tidak ada anggota sesuai filter.</td></tr>`}</tbody></table></div></section>`;
      $("#members-filter").addEventListener("change", (e) => { membersFilter = e.target.value; render(); });
      page.querySelectorAll("[data-member]").forEach((b) => b.addEventListener("click", () => openMemberModal(members.find((m) => m.id === b.dataset.member))));
    } else if (tab === "withdrawals") {
      const [{ withdrawals }, settings] = await Promise.all([api("admin-withdrawals"), api("admin-settings")]);
      const waiting = withdrawals.filter((x) => x.status === "Menunggu Transfer");
      const methods = ["DANA", "SeaBank"].filter((m) => m === "DANA" ? settings.settings.withdraw_dana : settings.settings.withdraw_seabank);
      page.innerHTML = `${adminTitle("PEMBAYARAN MANUAL", "Penarikan", "Kelola permintaan melalui DANA atau SeaBank, transfer manual, lalu konfirmasi pembayaran selesai.")}
        ${adminGuide("Aturan penarikan", "Saklar Penarikan memblokir pengajuan baru saat nonaktif. Permintaan yang sudah masuk dan riwayatnya tetap dapat ditinjau dan diproses. Setiap anggota hanya boleh memiliki satu penarikan aktif.")}
        <div class="admin-stat-grid admin-stat-three">
          ${statCard("Permintaan Menunggu", waiting.length, "Butuh tindakan admin", "clock", "violet")}
          ${statCard("Nominal Menunggu", money(waiting.reduce((s, x) => s + x.amount, 0)), "Total nominal permintaan", "wallet", "blue")}
          ${statCard("Penarikan Selesai", withdrawals.filter((x) => x.status === "Selesai").length, "Sudah dikonfirmasi", "check", "cyan")}
        </div>
        <section class="admin-panel"><div class="admin-panel-head"><h2>Daftar Penarikan</h2><div class="admin-payout-controls"><span class="admin-count">${settings.settings.withdraw_enabled ? `Aktif: ${methods.length ? methods.join(" & ") : "Belum ada metode"}` : "Penarikan Nonaktif"}</span><label class="admin-payout-switch" title="Aktifkan atau nonaktifkan pengajuan penarikan baru"><input type="checkbox" role="switch" ${settings.settings.withdraw_enabled ? "checked" : ""} id="wd-quick-toggle"><span class="admin-payout-track" aria-hidden="true"></span><span>${settings.settings.withdraw_enabled ? "Aktif" : "Nonaktif"}</span></label></div></div>
        ${!settings.settings.withdraw_enabled ? `<div class="admin-payout-off-note">Penarikan sedang NONAKTIF untuk anggota. Pengajuan baru ditutup sementara; permintaan sebelumnya tetap dapat diselesaikan oleh admin.</div>` : ""}
        <div class="admin-table-scroll"><table class="admin-data-table admin-withdraw-table"><thead><tr><th>ID & Tanggal</th><th>Anggota</th><th>Nomor Penarikan</th><th>Metode Penarikan</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${withdrawals.map((p) => `<tr><td><b>${esc(p.id)}</b><small>${fmtDate(p.created_at)} WIB</small></td><td><b>${esc(p.member_name || "")}</b><small>${esc(p.member_email || "")}</small></td><td><div class="admin-payout-destination"><span class="payout-number">${esc(p.number_snapshot)}</span><button type="button" class="admin-copy-payout" data-copy="${esc(p.number_snapshot)}" title="Salin nomor penarikan">Salin</button></div></td><td><span class="method-pill ${p.method === "SeaBank" ? "sea" : "dana"}">${esc(p.method)}</span></td><td><strong>${money(p.amount)}</strong></td><td>${p.status === "Selesai" ? `<span class="admin-tag good">Selesai</span>` : p.status === "Ditolak" ? `<span class="admin-tag bad">Ditolak</span>` : `<span class="admin-tag wait">Menunggu Transfer</span>`}</td><td><button class="admin-small-btn" data-wd="${p.id}">Detail</button></td></tr>`).join("") || `<tr><td colspan="7" class="admin-empty">Belum ada penarikan.</td></tr>`}</tbody></table></div>
        <div class="admin-soft-note" style="margin:15px 15px 0">WD adalah ID transaksi, bukan ID akun. Nama dan email berasal dari pendaftaran anggota. Hanya admin berizin yang dapat melihat dan menyalin nomor tujuan lengkap dari permintaan anggota.</div></section>`;
      $("#wd-quick-toggle").addEventListener("change", async (e) => {
        try { await api("admin-settings", { method: "POST", body: { settings: { withdraw_enabled: e.target.checked } } }); showToast(e.target.checked ? "Penarikan baru telah diaktifkan." : "Penarikan baru dinonaktifkan. Permintaan sebelumnya tetap dapat dikelola."); render(); }
        catch (err) { showToast(err.message); }
      });
      page.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); showToast("Nomor tujuan berhasil disalin."); }
        catch { showToast("Gagal menyalin otomatis. Salin manual dari tabel."); }
      }));
      page.querySelectorAll("[data-wd]").forEach((b) => b.addEventListener("click", () => openWithdrawalModal(withdrawals.find((w) => w.id === b.dataset.wd))));
    } else if (tab === "referral") {
      const ref = await api("admin-referrals");
      const settings = await api("admin-settings");
      const s = settings.settings;
      const waitingClaims = ref.claims.filter((c) => c.status === "Menunggu Konfirmasi").length;
      page.innerHTML = `${adminTitle("KELOLA KOMUNITAS", "Referral & Komunitas", "Atur satu kali bonus referral dan kelola tautan Telegram dari satu tempat.")}
        ${adminGuide("Aturan satu kali", "Hanya jumlah valid terjual yang benar-benar sudah dikonfirmasi admin dari semua anggota undangan yang dihitung. Klaim bonus hanya dapat dikonfirmasi satu kali dan disimpan sebagai transaksi di database.")}
        <div class="ref-admin-cols">
          <section class="admin-panel"><div class="admin-panel-head"><h2>Pengaturan Referral</h2><span class="admin-count">Diubah oleh admin</span></div>
            <div class="ref-admin-toggle"><label><input type="checkbox" id="ref-enabled" ${s.referral_enabled ? "checked" : ""}> Aktifkan program referral</label></div>
            <div class="admin-form-grid"><label>Target valid terjual dari anggota undangan<input class="field" id="ref-target" type="number" min="1" max="100000" value="${s.referral_target}"></label><label>Nominal bonus satu kali (Rp)<input class="field" id="ref-reward" type="number" min="0" value="${s.referral_reward}"></label></div>
            <label class="admin-field-label">Link grup Telegram<input class="field" id="ref-telegram-url" type="url" placeholder="https://t.me/grupkomunitas" value="${esc(s.telegram_url)}"></label>
            <p class="admin-muted">Kosongkan link bila tidak ada grup. Tautan dapat diganti kapan saja.</p>
            <button class="admin-primary" id="btn-ref-save">Simpan Pengaturan Referral</button></section>
          <section class="admin-panel"><div class="admin-panel-head"><h2>Ringkasan Program</h2></div>
            <div class="admin-rate"><span>Status</span><strong>${s.referral_enabled ? "Aktif" : "Nonaktif"}</strong></div>
            <div class="admin-rate"><span>Target</span><strong>${s.referral_target} valid terjual</strong></div>
            <div class="admin-rate"><span>Bonus sekali</span><strong>${money(s.referral_reward)}</strong></div>
            <div class="admin-rate"><span>Telegram</span><strong>${s.telegram_url ? "Aktif" : "Nonaktif"}</strong></div>
            <div class="admin-rate"><span>Menunggu bonus</span><strong>${waitingClaims} klaim</strong></div>
            <div class="admin-soft-note">Perhitungan otomatis dari status akhir Diterima per entri milik anggota yang terhubung ke kode undangan, bukan dari total submit atau penambahan manual.</div></section>
        </div>
        <section class="admin-panel"><div class="admin-panel-head"><div><h2>Pengawasan Bonus Referral</h2><p>Klaim yang masuk dari anggota, lalu konfirmasi atau tolak satu kali.</p></div></div>
          <div class="admin-table-scroll"><table class="admin-data-table"><thead><tr><th>Anggota</th><th>Kode</th><th>Progres</th><th>Status Klaim</th><th>Tindakan</th></tr></thead><tbody>${ref.progress.map((p) => {
            const claim = ref.claims.find((c) => c.user_id === p.id && c.status === "Menunggu Konfirmasi");
            const paid = ref.claims.find((c) => c.user_id === p.id && c.status === "Dibayarkan");
            return `<tr><td><b>${esc(p.display_name)}</b><small>${esc(p.email)}</small></td><td>${esc(p.referral_code || "-")}</td><td>${p.validSold} / ${s.referral_target}</td><td>${paid ? `<span class="admin-tag good">Dibayarkan</span>` : claim ? `<span class="admin-tag checking">Menunggu Konfirmasi</span>` : `<span class="admin-tag wait">Berjalan</span>`}</td><td>${claim ? `<button class="admin-small-btn" data-claim-ok="${claim.id}">Konfirmasi bonus</button> <button class="admin-small-btn" data-claim-no="${claim.id}">Tolak</button>` : paid ? "Selesai" : "Belum tercapai"}</td></tr>`;
          }).join("") || `<tr><td colspan="5" class="admin-empty">Belum ada anggota.</td></tr>`}</tbody></table></div>
          <p class="admin-muted">Tidak ada penambahan valid terjual secara manual: sistem menghitung dari pengajuan yang sudah final dan tercatat.</p></section>`;
      $("#btn-ref-save").addEventListener("click", async () => {
        try {
          await api("admin-settings", { method: "POST", body: { settings: {
            referral_enabled: $("#ref-enabled").checked,
            referral_target: Number($("#ref-target").value),
            referral_reward: Number($("#ref-reward").value),
            telegram_url: $("#ref-telegram-url").value.trim(),
          } } });
          showToast("Pengaturan referral diperbarui."); render();
        } catch (e) { showToast(e.message); }
      });
      page.querySelectorAll("[data-claim-ok]").forEach((b) => b.addEventListener("click", async () => { try { await api("admin-referral-decide", { method: "POST", body: { id: b.dataset.claimOk, decision: "Dibayarkan" } }); showToast("Bonus referral dikonfirmasi."); render(); } catch (e) { showToast(e.message); } }));
      page.querySelectorAll("[data-claim-no]").forEach((b) => b.addEventListener("click", async () => { try { await api("admin-referral-decide", { method: "POST", body: { id: b.dataset.claimNo, decision: "Ditolak" } }); showToast("Klaim referral ditolak."); render(); } catch (e) { showToast(e.message); } }));
    } else if (tab === "settings") {
      await renderSettings(page);
    }
  } catch (e) {
    page.innerHTML = `<div class="admin-panel"><p>${esc(e.message)}</p></div>`;
  }
}

async function renderReviews(page) {
  if (reviewMemberId) {
    // api() menyisipkan action mentah ke query string, jadi "&user_id=..."
    // terbaca server sebagai parameter terpisah yang sah.
    const [{ submissions }, { members }] = await Promise.all([
      api(`admin-submissions&user_id=${encodeURIComponent(reviewMemberId)}`),
      api("admin-members"),
    ]);
    const all = submissions;
    const q = reviewQuery.toLowerCase().trim();
    const matches = all.filter((x) => (reviewFilter === "Semua" || x.stage === reviewFilter) && (!q || `${x.id} ${x.email_address} ${x.quality} ${x.stage}`.toLowerCase().includes(q)));
    const found = members.find((m) => m.id === reviewMemberId);
    const member = found ? { name: found.display_name, email: found.email } : (all.length ? { name: all[0].member_name, email: all[0].member_email } : null);
    const stats = {
      total: all.length,
      waiting: all.filter((x) => x.stage === "Menunggu").length,
      in_process: all.filter((x) => ["Diperiksa", "Diproses"].includes(x.stage)).length,
      accepted: all.filter((x) => x.stage === "Diterima").length,
      rejected: all.filter((x) => x.stage === "Ditolak").length,
    };
    const selectedVisible = matches.filter((x) => picked.has(x.id)).length;
    page.innerHTML = `${adminTitle("PEMERIKSAAN PER ANGGOTA", "Setoran " + esc(member ? member.name : reviewMemberId), "Seluruh pengajuan pada halaman ini hanya milik satu anggota yang dipilih.")}
      <div class="review-member-path"><button class="admin-outline" id="btn-back">← Kembali ke Daftar Anggota</button><span>Daftar Anggota / <b>${esc(member ? member.name : "")}</b></span></div>
      <div class="review-owner-card"><span class="review-owner-avatar">${ico("user")}</span><div class="review-owner-identity"><strong>${esc(member ? member.name : "")}</strong><span>${esc(member ? member.email : "")}</span><small>ID Anggota: ${esc(reviewMemberId)}</small></div><div class="review-owner-count"><strong>${stats.total}</strong><span>Total setoran</span></div></div>
      <div class="review-mini-stats"><div><strong>${stats.waiting}</strong><span>Menunggu</span></div><div><strong>${stats.in_process}</strong><span>Dalam proses</span></div><div><strong>${stats.accepted}</strong><span>Diterima</span></div><div><strong>${stats.rejected}</strong><span>Ditolak</span></div></div>
      <section class="admin-panel"><div class="admin-panel-head admin-head-stack"><div><h2>Daftar email setoran ${esc(member ? member.name : "")}</h2><p>Setiap email merupakan satu entri, lengkap dengan kategori dan statusnya.</p></div><button class="admin-outline" id="btn-reset">Reset Filter</button></div>
      <div class="admin-controls"><label class="admin-search">${ico("search")}<input id="detail-search" value="${esc(reviewQuery)}" placeholder="Cari alamat email atau ID pengajuan..."></label><label class="admin-filter-wrap">Status<select id="detail-stage">${["Semua", ...STAGES].map((st) => `<option ${reviewFilter === st ? "selected" : ""}>${st}</option>`).join("")}</select></label></div>
      <div id="admin-review-body">
        <div class="admin-selection-bar"><div><strong>${picked.size} email dipilih</strong><span> · Hanya dari anggota ini</span></div><div class="admin-select-actions"><button class="admin-outline" id="btn-clear-pick">Batal pilih</button><button class="admin-primary" id="btn-bulk" ${picked.size ? "" : "disabled"}>Ubah Terpilih (${picked.size})</button></div></div>
        <div class="admin-table-scroll"><table class="admin-data-table review-emails-table"><thead><tr><th><input type="checkbox" id="pick-all" ${matches.length > 0 && selectedVisible === matches.length ? "checked" : ""}></th><th>Email Setoran / Waktu</th><th>Kategori</th><th>Status Proses</th><th>Aksi</th></tr></thead><tbody>${matches.map((e) => `<tr><td><input type="checkbox" data-pick="${e.id}" ${picked.has(e.id) ? "checked" : ""}></td><td><b class="review-email-name">${esc(e.email_address)}</b><small>${esc(e.id)} • ${fmtDate(e.created_at)} WIB</small></td><td>${qualityTag(e.quality)}</td><td>${stageTag(e.stage)}</td><td><button class="admin-small-btn" data-detail="${e.id}">Periksa / Ubah</button></td></tr>`).join("") || `<tr><td colspan="5" class="admin-empty">Tidak ada email sesuai filter untuk anggota ini.</td></tr>`}</tbody></table></div>
        <p class="admin-table-hint">Tiap email setoran memiliki ID transaksi dan terkait secara permanen dengan ID anggota. Pilihan massal tidak mencakup anggota lain.</p>
      </div></section>`;
    $("#btn-back").addEventListener("click", () => { picked.clear(); reviewMemberId = null; reviewQuery = ""; reviewFilter = "Semua"; render(); });
    $("#btn-reset").addEventListener("click", () => { picked.clear(); reviewQuery = ""; reviewFilter = "Semua"; render(); });
    $("#detail-search").addEventListener("input", (e) => { reviewQuery = e.target.value; render(); });
    $("#detail-stage").addEventListener("change", (e) => { reviewFilter = e.target.value; render(); });
    $("#btn-clear-pick").addEventListener("click", () => { picked.clear(); render(); });
    $("#btn-bulk").addEventListener("click", () => openBulkModal());
    $("#pick-all").addEventListener("change", (e) => { matches.forEach((m) => e.target.checked ? picked.add(m.id) : picked.delete(m.id)); render(); });
    page.querySelectorAll("[data-pick]").forEach((c) => c.addEventListener("change", (e) => { e.target.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick); render(); }));
    page.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => openDetailModal(all.find((x) => x.id === b.dataset.detail))));
    return;
  }
  const { people, totals } = await api("admin-review-people");
  const q = reviewQuery.toLowerCase().trim();
  const stageHas = (p, st) => st === "Semua" || (st === "Menunggu" && p.waiting > 0) || (["Diperiksa", "Diproses"].includes(st) && p.in_process > 0) || (st === "Diterima" && p.accepted > 0) || (st === "Ditolak" && p.rejected > 0);
  const shown = people.filter((p) => stageHas(p, reviewFilter) && (!q || `${p.display_name} ${p.id} ${p.email}`.toLowerCase().includes(q)));
  page.innerHTML = `${adminTitle("MANAJEMEN PENGAJUAN", "Pemeriksaan per Anggota", "Pilih nama atau ID anggota terlebih dahulu. Daftar setoran mereka akan terbuka secara terpisah.")}
    ${adminGuide("Alur pemeriksaan", "1. Cari dan pilih anggota. 2. Lihat email yang hanya dikirim anggota tersebut. 3. Periksa satu per satu atau pilih banyak sekaligus. Status dan riwayat tersimpan per email di database.")}
    <div class="admin-stat-grid admin-stat-three">
      ${statCard("Anggota dengan Setoran", totals.members_with_submissions, "Sumber data terhubung ke ID anggota", "users", "blue")}
      ${statCard("Total Email Diajukan", totals.total_submissions, "Seluruh entri", "clipboard", "violet")}
      ${statCard("Menunggu Pemeriksaan", totals.waiting, "Seluruh anggota", "clock", "cyan")}
    </div>
    <section class="admin-panel"><div class="admin-panel-head admin-head-stack"><div><h2>Daftar Anggota</h2><p>Pilih anggota untuk membuka setoran miliknya saja.</p></div><button class="admin-outline" id="btn-reset">Reset Filter</button></div>
    <div class="admin-controls"><label class="admin-search">${ico("search")}<input id="review-search" value="${esc(reviewQuery)}" placeholder="Cari nama, ID anggota, atau email pendaftaran..."></label><label class="admin-filter-wrap">Status setoran<select id="review-stage">${["Semua", ...STAGES].map((st) => `<option ${reviewFilter === st ? "selected" : ""}>${st}</option>`).join("")}</select></label></div>
    <div id="admin-review-body"><div class="admin-table-scroll"><table class="admin-data-table review-people-table"><thead><tr><th>Anggota / ID</th><th>Jumlah Setoran</th><th>Menunggu</th><th>Diterima</th><th>Ditolak</th><th>Aksi</th></tr></thead><tbody>${shown.map((p) => `<tr><td><div class="review-person-name">${ico("user")}<div><b>${esc(p.display_name)}</b><small>${esc(p.id)} • ${esc(p.email)}</small></div></div></td><td><b>${p.total} email</b></td><td>${p.waiting ? stageTag("Menunggu") + " <small>" + p.waiting + " email</small>" : `<span class="muted">—</span>`}</td><td><span class="review-count-good">${p.accepted}</span></td><td><span class="review-count-bad">${p.rejected}</span></td><td><button class="admin-primary review-open-btn" data-person="${p.id}">Lihat Setoran ${ico("arrow")}</button></td></tr>`).join("") || `<tr><td colspan="6" class="admin-empty">Tidak ada anggota sesuai pencarian.</td></tr>`}</tbody></table></div>
    <p class="admin-table-hint">Setoran yang belum ada akan tampil sebagai 0. Anggota diidentifikasi berdasarkan ID akun, bukan nama yang diketik sendiri.</p></div></section>`;
  $("#btn-reset").addEventListener("click", () => { picked.clear(); reviewQuery = ""; reviewFilter = "Semua"; render(); });
  $("#review-search").addEventListener("input", (e) => { reviewQuery = e.target.value; render(); });
  $("#review-stage").addEventListener("change", (e) => { reviewFilter = e.target.value; render(); });
  page.querySelectorAll("[data-person]").forEach((b) => b.addEventListener("click", () => { picked.clear(); reviewMemberId = b.dataset.person; reviewQuery = ""; reviewFilter = "Semua"; render(); }));
}

function openDetailModal(r) {
  openModal(`<div class="admin-modal-head"><div><span class="admin-eyebrow">DETAIL PENGAJUAN</span><h2>${esc(r.email_address)}</h2><p>${esc(r.id)} · ${esc(r.member_name || "")} · ${fmtDate(r.created_at)} WIB</p></div><button class="ghost-icon" onclick="closeModal()">${ico("close")}</button></div>
    <div class="admin-mini-info"><div><small>Status saat ini</small>${stageTag(r.stage)}</div><div><small>Kategori sekarang</small>${qualityTag(r.quality)}</div></div>
    <div class="admin-modal-form"><label>Kategori hasil pemeriksaan<select class="field" id="adm-quality">${QUALITIES.map((q) => `<option ${r.quality === q ? "selected" : ""}>${q}</option>`).join("")}</select></label><label>Status proses<select class="field" id="adm-stage">${STAGES.map((st) => `<option ${r.stage === st ? "selected" : ""}>${st}</option>`).join("")}</select></label><label>Catatan / alasan perubahan<textarea class="field" id="adm-reason" rows="3" placeholder="Contoh: status diperbarui setelah pemeriksaan.">${esc(r.admin_note || "")}</textarea></label></div>
    <div class="admin-soft-note">Saldo dihitung hanya saat pengajuan dinyatakan Diterima. Perubahan tersimpan di database dan anggota menerima notifikasi.</div>
    <div class="admin-modal-actions"><button class="admin-outline" onclick="closeModal()">Batal</button><button class="admin-primary" id="btn-save-detail">Simpan Perubahan</button></div>`);
  $("#btn-save-detail").addEventListener("click", async () => {
    const quality = $("#adm-quality").value, stage = $("#adm-stage").value, note = $("#adm-reason").value.trim();
    if (quality === "Disabled / Verify" && stage === "Diterima") { showToast("Kategori Disabled / Verify tidak bisa diterima."); return; }
    if (stage === "Ditolak" && !note) { showToast("Isi alasan perubahan atau penolakan."); return; }
    try {
      await api("admin-review", { method: "POST", body: { ids: [r.id], stage, quality, admin_note: note } });
      closeModal(); showToast(`${r.id} berhasil diperbarui.`); render();
    } catch (e) { showToast(e.message); }
  });
}
function openBulkModal() {
  if (!picked.size) { showToast("Pilih entri terlebih dahulu."); return; }
  openModal(`<div class="admin-modal-head"><div><span class="admin-eyebrow">TINDAKAN MASSAL</span><h2>Ubah ${picked.size} pengajuan</h2><p>Perubahan berlaku untuk item yang kamu centang.</p></div><button class="ghost-icon" onclick="closeModal()">${ico("close")}</button></div>
    <div class="admin-modal-form"><label>Ubah status proses<select id="adm-bulk-stage" class="field"><option value="">Jangan ubah status</option>${STAGES.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Ubah kategori<select id="adm-bulk-quality" class="field"><option value="">Jangan ubah kategori</option>${QUALITIES.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Catatan / alasan tindakan massal<textarea id="adm-bulk-note" class="field" rows="3" placeholder="Alasan yang berlaku untuk seluruh item terpilih..."></textarea></label></div>
    <div class="admin-soft-note">Perubahan disimpan ke database; saldo anggota dihitung dari pengajuan Diterima.</div>
    <div class="admin-modal-actions"><button class="admin-outline" onclick="closeModal()">Batal</button><button class="admin-primary" id="btn-apply-bulk">Konfirmasi Perubahan</button></div>`);
  $("#btn-apply-bulk").addEventListener("click", async () => {
    const stage = $("#adm-bulk-stage").value, quality = $("#adm-bulk-quality").value, note = $("#adm-bulk-note").value.trim();
    if (!stage && !quality) { showToast("Pilih status atau kategori yang ingin diubah."); return; }
    if ((stage === "Ditolak" || stage === "Diterima" || quality === "Disabled / Verify") && !note) { showToast("Tulis alasan untuk perubahan ini."); return; }
    try {
      const body = { ids: [...picked], admin_note: note };
      if (stage) body.stage = stage;
      if (quality) body.quality = quality;
      await api("admin-review", { method: "POST", body });
      picked.clear(); closeModal(); showToast("Perubahan massal tersimpan."); render();
    } catch (e) { showToast(e.message); }
  });
}
function memberActionsFor(state) {
  return state === "Menunggu" ? ["Terima", "Tolak", "Nonaktifkan pengguna"] : ["Nonaktifkan pengguna", "Aktifkan pengguna"];
}
function memberActionToState(action) {
  if (action === "Terima" || action === "Aktifkan pengguna") return "Aktif";
  if (action === "Nonaktifkan pengguna" || action === "Tolak") return "Nonaktif";
  return "Menunggu";
}
function memberDefaultAction(state) {
  if (state === "Menunggu") return "Terima";
  if (state === "Aktif") return "Nonaktifkan pengguna";
  return "Aktifkan pengguna";
}
function openMemberModal(p) {
  const opts = memberActionsFor(p.state);
  const chosen = memberDefaultAction(p.state);
  const needReason = (a) => a === "Nonaktifkan pengguna" || a === "Tolak";
  openModal(`<div class="admin-modal-head"><div><span class="admin-eyebrow">DATA ANGGOTA</span><h2>${esc(p.display_name)}</h2><p>${esc(p.email)}</p></div><button class="ghost-icon" onclick="closeModal()">${ico("close")}</button></div>
    <div class="admin-mini-info"><div><small>Status saat ini</small><strong>${esc(p.state)}</strong></div><div><small>Tanggal daftar</small><strong>${fmtDate(p.created_at)}</strong></div></div>
    <div class="admin-modal-form"><label>Status keanggotaan<select class="field" id="member-next">${opts.map((x) => `<option ${x === chosen ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <div id="member-reason-wrap" style="display:${needReason(chosen) ? "block" : "none"}"><label>Alasan (opsional)<textarea class="field" id="member-reason" rows="3" placeholder="Contoh: kamu sudah aktif, banyak storanmu bermasalah."></textarea></label></div></div>
    ${p.admin_reason ? `<div class="admin-soft-note">Alasan terakhir tersimpan: <b>${esc(p.admin_reason)}</b></div>` : ""}
    <div class="admin-modal-actions"><button class="admin-outline" onclick="closeModal()">Batal</button><button class="admin-primary" id="btn-save-member">Simpan Status</button></div>`);
  $("#member-next").addEventListener("change", (e) => { $("#member-reason-wrap").style.display = needReason(e.target.value) ? "block" : "none"; });
  $("#btn-save-member").addEventListener("click", async () => {
    const action = $("#member-next").value;
    const reason = $("#member-reason") ? $("#member-reason").value.trim() : "";
    try {
      await api("admin-member-state", { method: "POST", body: { user_id: p.id, state: memberActionToState(action), reason } });
      closeModal(); showToast(`Keanggotaan ${p.display_name} diubah menjadi ${memberActionToState(action)}${reason ? ` • Alasan: ${reason}` : ""}.`); render();
    } catch (e) { showToast(e.message); }
  });
}
function openWithdrawalModal(w) {
  openModal(`<div class="admin-modal-head"><div><span class="admin-eyebrow">DETAIL PENARIKAN</span><h2>${esc(w.id)}</h2><p>${esc(w.member_name || "")} • ${esc(w.member_email || "")} • ${fmtDate(w.created_at)}</p></div><button class="ghost-icon" onclick="closeModal()">${ico("close")}</button></div>
    <div class="admin-payout-summary"><span>Nominal Pengajuan</span><strong>${money(w.amount)}</strong><small>Metode penarikan: ${esc(w.method)}</small></div>
    <div class="admin-payout-destination-detail"><div><small>${w.method === "SeaBank" ? "Nomor Rekening SeaBank" : "Nomor DANA"} — lengkap</small><strong class="payout-full-number">${esc(w.number_snapshot)}</strong><small>Nama anggota terdaftar: ${esc(w.member_name || "")}</small></div><button class="admin-primary" type="button" id="btn-copy-wd">${ico("clipboard")} Salin Nomor</button></div>
    <div class="admin-mini-info" style="margin-top:12px"><div><small>Biaya admin saat pengajuan</small><strong>${money(w.fee)}</strong></div><div><small>Bersih diterima</small><strong>${money(w.net)}</strong></div></div>
    <div class="admin-soft-note">Status: <b>${esc(w.status)}</b>. Nominal dan biaya tersimpan untuk transaksi ini. Jangan konfirmasi selesai sebelum transfer benar-benar berhasil.</div>
    ${w.status === "Menunggu Transfer" ? `<div class="admin-modal-form"><label><input id="pay-confirm-check" type="checkbox"> Saya sudah melakukan transfer manual ke tujuan yang benar.</label></div><div class="admin-modal-actions"><button class="admin-outline" id="btn-reject-wd">Tolak Pengajuan</button><button class="admin-primary" id="btn-finish-wd">Konfirmasi Transfer Selesai</button></div>` : `<div class="admin-modal-actions"><button class="admin-outline" onclick="closeModal()">Tutup</button></div>`}`);
  $("#btn-copy-wd").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(w.number_snapshot); showToast("Nomor tujuan berhasil disalin."); }
    catch { showToast("Gagal menyalin otomatis. Salin manual dari detail."); }
  });
  const finish = $("#btn-finish-wd");
  if (finish) finish.addEventListener("click", async () => {
    if (!$("#pay-confirm-check")?.checked) { showToast("Centang konfirmasi transfer manual terlebih dahulu."); return; }
    try { await api("admin-withdrawal-decide", { method: "POST", body: { id: w.id, decision: "Selesai" } }); closeModal(); showToast(`${w.id}: Selesai.`); render(); }
    catch (e) { showToast(e.message); }
  });
  const reject = $("#btn-reject-wd");
  if (reject) reject.addEventListener("click", async () => {
    try { await api("admin-withdrawal-decide", { method: "POST", body: { id: w.id, decision: "Ditolak" } }); closeModal(); showToast(`${w.id} ditolak. Dana tertahan dilepas.`); render(); }
    catch (e) { showToast(e.message); }
  });
}
async function renderSettings(page) {
  const { settings: s } = await api("admin-settings");
  let content = "";
  if (settingsSection === "setoran") {
    content = `<section class="admin-panel settings-content-panel"><div class="settings-panel-heading"><span class="settings-panel-icon">${ico("clipboard")}</span><div><h2>Kontrol Penerimaan Setoran</h2><p>Atur apakah anggota bisa mengirim pengajuan baru.</p></div></div>
      <label class="settings-switch-row"><div><strong>Terima pengajuan baru</strong><small>Jika ditutup, anggota tidak bisa menggunakan tombol Kirim. Anggota yang berlangganan akan menerima pemberitahuan.</small></div><input type="checkbox" id="adm-store-open" ${s.store_open ? "checked" : ""}></label>
      <div class="admin-soft-note">Setoran yang sudah masuk tetap ada dan bisa diperiksa meskipun layanan sedang ditutup.</div>
      <div class="settings-panel-footer"><button class="admin-primary" id="btn-save-store">Simpan Status Setoran</button></div></section>`;
  } else if (settingsSection === "tarif") {
    content = `<section class="admin-panel settings-content-panel"><div class="settings-panel-heading"><span class="settings-panel-icon">${ico("settings")}</span><div><h2>Tarif & Batas Harian</h2><p>Ubah harga kategori dan jumlah entri maksimal per anggota.</p></div></div>
      <div class="admin-form-grid settings-neat-fields"><label>Tarif Room Good (Rp)<input class="field" id="rate-good" type="number" min="0" value="${s.rate_good}"></label><label>Tarif Room Captcha (Rp)<input class="field" id="rate-captcha" type="number" min="0" value="${s.rate_captcha}"></label></div>
      <label class="admin-field-label settings-long-field">Batas entri per anggota per hari<input class="field" id="rate-limit" type="number" min="1" max="1000" value="${s.daily_limit}"></label>
      <div class="admin-soft-note">Perubahan tarif hanya berlaku untuk setoran yang disetujui setelah pengaturan baru disimpan. Penghasilan lama tidak dihitung ulang.</div>
      <div class="settings-panel-footer"><button class="admin-primary" id="btn-save-tariff">Simpan Tarif & Batas</button></div></section>`;
  } else {
    content = `<section class="admin-panel settings-content-panel"><div class="settings-panel-heading"><span class="settings-panel-icon">${ico("wallet")}</span><div><h2>Metode Penarikan & Biaya Admin</h2><p>Kelola seluruh penarikan dan biaya per metode pembayaran.</p></div></div>
      <label class="settings-switch-row"><div><strong>Aktifkan pengajuan penarikan</strong><small>Saklar utama. Jika nonaktif, permintaan penarikan baru ditutup; riwayat dan pengajuan lama tetap dapat dikelola.</small></div><input type="checkbox" id="wd-global" ${s.withdraw_enabled ? "checked" : ""}></label>
      <div class="settings-payment-grid">
        <div class="settings-method-card"><label class="settings-method-title"><span>Metode DANA</span><span><input type="checkbox" id="wd-dana" ${s.withdraw_dana ? "checked" : ""}> Aktif</span></label><div class="settings-fee-fields"><label>Biaya Rp50.000–Rp100.000<input class="field" id="fee-dana-1" type="number" min="0" value="${s.fee_dana_tier1}"></label><label>Biaya di atas Rp100.000<input class="field" id="fee-dana-2" type="number" min="0" value="${s.fee_dana_tier2}"></label></div></div>
        <div class="settings-method-card"><label class="settings-method-title"><span>Metode SeaBank</span><span><input type="checkbox" id="wd-seabank" ${s.withdraw_seabank ? "checked" : ""}> Aktif</span></label><div class="settings-fee-fields"><label>Biaya Rp50.000–Rp100.000<input class="field" id="fee-seabank-1" type="number" min="0" value="${s.fee_seabank_tier1}"></label><label>Biaya di atas Rp100.000<input class="field" id="fee-seabank-2" type="number" min="0" value="${s.fee_seabank_tier2}"></label></div></div>
      </div>
      <div class="admin-soft-note">Isi 0 untuk gratis biaya admin. Biaya untuk nominal di bawah Rp50.000 adalah Rp0. Biaya harus terlihat sebelum anggota mengirim penarikan.</div>
      <div class="settings-panel-footer"><button class="admin-primary" id="btn-save-payout">Simpan Pengaturan Penarikan</button></div></section>`;
  }
  const tabs = [["setoran", "Setoran", "store"], ["tarif", "Tarif & Batas", "coins"], ["penarikan", "Penarikan", "wallet"]];
  page.innerHTML = `${adminTitle("KONFIGURASI", "Pengaturan Sistem", "Pengaturan dibagi per bagian agar lebih mudah dan tidak perlu mengisi semuanya sekaligus.")}
    <div class="settings-layout"><div class="settings-main"><div class="settings-tabbar" role="tablist" aria-label="Bagian pengaturan">${tabs.map(([id, label, icon]) => `<button role="tab" aria-selected="${settingsSection === id}" class="settings-tab ${settingsSection === id ? "is-active" : ""}" data-sec="${id}">${ico(icon)} ${label}</button>`).join("")}</div>${content}</div>
    <aside class="settings-summary"><section class="admin-panel"><div class="admin-panel-head"><h2>Ringkasan Sistem</h2><span class="admin-count">Status saat ini</span></div>
      <div class="admin-rate"><span>Setoran Anggota</span><strong>${s.store_open ? "Dibuka" : "Ditutup"}</strong></div>
      <div class="admin-rate"><span>Room Good</span><strong>${money(s.rate_good)}</strong></div>
      <div class="admin-rate"><span>Room Captcha</span><strong>${money(s.rate_captcha)}</strong></div>
      <div class="admin-rate"><span>Limit per Hari</span><strong>${s.daily_limit} entri</strong></div>
      <div class="admin-rate"><span>Pengajuan Penarikan</span><strong>${s.withdraw_enabled ? "Aktif" : "Nonaktif"}</strong></div>
      <div class="admin-rate"><span>DANA</span><strong>${s.withdraw_dana ? "Aktif" : "Nonaktif"}</strong></div>
      <div class="admin-rate"><span>SeaBank</span><strong>${s.withdraw_seabank ? "Aktif" : "Nonaktif"}</strong></div>
      <div class="settings-summary-link"><button class="admin-outline" data-go="referral">Atur Referral & Telegram ${ico("arrow")}</button></div></section>
      <div class="admin-soft-note">Kamu bisa mengatur masing-masing bagian secara terpisah. Perubahan tersimpan di database.</div></aside></div>`;
  page.querySelectorAll("[data-sec]").forEach((b) => b.addEventListener("click", () => { settingsSection = b.dataset.sec; render(); }));
  const goRef = page.querySelector("[data-go]");
  if (goRef) goRef.addEventListener("click", () => setTab("referral"));
  const saveStore = $("#btn-save-store");
  if (saveStore) saveStore.addEventListener("click", async () => {
    try { await api("admin-settings", { method: "POST", body: { settings: { store_open: $("#adm-store-open").checked } } }); showToast("Status penerimaan setoran diperbarui."); render(); }
    catch (e) { showToast(e.message); }
  });
  const saveTariff = $("#btn-save-tariff");
  if (saveTariff) saveTariff.addEventListener("click", async () => {
    try { await api("admin-settings", { method: "POST", body: { settings: { rate_good: Number($("#rate-good").value), rate_captcha: Number($("#rate-captcha").value), daily_limit: Number($("#rate-limit").value) } } }); showToast("Tarif & batas diperbarui."); render(); }
    catch (e) { showToast(e.message); }
  });
  const savePayout = $("#btn-save-payout");
  if (savePayout) savePayout.addEventListener("click", async () => {
    try { await api("admin-settings", { method: "POST", body: { settings: {
      withdraw_enabled: $("#wd-global").checked, withdraw_dana: $("#wd-dana").checked, withdraw_seabank: $("#wd-seabank").checked,
      fee_dana_tier1: Number($("#fee-dana-1").value), fee_dana_tier2: Number($("#fee-dana-2").value),
      fee_seabank_tier1: Number($("#fee-seabank-1").value), fee_seabank_tier2: Number($("#fee-seabank-2").value),
    } } }); showToast("Pengaturan penarikan diperbarui."); render(); }
    catch (e) { showToast(e.message); }
  });
}

async function boot() {
  try {
    // Bukti login admin: admin-settings hanya bisa dibuka sesi admin.
    await api("admin-settings");
    // Nama admin sudah diisi dari respons admin-login bila boot dipanggil
    // sesudah login; bila sesi lama, tampilkan label generik.
    if (!admin) admin = { display_name: "Admin" };
    $("#login-view").style.display = "none";
    $("#app-view").style.display = "flex";
    render();
  } catch {
    $("#login-view").style.display = "block";
    $("#app-view").style.display = "none";
  }
}
$("#admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("admin-login", { method: "POST", body: { email: $("#admin-email").value, password: $("#admin-password").value } });
    admin = r.admin; boot();
  } catch (err) { showMsg($("#login-msg"), err.message); }
});
$("#admin-setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("admin-setup", { method: "POST", body: {
      admin_key: $("#setup-key").value, display_name: $("#setup-name").value,
      email: $("#setup-email").value, password: $("#setup-password").value,
    } });
    showMsg($("#setup-msg"), r.message + " Sekarang masuk lewat form di atas.", "ok");
    $("#setup-key").value = ""; $("#setup-password").value = "";
  } catch (err) { showMsg($("#setup-msg"), err.message); }
});
$("#btn-logout").addEventListener("click", async () => {
  try { await api("admin-logout", { method: "POST", body: {} }); } catch {}
  location.reload();
});
boot();
