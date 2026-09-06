FROM php:8.2-cli

# Install system dependencies dan PostgreSQL driver
RUN apt-get update -y && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql pgsql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy semua file project Laravel ke dalam container
COPY . .

# Install package Laravel (tanpa package dev biar ringan)
RUN composer install --no-dev --optimize-autoloader

# Eksekusi migrasi ke Supabase dan jalankan server
# Render bakal ngasih variable $PORT secara otomatis
CMD php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}
