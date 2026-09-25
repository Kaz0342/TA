# Panduan Controller & Form Request (API Sensor Data IoT)

Dokumen ini menjelaskan implementasi endpoint penerimaan data telemetri dari mikrokontroler ESP32 (`POST /api/sensor-data`). Endpoint ini dirancang dengan prinsip *Boundary Validation* via **FormRequest**, proteksi anti-spam via **Rate Limiting**, dan pengecekan pelanggaran ambang batas (*Early Warning System*) otomatis.

---

## 1. Form Request Validation (`app/Http/Requests/StoreSensorDataRequest.php`)

Validasi dilakukan secara ketat di batas aplikasi (*framework boundary*) sebelum request mencapai Controller atau Database.

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSensorDataRequest extends FormRequest
{
    /**
     * Endpoint IoT tidak menggunakan bearer token user agar tidak membebani ESP32.
     * Keamanan dijaga melalui rate limiter (20 req/menit per device IP).
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Rules validasi payload JSON telemetri.
     */
    public function rules(): array
    {
        return [
            'device_id'       => ['required', 'string', 'max:50'],
            'temperature'     => ['required', 'numeric', 'between:-50,100'],
            'humidity'        => ['required', 'numeric', 'between:0,100'],
            'co2_level'       => ['nullable', 'numeric', 'min:0', 'max:5000'],
            'light_intensity' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'recorded_at'     => ['nullable', 'date'],
        ];
    }

    /**
     * Pesan validasi error dalam Bahasa Indonesia yang informatif.
     */
    public function messages(): array
    {
        return [
            'temperature.between' => 'Nilai suhu di luar batas realistis (-50°C s.d. 100°C).',
            'humidity.between'    => 'Kelembaban harus berupa persentase (0% s.d. 100%).',
            'device_id.required'  => 'Identifier mikrokontroler (device_id) wajib disertakan.',
        ];
    }
}
```

---

## 2. Controller Telemetri (`app/Http/Controllers/Api/SensorDataController.php`)

Controller bersifat *Thin Controller*, mendelegasikan penyimpanan data immutable dan evaluasi ambang batas ke `SensorDataService`.

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSensorDataRequest;
use App\Services\SensorDataService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class SensorDataController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly SensorDataService $service
    ) {}

    /**
     * POST /api/sensor-data
     * Menerima payload dari ESP32, menyimpan ke database immutable,
     * dan mengembalikan status alert jika ada parameter iklim yang kritis.
     */
    public function store(StoreSensorDataRequest $request): JsonResponse
    {
        $result = $this->service->store($request->validated());

        $responseData = [
            'sensor_data' => $result['sensor_data'],
        ];

        // Sertakan array alerts jika melanggar ambang batas optimal
        if (!empty($result['alerts'])) {
            $responseData['alerts'] = $result['alerts'];
        }

        return $this->created(
            $responseData,
            empty($result['alerts'])
                ? 'Data sensor berhasil dicatat.'
                : 'Data sensor dicatat dengan peringatan ambang batas!'
        );
    }
}
```

---

## 3. Konfigurasi Endpoint & Rate Limiting (`routes/api.php`)

```php
use App\Http\Controllers\Api\SensorDataController;

// Proteksi Rate Limiting: Maksimal 20 request per 1 menit per device
Route::middleware('throttle:20,1')->group(function () {
    Route::post('/sensor-data', [SensorDataController::class, 'store']);
});
```

---

## 4. Contoh Response Payload

### Skenario Normal (Status HTTP 201 Created):
```json
{
  "success": true,
  "data": {
    "sensor_data": {
      "id": 1045,
      "device_id": "ESP32-KUMBUNG-01",
      "temperature": 27.50,
      "humidity": 88.00,
      "co2_level": 450.00,
      "light_intensity": 120.00,
      "recorded_at": "2026-09-25T12:00:00.000000Z"
    }
  },
  "message": "Data sensor berhasil dicatat."
}
```

### Skenario Pelanggaran Threshold (Ada Alert Balikan ke ESP32):
```json
{
  "success": true,
  "data": {
    "sensor_data": {
      "id": 1046,
      "device_id": "ESP32-KUMBUNG-01",
      "temperature": 33.50,
      "humidity": 72.00,
      "recorded_at": "2026-09-25T13:00:00.000000Z"
    },
    "alerts": [
      "Suhu tinggi (33.5°C > 32°C)!",
      "Kelembaban rendah (72.0% < 80%)!"
    ]
  },
  "message": "Data sensor dicatat dengan peringatan ambang batas!"
}
```
