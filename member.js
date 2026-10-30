// SanzuFreelance — frontend anggota (tanpa data hardcode; semua dari /api).
const $ = (s, el = document) => el.querySelector(s);
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso)).replace(",", " •") + " WIB";
  } catch { return String(iso); }
};
const esc = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const badge = (s) => {
  const k = { Diterima: "green", Good: "green", Captcha: "amber", Menunggu: "amber", Diperiksa: "blue", Diproses: "purple", Ditolak: "red", "Disabled / Verify": "red", "Menunggu Transfer": "amber", Selesai: "green", "Menunggu Konfirmasi": "amber", Dibayarkan: "green" }[s] || "blue";
  return `<span class="badge ${k}">${esc(s)}</span>`;
};
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
function showMsg(el, text, kind = "error") {
  el.innerHTML = text ? `<div class="${kind === "ok" ? "okbox" : kind === "notice" ? "notice" : "error"}">${esc(text)}</div>` : "";
}

let tab = "home", me = null, settings = null, room = "Good";
const NAV = [
  ["home", "Beranda"], ["submit", "Pengajuan"], ["history", "Riwayat"],
  ["referral", "Referral"], ["profile", "Profil"],
];
function renderNav() {
  $("#side-nav").innerHTML = NAV.map(([k, l]) => `<button class="nav-item ${tab === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("");
  $("#mobile-nav").innerHTML = NAV.map(([k, l]) => `<button class="${tab === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("");
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
  $("#top-heading").textContent = NAV.find(([k]) => k === tab)?.[1] || "Beranda";
  $("#side-user").innerHTML = me ? `<strong style="color:#e1e9ff">${esc(me.user.display_name)}</strong><br>${esc(me.user.email)}` : "";
  $("#top-state").textContent = me ? `Status: ${me.user.state}` : "";
}
function submissionRow(s) {
  return `<tr><td><strong>${esc(s.id)}</strong></td><td>${esc(s.room)}</td><td>${esc(s.email_address)}</td><td>${badge(s.quality)}</td><td>${badge(s.stage)}</td><td>${s.stage === "Diterima" ? rupiah(s.paid_rate) : "—"}</td><td>${fmtDate(s.created_at)}</td></tr>`;
}
async function render() {
  renderNav();
  const page = $("#page");
  try {
    if (tab === "home") {
      const subs = await api("submissions");
      const latest = subs.submissions.slice(0, 5);
      page.innerHTML = `
        ${me.user.state !== "Aktif" ? `<div class="notice">${me.user.state === "Menunggu" ? "Akunmu masih menunggu persetujuan admin." : "Akunmu dinonaktifkan admin."} Setor dan penarikan dibuka setelah admin menyetujui akunmu.</div>` : ""}
        ${!settings.store_open ? `<div class="notice">Setoran sedang ditutup admin.</div>` : ""}
        <section class="hero"><div class="intro">SALDO TERSEDIA</div><div class="money">${rupiah(me.balance)}</div>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn btn-primary" data-go="withdraw">Tarik Saldo</button>
            <button class="btn btn-secondary" data-go="submit">Buat Pengajuan</button>
          </div></section>
        <section class="rooms" style="margin-top:16px">
          <div class="room"><h3 style="margin:0">Good</h3><div class="room-price">${rupiah(settings.rate_good)} <small>/ diterima</small></div><p class="room-desc">Setelah mengisi email, langkah berikutnya langsung mengarah ke kolom password.</p></div>
          <div class="room"><h3 style="margin:0">Captcha</h3><div class="room-price">${rupiah(settings.rate_captcha)} <small>/ diterima</small></div><p class="room-desc">Setelah mengisi email, langkah berikutnya terkena verifikasi “anda bukan robot”.</p></div>
        </section>
        <div class="metrics">
          <div class="metric"><div class="m-label">Total Pengajuan</div><div class="m-val">${me.summary.total}</div></div>
          <div class="metric"><div class="m-label">Diterima</div><div class="m-val">${me.summary.accepted}</div></div>
          <div class="metric"><div class="m-label">Dalam Proses</div><div class="m-val">${me.summary.in_process}</div></div>
          <div class="metric"><div class="m-label">Ditolak</div><div class="m-val">${me.summary.rejected}</div></div>
        </div>
        <div class="section-head"><h2>Pengajuan Terakhir</h2><button class="btn btn-outline btn-sm" data-go="history">Lihat Riwayat</button></div>
        <div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Room</th><th>Email</th><th>Klasifikasi</th><th>Tahap</th><th>Bayaran</th><th>Tanggal</th></tr></thead><tbody>${latest.length ? latest.map(submissionRow).join("") : `<tr><td colspan="7" class="muted">Belum ada pengajuan.</td></tr>`}</tbody></table></div></div>
        ${settings.telegram_url ? `<div class="panel"><p style="margin:0">Grup komunitas: <a href="${esc(settings.telegram_url)}" target="_blank" rel="noopener">${esc(settings.telegram_url)}</a></p></div>` : ""}
        <div id="withdraw-box"></div>`;
      page.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
        if (b.dataset.go === "withdraw") openWithdraw(page);
        else { tab = "submit"; render(); }
      }));
    } else if (tab === "submit") {
      page.innerHTML = `
        <h2 style="margin-top:0">Buat Pengajuan</h2><p class="muted">Pilih room sesuai kondisi akun, lalu masukkan daftar alamat @gmail.com.</p>
        <div id="submit-msg"></div>
        <div class="panel">
          <div class="form-field"><label>Room</label><div class="pills">
            <button class="${room === "Good" ? "active" : ""}" data-room="Good">Room Good — ${rupiah(settings.rate_good)}</button>
            <button class="${room === "Captcha" ? "active" : ""}" data-room="Captcha">Room Captcha — ${rupiah(settings.rate_captcha)}</button>
          </div><p class="help">Harap stor dengan opsi yang valid, sesuai kondisi akun tersebut.</p></div>
          <div class="form-field"><label for="bulk">Storkan stokmu di bawah sini</label>
            <textarea class="field" id="bulk" placeholder="contoh1@gmail.com&#10;contoh2@gmail.com"></textarea>
            <div class="help" id="entry-count">Terbaca 0 entri · Maksimal 50 per pengajuan · Batas harian ${settings.daily_limit} · Hanya @gmail.com</div></div>
          <div class="form-field"><label for="note">Catatan untuk admin</label><textarea class="field" id="note" rows="2" placeholder="Catatan (jangan isi password / OTP / kode pemulihan)"></textarea></div>
          <button class="btn btn-primary" id="btn-submit" style="width:100%;justify-content:center">Kirim Pengajuan</button>
        </div>`;
      const bulk = $("#bulk"), countEl = $("#entry-count");
      const updateCount = () => {
        const list = bulk.value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
        countEl.textContent = `Terbaca ${list.length} entri · Maksimal 50 per pengajuan · Batas harian ${settings.daily_limit} · Hanya @gmail.com`;
      };
      bulk.addEventListener("input", updateCount);
      page.querySelectorAll("[data-room]").forEach((b) => b.addEventListener("click", () => { room = b.dataset.room; render(); }));
      $("#btn-submit").addEventListener("click", async () => {
        const emails = bulk.value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
        try {
          const r = await api("submit", { method: "POST", body: { room, emails, member_note: $("#note").value } });
          showMsg($("#submit-msg"), `Pengajuan terkirim: ${r.count} alamat (${r.ids.join(", ")}). Menunggu pemeriksaan admin.`, "ok");
          bulk.value = ""; $("#note").value = ""; updateCount();
        } catch (e) { showMsg($("#submit-msg"), e.message); }
      });
    } else if (tab === "history") {
      const subs = await api("submissions");
      page.innerHTML = `<h2 style="margin-top:0">Riwayat Pengajuan</h2><div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Room</th><th>Email</th><th>Klasifikasi</th><th>Tahap</th><th>Bayaran</th><th>Tanggal</th></tr></thead><tbody>${subs.submissions.length ? subs.submissions.map(submissionRow).join("") : `<tr><td colspan="7" class="muted">Belum ada pengajuan.</td></tr>`}</tbody></table></div></div>`;
    } else if (tab === "referral") {
      const ref = await api("referral");
      const eligible = ref.enabled && ref.validSold >= ref.target && !ref.claim;
      page.innerHTML = `
        <h2 style="margin-top:0">Referral</h2>
        <div id="ref-msg"></div>
        <div class="panel"><p class="muted" style="margin:0 0 8px">Kode referral kamu</p><h3 style="margin:0 0 10px">${esc(ref.code || "-")}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="field" id="ref-link" readonly value="${esc(ref.link)}" style="flex:1;min-width:220px"><button class="btn btn-secondary" id="btn-copy">Salin Link</button></div>
          <p class="help">Bagikan link ini. Penjualan valid dihitung dari pengajuan Diterima anggota yang kamu referensikan.</p>
          <div style="margin-top:14px"><div style="display:flex;justify-content:space-between"><span>Progress: ${ref.validSold}/${ref.target} penjualan valid</span><span>${ref.pct}%</span></div><div class="progress" style="margin-top:8px"><div style="width:${ref.pct}%"></div></div><p class="help">Reward: ${rupiah(ref.reward)} saat target tercapai dan dikonfirmasi admin.</p></div>
          ${ref.claim ? `<p>Status klaim: ${badge(ref.claim.status)}</p>` : ""}
          <button class="btn btn-primary" id="btn-claim" ${eligible ? "" : "disabled"}>Klaim Reward</button>
          ${!eligible ? `<p class="help">${!ref.enabled ? "Program referral sedang dinonaktifkan admin." : ref.claim ? "Klaim sudah ada / sudah dibayarkan." : "Klaim aktif setelah target tercapai."}</p>` : ""}</div>
        <div class="panel"><h3>Anggota yang kamu referensikan</h3><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Penjualan Valid</th></tr></thead><tbody>${ref.subordinates.length ? ref.subordinates.map((s) => `<tr><td>${esc(s.display_name)}</td><td>${esc(s.email)}</td><td>${s.validSold}</td></tr>`).join("") : `<tr><td colspan="3" class="muted">Belum ada.</td></tr>`}</tbody></table></div></div>`;
      $("#btn-copy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText($("#ref-link").value); showMsg($("#ref-msg"), "Link referral disalin.", "ok"); }
        catch { $("#ref-link").select(); showMsg($("#ref-msg"), "Link tidak bisa disalin otomatis — salin manual dari kolom di atas."); }
      });
      $("#btn-claim").addEventListener("click", async () => {
        try { await api("referral-claim", { method: "POST", body: {} }); showMsg($("#ref-msg"), "Klaim dikirim, menunggu konfirmasi admin.", "ok"); render(); }
        catch (e) { showMsg($("#ref-msg"), e.message); }
      });
    } else if (tab === "profile") {
      const notifs = await api("notifications");
      page.innerHTML = `
        <h2 style="margin-top:0">Profil & Pembayaran</h2>
        <div id="prof-msg"></div>
        <div class="panel"><form id="prof-form">
          <div class="form-field"><label for="p-name">Nama tampilan</label><input class="field" id="p-name" value="${esc(me.user.display_name)}"></div>
          <div class="form-field"><label for="p-method">Metode pembayaran</label><select class="field" id="p-method" style="width:100%"><option value="">— Pilih —</option><option value="DANA" ${me.user.payment_method === "DANA" ? "selected" : ""}>DANA</option><option value="SeaBank" ${me.user.payment_method === "SeaBank" ? "selected" : ""}>SeaBank</option></select></div>
          <div class="form-field"><label for="p-number">Nomor pembayaran</label><input class="field" id="p-number" value="${esc(me.user.payment_number)}" placeholder="Nomor DANA / rekening SeaBank (8–20 digit)"><p class="help">Nomor ditampilkan termask di halaman ini. Di database tersimpan lengkap untuk keperluan transfer admin.</p></div>
          <div class="form-field"><label for="p-holder">Nama pemilik rekening (wajib bila SeaBank)</label><input class="field" id="p-holder" value="${esc(me.user.payment_holder)}"></div>
          <button class="btn btn-primary" type="submit">Simpan Profil</button>
        </form></div>
        <h2>Notifikasi (30 terbaru)</h2>
        <div class="panel">${notifs.notifications.length ? notifs.notifications.map((n) => `<div style="padding:12px 0;border-bottom:1px solid #263250"><strong>${esc(n.title)}</strong><p class="muted small" style="margin:4px 0 0">${esc(n.body)}</p><span class="small muted">${fmtDate(n.created_at)}</span></div>`).join("") : `<p class="muted">Belum ada notifikasi.</p>`}</div>`;
      $("#prof-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const r = await api("update-profile", { method: "POST", body: {
            display_name: $("#p-name").value, payment_method: $("#p-method").value,
            payment_number: $("#p-number").value, payment_holder: $("#p-holder").value,
          } });
          me.user = r.user;
          showMsg($("#prof-msg"), "Profil tersimpan.", "ok");
        } catch (err) { showMsg($("#prof-msg"), err.message); }
      });
    }
  } catch (e) {
    page.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}
