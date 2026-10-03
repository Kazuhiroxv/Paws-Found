<?php
/**
 * The activity trail and the log viewer (Correction 5).
 *
 *   POST /api/activity/page-view   a signed-in browser reports the page it opened
 *   GET  /api/logs/activity        where people went and what they did   (administrators)
 *   GET  /api/logs/sessions        sign-ins: account, IP, browser, start, end (administrators)
 *   GET  /api/logs/audit           security and administrative events   (administrators)
 *
 * The three log lists take the same filters — user (name or email), ip, from
 * and to (YYYY-MM-DD, Philippine days), page and per_page — plus their own:
 * action, route and session on the activity list; state and session on the
 * sessions list; action and outcome on the audit list. Newest first, one page
 * at a time, filtered in SQL, never by sending everything to the browser.
 *
 * Super Administrators only (view_security_logs, Correction 6): IP addresses,
 * browsers and browsing history are more sensitive than anything moderation
 * or account management needs.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/** The same page opened again within this many seconds is one visit, not two. */
const PAGE_VIEW_REPEAT_SECONDS = 3;

/** A browser reporting more pages than this in a minute is not a person reading. */
const PAGE_VIEWS_PER_MINUTE = 60;

/** audit_logs.action, in the ENUM's own order (database/schema.sql). */
const AUDIT_ACTIONS = [
    'login', 'login_failed', 'account_locked', 'account_unlocked', 'logout', 'register',
    'role_changed', 'account_suspended', 'account_reinstated', 'report_status_changed',
    'match_decided', 'moderation_resolved', 'category_changed', 'email_verified',
    'email_change_completed', 'password_reset', 'report_reviewed', 'report_removed',
];

function handle_activity(string $method, ?string $identifier): never
{
    if ($method === 'POST' && $identifier === 'page-view') {
        activity_page_view();
    }

    json_error('No such endpoint.', 404);
}

function handle_logs(string $method, ?string $identifier): never
{
    if ($method === 'GET') {
        match ($identifier) {
            'activity' => logs_activity(),
            'sessions' => logs_sessions(),
            'audit' => logs_audit(),
            default => null,
        };
    }

    json_error('No such endpoint.', 404);
}

// -----------------------------------------------------------------------------
// Page views
// -----------------------------------------------------------------------------

/**
 * Record that a signed-in person opened a page.
 *
 * The browser sends one thing, the path ('/pet/43'). Who, which session, the
 * address and the time are the server's. A query string or a #fragment is
 * refused rather than trimmed, so nothing that might carry a token — a reset
 * link's ?token=… — can arrive here even by mistake. Guests are not tracked:
 * the endpoint needs a session.
 *
 * Two guards keep it a record of reading rather than of noise: the same page
 * twice within a few seconds is one visit, and a session reporting more than
 * a person could read in a minute is told so and not stored.
 */
function activity_page_view(): never
{
    $user = require_login();
    $path = request_body()['path'] ?? null;

    if (!is_string($path) || !is_page_path($path)) {
        json_error("'path' must be a page of this site: a path that starts with /, with no query string or #.", 422);
    }

    $now = time();
    $last = $_SESSION['last_page_view'] ?? null;
    if (is_array($last) && $last[0] === $path && $now - (int) $last[1] < PAGE_VIEW_REPEAT_SECONDS) {
        json_response(['logged' => false]);
    }

    $window = $_SESSION['page_view_window'] ?? [0, 0];
    if ($now - (int) $window[0] >= 60) {
        $window = [$now, 0];
    }
    if ($window[1] >= PAGE_VIEWS_PER_MINUTE) {
        json_error('Too many page views from this session; slow down.', 429);
    }

    $_SESSION['page_view_window'] = [$window[0], $window[1] + 1];
    $_SESSION['last_page_view'] = [$path, $now];

    [$targetType, $targetId] = page_target($path);
    activity_log((int) $user['user_id'], 'page_view', $targetType, $targetId, null, $path);

    json_response(['logged' => true], 201);
}

/** A path inside this site: '/', letters, digits and - _ . /, no '//', 200 characters at most. */
function is_page_path(string $path): bool
{
    return strlen($path) <= 200
        && preg_match('#^/[A-Za-z0-9/_.\-]*$#', $path) === 1
        && !str_contains($path, '//');
}

/**
 * The report a page is about, when it is about one, so "who opened report 43"
 * can be asked of the log. Read from the path by the server, never sent.
 *
 * @return array{0: ?string, 1: ?int}
 */
function page_target(string $path): array
{
    if (preg_match('#^/pet/(\d{1,9})$#', $path, $m) || preg_match('#^/dashboard/reports/(\d{1,9})/edit$#', $path, $m)) {
        return ['report', (int) $m[1]];
    }

    return [null, null];
}

// -----------------------------------------------------------------------------
// The log viewer
// -----------------------------------------------------------------------------

