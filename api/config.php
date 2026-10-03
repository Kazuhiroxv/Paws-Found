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
defined('APP_ENV') || define('APP_ENV', getenv('APP_ENV') ?: 'development');

/**
 * Read a setting from the environment, falling back to a default.
 *
 * A hosted container has no config.local.php — credentials arrive as
 * environment variables, which is what keeps them out of the image and out of
 * git. Railway's MySQL service publishes MYSQLHOST, MYSQLPORT and the rest, so
 * both spellings are accepted and the deployment needs no variable mapping.
 *
 * Order: config.local.php (already loaded above) wins, then the environment,
 * then the local default. So a developer's machine behaves exactly as it did
 * before — nothing is set, so nothing changes.
 */
function env_setting(string $name, string $alias, string|int $fallback): string|int
{
    foreach ([$name, $alias] as $key) {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }
    }

    return $fallback;
}

defined('DB_HOST') || define('DB_HOST', env_setting('DB_HOST', 'MYSQLHOST', '127.0.0.1'));
defined('DB_PORT') || define('DB_PORT', (int) env_setting('DB_PORT', 'MYSQLPORT', 3307));
defined('DB_NAME') || define('DB_NAME', env_setting('DB_NAME', 'MYSQLDATABASE', 'pawsandfound'));
defined('DB_USER') || define('DB_USER', env_setting('DB_USER', 'MYSQLUSER', 'root'));
// XAMPP's default is an empty password. A deployed one never is, and never
// lives in this file — it arrives as MYSQL_ROOT_PASSWORD or MYSQLPASSWORD.
defined('DB_PASS') || define('DB_PASS', env_setting('DB_PASS', 'MYSQLPASSWORD', ''));

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
 * Roles limited to one signed-in session at a time: signing in again ends the
 * previous one. Customers are not limited (api/auth.php, auth_login()).
 */
const PRIVILEGED_ROLES = ['staff', 'admin'];

/**
 * The date the privacy notice last changed.
 *
 * Stored against each agreement in `privacy_consents`, so a change to the
 * wording can be told apart from the version somebody actually agreed to.
 * Change this whenever src/pages/public/PrivacyPage.jsx changes in a way that
 * alters what people are agreeing to.
 */
// -----------------------------------------------------------------------------
// Where this application answers
//
// Every link in an email is built from this. Never a hard-coded localhost or
// Railway hostname: a verification link that points at the wrong host is a
// verification link nobody can use.
// -----------------------------------------------------------------------------
defined('APP_URL') || define('APP_URL', rtrim(
    (string) env_setting('APP_URL', 'RAILWAY_PUBLIC_DOMAIN_URL', 'http://localhost/pawsandfound'),
    '/'
));

// -----------------------------------------------------------------------------
// Mail
//
// 'smtp'    a real server. What production uses.
// 'log'     development: the subject goes to the PHP error log and nothing is
//           sent. Honest, because nothing claims otherwise.
// 'capture' tests: the whole message is written to a file the test harness
//           reads, so a verification link can be followed without an SMTP
//           server and without any endpoint that hands out tokens.
//
// The default is 'log' rather than 'smtp' so a developer with no mail server
// is not met with an error on their first registration. APP_ENV=production
// overrides it below: a deployed site that silently logs instead of sending is
// exactly the fake-delivery behaviour this must not have.
// -----------------------------------------------------------------------------
defined('MAIL_TRANSPORT') || define('MAIL_TRANSPORT', env_setting(
    'MAIL_TRANSPORT',
    'MAIL_TRANSPORT',
    APP_ENV === 'production' ? 'smtp' : 'log'
));

defined('MAIL_HOST') || define('MAIL_HOST', (string) env_setting('MAIL_HOST', 'MAIL_HOST', ''));
defined('MAIL_PORT') || define('MAIL_PORT', (int) env_setting('MAIL_PORT', 'MAIL_PORT', 587));
defined('MAIL_USERNAME') || define('MAIL_USERNAME', (string) env_setting('MAIL_USERNAME', 'MAIL_USERNAME', ''));
defined('MAIL_PASSWORD') || define('MAIL_PASSWORD', (string) env_setting('MAIL_PASSWORD', 'MAIL_PASSWORD', ''));
defined('MAIL_FROM_ADDRESS') || define('MAIL_FROM_ADDRESS', (string) env_setting('MAIL_FROM_ADDRESS', 'MAIL_FROM_ADDRESS', ''));
defined('MAIL_FROM_NAME') || define('MAIL_FROM_NAME', (string) env_setting('MAIL_FROM_NAME', 'MAIL_FROM_NAME', 'Paws&Found'));
// 'starttls' (port 587) or 'tls' (implicit, port 465).
defined('MAIL_ENCRYPTION') || define('MAIL_ENCRYPTION', (string) env_setting('MAIL_ENCRYPTION', 'MAIL_ENCRYPTION', 'starttls'));

// Brevo's HTTPS transactional API, used when MAIL_TRANSPORT is 'brevo_api'.
// It exists because Railway's trial plan blocks outbound SMTP: port 587 times
// out from the container, port 443 does not. The key is read here and used in
// one request header in api/mail.php. It is never sent to the browser — GET
// /api/config returns the Turnstile site key and nothing else.
defined('BREVO_API_KEY') || define('BREVO_API_KEY', (string) env_setting('BREVO_API_KEY', 'BREVO_API_KEY', ''));
defined('MAIL_TIMEOUT') || define('MAIL_TIMEOUT', 15);
defined('MAIL_CAPTURE_DIR') || define('MAIL_CAPTURE_DIR', sys_get_temp_dir() . '/pawsandfound-mail');

