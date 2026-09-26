<?php
/**
 * Paws&Found API — deployment configuration TEMPLATE.
 *
 * Copy this file to `config.local.php` on the server and fill in the values
 * the host gave you. `config.local.php` is in .gitignore and must stay there:
 * the whole point of this file existing is that the real credentials never
 * reach the repository.
 *
 *     cp api/config.example.php api/config.local.php
 *
 * Anything you leave out keeps the default from config.php, which is set up
 * for a developer's XAMPP.
 */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------

// This is the switch that turns off PHP's error display and turns on the
// Secure flag on the session cookie. Set it on anything that is not a laptop.
define('APP_ENV', 'production');

// -----------------------------------------------------------------------------
// Database
// -----------------------------------------------------------------------------
//
// Shared hosts usually prefix the database and user names with the account
// name, so what you type into phpMyAdmin is rarely what you typed into the
// "create database" box. Copy them from the host's control panel exactly.

define('DB_HOST', 'localhost');   // Almost always localhost on shared hosting.
define('DB_PORT', 3306);          // 3306 everywhere except this project's XAMPP.
define('DB_NAME', 'CHANGE_ME_database');
define('DB_USER', 'CHANGE_ME_user');
define('DB_PASS', 'CHANGE_ME_password');

// -----------------------------------------------------------------------------
// Cross-origin requests
// -----------------------------------------------------------------------------
//
// Empty, and it should stay empty. The built site and the API are served from
// the same origin in production, so there are no cross-origin requests to
// allow. If you find yourself adding an entry here, something has been
// deployed to the wrong place — fix that instead.

define('ALLOWED_ORIGINS', []);