function logs_activity(): never
{
    require_capability('view_security_logs');

    $where = [];
    $params = [];
    log_person_filter('u.full_name', 'u.email', $where, $params);
    log_ip_filter('a.ip_address', $where, $params);
    log_date_filter('a.created_at', $where, $params);

    $action = query_string_param('action');
    if ($action === 'actions') {
        // Everything but page views: "what did they do", not "where did they go".
        $where[] = "a.action <> 'page_view'";
    } elseif ($action !== null) {
        require_one_of($action, ACTIVITY_ACTIONS, 'action');
        $where[] = 'a.action = :action';
        $params[':action'] = $action;
    }

    $route = query_string_param('route');
    if ($route !== null) {
        if (!is_page_path($route)) {
            json_error("'route' must be a path such as /pet/43.", 422);
        }
        // A prefix: '/staff' finds every page of the staff workspace.
        $where[] = 'a.route LIKE :route';
        $params[':route'] = like_prefix($route);
    }

    log_session_filter('s.session_reference', $where, $params);

    $from = 'FROM user_activity_logs a
             JOIN users u ON u.user_id = a.user_id
        LEFT JOIN user_sessions s ON s.session_record_id = a.session_record_id';

    log_page(
        "SELECT a.activity_id, a.created_at, a.action, a.route, a.target_type, a.target_id, a.detail,
                a.ip_address, u.user_id, u.full_name, u.email, u.role, s.session_reference
         {$from}",
        "SELECT COUNT(*) {$from}",
        $where,
        $params,
        'a.created_at DESC, a.activity_id DESC',
        fn ($row) => [
            'activity_id' => (int) $row['activity_id'],
            'created_at' => $row['created_at'],
            'action' => $row['action'],
            'route' => $row['route'],
            'target_type' => $row['target_type'],
            'target_id' => $row['target_id'] === null ? null : (int) $row['target_id'],
            'detail' => $row['detail'],
            'ip_address' => $row['ip_address'],
            'session_reference' => $row['session_reference'],
            'user' => log_person($row),
        ]
    );
}

function logs_sessions(): never
{
    require_capability('view_security_logs');

    $where = [];
    $params = [];
    log_person_filter('u.full_name', 'u.email', $where, $params);
    log_ip_filter('s.ip_address', $where, $params);
    log_date_filter('s.started_at', $where, $params);
    log_session_filter('s.session_reference', $where, $params);

    // A session with no end written is only "open" while it could still be
    // used. Past either clock it is expired, even though nothing recorded the
    // moment — a closed laptop does not say goodbye. Last seen is written at
    // most every SESSION_LAST_SEEN_INTERVAL seconds, so the idle window is
    // widened by that much rather than calling a live session expired.
    $idle = SESSION_IDLE_TIMEOUT + SESSION_LAST_SEEN_INTERVAL;
    $absolute = SESSION_ABSOLUTE_TIMEOUT;
    $stale = "(s.last_seen_at < NOW() - INTERVAL {$idle} SECOND OR s.started_at < NOW() - INTERVAL {$absolute} SECOND)";
    $state = "CASE WHEN s.ended_at IS NOT NULL THEN 'ended' WHEN {$stale} THEN 'expired' ELSE 'open' END";

    $wanted = require_one_of(query_string_param('state'), ['open', 'ended', 'expired'], 'state');
    if ($wanted !== null) {
        $where[] = match ($wanted) {
            'ended' => 's.ended_at IS NOT NULL',
            'expired' => "s.ended_at IS NULL AND {$stale}",
            'open' => "s.ended_at IS NULL AND NOT {$stale}",
        };
    }

    $from = 'FROM user_sessions s JOIN users u ON u.user_id = s.user_id';

    log_page(
        "SELECT s.session_record_id, s.session_reference, s.ip_address, s.user_agent, s.started_at,
                s.last_seen_at, s.ended_at, s.end_reason, {$state} AS state,
                (SELECT COUNT(*) FROM user_activity_logs a WHERE a.session_record_id = s.session_record_id) AS activity_count,
                u.user_id, u.full_name, u.email, u.role
         {$from}",
        "SELECT COUNT(*) {$from}",
        $where,
        $params,
        's.started_at DESC, s.session_record_id DESC',
        fn ($row) => [
            'session_reference' => $row['session_reference'],
            'ip_address' => $row['ip_address'],
            'user_agent' => $row['user_agent'],
            'started_at' => $row['started_at'],
            'last_seen_at' => $row['last_seen_at'],
            'ended_at' => $row['ended_at'],
            'end_reason' => $row['end_reason'],
            'state' => $row['state'],
            'activity_count' => (int) $row['activity_count'],
            'user' => log_person($row),
        ]
    );
}

