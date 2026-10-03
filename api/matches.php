<?php
/**
 * Possible matches between a lost and a found report.
 *
 *   GET   /api/matches?report_id=1   pairings involving one report
 *   GET   /api/matches?user_id=1     pairings involving any of a user's reports
 *   GET   /api/matches/3             one pairing
 *   PATCH /api/matches/3             act on a pairing (see ACTIONS below)
 *
 * Every route needs a session. A customer reads only pairings that involve one
 * of their own reports; staff and administrators read all of them.
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
    // The answer to request_information, from one of the two reporters. Only
    // they may send it; a coordinator does not answer their own question.
    'provide_information' => ['reporter'],
    // Undoing a coordinator's own decision — a rejection or a confirmation
    // made in error. See match_reopen() for what it may and may not undo.
    'reopen'              => ['staff'],
];

/**
 * The longest answer a reporter may send to a coordinator's question.
 *
 * The answer travels as the body of a notification to each coordinator, and
 * notifications.body is VARCHAR(255). The context (who sent it, about which
 * pairing) goes in the title and the report/match columns, so the whole body
 * is the answer: 255 characters, counted as characters (mb_strlen), exactly as
 * the column counts them. Longer is refused, never cut short.
 */
const PROVIDE_INFORMATION_MAX = 255;

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

    // Stored in a VARCHAR(255) and sent as a notification body of the same
    // size: longer is refused here, not left for strict MySQL to turn into a 500.
    if ($note !== null && mb_strlen($note) > 255) {
        json_error('Keep the note to 255 characters.', 422, ['fields' => ['note' => 'Keep the note to 255 characters.']]);
    }

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

    // Staff may act for a reporter elsewhere, but not here: this is the
    // reporter's own answer to a coordinator's question.
    if ($action === 'provide_information' && !$isReporter) {
        json_error('Only someone involved in this pairing can answer.', 403);
    }

    // A decided pairing is final. Without this, confirming twice runs the whole
    // cascade a second time: both reporters are told again, and each case
    // history gains a meaningless "returned -> returned" entry.
    // `moderation_decide` already refuses a second decision the same way.
    //
    // Checked after the role guards, so an unauthorised caller still gets 403
    // rather than learning what state the pairing is in.
    if ($action !== 'reopen' && in_array($match['match_status'], ['confirmed', 'rejected', 'dismissed'], true)) {
        json_error('That pairing has already been decided.', 409);
    }

    if ($action === 'reopen') {
        reopen_preflight($match, $note);
    }

    // Two of the five need a reason, and both for the same purpose: they are
    // what the reporters are told, and what the case history has to say months
    // later when somebody asks why.
    //
    // Checked here rather than only in React, because a request built by hand
    // is not limited to what the interface offers. blank_to_null() has already
    // trimmed, so a note of spaces arrives as null and is refused.
    if ($action === 'request_information' && $note === null) {
        json_error('Write what you need from the reporters before asking.', 422, [
            'fields' => ['note' => 'Say what you need from them.'],
        ]);
    }

    // An answer needs somewhere to go and something in it. It is only taken
    // while a coordinator's question is open (under_review): at any other
    // stage there is nobody waiting for it.
    if ($action === 'provide_information') {
        if ($match['match_status'] !== 'under_review') {
            json_error('No Pet Coordinator is waiting for more information on this pairing.', 409);
        }
        if ($note === null) {
            json_error('Write the information the Pet Coordinator asked for.', 422, [
                'fields' => ['note' => 'Write your answer before sending it.'],
            ]);
        }
        if (mb_strlen($note) > PROVIDE_INFORMATION_MAX) {
            $max = PROVIDE_INFORMATION_MAX;
            json_error("Keep it to {$max} characters.", 422, [
                'fields' => ['note' => "Keep it to {$max} characters."],
            ]);
        }
    }

    if ($action === 'reject' && $note === null) {
        json_error('Say why these are not the same pet.', 422, [
            'fields' => ['note' => 'Both reporters are told this, so it has to say something.'],
        ]);
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
            'request_verification' => match_set_status($id, 'verification_requested', $user, $note, $match['match_status']),
            'dismiss'              => match_dismiss($id, $match, $user, $note),
            'reject'               => match_reject($id, $match, $user, $note),
            'request_information'  => match_request_information($id, $match, $user, $note),
            'provide_information'  => match_provide_information($match, $user, $note),
            'confirm'              => match_confirm($id, $match, $user, $note),
            'reopen'               => match_reopen($id, $match, $user, $note),
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

/**
 * Move a pairing to a new status, recording who decided it.
 *
 * The WHERE carries the status we believe the pairing is in, and the row count
 * is checked. The guard in match_decide() reads the pairing at the top of the
 * request and the transaction opens fifty lines later, so between those two
 * moments another coordinator can decide the same case: both requests read
 * 'suggested', both pass the check, and the second one quietly overwrites the
 * first. Two coordinators, two notifications to the reporters, and a case
 * history that contradicts itself.
 *
 * Asking the database to make the change only if nothing moved closes that,
 * because the check and the write become one statement.
 */
function match_set_status(int $id, string $status, array $user, ?string $note, string $expected): void
{
    $staffId = in_array($user['role'], ['staff', 'admin'], true) ? (int) $user['user_id'] : null;

    $statement = db()->prepare(
        'UPDATE match_claims
            SET match_status = :status,
                reviewed_by_user_id = COALESCE(:staff_id, reviewed_by_user_id),
                staff_notes = COALESCE(:note, staff_notes)
          WHERE match_id = :id
            AND match_status = :expected'
    );
    $statement->execute([
        ':status' => $status,
        ':staff_id' => $staffId,
        ':note' => $staffId === null ? null : $note,
        ':id' => $id,
        ':expected' => $expected,
    ]);

    if ($statement->rowCount() === 0) {
        // Nothing written, nothing logged, nobody notified. The transaction in
        // match_decide() rolls back everything this decision had started.
        json_error('That pairing was decided by somebody else while this page was open.', 409, [
            'code' => 'stale_state',
            'resource' => 'match',
            'id' => $id,
        ]);
    }
}

/** Ruled out. Both reports go back to being searched for. */
function match_reject(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'rejected', $user, $note, $match['match_status']);
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
    match_set_status($id, 'dismissed', $user, $note, $match['match_status']);
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

/**
 * A report that has finished (returned or closed) takes its open pairings with
 * it. Left behind, they sat in the coordinator's Verification queue and in the
 * other reporter's Possible Matches, and confirming one could only ever fail:
 * one side is no longer open. So each open pairing (suggested, verification
 * requested, under review) is dismissed: nobody decided it was or was not the
 * same pet; the case simply ended. Confirmed and rejected pairings are
 * decisions and are left exactly as they were.
 *
 * The other report goes back to Active if nothing else is open on it, with a
 * history line, and its reporter is told the pairing is no longer open. Called
 * inside the caller's transaction, so it all happens with the status change
 * or not at all.
 *
 * @param int|null $keep  A pairing to leave alone: the one being confirmed.
 */
function dismiss_open_pairings_for_report(int $reportId, array $user, ?int $keep = null): void
{
    $open = db()->prepare(
        "SELECT m.match_id, m.match_status, m.lost_report_id, m.found_report_id,
                lr.user_id AS lost_user_id, fr.user_id AS found_user_id
           FROM match_claims m
           JOIN pet_reports lr ON lr.report_id = m.lost_report_id
           JOIN pet_reports fr ON fr.report_id = m.found_report_id
          WHERE (m.lost_report_id = :a OR m.found_report_id = :b)
            AND m.match_status IN ('suggested', 'verification_requested', 'under_review')"
    );
    $open->execute([':a' => $reportId, ':b' => $reportId]);

    $dismiss = db()->prepare(
        "UPDATE match_claims SET match_status = 'dismissed'
          WHERE match_id = :id AND match_status = :expected"
    );
    $notify = db()->prepare(
        'INSERT INTO notifications (user_id, notification_type, title, body, report_id, match_id)
         VALUES (:user_id, :type, :title, :body, :report_id, :match_id)'
    );

    foreach ($open->fetchAll() as $match) {
        if ($keep !== null && (int) $match['match_id'] === $keep) {
            continue;
        }

        $dismiss->execute([':id' => (int) $match['match_id'], ':expected' => $match['match_status']]);
        if ($dismiss->rowCount() === 0) {
            continue;   // somebody else settled it a moment ago
        }

        release_reports_without_open_matches($match, $user);

        // The other side is told, in words that give nothing away about why.
        $isLost = (int) $match['lost_report_id'] === $reportId;
        $otherUser = (int) ($isLost ? $match['found_user_id'] : $match['lost_user_id']);
        $otherReport = (int) ($isLost ? $match['found_report_id'] : $match['lost_report_id']);
        if (wants_notification($otherUser, 'status_changed')) {
            $notify->execute([
                ':user_id' => $otherUser,
                ':type' => 'status_changed',
                ':title' => 'A possible match is no longer open',
                ':body' => 'The other report in this pairing is no longer open, so the pairing was withdrawn. Your report stays open.',
                ':report_id' => $otherReport,
                ':match_id' => (int) $match['match_id'],
            ]);
        }
    }
}

/** The coordinator needs something more before deciding. */
function match_request_information(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'under_review', $user, $note, $match['match_status']);

    notify_both($match, 'staff_reviewed', 'A Pet Coordinator needs more information', $note);
}

