<?php
/**
 * Shared helpers: responses, request input, sessions and the authorisation
 * guards every protected endpoint calls.
 *
 * Small on purpose. If a member has to explain this API during the defence,
 * this is the file they should be able to read in one sitting.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// -----------------------------------------------------------------------------
// Responses
// -----------------------------------------------------------------------------

/** Send data as JSON and stop. Every endpoint ends here. */
function json_response(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');

    // Escaping slashes and unicode makes the output unreadable in the browser's
    // network tab for no benefit; both are safe to leave alone in JSON.
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send an error the frontend can display.
 *
 * The message is deliberately plain: it never contains SQL, file paths or
 * exception text, because those tell an attacker how the system is built.
 */
function json_error(string $message, int $status = 400, array $extra = []): never
{
    json_response(['error' => $message] + $extra, $status);
}

// -----------------------------------------------------------------------------
// Request input
// -----------------------------------------------------------------------------

/** Decode a JSON request body. Returns an empty array when there is none. */
function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('The request body was not valid JSON.', 400);
    }

    return $decoded;
}

/** A trimmed string from the query string, or null when absent or empty. */
function query_string_param(string $name): ?string
{
    $value = isset($_GET[$name]) && is_string($_GET[$name]) ? trim($_GET[$name]) : '';
    return $value === '' ? null : $value;
}

/** A positive integer from the query string, clamped to a sensible range. */
function query_int_param(string $name, int $default, int $min, int $max): int
{
    $value = filter_input(INPUT_GET, $name, FILTER_VALIDATE_INT);
    if ($value === false || $value === null) {
        return $default;
    }

    return max($min, min($max, $value));
}

/**
 * Reject a value that is not one of the allowed options.
 *
 * Used for anything that reaches an ENUM column or an ORDER BY clause, where a
 * value cannot be parameterised and therefore must be checked against a list we
 * control rather than trusted.
 */
function require_one_of(?string $value, array $allowed, string $field): ?string
{
    if ($value === null) {
        return null;
    }

    if (!in_array($value, $allowed, true)) {
        json_error("'{$field}' must be one of: " . implode(', ', $allowed), 422);
    }

    return $value;
}

// -----------------------------------------------------------------------------
// Sessions and authentication
// -----------------------------------------------------------------------------

/** Start the session with cookie settings suitable for the SPA talking to it. */
function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'httponly' => true,   // JavaScript cannot read it, so XSS cannot steal it
        'samesite' => 'Lax',
        'path' => '/',
        // Set from how the request actually arrived rather than from a
        // constant, so one codebase is correct in both places: a Secure cookie
        // is never sent back over plain HTTP, so hard-coding it true would
        // silently break every sign-in on a laptop, and hard-coding it false
        // would ship the session cookie unprotected on the deployed site.
        'secure' => request_is_https(),
    ]);

    session_start();
}

/**
 * Whether this request arrived over HTTPS.
 *
 * Shared hosts commonly terminate TLS at a proxy and forward plain HTTP to
 * PHP, so `$_SERVER['HTTPS']` alone reports "no" on a site that is plainly
 * padlocked in the browser. X-Forwarded-Proto is set by that proxy and is
 * trusted here for one narrow purpose — deciding whether to mark our own
 * cookie Secure — where the worst a forged header can do is make a cookie
 * stricter than it needed to be.
 */
function request_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }

    if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
        return true;
    }

    return ((int) ($_SERVER['SERVER_PORT'] ?? 0)) === 443;
}

/**
 * Whether someone has asked to be told about this kind of update — the three
 * switches on their profile page. A moderation decision about your own report
 * is always sent: it concerns your account, so it is not a preference.
 *
 * The column name comes from the fixed list below, never from the caller, so
 * building it into the SQL text is safe.
 */
function wants_notification(int $userId, string $type): bool
{
    $column = match ($type) {
        'match_suggested' => 'notify_matches',
        'staff_reviewed' => 'notify_staff',
        'report_flagged' => null,
        default => 'notify_status',
    };

    if ($column === null) {
        return true;
    }

    $statement = db()->prepare("SELECT {$column} FROM users WHERE user_id = :id");
    $statement->execute([':id' => $userId]);

    return (bool) $statement->fetchColumn();
}

/** The signed-in user as a row from `users`, or null. */
function current_user(): ?array
{
    start_session();

    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT user_id, full_name, email, contact_number, role, account_status,
                preferred_location, notify_matches, notify_status, notify_staff,
                created_at
           FROM users
          WHERE user_id = :id'
    );
    $statement->execute([':id' => $_SESSION['user_id']]);
    $user = $statement->fetch();

    if (!$user) {
        // The account was deleted while the session lived on.
        session_destroy();
        return null;
    }

    // A suspended or locked account keeps its session cookie but loses its
    // access — on every device at once, because this runs on every request and
    // reads the account as it is now rather than as it was at sign-in.
    //
    // Written as "not active" rather than as a list of the two bad states, so
    // that a future state added to the ENUM is refused by default instead of
    // quietly allowed.
    if ($user['account_status'] !== 'active') {
        return null;
    }

    return $user;
}

// -----------------------------------------------------------------------------
// Cross-site request forgery
// -----------------------------------------------------------------------------

