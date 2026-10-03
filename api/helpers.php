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
    // An error can now be raised from inside a transaction — a stale-state 409
    // is discovered by the UPDATE itself, several statements in. PDO would roll
    // back anyway when the connection closes, but relying on a destructor for
    // correctness is the kind of thing that is true until somebody adds a
    // persistent connection. Only on an error: an open transaction at a
    // success response would be a missing commit, and hiding it helps nobody.
    if ($status >= 400 && db_has_open_transaction()) {
        db()->rollBack();
    }

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

/**
 * Trim a value, and treat "nothing but whitespace" as nothing.
 *
 * Lived in both matches.php and reports.php as identical copies; users.php now
 * needs it too, for the suspension reason. Three callers of the same eight
 * lines is where a shared helper stops being premature.
 *
 * This is what makes a required note of spaces fail validation rather than be
 * stored as '   '.
 */
/**
 * Today on the calendar the reporters use.
 *
 * An incident date is a Philippine calendar day. The server runs in UTC, which
 * is still on yesterday until 8 AM in Manila, so comparing with date('Y-m-d')
 * refused a report dated today every morning as "in the future". Timestamps
 * stay UTC (api/db.php); only this calendar question is asked in Manila. PHP
 * carries its own zone data, so nothing on the host is needed for it.
 *
 * @param DateTimeImmutable|null $now  Injectable, so the boundary can be tested.
 */
function app_today(?DateTimeImmutable $now = null): string
{
    return ($now ?? new DateTimeImmutable('now'))
        ->setTimezone(new DateTimeZone('Asia/Manila'))
        ->format('Y-m-d');
}

function blank_to_null(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string) $value);
    return $text === '' ? null : $text;
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

/**
 * Mark the session as freshly signed in.
 *
 * Called at the two points that establish an identity, after
 * session_regenerate_id(), so the clocks start on the new session id rather
 * than on the anonymous one it replaced.
 */
function session_started_now(): void
{
    $_SESSION['issued_at'] = time();
    $_SESSION['last_activity'] = time();
}

/**
 * Has this session run out of time, and on which clock?
 *
 * Two clocks, both checked on the server:
 *
 *   idle       time since the last authenticated request
 *   absolute   time since sign-in, refreshed by nothing
 *
 * Returns null while the session is in time, or [reason, the moment it
 * expired]. When both have run out, the one that ran out first is the reason:
 * that is when the session actually ended.
 *
 * A session that predates this check has no timestamps. It is adopted rather
 * than thrown away — signing everybody out to deploy a timeout is a worse
 * first impression than the timeout itself.
 *
 * @return array{0: string, 1: int}|null
 */
function session_expiry(): ?array
{
    if (!isset($_SESSION['issued_at'], $_SESSION['last_activity'])) {
        session_started_now();
        return null;
    }

    $idleEnds = (int) $_SESSION['last_activity'] + SESSION_IDLE_TIMEOUT;
    $absoluteEnds = (int) $_SESSION['issued_at'] + SESSION_ABSOLUTE_TIMEOUT;

    if (time() <= min($idleEnds, $absoluteEnds)) {
        return null;
    }

    return $idleEnds <= $absoluteEnds ? ['idle_timeout', $idleEnds] : ['absolute_timeout', $absoluteEnds];
}

