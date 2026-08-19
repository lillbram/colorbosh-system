# Cardigan Business Operations Suite — Claude Code Project Spec

> **Baca dokumen ini secara lengkap sebelum menulis kode apapun.** Semua keputusan teknis, konvensi, dan konteks bisnis ada di sini.

---

> ⚠️ **REVAMP (POS-focused, current state):** aplikasi disederhanakan dari alur hulu-ke-hilir penuh (§1 poin 1-2-4 di bawah) menjadi murni **penjualan + kas + laporan**, seperti sistem kasir/POS — atas permintaan user karena fitur Pemesanan Kain, Batch Produksi, dan Pencairan Dana **tidak dibutuhkan untuk saat ini**. Perubahan konkret:
> - **UI & routes dihapus** (bukan cuma disembunyikan): `/procurement`, `/production`, `/disbursement`, `/settings/suppliers`, `/settings/tailors`, `/settings/cost-components`, beserta semua Server Actions & komponennya. Nav utama & Data Master di `src/lib/constants.ts` disederhanakan jadi: Dashboard, Penjualan, Arus Kas, Laporan | Produk, Channel, Akun Kas & Bank, Kategori, Pengguna.
> - **Data & skema tabel TETAP ADA di database** (`suppliers`, `tailors`, `purchase_orders`, `purchase_order_items`, `purchase_order_payments`, `production_batches`, `production_batch_products`, `production_batch_cost_items`, `production_cost_components`, `tailor_payments`, `payouts`, `payout_expectations`, `payout_sales_link`) — sengaja tidak di-drop supaya data historis tidak hilang dan gampang diaktifkan lagi nanti kalau dibutuhkan. §5.3/§5.4/§5.6 di bawah tetap mendokumentasikan skema itu apa adanya (masih benar sebagai referensi struktur DB), tapi **tidak ada kode aplikasi yang menulis ke tabel-tabel itu lagi**.
> - ~~Setiap penjualan langsung memposting kas saat order dibuat~~ — **dibalik lagi (lihat di bawah):** sempat diimplementasikan (setiap sale auto-insert `cash_transactions` + field Akun Tujuan wajib di semua mode input), lalu **dihapus total** atas permintaan user supaya Penjualan & Arus Kas jadi dua laporan yang benar-benar berdiri sendiri. Penjualan sekarang **tidak pernah** menyentuh `cash_transactions` di mode apapun (POS, Rekap Live, Manual Single, Impor CSV) — field Akun Tujuan sudah dihapus dari keempatnya. Arus Kas sekarang murni diisi manual (single atau bulk import, lihat §6.5) — sudah tidak ada penulisan otomatis dari modul lain sama sekali. 4 baris `cash_transactions` historis yang sempat ter-auto-post (`description = 'Penjualan - {channel}'`) sudah dihapus dari database atas permintaan user, supaya Saldo Kas tidak lagi tercampur data dari eksperimen ini. `channels.requires_disbursement` masih ada di skema tapi tidak pernah dibaca. Lihat §6.3 & §6.5.
> - **HPP produk sekarang manual per produk** (`products.hpp_target`, field "HPP (Rp)" di Pengaturan > Produk), bukan lagi dihitung otomatis dari rata-rata tertimbang batch produksi selesai (`getProductCostBasis()` — fungsi ini **sudah dihapus**) — karena tidak ada lagi Batch Produksi yang menghasilkan angka itu. **Komponen Biaya Produksi juga sudah dihapus dari UI** (katalog itu cuma berguna untuk menghitung biaya batch, yang sudah tidak ada) — HPP sekarang murni satu angka manual per produk, tidak dirinci dari komponen apapun. Dipakai di Estimasi Profit saat input Penjualan (§6.3), ditampilkan sebagai kolom HPP & Profit per baris di halaman Penjualan (§6.3) dan di Laporan (§6.6, tab Per Produk & Profit Estimasi Laporan Sederhana).
> - **Laporan Lengkap** kehilangan tab **Per Penjahit** dan **Aging Payout**, dan tab **P&L** kehilangan baris Bayar Supplier/Bayar Penjahit (lihat §6.6). **Laporan Sederhana** kehilangan StatCard **Uang Belum Cair**.
> - **Dashboard** kehilangan card "Sorotan" (isinya dulu: channel belum cair, termin jatuh tempo, PO terlambat — semua sumbernya hilang) diganti card **"Hari Ini"** (total transaksi, total penjualan, channel aktif hari itu).
> - **Cron `daily-reminder` dan `vercel.json` crons dihapus total** — isinya dulu 100% tentang PO/termin/batch/payout yang overdue, tidak ada lagi yang perlu diingatkan di model POS ini. `getAttentionItems()` di `src/lib/reports.ts` sengaja dipertahankan sebagai fungsi yang selalu return `[]` (bukan dihapus) supaya `NotificationBell` di header tidak perlu kode khusus, dan supaya ada tempat jelas kalau nanti butuh alert baru (mis. saldo kas negatif).
> - Kalau nanti fitur produksi/pengadaan/pencairan dana diaktifkan lagi: kode lama masih ada di git history (lihat commit yang menghapusnya), dan skema DB-nya tidak pernah hilang — jadi ini keputusan yang reversibel, bukan penghapusan permanen.

## 1. Konteks Bisnis

### Apa yang kita bangun

SaaS berbasis web untuk mengelola **penjualan kardigan multi-channel**, seperti sistem kasir/POS:

1. ~~Pengadaan kain roll + hiasan + plastik packing~~ dan ~~produksi + pembayaran penjahit~~ — **dihapus dari scope saat ini**, lihat catatan REVAMP di atas.
2. Penjualan multi-channel: **TikTok Live**, **TikTok Shop**, **Shopee** (input manual, tidak ada API integration) — setiap penjualan langsung memposting uang masuk ke kas (lihat §6.3).
3. Cash flow terpadu (semua uang masuk & keluar).
4. Laporan dalam 2 bentuk: sederhana (1 halaman untuk owner) & lengkap (detail per channel/produk).

### Siapa penggunanya

- **Owner** (1 orang) — pemilik bisnis. Butuh dashboard cepat, HP-friendly.
- **Admin** (1–2 orang) — input harian, cek pencairan, catat pengeluaran. Butuh form simpel, tombol besar.

### Prinsip UX Non-Negotiable

- Bahasa Indonesia sehari-hari — **hindari jargon akuntansi**. Contoh: "Uang Masuk" bukan "Kredit", "Pemesanan Kain" bukan "Purchase Order" (di UI; boleh di kode).
- Angka penting pakai font **JetBrains Mono** ukuran besar supaya tidak salah baca.
- Warna semantic konsisten: hijau = cair/berhasil, kuning = perhatikan, merah = perlu aksi.
- Konfirmasi destructive wajib modal + nominal ditulis ulang.
- Mobile-first untuk halaman Owner (Dashboard, Cash Balance).
- Desktop-first untuk halaman Admin (Bulk Input, Laporan Lengkap).

---

## 2. Tech Stack (WAJIB — jangan diganti tanpa alasan kuat)