function openWithdraw(page) {
  const box = $("#withdraw-box", page);
  box.innerHTML = `<div class="panel"><h3>Tarik Saldo</h3><div id="wd-msg"></div>
    <div class="form-field"><label for="wd-method">Metode</label><select class="field" id="wd-method" style="width:100%">
      <option value="DANA" ${me.user.payment_method === "DANA" ? "selected" : ""}>DANA</option>
      <option value="SeaBank" ${me.user.payment_method === "SeaBank" ? "selected" : ""}>SeaBank</option></select></div>
    <div class="form-field"><label for="wd-amount">Nominal (Rp)</label><input class="field" id="wd-amount" type="number" min="1" placeholder="Mis. 50000"></div>
    <p class="help">Saldo tersedia: ${rupiah(me.balance)}. Biaya admin: &lt; Rp50.000 = Rp0; Rp50.000–100.000 = tier 1; &gt; Rp100.000 = tier 2 (per metode, diatur admin). Transfer dilakukan manual oleh admin; penarikan aktif hanya satu dalam satu waktu.</p>
    <button class="btn btn-primary" id="btn-wd">Ajukan Penarikan</button></div>`;
  $("#btn-wd").addEventListener("click", async () => {
    try {
      const r = await api("withdraw", { method: "POST", body: { method: $("#wd-method").value, amount: Number($("#wd-amount").value) } });
      showMsg($("#wd-msg"), `Penarikan ${r.withdrawal.id} diajukan: nominal ${rupiah(r.withdrawal.amount)}, biaya ${rupiah(r.withdrawal.fee)}, diterima bersih ${rupiah(r.withdrawal.net)}. ${r.note}`, "ok");
    } catch (e) { showMsg($("#wd-msg"), e.message); }
  });
}
async function boot() {
  try {
    settings = (await api("public-settings")).settings;
  } catch (e) {
    $("#auth-view").style.display = "block";
    showMsg($("#auth-msg"), e.message);
    return;
  }
  try {
    me = await api("me");
    $("#auth-view").style.display = "none";
    $("#app-view").style.display = "flex";
    render();
  } catch {
    $("#auth-view").style.display = "block";
    $("#app-view").style.display = "none";
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) {
      $("#tab-register").click();
      $("#reg-ref").value = ref;
    }
  }
}
$("#tab-login").addEventListener("click", () => {
  $("#tab-login").classList.add("active"); $("#tab-register").classList.remove("active");
  $("#login-form").style.display = "block"; $("#register-form").style.display = "none";
});
$("#tab-register").addEventListener("click", () => {
  $("#tab-register").classList.add("active"); $("#tab-login").classList.remove("active");
  $("#register-form").style.display = "block"; $("#login-form").style.display = "none";
});
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("login", { method: "POST", body: { email: $("#login-email").value, password: $("#login-password").value } });
    boot();
  } catch (err) { showMsg($("#auth-msg"), err.message); }
});
$("#register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("register", { method: "POST", body: {
      display_name: $("#reg-name").value, email: $("#reg-email").value,
      password: $("#reg-password").value, referral_code: $("#reg-ref").value,
    } });
    showMsg($("#auth-msg"), r.message, "ok");
    $("#tab-login").click();
  } catch (err) { showMsg($("#auth-msg"), err.message); }
});
$("#btn-logout").addEventListener("click", async () => {
  try { await api("logout", { method: "POST", body: {} }); } catch {}
  location.reload();
});
boot();
