# 🔍 Pemahaman & Sanity Check — Analisis Alur Baglog WMS

**Sumber:** [`ANALISIS_ALUR_BAGLOG_WMS.md`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/ANALISIS_ALUR_BAGLOG_WMS.md)
**Cross-ref:** Kode aktual branch `develop` (post Logic Hardening F-01 s/d F-16)
**Tanggal review:** 2 Oktober 2026
**Update:** 2 Oktober 2026 — Keputusan desain dijawab, skill ECC/Ponytail relevan ditambahkan

---

## 1. Ringkasan: Dokumen Ini Tentang Apa?

Dokumen `ANALISIS_ALUR_BAGLOG_WMS.md` mengaudit **siklus hidup baglog** dari ujung ke ujung di sistem Smart Shroom SCM:

```
Baglog Datang → Didaftarkan → Dinomori → Ditempatkan di Rak → 
Masalah Dicatat → Panen Dicatat → Baglog Habis → Slot Dibebaskan
```

Pertanyaan utama: **"Apakah sistem bisa melacak satu baglog dari lahir sampai mati?"**

**Jawaban audit: BELUM BISA.** Siklus hidup baglog tidak pernah selesai di sistem. Baglog yang sudah mati/habis tetap "menghantui" database selamanya. Tiga masalah inti:
1. Form panen tidak mengirim `slot_code`, `flush_number`, `quality_grade`
2. Tidak ada mekanisme akhir hidup (slot tidak pernah bebas, batch tidak pernah selesai)
3. KPI dihitung dari angka yang tidak mengikuti siklus hidup

---

## 2. Cross-Reference Temuan vs Kode Aktual

### 🔴 P0 — Critical (Alur Putus / Data Tidak Bisa Dipercaya)

