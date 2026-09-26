<?php
/**
 * Paws&Found API — configuration.
 *
 * One file holds every setting the API needs, so there is exactly one place to
 * look when something is pointing at the wrong database or the wrong origin.
 *
 * WHERE THE VALUES COME FROM
 *
 * Everything below is a default for a developer's laptop. A deployed copy
 * overrides what it needs in `api/config.local.php`, which is NOT in git —
 * a hosted database password has no business in a public repository, and a
 * classmate cloning this should not have to undo somebody else's credentials
 * before the project runs.
 *
 * Copy `config.example.php` to `config.local.php` on the server and fill it in.
 * Anything it does not define keeps the default from this file.
 *
 * NOTE on the port: this XAMPP installation runs MySQL on 3307, not the usual
 * 3306, because a separate MySQL 8.0 Windows service holds 3306. Most machines
 * — and every host — use 3306, which is why it is worth overriding rather than
 * assuming.
 */

declare(strict_types=1);

// Read first, so every default below can step aside for it.
$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    require_once $localConfig;
}

/**
 * `production` or `development`. Set to production in config.local.php on a
 * deployed copy: it is what switches PHP's error display off and the session
 * cookie's Secure flag on.
 */
defined('APP_ENV') || define('APP_ENV', 'development');

defined('DB_HOST') || define('DB_HOST', '127.0.0.1');
defined('DB_PORT') || define('DB_PORT', 3307);
defined('DB_NAME') || define('DB_NAME', 'pawsandfound');
defined('DB_USER') || define('DB_USER', 'root');
defined('DB_PASS') || define('DB_PASS', '');   // XAMPP's default. Never a deployed one.

/**
 * Where the React development server runs. The browser will not send or accept
 * cookies across origins unless the server names the origin exactly — a
 * wildcard is not allowed once credentials are involved, which is why this is a
 * fixed list rather than '*'.
 *
 * A deployed copy serves the built site and the API from the SAME origin, so
 * none of this applies there and the list stays empty. That is the whole
 * reason for deploying them together: no cross-origin requests means no CORS
 * to get wrong, and no third-party cookie rules to fall foul of.
 */
defined('ALLOWED_ORIGINS') || define('ALLOWED_ORIGINS', [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]);

/** Rows per page when a request does not ask for a specific size. */
defined('DEFAULT_PAGE_SIZE') || define('DEFAULT_PAGE_SIZE', 9);
defined('MAX_PAGE_SIZE') || define('MAX_PAGE_SIZE', 50);

/**
 * How many times a sign-in may fail before the account is locked and an
 * administrator has to unlock it.
 *
 * Counted per email address in the `login_attempts` table, so the count
 * survives a browser refresh, a new browser and a different device — it is not
 * kept in the session, which the person failing to sign in controls.
 */
defined('MAX_LOGIN_ATTEMPTS') || define('MAX_LOGIN_ATTEMPTS', 3);

/**
 * The date the privacy notice last changed.
 *
 * Stored against each agreement in `privacy_consents`, so a change to the
 * wording can be told apart from the version somebody actually agreed to.
 * Change this whenever src/pages/public/PrivacyPage.jsx changes in a way that
 * alters what people are agreeing to.
 */
defined('PRIVACY_NOTICE_VERSION') || define('PRIVACY_NOTICE_VERSION', '2026-09-25');

/**
 * In production, PHP must never print anything.
 *
 * A warning or a notice printed into a JSON response does two bad things at
 * once: it breaks the JSON, so the page reports a nonsense error, and it puts
 * our file paths on somebody else's screen. Many shared hosts leave
 * display_errors ON by default, so this is not a theoretical worry.
 *
 * The errors still happen and are still recorded — they go to the host's error
 * log, where they belong.
 */
if (APP_ENV === 'production') {
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    ini_set('log_errors', '1');
} else {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
}
