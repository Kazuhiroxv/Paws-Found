<?php
/**
 * Community flags raised against reports, and the administrator's decision.
 *
 *   GET   /api/moderation             the queue, with the flagged report and
 *                                     both people attached (administrators)
 *   POST  /api/moderation             flag a report (any signed-in member)
 *   PATCH /api/moderation/2           decide a case (administrators)
 *
 * Only the four approved decisions exist here (CLAUDE.md §6.9): dismiss, warn,
 * remove, remove and suspend. There is deliberately no bulk action, no
 * automated takedown and no scoring of users.
 *
 * "Remove" closes the report rather than deleting it. The record of what
 * happened has to survive the decision, and the person who filed the report is
 * always told the outcome — a moderation decision nobody hears about is not a
 * decision, it is a disappearance.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/** The reasons a member may choose. Mirrors the ENUM in `moderation_cases`. */
const MODERATION_REASONS = [
    'false_report', 'spam', 'scam', 'harassment',
    'inappropriate', 'duplicate', 'other',
];

const MODERATION_ACTIONS = ['dismiss', 'warn', 'remove', 'suspend'];

function handle_moderation(string $method, ?string $identifier): never
{
    if ($method === 'GET' && $identifier === null) {
        moderation_queue();
    }

    if ($method === 'POST' && $identifier === null) {
        moderation_create();
    }

    if ($method === 'PATCH' && $identifier !== null && ctype_digit($identifier)) {
        moderation_decide((int) $identifier);
    }

    json_error('No such endpoint.', 404);
}

/**
 * The queue.
 *
 * One query rather than a list plus a lookup per case: an administrator has to
 * be able to judge a flag without leaving the page, so the report, its primary
 * photograph, whoever filed it and whoever flagged it all come together.
 */
function moderation_queue(): never
{
    require_capability('moderate_reports');

    $where = [];
    $params = [];

    if (($status = query_string_param('status')) !== null) {
        require_one_of($status, ['open', 'actioned', 'dismissed'], 'status');
        $where[] = 'c.case_status = :status';
        $params[':status'] = $status;
    }

    if (($reason = query_string_param('reason')) !== null) {
        require_one_of($reason, MODERATION_REASONS, 'reason');
        $where[] = 'c.reason = :reason';
        $params[':reason'] = $reason;
    }

    $sql =
        'SELECT c.case_id, c.report_id, c.reported_by_user_id, c.reason, c.details,
                c.case_status, c.resolved_by_admin_id, c.resolution_note,
                c.created_at, c.resolved_at,
                r.pet_name, r.report_type, r.status AS report_status, r.publication_status, r.description,
                (SELECT i.image_path FROM report_images i
                  WHERE i.report_id = r.report_id
                  ORDER BY i.is_primary_photo DESC, i.image_id ASC
                  LIMIT 1) AS photo_path,
                owner.user_id   AS owner_id,
                owner.full_name AS owner_name,
                owner.account_status AS owner_account_status,
                flagger.user_id   AS flagger_id,
                flagger.full_name AS flagger_name
           FROM moderation_cases c
           JOIN pet_reports r    ON r.report_id = c.report_id
           JOIN users owner      ON owner.user_id = r.user_id
      LEFT JOIN users flagger    ON flagger.user_id = c.reported_by_user_id';

    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    $sql .= ' ORDER BY c.created_at DESC, c.case_id DESC';

    $statement = db()->prepare($sql);
    $statement->execute($params);

    json_response(['data' => array_map('moderation_row', $statement->fetchAll())]);
}