/**
 * A reporter answers the coordinator's question.
 *
 * Delivered as a notification to every active Pet Coordinator, and nowhere
 * else: not into proof_notes (which the other reporter in the pairing can
 * read), not into staff_notes (the coordinator's own field), and not into a
 * report's status history. The pairing's status does not move; it stays under
 * review until a coordinator decides. Nobody else is told, so the other
 * reporter never sees what this one wrote.
 *
 * `verification_requested` is the existing type for "a reporter has sent
 * something to be verified", and the notification preferences are not
 * consulted: this is a coordinator's work queue, not an optional update.
 */
function match_provide_information(array $match, array $user, string $answer): void
{
    $userId = (int) $user['user_id'];
    $reportId = $userId === (int) $match['lost_user_id']
        ? (int) $match['lost_report_id']
        : (int) $match['found_report_id'];

    $staff = db()->query(
        "SELECT user_id FROM users WHERE role = 'staff' AND account_status = 'active'"
    )->fetchAll(PDO::FETCH_COLUMN);

    $statement = db()->prepare(
        'INSERT INTO notifications (user_id, notification_type, title, body, report_id, match_id)
         VALUES (:user_id, :type, :title, :body, :report_id, :match_id)'
    );

    foreach ($staff as $staffId) {
        $statement->execute([
            ':user_id' => (int) $staffId,
            ':type' => 'verification_requested',
            ':title' => $user['full_name'] . ' sent more information',
            ':body' => $answer,
            ':report_id' => $reportId,
            ':match_id' => (int) $match['match_id'],
        ]);
    }
}