> **Deviasi dari spec awal (disengaja, karena tooling terbaru waktu bootstrap):** `create-next-app@latest` menginstal **Next.js 16**, bukan 14 — App Router API-nya sama, tapi `middleware.ts` sudah diganti nama jadi `proxy.ts` di v16 (fungsinya identik). Tailwind yang terinstal juga **v4**, yang pakai config berbasis CSS (`@theme` di `globals.css`) bukan `tailwind.config.ts` terpisah. shadcn/ui CLI versi terbaru juga sudah berubah total (preset "Nova/Vega/dst", bukan lagi radix/base-nya yang lama) sehingga komponen di `src/components/ui/` **ditulis manual** mengikuti konvensi shadcn klasik (Radix primitive + `cva` + `cn()`), bukan hasil `npx shadcn init`.

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend + Backend | **Next.js 16 App Router + TypeScript** | Single codebase, SSR default, deploy mudah |
| Styling | **Tailwind CSS v4 + komponen ala shadcn/ui (ditulis manual)** | Konsisten, cepat, punya semua komponen dasar |
| Database | **PostgreSQL (Supabase)** | Free tier 500MB, auto backup, punya Auth & Storage |
| ORM | **Drizzle ORM** (bukan Prisma) | Lebih ringan di serverless, TypeScript native |
| Auth | **Supabase Auth** (email/password) | Built-in, RLS integration |
| File Storage | **Supabase Storage** | Untuk bukti bayar, foto kain, foto produk |
| Email | **Resend** | 3000 email/bulan gratis, integrasi Next.js mudah |
| Hosting | **Vercel** (Hobby plan) | Auto deploy dari GitHub, gratis |
| Domain | **Hostinger** (existing) | Pointing DNS ke Vercel |
| CI/CD | **GitHub Actions** | Test on PR + backup DB harian |
| Icons | **lucide-react** | Konsisten dengan shadcn |
| Forms | **react-hook-form + zod** | Standar, validasi type-safe |
| Tables | **@tanstack/react-table** | Untuk BulkTable & laporan |
| Charts | **recharts** | Kompatibel dengan Next.js Server Components |
| Date | **date-fns** + **date-fns/locale/id** | Lokalisasi Indonesia |
| Money format | **Custom helper `formatIDR()`** | Konsisten di seluruh app |

**Total biaya bulanan: Rp 0** untuk skala 1–3 user + 500–2000 transaksi/bulan.

---

## 3. Environment & Setup

### 3.1 Prerequisites

```bash
node --version    # >= 20.0.0
npm --version     # >= 10.0.0
git --version     # any recent
```

### 3.2 Environment Variables

Buat `.env.local` di root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database direct (untuk Drizzle migrations)
DATABASE_URL=postgresql://postgres:PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@cardigan-anda.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=random-strong-string-here
```

Tambahkan juga `.env.example` (tanpa nilai) untuk commit ke repo.

> ⚠️ **Wajib pakai session pooler (port 5432), BUKAN transaction pooler (port 6543, `?pgbouncer=true`)** untuk `DATABASE_URL`. Ditemukan lewat debugging langsung: transaction-mode pooling di Supabase tidak reliable menerapkan `statement_timeout` per koneksi — query yang macet bisa nyangkut bermenit-menit (bahkan pernah 5+ menit) tanpa pernah di-cancel, karena setting session-level yang dikirim `postgres.js` tidak konsisten "nempel" ke backend connection yang dipakai pooler. Setelah pindah ke session pooler, response time semua halaman turun dari puluhan detik (kadang menit) jadi konsisten di bawah 1 detik.
>
> Konsekuensinya: **session pooler dibatasi total 15 koneksi untuk seluruh project** (termasuk Supabase Studio, script manual, dsb — bukan cuma app ini). Karena itu `src/db/index.ts` sengaja diset `max: 1` (lihat catatan serverless di bawah), jangan dinaikkan tanpa alasan kuat, nanti muncul error `EMAXCONNSESSION: max clients reached in session mode`.
>
> ⚠️ **Serverless (Vercel) butuh beberapa fix terpisah untuk pooling, bukan cuma satu** — ditemukan lewat debugging langsung setelah deploy pertama ke Vercel (halaman dengan banyak query paralel seperti dashboard, `/production`, `/disbursement`, `/reports`, `/cash-flow` gagal acak dengan "Server Components render" error, dan tombol Batalkan di Penjualan macet lama):
> 1. **Singleton client (`global.__postgresClient`) WAJIB di-cache di semua environment, termasuk production** — jangan dibatasi `if (process.env.NODE_ENV !== "production")`. Guard itu awalnya ditulis dengan asumsi cache cuma perlu untuk bertahan dari HMR di dev, tapi di serverless modul ini bisa di-evaluasi ulang di instance yang sama antar request; tanpa cache, tiap re-evaluasi bikin client `postgres()` baru dari nol.
> 2. **`max` pada client Postgres harus sekecil mungkin (akhirnya diset ke 1, bukan 8)** — dan ini bukan sekadar redundan dengan fix #1. Di Vercel, request yang datang bersamaan bisa ditangani oleh BEBERAPA instance serverless SEKALIGUS, dan **setiap instance dapat budget `max` koneksinya sendiri-sendiri** — jadi `max` membatasi budget per-instance, bukan total aplikasi. Selain itu, instance Vercel bisa "freeze" di antara request alih-alih benar-benar mati — dan timer JS (termasuk `idle_timeout` milik client ini) tidak jalan selagi frozen, jadi beberapa instance yang frozen-tapi-warm bisa terus memegang koneksi tanpa pernah dilepas sampai Vercel akhirnya benar-benar mematikan instance itu (bisa beberapa menit). `max: 1` membatasi worst-case per instance ke satu koneksi yang tertahan, bukan lebih.
> 3. **`connection: { statement_timeout, idle_in_transaction_session_timeout, ... }` di opsi `postgres()` TIDAK BEKERJA lewat pooler ini** — dicoba dan diverifikasi langsung: baik custom startup parameter maupun mekanisme standar `options=-c key=value` sama-sama di-drop diam-diam oleh Supabase session pooler; `SHOW statement_timeout` di server tetap balik ke default Supabase (2 menit), bukan nilai yang diset di client. Satu-satunya mekanisme yang terbukti bekerja adalah menjalankan `SET LOCAL ...` sebagai query sungguhan di awal setiap transaction — lihat `withTransaction()` di `src/db/index.ts`, dipakai oleh `withAudit()` dan semua pemakaian `db.transaction()` lainnya (bukan lagi manggil `db.transaction()` langsung).
> 4. **Bug nyata yang baru kelihatan setelah `max` diturunkan ke 1 (tombol Batalkan Penjualan macet lama lalu gagal diam-diam):** `assertNotReconciled()` di `src/app/(dashboard)/sales/actions.ts` awalnya query pakai `db` (client di luar transaction), padahal dipanggil dari DALAM transaction callback `cancelSalesEntry`/`cancelPosOrder`. Dengan `max: 1`, ini self-deadlock murni: transaction yang sedang terbuka memegang satu-satunya koneksi, sedangkan query `db.select()` di dalamnya butuh koneksi dari pool yang sama persis — tidak akan pernah dapat sampai transaction-nya sendiri selesai, padahal transaction itu sedang menunggu query ini selesai duluan. Bug ini kemungkinan besar sudah ada sejak awal (menjelaskan laporan "Batalkan lama" sebelum investigasi ini), tapi baru benar-benar macet total (bukan cuma lambat) setelah `max` diperkecil dan spare connection untuk nested query hilang. Fix: helper apapun yang dipanggil dari dalam transaction callback **wajib** menerima dan memakai `tx`, bukan `db` — cek ini setiap kali menambah helper baru di dalam `withAudit`/`withTransaction`.

### 3.3 Setup Steps (First Time)

```bash
# 1. Bootstrap
npx create-next-app@latest cardigan-saas \
  --typescript --tailwind --app --src-dir --eslint --import-alias "@/*"
cd cardigan-saas

# 2. Install dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install drizzle-orm postgres
npm install -D drizzle-kit
npm install react-hook-form @hookform/resolvers zod
npm install @tanstack/react-table
npm install recharts
npm install date-fns
npm install lucide-react
npm install resend
npm install clsx tailwind-merge class-variance-authority

# 3. shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label card badge dialog \
  dropdown-menu select textarea toast table tabs form sheet \
  alert-dialog calendar popover