/** One queue row, shaped the way the moderation page reads it. */
function moderation_row(array $row): array
{
    return [
        'case_id' => (int) $row['case_id'],
        'report_id' => (int) $row['report_id'],
        'reason' => $row['reason'],
        'details' => $row['details'],
        'case_status' => $row['case_status'],
        'resolution_note' => $row['resolution_note'],
        'created_at' => $row['created_at'],
        'resolved_at' => $row['resolved_at'],
        'report' => [
            'report_id' => (int) $row['report_id'],
            'pet_name' => $row['pet_name'],
            'report_type' => $row['report_type'],
            'status' => $row['report_status'],
            'publication_status' => $row['publication_status'],
            'description' => $row['description'],
            'photo_path' => $row['photo_path'],
        ],
        'owner' => [
            'user_id' => (int) $row['owner_id'],
            'full_name' => $row['owner_name'],
            'account_status' => $row['owner_account_status'],
        ],
        // Null when the account that raised the flag has since been deleted.
        'flagged_by' => $row['flagger_id'] === null ? null : [
            'user_id' => (int) $row['flagger_id'],
            'full_name' => $row['flagger_name'],
        ],
    ];
}

/** A member flags a report. */
function moderation_create(): never
{
    $user = require_login();
    $body = request_body();

    $reportId = (int) ($body['report_id'] ?? 0);
    if ($reportId <= 0) {
        json_error("'report_id' is required.", 422);
    }

    // Only a published report can be flagged: it is the only kind anybody but
    // its reporter and the coordinators can see (Correction 4). Any other is
    // answered as missing, so a guessed id says nothing.
    $exists = db()->prepare("SELECT 1 FROM pet_reports WHERE report_id = :id AND publication_status = 'published'");
    $exists->execute([':id' => $reportId]);
    if (!$exists->fetchColumn()) {
        json_error('That report does not exist.', 404);
    }

    $reason = require_one_of(trim((string) ($body['reason'] ?? '')), MODERATION_REASONS, 'reason');

    $details = trim((string) ($body['details'] ?? ''));
    if ($details === '') {
        json_error('Say briefly what is wrong with the report.', 422);
    }

    $statement = db()->prepare(
        'INSERT INTO moderation_cases (report_id, reported_by_user_id, reason, details)
         VALUES (:report_id, :user_id, :reason, :details)'
    );
    $statement->execute([
        ':report_id' => $reportId,
        ':user_id' => (int) $user['user_id'],
        ':reason' => $reason,
        ':details' => $details,
    ]);

    $caseId = (int) db()->lastInsertId();

    // The reason category only; what they wrote stays on the case.
    activity_log((int) $user['user_id'], 'report_flagged', 'report', $reportId, $reason);

    json_response(['data' => ['case_id' => $caseId]], 201);
}

/**
 * An administrator decides a case.
 *
 * Everything a decision touches — the case, the report, the account, the
 * notification — moves together or not at all. A half-applied suspension would
 * leave someone locked out with no case recording why.
 */
