-- SanzuFreelance — skema (dibuat otomatis juga oleh lib/db.js saat boot).
-- Jalankan di database Neon BARU khusus SanzuFreelance, jangan campur dengan
-- database toko lain. Tidak ada baris data contoh di skema ini.
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
-- Pengaturan default (disisipkan juga oleh lib/db.js bila belum ada):
-- rate_good=4300, rate_captcha=3500, daily_limit=50, store_open=true,
-- withdraw_enabled=true, withdraw_dana=true, withdraw_seabank=true,
-- fee_dana_tier1=0, fee_dana_tier2=0, fee_seabank_tier1=0, fee_seabank_tier2=0,
-- referral_enabled=true, referral_target=50, referral_reward=10000, telegram_url=''.
