# 🍄 Smart Shroom - Frontend AI Prompting & Design Guidelines (Neubrutalism) v3

> **PENTING BUAT AI:** Baca dokumen ini sebelum nulis satu baris kode pun untuk project Smart Shroom. Patuhi aturan styling Neubrutalism dan standar tech stack di bawah ini secara ketat.

## 🛑 BATAS SUCI (FRONTEND ONLY!)
DOKUMEN INI MURNI UNTUK PENGEMBANGAN **FRONTEND**. 
- DILARANG KERAS membuat rancangan database (SQL/NoSQL).
- DILARANG KERAS membuat endpoint backend (Node.js/Laravel/Python dll).
- Asumsikan **REST API sudah tersedia** dan siap dikonsumsi. Tugas AI di sini murni urus UI/UX, State Management, dan Data Fetching di sisi client.

---

## 🛠 Tech Stack Lengkap
- **Core Framework & Build Tool:** React 19 (via Vite), TypeScript (v6)
- **Styling & UI:** Tailwind CSS (v3), `clsx` + `tailwind-merge` (Wajib!), Lucide React, Recharts (v3)
- **Data Fetching & State Management:** TanStack Query (v5), Zustand (v5), Axios
- **Lainnya:** React Router DOM (v7), Date-fns (buat format tanggal panen/tanam), Oxlint

---

## 🧠 Aturan Logika & State Management
1. **Data Fetching (No Vanilla `useEffect`!):** Wajib pake **TanStack Query (v5)** sama **Axios**. Gunakan `useQuery` buat get data dari API eksternal, dan `useMutation` buat lempar data (POST/PUT/DELETE) ke API.
2. **Global State:** Kalo butuh nyimpen state yang diakses lintas komponen (misalnya state filter rentang waktu di dashboard, atau status auth), wajib pake **Zustand**. 
3. **Date Formatting:** Urusan format tanggal tanam, ngitung umur baglog, atau waktu log penyiraman otomatis, wajib murni pake **Date-fns**.

---

## 🎨 Aturan Main Neubrutalism (Wajib Diikuti)
Desain web ini pakai gaya **Neubrutalism**. Artinya: kontras tinggi, border hitam tebal, warna ngejreng tapi solid, dan *hard shadow* (bayangan nggak ngeblur sama sekali).

### 1. Global Utilities (Tailwind)
- **Border:** `border-4 border-black` (atau `border-2` untuk elemen kecil).
- **Hard Shadow:** `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`. Kalau di-hover/klik, shadow mengecil dan elemen geser (efek ditekan).
- **Rounded:** `rounded-none` atau maksimal `rounded-md` (kaku is the way).
- **Typography:** Font tebal (bold/extrabold/black) untuk heading. Text wajib hitam pekat (`text-black`).

### 2. Color Palette
- **Background Utama (Body):** `#f4f4f0` (Off-white/krem terang).
- **Aksen Utama (Primary):** Hijau terang/ngejreng (`bg-green-400` atau `bg-[#28e085]`) untuk tombol atau metrik krusial.
- **Aksen Peringatan (Warning/Danger):** Kuning terang (`bg-yellow-400`) atau Merah (`bg-red-500`) untuk status baglog kontaminasi/dibuang.

---

## 🧩 Component Blueprint (Tinggal Copas)

### A. Card Dashboard & Container
```tsx
<div className={cn(
  "bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
  "p-6 flex flex-col gap-2 transition-all"
)}>
  {/* Konten */}
</div>
```

### B. Action Button (Wajib Ada Efek Ditekan)
```tsx
<button className={cn(
  "bg-green-500 text-black font-black px-6 py-2 border-4 border-black",
  "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
  "hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
  "active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
)}>
  Simpan Data
</button>
```

### C. Input Form
```tsx
<input 
  type="text"
  className={cn(
    "w-full px-4 py-2 bg-white border-2 border-black text-black font-bold",
    "focus:outline-none focus:ring-0 focus:border-4 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    "transition-all placeholder:text-gray-500"
  )}
  placeholder="Input data jamur..."
/>
```

### D. Recharts Customization
- `strokeWidth={4}`
- Warna line pake hex code yang *vibrant* (hitam atau hijau neon).
- Hilangin grid line tipis, atau ganti jadi `strokeDasharray="3 3"` warna hitam pekat.

---
**Instruksi Akhir untuk AI:**
Setiap kali nulis kodingan, ingat: API pake Axios + TanStack Query, State pake Zustand, Styling pake Tailwind + clsx, Style visual pake Neubrutalism. Hanya fokus di area frontend, asumsikan API backend sudah siap!
