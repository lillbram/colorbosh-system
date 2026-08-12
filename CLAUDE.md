# Cardigan Business Operations Suite — Claude Code Project Spec

> **Baca dokumen ini secara lengkap sebelum menulis kode apapun.** Semua keputusan teknis, konvensi, dan konteks bisnis ada di sini.

---

## 1. Konteks Bisnis

### Apa yang kita bangun

SaaS berbasis web untuk mengelola bisnis penjualan **kardigan** dari hulu ke hilir:

1. Pengadaan kain roll + hiasan + plastik packing (kadang penjahit yang beli kain sendiri)
2. Produksi (1 minggu, kadang 1x/mgg kadang 2x/mgg) + pembayaran penjahit 2 termin
3. Penjualan multi-channel: **TikTok Live**, **TikTok Shop**, **Shopee** (input manual, tidak ada API integration)
4. Tracking pencairan dana dari TikTok/Shopee (pain point utama — sering tidak jelas kapan cair)
5. Cash flow terpadu (semua uang masuk & keluar)
6. Laporan dalam 2 bentuk: sederhana (1 halaman untuk owner) & lengkap (detail per channel/produk)

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
> Konsekuensinya: **session pooler dibatasi total 15 koneksi untuk seluruh project** (termasuk Supabase Studio, script manual, dsb — bukan cuma app ini). Karena itu `src/db/index.ts` sengaja diset `max: 8`, jangan dinaikkan mendekati 15 tanpa alasan kuat, nanti muncul error `EMAXCONNSESSION: max clients reached in session mode`. Client Postgres juga diset `statement_timeout: 15000` (15 detik) sebagai pengaman tambahan — kalau ada query yang tetap macet, Postgres sendiri yang akan cancel, bukan hang selamanya.

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

> **Catatan:** diagram di bawah sudah disesuaikan dengan kondisi implementasi aktual (Next.js 16 pakai `proxy.ts` bukan `middleware.ts`; Tailwind v4 config via CSS `@theme` di `globals.css`, bukan `tailwind.config.ts`; `reports` sekarang satu halaman dengan 2 tab, bukan 2 folder terpisah).

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
│   │   │   ├── procurement/
│   │   │   │   ├── page.tsx         # list PO
│   │   │   │   ├── new/page.tsx     # form PO baru
│   │   │   │   └── [id]/page.tsx    # detail PO
│   │   │   ├── production/
│   │   │   │   ├── page.tsx         # tabel list batch + filter status/tanggal/pencarian, lihat §6.2
│   │   │   │   ├── production-filters.tsx  # search + date-range client filter, push ke searchParams
│   │   │   │   ├── new/page.tsx     # form batch disederhanakan, lihat §6.2
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── sales/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx    # detail per order, lihat §6.3
│   │   │   │   ├── new/pos/         # Kasir (POS) — mode termudah, lihat §6.3
│   │   │   │   ├── new/live/        # bulk live
│   │   │   │   ├── new/import/      # CSV import
│   │   │   │   └── new/single/      # manual entry
│   │   │   ├── disbursement/
│   │   │   │   ├── page.tsx         # saldo belum cair per channel (bukan kanban lagi, lihat §6.4)
│   │   │   │   └── [channelId]/page.tsx  # riwayat pencairan + penjualan belum cair (estimasi)
│   │   │   ├── cash-flow/
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx         # 1 halaman, 2 tab (Sederhana/Lengkap) via ?view=
│   │   │   │   └── report-tabs.tsx
│   │   │   └── settings/
│   │   │       ├── users/
│   │   │       ├── suppliers/
│   │   │       ├── tailors/
│   │   │       ├── products/
│   │   │       ├── cost-components/ # komponen biaya produksi (kain/hiasan/packing/jahit)
│   │   │       ├── channels/
│   │   │       ├── accounts/
│   │   │       └── categories/
│   │   └── api/
│   │       └── cron/
│   │           └── daily-reminder/route.ts  # cron payout-projection dihapus, lihat §6.4
│   ├── components/
│   │   ├── ui/                      # primitives dibuat manual mengikuti pola shadcn/ui (bukan hasil CLI, lihat §2 catatan)
│   │   ├── stats/
│   │   │   └── stat-card.tsx
│   │   ├── forms/
│   │   │   ├── money-input.tsx      # support controlled `applyValue`
│   │   │   ├── date-input.tsx
│   │   │   ├── bulk-table.tsx
│   │   │   ├── batch-products-table.tsx  # tampilkan Total Qty live, lihat §6.2
│   │   │   ├── live-entries-table.tsx
│   │   │   └── cost-items-table.tsx # rincian biaya batch (katalog + Biaya Tambahan), lihat §6.2
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
│   │       ├── export-pdf-button.tsx
│   │       └── page-skeleton.tsx
│   ├── db/
│   │   ├── index.ts                 # drizzle client — lihat §3.2 soal pooler mode & pool size
│   │   └── schema/
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
│       ├── disbursement.ts          # getChannelBalances() — saldo belum cair per channel, lihat §6.4
│       ├── reports.ts               # semua query aggregate utk dashboard & laporan
│       ├── format.ts                # formatIDR, formatDate
│       ├── validators/              # zod schemas per entity
│       ├── email.ts                 # resend wrapper
│       └── constants.ts             # nav items, enums, config
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
  qty int not null
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

