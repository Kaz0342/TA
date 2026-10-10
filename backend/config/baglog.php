<?php

return [
    'max_racks' => 3,
    'max_slots' => 300,
    'capacity_per_slot' => 10,
    'allowed_rows' => ['A', 'B', 'C'],
    'max_flush' => 7,
    'cycle_days' => 120,
    'age' => [
        'incubation' => 35,
        'productive' => 110,
        'late' => 130,
    ],
    'flush' => [
        'declining' => 5,
        'old' => 6,
    ],
];
