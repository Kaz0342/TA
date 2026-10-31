# ===================================================================
# SMART SHROOM SCM — AUTOMATED CLI DEMO & HEALTH CHECK RUNNER
# Digunakan untuk memverifikasi seluruh endpoint SCM sebelum sidang.
# Cara jalanin: powershell -ExecutionPolicy Bypass -File docs/manual/test_api_demo.ps1
# ===================================================================

$baseUrl = "http://127.0.0.1:8000/api"
$adminEmail = "admin@smartshroom.test"
$adminPassword = "password123"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🍄 SMART SHROOM SCM — LIVE API HEALTH & DEFENSE RUNNER" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Cek Koneksi ke Server Laravel
Write-Host "`n[1/3] Memeriksa status dev server di $baseUrl..." -ForegroundColor Yellow
$serverActive = $false
try {
    $ping = Invoke-WebRequest -Uri "$baseUrl/thresholds/active" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($ping.StatusCode -eq 200) {
        $serverActive = $true
        Write-Host "  ✅ Dev server Laravel AKTIF di port 8000." -ForegroundColor Green
    }
} catch {
    $serverActive = $false
}

if (-not $serverActive) {
    Write-Host "  ⚠️ Dev server Laravel belum berjalan di port 8000." -ForegroundColor Yellow
    Write-Host "  👉 Menjalankan pengujian otomatis via PHPUnit Test Suite..." -ForegroundColor Cyan
    
    $testResult = cmd /c "cd /d D:\DevTools\Antigravity\Projects\TA_vio\backend && php artisan test tests/Feature/ScmSupplyChainTest.php"
    Write-Host $testResult
    
    Write-Host "`nUntuk menguji live HTTP di browser / VS Code REST Client:" -ForegroundColor Yellow
    Write-Host "1. Buka terminal baru: cd backend; php artisan serve" -ForegroundColor White
    Write-Host "2. Jalankan kembali skrip ini: powershell docs/manual/test_api_demo.ps1" -ForegroundColor White
    exit 0
}

# 2. Login Admin & Ambil Token Sanctum
Write-Host "`n[2/3] Menguji Autentikasi Admin & Perolehan Token Sanctum..." -ForegroundColor Yellow
$loginPayload = @{
    email = $adminEmail
    password = $adminPassword
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "$baseUrl/login" -Method POST -Body $loginPayload -ContentType "application/json" -Headers @{ "Accept" = "application/json" }
    $token = $loginRes.token
    if ($token) {
        Write-Host "  ✅ Login Admin Berhasil! Token Sanctum diterima." -ForegroundColor Green
    } else {
        Write-Host "  ❌ Gagal mendapatkan token dari response login." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Terjadi galat saat login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Eksekusi 8 Endpoint Utama SCM
Write-Host "`n[3/3] Menjalankan Pengujian 8 Endpoint Kunci SCM & DSS..." -ForegroundColor Yellow
$authHeaders = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/json"
}

$endpoints = @(
    @{ Name = "SCM Hulu: Daftar Master Pemasok"; Url = "$baseUrl/suppliers?active_only=true"; Method = "GET" },
    @{ Name = "SCM Hulu: Matriks Scorecard Supplier"; Url = "$baseUrl/suppliers/comparison"; Method = "GET" },
    @{ Name = "SCM Tengah: Snapshot Kapasitas Kumbung"; Url = "$baseUrl/scm/capacity-snapshot"; Method = "GET" },
    @{ Name = "SCM Tengah: Proyeksi Pelepasan Rak (Forecast)"; Url = "$baseUrl/scm/capacity-forecast"; Method = "GET" },
    @{ Name = "SCM Tengah: Smart Restock PO Advisor (DSS)"; Url = "$baseUrl/scm/restock-recommendations"; Method = "GET" },
    @{ Name = "SCM Hilir: Analisis Segmentasi Pasar Pelanggan"; Url = "$baseUrl/customers/analytics"; Method = "GET" },
    @{ Name = "SCM Hilir: Traceability Maju (Batch ke Customer)"; Url = "$baseUrl/scm/traceability/batch/BL-20261002-001"; Method = "GET" },
    @{ Name = "SCM Hilir: Traceability Mundur (Nota ke Supplier)"; Url = "$baseUrl/scm/traceability/sale/1"; Method = "GET" }
)

$passedCount = 0
foreach ($ep in $endpoints) {
    try {
        $res = Invoke-RestMethod -Uri $ep.Url -Method $ep.Method -Headers $authHeaders
        if ($res.success -eq $true) {
            Write-Host "  [200 OK] $($ep.Name)" -ForegroundColor Green
            $passedCount++
        } else {
            Write-Host "  [WARN] $($ep.Name) - success field is false" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [FAIL] $($ep.Name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
if ($passedCount -eq $endpoints.Count) {
    Write-Host "🏆 HASIL: $passedCount/$($endpoints.Count) ENDPOINTS LULUS (100% SIAP SIDANG)" -ForegroundColor Green
} else {
    Write-Host "⚠️ HASIL: $passedCount/$($endpoints.Count) ENDPOINTS BERHASIL" -ForegroundColor Yellow
}
Write-Host "==========================================================" -ForegroundColor Cyan