### 6.1 Procurement

- **Kasus khusus penjahit beli kain sendiri:** saat buat batch produksi, ada checkbox "Kain dibeli penjahit". Kalau dicentang:
  - `fabric_source = 'tailor_own'`
  - PO otomatis dibuat dengan supplier = tailor tersebut
  - Biaya kain masuk ke `tailor_payments.amount` (bukan PO payment terpisah)
- Setiap `purchase_order_payments` INSERT → auto INSERT `cash_transactions` (direction=out, related_type=po_payment).
- `qty_received < qty_ordered` → status `partially_received` + flag warning.
- `expected_date < CURRENT_DATE` dan status masih `ordered` → tampil di dashboard "Perlu Perhatian".

### 6.2 Production

**Form "Batch Baru" (`/production/new`) — disederhanakan ke 3 tujuan intinya:**

> ⚠️ **Kenapa disederhanakan:** form aslinya punya dua sumber kebenaran yang tidak saling sinkron — field "Target Qty" manual TERPISAH dari tabel produk (bisa disi angka berbeda dari total tabel), dan "Estimasi Total Biaya" adalah field manual yang diisi lewat kalkulator scratch ("Bantu Hitung Estimasi") yang hasilnya cuma di-copy sekali ke field itu lewat tombol "Gunakan sebagai Estimasi" — rincian komponennya **tidak pernah disimpan**, cuma angka total yang dipakai sesaat untuk hitung Termin 1 lalu hilang. User tidak bisa lihat lagi "biaya ini terdiri dari apa saja" setelah batch dibuat.

1. **Track detail produksi & termin** — penjahit, tanggal mulai/target selesai, sumber kain (toggle "kain dibeli penjahit sendiri"), catatan. Termin 1 auto-created saat batch INSERT — lihat "Termin bisa didefinisikan manual" di bawah untuk cara nominalnya ditentukan.
2. **Track estimasi qty** — HANYA lewat tabel "Produk & Estimasi Qty" (`BatchProductsTable`, komponen `src/components/forms/batch-products-table.tsx`), yang menampilkan Total Qty live di bawah tabel. Tidak ada lagi field "Target Qty" terpisah — `production_batches.target_qty` dihitung server dari `sum(qty)` baris produk yang dikirim (di `createProductionBatch()`, `src/app/(dashboard)/production/actions.ts`).
3. **Track biaya & biaya tambahan** — lewat `CostItemsTable` (`src/components/forms/cost-items-table.tsx`), satu tabel gabungan untuk 2 jenis baris:
   - **Baris katalog**: pilih komponen dari `production_cost_components` (kain/hiasan/packing/jahit) + qty → subtotal auto (qty × harga satuan katalog).
   - **Baris "Biaya Tambahan"**: pilih opsi "Biaya Tambahan (lainnya)" di dropdown yang sama → muncul input label bebas + nominal langsung, untuk biaya di luar katalog (ongkos kirim, biaya rusak, dst).
   - Total selalu tampil live di bawah tabel, tidak perlu tombol "apply".
   - Semua baris (katalog maupun tambahan) **disimpan** ke `production_batch_cost_items`, jadi rincian biaya tetap bisa dilihat di halaman detail batch (`/production/[id]`, card "Rincian Biaya Produksi") — bukan cuma angka total yang hilang setelah submit.