/**
 * Confirm a pairing.
 *
 * Both reports become `returned`, each gets a history entry, and both reporters
 * are told. This is the cascade the whole workflow builds towards.
 */
function match_confirm(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'confirmed', $user, $note, $match['match_status']);

    // Both reports are about to be returned, so any other pairing still open
    // on either of them has nothing left to decide.
    foreach (['lost_report_id', 'found_report_id'] as $key) {
        dismiss_open_pairings_for_report((int) $match[$key], $user, $id);
    }

    foreach (['lost_report_id', 'found_report_id'] as $key) {
        $reportId = (int) $match[$key];

        $current = db()->prepare('SELECT status FROM pet_reports WHERE report_id = :id');
        $current->execute([':id' => $reportId]);
        $previous = $current->fetchColumn() ?: null;

        // Same rule as the pairing: only if the report is still where the
        // pre-flight check at match_decide() found it. A report that was
        // closed by moderation in the meantime must not be reopened as a
        // reunion by a confirmation that started before.
        $update = db()->prepare(
            "UPDATE pet_reports SET status = 'returned'
              WHERE report_id = :id AND status = :expected"
        );
        $update->execute([':id' => $reportId, ':expected' => $previous]);

        if ($update->rowCount() === 0) {
            json_error('One of these reports changed while this page was open.', 409, [
                'code' => 'stale_state',
                'resource' => 'report',
                'id' => $reportId,
            ]);
        }

        log_match_status_change(
            $reportId,
            (int) $user['user_id'],
            $previous,
            'returned',
            'Ownership verified by the Pet Coordinator. Pet returned to the owner.'
        );
    }

    // The standard message says what happens next, because nothing else does:
    // there is no messaging between members. A coordinator's own note replaces
    // it (body is VARCHAR(255), so both cannot fit), and the confirmed banner in
    // Possible Matches repeats the guidance either way.
    notify_both(
        $match,
        'match_confirmed',
        'Match confirmed — the pet is going home',
        $note ?? 'A Pet Coordinator verified the reports and will help arrange a safe handover. '
            . 'If the other reporter shared contact details, you can find them on their report. '
            . 'Meet in a public place, ideally in daylight, and bring someone you trust.'
    );
}

