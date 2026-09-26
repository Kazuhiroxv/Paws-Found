<?php
/**
 * Possible matches between a lost and a found report.
 *
 *   GET   /api/matches?report_id=1   pairings involving one report
 *   GET   /api/matches?user_id=1     pairings involving any of a user's reports
 *   GET   /api/matches/3             one pairing
 *   PATCH /api/matches/3             act on a pairing (see ACTIONS below)
 *
 * Every response carries the seven comparison signals, because the wording rule
 * (CLAUDE.md §6.5) requires this to be shown as a *possible* match with its
 * reasoning visible — never as a conclusion.
 *
 * `staff_notes` is never included. It is written by coordinators for
 * coordinators and is not public.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/**
 * What may be done to a pairing, and who may do it.
 *
 * The two people involved can say "this could be mine" or "not my pet". Only a
 * coordinator can confirm, reject, or ask for more information — confirming is
 * what closes two cases and tells two people their search is over, so it is
 * never a decision the claimant makes alone (CLAUDE.md §6.6).
 */
const MATCH_ACTIONS = [
    'request_verification' => ['reporter'],
    'dismiss'             => ['reporter'],
    'confirm'             => ['staff'],
    'reject'              => ['staff'],
    'request_information' => ['staff'],
];

function handle_matches(string $method, ?string $identifier): never
{
    if ($method === 'GET') {
        if ($identifier !== null && ctype_digit($identifier)) {
            match_detail((int) $identifier);
        }

        matches_list();
    }

    if ($method === 'PATCH' && $identifier !== null && ctype_digit($identifier)) {
        match_decide((int) $identifier);
    }

    json_error('No such endpoint.', 404);
}

/**
 * Act on a pairing.
 *
 * Confirming is the one that changes the most: it closes both reports as
 * returned, records the change on each case history, and tells both reporters.
 * All of that happens in a single transaction, because a half-applied
 * confirmation would leave one pet reunited and the other still missing.
 */
