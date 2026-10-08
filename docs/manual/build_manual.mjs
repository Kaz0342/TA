// Build manual: Markdown -> HTML siap cetak (A4). Jalankan: node docs/manual/build_manual.mjs
// Dependensi: "marked" (di-install otomatis ke folder temp lewat npm bila belum ada).
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const dir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(dir, '.build-tools');

// Pasang marked secara lokal di folder tersembunyi (di-ignore git) kalau belum ada
let marked;
try {
  const req = createRequire(join(toolDir, 'x.js'));
  marked = (await import(pathToFileURL(req.resolve('marked')).href)).marked;
} catch {
  execSync(`npm install marked --prefix "${toolDir}" --no-audit --no-fund`, { stdio: 'inherit' });
  const req = createRequire(join(toolDir, 'x.js'));
  marked = (await import(pathToFileURL(req.resolve('marked')).href)).marked;
}

const md = readFileSync(join(dir, 'MANUAL_BOOK.md'), 'utf8');
const css = readFileSync(join(dir, 'print.css'), 'utf8');

// Beri id pada heading H1 supaya bisa jadi anchor/bookmark PDF
const body = marked.parse(md, { gfm: true });

const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Buku Manual Smart Shroom SCM</title>
<style>${css}</style>
</head>
<body>
<main class="book">${body}</main>
</body>
</html>`;

const out = join(dir, 'MANUAL_BOOK.html');
writeFileSync(out, html, 'utf8');
console.log('Selesai ->', out);