/**
 * This session's CSRF token, created on first use.
 *
 * The problem this solves: the session cookie is sent by the browser on every
 * request to this origin, including one triggered by a form on somebody else's
 * website. The cookie alone therefore proves the request came from a browser
 * that is signed in — not that the person meant to make it.
 *
 * `SameSite=Lax` on the cookie already blocks the common version of that
 * attack, and is a real defence. It is the browser's promise rather than ours,
 * though, and it stops applying the moment the cookie has to become
 * `SameSite=None`. So the token is the one we enforce ourselves: it is handed
 * out in a response body, which another origin cannot read, and required back
 * in a header, which a plain HTML form cannot set.
 */
function csrf_token(): string
{
    start_session();

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

/** A fresh token. Called when the session id changes, so the two stay paired. */
function rotate_csrf_token(): string
{
    start_session();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    return $_SESSION['csrf_token'];
}

/**
 * Refuse a state-changing request that does not carry this session's token.
 *
 * Called once, in index.php, for every method that is not a read — so a new
 * endpoint is protected by existing, rather than by somebody remembering to
 * protect it.
 *
 * `hash_equals` rather than `===`: comparing secrets with a function that
 * returns early on the first different byte leaks, over many attempts, how much
 * of a guess was right.
 */
function verify_csrf(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Reads change nothing, so there is nothing to forge.
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }

    start_session();

    $expected = $_SESSION['csrf_token'] ?? '';
    $given = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    if ($expected === '' || !is_string($given) || !hash_equals($expected, $given)) {
        // `csrf` in the body so the browser can tell this apart from an
        // ordinary refusal, fetch a fresh token and try once more — a token
        // that rotated under a tab left open all afternoon is a nuisance, not
        // an attack.
        json_error('That request could not be verified. Please try again.', 403, ['csrf' => true]);
    }
}

/**
 * Forget the failed sign-in attempts recorded against an address.
 *
 * Two callers, which is why it lives here rather than beside the rest of the
 * lock: signing in successfully clears your own counter (`api/auth.php`), and
 * an administrator unlocking an account clears theirs (`api/users.php`).
 */
function clear_login_attempts(string $email): void
{
    $statement = db()->prepare('DELETE FROM login_attempts WHERE email = :email');
    $statement->execute([':email' => $email]);
}

// -----------------------------------------------------------------------------
// Audit logging
// -----------------------------------------------------------------------------

/**
 * Record something that happened to an account.
 *
 * Append-only: this writes rows and nothing anywhere updates or deletes them.
 * The `detail` is a short sentence meant to be read by a person — never a
 * password, a token or a session id.
 *
 * Failing to write the log must never fail the action it was describing. A
 * suspension that worked but could not be logged is still a suspension, and
 * throwing here would roll it back and confuse everybody.
 */
function audit_log(
    string $action,
    ?int $actorUserId = null,
    ?string $actorEmail = null,
    ?string $targetType = null,
    ?int $targetId = null,
    string $outcome = 'success',
    ?string $detail = null,
): void {
    try {
        $statement = db()->prepare(
            'INSERT INTO audit_logs
                    (actor_user_id, actor_email, action, target_type, target_id,
                     outcome, detail, ip_address)
             VALUES (:actor, :email, :action, :target_type, :target_id,
                     :outcome, :detail, :ip)'
        );

        $statement->execute([
            ':actor' => $actorUserId,
            ':email' => $actorEmail,
            ':action' => $action,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
            ':outcome' => $outcome,
            ':detail' => $detail,
            ':ip' => client_ip(),
        ]);
    } catch (PDOException $exception) {
        error_log('[pawsandfound] audit log failed: ' . $exception->getMessage());
    }
}

/**
 * The caller's address, for the audit log.
 *
 * REMOTE_ADDR only. A proxy header such as X-Forwarded-For is set by whoever
 * sent the request, so trusting it would let an attacker write any address
 * they liked into our own audit trail.
 */
function client_ip(): ?string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;

    return is_string($ip) && $ip !== '' ? substr($ip, 0, 45) : null;
}

/** Stop unless somebody is signed in. Returns the user so callers can use it. */
function require_login(): array
{
    $user = current_user();

    if ($user === null) {
        json_error('You need to be signed in to do that.', 401);
    }

    return $user;
}

/**
 * Stop unless the signed-in user holds one of these roles.
 *
 * This is the real access control. The React route guard only keeps the
 * interface coherent — it is trivially bypassed, so every protected endpoint
 * has to check for itself.
 */
function require_role(string ...$roles): array
{
    $user = require_login();

    if (!in_array($user['role'], $roles, true)) {
        json_error('Your account does not have access to that.', 403);
    }

    return $user;
}

// -----------------------------------------------------------------------------
// Cross-origin requests
// -----------------------------------------------------------------------------

/**
 * Allow the React dev server to call this API with its session cookie.
 *
 * In production the built site is served by Apache from the same origin and
 * none of this applies — it exists so `npm run dev` works.
 */
function send_cors_headers(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, ALLOWED_ORIGINS, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
        // X-CSRF-Token is named here or the browser's preflight refuses to let
        // the real request send it, and every write from `npm run dev` fails.
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Vary: Origin');
    }

    // The browser asks permission before sending a PUT or a JSON POST.
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
