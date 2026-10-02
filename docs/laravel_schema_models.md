# Panduan Migration & Model Eloquent (Smart Shroom SCM)

Dokumen ini berisi salinan kode **Migration** dan **Model Eloquent** lengkap dengan relasi (*hasMany / belongsTo*), *casting* tipe data presisi tinggi (`DECIMAL`), *foreign keys*, dan strategi *indexing* untuk 11 tabel utama dalam sistem Smart Shroom SCM (diselaraskan dengan implementasi WMS Spasial, Ledger Afkir, HPP Dinamis, dan IoT Rule Engine).

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

    public const ROLE_ADMIN = 'admin';
    public const ROLE_WORKER = 'worker';

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

    public function operationalExpenses()
    {
        return $this->hasMany(OperationalExpense::class);
    }
}
```

---

## 2. Tabel `slots` (Master Denah Spasial WMS 3D)
Menyimpan 300 slot koordinat fisik rak kumbung jamur berbasis **Row-Bay-Tier** (Kapasitas total 3.000 baglog).

### Migration
```php
Schema::create('slots', function (Blueprint $table) {
    $table->id();
    $table->string('slot_code', 10)->unique()->index(); // misal: B-05-03
    $table->string('row_code', 5)->index();              // A, B, C
    $table->integer('bay_number');                       // 1..10
    $table->integer('tier_number');                      // 1..10
    $table->integer('max_capacity')->default(10);
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

### Model (`app/Models/Slot.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Slot extends Model
{
    use HasFactory;

    protected $fillable = [
        'slot_code', 'row_code', 'bay_number', 'tier_number', 'max_capacity', 'is_active'
    ];

    protected $casts = [
        'bay_number' => 'integer',
        'tier_number' => 'integer',
        'max_capacity' => 'integer',
        'is_active' => 'boolean',
    ];

    public function assignments()
    {
        return $this->hasMany(BatchSlotAssignment::class, 'slot_code', 'slot_code');
    }

    public function activeAssignment()
    {
        return $this->hasOne(BatchSlotAssignment::class, 'slot_code', 'slot_code')
            ->whereIn('current_status', ['INCUBATION', 'FRUITING'])
            ->latestOfMany();
    }

    public function culls()
    {
        return $this->hasMany(BaglogCull::class, 'slot_code', 'slot_code');
    }

    public function harvests()
    {
        return $this->hasMany(Harvest::class, 'slot_code', 'slot_code');
    }
}
```

---

## 3. Tabel `baglog_batches`
Mencatat kelompok media tanam yang didatangkan dari vendor beserta modal awal per baglog.

### Migration
```php
Schema::create('baglog_batches', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('batch_code', 30)->unique();
    $table->date('entry_date')->index();
    $table->unsignedInteger('quantity');
    $table->decimal('price_per_baglog', 10, 2)->default(0.00); // Modal per baglog (HPP)
    $table->string('supplier', 100);
    $table->enum('status', ['active', 'completed', 'contaminated', 'disposed'])->default('active')->index();
    $table->text('notes')->nullable();
    $table->timestamps();

    $table->index(['user_id', 'status']);
});
```

### Model (`app/Models/BaglogBatch.php`)
```php
namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class BaglogBatch extends Model
{
    protected $fillable = [
        'user_id', 'batch_code', 'entry_date', 'quantity', 'price_per_baglog', 'supplier', 'status', 'notes'
    ];

    protected $casts = [
        'entry_date' => 'date',
        'quantity' => 'integer',
        'price_per_baglog' => 'decimal:2',
    ];

    protected $appends = ['age_days'];

    public function getAgeDaysAttribute(): int
    {
        return (int) Carbon::parse($this->entry_date)->diffInDays(now());
    }

    public function assignments()
    {
        return $this->hasMany(BatchSlotAssignment::class, 'baglog_batch_id');
    }

    public function culls()
    {
        return $this->hasMany(BaglogCull::class, 'baglog_batch_id');
    }

    public function harvests()
    {
        return $this->hasMany(Harvest::class);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class, 'baglog_batch_id');
    }
}
```

---

## 4. Tabel `batch_slot_assignments` (Pivot Alokasi WMS)
Menghubungkan batch baglog ke koordinat slot kamar fisik kumbung.

### Migration
```php
Schema::create('batch_slot_assignments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('baglog_batch_id')->constrained('baglog_batches')->cascadeOnDelete();
    $table->string('slot_code', 10);
    $table->foreign('slot_code')->references('slot_code')->on('slots')->cascadeOnDelete();
    $table->integer('initial_quantity')->default(10);
    $table->integer('active_capacity')->default(10)->index();
    $table->string('initial_mycelium_stage', 30)->default('LEVEL_2');
    $table->string('current_status', 30)->default('INCUBATION');
    $table->date('assigned_at')->index();
    $table->timestamp('completed_at')->nullable();
    $table->string('completion_reason', 255)->nullable();
    $table->timestamps();
});
```

### Model (`app/Models/BatchSlotAssignment.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BatchSlotAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'baglog_batch_id', 'slot_code', 'initial_quantity', 'active_capacity',
        'initial_mycelium_stage', 'current_status', 'assigned_at',
        'completed_at', 'completion_reason'
    ];

    protected $casts = [
        'initial_quantity' => 'integer',
        'active_capacity' => 'integer',
        'assigned_at' => 'date',
        'completed_at' => 'datetime',
    ];

    public function batch()
    {
        return $this->belongsTo(BaglogBatch::class, 'baglog_batch_id');
    }

    public function slot()
    {
        return $this->belongsTo(Slot::class, 'slot_code', 'slot_code');
    }

    public function culls()
    {
        return $this->hasMany(BaglogCull::class, 'slot_code', 'slot_code')
            ->where('baglog_batch_id', $this->baglog_batch_id);
    }
}
```

---

## 5. Tabel `baglog_culls` (Ledger Pengurangan / Kematian Baglog)
Jurnal audit pengurangan kapasitas baglog akibat kontaminasi atau kematian fisik media tanam.

### Migration
```php
Schema::create('baglog_culls', function (Blueprint $table) {
    $table->id();
    $table->foreignId('baglog_batch_id')->constrained('baglog_batches')->cascadeOnDelete();
    $table->string('slot_code', 10);
    $table->foreign('slot_code')->references('slot_code')->on('slots')->cascadeOnDelete();
    $table->date('cull_date')->index();
    $table->integer('quantity');
    $table->string('reason', 50); // TRICHODERMA, BUSUK_BASAH, HAMA, KERING, HABIS_PRODUKSI, LAINNYA
    $table->text('notes')->nullable();
    $table->timestamp('voided_at')->nullable()->index();
    $table->string('void_reason', 255)->nullable();
    $table->foreignId('void_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

### Model (`app/Models/BaglogCull.php`)
```php
namespace App\Models;

use App\Traits\HasVoid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BaglogCull extends Model
{
    use HasFactory, HasVoid;

    protected $fillable = [
        'baglog_batch_id', 'slot_code', 'cull_date', 'quantity', 'reason', 'notes',
        'voided_at', 'void_reason', 'void_by'
    ];

    protected $casts = [
        'cull_date' => 'date',
        'quantity' => 'integer',
        'voided_at' => 'datetime',
    ];

    public function batch()
    {
        return $this->belongsTo(BaglogBatch::class, 'baglog_batch_id');
    }

    public function slot()
    {
        return $this->belongsTo(Slot::class, 'slot_code', 'slot_code');
    }
}
```

---

## 6. Tabel `harvests`
Mencatat hasil panen harian dilengkapi `slot_code`, `flush_number`, dan audit trail pembatalan (*soft-void*).

### Migration
```php
Schema::create('harvests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('baglog_batch_id')->nullable()->constrained()->nullOnDelete();
    $table->string('slot_code', 10)->nullable();
    $table->foreign('slot_code')->references('slot_code')->on('slots')->nullOnDelete();
    $table->integer('flush_number')->nullable()->default(1);
    $table->date('harvest_date')->index();
    $table->decimal('weight_kg', 8, 2);
    $table->text('notes')->nullable();
    $table->timestamp('voided_at')->nullable()->index();
    $table->string('void_reason', 255)->nullable();
    $table->foreignId('void_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();

    $table->index(['user_id', 'harvest_date']);
});
```

### Model (`app/Models/Harvest.php`)
```php
namespace App\Models;

use App\Traits\HasVoid;
use Illuminate\Database\Eloquent\Model;

class Harvest extends Model
{
    use HasVoid;

    protected $fillable = [
        'user_id', 'baglog_batch_id', 'slot_code', 'flush_number', 'harvest_date', 'weight_kg', 'notes',
        'voided_at', 'void_reason', 'void_by'
    ];

    protected $casts = [
        'harvest_date' => 'date',
        'weight_kg' => 'decimal:2',
        'flush_number' => 'integer',
        'voided_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function baglogBatch()
    {
        return $this->belongsTo(BaglogBatch::class);
    }

    public function slot()
    {
        return $this->belongsTo(Slot::class, 'slot_code', 'slot_code');
    }
}
```

---

## 7. Tabel `sales`
Mencatat transaksi penjualan jamur kuping dan pendapatan kotor (*revenue*) lengkap dengan audit trail void.

### Migration
```php
Schema::create('sales', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('baglog_batch_id')->nullable()->constrained()->nullOnDelete();
    $table->date('sale_date')->index();
    $table->decimal('quantity_kg', 8, 2);
    $table->decimal('price_per_kg', 10, 2);
    $table->decimal('total_revenue', 12, 2);
    $table->string('buyer_name', 100);
    $table->text('notes')->nullable();
    $table->timestamp('voided_at')->nullable()->index();
    $table->string('void_reason', 255)->nullable();
    $table->foreignId('void_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();

    $table->index(['user_id', 'sale_date']);
});
```

### Model (`app/Models/Sale.php`)
```php
namespace App\Models;

use App\Traits\HasVoid;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasVoid;

    protected $fillable = [
        'user_id', 'baglog_batch_id', 'sale_date', 'quantity_kg', 'price_per_kg',
        'total_revenue', 'buyer_name', 'notes',
        'voided_at', 'void_reason', 'void_by'
    ];

    protected $casts = [
        'sale_date' => 'date',
        'quantity_kg' => 'decimal:2',
        'price_per_kg' => 'decimal:2',
        'total_revenue' => 'decimal:2',
        'voided_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function batch()
    {
        return $this->belongsTo(BaglogBatch::class, 'baglog_batch_id');
    }
}
```

---

## 8. Tabel `operational_expenses` (Biaya Operasional Kumbung)
Mencatat pengeluaran operasional (listrik, misting, tenaga kerja) untuk kalkulasi HPP & Margin Kontribusi.

### Migration
```php
Schema::create('operational_expenses', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->date('expense_date')->index();
    $table->string('category', 50)->index(); // electricity, water_misting, labor, maintenance, logistics, other
    $table->decimal('amount', 12, 2);
    $table->text('notes')->nullable();
    $table->timestamps();
});
```

### Model (`app/Models/OperationalExpense.php`)
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OperationalExpense extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'expense_date', 'category', 'amount', 'notes'
    ];

    protected $casts = [
        'expense_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

---

## 9. Tabel `threshold_settings`
Menyimpan konfigurasi batas ambang keamanan iklim mikro kumbung jamur kuping.

### Migration
```php
Schema::create('threshold_settings', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->decimal('temp_min', 5, 2)->default(24.00);
    $table->decimal('temp_max', 5, 2)->default(32.00);
    $table->decimal('humidity_min', 5, 2)->default(85.00);
    $table->decimal('humidity_max', 5, 2)->default(95.00);
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
}
```

---

## 10. Tabel `sensor_data`
Menyimpan payload data telemetri iklim mikro deret waktu (*time-series*) yang dikirimkan oleh ESP32 (Immutable).

### Migration
```php
Schema::create('sensor_data', function (Blueprint $table) {
    $table->id();
    $table->decimal('temperature', 5, 2);
    $table->decimal('humidity', 5, 2);
    $table->decimal('co2_level', 6, 2)->nullable();
    $table->decimal('light_intensity', 7, 2)->nullable();
    $table->string('device_id', 50)->index();
    $table->timestamp('recorded_at')->index();
    $table->timestamp('created_at')->useCurrent();

    $table->index(['device_id', 'recorded_at']);
});
```

---

## 11. Tabel `sprinkler_logs`
Mencatat histori durasi dan pemicu aktivasi aktuator (Pompa Misting, Exhaust Fan, atau Event Sistem Jeda Panen).

### Migration
```php
Schema::create('sprinkler_logs', function (Blueprint $table) {
    $table->id();
    $table->string('device_id', 50)->index();
    $table->string('actuator', 50); // misting | fan | system
    $table->timestamp('started_at')->index();
    $table->unsignedInteger('duration_seconds');
    $table->string('trigger_reason', 255);
    $table->string('stop_reason', 255)->nullable();
    $table->timestamps();
});
```

---

## 12. Trait `HasVoid` (`app/Traits/HasVoid.php`)
Trait reusable untuk menerapkan pola **Voiding Ledger Pattern & Soft-Void Audit Trail** pada model transaksional (`Harvest`, `Sale`, `BaglogCull`).

```php
namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait HasVoid
{
    public static function bootHasVoid(): void
    {
        // Secara default hanya mengambil rekaman aktif (non-voided)
        static::addGlobalScope('notVoided', function (Builder $builder) {
            $builder->whereNull('voided_at');
        });
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('voided_at');
    }

    public function scopeVoided(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notVoided')->whereNotNull('voided_at');
    }

    public function scopeWithVoided(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notVoided');
    }

    public function isVoided(): bool
    {
        return !is_null($this->voided_at);
    }

    public function void(int $userId, string $reason): bool
    {
        $this->voided_at = now();
        $this->void_by = $userId;
        $this->void_reason = $reason;

        return $this->save();
    }

    public function voidedBy()
    {
        return $this->belongsTo(User::class, 'void_by');
    }
}
```

