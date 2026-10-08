# Buku Manual Smart Shroom SCM

| File | Fungsi |
|------|--------|
| `MANUAL_BOOK.md` | **Sumber utama** (edit di sini saja) |
| `MANUAL_BOOK.html` | Hasil build, siap cetak A4 (dibuat otomatis) |
| `print.css` | Gaya tampilan dan cetak |
| `build_manual.mjs` | Skrip konversi Markdown ke HTML |

## Membuat ulang HTML

```bash
node docs/manual/build_manual.mjs
```

## Mencetak / Jadi PDF

1. Buka `MANUAL_BOOK.html` di Chrome atau Edge.
2. Tekan `Ctrl+P`, ukuran **A4**, margin **Default**, centang **Background graphics**.
3. Pilih **Save as PDF** atau printer fisik.

## Konversi ke format lain (Markdown bersifat universal)

Dengan [Pandoc](https://pandoc.org) terpasang:

```bash
pandoc docs/manual/MANUAL_BOOK.md -o MANUAL_BOOK.docx          # Word
pandoc docs/manual/MANUAL_BOOK.md -o MANUAL_BOOK.epub          # E-book
pandoc docs/manual/MANUAL_BOOK.md -o MANUAL_BOOK.pdf --pdf-engine=xelatex
```

Bagian `<!-- AUTO-GENERATED -->` (Lampiran A) diekstrak dari kode. Perbarui jika kode berubah.