**Termin bisa didefinisikan manual, termin berikutnya otomatis menyesuaikan:**
- Di form "Batch Baru", field **Termin 1 (Rp)** diisi otomatis dengan saran (`% default penjahit × total biaya`), tapi **selalu bisa diketik ulang manual** — begitu user mengetik, saran otomatis berhenti menimpa nilainya (ada link "Pakai saran" untuk kembali ke nilai otomatis). Field "Termin 2 (estimasi sisa)" di sampingnya read-only, live-computed sebagai `total biaya − Termin 1` — bukan disimpan saat ini, hanya preview (Termin 2 baru benar-benar dibuat saat batch ditandai selesai).
- Nilai Termin 1 yang dikirim user (`termin1Amount` di form) **langsung dipakai apa adanya** oleh `createProductionBatch()` — tidak lagi dihitung ulang dari persentase di server.
- Saat batch `finished`, Termin 2 dihitung dari `total biaya (sum production_batch_cost_items) − nominal Termin 1 yang tersimpan saat itu` (bukan reverse-engineer dari persentase).
- Di halaman detail batch (`/production/[id]`), setiap termin yang **belum dibayar** punya tombol edit (ikon pensil, `EditTerminAmountDialog`) untuk mengubah nominalnya kapan saja — termasuk setelah batch selesai. Kalau yang diubah adalah Termin 1 dan Termin 2 sudah ada tapi belum dibayar, Termin 2 **otomatis disesuaikan** supaya keduanya tetap berjumlah sama dengan total biaya. Termin yang sudah berstatus `paid` tidak bisa diubah nominalnya (action `editTerminAmount()` di `src/app/(dashboard)/production/actions.ts` menolak dengan error).
- **Termin 2 selalu ditampilkan**, bahkan sebelum batch selesai (sebelum baris aslinya benar-benar ada di `tailor_payments`) — ditampilkan sebagai baris preview abu-abu berstatus "Belum Dibuat" dengan nominal estimasi (`total biaya − Termin 1 saat ini`), tanpa tombol aksi. Begitu batch ditandai selesai, baris ini berubah jadi baris sungguhan (bisa dibayar/diedit).
- **Pembayaran wajib berurutan**: Termin 2 tidak bisa dibayar sebelum Termin 1 lunas. Kalau ada termin dengan nomor lebih kecil yang belum `paid`, tombol "Bayar Termin X" di-disable dan diganti keterangan "Menunggu Termin Y dibayar". Divalidasi juga di server (`payTailorTermin()`) — kalau tetap dipaksa lewat request langsung, action menolak dengan error "Termin Y harus dibayar dulu sebelum Termin X".

**Halaman list (`/production`) — tabel, bukan kartu:**
- Diganti dari grid kartu menjadi `<Table>` (kolom: Kode Batch, Penjahit, Mulai, Target Selesai, Qty, Status) supaya lebih mudah discan banyak batch sekaligus — pola sama seperti halaman Pemesanan Kain.
- Tab status (`Semua`/`Direncanakan`/`Diproses`/`Selesai`/`Terkirim`) via `?status=`, server-rendered `<Link>` seperti modul lain.
- Filter tambahan lewat `<ProductionFilters />` (client component, `production-filters.tsx`): pencarian teks (kode batch atau nama penjahit, di-debounce 400ms) via `?q=`, dan date-range "Dari Tanggal"/"Sampai Tanggal" yang memfilter `start_date` via `?from=`&`?to=`. Semua filter di-encode ke query string sehingga bisa di-bookmark/share dan tidak hilang saat reload.

**Aturan lain:**
- Batch status → `finished` → auto-create termin 2 (sisa amount).
- HPP per unit = total biaya produksi (dari `production_batch_cost_items`) / `actual_qty`.
- Reminder H+5 dari `start_date`: "Batch [code] target selesai 2 hari lagi".
- `tailor_payments` overdue (due_date < today) → notif ke owner.

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

**Potongan fee platform otomatis:** setiap mode input (POS, Bulk Live, CSV Import, Manual Single) menghitung `platform_fee_est = round(gross_amount × channels.default_fee_pct / 100)` saat order dibuat (`getChannelFeePct()` di `src/app/(dashboard)/sales/actions.ts`) — user tidak perlu menghitung fee manual, dan `net_expected` (kolom generated) otomatis mengurangi fee + diskon dari bruto.

**Detail per order** (`/sales/[id]`): setiap baris di `/sales` bisa diklik (nama produk jadi link) untuk membuka halaman detail — menampilkan channel, produk, qty, harga satuan, rincian Total Bruto/Diskon/Fee Platform (nominal + % yang benar-benar diterapkan saat order dibuat)/Total Bersih, sumber input, no. order, catatan pembeli, siapa & kapan dicatat, serta tombol Batalkan (kalau masih aktif).