// -----------------------------------------------------------------------------
// One-time links
//
// Long enough to be useful, short enough that a forwarded or logged link stops
// working. A verification link is a day because people read email the next
// morning; a reset link is an hour because it replaces a password.
// -----------------------------------------------------------------------------
defined('TOKEN_TTL_EMAIL_VERIFICATION') || define('TOKEN_TTL_EMAIL_VERIFICATION', 86400);
defined('TOKEN_TTL_PASSWORD_RESET') || define('TOKEN_TTL_PASSWORD_RESET', 3600);
defined('TOKEN_TTL_EMAIL_CHANGE') || define('TOKEN_TTL_EMAIL_CHANGE', 86400);

// -----------------------------------------------------------------------------
// Rate limits
//
// Different from the three-attempt account lock, which protects one account
// from guessing. These protect the system from somebody registering a thousand
// accounts, or using the reset form as a mailing service.
//
// Each is [attempts, seconds].
// -----------------------------------------------------------------------------
defined('RATE_LIMITS') || define('RATE_LIMITS', [
    'register' => [5, 3600],
    'resend_verification' => [3, 900],
    'forgot_password' => [3, 3600],
]);

// The key that turns an address or an IP into the subject_hash stored in
// auth_rate_limits. The table counts; it does not need to know who.
defined('RATE_LIMIT_SECRET') || define('RATE_LIMIT_SECRET', (string) env_setting(
    'RATE_LIMIT_SECRET',
    'RATE_LIMIT_SECRET',
    'pawsandfound-local-only'
));

// -----------------------------------------------------------------------------
// Cloudflare Turnstile
//
// Bot protection on registration, which is a different problem from rate
// limiting: one asks "is this a person", the other asks "how often".
//
// TURNSTILE_ENABLED defaults to whether a secret exists, EXCEPT in production,
// where it must be switched off deliberately. A deployed site that quietly
// stops checking because a variable went missing is worse than one that fails.
// -----------------------------------------------------------------------------
defined('TURNSTILE_SITE_KEY') || define('TURNSTILE_SITE_KEY', (string) env_setting('TURNSTILE_SITE_KEY', 'TURNSTILE_SITE_KEY', ''));
defined('TURNSTILE_SECRET_KEY') || define('TURNSTILE_SECRET_KEY', (string) env_setting('TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY', ''));
defined('TURNSTILE_ENABLED') || define('TURNSTILE_ENABLED', filter_var(
    env_setting('TURNSTILE_ENABLED', 'TURNSTILE_ENABLED', TURNSTILE_SECRET_KEY !== '' ? 'true' : 'false'),
    FILTER_VALIDATE_BOOLEAN
));

// -----------------------------------------------------------------------------
// Session lifetime
//
// The browser is not the security control, so both of these are enforced on the
// server, in current_user(), on every authenticated request.
//
// Idle is deliberately generous. Somebody composing a lost-pet description with
// a distressed household around them must not lose it, and a short idle timeout
// on a public form is a usability failure dressed as security. The absolute
// lifetime is the one that actually bounds a forgotten administrator session on
// a shared laptop.
// -----------------------------------------------------------------------------
defined('SESSION_IDLE_TIMEOUT') || define('SESSION_IDLE_TIMEOUT', 3600);        // 1 hour
defined('SESSION_ABSOLUTE_TIMEOUT') || define('SESSION_ABSOLUTE_TIMEOUT', 28800); // 8 hours

// How often a session's "last seen" time is written (user_sessions), in
// seconds. Not on every request: a page that polls every ten seconds would
// otherwise be a database write every ten seconds per open tab.
defined('SESSION_LAST_SEEN_INTERVAL') || define('SESSION_LAST_SEEN_INTERVAL', 300); // 5 minutes

// -----------------------------------------------------------------------------
// Is this server behind Railway's public HTTP edge? (api/helpers.php,
// client_ip(), Correction 5A)
//
// Only then is the X-Real-IP header the visitor's address: Railway's edge
// sets it on every request, overwrites any value a client sent, and an app
// behind it cannot be reached any other way (Railway, Public Networking →
// Specs & Limits; Railway staff, May 2026). Anywhere else — XAMPP, a local
// Docker run — whoever connects could write the header themselves, so it is
// ignored and REMOTE_ADDR is used.
//
// Decided from the deployment itself, never from the request: production,
// and a variable Railway sets on every deployment it runs. Railway publishes
// no stable range for its proxies (100.0.0.0/8 is what they happen to use
// today), so the source address is not part of the decision.
// config.local.php may define it to simulate Railway in a test.
// -----------------------------------------------------------------------------
defined('BEHIND_RAILWAY_EDGE') || define(
    'BEHIND_RAILWAY_EDGE',
    APP_ENV === 'production' && (string) getenv('RAILWAY_ENVIRONMENT_ID') !== ''
);

// Changed on 2026-10-03 (Correction 5): the notice now says what the session
// and activity logs record. See src/pages/public/PrivacyPage.jsx.
defined('PRIVACY_NOTICE_VERSION') || define('PRIVACY_NOTICE_VERSION', '2026-10-03');

/**
 * The matching trace: one server-log line per filing with the candidates, their
 * scores and gates, and what was stored. Off in normal running, so the log is
 * not filled with routine successes; switched on (MATCH_DEBUG=true) only to
 * diagnose a pairing that should have appeared. A matching FAILURE is logged
 * whatever this says (api/matching.php).
 */
defined('MATCH_DEBUG') || define(
    'MATCH_DEBUG',
    filter_var(env_setting('MATCH_DEBUG', 'MATCH_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN)
);

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