# 4. Init database (setelah env terisi)
npm run db:push
```

---

## 4. Struktur Project

> **Catatan:** diagram di bawah sudah disesuaikan dengan kondisi implementasi aktual (Next.js 16 pakai `proxy.ts` bukan `middleware.ts`; Tailwind v4 config via CSS `@theme` di `globals.css`, bukan `tailwind.config.ts`; `reports` sekarang satu halaman dengan 2 tab, bukan 2 folder terpisah). **Routes `procurement/`, `production/`, `disbursement/`, `settings/suppliers/`, `settings/tailors/`, `settings/cost-components/`, dan `api/cron/daily-reminder/` sudah dihapus** (lihat catatan REVAMP di §1) — tidak muncul lagi di tree ini, meski tabel DB terkait tetap ada (lihat §5.3/§5.4/§5.6).

```
colorbosh-system/
├── .github/workflows/
│   ├── ci.yml
│   └── db-backup.yml
├── supabase/
│   └── rls-policies.sql             # RLS policies, dijalankan manual via script (bukan lewat drizzle-kit)
├── ACCOUNTS.md                      # kredensial & catatan koneksi DB (gitignored, jangan commit)
├── src/
│   ├── proxy.ts                     # auth guard (pengganti middleware.ts di Next 16)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx      # bootstrap owner pertama, otomatis tertutup setelah ada 1 user
│   │   │   ├── error.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # sidebar + header
│   │   │   ├── page.tsx             # Dashboard home
│   │   │   ├── loading.tsx / error.tsx
│   │   │   ├── sales/
│   │   │   │   ├── page.tsx         # 3 tab: Aktif/Retur/Dibatalkan, dikelompokkan per channel
│   │   │   │   ├── [id]/page.tsx    # detail per order, lihat §6.3
│   │   │   │   ├── return-sales-entry-dialog.tsx  # tombol Retur (beda dari Batalkan)
│   │   │   │   ├── new/pos/         # Kasir (POS) — mode termudah, lihat §6.3
│   │   │   │   ├── new/live/        # bulk live
│   │   │   │   ├── new/import/      # CSV import
│   │   │   │   └── new/single/      # manual entry
│   │   │   ├── cash-flow/           # entry manual bisa diedit/dihapus (tipe 'manual' saja), lihat §6.5
│   │   │   │   └── bulk-import/     # impor Excel massal (template + preview + validasi), lihat §6.5
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx         # 1 halaman, 2 tab (Sederhana/Lengkap) via ?view=
│   │   │   │   └── report-tabs.tsx
│   │   │   └── settings/
│   │   │       ├── users/
│   │   │       ├── products/        # termasuk field HPP manual, lihat §6.6
│   │   │       ├── channels/
│   │   │       ├── accounts/
│   │   │       └── categories/
│   │   └── api/
│   ├── components/
│   │   ├── ui/                      # primitives dibuat manual mengikuti pola shadcn/ui (bukan hasil CLI, lihat §2 catatan)
│   │   ├── stats/
│   │   │   └── stat-card.tsx
│   │   ├── forms/
│   │   │   ├── money-input.tsx      # support controlled `applyValue`
│   │   │   ├── date-input.tsx
│   │   │   ├── bulk-table.tsx
│   │   │   └── live-entries-table.tsx  # + kolom Profit per baris, lihat §6.3
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── notification-bell.tsx  # WAJIB dibungkus <Suspense> di header, lihat §8.4
│   │   │   └── logout-item.tsx
│   │   └── shared/
│   │       ├── status-badge.tsx
│   │       ├── empty-state.tsx
│   │       ├── confirm-delete-button.tsx
│   │       ├── confirm-cancel-button.tsx
│   │       ├── info-tooltip.tsx     # ikon (i) klik-untuk-buka penjelasan angka, dipakai di Laporan dkk
│   │       ├── export-pdf-button.tsx
│   │       └── page-skeleton.tsx
│   ├── db/
│   │   ├── index.ts                 # drizzle client — lihat §3.2 soal pooler mode & pool size
│   │   └── schema/                  # semua file skema lama (termasuk procurement.ts/production.ts/
│   │       │                        # disbursement.ts) TETAP ADA — lihat catatan REVAMP di §1
│   │       ├── index.ts
│   │       ├── users.ts
│   │       ├── master.ts            # + production_cost_components
│   │       ├── procurement.ts
│   │       ├── production.ts
│   │       ├── sales.ts
│   │       ├── disbursement.ts
│   │       ├── cashflow.ts
│   │       └── audit.ts
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts            # browser
│       │   ├── server.ts            # server components
│       │   └── admin.ts             # service-role client, server-only
│       ├── auth.ts                  # session helpers
│       ├── audit.ts                 # withAudit() helper
│       ├── reports.ts               # semua query aggregate utk dashboard & laporan
│       ├── format.ts                # formatIDR, formatDate
│       ├── validators/              # zod schemas per entity
│       ├── email.ts                 # resend wrapper (dailyReminderEmail dihapus)
│       └── constants.ts             # nav items (disederhanakan, lihat §1), enums, config
├── public/
├── .env.example
├── .env.local
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── README.md
```

---

## 5. Database Schema (WAJIB — jalankan sebelum coding fitur)

Semua tabel punya kolom umum: `id (uuid, pk)`, `created_at`, `updated_at`, `created_by (fk users.id)`, `is_deleted (boolean, default false)`.

Simpan di `src/db/schema/*` menggunakan Drizzle.

> §5.3 (Procurement), §5.4 (Production), dan §5.6 (Disbursement) di bawah **masih akurat sebagai referensi struktur tabel di database** — tidak di-drop saat REVAMP (§1) — tapi **tidak ada kode aplikasi yang menulis ke tabel-tabel itu lagi**. `channels.requires_disbursement` di §5.2 juga masih ada di skema tapi tidak dibaca lagi.

### 5.1 Users & Roles

```sql
create type user_role as enum ('owner', 'admin');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role user_role not null default 'admin',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Terhubung ke auth.users Supabase via id yang sama
```

### 5.2 Master Data

```sql
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);

create table tailors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  default_termin_1_pct int default 50,
  default_lead_time_days int default 7,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text,
  base_price numeric(12,2),
  hpp_target numeric(12,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);

create type channel_type as enum ('tiktok_live', 'tiktok_shop', 'shopee', 'other');
create table channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type channel_type not null,
  default_fee_pct numeric(5,2),
  default_hold_days int,
  -- false untuk channel yang uangnya diterima langsung saat order (mis.
  -- "Paket Usaha") — dikecualikan total dari Pencairan Dana, dan penjualan
  -- dari channel ini langsung posting cash_transaction. Default true
  -- (TikTok/Shopee-style: jual sekarang, cair belakangan). Lihat §6.4.
  requires_disbursement boolean default true,
  created_at timestamptz default now()
);
-- seed: TikTok Live (fee 0%, hold 0), TikTok Shop (fee 5%, hold 7), Shopee (fee 6%, hold 7)

create type category_kind as enum ('income', 'expense');
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind category_kind not null,
  is_system boolean default false,
  created_at timestamptz default now()
);

create type account_type as enum ('bank', 'cash', 'e_wallet');
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type account_type not null,
  opening_balance numeric(14,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### 5.3 Procurement

```sql
create type po_status as enum ('draft','ordered','partially_received','received','cancelled');
create type po_item_type as enum ('fabric_roll','accessory','packaging','other');

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  po_number text unique not null,
  order_date date not null,
  expected_date date,
  actual_arrival_date date,
  status po_status default 'draft',
  total_amount numeric(14,2) default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references purchase_orders(id) on delete cascade,
  item_type po_item_type not null,
  description text not null,
  qty_ordered numeric(10,2) not null,
  qty_received numeric(10,2),
  unit text default 'pcs',
  unit_price numeric(12,2) not null,
  subtotal numeric(14,2) generated always as (qty_ordered * unit_price) stored,
  notes text
);

create type payment_method as enum ('transfer','cash','cod','other');
create table purchase_order_payments (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references purchase_orders(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null,
  method payment_method not null,
  proof_url text,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);
```

### 5.4 Production

> **Update (implementasi):** form "Batch Baru" disederhanakan — lihat alasan & detail lengkap di §6.2. Ringkasnya:
> - `target_qty` tidak lagi diinput manual di form — server menghitungnya sendiri dari `sum(qty)` baris di `production_batch_products` yang dikirim, supaya angka qty tidak pernah tidak-sinkron dengan tabel produknya.
> - Tidak ada lagi field "Estimasi Total Biaya" yang diketik manual (dan sebelumnya, faktanya, **tidak pernah disimpan sama sekali** — hanya dipakai sesaat untuk hitung Termin 1 lalu dibuang). Total biaya sekarang **selalu** dihitung dari `sum(subtotal)` tabel baru `production_batch_cost_items` (lihat di bawah), yang berisi rincian biaya sungguhan per batch.

```sql
create type batch_status as enum ('planned','in_progress','finished','delivered');
create table production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text unique not null,
  tailor_id uuid references tailors(id),
  po_id_source uuid references purchase_orders(id),
  fabric_source text default 'from_po',  -- 'from_po' | 'tailor_own'
  fabric_used_meters numeric(8,2),
  start_date date not null,
  target_finish_date date not null,
  actual_finish_date date,
  target_qty int not null,  -- dihitung server dari sum(production_batch_products.qty), bukan input manual
  actual_qty int,
  status batch_status default 'planned',
  hpp_per_unit_calc numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);

create table production_batch_products (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references production_batches(id) on delete cascade,
  product_id uuid references products(id),
  qty int not null,
  -- Diisi per-produk saat batch ditandai selesai (default = qty, bisa
  -- diedit per baris). Tanpa ini, "hasil aktual" cuma ada sebagai satu
  -- angka agregat untuk seluruh batch, jadi tracking stok per-produk
  -- mustahil untuk batch multi-produk. Lihat §6.2.
  actual_qty int
);

-- Rincian biaya produksi per batch — baris katalog (cost_component_id terisi,
-- qty × unit_cost = subtotal) atau baris "Biaya Tambahan" freeform
-- (is_additional = true, qty/unit_cost null, subtotal diketik langsung).
-- Menggantikan kalkulator lama yang cuma menghitung satu angka lalu dibuang
-- tanpa pernah disimpan. Lihat CLAUDE.md §6.2.
create table production_batch_cost_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references production_batches(id) on delete cascade,
  cost_component_id uuid references production_cost_components(id),
  label text not null,
  qty numeric(10,2),
  unit_cost numeric(12,2),
  subtotal numeric(14,2) not null,
  is_additional boolean default false,
  created_at timestamptz default now()
);

create type tailor_payment_status as enum ('pending','due','paid','overdue');
create table tailor_payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references production_batches(id) on delete cascade,
  termin_no int not null,
  amount numeric(14,2) not null,
  due_date date,
  paid_date date,
  method payment_method,
  proof_url text,
  status tailor_payment_status default 'pending',
  created_at timestamptz default now()
);
```

### 5.5 Sales

> **Update (implementasi):** ditambahkan mode input ke-4, **Kasir (POS)** — lihat §6.3. `sales_source` diperluas dengan value `'pos'`. Semua order (dari mode manapun) bisa dibatalkan (`is_deleted = true`) lewat tombol Batalkan di halaman Penjualan / rekap POS — lihat §6.3 dan §6.4 untuk efeknya ke pencairan dana.
>
> **Update kedua:** ditambahkan `is_returned`/`returned_at`/`return_note` — retur (barang sampai lalu dikembalikan) adalah kejadian bisnis yang berbeda dari Batalkan (kesalahan input sebelum barang dikirim), jadi ditrack terpisah dari `is_deleted`. Lihat §6.3.

```sql
create type sales_source as enum ('manual','csv_import','live_bulk','pos');
create table sales_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  channel_id uuid references channels(id),
  order_ref text,  -- unik per channel; untuk deduplikasi CSV import
  product_id uuid references products(id),
  qty int not null,
  gross_amount numeric(12,2) not null,
  platform_fee_est numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  net_expected numeric(12,2) generated always as (gross_amount - platform_fee_est - discount) stored,
  buyer_note text,
  source sales_source default 'manual',
  live_session_id uuid,
  created_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false,
  -- Retur (post-delivery return) — beda dari is_deleted, lihat catatan di atas.
  is_returned boolean default false,
  returned_at timestamptz,
  return_note text,
  unique (channel_id, order_ref)  -- prevent duplicate import
);

create table sales_live_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  channel_id uuid references channels(id),
  host_name text,
  total_orders int,
  total_gross numeric(14,2),
  notes text,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);
```

### 5.6 Disbursement (Pencairan)

> **Update (implementasi, 2 iterasi):**
> 1. Desain awal ("projected" menunggu berdasarkan hari + periode kalender mingguan per channel, lalu diganti jadi grouping murni per channel dengan tabel `payout_expectations`) — lihat riwayatnya di §6.4.
> 2. **Model itu dibuang total** dan diganti saldo berjalan (running balance) per channel — lihat alasan & detail lengkap di §6.4. Ringkasnya: `payout_expectations` dan `payout_sales_link` **tidak lagi ditulis oleh aplikasi** (dibiarkan ada di database hanya supaya data historis tetap terbaca), `payout_status` enum juga tidak dipakai lagi. Semua logika baru ada di `src/lib/disbursement.ts` (`getChannelBalances()`), dihitung live dari `sales_entries` + `payouts` — tidak ada tabel "expectation" baru yang perlu di-generate atau di-maintain.
> - Tabel `payouts` ditambah kolom `is_deleted` (soft-delete, dipakai saat pencairan dibatalkan/void — lihat §6.4).

```sql
-- payout_status enum, payout_expectations, dan payout_sales_link masih ada
-- di database (lihat catatan di atas) tapi TIDAK dipakai oleh kode baru.
-- Definisi legacy-nya tidak diulang di sini — lihat migrasi lama kalau perlu.

create table payouts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id),
  actual_date date not null,
  actual_amount numeric(14,2) not null,
  bank_ref text,
  expectation_id uuid references payout_expectations(id), -- legacy, selalu null utk baris baru
  fees_detail jsonb,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);
```

### 5.7 Cash Flow (Ledger)

```sql
create type cash_direction as enum ('in','out');
create type cash_related_type as enum ('po_payment','tailor_payment','payout','manual');

create table cash_transactions (
  id uuid primary key default gen_random_uuid(),
  txn_date date not null,
  account_id uuid references accounts(id),
  direction cash_direction not null,
  amount numeric(14,2) not null,
  category_id uuid references categories(id),
  related_type cash_related_type,
  related_id uuid,
  description text,
  proof_url text,
  created_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean default false
);
```

### 5.8 Audit Log

```sql
create type audit_action as enum ('create','update','delete','restore');
create table audit_logs (
  id bigserial primary key,
  entity_type text not null,
  entity_id uuid not null,
  action audit_action not null,
  actor_id uuid references users(id),
  diff jsonb,
  timestamp timestamptz default now()
);
```

### 5.9 Row Level Security (Supabase)

Aktifkan RLS di semua tabel. Kebijakan default:

- Owner: full access di semua tabel.
- Admin: full CRUD di procurement, production, sales, disbursement, cashflow (read-only untuk audit_logs & settings).
- Semua write action wajib set `created_by = auth.uid()`.

---

## 6. Modul & Aturan Bisnis Kunci

### 6.1 Procurement (dihapus dari UI)

**Tidak ada lagi di aplikasi** — lihat catatan REVAMP di §1. Detail implementasi lama (kasus penjahit beli kain sendiri, auto-cash-transaction per pembayaran PO, status partially_received, dst.) ada di git history sebelum commit yang menghapus `src/app/(dashboard)/procurement/`. Tabel `purchase_orders`, `purchase_order_items`, `purchase_order_payments` (§5.3) tetap ada di database untuk data historis, tapi tidak ada kode yang menulis ke sana lagi.

### 6.2 Production (dihapus dari UI)

**Tidak ada lagi di aplikasi** — lihat catatan REVAMP di §1. Detail implementasi lama (form Batch Baru, termin 1/2 penjahit, cost items per batch, qty aktual per produk, dst.) ada di git history sebelum commit yang menghapus `src/app/(dashboard)/production/`. Tabel `production_batches`, `production_batch_products`, `production_batch_cost_items`, `tailor_payments` (§5.4) tetap ada di database untuk data historis, tapi tidak ada kode yang menulis ke sana lagi. **HPP produk sekarang diatur manual per produk** (`products.hpp_target`, field "HPP (Rp)" di Pengaturan > Produk) — lihat §6.3 & §6.6.

### 6.3 Sales

**4 mode input** (mode 1 ditambahkan setelah implementasi awal karena admin sering bingung dengan upload file):

**Mode 1 — Kasir/POS** (`/sales/new/pos`):
- Grid produk yang bisa diklik langsung (cari by nama/SKU) + panel keranjang di sampingnya, mirip kasir toko fisik.
- Pilih channel, klik produk berkali-kali untuk menambah qty, harga per baris bisa diedit manual, lalu "Simpan Order".
- Setiap order dapat `order_ref` unik format `POS-{yyyyMMdd-HHmmss-SSS}`, semua baris produk dalam satu order berbagi `order_ref` yang sama, `source = 'pos'`.
- Panel "Rekap Order Hari Ini" menampilkan semua order POS hari itu (live, refresh otomatis setelah simpan/batalkan) — tiap order bisa langsung dibatalkan dari sini.
- Ini adalah alternatif yang paling mudah dipakai dibanding 3 mode di bawah; ditampilkan sebagai kartu pertama/paling menonjol di halaman `/sales`.

**Mode 2 — Bulk Live** (`/sales/new/live`):
- Form info sesi (tanggal, host, channel)
- `LiveEntriesTable` produk (kolom: produk, qty, harga satuan, subtotal auto). Begitu produk dipilih di satu baris, **harga satuan otomatis terisi** dari `products.base_price` produk itu — tetap bisa diketik ulang manual kapan saja (`src/components/forms/live-entries-table.tsx`).
- Simpan → INSERT `sales_live_sessions` + N × `sales_entries`
- Auto-hitung `platform_fee_est` dari `channels.default_fee_pct` (lihat "Potongan fee otomatis" di bawah)

**Mode 3 — CSV Import** (`/sales/new/import`):
- Dropzone → parse CSV/XLSX pakai library (papaparse untuk CSV, xlsx untuk Excel)
- Preview 10 baris pertama
- Column mapping (auto-detect kalau nama kolom umum: `Order ID`, `SKU`, dll)
- Harga (`grossAmount`) diambil langsung dari kolom file yang di-mapping — bukan dari katalog produk, karena datanya sudah berasal dari export platform.
- Deduplikasi via `(channel_id, order_ref)` unique constraint
- Bulk INSERT dengan transaction

**Mode 4 — Manual Single** (`/sales/new/single`):
- Form pendek untuk order sporadis/koreksi.
- Field **Total Bruto** otomatis terisi saran (`products.base_price × qty`) begitu produk & qty dipilih, tapi selalu bisa diketik ulang manual — pola sama seperti "Termin bisa didefinisikan manual" di §6.2 (link "Pakai saran" untuk kembali ke nilai otomatis kalau sudah diedit).

**Estimasi Profit live saat input (Kasir/POS, Rekap Live, Manual Single):** ketiga mode ini menampilkan kartu/baris "Estimasi Profit" yang update live saat produk & qty diketik — dihitung sebagai `(Harga Jual − Diskon) − (HPP produk × Qty)`, memakai `products.hpp_target` (field "HPP (Rp)" di Pengaturan > Produk, diisi manual — lihat catatan REVAMP di §1). Kalau HPP produk belum diisi (masih 0/null), muncul catatan "HPP belum diatur untuk produk ini" supaya tidak disalahartikan sebagai profit 100%. Angka ini **belum** mengurangi fee platform (beda dari Profit Estimasi di Laporan Sederhana) — untuk gambaran cepat saat input saja, bukan angka final akuntansi. CSV Import tidak dapat fitur ini (data bulk dari file, bukan input satu-satu). Lihat `pos-client.tsx`, `manual-sale-form.tsx`, `live-entries-table.tsx`.

**Potongan fee platform otomatis:** setiap mode input (POS, Bulk Live, CSV Import, Manual Single) menghitung `platform_fee_est = round(gross_amount × channels.default_fee_pct / 100)` saat order dibuat (`getChannel()` di `src/app/(dashboard)/sales/actions.ts`) — user tidak perlu menghitung fee manual, dan `net_expected` (kolom generated) otomatis mengurangi fee + diskon dari bruto.

**Penjualan tidak lagi menyentuh Arus Kas (dibalik dari desain POS-style sebelumnya, lihat catatan REVAMP di §1):** sempat ada helper `postSaleCash()` yang auto-insert `cash_transactions` setiap order dibuat, plus field Akun Tujuan wajib di semua mode input — **keduanya sudah dihapus total**. Alasannya murni permintaan user: Penjualan dan Arus Kas harus jadi dua laporan yang berdiri sendiri-sendiri, bukan satu memicu yang lain. Sekarang keempat mode input (POS, Rekap Live, Manual Single, Impor CSV) hanya menulis ke `sales_entries`/`sales_live_sessions` — tidak ada lagi field akun tujuan di form manapun, dan tidak ada insert ke `cash_transactions` di jalur manapun. Kalau uang dari penjualan perlu dicatat di Arus Kas, itu sekarang murni tindakan manual terpisah oleh user (single entry atau bulk import, lihat §6.5) — sistem tidak lagi mengasumsikan keduanya selalu terjadi bersamaan. Kolom `channels.requires_disbursement` masih ada di skema tapi tidak pernah dibaca oleh kode aplikasi manapun.

**Grouping per channel di `/sales`:** daftar transaksi (semua tab: Aktif/Retur/Dibatalkan, tanpa batas 200 baris) dikelompokkan per channel dengan baris header abu-abu berisi jumlah transaksi + subtotal Bruto/Bersih/Profit, diurutkan dari Bruto terbesar. Filter pill channel (`?channel=`) di kanan filter status memperjelas satu channel saja. Tujuannya supaya angka di sini gampang dicocokkan dengan Laporan Lengkap → Per Channel untuk periode yang sama — dijelaskan lewat `InfoTooltip` di halaman.

**Kolom HPP & Profit per baris di `/sales`:** setiap baris transaksi menampilkan HPP (dari `products.hpp_target`, sama seperti di Laporan) dan Profit (`net_expected − HPP × qty`), supaya admin/owner langsung lihat dari mana profit tiap transaksi berasal tanpa harus buka Laporan terpisah — sama formula dengan Estimasi Profit saat input (di atas) dan kolom Profit di Laporan Lengkap → Per Produk (§6.6).

**Detail per order** (`/sales/[id]`): setiap baris di `/sales` bisa diklik (nama produk jadi link) untuk membuka halaman detail — menampilkan channel, produk, qty, harga satuan, rincian Total Bruto/Diskon/Fee Platform (nominal + % yang benar-benar diterapkan saat order dibuat)/Total Bersih, sumber input, no. order, catatan pembeli, siapa & kapan dicatat, serta tombol Batalkan/Retur (kalau masih aktif).

**Membatalkan order (semua mode):**
- Setiap baris di halaman `/sales` (dan halaman detail `/sales/[id]`) punya tombol "Batalkan" (icon, dengan dialog konfirmasi) → soft-delete (`is_deleted = true`), tercatat di `audit_logs` dengan action `delete`.
- Order yang sudah **termasuk dalam pencairan dana yang sudah di-reconcile** (ada baris terkait di `payout_sales_link`) **tidak bisa dibatalkan** — action akan menolak dengan pesan error. Ini mencegah pembatalan retroaktif setelah uang benar-benar sudah dicairkan (perlu alur refund terpisah kalau itu terjadi, belum diimplementasikan).
- Khusus order dari Kasir (POS): panel "Rekap Order Hari Ini" punya tombol Batalkan per-order yang membatalkan **semua** baris dengan `order_ref` yang sama sekaligus (satu klik = satu order, bukan per baris produk).
- Membatalkan sebuah sales entry **tidak menyesuaikan kembali** `cash_transactions` yang sudah diposting saat order dibuat — kalau perlu, koreksi manual di Arus Kas (§6.5, entry manual bisa diedit/dihapus).

**Retur (beda dari Batalkan):** halaman `/sales` punya 3 tab — Aktif / **Retur** / Dibatalkan.
- Retur untuk barang yang sudah **sampai ke pembeli lalu dikembalikan** — bukan kesalahan input sebelum barang dikirim (itu kasusnya Batalkan). Secara bisnis dua hal ini berbeda meskipun efek akuntansinya mirip (sama-sama tidak dihitung sebagai penjualan aktif).
- Tombol "Retur" (ikon, terpisah dari "Batalkan") tersedia di tiap baris Aktif dan di halaman detail — buka dialog dengan field catatan retur opsional (alasan, kondisi barang, dst.), set `is_returned = true`, `returned_at`, `return_note` (`returnSalesEntry()` di `src/app/(dashboard)/sales/actions.ts`).
- Order yang sudah `is_deleted` tidak bisa diretur, dan sebaliknya — dua status ini saling eksklusif secara logis (satu order cuma bisa salah satu, tidak dua-duanya).
- Sama seperti Batalkan, tunduk pada guard `assertNotReconciled` — order lama yang kebetulan masih tertaut di `payout_sales_link` (tabel legacy dari model Pencairan Dana sebelumnya, lihat §6.4) tidak bisa diretur.
- Entry yang diretur **dikecualikan** dari semua laporan (omset, profit, per-channel, per-produk) — lihat §6.6.

### 6.4 Disbursement (dihapus dari UI)

**Tidak ada lagi di aplikasi** — lihat catatan REVAMP di §1. Konsep lama (saldo berjalan per channel Total Terjual − Total Diterima, estimasi aging FIFO, konfirmasi payout) ada di git history sebelum commit yang menghapus `src/app/(dashboard)/disbursement/` dan `src/lib/disbursement.ts`. Tabel `payouts`, `payout_expectations`, `payout_sales_link` (§5.6) tetap ada di database untuk data historis dan supaya guard `assertNotReconciled()` di `sales/actions.ts` masih bisa melindungi order lama yang pernah direkonsiliasi lewat model itu — tapi tidak ada kode baru yang menulis ke tabel-tabel itu. Semua channel sekarang diperlakukan sebagai pencairan langsung, lihat §6.3.

### 6.5 Cash Flow

- **Berdiri sendiri dari Penjualan** (dibalik dari desain POS-style sebelumnya, lihat §1 & §6.3) — tidak ada lagi auto-insert dari sale manapun. Satu-satunya cara sesuatu masuk ke `cash_transactions` sekarang adalah lewat "Catat Transaksi" (single) atau "Impor Excel" (bulk, lihat di bawah) di halaman ini sendiri.
- Halaman `/cash-flow` = filter + list transaksi + saldo per akun.
- Manual entry untuk pengeluaran operasional (listrik, sewa, gaji) lewat tombol "Catat Transaksi".
- **Entry manual bisa diedit/dihapus** — tombol pensil (edit, dialog sama dengan "Catat Transaksi" tapi pre-filled) dan tombol hapus (soft-delete, konfirmasi) muncul di baris manapun dengan `related_type = 'manual'`. Entry otomatis (dari Penjualan) **tidak bisa** diedit/dihapus di sini — guard di server (`editManualCashTransaction()`/`deleteManualCashTransaction()` di `src/app/(dashboard)/cash-flow/actions.ts`) menolak kalau bukan tipe manual, dan tombolnya memang tidak dirender untuk baris itu di `page.tsx`.
- **Impor Excel (bulk manual entry)** — tombol "Impor Excel" di `/cash-flow` membuka halaman terpisah `/cash-flow/bulk-import` (`bulk-import-form.tsx`), pola yang sama dengan Impor CSV Penjualan (§6.3) tapi tanpa langkah pemetaan kolom karena template-nya tetap (kita yang kontrol formatnya):
  1. **Download Template** — file `.xlsx` dibuat client-side (`XLSX.utils.aoa_to_sheet`) dengan 2 sheet: "Template" (header Tanggal/Arah/Akun/Kategori/Keterangan/Nominal + 1 baris contoh) dan "Panduan" (petunjuk pengisian + daftar nama Akun & Kategori yang **benar-benar ada saat itu** di database, supaya user tinggal copy-paste, bukan mengetik ulang dan salah ketik).
  2. **Upload** — file yang sudah diisi di-drag/drop atau dipilih, di-parse dengan `XLSX.read(..., { cellDates: true })` supaya sel bertipe tanggal Excel terbaca sebagai `Date` (bukan cuma string).
  3. **Preview per baris** dengan validasi: Tanggal (parse `Date` object atau string `DD/MM/YYYY`/`YYYY-MM-DD`), Arah (harus persis "Masuk"/"Keluar"), Akun (dicocokkan case-insensitive ke nama akun asli, wajib ketemu), Kategori (opsional, sama caranya kalau diisi), Keterangan (wajib), Nominal (angka > 0). Baris tidak valid ditandai ikon merah + alasan (tooltip), tidak ikut diimpor — tidak all-or-nothing per file.
  4. **Import** — hanya baris valid dikirim ke `bulkImportCashTransactions()` (`src/app/(dashboard)/cash-flow/actions.ts`), insert sekaligus dalam satu `withTransaction()` (bukan `withAudit()` — konsisten dengan pola `importSalesCsv()` yang juga tidak menulis audit log per baris untuk bulk import), semua `related_type = 'manual'` sehingga otomatis bisa diedit/dihapus individual lewat UI biasa setelah masuk.

### 6.6 Reports

> **Update (REVAMP, lihat §1):** `getProfitEstimasi()` dan `getPerProductReport()` sekarang memakai `products.hpp_target` (HPP manual per produk) sebagai basis biaya, bukan lagi rata-rata tertimbang dari batch produksi selesai (`getProductCostBasis()` sudah dihapus karena Batch Produksi dihapus dari UI). Tab Per Produk tidak lagi punya kolom Stok (butuh data qty aktual dari Batch Produksi yang sudah tidak ada). Laporan Sederhana tidak lagi punya StatCard Uang Belum Cair, dan Laporan Lengkap tidak lagi punya tab Per Penjahit & Aging Payout (semua butuh Pencairan Dana/Produksi yang sudah dihapus, lihat §6.2 & §6.4).

**Sederhana** (`/reports/simple`):
- 4 StatCard: Saldo Kas, Penjualan Bulan Ini, Profit Estimasi, Top Produk
- 1 line chart (30 hari, per channel)
- Tombol "Export PDF"

**Profit Estimasi — margin sesungguhnya, bukan proxy cash-flow:**
- Formula: `Revenue (net_expected penjualan aktif+non-retur dalam periode) − COGS (qty terjual × HPP produk itu, dari products.hpp_target) − Beban Operasional (cash_transactions related_type='manual', direction=out, dalam periode)`.
- **Kenapa bukan sekadar uang masuk dikurangi uang keluar:** itu arus kas, bukan profit akuntansi — kalau nanti Pemesanan Kain/Produksi diaktifkan lagi, bayar tagihan besar bulan ini untuk barang yang baru laku bulan depan bisa bikin "profit" bulan ini kelihatan rugi padahal itu investasi stok, bukan kerugian sungguhan. Prinsip ini dipertahankan meski basis HPP-nya sekarang manual, bukan dari batch.
- `getPenjualanPeriode()` (omset) dan semua fungsi laporan lain yang menjumlahkan `sales_entries` dikecualikan dari retur (`is_returned = false`).

**Lengkap** (`/reports/detailed`):
- Tabs: P&L | Per Channel | Per Produk | Cash Flow
- Filter periode (7/30/90 hari, MTD, LTM, custom)
- Export Excel per tab (pakai `xlsx` library)
- **Tab P&L**: Total Penjualan (klik untuk rincian per channel) → Diskon → Fee Platform Estimasi → Penjualan Bersih → Operasional → Laba Estimasi. Laba Estimasi = Penjualan Bersih − Operasional saja (tidak dikurangi HPP) — beda dari Profit Estimasi di Laporan Sederhana yang juga mengurangi HPP, dijelaskan lewat `InfoTooltip` di tab ini.
- **Tab Per Produk** menampilkan Qty/Bruto/Bersih (scoped ke periode filter), **HPP** (dari `products.hpp_target`, sama untuk periode manapun sampai diubah manual), dan **Profit** (`bersih periode − HPP × qty terjual periode`).

---

## 7. UI Design System

### 7.1 Design Tokens (masukkan ke `tailwind.config.ts`)

```ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF1F9',
          100: '#E7EBF7',
          500: '#3B4EA0',
          600: '#334289',
          700: '#2A3672',
        },
        accent: {
          500: '#D97757',
          600: '#C56845',
        },
        ink: '#1A1A1A',
        muted: '#6B7280',
        canvas: '#F9F7F3',
        border: '#D5D3CE',
        success: '#1F7A3A',
        warning: '#B45309',
        danger: '#B91C1C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        display: ['36px', { lineHeight: '1.1', fontWeight: '700' }],
        h1: ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
      },
    },
  },
}
```

### 7.2 Komponen Custom yang Wajib Dibuat

**`<MoneyInput />`** — di `src/components/forms/money-input.tsx`
- Format Rupiah dengan pemisah ribuan saat blur
- Right-aligned angka
- Prefix "Rp"
- Validasi: min 0, max 999,999,999

**`<DateInput />`** — di `src/components/forms/date-input.tsx`
- Format DD/MM/YYYY
- Preset: Hari ini, Kemarin, 7 hari lalu, Awal bulan
- Pakai shadcn Calendar + Popover

**`<BulkTable />`** — di `src/components/forms/bulk-table.tsx`
- Baris bisa ditambah/hapus dinamis
- Tab navigation antar cell (spreadsheet-like)
- Auto-save draft ke localStorage tiap 30 detik
- Highlight baris yang belum lengkap

**`<StatCard />`** — di `src/components/stats/stat-card.tsx`
- Props: icon, label, value, trend (up/down/none, %), footer
- Format value pakai `formatIDR()` kalau angka uang

**`<StatusBadge />`** — di `src/components/shared/status-badge.tsx`
- Warna semantic sesuai status enum
- Bentuk pill dengan padding konsisten

**`<EmptyState />`** — di `src/components/shared/empty-state.tsx`
- Icon + judul + deskripsi + tombol CTA
- Digunakan di setiap list yang kosong

### 7.3 Helper Wajib

```ts
// src/lib/format.ts
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: id });
}

export function formatDateLong(date: Date | string): string {
  return format(new Date(date), 'd MMMM yyyy', { locale: id });
}

export function parseNumberInput(v: string): number {
  return Number(v.replace(/[^\d]/g, ''));
}
```

### 7.4 Glossary Istilah UI (WAJIB KONSISTEN)

| Istilah UI (dipakai) | Bukan | Konteks |
|---|---|---|
| Uang Masuk | Kredit / Income | Cash flow |
| Uang Keluar | Debit / Expense | Cash flow |
| Rekap Live | Sales session bulk | Input penjualan |
| Laporan Sederhana | Executive summary | Modul laporan |
| Laporan Lengkap | Detailed report | Modul laporan |

> Baris "Pemesanan Kain", "Batch Produksi", "Termin 1/2", "Uang Belum Cair", "Sudah Cair" dihapus dari tabel ini — istilahnya sudah tidak dipakai di UI manapun setelah REVAMP (§1).

---

## 8. Konvensi Coding

### 8.1 File & Folder

- **Server Components by default** — tambahkan `"use client"` hanya kalau perlu (form, interaksi, hooks).
- **Colocate** — komponen spesifik halaman di folder halaman itu; komponen shared di `src/components/`.
- **Naming:** kebab-case untuk file (`money-input.tsx`), PascalCase untuk komponen (`<MoneyInput />`).
- Semua async server component pakai `async` + `await`. Jangan pakai `useEffect` untuk data fetching.

### 8.2 Data Fetching Pattern

```tsx
// Server component
export default async function PurchaseOrdersPage() {
  const supabase = createServerClient();
  const { data: pos } = await supabase.from('purchase_orders').select('*, supplier:suppliers(name)');
  return <PurchaseOrderList data={pos} />;
}
```

Untuk mutation → Server Actions:

```tsx
// src/app/(dashboard)/procurement/actions.ts
'use server'
export async function createPO(formData: FormData) {
  const parsed = poSchema.parse(Object.fromEntries(formData));
  const supabase = createServerClient();
  const { error } = await supabase.from('purchase_orders').insert(parsed);
  if (error) return { error: error.message };
  revalidatePath('/procurement');
  redirect('/procurement');
}
```

### 8.3 Validation

Setiap entity punya zod schema di `src/lib/validators/*.ts`:

```ts
export const purchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  order_date: z.coerce.date(),
  expected_date: z.coerce.date().optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
});
```

### 8.4 Error Handling

- Semua Server Action return `{ data?, error? }`.
- Client component tampilkan error via `toast()` (dari shadcn).
- Fatal error di server component → throw → `error.tsx` boundary.
- **Async Server Component apapun yang dipakai di layout bersama (mis. `NotificationBell` di `Header`, yang tampil di SEMUA halaman) WAJIB dibungkus `<Suspense>` dengan fallback statis di titik pemanggilannya.** Ditemukan lewat debugging langsung: satu async component tanpa `Suspense` di komponen layout yang dipakai bersama akan memblokir SELURUH halaman untuk stream ke browser sampai query-nya selesai — bukan cuma bagiannya sendiri. ~~"Cuma notifikasi, pasti ringan"~~ ternyata cukup untuk bikin setiap halaman di seluruh app terasa lambat, sebelum akhirnya ketauan setelah profiling. Query di dalam komponen ber-Suspense sebaiknya juga dibungkus `try/catch` dengan fallback state kosong, supaya kegagalan/timeout di situ tidak ikut menjatuhkan seluruh halaman.

### 8.5 Loading & Empty States

- Setiap route punya `loading.tsx` dengan skeleton.
- Setiap list kalau `data.length === 0` → render `<EmptyState />` dengan CTA relevan.

### 8.6 Audit Log

Setiap CREATE/UPDATE/DELETE di transaksi keuangan (PO, payment, sales, payout, cash_transaction) WAJIB insert ke `audit_logs` dalam transaction yang sama. Buat helper `withAudit()` di `src/lib/audit.ts`.

### 8.7 Testing (Minimum)

- Type check: `tsc --noEmit` di CI
- ESLint di CI
- (Skip unit test untuk MVP; tambah nanti kalau ada bug)

---

## 9. Deployment

### 9.1 Vercel Setup (1x)

1. Push repo ke GitHub.
2. Import project di vercel.com → pilih repo.
3. Set semua env vars (dari `.env.local`) di Vercel Project Settings.
4. Deploy.

### 9.2 Domain Pointing Hostinger → Vercel (1x)

Di Vercel: Settings → Domains → Add `cardigan-anda.com`.

Copy record dari Vercel, tambah ke Hostinger DNS Zone Editor:
- Type: `A` | Name: `@` | Value: `76.76.21.21`
- Type: `CNAME` | Name: `www` | Value: `cname.vercel-dns.com`

Alternatif subdomain: hanya point `app.cardigan-anda.com` → Vercel.

### 9.3 Cron Jobs

> **Dihapus (REVAMP, lihat §1):** `vercel.json` sekarang `{}` (tidak ada cron sama sekali). Cron `daily-reminder` (dan sebelumnya `payout-projection`) isinya 100% tentang PO/termin/batch/payout yang overdue — begitu Pemesanan Kain, Batch Produksi, dan Pencairan Dana dihapus dari UI (§6.1/§6.2/§6.4), tidak ada lagi yang perlu diingatkan secara berkala. `dailyReminderEmail()` di `src/lib/email.ts` juga sudah dihapus; `sendEmail()` (wrapper Resend generik) tetap ada kalau nanti butuh kirim email lagi untuk hal lain. `CRON_SECRET` di `.env.local` jadi tidak dipakai untuk saat ini, tapi boleh dibiarkan ada.

### 9.4 Database Backup (GitHub Action)

`.github/workflows/db-backup.yml`:

```yaml
name: DB Backup
on:
  schedule:
    - cron: '0 17 * * *'  # 00:00 WIB
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install postgres client
        run: sudo apt-get install -y postgresql-client
      - name: Dump database
        run: pg_dump "${{ secrets.SUPABASE_DB_URL }}" > backup-$(date +%Y%m%d).sql
      - uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: backup-*.sql
          retention-days: 30
```

Tambah secret `SUPABASE_DB_URL` di GitHub Settings → Secrets.

---

## 10. Roadmap Build (12 Minggu Solo Developer)

Kerjakan dalam urutan ini. Setiap fase punya deliverable jelas yang harus jalan di production sebelum lanjut.

- **Minggu 1 — Fase A: Setup**
  - [ ] Bootstrap Next.js + Tailwind + shadcn
  - [ ] Design tokens di `tailwind.config.ts`
  - [ ] Layout dashboard (sidebar + header)
  - [ ] Deploy pertama ke Vercel + point domain Hostinger
  - [ ] Auth login/logout (Supabase)
  - **Deliverable:** halaman login live di `cardigan-anda.com`, bisa sign up owner pertama.

- **Minggu 2 — Fase B: Master Data**
  - [ ] Schema DB semua tabel (jalankan SQL dari section 5)
  - [ ] Drizzle setup + generate types
  - [ ] CRUD Suppliers, Tailors, Products, Channels, Categories, Accounts
  - **Deliverable:** halaman `/settings/*` bisa manage data master.

- **Minggu 3–4 — Fase C: Procurement + Cash Flow ledger**
  - [ ] List PO + filter + tabs
  - [ ] Form PO baru (multi-item, dinamic rows)
  - [ ] Konfirmasi kain tiba (wizard + upload foto)
  - [ ] Catat pembayaran + auto-cash transaction
  - [ ] Halaman `/cash-flow` list + filter + saldo
  - **Deliverable:** bisa full siklus: buat PO → bayar → terima kain → tercatat di cash flow.

- **Minggu 5 — Fase D: Production**
  - [ ] List batch + kartu
  - [ ] Form batch baru (dengan opsi "kain dari penjahit")
  - [ ] Konfirmasi batch selesai + auto-create termin 2
  - [ ] Bayar termin (1/2)
  - [ ] HPP auto-calc
  - **Deliverable:** batch produksi + pembayaran termin bisa ditrack.

- **Minggu 6–7 — Fase E: Sales (3 mode input)**
  - [ ] Mode 1 Bulk Live: form sesi + BulkTable
  - [ ] Mode 2 CSV Import: parser + preview + deduplication
  - [ ] Mode 3 Manual Single: form pendek
  - [ ] Auto-hitung `platform_fee_est` per channel
  - **Deliverable:** admin bisa input semua penjualan dengan cepat.

- **Minggu 8–9 — Fase F: Disbursement + Reconciliation**
  - [ ] ~~Cron generate `payout_expectations` harian~~ / ~~UI Kanban 4 kolom~~ / ~~Auto-match candidate expectations (±5%)~~ / ~~`discrepancy` handling~~ — rencana awal ini sudah diganti total oleh model saldo berjalan per channel, lihat §6.4 untuk desain final yang benar-benar diimplementasikan.
  - [ ] Modal "Konfirmasi Payout Diterima"
  - **Deliverable:** owner tahu persis uang mana yang belum cair.

- **Minggu 10 — Fase G: Reports**
  - [ ] Dashboard home (5 StatCards + chart)
  - [ ] Laporan Sederhana (`/reports/simple`) + export PDF
  - [ ] Laporan Lengkap (`/reports/detailed`) 6 tabs + export Excel
  - **Deliverable:** owner puas dengan angka bulanan.

- **Minggu 11 — Fase H: Ops Automation**
  - [ ] Cron reminder harian → email via Resend
  - [ ] Backup DB harian via GitHub Actions
  - [ ] Notifikasi in-app (badge di header)
  - **Deliverable:** ops jalan tanpa perlu diingatkan manual.

- **Minggu 12 — Fase I: Polish + Onboarding**
  - [ ] Bug fix dari testing tim
  - [ ] Loading skeleton di semua halaman
  - [ ] Empty state konsisten
  - [ ] Dokumentasi user (screencast pendek)
  - [ ] Training tim
  - **Deliverable:** tim operasional pakai sistem penuh.

---

## 11. Definition of Done per Fitur

Sebelum tandai fitur "selesai", cek:

- [ ] Semua field wajib punya validasi client + server (zod)
- [ ] Semua transaksi keuangan tercatat di `audit_logs`
- [ ] Loading state, empty state, error state semua handled
- [ ] Mobile responsive minimal 375px width
- [ ] Nomor Rupiah pakai `formatIDR()`
- [ ] Tanggal pakai `formatDate()` dengan lokalisasi Indonesia
- [ ] Bahasa UI sesuai glossary section 7.4
- [ ] Server component by default; `"use client"` hanya kalau perlu
- [ ] Type check `npm run typecheck` lolos
- [ ] Lint `npm run lint` lolos
- [ ] Deploy preview di Vercel dan smoke test manual

---

## 12. First Task untuk Claude Code

Kalau kamu (Claude Code) baru pertama kali buka project ini, kerjakan dalam urutan:

1. Baca dokumen ini penuh.
2. Jalankan setup di section 3.3.
3. Buat semua file schema Drizzle di `src/db/schema/*` berdasarkan SQL di section 5.
4. Setup layout dashboard shell (`(dashboard)/layout.tsx`) dengan sidebar navigation ke 6 modul + settings.
5. Buat halaman login + Supabase Auth flow.
6. Konfirmasi ke user hasil setiap fase sebelum lanjut fase berikutnya.

**Jangan** mulai fitur bisnis (procurement, sales, dll) sebelum foundation di atas selesai.

---

## 13. Pertanyaan Terbuka untuk User

Sebelum mulai coding fitur, konfirmasi ke user:

- [ ] Nama domain final yang akan dipakai
- [ ] Nama bisnis/brand untuk logo & judul
- [ ] Warna brand — apakah `#3B4EA0` OK atau ada preferensi lain?
- [ ] Berapa akun bank/rekening yang perlu di-track terpisah?
- [ ] Berapa fee % rata-rata TikTok Shop & Shopee saat ini (untuk `channels.default_fee_pct`)?
- [ ] Berapa hari hold rata-rata dari selesai transaksi sampai bisa dicairkan?
- [ ] Apakah butuh handle retur/refund pembeli? (Kalau ya, tambahkan modul retur di v1.1)
- [ ] Threshold nominal untuk approval Owner (mis. bayar > Rp 5 juta harus Owner)?

---

## 14. Resource Rujukan

- Next.js docs: https://nextjs.org/docs
- Supabase Next.js SSR: https://supabase.com/docs/guides/auth/server-side/nextjs
- Drizzle ORM: https://orm.drizzle.team
- shadcn/ui: https://ui.shadcn.com
- Resend Next.js: https://resend.com/docs/send-with-nextjs
- Tailwind CSS: https://tailwindcss.com/docs
- date-fns: https://date-fns.org

---

**Versi:** 1.0
**Tanggal:** 29 Juli 2026
**Companion documents:**
- `Rancangan-SaaS-Cardigan-Blueprint.docx` (blueprint bisnis lengkap)
- `Panduan-Build-Gratis-Cardigan-SaaS.docx` (panduan build detail dengan alternatif Laravel)
