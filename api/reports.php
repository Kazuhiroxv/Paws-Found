<?php
/**
 * Lost and found reports.
 *
 *   GET   /api/reports        list, with search, filters, sorting and paging
 *   GET   /api/reports/activity  recent changes across the caller's reports
 *   GET   /api/reports/12     one report, with photos, location and case history
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

    $categoryId = category_id_for_code(trim((string) ($body['species'] ?? '')));
    if ($categoryId === null) {
        json_error('Choose the kind of animal this report is about.', 422);
    }

    $incidentDate = trim((string) ($body['incident_date'] ?? ''));
    if (!is_valid_date($incidentDate)) {
        json_error('Give the date this happened, as YYYY-MM-DD.', 422);
    }
    if ($incidentDate > date('Y-m-d')) {
        json_error('That date is in the future.', 422);
    }

    $petName = trim((string) ($body['pet_name'] ?? ''));
    // A found report must never require a name: the finder does not know it.
    if ($type === 'lost' && $petName === '') {
        json_error('Enter the name of the pet.', 422);
    }

    $city = trim((string) ($body['city'] ?? ''));
    $province = trim((string) ($body['province'] ?? ''));
    if ($city === '' || $province === '') {
        json_error('Enter at least the city and province where this happened.', 422);
    }

    $size = require_one_of(blank_to_null($body['size'] ?? null), ['small', 'medium', 'large'], 'size');
    $sex = require_one_of(blank_to_null($body['sex'] ?? null), ['male', 'female', 'unknown'], 'sex') ?? 'unknown';
    $collar = require_one_of(blank_to_null($body['has_collar'] ?? null), ['yes', 'no', 'unknown'], 'has_collar') ?? 'unknown';

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
            ':label' => blank_to_null($body['location_label'] ?? null),
            ':city' => $city,
            ':province' => $province,
            ':lat' => numeric_or_null($body['lat'] ?? null),
            ':lng' => numeric_or_null($body['lng'] ?? null),
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
            ':category_id' => $categoryId,
            ':breed_id' => breed_id_for($categoryId, blank_to_null($body['breed'] ?? null)),
            ':location_id' => $locationId,
            ':report_type' => $type,
            ':status' => 'active',
            ':pet_name' => $petName === '' ? null : $petName,
            ':pet_size' => $size,
            ':pet_sex' => $sex,
            ':primary_color' => blank_to_null($body['primary_color'] ?? null),
            ':secondary_color' => blank_to_null($body['secondary_color'] ?? null),
            ':distinct_features' => blank_to_null($body['distinct_features'] ?? null),
            ':description' => blank_to_null($body['description'] ?? null),
            ':has_collar' => $collar,
            ':pet_condition' => blank_to_null($body['condition'] ?? null),
            ':incident_date' => $incidentDate,
            ':incident_time' => blank_to_null($body['incident_time'] ?? null),
            ':allow_contact' => !empty($body['allow_platform_contact']),
            ':show_phone' => !empty($body['show_phone']),
            ':show_email' => !empty($body['show_email']),
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
    $report = find_report_or_404($id);

    if ((int) $report['user_id'] !== (int) $user['user_id']) {
        json_error('Only the person who filed a report can edit it.', 403);
    }

    // A case that has finished stops accepting edits. Changing the description
    // of a pet that went home two weeks ago rewrites what a coordinator, and
    // possibly a moderation decision, was looking at when they decided —
    // and the case history beside it would still show the old story.
    //
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

    $body = request_body();

    // Only these columns may be changed, and each is written as a bound value.
    // Anything else in the request body is ignored rather than trusted.
    $editable = [
        'pet_name' => 'pet_name',
        'primary_color' => 'primary_color',
        'secondary_color' => 'secondary_color',
        'distinct_features' => 'distinct_features',
        'description' => 'description',
        'condition' => 'pet_condition',
    ];

    $sets = [];
    $params = [':id' => $id];

    foreach ($editable as $field => $column) {
        if (array_key_exists($field, $body)) {
            $sets[] = "{$column} = :{$column}";
            $params[":{$column}"] = blank_to_null($body[$field]);
        }
    }

    if (array_key_exists('size', $body)) {
        $sets[] = 'pet_size = :pet_size';
        $params[':pet_size'] = require_one_of(blank_to_null($body['size']), ['small', 'medium', 'large'], 'size');
    }

    if ($sets === []) {
        json_error('Nothing to change.', 422);
    }

    $statement = db()->prepare('UPDATE pet_reports SET ' . implode(', ', $sets) . ' WHERE report_id = :id');
    $statement->execute($params);

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

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $update = $pdo->prepare('UPDATE pet_reports SET status = :status WHERE report_id = :id');
        $update->execute([':status' => $status, ':id' => $id]);

        // History is appended, never overwritten (CLAUDE.md §6.7).
        log_status_change(
            $id,
            (int) $user['user_id'],
            $report['status'],
            $status,
            blank_to_null($body['note'] ?? null)
        );

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
    $report = find_report_or_404($id);

    if ((int) $report['user_id'] !== (int) $user['user_id']) {
        json_error('Only the person who filed a report can add photographs to it.', 403);
    }

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

    $rows = $pdo->prepare(
        'SELECT image_id, image_path, alt_text, is_primary_photo
           FROM report_images
          WHERE report_id = :id
          ORDER BY is_primary_photo DESC, image_id ASC'
    );
    $rows->execute([':id' => $id]);

    json_response(['data' => array_map(fn ($r) => [
        'image_id' => (int) $r['image_id'],
        'path' => $r['image_path'],
        'alt' => $r['alt_text'],
        'is_primary' => (bool) $r['is_primary_photo'],
    ], $rows->fetchAll())], 201);
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

function blank_to_null(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function numeric_or_null(mixed $value): ?float
{
    return is_numeric($value) ? (float) $value : null;
}

function is_valid_date(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function reports_list(): never
{
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

    // Someone's own reports, for the dashboard.
    if (($reporter = query_string_param('reporter_id')) !== null) {
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
        $columns = [
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
        'data' => array_map('shape_report_row', $statement->fetchAll()),
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
                u.full_name AS actor_name
           FROM status_logs s
      LEFT JOIN users u ON u.user_id = s.updated_by_user_id
          WHERE s.report_id = :id
          ORDER BY s.created_at ASC, s.log_id ASC'
    );
    $history->execute([':id' => $id]);
    $report['history'] = $history->fetchAll();

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

    json_response(['data' => $report]);
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
            'lat' => $row['latitude'] === null ? null : (float) $row['latitude'],
            'lng' => $row['longitude'] === null ? null : (float) $row['longitude'],
        ],
        'primary_image' => $row['primary_image'] ?? null,
        'primary_image_alt' => $row['primary_image_alt'] ?? null,
        // Who filed it, as an id only. The administrator's record list needs it
        // to show a name; contact details still come only from the detail view.
        'reporter_id' => isset($row['reporter_id']) ? (int) $row['reporter_id'] : null,
    ];
}
