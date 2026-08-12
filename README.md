# Cardigan Business Operations Suite

SaaS internal untuk mengelola bisnis penjualan kardigan dari pengadaan kain sampai pencairan dana. Lihat [CLAUDE.md](./CLAUDE.md) untuk spesifikasi lengkap.

## Setup Awal

```bash
npm install
cp .env.example .env.local   # isi dengan kredensial Supabase kamu
npm run db:push              # buat semua tabel di database
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Karena belum ada pengguna, kamu akan diarahkan ke `/signup` untuk membuat akun **Owner** pertama. Setelah itu, pendaftaran mandiri otomatis tertutup — pengguna berikutnya (Admin) ditambahkan lewat **Pengaturan → Pengguna** oleh Owner.

## Panduan Cepat Pengguna

**Sebagai Owner, urutan pemakaian normal:**

1. **Pengaturan** — isi dulu data master: Supplier, Penjahit, Produk, Channel (TikTok Live/Shop, Shopee sudah otomatis terisi saat setup), Akun Kas & Bank.
2. **Pemesanan Kain** — catat setiap kali beli kain/hiasan/plastik dari supplier, lalu catat pembayarannya (otomatis masuk ke Arus Kas).
3. **Batch Produksi** — buat batch saat mulai produksi. Termin 1 ke penjahit otomatis dibuat. Setelah selesai, klik "Tandai Selesai" — Termin 2 otomatis dibuat dari sisa biaya.
4. **Penjualan** — input penjualan harian lewat salah satu dari 3 cara: Rekap Live (sesi TikTok Live), Impor CSV (export dari TikTok Shop/Shopee), atau Input Manual (order sporadis).
5. **Pencairan Dana** — klik "Buat Proyeksi Pencairan" secara berkala (atau biarkan cron jalan otomatis) untuk mengelompokkan penjualan yang belum cair. Saat dana benar-benar masuk ke rekening, klik "Payout Diterima" dan cocokkan dengan proyeksinya.
6. **Laporan** — cek Laporan Sederhana untuk ringkasan cepat, atau Laporan Lengkap untuk detail per channel/produk/penjahit dan export Excel.

Semua transaksi keuangan (pembayaran supplier, termin penjahit, pencairan dana) otomatis tercatat di **Arus Kas** — tidak perlu input dobel.

## Automasi (Cron)

Dua cron job jalan otomatis tiap hari lewat `vercel.json` (aktif otomatis setelah deploy ke Vercel):

- `01:00 UTC` (08:00 WIB) — `/api/cron/daily-reminder`: kirim email ke Owner berisi ringkasan hal yang perlu diperhatikan (PO terlambat, termin jatuh tempo, batch mau selesai, dana siap cair).
- `02:00 UTC` (09:00 WIB) — `/api/cron/payout-projection`: mengelompokkan penjualan yang belum cair menjadi proyeksi pencairan per channel.

Untuk menjalankan manual saat development:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-reminder
```

Notifikasi hal-hal yang perlu perhatian juga selalu bisa dilihat lewat ikon lonceng di header aplikasi.

## Development

```bash
npm run dev         # jalankan dev server
npm run typecheck   # cek TypeScript
npm run lint         # cek ESLint
npm run build        # build production
npm run db:generate  # generate migration dari perubahan schema
npm run db:push      # terapkan schema ke database (dev)
npm run db:studio    # buka Drizzle Studio untuk lihat/edit data
```

## Deployment

1. Push ke GitHub, import project di [Vercel](https://vercel.com/new).
2. Set semua environment variable dari `.env.local` di Vercel Project Settings.
3. Deploy — cron job di `vercel.json` otomatis aktif.
4. Tambahkan secret `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan `DATABASE_URL` di GitHub repo Settings → Secrets untuk CI dan backup harian.

Lihat [CLAUDE.md](./CLAUDE.md) bagian 9 untuk detail lengkap setup domain dan backup.