/** The signed-in user as a row from `users`, or null. */
function current_user(): ?array
{
    start_session();

    if (empty($_SESSION['user_id'])) {
        return null;
    }

    // Before the database is asked anything. An expired session is simply
    // nobody now — but the browser is told which clock ran out, so the page
    // can say "your session expired" rather than appearing at Sign in with no
    // explanation (Correction 5).
    $expiry = session_expiry();
    if ($expiry !== null) {
        end_this_session($expiry[0], $expiry[1]);
        return null;
    }

    $_SESSION['last_activity'] = time();

    $statement = db()->prepare(
        'SELECT user_id, first_name, last_name, full_name, email, contact_number, role, account_status,
                preferred_location, notify_matches, notify_status, notify_staff,
                created_at, email_verified_at, pending_email, session_version
           FROM users
          WHERE user_id = :id'
    );
    $statement->execute([':id' => $_SESSION['user_id']]);
    $user = $statement->fetch();

    if (!$user) {
        // The account was deleted while the session lived on.
        $_SESSION = [];
        session_destroy();
        return null;
    }

    // A password reset bumps users.session_version, and every session still
    // carrying the previous number stops working here — on every device at
    // once, without anybody trying to find and delete PHP's session files.
    // So do a privileged sign-in elsewhere and a promotion (auth_login(),
    // user_update()). Whichever it was wrote the reason on this session's
    // record when it happened; that is what the browser is told.
    //
    // Sessions created before this column existed have no version recorded.
    // They are adopted at the account's current value rather than thrown away,
    // for the same reason the idle timeout adopts them: signing everybody out
    // to deploy a feature is a worse first impression than the feature.
    if (!isset($_SESSION['session_version'])) {
        $_SESSION['session_version'] = (int) $user['session_version'];
    } elseif ((int) $_SESSION['session_version'] !== (int) $user['session_version']) {
        end_this_session(session_record_end_reason() ?? 'session_ended');
        return null;
    }

    // A suspended or locked account loses its access on every device at once,
    // because this runs on every request and reads the account as it is now
    // rather than as it was at sign-in. The session ends for good: before
    // Correction 5 it lingered and came back to life if the account was
    // reinstated, which the session record could not have said truthfully.
    //
    // Written as "not active" rather than as a list of the two bad states, so
    // that a future state added to the ENUM is refused by default instead of
    // quietly allowed.
    if ($user['account_status'] !== 'active') {
        end_this_session(match ($user['account_status']) {
            'locked' => 'account_locked',
            'suspended' => 'account_suspended',
            default => 'session_ended',
        });
        return null;
    }

    touch_session_record();

    return $user;
}

/**
 * Why this browser's signed-in session ended, for the response that answers
 * it: ['session_ended' => 'idle_timeout'], or nothing.
 *
 * Kept in the (now anonymous) session rather than sent once and forgotten,
 * because several requests from one page can arrive together and only one of
 * them is the one that found out. Cleared by the next sign-in. It says
 * nothing about any other device, and only this browser can read it.
 */
function session_end_notice(): array
{
    $reason = $_SESSION['session_ended'] ?? null;

    return is_string($reason) ? ['session_ended' => $reason] : [];
}

// -----------------------------------------------------------------------------
// Session records (Correction 5)
//
// One user_sessions row per successful sign-in: who, from which address and
// browser, when it started, when it was last used, when and why it ended.
// The row is found again through $_SESSION['session_record_id']. What it is
// known by in the logs is `session_reference`, a random value of its own —
// never the PHP session id, which is the thing that signs a browser in.
// -----------------------------------------------------------------------------

/** Why a session ended: user_sessions.end_reason, and what the browser is told. */
const SESSION_END_REASONS = [
    'logout', 'idle_timeout', 'absolute_timeout', 'password_reset',
    'new_privileged_login', 'role_promoted', 'account_locked', 'account_suspended',
];

/** Open a record for the session auth_login() has just started. */
function session_record_start(int $userId, int $sessionVersion): void
{
    $reference = bin2hex(random_bytes(16));

    try {
        db()->prepare(
            'INSERT INTO user_sessions (session_reference, user_id, session_version, ip_address, user_agent)
                  VALUES (:reference, :user_id, :version, :ip, :agent)'
        )->execute([
            ':reference' => $reference,
            ':user_id' => $userId,
            ':version' => $sessionVersion,
            ':ip' => client_ip(),
            ':agent' => client_user_agent(),
        ]);

        $_SESSION['session_record_id'] = (int) db()->lastInsertId();
        $_SESSION['session_reference'] = $reference;
        $_SESSION['last_seen_written'] = time();
    } catch (PDOException $exception) {
        // Like audit_log(): failing to record a sign-in must not refuse it.
        error_log('[pawsandfound] session record failed: ' . $exception->getMessage());
    }
}

/**
 * Write "last seen" — at most once every SESSION_LAST_SEEN_INTERVAL seconds,
 * so ordinary browsing is not a database write per request. It is the time of
 * the last authenticated request, the background re-check included: it says
 * a page was open, not that a person was typing.
 */