/**
 * May this decided pairing be reopened? Refuses with the reason if not.
 *
 * A rejection, a confirmation, or a reporter's "Not my pet" — a reporter can
 * press it on the wrong pairing, and the coordinator is who they would ask.
 * A withdrawal, because one of the reports was marked returned or closed, stays
 * final: the case it belonged to has ended. The two are told apart the same way
 * the queue labels them (wasWithdrawn() in src/constants): a withdrawn pairing
 * has a finished report. A reason is required, because both reporters are told.
 *
 * The comparison must still describe the reports. Its score and seven reasons
 * were stored when the pairing was made; once rejected, the reports could be
 * edited. So the comparison is run again on the reports as they are now, and
 * if any signal comes out differently the pairing is not reopened — it would
 * put old evidence in front of a coordinator as if it were current.
 */
function reopen_preflight(array $match, ?string $note): void
{
    if (!in_array($match['match_status'], ['rejected', 'confirmed', 'dismissed'], true)) {
        json_error('This pairing is still open; there is nothing to reopen.', 409);
    }

    if ($note === null) {
        json_error('Say why this pairing is being reopened.', 422, [
            'fields' => ['note' => 'Both reporters are told this, so it has to say something.'],
        ]);
    }

    // A rejected or dismissed pairing's reports went back to Active; a
    // confirmed one's were marked Returned. Anything else means a report has
    // been finished since — and for a dismissed pairing, that is a withdrawal.
    $expected = $match['match_status'] === 'confirmed' ? ['returned'] : ['active', 'possible_match'];
    foreach (['lost_report_id', 'found_report_id'] as $key) {
        $check = db()->prepare('SELECT status FROM pet_reports WHERE report_id = :id');
        $check->execute([':id' => (int) $match[$key]]);
        if (!in_array($check->fetchColumn(), $expected, true)) {
            json_error($match['match_status'] === 'dismissed'
                ? 'This pairing was withdrawn because one of its reports was marked returned or closed, so it cannot be reopened.'
                : 'One of these reports has been closed since, so this pairing cannot be reopened.', 409);
        }
    }

    require_once __DIR__ . '/matching.php';
    $now = compare_reports(
        matching_load_report((int) $match['lost_report_id']),
        matching_load_report((int) $match['found_report_id'])
    );
    $stored = db()->prepare('SELECT signal_key, is_matched FROM match_signals WHERE match_id = :id');
    $stored->execute([':id' => (int) $match['match_id']]);
    $was = array_map('boolval', array_column($stored->fetchAll(), 'is_matched', 'signal_key'));

    foreach ($now['signals'] as $signal) {
        if (($was[$signal['key']] ?? null) !== $signal['matched']) {
            json_error('The reports have changed since this pairing was decided, so its comparison no '
                . 'longer describes them. It was not reopened.', 409, ['code' => 'comparison_changed']);
        }
    }
}

