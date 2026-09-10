<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SprinklerLog extends Model
{
    protected $fillable = [
        'device_id',
        'actuator',
        'started_at',
        'duration_seconds',
        'trigger_reason',
        'stop_reason',
    ];
}
