<?php
/**
 * Lost and found reports.
 *
 *   GET   /api/reports        list, with search, filters, sorting and paging
 *                             (a guest gets the public summary of each row)
 *   GET   /api/reports/activity  recent changes across the caller's reports
 *   GET   /api/reports/12     one report, with photos, location and case history
 *                             (must be signed in)
 *   POST  /api/reports        file a report (must be signed in)
 *   PUT   /api/reports/12     edit a report (the reporter only)
 *   PATCH /api/reports/12     change its status (the reporter, or a coordinator)
 *
 * Two rules run through this file:
 *
 *   1. Every value the caller supplies goes into the query as a bound
 *      parameter, never concatenated into the SQL.
 *   2. The two things that CANNOT be parameterised — the ORDER BY column and
 *      the direction — are chosen from a fixed list in this file, so the caller
 *      picks a key, not a fragment of SQL.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/** Sort keys the caller may ask for, mapped to SQL we wrote ourselves. */
const REPORT_SORTS = [
    'newest' => 'r.incident_date DESC, r.report_id DESC',
    'oldest' => 'r.incident_date ASC, r.report_id ASC',
    'updated' => 'r.updated_at DESC',
];

/**
 * Which status a report may move to, from the one it is in — for a change made
 * by a PERSON through PATCH /reports/{id}.
 *
 *     active  ──────────────┐
 *        │                  ├──▶ returned ──▶ closed
 *        ▼                  │
 *     possible_match ───────┘
 *        │                  │
 *        └──────────────────┴──▶ closed          (closed is the end)
 *
 * Two transitions are deliberately absent, because they are not a person's to
 * make:
 *
 *   active ──▶ possible_match   the matching algorithm decides this, in
 *                               api/matching.php, when it finds a candidate.
 *   possible_match ──▶ active   the system does this in api/matches.php when
 *                               the last open pairing on a report is ruled out.
 *
 * Both of those run as `UPDATE ... WHERE status = 'the expected one'`, so they
 * cannot skip a step either. They are simply not reachable from the browser,
 * which is the point: a report cannot be talked into claiming it has a possible
 * match by anybody who can send an HTTP request.
 *
 * `closed` is terminal. A closed report is not reopened — the case history
 * stays readable and a new report is filed instead. That is also why the list
 * is empty rather than missing: the rule is written down, not implied.
 */
const REPORT_TRANSITIONS = [
    'active' => ['returned', 'closed'],
    'possible_match' => ['returned', 'closed'],
    'returned' => ['closed'],
    'closed' => [],
];

/**
 * What each status is called when it has to appear in a sentence.
 *
 * The same four words the status pill shows (REPORT_STATUS_LABELS in
 * src/constants/index.js), so a refusal names the state the person is actually
 * looking at rather than the value in the column.
 */
const REPORT_STATUS_WORDS = [
    'active' => 'Active',
    'possible_match' => 'Possible Match',
    'returned' => 'Returned',
    'closed' => 'Closed',
];

/**
 * How finely a report's position is published, in degrees.
 *
 * The pin a reporter drops is stored as they dropped it — DECIMAL(9,6), about
 * 0.1 m — because matching measures real distances from it. What leaves the
 * server is that pin snapped to a 0.004° grid: cells about 445 m across, which
 * is the "area of roughly 400 m" the report form promises. The published point
 * is never more than ~314 m from the real one (half the cell's diagonal, at
 * 5–21°N), so the 400 m circle the map draws around it always contains where
 * the pet actually was, without saying where inside it.
 *
 * Three decimal places would not have kept that promise: that grid is 111 m,
 * and the real pin is within ~80 m of any point on it.
 */
const PUBLIC_COORDINATE_GRID = 0.004;

/**
 * The columns a guest's free-text search may look in: exactly the text fields
 * the guest summary shows. See shape_for_viewer().
 */
const GUEST_SEARCH_COLUMNS = [
    'r.pet_name', 'b.breed_name', 'r.primary_color', 'r.secondary_color', 'l.city', 'l.province',
];

function handle_reports(string $method, ?string $identifier, ?string $sub = null): never
{
    if ($method === 'GET' && $identifier === null) {
        reports_list();
    }

    if ($method === 'POST' && $identifier === null) {
        report_create();
    }

    // Must be tested before the numeric branch, or these fall through.
    if ($method === 'GET' && $identifier === 'activity') {
        reports_activity();
    }

    if ($method === 'GET' && $identifier === 'stats') {
        reports_stats();
    }

    if (ctype_digit((string) $identifier)) {
        $id = (int) $identifier;

        if ($method === 'POST' && $sub === 'photos') report_add_photos($id);
        if ($method === 'PATCH' && $sub === 'photos') report_edit_photos($id);
        // Submit again, approve, reject, remove (Correction 4).
        if ($method === 'PATCH' && $sub === 'publication') report_publication($id);

        if ($sub === null) {
            if ($method === 'GET') report_detail($id);
            if ($method === 'PUT') report_update($id);
            if ($method === 'PATCH') report_set_status($id);
        }
    }

    json_error('No such endpoint.', 404);
}

/**
 * File a report.
 *
 * Everything is validated here, on the server. The React wizard validates too,
 * but that is a convenience for the person typing — it is not a control,
 * because anything at all can POST to this endpoint.
 */
