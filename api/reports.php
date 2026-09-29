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
    $v = report_validated($body, $type, reporter_phone((int) $user['user_id']), !empty($body['show_phone']));

    $pdo = db();

    // A report is a location, plus the report, plus its opening history entry.
    // All three or none: a transaction stops a half-filed report existing.
    $pdo->beginTransaction();

    try {
        $location = $pdo->prepare(
            'INSERT INTO locations (label, city, province, latitude, longitude, `precision`)
             VALUES (:label, :city, :province, :lat, :lng, :precision)'
        );
        $location->execute([
            ':label' => $v['label'],
            ':city' => $v['city'],
            ':province' => $v['province'],
            ':lat' => $v['latitude'],
            ':lng' => $v['longitude'],
            // The reporter pins an area, never a doorstep (CLAUDE.md §14).
            ':precision' => 'approximate',
        ]);
        $locationId = (int) $pdo->lastInsertId();

        $report = $pdo->prepare(
            'INSERT INTO pet_reports
                (user_id, category_id, breed_id, location_id, report_type, status,
                 pet_name, pet_size, pet_sex, primary_color, secondary_color,
                 distinct_features, description, has_collar, pet_condition,
                 incident_date, incident_time,
                 allow_platform_contact, show_phone, show_email)
             VALUES
                (:user_id, :category_id, :breed_id, :location_id, :report_type, :status,
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

        log_status_change($reportId, (int) $user['user_id'], null, 'active', 'Report created.');

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // Look for possible matches now that the report exists.
    //
    // Deliberately after the commit and in its own try: the report is filed,
    // and a fault in the matching must not take it back. Somebody who has just
    // lost a pet should not be told their report failed because the comparison
    // did. The failure is logged and the coordinator's queue picks the case up
    // from the report itself.
    try {
        require_once __DIR__ . '/matching.php';
        generate_matches_for_report($reportId);
    } catch (Throwable $exception) {
        error_log('[pawsandfound] matching failed for report ' . $reportId . ': ' . $exception->getMessage());
    }

    report_detail($reportId);
}

/** Edit a report. Only the person who filed it may change its details. */
function report_update(int $id): never
{
    $user = require_login();
    report_open_for_owner($id, $user, 'Only the person who filed a report can edit it.');

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
                l.latitude AS lat, l.longitude AS lng,
                r.allow_platform_contact, r.show_phone, r.show_email
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
           JOIN locations l      ON l.location_id = r.location_id
      LEFT JOIN pet_breeds b     ON b.breed_id    = r.breed_id
          WHERE r.report_id = :id"
    );
    $statement->execute([':id' => $id]);
    $current = $statement->fetch();

    $body = request_body();

    // Every field the edit form offers, and nothing else: anything else in the
    // body is ignored. Absent means "leave it as it is".
    $editable = [
        'pet_name', 'species', 'breed', 'size', 'sex', 'primary_color', 'secondary_color',
        'distinct_features', 'description', 'has_collar', 'condition',
        'incident_date', 'incident_time', 'location_label', 'city', 'province', 'lat', 'lng',
        'allow_platform_contact', 'show_phone', 'show_email',
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

    // The same rules as filing, applied to the report as it would be.
    $v = report_validated(
        $merged,
        $current['report_type'],
        reporter_phone((int) $user['user_id']),
        in_array('show_phone', $sent, true) && !empty($body['show_phone'])
    );

    // Only the columns this request changes are written.
    $report = [];
    $location = [];
    $columns = [
        'pet_name' => 'pet_name', 'size' => 'pet_size', 'sex' => 'pet_sex',
        'primary_color' => 'primary_color', 'secondary_color' => 'secondary_color',
        'distinct_features' => 'distinct_features', 'description' => 'description',
        'has_collar' => 'has_collar', 'condition' => 'pet_condition',
        'incident_date' => 'incident_date', 'incident_time' => 'incident_time',
        'allow_platform_contact' => 'allow_platform_contact',
        'show_phone' => 'show_phone', 'show_email' => 'show_email',
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
    foreach (['location_label' => 'label', 'city' => 'city', 'province' => 'province',
              'lat' => 'latitude', 'lng' => 'longitude'] as $key => $column) {
        if (in_array($key, $sent, true)) {
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
    try {
        require_once __DIR__ . '/matching.php';
        generate_matches_for_report($id);
    } catch (Throwable $exception) {
        error_log('[pawsandfound] matching failed for report ' . $id . ' after an edit: ' . $exception->getMessage());
    }

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

    $rows = db()->query(
        'SELECT status, report_type, COUNT(*) AS total
           FROM pet_reports
          GROUP BY status, report_type'
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
          WHERE created_at >= :since
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
        'SELECT c.category_code, c.category_name, r.report_type, COUNT(*) AS total
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
          GROUP BY c.category_code, c.category_name, r.report_type'
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

    json_response(['data' => [
        'totals' => $totals,
        'monthly' => array_values($window),
        'by_species' => $species,
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
    report_open_for_owner($id, $user, 'Only the person who filed a report can add photographs to it.');

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
function report_open_for_owner(int $id, array $user, string $notOwner): array
{
    $report = find_report_or_404($id);

    if ((int) $report['user_id'] !== (int) $user['user_id']) {
        json_error($notOwner, 403);
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
const REPORT_LIMITS = [
    'pet_name' => 40,
    'breed' => 60,
    'primary_color' => 30,
    'secondary_color' => 30,
    'distinct_features' => 300,
    'description' => 1000,
    'location_label' => 120,
    'city' => 60,
    'province' => 60,
    'condition' => 300,
];

/**
 * Every rule the report form enforces, enforced again here, for filing and for
 * editing alike, so the two can never drift and the browser can be bypassed
 * without the database ever seeing an incomplete report.
 *
 * `$v` is the report as it WOULD be: the whole request when filing; on an edit,
 * the stored report with the request's changes laid over it. That is what lets
 * a rule about a pair of fields (a breed OR a distinctive feature; "Other"
 * naming its animal) hold whichever one an edit touches.
 *
 * Returns the values cleaned up, or answers 422 with every field that failed,
 * worded as the form words it.
 *
 * @param array  $v      Report fields, keyed by their API names.
 * @param string $type   'lost' or 'found'.
 * @param string|null $phone  The reporter's phone number, if they have one.
 * @param bool $phoneAsked  Whether this request itself asks to show the phone.
 *   A report filed before this rule may say "show phone" with no number; that
 *   stale setting must not block an unrelated edit, so only asking for it
 *   now is refused. It never counts as a way to be reached either way.
 */
function report_validated(array $v, string $type, ?string $phone, bool $phoneAsked): array
{
    $errors = [];
    $text = fn (string $key) => trim((string) ($v[$key] ?? ''));

    foreach (REPORT_LIMITS as $key => $max) {
        if (mb_strlen($text($key)) > $max) {
            $errors[$key] = "Keep this to {$max} characters.";
        }
    }

    $petName = $text('pet_name');
    // A found report never requires a name: the finder does not know it.
    if ($type === 'lost' && $petName === '') {
        $errors['pet_name'] = "Enter your pet's name, so people know what to call out.";
    }

    $speciesCode = $text('species');
    $categoryId = $speciesCode === '' ? null : category_id_for_code($speciesCode);
    if ($categoryId === null) {
        $errors['species'] = 'Choose the kind of animal.';
    }

    $breed = $text('breed');
    // "Other" names no animal, so the breed field names it instead.
    if ($speciesCode === 'other' && $breed === '') {
        $errors['breed'] = 'Tell us what kind of animal this is.';
    }

    $size = blank_to_null($v['size'] ?? null);
    if (!in_array($size, ['small', 'medium', 'large'], true)) {
        $errors['size'] = 'Choose a size.';
    }

    $sex = blank_to_null($v['sex'] ?? null);
    if (!in_array($sex, ['male', 'female', 'unknown'], true)) {
        $errors['sex'] = 'Choose Male, Female, or Unknown.';
    }

    if ($text('primary_color') === '') {
        $errors['primary_color'] = 'Enter the main colour — it is one of the first things people notice.';
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

    $time = $text('incident_time');
    if ($time !== '' && preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time) !== 1) {
        $errors['incident_time'] = 'Enter a time such as 07:30.';
    }

    if ($text('location_label') === '') {
        $errors['location_label'] = 'Describe the area.';
    }
    if ($text('city') === '') {
        $errors['city'] = 'Enter the city or municipality.';
    }
    if ($text('province') === '') {
        $errors['province'] = 'Enter the province.';
    }
    if ($text('description') === '') {
        $errors['description'] = 'Add a short description — behaviour, temperament, anything that helps.';
    }

    // A pin is both coordinates or neither, and on the planet.
    $lat = $v['lat'] ?? null;
    $lng = $v['lng'] ?? null;
    $hasLat = $lat !== null && $lat !== '';
    $hasLng = $lng !== null && $lng !== '';
    if ($hasLat !== $hasLng
        || ($hasLat && (!is_numeric($lat) || abs((float) $lat) > 90))
        || ($hasLng && (!is_numeric($lng) || abs((float) $lng) > 180))) {
        $errors['lat'] = 'That map pin is not a valid position.';
    }

    // At least one way to be reached that actually works. A coordinator can
    // always be reached; a phone number only counts if the reporter has one.
    $platform = !empty($v['allow_platform_contact']);
    $showPhone = !empty($v['show_phone']);
    $showEmail = !empty($v['show_email']);
    $hasPhone = trim((string) $phone) !== '';
    if ($phoneAsked && $showPhone && !$hasPhone) {
        $errors['show_phone'] = 'Add a phone number in your profile to use this option.';
    }
    if (!$platform && !($showPhone && $hasPhone) && !$showEmail) {
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
        'primary_color' => $text('primary_color'),
        'secondary_color' => $text('secondary_color') === '' ? null : $text('secondary_color'),
        'distinct_features' => $text('distinct_features') === '' ? null : $text('distinct_features'),
        'description' => $text('description'),
        'has_collar' => $collar ?? 'unknown',
        'pet_condition' => $text('condition') === '' ? null : $text('condition'),
        'incident_date' => $date,
        'incident_time' => $time === '' ? null : $time,
        'label' => $text('location_label'),
        'city' => $text('city'),
        'province' => $text('province'),
        'latitude' => $hasLat ? (float) $lat : null,
        'longitude' => $hasLng ? (float) $lng : null,
        'allow_platform_contact' => $platform ? 1 : 0,
        'show_phone' => $showPhone ? 1 : 0,
        'show_email' => $showEmail ? 1 : 0,
    ];
}

/** The reporter's phone number, or null. It decides whether "show phone" can work. */
function reporter_phone(int $userId): ?string
{
    $statement = db()->prepare('SELECT contact_number FROM users WHERE user_id = :id');
    $statement->execute([':id' => $userId]);
    $phone = $statement->fetchColumn();

    return $phone === false ? null : $phone;
}

function find_report_or_404(int $id): array
{
    $statement = db()->prepare('SELECT report_id, user_id, status FROM pet_reports WHERE report_id = :id');
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

    if (($species = query_string_param('species')) !== null) {
        $where[] = 'c.category_code = :species';
        $params[':species'] = $species;
    }

    $size = require_one_of(query_string_param('size'), ['small', 'medium', 'large'], 'size');
    if ($size !== null) {
        $where[] = 'r.pet_size = :size';
        $params[':size'] = $size;
    }

    if (($city = query_string_param('city')) !== null) {
        $where[] = 'l.city LIKE :city';
        $params[':city'] = '%' . $city . '%';
    }

    if (($colour = query_string_param('colour')) !== null) {
        // Each placeholder is used exactly once. With native prepared
        // statements (PDO::ATTR_EMULATE_PREPARES => false) MySQL rejects a
        // named placeholder that appears twice — "Invalid parameter number".
        $where[] = '(r.primary_color LIKE :colour1 OR r.secondary_color LIKE :colour2)';
        $params[':colour1'] = '%' . $colour . '%';
        $params[':colour2'] = '%' . $colour . '%';
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
                 LEFT JOIN pet_breeds b ON b.breed_id = r.breed_id';

    // Total first, so the frontend can render "Showing 9 of 24" and page links.
    $countStatement = db()->prepare("SELECT COUNT(*) {$from_sql}{$clause}");
    $countStatement->execute($params);
    $total = (int) $countStatement->fetchColumn();

    $sql = "SELECT r.report_id, r.report_type, r.status, r.pet_name, r.pet_size, r.pet_sex,
                   r.primary_color, r.secondary_color, r.distinct_features, r.description,
                   r.has_collar, r.pet_condition, r.incident_date, r.incident_time,
                   r.updated_at, r.user_id AS reporter_id,
                   c.category_code AS species, c.category_name AS species_label,
                   b.breed_name AS breed,
                   l.label AS location_label, l.city, l.province, l.latitude, l.longitude,
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
                l.latitude, l.longitude, l.`precision` AS location_precision,
                u.user_id AS reporter_id, u.full_name AS reporter_name,
                u.email AS reporter_email, u.contact_number AS reporter_phone
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
           JOIN locations l      ON l.location_id = r.location_id
           JOIN users u          ON u.user_id     = r.user_id
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
    // unshared phone number never reaches the browser at all.
    $report['reporter'] = [
        'user_id' => (int) $row['reporter_id'],
        'full_name' => $row['reporter_name'],
        'accepts_messages' => (bool) $row['allow_platform_contact'],
        'phone' => $row['show_phone'] ? $row['reporter_phone'] : null,
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

    if ($mayEdit) {
        $report['contact_preferences'] = [
            'allow_platform_contact' => (bool) $row['allow_platform_contact'],
            'show_phone' => (bool) $row['show_phone'],
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
            $report['reporter_id'], $report['location']['label']
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