function match_decide(int $id): never
{
    $user = require_login();
    $body = request_body();

    $action = trim((string) ($body['action'] ?? ''));
    if (!array_key_exists($action, MATCH_ACTIONS)) {
        json_error("'action' must be one of: " . implode(', ', array_keys(MATCH_ACTIONS)), 422);
    }

    $match = find_match_or_404($id);
    $note = blank_to_null($body['note'] ?? null);

    $isStaff = in_array($user['role'], ['staff', 'admin'], true);
    $isReporter = in_array((int) $user['user_id'], [
        (int) $match['lost_user_id'],
        (int) $match['found_user_id'],
    ], true);

    $allowed = MATCH_ACTIONS[$action];

    if (in_array('staff', $allowed, true) && !$isStaff) {
        json_error('Only a Pet Coordinator can decide a pairing.', 403);
    }

    if ($allowed === ['reporter'] && !$isReporter && !$isStaff) {
        json_error('Only someone involved in this pairing can do that.', 403);
    }

    // A decided pairing is final. Without this, confirming twice runs the whole
    // cascade a second time: both reporters are told again, and each case
    // history gains a meaningless "returned -> returned" entry.
    // `moderation_decide` already refuses a second decision the same way.
    //
    // Checked after the role guards, so an unauthorised caller still gets 403
    // rather than learning what state the pairing is in.
    if (in_array($match['match_status'], ['confirmed', 'rejected', 'dismissed'], true)) {
        json_error('That pairing has already been decided.', 409);
    }

    // Requesting more information needs the note: it is what gets sent.
    if ($action === 'request_information' && $note === null) {
        json_error('Write what you need from the reporters before asking.', 422);
    }

    // Confirming moves both reports to 'returned', which is the one place a
    // report's status is written without passing through REPORT_TRANSITIONS in
    // api/reports.php. So the same rule is applied here: both reports must
    // still be open. Otherwise a pairing raised before a moderation decision
    // closed one of the reports could be confirmed afterwards, quietly
    // reopening a closed case as a reunion.
    //
    // Before the transaction starts, so nothing has to be unwound.
    if ($action === 'confirm') {
        foreach (['lost_report_id', 'found_report_id'] as $key) {
            $check = db()->prepare('SELECT status FROM pet_reports WHERE report_id = :id');
            $check->execute([':id' => (int) $match[$key]]);

            if (!in_array($check->fetchColumn(), ['active', 'possible_match'], true)) {
                json_error(
                    'One of these reports is no longer open, so this pairing cannot be confirmed.',
                    409
                );
            }
        }
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        match ($action) {
            'request_verification' => match_set_status($id, 'verification_requested', $user, $note),
            'dismiss'              => match_dismiss($id, $match, $user, $note),
            'reject'               => match_reject($id, $match, $user, $note),
            'request_information'  => match_request_information($id, $match, $user, $note),
            'confirm'              => match_confirm($id, $match, $user, $note),
        };

        $after = $pdo->prepare('SELECT match_status FROM match_claims WHERE match_id = :id');
        $after->execute([':id' => $id]);
        $matchStatusAfter = (string) $after->fetchColumn();

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // `match_claims.reviewed_by_user_id` already says who last touched this
    // pairing, but it holds one name and is overwritten by the next decision.
    // The audit row is appended, so a pairing that was asked about, then
    // rejected, then complained about reads as three entries in order rather
    // than one name with no history behind it.
    audit_log('match_decided', (int) $user['user_id'], $user['email'],
        'match', $id, 'success', "{$action}: {$match['match_status']} -> {$matchStatusAfter}");

    match_detail($id);
}

/** Move a pairing to a new status, recording who decided it. */
function match_set_status(int $id, string $status, array $user, ?string $note): void
{
    $staffId = in_array($user['role'], ['staff', 'admin'], true) ? (int) $user['user_id'] : null;

    $statement = db()->prepare(
        'UPDATE match_claims
            SET match_status = :status,
                reviewed_by_user_id = COALESCE(:staff_id, reviewed_by_user_id),
                staff_notes = COALESCE(:note, staff_notes)
          WHERE match_id = :id'
    );
    $statement->execute([
        ':status' => $status,
        ':staff_id' => $staffId,
        ':note' => $staffId === null ? null : $note,
        ':id' => $id,
    ]);
}

/** Ruled out. Both reports go back to being searched for. */
function match_reject(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'rejected', $user, $note);
    release_reports_without_open_matches($match, $user);

    notify_both(
        $match,
        'match_rejected',
        'A possible match was ruled out',
        $note ?? 'A Pet Coordinator reviewed the pairing and it is not the same animal.'
    );
}

/** The reporter says it is not their pet. */
function match_dismiss(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'dismissed', $user, $note);
    release_reports_without_open_matches($match, $user);
}

/**
 * Put a report back to Active once nothing is pending on it.
 *
 * A report is moved to Possible Match when a pairing is suggested. Settling
 * that pairing — ruled out by a coordinator, or the reporter saying it is not
 * their pet — has to move it back, or the report goes on saying "Possible
 * Match" when there is no longer a possible match to look at, and the owner
 * keeps opening it expecting news.
 *
 * This was not needed until suggestions began setting the status themselves:
 * before that, reports simply stayed Active and the wording in match_reject()
 * was accidentally true.
 *
 * A report with another suggestion still open is left alone.
 */
function release_reports_without_open_matches(array $match, array $user): void
{
    $remaining = db()->prepare(
        "SELECT COUNT(*)
           FROM match_claims
          WHERE (lost_report_id = :a OR found_report_id = :b)
            AND match_status NOT IN ('rejected', 'dismissed', 'confirmed')"
    );

    $update = db()->prepare(
        "UPDATE pet_reports
            SET status = 'active'
          WHERE report_id = :id AND status = 'possible_match'"
    );

    foreach (['lost_report_id', 'found_report_id'] as $key) {
        $reportId = (int) $match[$key];

        $remaining->execute([':a' => $reportId, ':b' => $reportId]);
        if ((int) $remaining->fetchColumn() > 0) {
            continue;
        }

        $update->execute([':id' => $reportId]);

        // Only write history if the status actually moved. A report already
        // Active — closed, returned, or never promoted — must not gain a line
        // saying something changed when nothing did.
        if ($update->rowCount() > 0) {
            log_match_status_change(
                $reportId,
                (int) $user['user_id'],
                'possible_match',
                'active',
                'No possible matches are open on this report.'
            );
        }
    }
}