**Membatalkan order (semua mode):**
- Setiap baris di halaman `/sales` (dan halaman detail `/sales/[id]`) punya tombol "Batalkan" (icon, dengan dialog konfirmasi) → soft-delete (`is_deleted = true`), tercatat di `audit_logs` dengan action `delete`.
- Order yang sudah **termasuk dalam pencairan dana yang sudah di-reconcile** (ada baris terkait di `payout_sales_link`) **tidak bisa dibatalkan** — action akan menolak dengan pesan error. Ini mencegah pembatalan retroaktif setelah uang benar-benar sudah dicairkan (perlu alur refund terpisah kalau itu terjadi, belum diimplementasikan).
- Khusus order dari Kasir (POS): panel "Rekap Order Hari Ini" punya tombol Batalkan per-order yang membatalkan **semua** baris dengan `order_ref` yang sama sekaligus (satu klik = satu order, bukan per baris produk).
- Membatalkan sebuah sales entry **tidak butuh langkah sinkronisasi apapun** ke modul Pencairan Dana — saldo belum cair per channel dihitung live dari `sales_entries` aktif dikurangi `payouts`, jadi begitu entry di-soft-delete, angkanya otomatis ikut turun di halaman berikutnya di-load. Lihat §6.4.

### 6.4 Disbursement (SOLUSI PAIN POINT UTAMA)

**Konsep (redesign ke-2 — saldo berjalan per channel, bukan lagi "batch" yang harus dicocokkan):**

Setiap channel punya satu angka: `Belum Cair = Total Terjual (aktif, sepanjang waktu) − Total Diterima (sepanjang waktu)`. Tidak ada tabel "expectation" yang perlu di-generate, tidak ada pencocokan jumlah, tidak ada status per-batch. Dihitung live oleh `getChannelBalances()` di `src/lib/disbursement.ts` dari `sales_entries` + `payouts`, dipanggil setiap halaman Pencairan Dana/Laporan/dashboard dibuka.

> ⚠️ **Kenapa didesain ulang lagi (dari model "expectation batch per channel"):** model sebelumnya sudah benar soal grouping-per-channel (lihat riwayat bug periode-kalender yang sudah diperbaiki di iterasi pertama), tapi masih berasumsi payout bisa "dicocokkan" ke satu batch tertentu (±5% match, generate proyeksi manual, dst). Masalah nyata: **TikTok Shop/Shopee tidak pernah memberi rincian order per pencairan** ke seller — pain point utama app ini sejak awal (§1) justru soal ketidakjelasan ini. Kalau user jual Rp 100rb (hari 1) dan Rp 350rb (hari 2), lalu cair Rp 250rb (hari 10), sistem — dan usernya — **tidak pernah benar-benar tahu** transaksi mana yang tercakup. Mencoba memaksakan pencocokan 1:1 hanya menghasilkan kepastian palsu. Solusinya: berhenti mencoba tahu, dan cukup lacak saldo agregat per channel (uang masuk dari penjualan vs uang keluar/diterima dari platform) — itulah satu-satunya angka yang benar-benar diketahui dan dibutuhkan pemilik bisnis.

**Estimasi aging (FIFO, informasional saja — bukan klaim kepastian):**
- Urutkan `sales_entries` aktif channel tsb dari tanggal tertua, "konsumsi" total yang sudah diterima dari yang paling tua.
- Entry pertama yang belum sepenuhnya "tertutup" oleh angka Diterima dianggap `oldestUnpaidDate` — dipakai untuk tampilan "belum cair sejak X hari" dan pengurutan Aging Payout report.
- Selalu dilabeli sebagai estimasi di UI (bagian "Penjualan Belum Cair (estimasi FIFO)" di halaman detail channel) — tidak pernah diklaim sebagai fakta pencocokan.

**Halaman `/disbursement`:**
- Daftar card per channel yang masih `Belum Cair` (outstanding > 0), diurutkan dari saldo terbesar. Section terpisah `Lunas` untuk channel dengan saldo 0.
- Tidak ada lagi tombol "Buat Proyeksi Pencairan" — tidak ada yang perlu di-generate, angkanya selalu live.
- Tombol "+ Payout Diterima" tinggal: channel, tanggal, jumlah, akun tujuan, no. referensi, catatan. Tidak ada lagi langkah "cocokkan dengan proyeksi" — payout langsung mengurangi saldo channel tsb.
- Klik card → `/disbursement/[channelId]`: ringkasan saldo (Total Terjual / Total Diterima / Belum Cair, atau "Lebih Bayar" kalau saldo negatif), riwayat pencairan (dengan tombol Batalkan per baris), dan daftar penjualan belum cair (estimasi FIFO).

