# Colorbosh System — Development Spec v2 (21 Nov 2026)

> **For Claude Code, working in `colorbosh-system`.**
> 1. Read `CLAUDE.md` in full first — it is the source of truth for stack, conventions and history (REVAMP notes, pooling rules, `withTransaction`/`withAudit`, `tx` inside transactions, Indonesian UI glossary). This spec **adds** work on top of it; where they conflict, ask the owner.
> 2. Work phase by phase (§4). For each phase: propose a short plan (files to touch, migrations), wait for the owner's OK, implement, run `npm run typecheck && npm run lint`, then **update `CLAUDE.md`** (relevant §5/§6 sections + REVAMP notes) so it stays accurate.
> 3. Never drop tables or columns with data. Migrations via `npm run db:generate` → review SQL → `npm run db:push`. Keep historical rows readable.
> 4. UI text stays in everyday Indonesian (CLAUDE.md §1 "Prinsip UX", §7.4 glossary).

---

## 0. Business context (what changed since CLAUDE.md was written)

- **Brand:** Colorbosh (women's wear: cardigans, sweaters, tanktops). The app still says "Cardigan Biz / Cardigan Business Suite".
- **Channels in use:** TikTok Live (~94% of sales), Shopee, Paket Usaha (WhatsApp wholesale).
- **Users:** Owner (Bram) and Admin (Shinthya). Admin works mostly **from a phone**.
- **Admin's salary = monthly net profit after returns** (currently 100%). The owner needs to see salary entitlement vs paid vs remaining per month.
- **Tailor:** Sri Ratih (BCA 5245110232) — production payments (a `tailors` table already exists, dormant).
- **Current reality:** the owner treats **Penjualan** as the source of truth. **Arus Kas has not been updated since Aug 2026** (only manual entry exists, so admin stopped). Payment proofs are BRImo screenshots posted in a WhatsApp group.
- **Owner's offline spreadsheet** ("Colorbosh – Modal Berjalan & Gaji Shinthya") currently computes working capital, returns and salary — the goal is to move that logic into the app.

### Reference numbers (use in unit tests)

| | Oct 2026 | Nov 1–18 2026 |
|---|---|---|
| Penjualan (Σ `gross_amount`, active rows) | 25,152,402 | 15,428,604 |
| HPP (Σ qty × `hpp_target`) | 17,420,000 | 10,197,000 |
| Laba kotor | 7,732,402 | 5,231,604 |
| Return loss (refund − HPP, 13 / 5 returns) | 331,362 | 166,056 |
| Laba bersih (= salary entitlement at 100%) | 7,401,040 | 5,065,548 |
| Salary paid (as of 20 Nov) | 6,618,000 | 0 |

`platform_fee_est` is 0 on these rows (channels have no `default_fee_pct`, and TikTok Live prices are entered as roughly the settled amount, e.g. Rp51.000 for "Cardigan Kancing Tiktok").

---

## 1. Audit findings mapped to code

### 1.1 Owner
| # | Sev | Finding | Where |
|---|---|---|---|
| O1 | 🔴 | **Laporan Lengkap → P&L "Laba Estimasi" = Penjualan Bersih − Operasional, HPP not subtracted** (30 days showed Rp23,176,364 ≈ revenue). Documented as intentional in CLAUDE.md §6.6, but owners read it as profit → misleading ~3×. | `getPnLSummary()` in `src/lib/reports.ts`, `reports/report-tabs.tsx` |
| O2 | 🔴 | **Saldo Kas stale** (Rp2,944,449 from Aug) on Dashboard & Laporan Sederhana with no "last updated" hint. | `getSaldoKas()`, `(dashboard)/page.tsx`, reports |
| O3 | 🔴 | **No stock.** `products` has no qty; `production_batch_products.actual_qty` is dormant. | `src/db/schema/master.ts` |
| O4 | 🔴 | **No working-capital view**: marketplace pending balance, stock value, salary payable don't exist. | new |
| O5 | 🟠 | **Returns not recorded** (Retur tab empty; 18 TikTok returns Oct–Nov). Root cause: `is_returned` is a whole-row flag, but rows are **aggregates** (e.g. qty 19) → a 1-pcs return can't be marked. | `sales_entries.is_returned`, `returnSalesEntry()` |
| O6 | 🟠 | Dashboard "vs bulan lalu" compares partial current month with full previous month (shows −39%). | `(dashboard)/page.tsx` |
| O7 | 🟠 | No picker for a specific past month (only Hari Ini/7/30/90/Bulan Ini/12 Bulan/custom). | `reports/page.tsx` period presets, `sales/page.tsx` |
| O8 | 🟡 | Fee/discount always 0 → unclear whether price = list or settled. | `channels.default_fee_pct` |
| O9 | 🟡 | "Uang Masuk 7 Bulan Terakhir" chart empty (driven by stale cash data). | `getMonthlyRevenueTrend()` / dashboard chart |
| O10 | 🟢 | Branding "Cardigan Biz". | layout, sidebar, `<title>` |

### 1.2 Admin
| # | Sev | Finding | Where |
|---|---|---|---|
| A1 | 🔴 | **Daily aggregate rows instead of per-order rows** for TikTok Live (POS used as a daily tally: one row "Cardigan Kerah ×19" per day). TikTok Return IDs / Order IDs can't be matched. | usage of `/sales/new/pos`, `/sales/new/live` |
| A2 | 🔴 | **Arus Kas abandoned**: only manual entry; categories lack Gaji / Bagi Hasil / Retur / Prive / Bahan / Ongkir / Iklan / Biaya Bank; old rows misclassified (transfers from Shinthya as "Pencairan Dana"). | `categories`, `cash-flow/*` |
| A3 | 🟠 | **Duplicate products per channel** ("Cardigan Kancing Tiktok", "Cardigan kancing Paket Usaha", "Cardigan Shopee"); sales history references products no longer in the list ("Tanktop Coquette Satuan", "sale cardi", "TEBUS MURAH BALIK MODAL" — likely soft-deleted). | `products` |
| A4 | 🟠 | SKU & Kategori empty on all products. | `products.sku`, `products.category` |
| A5 | 🟡 | 4 input modes, no rule which to use → double-entry risk. | `/sales` landing cards |
| A6 | 🟡 | Receipt OCR exists (`tesseract.js` + `parseBrimoReceipt()` in `src/lib/receipt-parser.ts`, used in `manual-entry-dialog.tsx`) but: no bank ref capture, no category/period suggestion, no duplicate guard, no share-from-WhatsApp, runs client-side (slow on phones). | `receipt-parser.ts` |
| A7 | 🟡 | Mobile: `/sales` table overflows horizontally (profit/status hidden); 4 big input cards fill the first screen. Bottom nav exists (`bottom-nav.tsx`) but no quick "+" action. | `sales/page.tsx`, `components/layout/*` |
| A8 | 🟡 | Role separation: `users.role` (owner/admin) exists, but verify that admin is actually blocked from owner-only data (profit, salary, settings) server-side — no role checks found in `src/lib/auth.ts` / `proxy.ts`. | `lib/auth.ts`, server actions |

---

## 2. Schema changes (Drizzle, additive only)

```ts
// master.ts
products:   + (no new columns; enforce sku NOT NULL for active products via UI validation, not DB, until backfilled)
productAliases (new): id, productId → products.id, alias text unique  // legacy names → canonical product
channels:   reuse defaultFeePct (allow 0); no change
categories: seed new system rows (isSystem=true):
            expense: "Gaji", "Bagi Hasil", "Prive", "Bahan", "Ongkir", "Iklan", "Biaya Bank", "Pembayaran Penjahit"(exists?)
            income:  "Pencairan TikTok", "Pencairan Shopee", "Setoran Grosir", "Modal Masuk"
settings (new, single row): salaryPct numeric default 1.00, returnReservePct default 0, capitalReservePct default 0,
            lowStockThreshold int default 10

// sales.ts
salesReturns (new):
  id, salesEntryId → sales_entries.id (nullable until matched), channelId, productId,
  externalReturnId text unique (TikTok "Return Order ID"), externalOrderId text,
  requestedAt timestamptz, refundedAt timestamptz null,
  qty int, refundAmount numeric(12,2), hppPerUnit numeric(12,2) (snapshot of products.hpp_target),
  restock boolean default true, status enum('processing','completed','rejected'),
  reason text, buyerNote text, source enum('tiktok_import','manual'),
  createdAt, createdBy, isDeleted
  // Keep sales_entries.is_returned for whole-row returns (legacy). New partial returns live here.

// inventory.ts (new file)
stockMovements: id, productId, movementDate date, type enum('opening','production_in','sale_out','return_in','adjustment','opname'),
  qty int (signed), refType text, refId uuid, note, createdAt, createdBy
  // current stock = Σ qty per product. sale_out is written by sales actions inside the same tx.

// cashflow.ts
cashTransactions: + bankRef text (unique where not null and not deleted), + periodMonth text 'YYYY-MM' (salary allocation),
                  + counterparty text, + source enum('manual','bulk_excel','bank_csv','receipt_scan') default 'manual',
                  + status enum('draft','confirmed') default 'confirmed'
cashRelatedTypeEnum: + 'salary' (keep existing values)

marketplaceBalanceSnapshots (new): id, channelId, snapshotDate, awaitingDelivery, settlementProcessing,
  refundProcessing numeric(14,2), note, createdBy
```

Also add these tables to `supabase/rls-policies.sql` (owner full; admin CRUD on operational ones, read-only on `settings`, no access to salary views).

---

## 3. Finance logic — one module

Create `src/lib/finance.ts` (server-only). Reuse from Dashboard, Laporan, Penjualan, new pages. Every helper callable inside a transaction must accept `tx` (CLAUDE.md §3.2 #4).

```text
revenue(period)        = Σ net_expected (sales_entries active, not is_returned, not deleted)
hpp(period)            = Σ qty × products.hpp_target  (same rows)
grossProfit            = revenue − hpp
returnLoss(period)     = Σ sales_returns (status ≠ rejected, requestedAt in period):
                           refundAmount − (restock ? hppPerUnit × qty : 0)
opex(period)           = Σ cash_transactions out, categories ∉ {Gaji, Bagi Hasil, Prive, Pembayaran Penjahit, Bahan}
                         // production & owner draws are not operating expenses
netProfit              = grossProfit − returnLoss − opex
capitalReturned        = hpp(period)                // "modal barang kembali"
tailorPaid(period)     = Σ cash out, category ∈ {Pembayaran Penjahit, Bahan}
capitalNotReinvested   = capitalReturned − tailorPaid

salaryEntitlement(m)   = max(0, netProfit(m)) × settings.salaryPct
salaryPaid(m)          = Σ cash out, category Gaji, periodMonth = m
salaryRemaining(m)     = entitlement − paid
  // allocation: a Gaji transfer without periodMonth goes to the OLDEST month with remaining > 0

stockValue(date)       = Σ_products (Σ stock_movements.qty ≤ date) × hpp_target
workingCapital(date)   = bankBalance + latest marketplace snapshot (awaiting + settlementProcessing)
                         + stockValue − Σ salaryRemaining (all months)
```

- Returns are attributed to the month they were **requested** (matches the owner's sheet).
- Period comparison: same day-range of previous month ("1–18 Nov vs 1–18 Okt").
- Unit tests (add a lightweight runner if none exists, e.g. `node --test` with `tsx`) using §0 numbers.

---

## 4. Phases

### Phase 1 — Correct numbers (small, high impact)
1. **P&L (O1):** `getPnLSummary()` → add HPP and returns: Total Penjualan → Diskon → Fee Platform → Penjualan Bersih → **HPP** → **Laba Kotor** → **Rugi Retur** → Operasional → **Laba Bersih**. Delegate to `finance.ts`. Update the InfoTooltip and CLAUDE.md §6.6 (remove the "not subtracted HPP" rule). `getProfitEstimasi()` should call the same module so Dashboard = Laporan = Penjualan.
2. **Stale saldo (O2):** `getSaldoKas()` also returns `lastTxnDate`; StatCard shows "Terakhir dicatat: dd MMM" and turns amber if > 7 days.
3. **Month picker (O7):** add `?month=2026-10` to `/sales`, `/reports`, Dashboard; label "Oktober 2026". Keep existing presets.
4. **Fair comparison (O6):** previous-period = same number of days.
5. **Categories (A2):** seed migration for the categories in §2 (idempotent, `isSystem=true`).
6. **Branding (O10):** "Colorbosh" name, title, sidebar; logo/favicon placeholder in `public/` (owner will supply files).
7. **Role guard (A8):** `requireRole("owner")` helper in `src/lib/auth.ts`; apply to reports P&L, salary, settings actions & pages.

**Done when:** Oct 2026 P&L shows Laba Kotor 7,732,402; after Phase 2 return import, Laba Bersih 7,401,040.

### Phase 2 — Products, stock, returns
1. **Product cleanup (A3/A4):** Settings > Produk gets "Gabungkan produk" (merge B into A: re-point `sales_entries.product_id`, add alias, soft-delete B, audit log). Show soft-deleted products still referenced by sales with a "Perlu dipetakan" badge. SKU required for active products in the form.
2. **Stock (O3):**
   - `stock_movements` writes: `sale_out` in every sales insert path (POS, Live, Manual, CSV) inside the same `withTransaction`; reversal on Batalkan; `return_in` on return with `restock`.
   - New page **`/stock`** ("Stok"): per product current qty, value (qty × HPP), low-stock badge.
   - **Stok Masuk** dialog (`production_in`): product, qty, date, optional link to a tailor payment (cash txn).
   - **Stock opname** (`/stock/opname`): enter physical count per product → shows difference → confirm writes `opname` movements.
   - Opening balance: one-time `opening` movement per product (owner enters current counts).
   - Add "Stok" to `MAIN_NAV` in `src/lib/constants.ts`.
3. **Returns (O5):**
   - **Import TikTok returns** at `/sales/returns/import`: file "Pesanan_yang_Barang_Dananya_Dikembalikan-*.xlsx" (single sheet, header row 1). Columns: `Return Order ID, Order ID, Order Amount, Order Status, Order Substatus, Payment Method, SKU ID, Seller SKU, Product Name, SKU Name, Buyer Username, Return Type, Time Requested, Return Reason, Return unit price, Return Quantity, Return Logistics Tracking ID, Return Status, Return Sub Status, Refund Time, Dispute Status, Appeal Status, Compensation Status, Compensation Amount, Buyer Note`.
     - IDs are long numeric strings → read as text (`raw: false`), never as numbers.
     - Money like `"Rp54.048"` → 54048. Dates `dd/MM/yyyy HH:mm:ss` (Asia/Jakarta).
     - Status map: `Completed`→completed; `To Process`→processing; `Return Sub Status = Request Canceled` or `Return Status = Refund rejected`→rejected.
     - Product mapping: Seller SKU → products.sku, else Product Name via `product_aliases`, else ask in preview.
     - Upsert by `externalReturnId`; preview with valid/invalid rows like the existing CSV import.
   - **Manual partial return** on `/sales/[id]`: "Retur sebagian" (qty ≤ row qty, refund amount) → `sales_returns` row (+ `return_in` movement if restock).
   - Retur tab in `/sales` lists `sales_returns` (plus legacy `is_returned` rows).

### Phase 3 — Per-order sales & TikTok order import (A1/A5)
1. **Input rules (A5)**, shown as helper text on `/sales`: TikTok → Impor (or Rekap Live for a same-day estimate, later replaced by import); Shopee & Paket Usaha → Kasir (POS); corrections → Manual.
2. **TikTok order import** in the existing `/sales/new/import` (`csv-import-form.tsx`): add a **"Preset TikTok Seller Center"** mapping so admin doesn't map columns. Dedupe already via `(channel, order_ref, product)` unique.
3. **TikTok income/settlement import** (new, `/sales/settlements/import`): workbook sheet "Detail pesanan" — col A ID Pesanan, D waktu pembayaran (text `YYYY/MM/DD`), F jumlah penyelesaian (settled), H subtotal setelah diskon penjual, O total biaya (negative fees). All cells are TEXT. Update matching `sales_entries` by `order_ref`: `platform_fee_est = |O|` (store actual), keep `gross_amount = H`. Unmatched orders listed for review.
4. **Rekap Live reconciliation:** when an import covers a day that has `live_bulk` aggregate rows, offer "Ganti rekap live dengan data impor" (soft-delete aggregates for that day/channel after confirmation) to avoid double counting.

### Phase 4 — Working capital & salary (O4)
1. **`/capital` "Modal Berjalan"** (owner): cards Kas Bank · Saldo Marketplace (from latest snapshot, form to add a snapshot: Menunggu paket diterima / Penyelesaian diproses / Pengembalian diproses — last one excluded from total) · Nilai Stok · Sisa Gaji → **Modal Berjalan**. Weekly trend chart.
2. **`/salary` "Gaji"** (owner only): per month: Laba Bersih, % gaji (from settings), Hak Gaji, Sudah Dibayar (list of Gaji cash txns with date/amount/proof), Sisa, badge LUNAS/BELUM LUNAS. Allocation rule from §3.
3. **Tutup Buku** (owner): button per month "Kunci bulan ini" → stores a snapshot (JSON) of the month's numbers in a new `month_closings` table; locked months show the snapshot; edits to sales/cash in a locked month require owner + audit note. Export to Excel (reuse `xlsx`).
4. Settings > Umum: `salaryPct`, reserves, `lowStockThreshold`.

### Phase 5 — Mobile admin (A7)
1. **PWA:** `src/app/manifest.ts` (Next metadata route) with name "Colorbosh", icons (192/512, maskable), `display: "standalone"`, theme color; minimal service worker for app-shell caching (no offline writes). Add `share_target` (POST, `multipart/form-data`, accepts `image/*`) → route `/cash-flow/receipt` so admin can **Share a screenshot from WhatsApp straight into the app**.
2. **Login:** long-lived Supabase session (refresh on activity; 30-day "Ingat perangkat ini"); add **6-digit PIN quick unlock** after first login (hashed per user, stored server-side) — or passkeys if simple with the current Supabase setup. Keep email/password as fallback.
3. **Bottom nav** (`bottom-nav.tsx`): Beranda · Penjualan · **(+)** · Stok · Kas. The (+) opens a sheet: Catat Penjualan / Rekap Live / Stok Masuk / Upload Bukti.
4. **Fast POS on phone:** last-used channel preselected; product cards with +/− steppers; sticky total bar; ≤ 3 taps for a repeat sale.
5. **Rekap Live mobile:** all active products listed with qty steppers (no add-row), total preview, single confirm.
6. **Card list < 768px** on `/sales`, `/cash-flow`, `/stock` (product, qty, total, profit (owner only), channel, status badge); tables stay on desktop. Move the 4 input cards behind the (+) on mobile.
7. **"Hari Ini" summary** at the top of Dashboard for admin: terjual, omzet, stok menipis.

### Phase 6 — Payment proof capture (A6)
Upgrade the existing receipt scan instead of replacing it.

1. **Flow:** `/cash-flow/receipt` (also the PWA share target) → upload image to Supabase Storage (private bucket `proofs/`) → server action extracts data → pre-filled form (date/time, amount, admin fee, direction, counterparty, bank ref, catatan, **suggested category**, **suggested periodMonth** for Gaji) → admin taps **Simpan** → `cash_transactions` with `proofUrl`, `bankRef`, `source='receipt_scan'`.
2. **Extraction:** keep `parseBrimoReceipt()` (extend it to read `No. Ref`, `Biaya Admin`, `Jenis Transaksi`, recipient bank/account). Add optional **Claude vision** server-side when `ANTHROPIC_API_KEY` is set and OCR confidence is low or fields are missing (see §5.1). Move OCR to server or keep client tesseract only as fallback — phones are slow.
3. **Duplicate guard:** if `bankRef` exists → open the existing record instead of creating a new one.
4. **Categorization rules** (`src/lib/cash-rules.ts`, editable later in Settings):

   | Match | Category | Extra |
   |---|---|---|
   | counterparty ~ "SHINTHYA" AND catatan ~ /gaji\|gajian/i | Gaji | periodMonth = oldest unpaid |
   | counterparty ~ "SHINTHYA" otherwise | Operasional | status draft + "perlu dicek" |
   | counterparty ~ "SRI RATIH" or account 5245110232 | Pembayaran Penjahit | |
   | catatan starts with `GAJI-`, `JAHIT`, `OPS-`, `BAHAN`, `IKLAN` | that category | `GAJI-NOV` → periodMonth 2026-11 |
   | "BRIVA ke SHOPEE"/"TOKOPEDIA" outgoing | Ongkir (review) | |
   | incoming "Bank Lain - 207678920099 - Tokopedia" | Pencairan TikTok | |
   | "QRIS … SPBU" | Operasional | |
   | "Biaya admin BI-Fast", "Admin Fee", "Monthly Fee ATM" | Biaya Bank | |

   Example (real): BRImo, 20 Nov 2026 13:14:21, Rp165.000, No. Ref 255592296983, to SHINTHYA INDRIA YANA, catatan "gajian shintya", admin Rp0 → Gaji, period = oldest unpaid month.
5. **Bank statement import** (source of truth for Arus Kas): extend `/cash-flow/bulk-import` with a **"BRImo e-Statement CSV"** preset. Columns: `ID, NOREK, TGL_TRAN, TGL_EFEKTIF, JAM_TRAN, SEQ, DESK_TRAN, SALDO_AWAL_MUTASI, MUTASI_DEBET, MUTASI_KREDIT, SALDO_AKHIR_MUTASI, GLSIGN, TRUSER, KODE_TRAN, KODE_TRAN_TELLER, TRREMK, TLBDS1, TLBDS2, REMARK_CUSTOM`.
   - Description = `REMARK_CUSTOM`; direction from `GLSIGN` (`Db`/`Cr`); dedupe key `NOREK|TGL_TRAN|SEQ|MUTASI_DEBET|MUTASI_KREDIT` stored in `bankRef` (prefixed `brimo:`). Fee rows (Rp2.500/Rp250/Rp6.500) share SEQ with their transfer → separate row, category Biaya Bank.
   - Apply rules from (4); rows matching an existing receipt-scan entry (same date, amount, counterparty) → attach instead of insert.
   - After import, account balance should equal the last `SALDO_AKHIR_MUTASI` — show a check.
6. **"Belum ada bukti"** filter on `/cash-flow`: confirmed outgoing rows without `proofUrl`.

### Phase 7 — Claude inside the app (optional, after 1–6)
- `src/lib/claude.ts` server-only, `ANTHROPIC_API_KEY` in env (+ `.env.example`), current Claude model from the Anthropic API docs. Log usage, never send images to logs.
- **Daily recap** (after imports or on demand on Dashboard, owner only): pass the numbers computed by `finance.ts` (Claude must not recompute) → return JSON `{summary: string[] (Indonesian, ≤6 bullets), anomalies: [{type: 'price_without_hpp'|'negative_margin'|'return_spike'|'low_stock'|'stale_cash', detail}], actions: string[]}`.
- **"Tanya Keuangan"** (owner): chat that can only call read-only functions (`getPnL(month)`, `getWorkingCapital(date)`, `getSalary(month)`, `getReturns(month)`, `getStock()`).

### Phase 8 — TikTok Shop API (future)
Register in TikTok Shop Partner Center as **Seller (in-house) developer** (Indonesian shops: docs under partner.tokopedia.com). OAuth tokens encrypted in DB with refresh; webhooks for order & reverse/return status (verify HMAC-SHA256, dedupe by notification id) → upsert `sales_entries` / `sales_returns`; Finance API → settlements & marketplace balance snapshots. Keep file imports as fallback.

---

## 5. Prompts

### 5.1 Receipt extraction (Claude vision, server-side)
```text
Extract data from an Indonesian bank/e-wallet transfer receipt screenshot (BRImo, BCA, Mandiri, DANA, QRIS...).
Return ONLY JSON:
{"datetime":"YYYY-MM-DDTHH:MM:SS","amount":int,"admin_fee":int,"direction":"out"|"in",
 "sender_name":str|null,"recipient_name":str|null,"recipient_bank":str|null,"recipient_account":str|null,
 "bank_ref":str|null,"note":str|null,"transaction_type":str|null,"confidence":0..1}
Rupiah as integers without separators. Use null for anything not visible. Never guess amounts.
```
Category and period come from `cash-rules.ts`, not from the model.

---

## 6. Non-functional
- Money stays `numeric` in DB; convert with `Number()` only at the edge as today; display via `formatIDR()`.
- Timezone Asia/Jakarta for all date boundaries (month filters, imports).
- Every import: preview → confirm → idempotent upsert → summary (inserted / updated / skipped / invalid).
- `withAudit()` for single edits, `withTransaction()` for bulk (CLAUDE.md §6.5 pattern). Helpers inside transactions take `tx`.
- Do not raise `postgres()` `max` above 1 (CLAUDE.md §3.2).
- Mobile check at 375 px for every new screen.

## 7. Suggested order & definition of done
Phase 1 → 2 → 5 (PWA, login, mobile input) → 6 → 3 → 4 → 7 → 8.

Done per phase: typecheck + lint pass; numbers match §0 for Oct/Nov 2026; works at 375 px; owner-only data blocked for admin server-side; `CLAUDE.md` updated; no data loss in existing `sales_entries` / `cash_transactions`.
