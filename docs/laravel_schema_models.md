# Panduan Migration & Model Eloquent (Smart Shroom SCM)

Dokumen ini berisi salinan kode **Migration** dan **Model Eloquent** lengkap dengan relasi (hasMany/belongsTo), *casting* tipe data, *foreign key*, dan *indexing* untuk 6 tabel utama dalam sistem Smart Shroom SCM. Cocok buat dilampirin di laporan TA lo!

---

## 1. Tabel `users`
Menyimpan data pengguna (Admin / Worker).

### Migration
```php
public function up()
{
    Schema::create('users', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->string('email')->unique();
        $table->timestamp('email_verified_at')->nullable();
        $table->string('password');
        $table->enum('role', ['admin', 'worker'])->default('worker'); // Kolom Role
        $table->rememberToken();
        $table->timestamps();
    });
}
```

### Model (`app/Models/User.php`)
```php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = ['name', 'email', 'password', 'role'];
    protected $hidden = ['password', 'remember_token'];
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    // Relasi: User mencatat banyak panen
    public function harvests()
    {
        return $this->hasMany(Harvest::class);
    }
}
```

---

## 2. Tabel `sensor_data`
Menyimpan log telemetri suhu dan kelembaban dari ESP32.

### Migration
```php
public function up()
{
    Schema::create('sensor_data', function (Blueprint $table) {
        $table->id();
        $table->string('device_id')->index();
        $table->decimal('temperature', 5, 2);
        $table->decimal('humidity', 5, 2);
        $table->decimal('co2_level', 6, 2)->default(0);
        $table->timestamp('created_at')->useCurrent()->index(); // Index untuk grafik waktu
        $table->timestamp('updated_at')->nullable();
    });
}
```

### Model (`app/Models/SensorData.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SensorData extends Model
{
    protected $table = 'sensor_data';
    protected $fillable = ['device_id', 'temperature', 'humidity', 'co2_level'];
    
    protected $casts = [
        'temperature' => 'decimal:2',
        'humidity' => 'decimal:2',
        'co2_level' => 'decimal:2',
    ];
}
```

---

## 3. Tabel `threshold_settings`
Menyimpan batas optimal mikroklimat untuk ditarik ESP32.

### Migration
```php
public function up()
{
    Schema::create('threshold_settings', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained()->cascadeOnDelete();
        $table->decimal('temp_min', 5, 2);
        $table->decimal('temp_max', 5, 2);
        $table->decimal('humidity_min', 5, 2);
        $table->decimal('humidity_max', 5, 2);
        $table->boolean('is_active')->default(true);
        $table->timestamps();
    });
}
```

### Model (`app/Models/ThresholdSetting.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ThresholdSetting extends Model
{
    protected $fillable = [
        'user_id', 'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'is_active'
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
Mencatat batch masuknya baglog (bibit) jamur ke kumbung.

### Migration
```php
public function up()
{
    Schema::create('baglog_batches', function (Blueprint $table) {
        $table->id();
        $table->string('batch_code')->unique();
        $table->date('entry_date')->index(); // Index untuk filter berdasar tanggal
        $table->integer('quantity');
        $table->string('supplier')->nullable();
        $table->boolean('is_active')->default(true);
        $table->timestamps();
    });
}
```

### Model (`app/Models/BaglogBatch.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BaglogBatch extends Model
{
    protected $fillable = ['batch_code', 'entry_date', 'quantity', 'supplier', 'is_active'];

    protected $casts = [
        'entry_date' => 'date',
        'is_active' => 'boolean',
        'quantity' => 'integer',
    ];

    // Relasi: Satu batch bisa menghasilkan banyak kali panen
    public function harvests()
    {
        return $this->hasMany(Harvest::class);
    }
}
```

---

## 5. Tabel `harvests`
Mencatat hasil panen harian per batch baglog.

### Migration
```php
public function up()
{
    Schema::create('harvests', function (Blueprint $table) {
        $table->id();
        $table->foreignId('baglog_batch_id')->constrained()->cascadeOnDelete();
        $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // Siapa yang panen
        $table->date('harvest_date')->index();
        $table->decimal('total_kg', 8, 2);
        $table->enum('quality', ['A', 'B', 'C'])->default('A');
        $table->timestamps();
    });
}
```

### Model (`app/Models/Harvest.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Harvest extends Model
{
    protected $fillable = ['baglog_batch_id', 'user_id', 'harvest_date', 'total_kg', 'quality'];

    protected $casts = [
        'harvest_date' => 'date',
        'total_kg' => 'decimal:2',
    ];

    public function baglogBatch()
    {
        return $this->belongsTo(BaglogBatch::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Relasi: Panen ini bisa dijual (satu panen bisa jadi beberapa penjualan)
    public function sales()
    {
        return $this->hasMany(Sale::class);
    }
}
```

---

## 6. Tabel `sales`
Mencatat data penjualan dari hasil panen.

### Migration
```php
public function up()
{
    Schema::create('sales', function (Blueprint $table) {
        $table->id();
        $table->foreignId('harvest_id')->constrained()->cascadeOnDelete();
        $table->date('sale_date')->index();
        $table->string('buyer_name')->nullable();
        $table->decimal('quantity_kg', 8, 2);
        $table->decimal('price_per_kg', 12, 2); // Pakai 12,2 biar ga overflow untuk uang IDR
        $table->decimal('total_price', 15, 2); 
        $table->timestamps();
    });
}
```

### Model (`app/Models/Sale.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    protected $fillable = [
        'harvest_id', 'sale_date', 'buyer_name', 'quantity_kg', 'price_per_kg', 'total_price'
    ];

    protected $casts = [
        'sale_date' => 'date',
        'quantity_kg' => 'decimal:2',
        'price_per_kg' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function harvest()
    {
        return $this->belongsTo(Harvest::class);
    }
}
```