/** The coordinator needs something more before deciding. */
function match_request_information(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'under_review', $user, $note);

    notify_both($match, 'staff_reviewed', 'A Pet Coordinator needs more information', $note);
}

/**
 * Confirm a pairing.
 *
 * Both reports become `returned`, each gets a history entry, and both reporters
 * are told. This is the cascade the whole workflow builds towards.
 */
function match_confirm(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'confirmed', $user, $note);

    foreach (['lost_report_id', 'found_report_id'] as $key) {
        $reportId = (int) $match[$key];

        $current = db()->prepare('SELECT status FROM pet_reports WHERE report_id = :id');
        $current->execute([':id' => $reportId]);
        $previous = $current->fetchColumn() ?: null;

        $update = db()->prepare("UPDATE pet_reports SET status = 'returned' WHERE report_id = :id");
        $update->execute([':id' => $reportId]);

        log_match_status_change(
            $reportId,
            (int) $user['user_id'],
            $previous,
            'returned',
            'Ownership verified by the Pet Coordinator. Pet returned to the owner.'
        );
    }

    notify_both(
        $match,
        'match_confirmed',
        'Match confirmed — the pet is going home',
        $note ?? 'A Pet Coordinator verified the pairing. Both reports are now closed as returned.'
    );
}

// -----------------------------------------------------------------------------
// Shared pieces
// -----------------------------------------------------------------------------

function find_match_or_404(int $id): array
{
    $statement = db()->prepare(
        'SELECT m.match_id, m.lost_report_id, m.found_report_id, m.match_status,
                lr.user_id AS lost_user_id, fr.user_id AS found_user_id
           FROM match_claims m
           JOIN pet_reports lr ON lr.report_id = m.lost_report_id
           JOIN pet_reports fr ON fr.report_id = m.found_report_id
          WHERE m.match_id = :id'
    );
    $statement->execute([':id' => $id]);
    $match = $statement->fetch();

    if (!$match) {
        json_error('That match does not exist.', 404);
    }

    return $match;
}

/**
 * `reports.php` owns the identical helper, and only one of the two files is
 * loaded per request, so each declares its own rather than sharing a third
 * file for eleven lines (CLAUDE.md §15).
 */
function log_match_status_change(int $reportId, ?int $userId, ?string $from, string $to, ?string $note): void
{
    $statement = db()->prepare(
        'INSERT INTO status_logs (report_id, updated_by_user_id, previous_status, new_status, note)
         VALUES (:report_id, :user_id, :previous, :new, :note)'
    );
    $statement->execute([
        ':report_id' => $reportId,
        ':user_id' => $userId,
        ':previous' => $from,
        ':new' => $to,
        ':note' => $note,
    ]);
}

/** Tell both reporters what happened to their pairing. */
function notify_both(array $match, string $type, string $title, ?string $body): void
{
    $statement = db()->prepare(
        'INSERT INTO notifications (user_id, notification_type, title, body, report_id, match_id)
         VALUES (:user_id, :type, :title, :body, :report_id, :match_id)'
    );

    $sides = [
        [(int) $match['lost_user_id'], (int) $match['lost_report_id']],
        [(int) $match['found_user_id'], (int) $match['found_report_id']],
    ];

    foreach ($sides as [$userId, $reportId]) {
        if (!wants_notification($userId, $type)) {
            continue;
        }

        $statement->execute([
            ':user_id' => $userId,
            ':type' => $type,
            ':title' => $title,
            ':body' => $body,
            ':report_id' => $reportId,
            ':match_id' => (int) $match['match_id'],
        ]);
    }
}

