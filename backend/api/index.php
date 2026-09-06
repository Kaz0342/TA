<?php

// Fix Vercel SCRIPT_NAME trap: Vercel sets SCRIPT_NAME=/api/index.php, which causes
// Laravel/Symfony Request to treat /api as baseUrl and strip it from route matching.
$_SERVER['SCRIPT_NAME'] = '/index.php';

// Forward Vercel serverless requests ke public/index.php milik Laravel
require __DIR__ . '/../public/index.php';
