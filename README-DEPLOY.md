# SanzuFreelance v1 — Panduan Deploy (Jujur)

Website setoran anggota + dashboard admin, backend nyata (bukan demo).
Kode ini **belum di-deploy, belum ada repo GitHub, dan belum ada project
Vercel** — semua langkah di bawah dilakukan Arka sendiri karena batasan
akun yang sudah diketahui. Jangan kirim password/kunci lewat chat.

## 1. Apa yang sudah jadi

- **Anggota (`index.html` + `member.js`):** daftar/masuk (email+password,
  hash scrypt), Beranda (saldo tersedia, tarif Room Good/Captcha, metrik,
  pengajuan terakhir), Pengajuan (pilih room, textarea bulk @gmail.com,
  hitung entri), Riwayat, Referral (kode, link salin, progress, klaim),
  Profil (metode DANA/SeaBank, nomor, notifikasi 30 terbaru). Mobile pakai
  bottom bar. Tanpa login, tidak ada data yang tampil.
- **Admin (`admin.html` + `admin.js` + `admin.css`):** tampilannya
  dipertahankan dari file demo admin
  (`SanzuFreelance_Web_Dasboard_Admin__1__36_x9v9.html`) — layout sidebar +
  topbar + mobile bar, urutan menu Beranda Admin, Pemeriksaan, Anggota,
  Penarikan, Referral, Pengaturan, kartu statistik Beranda Admin, tabel
  pemeriksaan dengan checkbox massal + filter stage/quality/search, panel
  Anggota/Penarikan/Referral, dan form Pengaturan yang sama. Yang diganti
  hanyalah sumber datanya (demo hardcode -> API) dan tombolnya (simulasi ->
  endpoint API). Pengecualian yang disengaja, dicatat di sini supaya tidak
  dikira kelupaan: (a) logo base64 raksasa tidak dipakai, brand cukup teks;
  (b) label "DATA SIMULASI" dihapus karena datanya sekarang nyata;
  (c) tombol switcher Anggota/Admin dihapus karena peran dipisah lewat
  login yang berbeda — admin tidak bisa menyamar jadi anggota;
  (d) panel Anggota ditambah filter status (Semua/Menunggu/Aktif/Nonaktif)
  supaya pendaftar Menunggu mudah ditemukan, sesuai ketetapan Arka.
- **Backend (satu dispatcher `api/index.js`, Vercel Hobby-safe):** semua
  endpoint lewat `/api?action=<nama>`, database PostgreSQL via `DATABASE_URL`
  (pool maks 3). Tanpa `DATABASE_URL`, semua endpoint API mengembalikan
  503 jujur "Database belum terhubung". **Tidak ada mode demo dan tidak ada
  data hardcode** di kode baru (saldo, pengguna, dan riwayat demo tidak
  disalin).
- **Alur persetujuan pendaftar baru (ditegaskan):** daftar ->
  `users.state='Menunggu'` -> anggota bisa login tapi **ditolak** saat setor
  atau tarik dengan pesan "Akunmu masih menunggu persetujuan admin" ->
  admin melihatnya di Beranda Admin (hitungan "Pendaftaran Baru") DAN di
  panel Anggota (filter Menunggu) -> admin menekan Terima (state jadi
  'Aktif') atau Tolak/Nonaktifkan dari modal Kelola -> barulah anggota bisa
  setor dan tarik. Jejaknya: `users.updated_at` + `admin_reason` berubah di
  database dan anggota menerima notifikasi keputusan tersebut.
- **Login admin dari database (bukan ADMIN_KEY harian):** tabel `users`
  punya kolom `role` ('member'/'admin'). Admin pertama dibuat lewat
  endpoint `POST /api?action=admin-setup` yang hanya bisa dipakai dengan
  `ADMIN_KEY` dari env **dan** hanya bila belum ada user role admin sama
  sekali (percobaan kedua ditolak 409). Setelah itu admin login di
  `/admin` pakai email+password akun admin dari database (cookie sesi
  `sz_admin` 12 jam, terpisah dari cookie member `sz_user` 30 hari).
  Sesi member tidak bisa mengakses endpoint admin, dan sesi admin tidak
  bisa dipakai sebagai member. Admin tidak muncul sebagai anggota biasa di
  daftar referral.
