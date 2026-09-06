# Panduan Controller & Form Request (API Telemetry)

Dokumen ini berisi logika **Controller** dan **Form Request Validation** di Laravel untuk menerima data dari ESP32 (lewat endpoint `POST /api/telemetry`). 

Di sini juga disisipkan algoritma untuk otomatis mengecek data sensor yang masuk terhadap *Threshold Setting* (batas suhu/kelembaban) yang aktif. Kalau suhunya kepanasan atau kelembaban drop, server bakal ngasih balikan status `alert` ke ESP32.

---

## 1. Form Request Validation (`app/Http/Requests/StoreTelemetryRequest.php`)

File ini bertugas nge-filter data JSON yang dikirim ESP32. Kalau ESP32 ngirim data sampah (misal: suhu 500°C yang nggak masuk akal), request-nya bakal langsung ditolak sebelum nyentuh database.

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTelemetryRequest extends FormRequest
{
    /**
     * Tentukan siapa yang boleh ngakses endpoint ini.
     * Return true karena ESP32 kita nggak pake bearer token (sementara).
     */
    public function authorize()
    {
        return true; 
    }

    /**
     * Rules validasi payload JSON.
     */
    public function rules()
    {
        return [
            'device_id'   => 'required|string|max:50',
            
            // Suhu realistis bumi (10°C sampai 50°C)
            'temperature' => 'required|numeric|min:10|max:50',
            
            // Kelembaban (RH) pasti persentase (0% sampai 100%)
            'humidity'    => 'required|numeric|min:0|max:100',
            
            'co2_level'   => 'nullable|numeric|min:0'
        ];
    }

    /**
     * Custom pesan error (opsional buat log ESP32).
     */
    public function messages()
    {
        return [
            'temperature.max' => 'Suhu tidak wajar! Maksimal 50°C.',
            'humidity.max' => 'Kelembaban tidak mungkin melebihi 100%.',
        ];
    }
}
```

---

## 2. Controller (`app/Http/Controllers/Api/TelemetryController.php`)

Controller ini nangkep data yang udah lulus validasi, nyimpen ke database (`sensor_data`), terus ngecek apakah mikroklimat kumbung lagi dalam keadaan bahaya atau aman.

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTelemetryRequest;
use App\Models\SensorData;
use App\Models\ThresholdSetting;
use Illuminate\Http\JsonResponse;

class TelemetryController extends Controller
{
    /**
     * Menerima payload dari ESP32: POST /api/telemetry
     */
    public function store(StoreTelemetryRequest $request): JsonResponse
    {
        // 1. Simpan data sensor ke tabel sensor_data
        $sensorData = SensorData::create($request->validated());

        // 2. Ambil Threshold (Batas Optimal) yang sedang aktif di database
        $threshold = ThresholdSetting::where('is_active', true)->first();
        
        $alerts = [];
        $status = 'normal';

        // 3. Algoritma Pengecekan Anomali Cuaca
        if ($threshold) {
            // Cek Suhu
            if ($sensorData->temperature > $threshold->temp_max) {
                $alerts[] = 'Suhu OVERHEAT! (Lebih dari ' . $threshold->temp_max . '°C)';
            } elseif ($sensorData->temperature < $threshold->temp_min) {
                $alerts[] = 'Suhu TERLALU DINGIN! (Kurang dari ' . $threshold->temp_min . '°C)';
            }

            // Cek Kelembaban (RH)
            if ($sensorData->humidity > $threshold->humidity_max) {
                $alerts[] = 'Kelembaban TERLALU BASAH! (Lebih dari ' . $threshold->humidity_max . '%)';
            } elseif ($sensorData->humidity < $threshold->humidity_min) {
                $alerts[] = 'Kelembaban TERLALU KERING! (Kurang dari ' . $threshold->humidity_min . '%)';
            }
        }

        // Kalau array alerts ada isinya, berarti kondisi ga normal
        if (count($alerts) > 0) {
            $status = 'alert';
        }

        // 4. Return response JSON (bisa dibaca ESP32 buat ambil tindakan/nyalain alarm merah)
        return response()->json([
            'message' => 'Data telemetry berhasil disimpan.',
            'status'  => $status,
            'alerts'  => $alerts, // Ngirim pesan error spesifik
            'data'    => $sensorData
        ], 201);
    }
}
```

---

## 3. Konfigurasi Routes (`routes/api.php`)

Jangan lupa daftarin endpoint ini di file routes API Laravel lo.

```php
use App\Http\Controllers\Api\TelemetryController;

// Endpoint khusus hardware (ESP32)
Route::post('/telemetry', [TelemetryController::class, 'store']);
```