/**
 * Put a decided pairing back in front of a coordinator.
 *
 * The pairing goes to under_review and both reports to Possible Match — so
 * they are frozen again (reports.php refuses edits while a match is open),
 * with a line in each case history and both reporters told why. A reopened
 * confirmation takes both reports out of Returned; the other pairings that
 * confirming withdrew stay withdrawn, because nothing records whether they
 * would still be wanted.
 */
function match_reopen(int $id, array $match, array $user, ?string $note): void
{
    match_set_status($id, 'under_review', $user, $note, $match['match_status']);

    foreach (['lost_report_id', 'found_report_id'] as $key) {
        $reportId = (int) $match[$key];
        $current = db()->prepare('SELECT status FROM pet_reports WHERE report_id = :id');
        $current->execute([':id' => $reportId]);
        $previous = (string) $current->fetchColumn();

        if ($previous === 'possible_match') {
            continue;   // already frozen by another open pairing
        }

        $update = db()->prepare(
            "UPDATE pet_reports SET status = 'possible_match' WHERE report_id = :id AND status = :expected"
        );
        $update->execute([':id' => $reportId, ':expected' => $previous]);
        if ($update->rowCount() === 0) {
            json_error('One of these reports changed while this page was open.', 409, [
                'code' => 'stale_state', 'resource' => 'report', 'id' => $reportId,
            ]);
        }

        log_match_status_change($reportId, (int) $user['user_id'], $previous, 'possible_match',
            'A Pet Coordinator reopened the pairing for review.');
    }

    notify_both($match, 'staff_reviewed', 'A pairing was reopened for review', $note);
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

/**
 * Pairings are not public.
 *
 * They used to be: anybody could list every pairing, and the comparison
 * sentences restate what the two reports say ("Both locations are in Barangay
 * San Antonio, Makati City"), so a guest could read through here what the
 * report detail no longer shows them. A customer sees only the pairings that
 * involve one of their own reports; coordinators and administrators see all
 * of them, which their workspaces need.
 */
function matches_list(): never
{
    $viewer = require_login();
    $isStaff = in_array($viewer['role'], ['staff', 'admin'], true);

    $where = [];
    $params = [];

    if (!$isStaff) {
        $where[] = '(lr.user_id = :me_a OR fr.user_id = :me_b)';
        $params[':me_a'] = (int) $viewer['user_id'];
        $params[':me_b'] = (int) $viewer['user_id'];
    }

    if (($reportId = query_string_param('report_id')) !== null) {
        $where[] = '(m.lost_report_id = :report_a OR m.found_report_id = :report_b)';
        $params[':report_a'] = (int) $reportId;
        $params[':report_b'] = (int) $reportId;
    }

    if (($userId = query_string_param('user_id')) !== null) {
        // Asking by somebody else's id is refused rather than quietly answered
        // with your own pairings, so a mistake is visible as one.
        if (!$isStaff && (int) $userId !== (int) $viewer['user_id']) {
            json_error('You can only list your own pairings.', 403);
        }
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

    json_response(['data' => array_map(fn ($row) => with_signals($row, $viewer), $rows)]);
}

function match_detail(int $id): never
{
    $viewer = require_login();

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

    // The same people who may read the proof: the two reporters and staff.
    if (!may_read_proof($row, $viewer)) {
        json_error('You can only see pairings that involve one of your reports.', 403);
    }

    json_response(['data' => with_signals($row, $viewer)]);
}

/**
 * May this viewer read the proof a claimant offered?
 *
 * Only the two people whose reports are paired, and the coordinators who have
 * to judge the claim. Since pairings stopped being public the same rule also
 * decides who may see a pairing at all. The proof still matters most: the
 * identifying detail somebody gives to prove ownership is exactly what an
 * impostor would need in order to repeat it (CLAUDE.md §6.6).
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