- **Aturan bisnis yang sudah diterapkan di server (bukan cuma di browser):**
  setor maks 50/pengajuan dan maks batas harian per anggota (hari WIB),
  hanya @gmail.com, duplikat dalam batch dan duplikat global (yang belum
  Ditolak) ditolak, catatan anggota BOLEH berisi password akun (keputusan
  Arka 2026-10-30, karena admin membutuhkannya untuk diserahkan ke pembeli;
  catatan hanya tampil di panel admin, tersimpan apa adanya di database);
  review Menunggu -> Diperiksa -> Diproses -> Diterima/Ditolak, Diterima
  hanya untuk Good/Captcha (Disabled / Verify tidak boleh Diterima),
  Diterima/Ditolak bersifat final; tarif saat Diterima dicatat sebagai
  `paid_rate` (perubahan tarif tidak mengubah penghasilan lama); saldo =
  total `paid_rate` Diterima + bonus referral Dibayarkan − nominal
  penarikan Menunggu Transfer/Selesai; penarikan satu aktif dalam satu
  waktu, fee bertingkat (< Rp50.000 = 0, Rp50.000–100.000 = tier 1,
  > Rp100.000 = tier 2 per metode); keputusan penarikan dan klaim referral
  idempoten (hanya dari status menunggu, percobaan kedua ditolak 409);
  notifikasi saat setoran dibuka/ditutup, pengajuan masuk Diperiksa,
  klasifikasi berubah, keputusan akhir, dan keputusan keanggotaan.
- **Pengujian (lihat bagian 5):** `node --check`, `test/test-logic.mjs`
  (fungsi murni), `test/test-handler-no-db.mjs` (503 tanpa database), dan
  `test/test-live.mjs` (alur penuh terhadap Postgres lokal saat pengujian
  ini dibuat — bukan terhadap Neon produksi).

## 2. Apa yang BELUM jadi / tetap manual

- **Transfer DANA/SeaBank tetap manual.** Tidak ada payment gateway
  otomatis. Admin transfer sendiri dari rekeningnya, lalu menandai Selesai
  di panel Penarikan (dengan centang "Saya sudah melakukan transfer manual").
  Bila admin menandai Selesai tanpa transfer, itu kesalahan manusia, bukan
  bug kode — tidak ada yang memverifikasi transfernya.
- **Tidak ada verifikasi kepemilikan akun Gmail otomatis.** Klasifikasi
  Good/Captcha/Disabled / Verify tetap penilaian manual admin. Sistem tidak
  mengecek apakah alamat yang disetor benar-benar milik penyetor, aktif,
  atau bisa dijual — admin yang menilai dari luar sistem.
- **Tidak ada verifikasi email pendaftaran, lupa password, atau upload
  bukti.** Pendaftaran hanya email+password. Bila anggota lupa password,
  belum ada alur reset (admin bisa menonaktifkan akun lama dan anggota
  daftar ulang dengan email lain, atau minta dibuatkan alur reset terpisah).
- **Tidak ada audit log perubahan pengajuan yang terperinci** (siapa admin
  yang mengubah apa, kapan, nilai lama/baru). Yang tercatat: `updated_at`
  pengajuan, `admin_note`, notifikasi ke anggota, dan `updated_at` +
  `admin_reason` untuk keputusan keanggotaan. Bila butuh audit penuh,
  itu pekerjaan lanjutan.
- **Tidak ada pembatasan laju (rate limit) atau CAPTCHA di form.** Untuk
  pemakaian kecil ini cukup; bila dibuka publik luas, tambahkan proteksi
  itu sebelum promosi besar.

## 3. Langkah deploy — dilakukan Arka sendiri

Pakai akun yang **sudah ada**, bukan akun baru:

- GitHub: `ginomas21`
- Vercel: `rosmiatiai325-9401` (Hobby)

Urutan yang harus diikuti (jangan dibalik):

1. **Buat repo GitHub baru di akun `ginomas21`**, mis.
   `ginomas21/sanzu-freelance` (repo kosong, tanpa README bawaan supaya
   tidak bentrok).
2. **Tambahkan repo itu ke akses GitHub App** (Settings -> Applications ->
   Installed GitHub Apps -> atur repository access). Bila langkah ini
   dilewati, push dari Muse gagal 403 'Resource not accessible by
   integration' — ini sudah terbukti di proyek sebelumnya.
3. **Beri tahu Muse "repo sudah jadi"**, supaya Muse push kode
   `~/workspace/sanzu-freelance/` ke repo tersebut.
4. **Import repo di `vercel.com/new` di akun `rosmiatiai325-9401`.**
   Pembuatan project Vercel dari Muse gagal 403 team scope, jadi langkah
   ini harus Arka sendiri di dashboard Vercel. Jangan hubungkan dulu ke
   domain lain; pakai domain `*.vercel.app` bawaan dulu sampai uji live
   lolos.
5. **Buat database Neon baru khusus SanzuFreelance** (dari tab Storage
   project Vercel itu, atau dari dashboard Neon) — **jangan campur dengan
   database toko lain** (Storm/IBC/CS Mart/musik-generator). Integrasi
   Neon Vercel akan mengisi `DATABASE_URL` otomatis.
6. **Isi env di Vercel (Project -> Settings -> Environment Variables),
   lalu Redeploy:**
   - `DATABASE_URL` — otomatis dari integrasi Neon (periksa sudah ada).
   - `ADMIN_KEY` — kunci acak panjang buatan Arka sendiri, HANYA untuk
     bootstrap admin pertama. Jangan kirim nilainya lewat chat.
   - `SESSION_SECRET` — tidak wajib di v1 (sesi memakai token acak di
     database, bukan token bertanda tangan), boleh dikosongkan.
