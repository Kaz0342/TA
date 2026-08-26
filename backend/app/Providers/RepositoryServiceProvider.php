<?php

namespace App\Providers;

use App\Repositories\BaglogRepository;
use App\Repositories\Contracts\BaglogRepositoryInterface;
use App\Repositories\Contracts\HarvestRepositoryInterface;
use App\Repositories\Contracts\SaleRepositoryInterface;
use App\Repositories\Contracts\SensorDataRepositoryInterface;
use App\Repositories\HarvestRepository;
use App\Repositories\SaleRepository;
use App\Repositories\SensorDataRepository;
use Illuminate\Support\ServiceProvider;

/**
 * RepositoryServiceProvider — bind Repository interfaces ke implementations.
 *
 * Sesuai ECC Rule (rules/php/patterns.md):
 * "Depend on interfaces or narrow service contracts, not framework globals.
 *  Pass collaborators through constructors so services are testable."
 */
class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * @var array<class-string, class-string>
     */
    public array $bindings = [
        SensorDataRepositoryInterface::class => SensorDataRepository::class,
        BaglogRepositoryInterface::class => BaglogRepository::class,
        HarvestRepositoryInterface::class => HarvestRepository::class,
        SaleRepositoryInterface::class => SaleRepository::class,
    ];

    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