#### W-01 — Form Panen "Buta Slot"
- **Klaim:** Form panen hanya kirim tanggal, batch, berat — tanpa slot/flush/grade
- **Verifikasi:** ✅ TERKONFIRMASI
  - [`HarvestService.php:20-24`](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Services/HarvestService.php#L20-L24) → cuma `store()` tanpa validasi
  - [`StoreHarvestRequest.php:23-25`](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Http/Requests/StoreHarvestRequest.php#L23-L25) → semua `nullable`
  - Frontend → `slot_code` tidak ditemukan di komponen Harvest

#### W-02 — Slot Tidak Pernah Bebas / Batch Tidak Pernah Selesai
- **Klaim:** Tidak ada status `completed` di enum batch, tidak ada `completed_at`, tidak ada tombol di UI
- **Verifikasi:** ✅ TERKONFIRMASI
  - Model assignment **sudah** punya `STATUS_COMPLETED` sebagai konstanta, tapi batch-level enum hanya `active|contaminated|disposed`
  - [`BatchSlotAssignmentController.php:107-108`](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Http/Controllers/Api/BatchSlotAssignmentController.php#L107-L108) → status bisa diubah ke COMPLETED via API, tapi **UI tidak punya tombol**

#### W-03 — KPI "Baglog Aktif" = Angka Menyesatkan
- **Klaim:** `active_baglogs = SUM(quantity)` tanpa dikurangi afkir
- **Verifikasi:** ✅ TERKONFIRMASI
  - [`DashboardService.php:31`](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Services/DashboardService.php#L31) → `BaglogBatch::active()->sum('quantity')`

#### W-04 — Alokasi Tanpa Rekonsiliasi Jumlah
- **Klaim:** Batch 95 baglog bisa tercatat 100 di rak; `max_capacity` tidak dipakai
- **Verifikasi:** ✅ TERKONFIRMASI
  - [`BatchSlotAssignmentController.php:33`](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Http/Controllers/Api/BatchSlotAssignmentController.php#L33) → `initial_quantity` hanya `min:1|max:20`, tanpa cek total
  - Cek keterisian di luar transaksi → race condition possible

### 🟡 P1 — Logika Salah / Berisiko

| ID | Klaim | Status | Catatan |
|---|---|---|---|
| W-05 | Tiga definisi umur yang tidak konsisten | ⚠️ Sebagian valid | Angka ambang di badge **sudah berubah** pasca Logic Hardening (35/110/130 vs 14/90/110 di dokumen) |
| W-06 | Kontrak badge UI↔backend tidak cocok | ✅ Valid | Backend kirim `color`, UI expect `dot`/`class` |
| W-07 | Lima celah pencatatan afkir | ✅ Valid | Semua 5 celah terkonfirmasi |
| W-08 | Backend panen tanpa validasi | ✅ Valid | `HarvestService::createHarvest` = `store()` polos |
| W-09 | Tidak ada mekanisme koreksi/void | ✅ Valid | Hanya GET/POST, tanpa UPDATE/DELETE |
| W-10 | Status bebas lompat, bisa dibuka kembali | ✅ Valid | Tanpa matriks transisi |

### 🟢 P2 — Kelemahan Terukur

| ID | Status |
|---|---|
| W-11 (Validasi tanggal) | ✅ Valid |
| W-12 (Kode batch race) | ✅ Valid |
| W-13 (Harga fallback 3000) | ✅ Valid |
| W-14 (Overhead dibagi rata) | ✅ Valid — bisa diterima sebagai batasan desain TA |
| W-15 (N+1 query) | ✅ Valid — ~600 query per load grid |
| W-16 (Heatmap tidak dinormalisasi) | ✅ Valid |
| W-17 (Penjualan tanpa validasi stok) | ✅ Valid |

---

## 3. State Machine yang Diusulkan — Apakah Masuk Akal?

**YA, sangat masuk akal.** Alasan:

```
Sekarang (tanpa transisi otomatis):
  INCUBATION ←→ FRUITING ←→ COMPLETED (bebas lompat, bisa balik)

Usulan (deterministik):
  [*] → INCUBATION → FRUITING → COMPLETED → [*]
  (final, tidak bisa dibuka kembali, koreksi via void)
```

1. **COMPLETED final** → Mencegah slot zombie yang dibuka kembali lalu tabrakan dengan assignment baru
2. **Panen pertama → FRUITING otomatis** → Menghilangkan langkah manual yang sering dilupakan
3. **Kapasitas 0 → COMPLETED otomatis** → Saat semua baglog habis, slot otomatis tutup
4. **Koreksi via void** → Konsisten dengan prinsip ledger

---

## 4. Urutan Pengerjaan — Apakah Masuk Akal?

**YA.** Prinsip "tangkap data → mesin → turunan → rapikan" = benar secara teknis.

| Fase | Target | Mengapa Urutan Ini | Status Implementasi |
|---|---|---|---|
| A. Data Masuk Benar | W-01, W-04, W-07, W-08, W-11 | KPI/badge/heatmap tidak berguna kalau data input sampah | ✅ Selesai (`WmsPhaseATest`: 11 tests) |
| B. Mesin Siklus Hidup | W-02, W-10 | Butuh data dari A yang benar | ✅ Selesai (`WmsPhaseBTest`: 5 tests) |
| C. Angka Turunan | W-03, W-05, W-06, W-15 | Butuh A+B benar dulu | ✅ Selesai (`WmsPhaseCTest`: 5 tests) |
| D. Koreksi & Rapikan | W-09, W-12, W-13, W-14 | Koreksi via void, sequence safety & price fallback | ✅ Selesai (`WmsPhaseDTest`: 6 tests) |

> **Status Suite Pengujian Pasca-Implementasi (2 Oktober 2026):**
> - **Total Test Suite:** 168 tests, 591 assertions, 100% Passed.
> - **Frontend Build:** `tsc -b && vite build` lolos tanpa error (1.19s).

---

## 5. Catatan Penting — Delta Pasca Logic Hardening

Dokumen analisis berbasis commit `8187915` (27 Sep 2026). Logic Hardening (F-01 s/d F-16) dilakukan **setelahnya**. Beberapa hal yang sudah berubah:

| Aspek | Saat Analisis (27 Sep) | Sekarang (Post-Hardening) |
|---|---|---|
| Badge slot ambang umur | ≤14 / ≤90 / ≤110 / >110 | ≤35 / ≤110 / ≤130 / >130 |
| Badge slot deskripsi | Generic | Spesifik jamur kuping (Inkubasi & Sayat, Masa Produktif, dll) |
| Test suite | ~133 tests | 141 tests (100% pass, 467 assertions) |

**Temuan inti W-01 s/d W-17 TIDAK terpengaruh** oleh perubahan hardening karena hardening fokus di IoT control logic, bukan WMS flow.

---

## 6. Keputusan Desain — Sudah Dijawab ✅

Berdasarkan input dari pemilik budidaya (kakak pemilik proyek), 5 keputusan desain sudah ditentukan:

### Keputusan #1 — Panen Ditimbang Per Batch
**Jawaban:** Per batch, bukan per slot. Dengan kapasitas kumbung 3000 slot dan pembelian 1500 baglog per batch (siklus rolling — 1500 panen sementara 1500 tumbuh), menimbang per slot individual tidak praktis.

**Implikasi:**
- `slot_code` di form panen = **opsional** (bukan wajib)
- Heatmap per slot tetap bisa diisi kalau sesekali dicatat per slot, tapi tidak dipaksakan
- KPI per batch tetap jadi metrik utama

### Keputusan #2 — Akhir Hidup: Hybrid (Flush + Manual)
**Jawaban:** Kombinasi flush dan keputusan manual admin.

| Trigger | Aksi |
|---|---|
| Flush ke-5 | ⚠️ Peringatan "Produktivitas menurun" |
| Flush ke-7 | ⚠️ Prompt "Tutup siklus?" |
| Kapasitas hidup = 0 | 🔴 Auto-close siklus |
| Tombol admin "Tutup Siklus" | 🔴 Manual close |

**Alasan:** Auto-close berdasarkan umur hari saja tidak tepat karena baglog datang dengan tahap miselium berbeda-beda. Keputusan final tetap di tangan admin (operator di lapangan).

### Keputusan #3 — Reject Langsung Dikurangi di Awal
**Jawaban:** Baglog rusak saat datang langsung dikurangi dari jumlah batch. Contoh: beli 1500, 50 rusak → dicatat 1450 di sistem.

**Implikasi:**
- Tambah field `rejected_quantity` di batch (opsional, untuk dokumentasi)
- `quantity` yang tersimpan = jumlah yang **benar-benar masuk rak**
- Selama berjalan, baglog bermasalah dicatat lewat jurnal afkir (TRICHODERMA/BUSUK_BASAH/dll) → dipindahkan untuk perawatan terpisah atau dibuang

### Keputusan #4 — `entry_date` = Tanggal Datang ke Kumbung
**Jawaban:** `entry_date` adalah tanggal baglog **sampai di kumbung**, bukan tanggal inokulasi di supplier. Kakak pemilik beli baglog jadi (bukan buat sendiri), sehingga tahap miselium saat datang bervariasi.

**Implikasi:**
- `initial_mycelium_stage` (LEVEL_1/2/3) berfungsi sebagai **offset** fase awal
- Baglog datang dengan miselium 40% → masa inkubasi lebih pendek
- Perlu dikaitkan ke perhitungan badge umur (saat ini hanya disimpan, belum dipakai)

### Keputusan #5 — Kohort (Kelompok per Slot)
**Jawaban:** Tetap **kohort** (per kelompok di slot), bukan per individu.

**Penjelasan kohort:** Sistem melacak baglog sebagai kelompok — "Di slot A-01-01 ada 10 baglog dari Batch BL-20261001-001, 3 mati, sisa 7 hidup." Tidak melacak baglog mana spesifik yang mati. Tracking per individu (QR code per baglog) overkill untuk skala TA dengan 1500+ baglog.

---

## 7. Kesimpulan

**Dokumen analisis ini solid dan bisa dijadikan basis perencanaan perbaikan modul WMS.** Dari 21 temuan, 20 terkonfirmasi valid di kode aktual, 1 (W-05) sebagian outdated karena Logic Hardening tapi inti temuannya tetap benar.

Semua 5 keputusan desain sudah dijawab. Sistem siap untuk tahap planning implementasi.

Estimasi effort: **3.5–4.5 hari kerja** untuk seluruh perbaikan, atau **1 hari** untuk menutup tiga lubang terbesar (W-01 + W-02 + W-04).