7. **Buat admin pertama:** buka `/admin`, isi panel "Buat Admin Pertama"
   (ADMIN_KEY + email + password admin), kirim. Bila berhasil, panel itu
   tidak akan bisa dipakai lagi. **Setelah admin pertama jadi, ADMIN_KEY
   boleh dihapus/di-rotate di Vercel** — login admin selanjutnya lewat
   email+password dari database, bukan ADMIN_KEY.
8. **Masuk admin** lewat form "Masuk Admin" di `/admin` dengan email+
   password tadi, lalu atur tarif/limit/fee/referral di Pengaturan bila
   perlu (default sudah: Good Rp4.300, Captcha Rp3.500, limit 50/hari,
   fee semua Rp0, target referral 50, reward Rp10.000).

## 4. Urutan uji live pertama (setelah deploy)

1. Daftar anggota baru dari halaman depan (isi kode referral bila ada) ->
   pastikan statusnya Menunggu dan Beranda menampilkan "Akunmu masih
   menunggu persetujuan admin."
2. Coba setor saat Menunggu -> harus ditolak dengan pesan itu.
3. Admin masuk `/admin` -> Beranda Admin menampilkan Pendaftaran Baru = 1
   -> panel Anggota, filter Menunggu -> Kelola -> Terima.
4. Anggota login lagi -> setor 1-2 alamat @gmail.com (Room Good) -> tampil
   di Riwayat sebagai Menunggu.
5. Admin di Pemeriksaan -> pilih anggota -> Periksa/Ubah -> Diterima
   (Good) -> saldo anggota bertambah Rp4.300.
6. Anggota lengkapi Profil (DANA + nomor) -> Tarik Saldo Rp4.300 ->
   admin di Penarikan melihat nomor lengkap -> transfer manual beneran ->
   centang konfirmasi -> Konfirmasi Transfer Selesai -> saldo anggota
   kembali ke Rp0 (sudah ditarik).
7. Uji referral bila perlu: ubah target referral jadi kecil di Pengaturan,
   daftarkan anggota kedua lewat link referral anggota pertama, terima 1
   pengajuannya, klaim dari anggota pertama, konfirmasi dari admin, lalu
   kembalikan target ke 50.

Bila ada langkah yang gagal, catat pesan error persisnya (tanpa
stack trace — API memang tidak mengirim stack trace ke browser) dan
laporkan ke Muse.

## 5. Hasil pengujian saat kode ini dibuat

- `node --check api/index.js lib/db.js lib/auth.js lib/http.js lib/logic.js`
  — lolos, tidak ada syntax error.
- `node test/test-logic.mjs` — semua kasus PASS (validasi batch email,
  pola kredensial, fee bertingkat, saldo, transisi review, mask nomor,
  klaim referral, profil, penarikan, pengaturan).
- `node test/test-handler-no-db.mjs` (tanpa `DATABASE_URL`) — semua
  endpoint yang diuji mengembalikan 503 "Database belum terhubung".
- `node test/test-live.mjs` — dijalankan terhadap Postgres lokal
  (PostgreSQL 16 di VM, database uji kosong yang dihapus dulu) dengan
  `ADMIN_KEY` uji: semua kasus PASS, termasuk admin-setup hanya sekali
  (kedua 409), login admin dari database, sesi member ditolak di endpoint
  admin dan sebaliknya, alur daftar -> setor ditolak saat Menunggu ->
  admin setujui -> setor berhasil -> review Diterima -> saldo Rp4.300 ->
  penarikan -> admin Selesai -> keputusan kedua 409, serta klaim referral
  (target diubah jadi 1 untuk pengujian) -> konfirmasi -> bonus masuk
  saldo. Uji live terhadap Neon produksi **belum** dilakukan — itu bagian
  dari uji live pertama di atas, setelah deploy.

## 6. PERINGATAN SINGKAT — risiko konsep, bukan bug kode

Akun Gmail yang diperjualbelikan atau dibuat massal **melanggar ketentuan
Google dan bisa dinonaktifkan** sewaktu-waktu, termasuk akun yang sudah
dibayar. Bila itu terjadi, anggota dan pembeli akan menuntut ke admin,
sementara sistem ini tidak bisa mengembalikan akun tersebut. Pertimbangkan
risiko ini sebelum mengoperasikan website secara publik — kode di sini
hanya menjalankan alur setoran/review/bayar, bukan menghilangkan risiko
tersebut.

<!-- Redeploy 2026-10-30: env DATABASE_URL (Neon) + ADMIN_KEY + SESSION_SECRET sudah terpasang di Vercel, deployment ini memakai env tersebut. -->