function touch_session_record(): void
{
    if (empty($_SESSION['session_record_id'])) {
        return;
    }

    $now = time();
    if ($now - (int) ($_SESSION['last_seen_written'] ?? 0) < SESSION_LAST_SEEN_INTERVAL) {
        return;
    }

    try {
        db()->prepare('UPDATE user_sessions SET last_seen_at = NOW()
                        WHERE session_record_id = :id AND ended_at IS NULL')
            ->execute([':id' => (int) $_SESSION['session_record_id']]);
        $_SESSION['last_seen_written'] = $now;
    } catch (PDOException $exception) {
        error_log('[pawsandfound] last-seen update failed: ' . $exception->getMessage());
    }
}

/**
 * Close one record. Only an open one: the first reason written is the true
 * one, and a later request discovering the same end must not overwrite it.
 *
 * @param int|null $endedAt  When it ended, if that was earlier than now — an
 *                           idle session ended an hour after its last request,
 *                           not at the moment somebody came back to find it.
 */
function session_record_end(int $recordId, string $reason, ?int $endedAt = null): void
{
    try {
        $statement = db()->prepare(
            'UPDATE user_sessions
                SET ended_at = ' . ($endedAt === null ? 'NOW()' : 'FROM_UNIXTIME(:at)') . ', end_reason = :reason
              WHERE session_record_id = :id AND ended_at IS NULL'
        );
        $params = [':reason' => $reason, ':id' => $recordId];
        if ($endedAt !== null) {
            $params[':at'] = $endedAt;
        }
        $statement->execute($params);
    } catch (PDOException $exception) {
        error_log('[pawsandfound] session end failed: ' . $exception->getMessage());
    }
}

/**
 * Close every open record of an account, for the events that end all of its
 * sessions at once: a password reset, a lock, a suspension, a promotion, and
 * a privileged sign-in (which ends the earlier one). Called on the same
 * connection as the change itself, so inside its transaction when it has one.
 */
function end_open_sessions(int $userId, string $reason): void
{
    try {
        db()->prepare(
            'UPDATE user_sessions SET ended_at = NOW(), end_reason = :reason
              WHERE user_id = :id AND ended_at IS NULL'
        )->execute([':reason' => $reason, ':id' => $userId]);
    } catch (PDOException $exception) {
        error_log('[pawsandfound] ending sessions failed: ' . $exception->getMessage());
    }
}

/** Why this browser's session record was closed by somebody else, if it was. */
function session_record_end_reason(): ?string
{
    if (empty($_SESSION['session_record_id'])) {
        return null;
    }

    $statement = db()->prepare('SELECT end_reason FROM user_sessions WHERE session_record_id = :id');
    $statement->execute([':id' => (int) $_SESSION['session_record_id']]);
    $reason = $statement->fetchColumn();

    return is_string($reason) ? $reason : null;
}

/**
 * End the signed-in session this request belongs to, and remember why.
 *
 * The identity is removed; the reason stays (session_end_notice()). Nothing
 * is destroyed, so the reason survives until the next sign-in, which starts a
 * new session id anyway.
 */
function end_this_session(string $reason, ?int $endedAt = null): void
{
    if (!empty($_SESSION['session_record_id']) && in_array($reason, SESSION_END_REASONS, true)) {
        session_record_end((int) $_SESSION['session_record_id'], $reason, $endedAt);
    }

    $_SESSION = ['session_ended' => $reason];
}

/** The browser's own description of itself, trimmed to the column. Never parsed. */
function client_user_agent(): ?string
{
    $agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $agent = is_string($agent) ? trim((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $agent)) : '';

    return $agent === '' ? null : mb_substr($agent, 0, 255);
}

// -----------------------------------------------------------------------------
// The activity trail (Correction 5)
//
// Where a signed-in person went and what they did, in user_activity_logs.
// Every action below is written by the PHP endpoint that did it, after it
// succeeded; the browser can report a page it opened (api/logs.php) and
// nothing else. Who, which session, the address and the time are always the
// server's.
//
// Not the audit trail. audit_logs keeps the security and administrative
// events (sign-ins, failures, locks, role changes); this keeps the ordinary
// record of use, and is far larger.
// -----------------------------------------------------------------------------

/** Every action the trail may record. Anything else is refused, not stored. */
const ACTIVITY_ACTIONS = [
    'page_view',
    // Account
    'login', 'logout', 'profile_updated', 'email_change_requested',
    // Reports and drafts
    'draft_saved', 'draft_updated', 'draft_deleted',
    'report_submitted', 'report_edited', 'report_photos_added', 'report_photos_changed',
    'report_status_changed',
    // Publication review (Correction 4)
    'report_approved', 'report_rejected', 'report_resubmitted', 'report_removed',
    // Matching
    'match_request_verification', 'match_dismiss', 'match_reject', 'match_request_information',
    'match_provide_information', 'match_confirm', 'match_reopen',
    // Moderation
    'report_flagged', 'moderation_decided',
    // Notifications
    'notification_read', 'notifications_all_read',
    // Administration
    'account_status_changed', 'role_changed', 'category_changed',
];

/**
 * Record one thing a signed-in person did.
 *
 * Best effort, like audit_log(): the action has already happened, and a log
 * that could not be written must not undo it or fail the response. Never a
 * request body, a description, a password or a token — the action's name, what
 * it was done to, and at most a short note the server wrote itself.
 */
function activity_log(
    int $userId,
    string $action,
    ?string $targetType = null,
    ?int $targetId = null,
    ?string $detail = null,
    ?string $route = null,
): void {
    if (!in_array($action, ACTIVITY_ACTIONS, true)) {
        error_log('[pawsandfound] refused to log an unknown activity: ' . substr($action, 0, 40));
        return;
    }

    try {
        db()->prepare(
            'INSERT INTO user_activity_logs
                    (user_id, session_record_id, action, route, target_type, target_id, detail, ip_address)
             VALUES (:user_id, :session, :action, :route, :target_type, :target_id, :detail, :ip)'
        )->execute([
            ':user_id' => $userId,
            ':session' => empty($_SESSION['session_record_id']) ? null : (int) $_SESSION['session_record_id'],
            ':action' => $action,
            ':route' => $route,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
            ':detail' => $detail === null ? null : mb_substr($detail, 0, 120),
            ':ip' => client_ip(),
        ]);
    } catch (PDOException $exception) {
        error_log('[pawsandfound] activity log failed: ' . $exception->getMessage());
    }
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
// Account rules: names and passwords
//
// One copy of each rule on the server. Registration and the profile form share
// the name rule; registration and the password reset share the password rule,
// so a reset cannot be a way around it. src/utils/nameRules.js and
// src/utils/passwordRules.js say the same thing sooner, and a contract test
// (scripts/report-form-contract.test.mjs) holds the two copies together.
// -----------------------------------------------------------------------------

/** The shortest password that may be chosen now. Existing ones still sign in. */
const PASSWORD_MIN_CHARS = 15;

/** bcrypt ignores everything past 72 BYTES, so the limit is in bytes, not characters. */
const PASSWORD_MAX_BYTES = 72;

/**
 * Words that make a long password weak when they are all it is: the word
 * repeated, or followed or preceded only by digits. A local list of high-risk
 * choices, not a database of breached passwords.
 */
const COMMON_PASSWORD_WORDS = [
    'password', 'passw0rd', 'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'iloveyou', 'letmein',
    'admin', 'administrator', 'welcome', 'abc123', 'monkey', 'dragon', 'football', 'baseball',
    'sunshine', 'princess', 'master', 'shadow', 'superman', 'batman', 'trustno1', 'hello',
    'freedom', 'whatever', 'qazwsx', 'starwars', 'pokemon', 'secret', 'changeme', 'login',
    'user', 'test', 'guest', 'default', 'pawsandfound', 'pawsfound', 'paws', 'mahalkita',
];

/** The longest first or last name, in characters. Matches users.first_name / last_name. */
const NAME_PART_MAX = 60;

/**
 * A first or last name, cleaned, and what is wrong with it if anything is.
 *
 * Asked for separately since the post-defense corrections: the instructor wants
 * First Name and Last Name as two fields, and the password rule below needs the
 * parts to check against. `$which` is 'first' or 'last', for the messages.
 *
 * Human names: letters from any language with their accents, plus spaces,
 * apostrophes (straight or curly), hyphens and periods — "Ma.", "Anne-Marie",
 * "D'Angelo", "O’Connor", "Dela Cruz". At least two letters, which refuses "A",
 * "1", "!!!!" and "-" while allowing two-letter names such as "Jo" and "Li".
 *
 * @return array{0: string, 1: ?string}  the name to store, and the error or null
 */
function validate_name_part(string $raw, string $which): array
{
    $label = $which === 'last' ? 'last name' : 'first name';

    // Runs of spaces become one, so "Dela   Cruz" is stored as it reads.
    $name = trim((string) preg_replace('/\s+/u', ' ', $raw));

    if ($name === '') {
        return [$name, "Enter your {$label}."];
    }
    if (mb_strlen($name) > NAME_PART_MAX) {
        return [$name, "That {$label} is too long (" . NAME_PART_MAX . ' characters maximum).'];
    }
    if (preg_match_all('/\p{L}/u', $name) < 2) {
        return [$name, "Enter a real {$label} with at least 2 letters."];
    }
    if (!preg_match("/^[\p{L}\p{M} '’.\-]+$/u", $name)) {
        return [$name, 'Use letters, spaces, apostrophes, hyphens and periods only.'];
    }

    return [$name, null];
}

/**
 * The pieces of a person's name a password may not contain.
 *
 * Each name is split on anything that is not a letter, lower-cased, and every
 * piece of two letters or more kept: "Anne-Marie" gives "anne" and "marie",
 * "Dela Cruz" gives "dela" and "cruz", "Ma." gives "ma". A one-letter piece is
 * dropped — refusing every password containing an "a" helps nobody.
 *
 * @return string[]
 */
function password_name_pieces(?string $firstName, ?string $lastName): array
{
    $pieces = [];
    foreach ([$firstName, $lastName] as $name) {
        foreach (preg_split('/[^\p{L}\p{M}]+/u', mb_strtolower((string) $name)) ?: [] as $piece) {
            if (mb_strlen($piece) >= 2) {
                $pieces[] = $piece;
            }
        }
    }

    return array_values(array_unique($pieces));
}

/** Lower case, letters and digits only — the form most comparisons are made in. */
function password_letters_and_digits(string $value): string
{
    return (string) preg_replace('/[^\p{L}\p{N}]+/u', '', mb_strtolower($value));
}

/**
 * Is this a long password that is still one of the obvious ones?
 *
 * Deliberately narrow, so it never refuses a real passphrase: the whole
 * password has to be a single character repeated, one short piece repeated, a
 * straight run along the digits, the alphabet or the keyboard, or a common word
 * with nothing but digits added. "password-after-lock" passes; "passwordpassword"
 * and "Password123456789" do not.
 */
function is_common_password(string $password): bool
{
    // @ and $ read as the letters they stand for; everything but letters and
    // digits is then dropped, so "pass word", "pass-word" and "p@ssword" agree.
    $plain = password_letters_and_digits(strtr(mb_strtolower($password), ['@' => 'a', '$' => 's']));

    if ($plain === '') {
        return false;
    }

    // One piece, repeated: aaaa…, passwordpassword, 123123123….
    if (preg_match('/^(.+?)\1+$/u', $plain)) {
        return true;
    }

    // A straight run, forwards or backwards, wrapping round: 123456789012345.
    foreach (['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'] as $run) {
        $loop = str_repeat($run, intdiv(strlen($plain), strlen($run)) + 2);
        if (str_contains($loop, $plain) || str_contains(strrev($loop), $plain)) {
            return true;
        }
    }

    // A common word with only digits before or after it: welcome123456789,
    // P@ssw0rd123456789. Look-alike digits are read as letters inside the word
    // only, so the digits after it still count as digits.
    $lookAlike = ['0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't'];
    foreach (COMMON_PASSWORD_WORDS as $word) {
        $size = strlen($word);
        if (strlen($plain) <= $size) {
            continue;
        }
        $wordRead = strtr($word, $lookAlike);
        if (strtr(substr($plain, 0, $size), $lookAlike) === $wordRead && ctype_digit(substr($plain, $size))) {
            return true;
        }
        if (strtr(substr($plain, -$size), $lookAlike) === $wordRead && ctype_digit(substr($plain, 0, -$size))) {
            return true;
        }
    }

    return false;
}

/**
 * What is wrong with a password being chosen now, or null.
 *
 * Used when an account is created and when a password is reset — never at
 * sign-in, so every existing password keeps working. No rule about capitals,
 * digits or symbols: those produce "Password1!", and length does more.
 *
 * `$email`, `$firstName` and `$lastName` are the account's, when known.
 *
 * The NAME rule is a substring rule, by instructor requirement: the password may
 * not contain the person's first or last name — any piece of either, two letters
 * or more — anywhere, ignoring case. For "Ja" that refuses "123jaabcdefghijk"
 * and "secure-ja-password". Deterministic, not fuzzy: no misspellings, no
 * look-alikes. It is strict on purpose and it costs something — a two-letter
 * name rules out every password containing those two letters — which is why
 * the form shows the rule live as the password is typed.
 *
 * The EMAIL rule stays an equality rule: the password may not simply be the
 * address, or the part before the @.
 */
function password_policy_error(
    string $password,
    ?string $email = null,
    ?string $firstName = null,
    ?string $lastName = null,
): ?string
{
    if (mb_strlen($password) < PASSWORD_MIN_CHARS) {
        return 'Use at least ' . PASSWORD_MIN_CHARS . ' characters. A few words together make a good one.';
    }
    if (strlen($password) > PASSWORD_MAX_BYTES) {
        // bcrypt ignores everything past 72 bytes, so a longer password would
        // not mean what the person choosing it thinks it means.
        return 'That password is too long (72 bytes at most; accented letters and emoji use more than one).';
    }
    if (is_common_password($password)) {
        return 'That password is too commonly used. Try a longer, less predictable passphrase.';
    }

    $mine = password_letters_and_digits($password);
    $identity = [];
    if ($email !== null && $email !== '') {
        $identity[] = mb_strtolower(trim($email));
        $identity[] = password_letters_and_digits($email);
        $identity[] = password_letters_and_digits(strstr($email, '@', true) ?: $email);
    }
    if (in_array(mb_strtolower($password), $identity, true) || ($mine !== '' && in_array($mine, $identity, true))) {
        return 'Choose a password that is not your email address.';
    }

    $lowered = mb_strtolower($password);
    foreach (password_name_pieces($firstName, $lastName) as $piece) {
        if (str_contains($lowered, $piece)) {
            return 'Choose a password that does not contain your first or last name.';
        }
    }

    return null;
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
 * The caller's address, for the logs, the sessions and the rate limits.
 *
 * One answer for every use, so an audit row, a session record, an activity
 * row and a rate-limit bucket made by the same request always agree.
 *
 * Off Railway (XAMPP, a local Docker run): REMOTE_ADDR, the address that
 * opened the connection. Any X-Real-IP or X-Forwarded-For is ignored — the
 * person connecting could have written it.
 *
 * On Railway (BEHIND_RAILWAY_EDGE, decided from the deployment in
 * config.php, never from the request): REMOTE_ADDR is Railway's own edge for
 * every visitor, so the visitor is X-Real-IP, which Railway documents as the
 * client's address, sets on every request and overwrites if a client sent
 * one. It must be exactly one valid IPv4 or IPv6 address. If it is missing or
 * malformed the edge did not keep its contract: REMOTE_ADDR is used instead,
 * and the server log says so (without the header's value), because every
 * visitor would then share one rate-limit bucket. X-Forwarded-For is never
 * read; Railway recommends X-Real-IP over parsing it.
 */
function client_ip(): ?string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? null;
    $remote = is_string($remote) && filter_var($remote, FILTER_VALIDATE_IP) !== false ? $remote : null;

    if (!BEHIND_RAILWAY_EDGE) {
        return $remote;
    }

    $real = $_SERVER['HTTP_X_REAL_IP'] ?? '';
    $real = is_string($real) ? trim($real) : '';
    if ($real !== '' && filter_var($real, FILTER_VALIDATE_IP) !== false) {
        return $real;
    }

    error_log('[pawsandfound] X-Real-IP ' . ($real === '' ? 'missing' : 'not a single IP address')
        . ' behind the Railway edge; using REMOTE_ADDR');

    return $remote;
}

/**
 * Stop unless somebody is signed in. Returns the user so callers can use it.
 *
 * The refusal carries `session_ended` when this browser was signed in until
 * the server ended it, so whichever request finds out can say why.
 */
function require_login(): array
{
    $user = current_user();

    if ($user === null) {
        json_error('You need to be signed in to do that.', 401, session_end_notice());
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