function blank_to_null(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function matches_list(): never
{
    $where = [];
    $params = [];

    if (($reportId = query_string_param('report_id')) !== null) {
        $where[] = '(m.lost_report_id = :report_a OR m.found_report_id = :report_b)';
        $params[':report_a'] = (int) $reportId;
        $params[':report_b'] = (int) $reportId;
    }

    if (($userId = query_string_param('user_id')) !== null) {
        $where[] = '(lr.user_id = :user_a OR fr.user_id = :user_b)';
        $params[':user_a'] = (int) $userId;
        $params[':user_b'] = (int) $userId;
    }

    $status = require_one_of(
        query_string_param('status'),
        ['suggested', 'verification_requested', 'under_review', 'confirmed', 'rejected', 'dismissed'],
        'status'
    );
    if ($status !== null) {
        $where[] = 'm.match_status = :status';
        $params[':status'] = $status;
    }

    $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

    $statement = db()->prepare(
        "SELECT m.match_id, m.lost_report_id, m.found_report_id, m.match_score,
                m.match_status, m.proof_notes, m.created_at, m.updated_at,
                m.reviewed_by_user_id,
                lr.user_id AS lost_user_id, fr.user_id AS found_user_id
           FROM match_claims m
           JOIN pet_reports lr ON lr.report_id = m.lost_report_id
           JOIN pet_reports fr ON fr.report_id = m.found_report_id
           {$clause}
           ORDER BY m.match_score DESC, m.match_id ASC"
    );
    $statement->execute($params);
    $rows = $statement->fetchAll();

    // Read once, not per row: with_signals() would otherwise re-query the
    // account for every pairing in the list.
    $viewer = current_user();

    json_response(['data' => array_map(fn ($row) => with_signals($row, $viewer), $rows)]);
}

function match_detail(int $id): never
{
    $statement = db()->prepare(
        'SELECT m.match_id, m.lost_report_id, m.found_report_id, m.match_score,
                m.match_status, m.proof_notes, m.created_at, m.updated_at,
                m.reviewed_by_user_id,
                lr.user_id AS lost_user_id, fr.user_id AS found_user_id
           FROM match_claims m
           JOIN pet_reports lr ON lr.report_id = m.lost_report_id
           JOIN pet_reports fr ON fr.report_id = m.found_report_id
          WHERE m.match_id = :id'
    );
    $statement->execute([':id' => $id]);
    $row = $statement->fetch();

    if (!$row) {
        json_error('That match does not exist.', 404);
    }

    json_response(['data' => with_signals($row, current_user())]);
}

/**
 * May this viewer read the proof a claimant offered?
 *
 * Only the two people whose reports are paired, and the coordinators who have
 * to judge the claim. The pairing itself is public — both reports already are,
 * and the signals only restate what those reports say — but the identifying
 * detail somebody gives to prove ownership is exactly what an impostor would
 * need in order to repeat it (CLAUDE.md §6.6).
 */
function may_read_proof(array $row, ?array $viewer): bool
{
    if ($viewer === null) {
        return false;
    }

    if (in_array($viewer['role'], ['staff', 'admin'], true)) {
        return true;
    }

    $viewerId = (int) $viewer['user_id'];

    return $viewerId === (int) $row['lost_user_id']
        || $viewerId === (int) $row['found_user_id'];
}

/**
 * Attach the per-characteristic comparison rows to a match.
 *
 * `staff_notes` is never selected at all. `proof_notes` is included only for
 * the people entitled to it — the key is left out entirely rather than sent as
 * null, so the response never hints that there is something to see.
 */
function with_signals(array $row, ?array $viewer = null): array
{
    $signals = db()->prepare(
        'SELECT signal_key, is_matched, weight, detail
           FROM match_signals
          WHERE match_id = :id
          ORDER BY is_matched DESC, weight DESC'
    );
    $signals->execute([':id' => $row['match_id']]);

    $shaped = [
        'match_id' => (int) $row['match_id'],
        'lost_report_id' => (int) $row['lost_report_id'],
        'found_report_id' => (int) $row['found_report_id'],
        'score' => (int) $row['match_score'],
        'status' => $row['match_status'],
        'reviewed_by_user_id' => $row['reviewed_by_user_id'] === null
            ? null : (int) $row['reviewed_by_user_id'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'signals' => array_map(fn ($s) => [
            'key' => $s['signal_key'],
            'matched' => (bool) $s['is_matched'],
            'weight' => (int) $s['weight'],
            'detail' => $s['detail'],
        ], $signals->fetchAll()),
    ];

    if (may_read_proof($row, $viewer)) {
        $shaped['proof_notes'] = $row['proof_notes'];
    }

    return $shaped;
}