function logs_audit(): never
{
    require_capability('view_security_logs');

    $where = [];
    $params = [];
    // The actor's name, or the address typed at a failed sign-in.
    log_person_filter('actor.full_name', 'a.actor_email', $where, $params);
    log_ip_filter('a.ip_address', $where, $params);
    log_date_filter('a.created_at', $where, $params);

    $action = require_one_of(query_string_param('action'), AUDIT_ACTIONS, 'action');
    if ($action !== null) {
        $where[] = 'a.action = :action';
        $params[':action'] = $action;
    }

    $outcome = require_one_of(query_string_param('outcome'), ['success', 'failure'], 'outcome');
    if ($outcome !== null) {
        $where[] = 'a.outcome = :outcome';
        $params[':outcome'] = $outcome;
    }

    $from = 'FROM audit_logs a LEFT JOIN users actor ON actor.user_id = a.actor_user_id';

    log_page(
        "SELECT a.audit_id, a.created_at, a.action, a.actor_user_id, a.actor_email, actor.full_name,
                a.target_type, a.target_id, a.outcome, a.detail, a.ip_address
         {$from}",
        "SELECT COUNT(*) {$from}",
        $where,
        $params,
        'a.created_at DESC, a.audit_id DESC',
        fn ($row) => [
            'audit_id' => (int) $row['audit_id'],
            'created_at' => $row['created_at'],
            'action' => $row['action'],
            'actor' => [
                'user_id' => $row['actor_user_id'] === null ? null : (int) $row['actor_user_id'],
                'full_name' => $row['full_name'],
                'email' => $row['actor_email'],
            ],
            'target_type' => $row['target_type'],
            'target_id' => $row['target_id'] === null ? null : (int) $row['target_id'],
            'outcome' => $row['outcome'],
            'detail' => $row['detail'],
            'ip_address' => $row['ip_address'],
        ]
    );
}

/** Run one page of a log query, newest first, and answer with it and the total. */
function log_page(string $select, string $count, array $where, array $params, string $order, callable $shape): never
{
    $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
    $page = query_int_param('page', 1, 1, 100000);
    $perPage = query_int_param('per_page', 25, 1, 100);

    $total = db()->prepare($count . $clause);
    $total->execute($params);
    $total = (int) $total->fetchColumn();

    $statement = db()->prepare("{$select}{$clause} ORDER BY {$order} LIMIT :limit OFFSET :offset");
    foreach ($params as $name => $value) {
        $statement->bindValue($name, $value);
    }
    $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $statement->bindValue(':offset', ($page - 1) * $perPage, PDO::PARAM_INT);
    $statement->execute();

    json_response([
        'data' => array_map($shape, $statement->fetchAll()),
        'meta' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => max(1, (int) ceil($total / $perPage)),
        ],
    ]);
}

/** ?user= — part of a name or an email address. */
function log_person_filter(string $nameColumn, string $emailColumn, array &$where, array &$params): void
{
    $person = query_string_param('user');
    if ($person === null) {
        return;
    }

    // One placeholder per column: a native prepared statement binds each once.
    $where[] = "({$nameColumn} LIKE :person_name OR {$emailColumn} LIKE :person_email)";
    $params[':person_name'] = '%' . like_escape($person) . '%';
    $params[':person_email'] = '%' . like_escape($person) . '%';
}

/** ?ip= — one exact address, IPv4 or IPv6. */
function log_ip_filter(string $column, array &$where, array &$params): void
{
    $ip = query_string_param('ip');
    if ($ip === null) {
        return;
    }
    if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
        json_error("'ip' must be one IPv4 or IPv6 address.", 422);
    }

    $where[] = "{$column} = :ip";
    $params[':ip'] = $ip;
}

/** ?session= — the start of a session reference, as the viewer shows it shortened. */
function log_session_filter(string $column, array &$where, array &$params): void
{
    $reference = query_string_param('session');
    if ($reference === null) {
        return;
    }
    $reference = strtolower(rtrim($reference, '.…'));
    if (preg_match('/^[0-9a-f]{4,32}$/', $reference) !== 1) {
        json_error("'session' must be a session reference: at least 4 of its hexadecimal characters.", 422);
    }

    $where[] = "{$column} LIKE :session";
    $params[':session'] = $reference . '%';
}

/**
 * ?from= and ?to= — whole days in the Philippines, both included. The column
 * holds UTC (api/db.php), so a Manila day is turned into its UTC hours.
 */
function log_date_filter(string $column, array &$where, array &$params): void
{
    foreach (['from' => '>=', 'to' => '<'] as $name => $operator) {
        $day = query_string_param($name);
        if ($day === null) {
            continue;
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $day, $m) !== 1 || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            json_error("'{$name}' must be a date, YYYY-MM-DD.", 422);
        }

        $moment = new DateTimeImmutable($day . ' 00:00:00', new DateTimeZone('Asia/Manila'));
        if ($name === 'to') {
            $moment = $moment->modify('+1 day');
        }

        $where[] = "{$column} {$operator} :{$name}";
        $params[":{$name}"] = $moment->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
}

/** LIKE's own wildcards, typed by somebody searching, mean themselves. */
function like_escape(string $text): string
{
    return addcslashes($text, '%_\\');
}

function like_prefix(string $text): string
{
    return like_escape($text) . '%';
}

/** The account a log row belongs to. */
function log_person(array $row): array
{
    return [
        'user_id' => (int) $row['user_id'],
        'full_name' => $row['full_name'],
        'email' => $row['email'],
        'role' => $row['role'],
    ];
}