function report_create(): never
{
    $user = require_login();
    $body = request_body();

    $type = require_one_of(trim((string) ($body['report_type'] ?? '')), ['lost', 'found'], 'report_type');
    if ($type === null) {
        json_error('Say whether this is a lost or a found report.', 422);
    }

    // Every rule the form has, checked again here (report_validated()).
    $v = report_validated($body, $type);

    // Submitting a saved draft files the report and deletes the draft, in the
    // same transaction (Correction 4). Only the owner's own draft.
    $draftId = null;
    if (isset($body['draft_id']) && $body['draft_id'] !== null && $body['draft_id'] !== '') {
        if (!ctype_digit((string) $body['draft_id'])) {
            json_error('That draft does not exist.', 404);
        }
        $draft = db()->prepare('SELECT user_id FROM report_drafts WHERE draft_id = :id');
        $draft->execute([':id' => (int) $body['draft_id']]);
        $owner = $draft->fetchColumn();
        if ($owner === false || (int) $owner !== (int) $user['user_id']) {
            json_error('That draft does not exist.', 404);
        }
        $draftId = (int) $body['draft_id'];
    }

    $pdo = db();

    // A report is a location, plus the report, plus its opening history entry.
    // All three or none: a transaction stops a half-filed report existing.
    $pdo->beginTransaction();

    try {
        $location = $pdo->prepare(
            'INSERT INTO locations (label, city, province, city_code, latitude, longitude, `precision`)
             VALUES (:label, :city, :province, :city_code, :lat, :lng, :precision)'
        );
        $location->execute([
            ':label' => $v['label'],
            ':city' => $v['city'],
            ':province' => $v['province'],
            ':city_code' => $v['city_code'],
            ':lat' => $v['latitude'],
            ':lng' => $v['longitude'],
            // The reporter pins an area, never a doorstep (CLAUDE.md §14).
            ':precision' => 'approximate',
        ]);
        $locationId = (int) $pdo->lastInsertId();

        $report = $pdo->prepare(
            'INSERT INTO pet_reports
                (user_id, category_id, breed_id, location_id, report_type, status, publication_status,
                 pet_name, pet_size, pet_sex, primary_color, secondary_color,
                 distinct_features, description, has_collar, pet_condition,
                 incident_date, incident_time,
                 allow_platform_contact, show_phone, show_email)
             VALUES
                (:user_id, :category_id, :breed_id, :location_id, :report_type, :status, :publication,
                 :pet_name, :pet_size, :pet_sex, :primary_color, :secondary_color,
                 :distinct_features, :description, :has_collar, :pet_condition,
                 :incident_date, :incident_time,
                 :allow_contact, :show_phone, :show_email)'
        );
        $report->execute([
            ':user_id' => $user['user_id'],
            ':category_id' => $v['category_id'],
            ':breed_id' => breed_id_for($v['category_id'], $v['breed']),
            ':location_id' => $locationId,
            ':report_type' => $type,
            ':status' => 'active',
            // Filed, not published: a Pet Coordinator reviews it first.
            ':publication' => 'pending_review',
            ':pet_name' => $v['pet_name'],
            ':pet_size' => $v['pet_size'],
            ':pet_sex' => $v['pet_sex'],
            ':primary_color' => $v['primary_color'],
            ':secondary_color' => $v['secondary_color'],
            ':distinct_features' => $v['distinct_features'],
            ':description' => $v['description'],
            ':has_collar' => $v['has_collar'],
            ':pet_condition' => $v['pet_condition'],
            ':incident_date' => $v['incident_date'],
            ':incident_time' => $v['incident_time'],
            ':allow_contact' => $v['allow_platform_contact'],
            ':show_phone' => $v['show_phone'],
            ':show_email' => $v['show_email'],
        ]);
        $reportId = (int) $pdo->lastInsertId();

        // Filed is not published (Correction 4): the report waits for a Pet
        // Coordinator. Its case history starts when it is published; its
        // publication history starts now.
        log_publication_change($reportId, (int) $user['user_id'], null, 'pending_review', null);
        notify_report_owner((int) $user['user_id'], $reportId, 'report_submitted',
            'Your report was submitted for review',
            'A Pet Coordinator will check it before it appears publicly. You will be told when it is published.');

        if ($draftId !== null) {
            $pdo->prepare('DELETE FROM report_drafts WHERE draft_id = :id AND user_id = :user')
                ->execute([':id' => $draftId, ':user' => (int) $user['user_id']]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // No matching here any more. An unreviewed report is compared with
    // nothing and nothing is compared with it: matching starts when a
    // coordinator publishes it (report_publication()).

    activity_log((int) $user['user_id'], 'report_submitted', 'report', $reportId,
        $draftId !== null ? "from draft {$draftId}" : null);

    report_detail($reportId);
}

/**
 * A report's publication: whether the public may see it (Correction 4).
 *
 * The case `status` (active, possible match, returned, closed) is a separate
 * dimension and is not touched here, except that a report's case history
 * starts when it is published. Filing is the first step (report_create(),
 * nothing -> pending_review); the rest are these actions, and only these
 * moves exist. A move not listed is refused, whoever asks.
 *
 *   action     from              to               who
 *   approve    pending_review    published        a Pet Coordinator or administrator
 *   reject     pending_review    rejected         a Pet Coordinator or administrator (reason required)
 *   resubmit   rejected          pending_review   the reporter, after editing
 *   remove     published         removed          an administrator (reason required)
 *
 * A third review decision (Ma'am's "cancel") is not here: what it means has
 * not been confirmed. Adding it is one row in PUBLICATION_ACTIONS and one
 * value in the publication ENUM.
 */
const PUBLICATION_ACTIONS = [
    'approve' => ['from' => ['pending_review'], 'to' => 'published', 'by' => 'staff', 'note' => false],
    'reject' => ['from' => ['pending_review'], 'to' => 'rejected', 'by' => 'staff', 'note' => true],
    'resubmit' => ['from' => ['rejected'], 'to' => 'pending_review', 'by' => 'owner', 'note' => false],
    'remove' => ['from' => ['published'], 'to' => 'removed', 'by' => 'admin', 'note' => true],
];

/** How each publication state reads in a sentence. */
const PUBLICATION_WORDS = [
    'pending_review' => 'Pending review',
    'published' => 'Published',
    'rejected' => 'Not approved',
    'removed' => 'Removed',
];

function report_publication(int $id): never
{
    $user = require_login();
    $body = request_body();

    $action = require_one_of(trim((string) ($body['action'] ?? '')), array_keys(PUBLICATION_ACTIONS), 'action');
    if ($action === null) {
        json_error('Say what to do: approve, reject, resubmit or remove.', 422);
    }
    $rule = PUBLICATION_ACTIONS[$action];

    $statement = db()->prepare('SELECT report_id, user_id, status, publication_status FROM pet_reports WHERE report_id = :id');
    $statement->execute([':id' => $id]);
    $report = $statement->fetch();
    $isOwner = $report && (int) $report['user_id'] === (int) $user['user_id'];
    $role = $user['role'];

    // Somebody who may not see the report is not told it exists.
    if (!$report || ($report['publication_status'] !== 'published' && !$isOwner
            && !in_array($role, ['staff', 'admin'], true))) {
        json_error('That report does not exist.', 404);
    }

    // Who may take this action. The reviewer is always the signed-in account:
    // nothing in the request can name somebody else.
    $allowed = match ($rule['by']) {
        'staff' => in_array($role, ['staff', 'admin'], true),
        'admin' => $role === 'admin',
        'owner' => $isOwner,
    };
    if (!$allowed) {
        json_error(match ($rule['by']) {
            'staff' => 'Only a Pet Coordinator can review a report.',
            'admin' => 'Only an administrator can remove a published report.',
            'owner' => 'Only the person who filed a report can submit it again.',
        }, 403);
    }
    if ($rule['by'] === 'staff' && $isOwner) {
        json_error('You cannot review a report you filed yourself. Another Pet Coordinator has to.', 403);
    }

    $from = $report['publication_status'];
    if (!in_array($from, $rule['from'], true)) {
        json_error(
            'This report is ' . strtolower(PUBLICATION_WORDS[$from]) . ', so it cannot be '
            . ['approve' => 'approved', 'reject' => 'rejected', 'resubmit' => 'submitted again', 'remove' => 'removed'][$action] . '.',
            409,
            ['publication_status' => $from]
        );
    }

    $note = trim((string) ($body['note'] ?? ''));
    $note = $note === '' ? null : $note;
    if ($rule['note'] && $note === null) {
        $message = $action === 'reject'
            ? 'Write why the report is not approved. The reporter is told this, so they can fix it.'
            : 'Write why this report is being removed. The reporter is told this.';
        json_error($message, 422, ['fields' => ['note' => $message]]);
    }
    if ($note !== null && mb_strlen($note) > 255) {
        json_error('Keep the note to 255 characters.', 422, ['fields' => ['note' => 'Keep the note to 255 characters.']]);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($action === 'remove') {
            report_remove_publication($report, $user, $note);
        } else {
            set_publication_status($id, $from, $rule['to']);
            log_publication_change($id, (int) $user['user_id'], $from, $rule['to'], $note);

            $owner = (int) $report['user_id'];
            if ($action === 'approve') {
                // The case history starts here: published, and Active.
                log_status_change($id, (int) $user['user_id'], null, (string) $report['status'], 'Published after review.');
                notify_report_owner($owner, $id, 'report_published', 'Your report is published',
                    'A Pet Coordinator approved your report. It is now public and is being compared with other reports.');
            } elseif ($action === 'reject') {
                notify_report_owner($owner, $id, 'report_rejected', 'Your report was not approved', $note);
            } else {
                notify_report_owner($owner, $id, 'report_submitted', 'Your report was submitted for review again',
                    'A Pet Coordinator will check it before it appears publicly.');
            }
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    if ($action === 'approve' || $action === 'reject') {
        audit_log('report_reviewed', (int) $user['user_id'], $user['email'], 'report', $id, 'success', $action);
    }
    if ($action === 'remove') {
        audit_log('report_removed', (int) $user['user_id'], $user['email'], 'report', $id, 'success', 'removed by an administrator');
    }
    activity_log((int) $user['user_id'], [
        'approve' => 'report_approved',
        'reject' => 'report_rejected',
        'resubmit' => 'report_resubmitted',
        'remove' => 'report_removed',
    ][$action], 'report', $id);

    // Matching starts at publication — after the commit and in its own try,
    // as filing always did: the report is published, and a fault in the
    // comparison must not take that back. A failure is logged with the stage
    // it stopped at (matching_log), and the next edit compares again.
    if ($action === 'approve') {
        try {
            require_once __DIR__ . '/matching.php';
            generate_matches_for_report($id);
        } catch (Throwable $exception) {
            error_log('[pawsandfound] matching failed for report ' . $id . ' after approval: ' . $exception->getMessage());
        }
    }

    report_detail($id);
}

/**
 * Take a published report out of public circulation: its own state, never
 * Closed (Correction 4). Its open pairings are dismissed, and the reporter is
 * told why. Used by an administrator from the report and by moderation.
 * Runs inside the caller's transaction.
 */
function report_remove_publication(array $report, array $admin, string $reason): void
{
    $id = (int) $report['report_id'];
    set_publication_status($id, 'published', 'removed');
    log_publication_change($id, (int) $admin['user_id'], 'published', 'removed', $reason);

    require_once __DIR__ . '/matches.php';
    dismiss_open_pairings_for_report($id, $admin);

    notify_report_owner((int) $report['user_id'], $id, 'report_removed', 'Your report was removed', $reason);
}

/** Move the state, but only from the one expected: a decision made a moment ago by somebody else wins. */
function set_publication_status(int $id, string $from, string $to): void
{
    $update = db()->prepare(
        'UPDATE pet_reports SET publication_status = :to WHERE report_id = :id AND publication_status = :from'
    );
    $update->execute([':to' => $to, ':id' => $id, ':from' => $from]);
    if ($update->rowCount() !== 1) {
        throw new RuntimeException('publication state changed underneath the request');
    }
}

function log_publication_change(int $reportId, ?int $userId, ?string $from, string $to, ?string $note): void
{
    db()->prepare(
        'INSERT INTO publication_logs (report_id, actor_user_id, previous_state, new_state, note)
         VALUES (:report_id, :user_id, :previous, :new, :note)'
    )->execute([
        ':report_id' => $reportId,
        ':user_id' => $userId,
        ':previous' => $from,
        ':new' => $to,
        ':note' => $note,
    ]);
}

function notify_report_owner(int $userId, int $reportId, string $type, string $title, ?string $body): void
{
    db()->prepare(
        'INSERT INTO notifications (user_id, notification_type, title, body, report_id)
         VALUES (:user_id, :type, :title, :body, :report_id)'
    )->execute([
        ':user_id' => $userId,
        ':type' => $type,
        ':title' => $title,
        ':body' => $body,
        ':report_id' => $reportId,
    ]);
}

/** Edit a report. Only the person who filed it may change its details. */
function report_update(int $id): never
{
    $user = require_login();
    $publication = report_open_for_owner($id, $user, 'Only the person who filed a report can edit it.')['publication_status'];

    // The report as it stands, in the API's own field names, so the request's
    // changes can be laid over it and the result checked as a whole.
    $statement = db()->prepare(
        "SELECT r.report_type, r.location_id,
                r.pet_name, c.category_code AS species, b.breed_name AS breed,
                r.pet_size AS size, r.pet_sex AS sex,
                r.primary_color, r.secondary_color, r.distinct_features, r.description,
                r.has_collar, r.pet_condition AS `condition`,
                r.incident_date, r.incident_time,
                l.label AS location_label, l.city, l.province,
                l.city_code, pc.area_code,
                l.latitude AS lat, l.longitude AS lng,
                r.allow_platform_contact, r.show_phone, r.show_email
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
           JOIN locations l      ON l.location_id = r.location_id
      LEFT JOIN ph_cities pc     ON pc.city_code  = l.city_code
      LEFT JOIN pet_breeds b     ON b.breed_id    = r.breed_id
          WHERE r.report_id = :id"
    );
    $statement->execute([':id' => $id]);
    $current = $statement->fetch();

    $body = request_body();

    // Every field the edit form offers, and nothing else: anything else in the
    // body is ignored. Absent means "leave it as it is".
    //
    // The place is chosen by code (area, then city); the names are written
    // from ph_cities, never taken from the request. show_phone is not here:
    // a phone number is never published (Correction 3), so there is nothing
    // to edit.
    $editable = [
        'pet_name', 'species', 'breed', 'size', 'sex', 'primary_color', 'secondary_color',
        'distinct_features', 'description', 'has_collar', 'condition',
        'incident_date', 'incident_time', 'location_label', 'area_code', 'city_code',
        'lat', 'lng', 'allow_platform_contact', 'show_email',
    ];
    $sent = array_values(array_filter($editable, fn ($key) => array_key_exists($key, $body)));
    if ($sent === []) {
        json_error('Nothing to change.', 422);
    }

    $merged = $current;
    foreach ($sent as $key) {
        $merged[$key] = $body[$key];
    }
    // A breed belongs to a species: a new species without a breed has none,
    // rather than keeping the old one ("a Shih Tzu cat").
    if (in_array('species', $sent, true) && !in_array('breed', $sent, true)) {
        $merged['breed'] = null;
    }

    // The same rules as filing, applied to the report as it would be. The
    // chosen-from-a-list fields are checked when this edit sends them: a
    // report filed before the lists existed keeps its typed colour or place
    // through an edit that does not touch them.
    $v = report_validated($merged, $current['report_type'], $sent);

    // Only the columns this request changes are written.
    $report = [];
    $location = [];
    $columns = [
        'pet_name' => 'pet_name', 'size' => 'pet_size', 'sex' => 'pet_sex',
        'primary_color' => 'primary_color', 'secondary_color' => 'secondary_color',
        'distinct_features' => 'distinct_features', 'description' => 'description',
        'has_collar' => 'has_collar', 'condition' => 'pet_condition',
        'incident_date' => 'incident_date', 'incident_time' => 'incident_time',
        'allow_platform_contact' => 'allow_platform_contact', 'show_email' => 'show_email',
    ];
    foreach ($columns as $key => $column) {
        if (in_array($key, $sent, true)) {
            $report[$column] = $v[$column];
        }
    }
    if (in_array('species', $sent, true) || in_array('breed', $sent, true)) {
        $report['category_id'] = $v['category_id'];
        $report['breed_id'] = breed_id_for($v['category_id'], $v['breed']);
    }
    foreach (['location_label' => 'label', 'lat' => 'latitude', 'lng' => 'longitude'] as $key => $column) {
        if (in_array($key, $sent, true)) {
            $location[$column] = $v[$column];
        }
    }
    // A new place is the code and both names, together.
    if (in_array('area_code', $sent, true) || in_array('city_code', $sent, true)) {
        foreach (['city_code', 'city', 'province'] as $column) {
            $location[$column] = $v[$column];
        }
    }

    // The report and its location together, or neither. The location row it
    // already has is updated in place, so an edit never orphans one.
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $targets = [
            ['pet_reports', $report, 'report_id', $id],
            ['locations', $location, 'location_id', (int) $current['location_id']],
        ];

        foreach ($targets as [$table, $values, $key, $keyValue]) {
            if ($values === []) {
                continue;
            }
            // Column names come from the literal lists above, never from the
            // request; only the values are bound.
            $sets = implode(', ', array_map(fn ($column) => "`{$column}` = :{$column}", array_keys($values)));
            $params = [':row_key' => $keyValue];
            foreach ($values as $column => $value) {
                $params[":{$column}"] = $value;
            }
            $pdo->prepare("UPDATE {$table} SET {$sets} WHERE {$key} = :row_key")->execute($params);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // Compare the report again, as it now reads. Only an Active report reaches
    // here (report_open_for_owner), so there is no open pairing to go stale.
    // Pairings already decided are left as they were: a pair is never
    // suggested twice. After the commit and in its own try, as on filing: the
    // edit is saved whatever the comparison does.
    // Only a published report is compared; an edit to a report that is not
    // approved (returned for changes) waits for review like any other.
    // generate_matches_for_report() refuses an unpublished report as well.
    if ($publication === 'published') {
        try {
            require_once __DIR__ . '/matching.php';
            generate_matches_for_report($id);
        } catch (Throwable $exception) {
            error_log('[pawsandfound] matching failed for report ' . $id . ' after an edit: ' . $exception->getMessage());
        }
    }

    activity_log((int) $user['user_id'], 'report_edited', 'report', $id);

    report_detail($id);
}

/**
 * Change a report status.
 *
 * The reporter may close or reopen their own case; a coordinator may act on
 * any of them. Both paths are checked here rather than in the interface.
 */
function report_set_status(int $id): never
{
    $user = require_login();
    $report = find_report_or_404($id);

    $isOwner = (int) $report['user_id'] === (int) $user['user_id'];
    $isStaff = in_array($user['role'], ['staff', 'admin'], true);

    if (!$isOwner && !$isStaff) {
        json_error('You cannot change the status of a report you did not file.', 403);
    }

    // A case exists only once the report is published (Correction 4): an
    // unreviewed, rejected or removed report cannot be marked returned or
    // closed — removal in particular is never a closure.
    if ($report['publication_status'] !== 'published') {
        json_error(
            'This report is ' . strtolower(PUBLICATION_WORDS[$report['publication_status']])
            . '. Only a published report has a case to update.',
            409,
            ['publication_status' => $report['publication_status']]
        );
    }

    $body = request_body();
    $status = require_one_of(
        trim((string) ($body['status'] ?? '')),
        ['active', 'possible_match', 'returned', 'closed'],
        'status'
    );

    if ($status === null) {
        json_error('Say which status the report should move to.', 422);
    }

    // The status is a real one. Whether it is a real *move* from where this
    // report actually is, is a separate question — and the one that matters,
    // because the interface only ever offers the moves it should. A request
    // built by hand is not limited to what the interface offers, so the rule
    // has to live here.
    $current = (string) $report['status'];

    if ($status === $current) {
        json_error(
            'That report already shows “' . REPORT_STATUS_WORDS[$current] . '”. Nothing to change.',
            409,
            ['status' => $current]
        );
    }

    if (!in_array($status, REPORT_TRANSITIONS[$current], true)) {
        $allowed = REPORT_TRANSITIONS[$current];

        json_error(
            $allowed === []
                ? 'That report is closed, and a closed report does not reopen. File a new report instead.'
                : 'A report showing “' . REPORT_STATUS_WORDS[$current] . '” cannot be moved to “'
                  . REPORT_STATUS_WORDS[$status] . '”.',
            409,
            ['status' => $current, 'allowed' => $allowed]
        );
    }

    $note = blank_to_null($body['note'] ?? null);

    // Stored in a VARCHAR(255) and sent as a notification body of the same
    // size: longer is refused here, not left for strict MySQL to turn into a 500.
    if ($note !== null && mb_strlen($note) > 255) {
        json_error('Keep the note to 255 characters.', 422, ['fields' => ['note' => 'Keep the note to 255 characters.']]);
    }

    // Closing a report ends a case, and "closed" on its own explains nothing to
    // the reporter reading their own history later. Returned does not need one:
    // the reason is in the word.
    if ($status === 'closed' && $note === null) {
        json_error('Say why this report is being closed.', 422, [
            'fields' => ["note" => "It goes on the report's history, where the reporter can read it."],
        ]);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        // Conditional on the status REPORT_TRANSITIONS was checked against a
        // moment ago. The check and the write are otherwise separate steps,
        // and anything that lands between them — a coordinator confirming a
        // match, an administrator removing the report — would be silently
        // overwritten by a transition that was legal when it started and is
        // not any more.
        $update = $pdo->prepare(
            'UPDATE pet_reports SET status = :status
              WHERE report_id = :id AND status = :expected'
        );
        $update->execute([':status' => $status, ':id' => $id, ':expected' => $report['status']]);

        if ($update->rowCount() === 0) {
            json_error('This report changed while the page was open.', 409, [
                'code' => 'stale_state',
                'resource' => 'report',
                'id' => $id,
            ]);
        }

        // History is appended, never overwritten (CLAUDE.md §6.7).
        log_status_change(
            $id,
            (int) $user['user_id'],
            $report['status'],
            $status,
            $note
        );

        // A finished case ends its open pairings in the same transaction.
        if (in_array($status, ['returned', 'closed'], true)) {
            require_once __DIR__ . '/matches.php';
            dismiss_open_pairings_for_report($id, $user);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // After the commit, like every other audit entry: the trail records what
    // happened, not what was attempted.
    //
    // Only this route logs. `status_logs` also carries the row written when a
    // report is created and the one written when matching moves a report to
    // "possible match" on its own — neither is a person changing something,
    // and an audit log full of the system talking to itself is harder to read
    // than one that is not.
    audit_log('report_status_changed', (int) $user['user_id'], $user['email'],
        'report', $id, 'success', "{$report['status']} -> {$status}");
    activity_log((int) $user['user_id'], 'report_status_changed', 'report', $id, "{$report['status']} -> {$status}");

    report_detail($id);
}

/**
 * Recent changes across every report the caller has filed.
 *
 * A dedicated endpoint rather than reading it out of the report list: the list
 * deliberately does not carry each report's history, and fetching every report
 * in full just to build a short feed would be several requests for one panel.
 * This is one query.
 */
function reports_activity(): never
{
    $user = require_login();
    $limit = query_int_param('limit', 6, 1, 30);

    $statement = db()->prepare(
        'SELECT s.log_id, s.report_id, s.previous_status, s.new_status, s.note, s.created_at,
                r.pet_name, r.report_type,
                actor.full_name AS actor_name
           FROM status_logs s
           JOIN pet_reports r ON r.report_id = s.report_id
      LEFT JOIN users actor  ON actor.user_id = s.updated_by_user_id
          WHERE r.user_id = :user_id
          ORDER BY s.created_at DESC, s.log_id DESC
          LIMIT :limit'
    );
    $statement->bindValue(':user_id', $user['user_id'], PDO::PARAM_INT);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->execute();

    json_response(['data' => array_map(fn ($row) => [
        'log_id' => (int) $row['log_id'],
        'report_id' => (int) $row['report_id'],
        'report_label' => $row['pet_name'] ?? 'Found pet report',
        'report_type' => $row['report_type'],
        'previous_status' => $row['previous_status'],
        'status' => $row['new_status'],
        'note' => $row['note'],
        'actor_name' => $row['actor_name'],
        'created_at' => $row['created_at'],
    ], $statement->fetchAll())]);
}

/**
 * The numbers the dashboards report on.
 *
 * Three GROUP BY queries, not one list fetched and counted in JavaScript. That
 * matters for more than tidiness: the reports endpoint is paginated, so
 * counting its rows in the browser would silently report on one page rather
 * than on the whole table.
 *
 * Coordinators and administrators only — these are system figures, and the
 * customer dashboard deliberately shows cases rather than counts.
 */
function reports_stats(): never
{
    require_role('staff', 'admin');

    // ---- Totals, by status and by type -------------------------------------
    $totals = [
        'total' => 0,
        'lost' => 0,
        'found' => 0,
        'active' => 0,
        'possible_match' => 0,
        'returned' => 0,
        'closed' => 0,
    ];

    // Published reports only (Correction 4): an unreviewed, rejected or
    // removed report is not an Active, Lost or Found report anybody sees.
    // They are counted separately, under `publication`.
    $rows = db()->query(
        "SELECT status, report_type, COUNT(*) AS total
           FROM pet_reports
          WHERE publication_status = 'published'
          GROUP BY status, report_type"
    )->fetchAll();

    foreach ($rows as $row) {
        $count = (int) $row['total'];
        $totals['total'] += $count;
        $totals[$row['report_type']] += $count;
        $totals[$row['status']] += $count;
    }

    // ---- Reports filed per month, over the last six months ------------------
    // The window is built here rather than in SQL so that a month with no
    // reports still appears as a zero. A chart that silently omits its empty
    // months misreads as "nothing happened between July and September".
    $window = [];
    $startOfThisMonth = new DateTimeImmutable('first day of this month');

    for ($ago = 5; $ago >= 0; $ago--) {
        $month = $startOfThisMonth->modify("-{$ago} months");
        $window[$month->format('Y-m')] = [
            'month' => $month->format('Y-m'),
            'label' => $month->format('M'),
            'lost' => 0,
            'found' => 0,
            'total' => 0,
        ];
    }

    $statement = db()->prepare(
        "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, report_type, COUNT(*) AS total
           FROM pet_reports
          WHERE created_at >= :since AND publication_status = 'published'
          GROUP BY month, report_type"
    );
    $statement->execute([':since' => $startOfThisMonth->modify('-5 months')->format('Y-m-d 00:00:00')]);

    foreach ($statement->fetchAll() as $row) {
        if (!isset($window[$row['month']])) {
            continue;
        }

        $count = (int) $row['total'];
        $window[$row['month']][$row['report_type']] += $count;
        $window[$row['month']]['total'] += $count;
    }

    // ---- Which animals are reported most ------------------------------------
    $species = [];

    $rows = db()->query(
        "SELECT c.category_code, c.category_name, r.report_type, COUNT(*) AS total
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
          WHERE r.publication_status = 'published'
          GROUP BY c.category_code, c.category_name, r.report_type"
    )->fetchAll();

    foreach ($rows as $row) {
        $code = $row['category_code'];
        $species[$code] ??= [
            'code' => $code,
            'label' => $row['category_name'],
            'lost' => 0,
            'found' => 0,
            'total' => 0,
        ];

        $count = (int) $row['total'];
        $species[$code][$row['report_type']] += $count;
        $species[$code]['total'] += $count;
    }

    // Most reported first — the question the chart answers.
    usort($species, fn ($a, $b) => $b['total'] <=> $a['total']);

    // Where every report stands on publication — the review queue's size
    // among them.
    $publication = ['pending_review' => 0, 'published' => 0, 'rejected' => 0, 'removed' => 0];
    foreach (db()->query('SELECT publication_status, COUNT(*) AS total FROM pet_reports GROUP BY publication_status') as $row) {
        $publication[$row['publication_status']] = (int) $row['total'];
    }

    json_response(['data' => [
        'totals' => $totals,
        'monthly' => array_values($window),
        'by_species' => $species,
        'publication' => $publication,
    ]]);
}

/** Photographs a report may carry, and what counts as one. */
const PHOTO_MAX_PER_REPORT = 5;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG => 'png',
    IMAGETYPE_WEBP => 'webp',
];

/**
 * Attach photographs to a report.
 *
 * Sent as multipart/form-data rather than JSON, because a file is bytes and
 * base64 in a JSON body would inflate it by a third for no benefit.
 *
 * The upload is never trusted. Its filename, its extension and the content
 * type the browser claims are all discarded; what the file actually IS decides.
 * A PHP script called cat.jpg fails getimagesize(), and the name it would be
 * stored under is generated here, so nothing a caller sends ever reaches the
 * filesystem as a path.
 */
function report_add_photos(int $id): never
{
    $user = require_login();
    // True: the photographs filed with a report go up just after it, while it
    // waits for review (Correction 4).
    report_open_for_owner($id, $user, 'Only the person who filed a report can add photographs to it.', true);

    if (empty($_FILES['photos'])) {
        json_error('No photographs were received.', 422);
    }

    // PHP shapes a multiple-file upload as parallel arrays, one per property.
    $files = $_FILES['photos'];
    $count = is_array($files['name']) ? count($files['name']) : 0;

    if ($count === 0) {
        json_error('No photographs were received.', 422);
    }

    $existing = db()->prepare('SELECT COUNT(*) FROM report_images WHERE report_id = :id');
    $existing->execute([':id' => $id]);
    $already = (int) $existing->fetchColumn();

    if ($already + $count > PHOTO_MAX_PER_REPORT) {
        json_error('A report can have at most ' . PHOTO_MAX_PER_REPORT . ' photographs.', 422);
    }

    $directory = __DIR__ . '/uploads';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        error_log('[pawsandfound] could not create the uploads directory');
        json_error('The server could not store the photographs.', 500);
    }

    $altText = $_POST['alt'] ?? [];
    $accepted = [];
    $written = [];

    for ($i = 0; $i < $count; $i++) {
        $error = $files['error'][$i];

        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            cleanup_uploads($written);
            json_error('That photograph is too large.', 422);
        }

        if ($error !== UPLOAD_ERR_OK) {
            cleanup_uploads($written);
            json_error('One of the photographs did not upload correctly.', 422);
        }

        $temporary = $files['tmp_name'][$i];

        // Guards against a caller naming a file that is already on the server.
        if (!is_uploaded_file($temporary)) {
            cleanup_uploads($written);
            json_error('That file was not uploaded.', 422);
        }

        if ($files['size'][$i] > PHOTO_MAX_BYTES) {
            cleanup_uploads($written);
            json_error('Each photograph must be 5 MB or smaller.', 422);
        }

        // This reads the file's own header. It is the check that matters:
        // anything that is not really an image fails here, whatever it is
        // called and whatever content type the browser announced.
        $info = @getimagesize($temporary);

        if ($info === false || !isset(PHOTO_TYPES[$info[2]])) {
            cleanup_uploads($written);
            json_error('Photographs must be JPEG, PNG or WebP images.', 422);
        }

        // The stored name is generated, never taken from the upload. A caller
        // cannot choose the extension, the folder, or anything else about it.
        $filename = bin2hex(random_bytes(16)) . '.' . PHOTO_TYPES[$info[2]];
        $destination = $directory . '/' . $filename;

        if (!move_uploaded_file($temporary, $destination)) {
            cleanup_uploads($written);
            error_log('[pawsandfound] move_uploaded_file failed for report ' . $id);
            json_error('The server could not store the photographs.', 500);
        }

        $written[] = $destination;
        $accepted[] = [
            'filename' => $filename,
            'alt' => blank_to_null($altText[$i] ?? null),
        ];
    }

    // The rows and the files have to agree. If a row fails to insert, the files
    // written during this request are removed rather than left on disk with
    // nothing pointing at them.
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $insert = $pdo->prepare(
            'INSERT INTO report_images (report_id, image_path, alt_text, is_primary_photo)
                  VALUES (:report, :path, :alt, :primary)'
        );

        foreach ($accepted as $index => $photo) {
            $insert->execute([
                ':report' => $id,
                ':path' => $photo['filename'],
                ':alt' => $photo['alt'],
                // The first photograph on a report that had none becomes the
                // one shown on cards and in search results.
                ':primary' => ($already === 0 && $index === 0) ? 1 : 0,
            ]);
        }

        $pdo->commit();
    } catch (PDOException $exception) {
        $pdo->rollBack();
        cleanup_uploads($written);
        throw $exception;
    }

    activity_log((int) $user['user_id'], 'report_photos_added', 'report', $id, count($written) . ' photo(s)');

    json_response(['data' => report_photo_list($id)], 201);
}

/** A report's photographs as the API returns them, primary first. */
function report_photo_list(int $id): array
{
    $rows = db()->prepare(
        'SELECT image_id, image_path, alt_text, is_primary_photo
           FROM report_images
          WHERE report_id = :id
          ORDER BY is_primary_photo DESC, image_id ASC'
    );
    $rows->execute([':id' => $id]);

    return array_map(fn ($r) => [
        'image_id' => (int) $r['image_id'],
        'path' => $r['image_path'],
        'alt' => $r['alt_text'],
        'is_primary' => (bool) $r['is_primary_photo'],
    ], $rows->fetchAll());
}

/** The form's limit (LIMITS.photoAlt), inside the column's 180. */
const PHOTO_ALT_MAX = 120;

/**
 * Change a report's existing photographs: remove some, choose the primary one,
 * rewrite descriptions. Adding is POST to the same path.
 *
 *   PATCH /api/reports/12/photos
 *   { "remove": [34, 35], "primary": 2, "alt": { "2": "Milo on the sofa" } }
 *
 * One request rather than one per photograph because the router takes at most
 * /reports/{id}/photos, and because the three changes belong together: a
 * removal can take the primary with it.
 *
 * Nothing is trusted from the client except which of this report's own
 * photographs it means. Every id must belong to this report or the whole
 * request is refused; the rows are deleted by report AND id; and a file is
 * only ever removed from disk when it is one this server generated.
 */
function report_edit_photos(int $id): never
{
    $user = require_login();
    report_open_for_owner($id, $user, 'Only the person who filed a report can change its photographs.');
    $body = request_body();

    $rows = db()->prepare('SELECT image_id, image_path FROM report_images WHERE report_id = :id');
    $rows->execute([':id' => $id]);
    $owned = [];
    foreach ($rows->fetchAll() as $row) {
        $owned[(int) $row['image_id']] = $row['image_path'];
    }

    // One of this report's own photographs, or the request stops here.
    $mine = function (mixed $value) use ($owned): int {
        if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
            json_error('That photograph is not on this report.', 422);
        }
        if (!isset($owned[(int) $value])) {
            json_error('That photograph is not on this report.', 422);
        }

        return (int) $value;
    };

    $remove = [];
    if (array_key_exists('remove', $body)) {
        if (!is_array($body['remove'])) {
            json_error("'remove' must be a list of photograph ids.", 422);
        }
        $remove = array_values(array_unique(array_map($mine, $body['remove'])));
    }

    $alt = [];
    if (array_key_exists('alt', $body)) {
        if (!is_array($body['alt'])) {
            json_error("'alt' must map photograph ids to descriptions.", 422);
        }
        foreach ($body['alt'] as $imageId => $text) {
            $imageId = $mine((string) $imageId);
            $text = blank_to_null(is_string($text) ? $text : null);
            if ($text !== null && mb_strlen($text) > PHOTO_ALT_MAX) {
                json_error('Keep each photo description to ' . PHOTO_ALT_MAX . ' characters.', 422);
            }
            $alt[$imageId] = $text;
        }
    }

    $primary = null;
    if (array_key_exists('primary', $body) && $body['primary'] !== null) {
        $primary = $mine($body['primary']);
        if (in_array($primary, $remove, true)) {
            json_error('The main photograph cannot be one you are removing.', 422);
        }
    }

    if ($remove === [] && $alt === [] && $primary === null) {
        json_error('Nothing to change.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $delete = $pdo->prepare('DELETE FROM report_images WHERE report_id = :report AND image_id = :image');
        foreach ($remove as $imageId) {
            $delete->execute([':report' => $id, ':image' => $imageId]);
        }

        $describe = $pdo->prepare(
            'UPDATE report_images SET alt_text = :alt WHERE report_id = :report AND image_id = :image'
        );
        foreach ($alt as $imageId => $text) {
            if (!in_array($imageId, $remove, true)) {
                $describe->execute([':alt' => $text, ':report' => $id, ':image' => $imageId]);
            }
        }

        if ($primary !== null) {
            $pdo->prepare(
                'UPDATE report_images SET is_primary_photo = (image_id = :image) WHERE report_id = :report'
            )->execute([':image' => $primary, ':report' => $id]);
        }

        // Exactly one primary whenever any photographs remain: removing the
        // main one hands the role to the earliest that is left.
        $count = $pdo->prepare('SELECT COUNT(*) FROM report_images WHERE report_id = :report AND is_primary_photo = 1');
        $count->execute([':report' => $id]);
        if ((int) $count->fetchColumn() !== 1) {
            $pdo->prepare('UPDATE report_images SET is_primary_photo = 0 WHERE report_id = :report')
                ->execute([':report' => $id]);
            $pdo->prepare(
                'UPDATE report_images SET is_primary_photo = 1
                  WHERE report_id = :report ORDER BY image_id ASC LIMIT 1'
            )->execute([':report' => $id]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // The files go only after the rows are gone for good, and only files this
    // server named: 32 hex characters and one of the three extensions. A
    // seeded photograph ships with the frontend and is not in uploads/ at all,
    // so its row is removed and nothing on disk is touched. Nothing a caller
    // sends is ever used as a path.
    foreach ($remove as $imageId) {
        $name = $owned[$imageId];
        if (preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/', $name) === 1) {
            $file = __DIR__ . '/uploads/' . $name;
            if (is_file($file) && !@unlink($file)) {
                error_log('[pawsandfound] could not remove uploads/' . $name . ' for report ' . $id);
            }
        }
    }

    activity_log((int) $user['user_id'], 'report_photos_changed', 'report', $id);

    json_response(['data' => report_photo_list($id)]);
}


/** Remove files written earlier in a request that is now failing. */
function cleanup_uploads(array $paths): void
{
    foreach ($paths as $path) {
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

// -----------------------------------------------------------------------------
// Small shared pieces
// -----------------------------------------------------------------------------

/**
 * The checks every change to a filed report makes first: it exists, the caller
 * filed it, and the case is still open. A returned or closed report stops
 * accepting changes, photographs included: changing it would rewrite what a
 * coordinator was looking at when they decided.
 */
function report_open_for_owner(int $id, array $user, string $notOwner, bool $whileInReview = false): array
{
    $report = find_report_or_404($id);

    if ((int) $report['user_id'] !== (int) $user['user_id']) {
        json_error($notOwner, 403);
    }

    // Publication first (Correction 4). Waiting for review: frozen, so the
    // coordinator approves exactly what they read — except the photographs
    // filed with it, which are uploaded straight after the report itself
    // ($whileInReview). Removed: an administrator's decision, not editable.
    // Not approved: editable, then submitted again.
    $publication = $report['publication_status'];
    if ($publication === 'pending_review' && !$whileInReview) {
        json_error(
            'This report is waiting for a Pet Coordinator to review it, and cannot be changed until they have.',
            409,
            ['publication_status' => $publication, 'code' => 'pending_review']
        );
    }
    if ($publication === 'removed') {
        json_error(
            'This report was removed by an administrator and can no longer be changed.',
            409,
            ['publication_status' => $publication, 'code' => 'removed']
        );
    }
    if ($publication !== 'published') {
        return $report;
    }

    // Checked after ownership, so somebody else's closed report answers 403
    // rather than telling them what state it is in.
    if (in_array($report['status'], ['returned', 'closed'], true)) {
        json_error(
            'This report shows “' . REPORT_STATUS_WORDS[$report['status']]
            . '”, and a finished report can no longer be edited.',
            409,
            ['status' => $report['status']]
        );
    }

    // Frozen, photographs included, while a possible match is open. A pairing's
    // score and its seven signals describe the report as it was compared; an
    // edit underneath them left a coordinator reading "Both reports describe a
    // dog" beside a report that now said turtle. Once every open pairing is
    // settled the report is Active again, editable, and compared afresh.
    if ($report['status'] === 'possible_match') {
        json_error(
            'This report has an open possible match. Review or resolve the match before '
            . 'editing the report details.',
            409,
            ['status' => $report['status'], 'code' => 'match_open']
        );
    }

    return $report;
}

/**
 * The longest each text field may be, in characters: the same numbers as
 * LIMITS in src/components/report-form/reportFormModel.js, which the form
 * applies as maxLength. Checked here too, so a request built by hand gets a
 * 422 naming the field instead of strict MySQL refusing a too-long value and
 * the caller seeing a generic 500.
 */
/** Sizes a report may give. 'xl' added by migration 009 (Correction 3). */
const REPORT_SIZES = ['small', 'medium', 'large', 'xl'];

/** A lost pet's name needs at least this many letters or digits ("Bo", "R2"). */
const PET_NAME_MIN_CHARACTERS = 2;

/** A description shorter than this, spaces in a row counted once, is refused. */
const DESCRIPTION_MIN_CHARACTERS = 30;

/**
 * The Philippines, as a box a map pin must fall inside. South to Saluag in
 * Tawi-Tawi (4.6°), north past Y'Ami in Batanes (21.1°), east past Pusan Point
 * (126.6°), and west to 114° so Kalayaan — a municipality of Palawan, in the
 * place list — is inside. Mirrored as PH_BOUNDS in src/components/mapSetup.js.
 */
const PH_BOUNDS = ['south' => 4.2, 'west' => 114.0, 'north' => 21.4, 'east' => 127.0];

/**
 * Parts of that box that are another country's land, cut out of it as
 * [south, west, north, east]: Sabah's north and west coast (Kota Kinabalu,
 * Kudat, Banggi), Sabah's east coast (Sandakan, Lahad Datu, Semporna), and
 * Miangas, Indonesia. Each edge was checked against the nearest Philippine
 * land — Mangsee (7.5°N), the Turtle Islands (6.0°N), Sitangkai (119.4°E),
 * Balut (125.4°E) — so no Philippine island is cut off. Still a sketch, not a
 * coastline: a pin on the open sea is accepted.
 */
const PH_EXCLUDED = [
    [4.2, 114.0, 7.4, 117.6],
    [4.2, 117.6, 5.95, 119.0],
    [4.2, 126.0, 5.7, 127.0],
];

const REPORT_LIMITS = [
    'pet_name' => 40,
    'breed' => 60,
    'primary_color' => 30,
    'secondary_color' => 30,
    'distinct_features' => 300,
    'description' => 1000,
    'location_label' => 120,
    'condition' => 300,
];

/**
 * Every rule the report form enforces, enforced again here, for filing and for
 * editing alike, so the two can never drift and the browser can be bypassed
 * without the database ever seeing an incomplete report.
 *
 * Refuses with a 422 naming every field that failed; returns the values ready
 * for the database otherwise. The messages are the form's own, so a refusal
 * is worded as the form words it.
 *
 * @param array  $v      Report fields, keyed by their API names.
 * @param string $type   'lost' or 'found'.
 * @param array|null $sent  On an edit, the fields the request sends. The
 *   fields chosen from a list (colours, place) are checked only when sent, so
 *   a report filed before the lists existed can still be edited elsewhere.
 *   Null when filing: everything is checked.
 */
function report_validated(array $v, string $type, ?array $sent = null): array
{
    $errors = [];
    $text = fn (string $key) => trim((string) ($v[$key] ?? ''));
    $checking = fn (string $key) => $sent === null || in_array($key, $sent, true);

    foreach (REPORT_LIMITS as $key => $max) {
        if (mb_strlen($text($key)) > $max) {
            $errors[$key] = "Keep this to {$max} characters.";
        }
    }

    // Required for a lost report; a found report never requires one, because
    // the finder does not know it. Checked whenever one is given.
    $petName = meaningful_text($text('pet_name'));
    $nameProblem = pet_name_problem($petName, $type === 'lost');
    if ($nameProblem !== null) {
        $errors['pet_name'] = $nameProblem;
    }

    $speciesCode = $text('species');
    $categoryId = $speciesCode === '' ? null : category_id_for_code($speciesCode);
    if ($categoryId === null) {
        $errors['species'] = 'Choose the kind of animal.';
    }

    $breed = meaningful_text($text('breed'));
    // "Other" names no animal, so the breed field names it instead.
    if ($speciesCode === 'other' && $breed === '') {
        $errors['breed'] = 'Tell us what kind of animal this is.';
    }

    $size = blank_to_null($v['size'] ?? null);
    if (!in_array($size, REPORT_SIZES, true)) {
        $errors['size'] = 'Choose a size.';
    }

    $sex = blank_to_null($v['sex'] ?? null);
    if (!in_array($sex, ['male', 'female', 'unknown'], true)) {
        $errors['sex'] = 'Choose Male, Female, or Unknown.';
    }

    // Colours come from pet_colours. The stored value is the listed name,
    // whatever case or code the request used.
    $primary = $text('primary_color');
    $secondary = $text('secondary_color');
    if ($checking('primary_color')) {
        if ($primary === '') {
            $errors['primary_color'] = 'Choose the main colour — it is one of the first things people notice.';
        } elseif (($primary = colour_name_for($primary)) === null) {
            $errors['primary_color'] = 'Choose the main colour from the list. If it is not there, choose Other and describe it.';
        }
    }
    if ($checking('secondary_color') && $secondary !== '') {
        if (($secondary = colour_name_for($secondary)) === null) {
            $errors['secondary_color'] = 'Choose the other colour from the list, or leave it empty.';
        }
    }

    // Colour alone matches hundreds of animals.
    if ($breed === '' && $text('distinct_features') === '') {
        $errors['distinct_features'] = 'Add a breed or at least one distinctive feature.';
    }

    $collar = blank_to_null($v['has_collar'] ?? null);
    if ($type === 'found' && !in_array($collar, ['yes', 'no', 'unknown'], true)) {
        $errors['has_collar'] = 'Choose Yes, No, or Not sure.';
    } elseif ($collar !== null && !in_array($collar, ['yes', 'no', 'unknown'], true)) {
        $errors['has_collar'] = 'Choose Yes, No, or Not sure.';
    }

    $date = $text('incident_date');
    if (!is_valid_date($date)) {
        $errors['incident_date'] = 'Enter a valid date.';
    } elseif ($date > app_today()) {
        $errors['incident_date'] = 'The date cannot be in the future.';
    }

    // Stored as a 24-hour TIME. The form shows it with AM and PM and converts;
    // the API takes the 24-hour value, which is unambiguous.
    $time = $text('incident_time');
    if ($time !== '' && preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time) !== 1) {
        $errors['incident_time'] = 'Enter a time such as 07:30.';
    }

    if ($text('location_label') === '') {
        $errors['location_label'] = 'Describe the area.';
    }

    // The place, chosen from ph_areas and ph_cities by code. The names
    // stored with the report are written from the reference rows, never taken
    // from the request.
    $place = ['city_code' => null, 'city' => $text('city'), 'province' => $text('province')];
    if ($checking('area_code') || $checking('city_code')) {
        $found = place_for($text('area_code'), $text('city_code'));
        if (is_string($found['error'] ?? null)) {
            $errors[$found['field']] = $found['error'];
        } else {
            $place = $found;
        }
    } else {
        $place['city_code'] = blank_to_null($v['city_code'] ?? null);
    }

    $descriptionProblem = description_problem($text('description'));
    if ($descriptionProblem !== null) {
        $errors['description'] = $descriptionProblem;
    }

    // A pin is both coordinates or neither, and inside the Philippines.
    $lat = $v['lat'] ?? null;
    $lng = $v['lng'] ?? null;
    $hasLat = $lat !== null && $lat !== '';
    $hasLng = $lng !== null && $lng !== '';
    if ($hasLat !== $hasLng
        || ($hasLat && !is_numeric($lat))
        || ($hasLng && !is_numeric($lng))) {
        $errors['lat'] = 'That map pin is not a valid position.';
    } elseif ($hasLat && !inside_philippines((float) $lat, (float) $lng)) {
        $errors['lat'] = 'Place the pin inside the Philippines, or remove it.';
    }

    // At least one way to be reached. A phone number is never published
    // (Correction 3), so it is not one of them: a coordinator, who can see the
    // account's number, or the email address.
    $platform = !empty($v['allow_platform_contact']);
    $showEmail = !empty($v['show_email']);
    if (!$platform && !$showEmail) {
        $errors['contact'] = 'Choose at least one way people or Pet Coordinators can reach you.';
    }

    if ($errors !== []) {
        json_error(reset($errors), 422, ['fields' => $errors]);
    }

    return [
        'category_id' => $categoryId,
        'breed' => $breed === '' ? null : $breed,
        'pet_name' => $petName === '' ? null : $petName,
        'pet_size' => $size,
        'pet_sex' => $sex,
        'primary_color' => $primary,
        'secondary_color' => $secondary === '' ? null : $secondary,
        'distinct_features' => $text('distinct_features') === '' ? null : $text('distinct_features'),
        'description' => $text('description'),
        'has_collar' => $collar ?? 'unknown',
        'pet_condition' => $text('condition') === '' ? null : $text('condition'),
        'incident_date' => $date,
        'incident_time' => $time === '' ? null : $time,
        'label' => $text('location_label'),
        'city_code' => $place['city_code'],
        'city' => $place['city'],
        'province' => $place['province'],
        'latitude' => $hasLat ? (float) $lat : null,
        'longitude' => $hasLng ? (float) $lng : null,
        'allow_platform_contact' => $platform ? 1 : 0,
        'show_phone' => 0,
        'show_email' => $showEmail ? 1 : 0,
    ];
}

/** Trimmed, with every run of spaces, tabs or line breaks counted as one space. */
function meaningful_text(string $raw): string
{
    return trim(preg_replace('/\s+/u', ' ', $raw) ?? '');
}

/**
 * What is wrong with a pet's name, or null.
 *
 * At least two letters or digits ("Bo", "CJ", "R2"), and nothing but letters,
 * digits, spaces, apostrophes, periods and hyphens ("Mi-Mi", "Mr. Bean").
 * Mirrored in src/components/report-form/reportFormModel.js; both copies are
 * held to scripts/report-rules-cases.json.
 */
function pet_name_problem(string $name, bool $required): ?string
{
    if ($name === '') {
        return $required ? "Enter your pet's name, so people know what to call out." : null;
    }
    if (preg_match("/^[\p{L}\p{M}\p{N} '\x{2019}.\-]+$/u", $name) !== 1) {
        return 'Use letters, numbers, spaces, apostrophes, periods and hyphens only.';
    }
    if (preg_match_all('/[\p{L}\p{N}]/u', $name) < PET_NAME_MIN_CHARACTERS) {
        return 'Enter a name with at least 2 letters or numbers.';
    }

    return null;
}

/** What is wrong with a description, or null. Spaces in a row count once. */
function description_problem(string $raw): ?string
{
    $length = mb_strlen(meaningful_text($raw));
    if ($length === 0) {
        return 'Add a short description — behaviour, temperament, anything that helps.';
    }
    if ($length < DESCRIPTION_MIN_CHARACTERS) {
        return 'Write at least ' . DESCRIPTION_MIN_CHARACTERS . " characters (you have {$length}): "
            . 'what happened, and how the pet behaves around strangers.';
    }

    return null;
}

/** The listed name of a colour, given its code or its name in any case; or null. */
function colour_name_for(string $value): ?string
{
    $statement = db()->prepare(
        'SELECT colour_name FROM pet_colours WHERE colour_code = :code OR colour_name = :name'
    );
    $statement->execute([':code' => $value, ':name' => $value]);
    $name = $statement->fetchColumn();

    return $name === false ? null : $name;
}

/**
 * A city or municipality and its area, by PSGC code. The area is a province,
 * or Metro Manila (NCR), or BARMM's Special Geographic Area (ph_areas).
 *
 * Returns the code and both names, or ['field' => ..., 'error' => ...]. The
 * city must belong to the area: the form clears the city when the area
 * changes, and a request that pairs them wrongly is refused rather
 * than corrected, because either half could be the mistake.
 */
function place_for(string $areaCode, string $cityCode): array
{
    if ($areaCode === '') {
        return ['field' => 'area_code', 'error' => 'Choose the province, or Metro Manila.'];
    }
    if ($cityCode === '') {
        return ['field' => 'city_code', 'error' => 'Choose the city or municipality.'];
    }

    $statement = db()->prepare(
        'SELECT c.city_code, c.city_name, p.area_code, p.area_name
           FROM ph_cities c
           JOIN ph_areas p ON p.area_code = c.area_code
          WHERE c.city_code = :city'
    );
    $statement->execute([':city' => $cityCode]);
    $row = $statement->fetch();

    if (!$row) {
        return ['field' => 'city_code', 'error' => 'Choose a city or municipality from the list.'];
    }
    if ($row['area_code'] !== $areaCode) {
        return ['field' => 'city_code', 'error' => 'That city or municipality is not in the province or area you chose.'];
    }

    return [
        'city_code' => $row['city_code'],
        'city' => $row['city_name'],
        'province' => $row['area_name'],
    ];
}

/** Whether a point is inside PH_BOUNDS and outside every PH_EXCLUDED box. */
function inside_philippines(float $lat, float $lng): bool
{
    if ($lat < PH_BOUNDS['south'] || $lat > PH_BOUNDS['north']
        || $lng < PH_BOUNDS['west'] || $lng > PH_BOUNDS['east']) {
        return false;
    }
    foreach (PH_EXCLUDED as [$south, $west, $north, $east]) {
        if ($lat >= $south && $lat <= $north && $lng >= $west && $lng <= $east) {
            return false;
        }
    }

    return true;
}

function find_report_or_404(int $id): array
{
    $statement = db()->prepare('SELECT report_id, user_id, status, publication_status FROM pet_reports WHERE report_id = :id');
    $statement->execute([':id' => $id]);
    $report = $statement->fetch();

    if (!$report) {
        json_error('That report does not exist.', 404);
    }

    return $report;
}

function log_status_change(int $reportId, ?int $userId, ?string $from, string $to, ?string $note): void
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

function category_id_for_code(string $code): ?int
{
    if ($code === '') {
        return null;
    }

    $statement = db()->prepare(
        'SELECT category_id FROM pet_categories WHERE category_code = :code AND is_active = TRUE'
    );
    $statement->execute([':code' => $code]);
    $id = $statement->fetchColumn();

    return $id === false ? null : (int) $id;
}

/**
 * Find a breed by name within a species, adding it if it is new.
 *
 * The report form asks for breed as free text ("An honest guess is fine"), but
 * the database keeps breeds as a normalised lookup. This reconciles the two
 * without forcing a reporter to pick from a list they may not recognise.
 */
function breed_id_for(int $categoryId, ?string $name): ?int
{
    if ($name === null || trim($name) === '') {
        return null;
    }

    $name = trim($name);

    $existing = db()->prepare(
        'SELECT breed_id FROM pet_breeds WHERE category_id = :category AND breed_name = :name'
    );
    $existing->execute([':category' => $categoryId, ':name' => $name]);
    $id = $existing->fetchColumn();

    if ($id !== false) {
        return (int) $id;
    }

    $insert = db()->prepare('INSERT INTO pet_breeds (category_id, breed_name) VALUES (:category, :name)');
    $insert->execute([':category' => $categoryId, ':name' => $name]);

    return (int) db()->lastInsertId();
}


function is_valid_date(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function reports_list(): never
{
    // Who is asking decides how much of each row they get (see
    // shape_for_viewer) and which columns free text may search.
    $viewer = current_user();
    $isStaff = $viewer !== null && in_array($viewer['role'], ['staff', 'admin'], true);

    // ---- Filters -------------------------------------------------------------
    // Each one appends a condition AND a bound parameter, so the SQL text is
    // fixed no matter what the caller sends.
    $where = [];
    $params = [];

    $type = require_one_of(query_string_param('type'), ['lost', 'found'], 'type');
    if ($type !== null) {
        $where[] = 'r.report_type = :type';
        $params[':type'] = $type;
    }

    $status = require_one_of(
        query_string_param('status'),
        ['active', 'possible_match', 'returned', 'closed'],
        'status'
    );
    if ($status !== null) {
        $where[] = 'r.status = :status';
        $params[':status'] = $status;
    }

    // Publication (Correction 4). Everybody sees published reports and only
    // those, unless they ask for more and may have it: a coordinator or an
    // administrator any state, a member their own reports (reporter_id = them).
    $publication = require_one_of(
        query_string_param('publication'),
        ['published', 'pending_review', 'rejected', 'removed', 'all'],
        'publication'
    ) ?? 'published';
    if ($publication !== 'published') {
        $ownList = $viewer !== null && query_string_param('reporter_id') !== null
            && (int) query_string_param('reporter_id') === (int) $viewer['user_id'];
        if (!$isStaff && !$ownList) {
            json_error($viewer === null ? 'You need to be signed in to do that.' : 'Only Pet Coordinators can list reports that are not published.',
                $viewer === null ? 401 : 403);
        }
    }
    if ($publication !== 'all') {
        $where[] = 'r.publication_status = :publication';
        $params[':publication'] = $publication;
    }

    if (($species = query_string_param('species')) !== null) {
        $where[] = 'c.category_code = :species';
        $params[':species'] = $species;
    }

    $size = require_one_of(query_string_param('size'), REPORT_SIZES, 'size');
    if ($size !== null) {
        $where[] = 'r.pet_size = :size';
        $params[':size'] = $size;
    }

    if (($city = query_string_param('city')) !== null) {
        $where[] = 'l.city LIKE :city';
        $params[':city'] = '%' . $city . '%';
    }

    // The place lists on Explore (Correction 3): by PSGC code, so "City of
    // Makati" and a report that says "Makati City" are the same place.
    if (($areaCode = query_string_param('area_code')) !== null) {
        $where[] = 'pc.area_code = :area_code';
        $params[':area_code'] = $areaCode;
    }

    if (($cityCode = query_string_param('city_code')) !== null) {
        $where[] = 'l.city_code = :city_code';
        $params[':city_code'] = $cityCode;
    }

    if (($colour = query_string_param('colour')) !== null) {
        // A listed colour is matched exactly: "Tan" must not find "Tangerine".
        // Anything else keeps the old substring search, for colours typed
        // before the list existed.
        //
        // Each placeholder is used exactly once. With native prepared
        // statements (PDO::ATTR_EMULATE_PREPARES => false) MySQL rejects a
        // named placeholder that appears twice — "Invalid parameter number".
        $listed = colour_name_for($colour);
        if ($listed !== null) {
            $where[] = '(r.primary_color = :colour1 OR r.secondary_color = :colour2)';
            $params[':colour1'] = $listed;
            $params[':colour2'] = $listed;
        } else {
            $where[] = '(r.primary_color LIKE :colour1 OR r.secondary_color LIKE :colour2)';
            $params[':colour1'] = '%' . $colour . '%';
            $params[':colour2'] = '%' . $colour . '%';
        }
    }

    // Someone's own reports, for the dashboard. Only your own: listing a
    // stranger's reports by account id would group them by person, which the
    // payload no longer does. Staff and administrators may ask for anybody's.
    if (($reporter = query_string_param('reporter_id')) !== null) {
        if ($viewer === null) {
            json_error('You need to be signed in to do that.', 401, ['code' => 'auth_required']);
        }
        if (!$isStaff && (int) $reporter !== (int) $viewer['user_id']) {
            json_error('You can only list your own reports that way.', 403);
        }
        $where[] = 'r.user_id = :reporter_id';
        $params[':reporter_id'] = (int) $reporter;
    }

    if (($from = query_string_param('date_from')) !== null) {
        $where[] = 'r.incident_date >= :date_from';
        $params[':date_from'] = $from;
    }

    if (($to = query_string_param('date_to')) !== null) {
        $where[] = 'r.incident_date <= :date_to';
        $params[':date_to'] = $to;
    }

    // Free-text search across the fields somebody would actually type into.
    if (($text = query_string_param('q')) !== null) {
        // One placeholder per column, for the same reason as the colour filter
        // above: a native prepared statement binds each marker once.
        //
        // A guest searches only what a guest can see. Matching a word in a
        // description they are not shown would tell them it is there, one
        // search at a time.
        $columns = $viewer === null
            ? GUEST_SEARCH_COLUMNS
            : [
                'r.pet_name', 'r.description', 'r.distinct_features',
                'r.primary_color', 'b.breed_name', 'l.city', 'l.label',
            ];

        $conditions = [];
        foreach ($columns as $index => $column) {
            $placeholder = ':q' . $index;
            $conditions[] = "{$column} LIKE {$placeholder}";
            $params[$placeholder] = '%' . $text . '%';
        }

        $where[] = '(' . implode(' OR ', $conditions) . ')';
    }

    $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

    // ---- Sorting -------------------------------------------------------------
    $sortKey = query_string_param('sort') ?? 'newest';
    if (!array_key_exists($sortKey, REPORT_SORTS)) {
        json_error("'sort' must be one of: " . implode(', ', array_keys(REPORT_SORTS)), 422);
    }
    $orderBy = REPORT_SORTS[$sortKey];

    // ---- Paging --------------------------------------------------------------
    $page = query_int_param('page', 1, 1, 10000);
    $perPage = query_int_param('per_page', DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    $offset = ($page - 1) * $perPage;

    $from_sql = 'FROM pet_reports r
                 JOIN pet_categories c ON c.category_id = r.category_id
                 JOIN locations l      ON l.location_id = r.location_id
                 LEFT JOIN ph_cities pc ON pc.city_code = l.city_code
                 LEFT JOIN pet_breeds b ON b.breed_id = r.breed_id';

    // Total first, so the frontend can render "Showing 9 of 24" and page links.
    $countStatement = db()->prepare("SELECT COUNT(*) {$from_sql}{$clause}");
    $countStatement->execute($params);
    $total = (int) $countStatement->fetchColumn();

    $sql = "SELECT r.report_id, r.report_type, r.status, r.publication_status, r.pet_name, r.pet_size, r.pet_sex,
                   r.primary_color, r.secondary_color, r.distinct_features, r.description,
                   r.has_collar, r.pet_condition, r.incident_date, r.incident_time,
                   r.updated_at, r.user_id AS reporter_id,
                   c.category_code AS species, c.category_name AS species_label,
                   b.breed_name AS breed,
                   l.label AS location_label, l.city, l.province, l.latitude, l.longitude,
                   l.city_code, pc.area_code,
                   (SELECT i.image_path FROM report_images i
                     WHERE i.report_id = r.report_id
                     ORDER BY i.is_primary_photo DESC, i.image_id ASC
                     LIMIT 1) AS primary_image,
                   -- Its description travels with it. Without this the cards
                   -- on Explore and the dashboards carry an empty alt, and a
                   -- screen reader is told nothing about the photograph.
                   (SELECT i.alt_text FROM report_images i
                     WHERE i.report_id = r.report_id
                     ORDER BY i.is_primary_photo DESC, i.image_id ASC
                     LIMIT 1) AS primary_image_alt
            {$from_sql}{$clause}
            ORDER BY {$orderBy}
            LIMIT :limit OFFSET :offset";

    $statement = db()->prepare($sql);
    foreach ($params as $name => $value) {
        $statement->bindValue($name, $value);
    }
    // LIMIT and OFFSET must bind as integers; PDO would otherwise quote them
    // and MySQL rejects 'LIMIT "9"'.
    $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    json_response([
        'data' => array_map(
            fn ($row) => shape_for_viewer(shape_report_row($row), (int) $row['reporter_id'], $viewer),
            $statement->fetchAll()
        ),
        'meta' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
}

function report_detail(int $id): never
{
    $statement = db()->prepare(
        'SELECT r.*, c.category_code AS species, c.category_name AS species_label,
                b.breed_name AS breed,
                l.label AS location_label, l.city, l.province,
                l.city_code, pc.area_code,
                l.latitude, l.longitude, l.`precision` AS location_precision,
                u.user_id AS reporter_id, u.full_name AS reporter_name,
                u.email AS reporter_email
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
           JOIN locations l      ON l.location_id = r.location_id
           JOIN users u          ON u.user_id     = r.user_id
      LEFT JOIN ph_cities pc     ON pc.city_code  = l.city_code
      LEFT JOIN pet_breeds b     ON b.breed_id    = r.breed_id
          WHERE r.report_id = :id'
    );
    $statement->execute([':id' => $id]);
    $row = $statement->fetch();

    if (!$row) {
        json_error('That report does not exist.', 404);
    }

    // After the existence check on purpose: a missing report stays a 404 for
    // everybody, and whether one exists is no secret — the public list names
    // every report. What a guest may not have is the detail.
    $viewer = current_user();

    // An unpublished report — waiting for review, not approved, removed — is
    // the reporter's and the coordinators' business only. To anybody else it
    // does not exist, exactly as a missing one (Correction 4).
    $mayReview = $viewer !== null && in_array($viewer['role'], ['staff', 'admin'], true);
    $isReporter = $viewer !== null && (int) $viewer['user_id'] === (int) $row['reporter_id'];
    if ($row['publication_status'] !== 'published' && !$mayReview && !$isReporter) {
        json_error('That report does not exist.', 404);
    }

    if ($viewer === null) {
        json_error("Sign in or create an account to see this report's details.", 401, [
            'code' => 'auth_required',
        ]);
    }

    $report = shape_report_row($row);

    // Photographs.
    $photos = db()->prepare(
        'SELECT image_id, image_path, alt_text, is_primary_photo
           FROM report_images
          WHERE report_id = :id
          ORDER BY is_primary_photo DESC, image_id ASC'
    );
    $photos->execute([':id' => $id]);
    $report['photos'] = array_map(fn ($p) => [
        'image_id' => (int) $p['image_id'],
        'path' => $p['image_path'],
        'alt' => $p['alt_text'],
        'is_primary' => (bool) $p['is_primary_photo'],
    ], $photos->fetchAll());

    // Case history, oldest first, with the name of whoever made each change.
    $history = db()->prepare(
        'SELECT s.log_id, s.previous_status, s.new_status, s.note, s.created_at,
                u.full_name AS actor_name, s.updated_by_user_id AS actor_id,
                u.role AS actor_role
           FROM status_logs s
      LEFT JOIN users u ON u.user_id = s.updated_by_user_id
          WHERE s.report_id = :id
          ORDER BY s.created_at ASC, s.log_id ASC'
    );
    $history->execute([':id' => $id]);
    $historyRows = $history->fetchAll();

    // Contact details are private unless the reporter chose to publish them
    // (CLAUDE.md §14). The columns are filtered out here, on the server, so an
    // unshared detail never reaches the browser at all.
    //
    // A phone number is never published, whatever show_phone says
    // (Correction 3): the number is not even read by this query. `phone`
    // stays in the payload, always null, so the shape does not change. A Pet
    // Coordinator still sees the account's number where they handle the case.
    $report['reporter'] = [
        'user_id' => (int) $row['reporter_id'],
        'full_name' => $row['reporter_name'],
        'accepts_messages' => (bool) $row['allow_platform_contact'],
        'phone' => null,
        'email' => $row['show_email'] ? $row['reporter_email'] : null,
    ];

    // The PREFERENCE, which is a different thing from the masked value above.
    //
    // The browser used to work the preference out from whether a phone came
    // back, and that is wrong whenever there is no phone to return: a reporter
    // with show_phone = 1 and no number on their account looked like
    // show_phone = 0, and an edit that never touched the field saved it that
    // way. Masked data and preference state are two different concepts and the
    // server is the one that knows both.
    //
    // Only for somebody entitled to edit the report. To everybody else the
    // payload is byte-for-byte what it was.
    $mayEdit = (int) $viewer['user_id'] === (int) $row['reporter_id']
        || in_array($viewer['role'], ['staff', 'admin'], true);

    // The case history. Everybody signed in sees every status change and when
    // it happened. The people on the case — the reporter, coordinators,
    // administrators — also see who made each change and the note written
    // with it. Anybody else sees a role instead of a name and no note: a
    // closure reason or a moderation decision is written for the reporter,
    // not for the neighbourhood. Decided by who is viewing, never by what the
    // note happens to say.
    $report['history'] = array_map(function (array $entry) use ($mayEdit, $row): array {
        $actorId = $entry['actor_id'] === null ? null : (int) $entry['actor_id'];
        $shaped = [
            'log_id' => (int) $entry['log_id'],
            'previous_status' => $entry['previous_status'],
            'new_status' => $entry['new_status'],
            'note' => $entry['note'],
            'created_at' => $entry['created_at'],
            'actor_name' => $entry['actor_name'],
        ];

        if (!$mayEdit) {
            $shaped['note'] = null;
            $shaped['actor_name'] = match (true) {
                $actorId === null => null,
                $actorId === (int) $row['reporter_id'] => 'Reporter',
                $entry['actor_role'] === 'staff' => 'Pet Coordinator',
                $entry['actor_role'] === 'admin' => 'Administrator',
                default => null,
            };
        }

        return $shaped;
    }, $historyRows);

    // The publication record, for the people it concerns: the reporter sees
    // why a report was not approved or was removed; a coordinator sees who
    // decided what. Anybody else sees only that it is published.
    if ($mayEdit) {
        $log = db()->prepare(
            'SELECT p.log_id, p.previous_state, p.new_state, p.note, p.created_at,
                    u.full_name AS actor_name, u.role AS actor_role, p.actor_user_id
               FROM publication_logs p
          LEFT JOIN users u ON u.user_id = p.actor_user_id
              WHERE p.report_id = :id
              ORDER BY p.created_at ASC, p.log_id ASC'
        );
        $log->execute([':id' => $id]);
        $report['publication_history'] = array_map(fn ($entry) => [
            'log_id' => (int) $entry['log_id'],
            'previous_state' => $entry['previous_state'],
            'new_state' => $entry['new_state'],
            'note' => $entry['note'],
            'created_at' => $entry['created_at'],
            // The reporter sees a role, not a coordinator's name.
            'actor' => $mayReview ? $entry['actor_name'] : match (true) {
                $entry['actor_user_id'] !== null && (int) $entry['actor_user_id'] === (int) $row['reporter_id'] => 'You',
                $entry['actor_role'] === 'staff' => 'Pet Coordinator',
                $entry['actor_role'] === 'admin' => 'Administrator',
                default => null,
            },
        ], $log->fetchAll());
    }

    if ($mayEdit) {
        $report['contact_preferences'] = [
            'allow_platform_contact' => (bool) $row['allow_platform_contact'],
            // Retired: always false, so no form can offer it back.
            'show_phone' => false,
            'show_email' => (bool) $row['show_email'],
        ];

        // The pin as it was dropped, for the people who may move it: the edit
        // form shows it, and a coordinator arranging a handover may need it.
        // Nobody else receives more than the published grid point.
        $report['location']['lat'] = $row['latitude'] === null ? null : (float) $row['latitude'];
        $report['location']['lng'] = $row['longitude'] === null ? null : (float) $row['longitude'];
    } else {
        // Which account filed it is the reporter's and staff's business. The
        // name is still shown — the profile says it will be — and contact
        // details still follow the per-report choices above.
        unset($report['reporter_id'], $report['reporter']['user_id']);
    }

    json_response(['data' => $report]);
}

/**
 * Cut a list row down to what this viewer may have.
 *
 *   guest            the public summary: what identifies a pet at a glance, and
 *                    where roughly. No description, markings, condition, time,
 *                    place name or account id — those need a session.
 *   signed in        the full row, but `reporter_id` only on their own reports.
 *   staff, admin     everything; the records and queues need the account id.
 */
function shape_for_viewer(array $report, int $reporterId, ?array $viewer): array
{
    if ($viewer === null) {
        unset(
            $report['description'], $report['distinct_features'], $report['has_collar'],
            $report['condition'], $report['incident_time'], $report['updated_at'],
            $report['reporter_id'], $report['location']['label'],
            // A guest only ever sees published reports, so saying so is noise.
            $report['publication_status']
        );
        return $report;
    }

    $isStaff = in_array($viewer['role'], ['staff', 'admin'], true);
    if (!$isStaff && $reporterId !== (int) $viewer['user_id']) {
        unset($report['reporter_id']);
    }

    return $report;
}

/** A stored coordinate, snapped to PUBLIC_COORDINATE_GRID. */
function public_coordinate(mixed $value): ?float
{
    if ($value === null) {
        return null;
    }

    return round(round((float) $value / PUBLIC_COORDINATE_GRID) * PUBLIC_COORDINATE_GRID, 6);
}

/**
 * Turn a database row into the shape the frontend expects, with numbers as
 * numbers and booleans as booleans — MySQL hands everything back as strings.
 */
function shape_report_row(array $row): array
{
    return [
        'report_id' => (int) $row['report_id'],
        'report_type' => $row['report_type'],
        'status' => $row['status'],
        'publication_status' => $row['publication_status'] ?? 'published',
        'pet_name' => $row['pet_name'],
        'species' => $row['species'],
        'species_label' => $row['species_label'],
        'breed' => $row['breed'],
        'size' => $row['pet_size'],
        'sex' => $row['pet_sex'],
        'primary_color' => $row['primary_color'],
        'secondary_color' => $row['secondary_color'],
        'distinct_features' => $row['distinct_features'],
        'description' => $row['description'],
        'has_collar' => $row['has_collar'] ?? null,
        'condition' => $row['pet_condition'] ?? null,
        'incident_date' => $row['incident_date'],
        'incident_time' => $row['incident_time'],
        'updated_at' => $row['updated_at'] ?? null,
        'location' => [
            'label' => $row['location_label'],
            'city' => $row['city'],
            'province' => $row['province'],
            // The PSGC codes the form chose (migration 009). Null for a report
            // filed before then whose place could not be identified.
            'city_code' => $row['city_code'] ?? null,
            'area_code' => $row['area_code'] ?? null,
            // Approximate for everybody. report_detail() puts the stored pin
            // back for the reporter and staff, who already know it.
            'lat' => public_coordinate($row['latitude']),
            'lng' => public_coordinate($row['longitude']),
        ],
        'primary_image' => $row['primary_image'] ?? null,
        'primary_image_alt' => $row['primary_image_alt'] ?? null,
        // Who filed it, as an id only. The administrator's record list needs it
        // to show a name; contact details still come only from the detail view.
        'reporter_id' => isset($row['reporter_id']) ? (int) $row['reporter_id'] : null,
    ];
}