**Membatalkan pencairan (void):**
- Tombol "Batalkan" di baris riwayat pencairan (hanya untuk pencairan berstatus Aktif) → soft-delete (`payouts.is_deleted = true`) + soft-delete `cash_transactions` terkait (`related_type = 'payout'`, `related_id` = id payout), tercatat di `audit_logs`. Baris yang sudah dibatalkan tetap tampil di riwayat dengan badge "Dibatalkan" (bukan hilang begitu saja), konsisten dengan pola Aktif/Dibatalkan di halaman Penjualan (§6.3).
- Saldo channel otomatis pulih (naik) setelah payout dibatalkan, karena dihitung live.

**Efek pembatalan sales entry:** tidak ada efek khusus yang perlu di-trigger — membatalkan entry di `/sales` atau Rekap Order Hari Ini POS cukup men-soft-delete baris itu; `getChannelBalances()` otomatis mengeluarkannya dari Total Terjual pada request berikutnya. Kalau ini membuat saldo channel jadi negatif (mis. uang sudah diterima melebihi sisa penjualan aktif), UI menampilkan itu sebagai "Lebih Bayar" (warna merah) di halaman detail channel — bukan error, sekadar informasi untuk owner.

**Dampak ke Laporan & cron:**
- `Uang Belum Cair` (dashboard & Laporan Sederhana) = jumlah `max(0, outstanding)` semua channel.
- Tab "Aging Payout" (Laporan Lengkap) = daftar channel dengan saldo > 0, diurutkan hari-belum-cair terbanyak, pakai estimasi FIFO yang sama.
- Cron `payout-projection` (yang dulu menjalankan generate proyeksi harian) **dihapus** — tidak relevan lagi di model ini. `vercel.json` tinggal cron `daily-reminder`, yang sekarang mengirim daftar channel dengan saldo belum cair langsung dari `getChannelBalances()`.

**Konfirmasi payout:**
1. Tombol "+ Payout Diterima" → modal
2. Isi: channel, tanggal, jumlah aktual, akun tujuan, nomor referensi bank, catatan
3. Simpan → INSERT `payouts` (tanpa link ke expectation apapun — lihat catatan redesign di atas) + INSERT `cash_transactions` (direction=in)
4. Saldo channel (`getChannelBalances()`) langsung turun sebesar jumlah yang diterima pada request berikutnya — tidak ada langkah pencocokan/approval terpisah.

### 6.5 Cash Flow

- Semua auto-inserts dari modul lain (PO payment, tailor payment, payout).
- Halaman `/cash-flow` = filter + list transaksi + saldo per akun.
- Manual entry untuk pengeluaran operasional (listrik, sewa, gaji).

### 6.6 Reports

**Sederhana** (`/reports/simple`):
- 5 StatCard: Saldo Kas, Penjualan Bulan Ini, Uang Belum Cair, Profit Estimasi, Top Produk
- 1 line chart (30 hari, per channel)
- Tombol "Export PDF"

**Lengkap** (`/reports/detailed`):
- Tabs: P&L | Per Channel | Per Produk | Cash Flow | Per Penjahit | Aging Payout
- Filter periode (7/30/90 hari, MTD, LTM, custom)
- Export Excel per tab (pakai `xlsx` library)

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
| Pemesanan Kain | Purchase Order | Menu utama |
| Batch Produksi | Work Order | Menu utama |
| Termin 1 / Termin 2 | First installment | Pembayaran penjahit |
| Rekap Live | Sales session bulk | Input penjualan |
| Uang Belum Cair | Pending disbursement | Modul pencairan |
| Sudah Cair | Reconciled payout | Modul pencairan |
| Laporan Sederhana | Executive summary | Modul laporan |
| Laporan Lengkap | Detailed report | Modul laporan |

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

Buat `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/daily-reminder", "schedule": "0 1 * * *" }
  ]
}
```

> Cron `payout-projection` yang dulu ada di sini sudah dihapus — model Disbursement sekarang menghitung saldo belum cair live, tidak ada lagi proyeksi yang perlu di-generate berkala. Lihat §6.4.

Protect cron endpoint dengan `CRON_SECRET`:

```ts
if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

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
