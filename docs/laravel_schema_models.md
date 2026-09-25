# Panduan Migration & Model Eloquent (Smart Shroom SCM)

Dokumen ini berisi salinan kode **Migration** dan **Model Eloquent** lengkap dengan relasi (*hasMany / belongsTo*), *casting* tipe data presisi tinggi (`DECIMAL`), *foreign keys*, dan strategi *indexing* untuk 7 tabel utama dalam sistem Smart Shroom SCM.

---

## 1. Tabel `users`
Menyimpan identitas akun pengguna dan peran Role-Based Access Control (RBAC: Admin vs Worker).

### Migration
```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamp('email_verified_at')->nullable();
    $table->string('password');
    $table->enum('role', ['admin', 'worker'])->default('worker');
    $table->rememberToken();
    $table->timestamps();
});
```

### Model (`app/Models/User.php`)
```php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'role'];
    protected $hidden = ['password', 'remember_token'];
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function harvests()
    {
        return $this->hasMany(Harvest::class);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }
}
```

---

## 2. Tabel `sensor_data`
Menyimpan rekaman deret waktu (*time-series*) telemetri iklim mikro dari ESP32. Bersifat *append-only* (tanpa `updated_at`).

### Migration
```php
Schema::create('sensor_data', function (Blueprint $table) {
    $table->id();
    $table->string('device_id')->index();
    $table->decimal('temperature', 5, 2);
    $table->decimal('humidity', 5, 2);
    $table->decimal('co2_level', 6, 2)->nullable();
    $table->decimal('light_intensity', 7, 2)->nullable();
    $table->timestamp('recorded_at')->nullable()->index();
    $table->timestamp('created_at')->useCurrent()->index();

    $table->index(['device_id', 'recorded_at']);
});
```

### Model (`app/Models/SensorData.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SensorData extends Model
{
    const UPDATED_AT = null; // Immutable data

    protected $table = 'sensor_data';
    protected $fillable = [
        'device_id', 'temperature', 'humidity', 'co2_level', 'light_intensity', 'recorded_at'
    ];

    protected $casts = [
        'temperature' => 'decimal:2',
        'humidity' => 'decimal:2',
        'co2_level' => 'decimal:2',
        'light_intensity' => 'decimal:2',
        'recorded_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
```

---

## 3. Tabel `threshold_settings`
Menyimpan batas optimal mikroklimat jamur kuping dan preset fase pertumbuhan.

### Migration
```php
Schema::create('threshold_settings', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->decimal('temp_min', 5, 2)->default(20.00);
    $table->decimal('temp_max', 5, 2)->default(30.00);
    $table->decimal('humidity_min', 5, 2)->default(70.00);
    $table->decimal('humidity_max', 5, 2)->default(90.00);
    $table->string('phase_mode', 30)->default('fruiting');
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

### Model (`app/Models/ThresholdSetting.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ThresholdSetting extends Model
{
    protected $fillable = [
        'user_id', 'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'phase_mode', 'is_active'
    ];

    protected $casts = [
        'temp_min' => 'decimal:2',
        'temp_max' => 'decimal:2',
        'humidity_min' => 'decimal:2',
        'humidity_max' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

---

## 4. Tabel `baglog_batches`
Mencatat kelompok media tanam (*baglog*) beserta status siklus hidupnya.

### Migration
```php
Schema::create('baglog_batches', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('batch_code', 30)->unique();
    $table->date('entry_date')->index();
    $table->unsignedInteger('quantity');
    $table->string('supplier', 100);
    $table->enum('status', ['active', 'contaminated', 'disposed'])->default('active')->index();
    $table->text('notes')->nullable();
    $table->timestamps();

    $table->index(['user_id', 'status']);
});
```

### Model (`app/Models/BaglogBatch.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BaglogBatch extends Model
{
    protected $fillable = [
        'user_id', 'batch_code', 'entry_date', 'quantity', 'supplier', 'status', 'notes'
    ];

    protected $casts = [
        'entry_date' => 'date',
        'quantity' => 'integer',
    ];

    // Accessor: Umur baglog dihitung secara dinamis dari entry_date
    public function getAgeDaysAttribute(): int
    {
        return $this->entry_date ? now()->diffInDays($this->entry_date) : 0;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function harvests()
    {
        return $this->hasMany(Harvest::class);
    }
}
```

---

## 5. Tabel `harvests`
Mencatat hasil petik panen jamur harian dalam kilogram.

### Migration
```php
Schema::create('harvests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('baglog_batch_id')->nullable()->constrained()->nullOnDelete();
    $table->date('harvest_date')->index();
    $table->decimal('weight_kg', 8, 2);
    $table->text('notes')->nullable();
    $table->timestamps();

    $table->index(['user_id', 'harvest_date']);
    $table->index(['baglog_batch_id', 'harvest_date']);
});
```

### Model (`app/Models/Harvest.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Harvest extends Model
{
    protected $fillable = [
        'user_id', 'baglog_batch_id', 'harvest_date', 'weight_kg', 'notes'
    ];

    protected $casts = [
        'harvest_date' => 'date',
        'weight_kg' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function baglogBatch()
    {
        return $this->belongsTo(BaglogBatch::class);
    }
}
```

---

## 6. Tabel `sales`
Mencatat transaksi penjualan jamur kuping dan pendapatan kotor (*revenue*).

### Migration
```php
Schema::create('sales', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->date('sale_date')->index();
    $table->decimal('quantity_kg', 8, 2);
    $table->decimal('price_per_kg', 10, 2);
    $table->decimal('total_revenue', 12, 2);
    $table->string('buyer_name', 100);
    $table->text('notes')->nullable();
    $table->timestamps();
});
```

### Model (`app/Models/Sale.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    protected $fillable = [
        'user_id', 'sale_date', 'quantity_kg', 'price_per_kg', 'total_revenue', 'buyer_name', 'notes'
    ];

    protected $casts = [
        'sale_date' => 'date',
        'quantity_kg' => 'decimal:2',
        'price_per_kg' => 'decimal:2',
        'total_revenue' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

---

## 7. Tabel `sprinkler_logs`
Mencatat audit trail aktivitas aktuator kumbung (Pompa Misting & Exhaust Fan).

### Migration
```php
Schema::create('sprinkler_logs', function (Blueprint $table) {
    $table->id();
    $table->string('device_id', 50)->index();
    $table->string('actuator', 50); // misting | fan
    $table->timestamp('started_at')->index();
    $table->unsignedInteger('duration_seconds');
    $table->string('trigger_reason', 255);
    $table->string('stop_reason', 255)->nullable();
    $table->timestamps();
});
```

### Model (`app/Models/SprinklerLog.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SprinklerLog extends Model
{
    protected $fillable = [
        'device_id', 'actuator', 'started_at', 'duration_seconds', 'trigger_reason', 'stop_reason'
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];
}
```