function moderation_decide(int $id): never
{
    $admin = require_capability('moderate_reports');
    $body = request_body();

    $action = require_one_of(trim((string) ($body['action'] ?? '')), MODERATION_ACTIONS, 'action');
    $note = trim((string) ($body['note'] ?? ''));
    $note = $note === '' ? null : $note;

    // Stored in a VARCHAR(255) and sent as a notification body of the same
    // size: longer is refused here, not left for strict MySQL to turn into a 500.
    if ($note !== null && mb_strlen($note) > 255) {
        json_error('Keep the note to 255 characters.', 422, ['fields' => ['note' => 'Keep the note to 255 characters.']]);
    }

    $statement = db()->prepare(
        'SELECT c.case_id, c.report_id, c.case_status,
                r.user_id AS owner_id, r.status AS report_status, r.publication_status
           FROM moderation_cases c
           JOIN pet_reports r ON r.report_id = c.report_id
          WHERE c.case_id = :id'
    );
    $statement->execute([':id' => $id]);
    $case = $statement->fetch();

    if (!$case) {
        json_error('That moderation case does not exist.', 404);
    }

    if ($case['case_status'] !== 'open') {
        json_error('That case has already been decided.', 409);
    }

    // Removing someone's report, and suspending them, needs a reason: the
    // same rule as suspending from the Users page. It is what the reporter is
    // told and what the audit trail says; a stock sentence explains nothing.
    // Suspending is account management, not moderation (Correction 6): a
    // Moderator removes the report and leaves the account to a Manager. And an
    // administrator's account is never suspended from a moderation case — only
    // a Super Administrator manages another administrator, from Users.
    if ($action === 'suspend') {
        if (!user_can($admin, 'manage_accounts')) {
            json_error('Suspending an account needs an Administrator — Manager or above. Remove the report instead.',
                403, ['code' => 'admin_level']);
        }
        $ownerRole = db()->prepare('SELECT role FROM users WHERE user_id = :id');
        $ownerRole->execute([':id' => (int) $case['owner_id']]);
        if ($ownerRole->fetchColumn() === 'admin') {
            json_error("An administrator's account is managed from Users, by a Super Administrator.", 403,
                ['code' => 'admin_level']);
        }
    }

    if (in_array($action, ['remove', 'suspend'], true) && $note === null) {
        json_error('Write why this report is being removed.', 422, [
            'fields' => ['note' => 'The reporter is told this, and it is kept in the audit log.'],
        ]);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        if ($action === 'dismiss') {
            moderation_notify_owner(
                $case,
                'A flag on your report was dismissed',
                $note ?? 'Someone flagged your report and an administrator reviewed it. No action was needed and your report is unchanged.'
            );
        }

        if ($action === 'warn') {
            moderation_notify_owner(
                $case,
                'A warning about your report',
                $note ?? 'An administrator reviewed a flag raised against your report.'
            );
        }

        // Removal takes the report out of public circulation — its own
        // publication state, never Closed (Correction 4). A report that is not
        // published any more has nothing left to remove.
        if (($action === 'remove' || $action === 'suspend') && $case['publication_status'] === 'published') {
            require_once __DIR__ . '/reports.php';
            report_remove_publication(
                ['report_id' => $case['report_id'], 'user_id' => $case['owner_id']],
                $admin,
                $note
            );
        }

        if ($action === 'suspend') {
            $suspend = $pdo->prepare(
                "UPDATE users SET account_status = 'suspended' WHERE user_id = :id"
            );
            $suspend->execute([':id' => (int) $case['owner_id']]);
            // Its open sessions end with it, and their records say why.
            // A new generation, so no open session survives a later reinstatement.
            $pdo->prepare('UPDATE users SET session_version = session_version + 1 WHERE user_id = :id')
                ->execute([':id' => (int) $case['owner_id']]);
            end_open_sessions((int) $case['owner_id'], 'account_suspended');

            moderation_notify_owner(
                $case,
                'Your account has been suspended',
                $note ?? 'An administrator suspended your account following a moderation review.'
            );
        }

        $resolve = $pdo->prepare(
            'UPDATE moderation_cases
                SET case_status = :status,
                    resolved_by_admin_id = :admin_id,
                    resolution_note = :note,
                    resolved_at = NOW()
              WHERE case_id = :id'
        );
        $resolve->execute([
            ':status' => $action === 'dismiss' ? 'dismissed' : 'actioned',
            ':admin_id' => (int) $admin['user_id'],
            ':note' => $note,
            ':id' => $id,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // A moderation decision can suspend an account or remove somebody's report,
    // so it belongs in the same trail as the account events rather than only
    // on the case row it resolved. The report it was about goes in the detail:
    // the target here is the case, and a case is the thing an administrator
    // acted on.
    audit_log('moderation_resolved', (int) $admin['user_id'], $admin['email'],
        'moderation_case', $id, 'success', "{$action} on report {$case['report_id']} (by {$admin['admin_level']})");
    activity_log((int) $admin['user_id'], 'moderation_decided', 'moderation_case', $id,
        "{$action} on report {$case['report_id']}");

    json_response(['data' => ['case_id' => $id, 'action' => $action]]);
}

function moderation_notify_owner(array $case, string $title, string $body): void
{
    $statement = db()->prepare(
        'INSERT INTO notifications (user_id, notification_type, title, body, report_id)
         VALUES (:user_id, :type, :title, :body, :report_id)'
    );
    $statement->execute([
        ':user_id' => (int) $case['owner_id'],
        ':type' => 'report_flagged',
        ':title' => $title,
        ':body' => $body,
        ':report_id' => (int) $case['report_id'],
    ]);
}
