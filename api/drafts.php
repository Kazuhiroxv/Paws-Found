<?php
/**
 * Report drafts — an unfinished report, saved to come back to (Correction 4).
 *
 *   GET    /api/drafts        your drafts, newest first
 *   POST   /api/drafts        save a new draft          (needs only report_type)
 *   GET    /api/drafts/{id}   one of your drafts
 *   PUT    /api/drafts/{id}   save it again, replacing what was there
 *   DELETE /api/drafts/{id}   delete it
 *
 * A draft is nobody's business but its author's: not a coordinator's, not an
 * administrator's, and never public or matched. It is submitted through the
 * ordinary POST /api/reports with `draft_id`, which validates it in full,
 * files the report for review and deletes the draft in one transaction.
 *
 * Saving a draft checks types and lengths, not completeness: a draft may be a
 * species and a name. Anything given must still be a real value — a listed
 * colour, a place from the PSGC list, a real date — so a draft can always be
 * loaded back into the form.
 *
 * Deleting a draft really deletes it. It was never published, so there is
 * nothing to keep for anybody; and it is never recorded as a closure.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/reports.php';

/** Enough for anyone filing honestly; a ceiling so the table cannot be filled. */
const DRAFTS_PER_ACCOUNT = 20;

function handle_drafts(string $method, ?string $identifier): never
{
    $user = require_login();

    if ($identifier === null) {
        if ($method === 'GET') drafts_list($user);
        if ($method === 'POST') draft_save($user, null);
    } elseif (ctype_digit($identifier)) {
        $id = (int) $identifier;
        if ($method === 'GET') json_response(['data' => draft_shape(draft_own_or_404($id, $user))]);
        if ($method === 'PUT') draft_save($user, $id);
        if ($method === 'DELETE') draft_delete($id, $user);
    }

    json_error('No such endpoint.', 404);
}

const DRAFT_SELECT = 'SELECT d.*, c.category_code AS species, a.area_name, ci.city_name
                        FROM report_drafts d
                   LEFT JOIN pet_categories c ON c.category_id = d.category_id
                   LEFT JOIN ph_areas a      ON a.area_code = d.area_code
                   LEFT JOIN ph_cities ci    ON ci.city_code = d.city_code';

function drafts_list(array $user): never
{
    $statement = db()->prepare(DRAFT_SELECT . ' WHERE d.user_id = :user ORDER BY d.updated_at DESC, d.draft_id DESC');
    $statement->execute([':user' => (int) $user['user_id']]);

    json_response(['data' => array_map('draft_shape', $statement->fetchAll())]);
}

/** One of the signed-in person's drafts. Anybody else's is a 404, not a 403. */
function draft_own_or_404(int $id, array $user): array
{
    $statement = db()->prepare(DRAFT_SELECT . ' WHERE d.draft_id = :id AND d.user_id = :user');
    $statement->execute([':id' => $id, ':user' => (int) $user['user_id']]);
    $draft = $statement->fetch();

    if (!$draft) {
        json_error('That draft does not exist.', 404);
    }

    return $draft;
}

function draft_save(array $user, ?int $id): never
{
    $body = request_body();

    if ($id === null) {
        $type = require_one_of(trim((string) ($body['report_type'] ?? '')), ['lost', 'found'], 'report_type');
        if ($type === null) {
            json_error('Say whether this is a lost or a found report.', 422);
        }
        $count = db()->prepare('SELECT COUNT(*) FROM report_drafts WHERE user_id = :user');
        $count->execute([':user' => (int) $user['user_id']]);
        if ((int) $count->fetchColumn() >= DRAFTS_PER_ACCOUNT) {
            json_error('You have ' . DRAFTS_PER_ACCOUNT . ' saved drafts. Submit or delete one before saving another.', 422);
        }
    } else {
        // The type of report a draft is cannot change: the form it belongs to does not.
        $type = draft_own_or_404($id, $user)['report_type'];
    }

    $values = draft_validated($body);

    $columns = array_keys($values);
    if ($id === null) {
        $values['user_id'] = (int) $user['user_id'];
        $values['report_type'] = $type;
        $names = array_keys($values);
        db()->prepare('INSERT INTO report_drafts (' . implode(', ', $names) . ') VALUES (:'
            . implode(', :', $names) . ')')->execute(array_combine(array_map(fn ($n) => ":{$n}", $names), $values));
        $id = (int) db()->lastInsertId();
        $status = 201;
    } else {
        // Column names come from draft_validated()'s fixed list, never the request.
        $sets = implode(', ', array_map(fn ($c) => "{$c} = :{$c}", $columns));
        $params = array_combine(array_map(fn ($c) => ":{$c}", $columns), array_values($values));
        $params[':draft_id'] = $id;
        $params[':user_id'] = (int) $user['user_id'];
        db()->prepare("UPDATE report_drafts SET {$sets}, updated_at = CURRENT_TIMESTAMP
                        WHERE draft_id = :draft_id AND user_id = :user_id")->execute($params);
        $status = 200;
    }

    // The draft's number, never its contents.
    activity_log((int) $user['user_id'], $status === 201 ? 'draft_saved' : 'draft_updated', 'draft', $id);

    json_response(['data' => draft_shape(draft_own_or_404($id, $user))], $status);
}

function draft_delete(int $id, array $user): never
{
    draft_own_or_404($id, $user);
    db()->prepare('DELETE FROM report_drafts WHERE draft_id = :id AND user_id = :user')
        ->execute([':id' => $id, ':user' => (int) $user['user_id']]);

    activity_log((int) $user['user_id'], 'draft_deleted', 'draft', $id);

    json_response(['data' => ['draft_id' => $id, 'deleted' => true]]);
}

/**
 * What a draft may hold: every field optional, every value that IS given a
 * real one. Refuses with a 422 naming each field, like report_validated();
 * returns the columns ready for the database.
 */
function draft_validated(array $v): array
{
    $errors = [];
    $text = fn (string $key) => trim((string) ($v[$key] ?? ''));
    $orNull = fn (string $value) => $value === '' ? null : $value;

    foreach (REPORT_LIMITS as $key => $max) {
        if (mb_strlen($text($key)) > $max) {
            $errors[$key] = "Keep this to {$max} characters.";
        }
    }

    $categoryId = null;
    if ($text('species') !== '' && ($categoryId = category_id_for_code($text('species'))) === null) {
        $errors['species'] = 'Choose the kind of animal from the list.';
    }

    $choice = function (string $key, array $allowed, string $message) use ($text, &$errors): ?string {
        $value = $text($key);
        if ($value !== '' && !in_array($value, $allowed, true)) {
            $errors[$key] = $message;
        }
        return $value === '' ? null : $value;
    };
    $size = $choice('size', REPORT_SIZES, 'Choose a size from the list.');
    $sex = $choice('sex', ['male', 'female', 'unknown'], 'Choose Male, Female, or Unknown.');
    $collar = $choice('has_collar', ['yes', 'no', 'unknown'], 'Choose Yes, No, or Not sure.');

    $colours = [];
    foreach (['primary_color', 'secondary_color'] as $key) {
        $colours[$key] = null;
        if ($text($key) !== '' && ($colours[$key] = colour_name_for($text($key))) === null) {
            $errors[$key] = 'Choose a colour from the list.';
        }
    }

    $date = $text('incident_date');
    if ($date !== '' && !is_valid_date($date)) {
        $errors['incident_date'] = 'Enter a valid date.';
    } elseif ($date !== '' && $date > app_today()) {
        $errors['incident_date'] = 'The date cannot be in the future.';
    }
    $time = $text('incident_time');
    if ($time !== '' && preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time) !== 1) {
        $errors['incident_time'] = 'Enter a time such as 07:30.';
    }

    // A place, if given, is one from the lists — and a city must be in its area.
    $area = $text('area_code');
    $city = $text('city_code');
    if ($city !== '') {
        $found = place_for($area, $city);
        if (is_string($found['error'] ?? null)) {
            $errors[$found['field']] = $found['error'];
        }
    } elseif ($area !== '') {
        $exists = db()->prepare('SELECT 1 FROM ph_areas WHERE area_code = :code');
        $exists->execute([':code' => $area]);
        if ($exists->fetchColumn() === false) {
            $errors['area_code'] = 'Choose a province, or Metro Manila, from the list.';
        }
    }

    $lat = $v['lat'] ?? null;
    $lng = $v['lng'] ?? null;
    $hasLat = $lat !== null && $lat !== '';
    $hasLng = $lng !== null && $lng !== '';
    if ($hasLat !== $hasLng || ($hasLat && (!is_numeric($lat) || !is_numeric($lng)))) {
        $errors['lat'] = 'That map pin is not a valid position.';
    } elseif ($hasLat && !inside_philippines((float) $lat, (float) $lng)) {
        $errors['lat'] = 'Place the pin inside the Philippines, or remove it.';
    }

    if ($errors !== []) {
        json_error(reset($errors), 422, ['fields' => $errors]);
    }

    return [
        'category_id' => $categoryId,
        'pet_name' => $orNull(meaningful_text($text('pet_name'))),
        'breed' => $orNull(meaningful_text($text('breed'))),
        'pet_size' => $size,
        'pet_sex' => $sex,
        'primary_color' => $colours['primary_color'],
        'secondary_color' => $colours['secondary_color'],
        'distinct_features' => $orNull($text('distinct_features')),
        'description' => $orNull($text('description')),
        'has_collar' => $collar,
        'pet_condition' => $orNull($text('condition')),
        'incident_date' => $orNull($date),
        'incident_time' => $orNull($time),
        'location_label' => $orNull($text('location_label')),
        'area_code' => $orNull($area),
        'city_code' => $orNull($city),
        'latitude' => $hasLat ? (float) $lat : null,
        'longitude' => $hasLng ? (float) $lng : null,
        'allow_platform_contact' => array_key_exists('allow_platform_contact', $v) ? (!empty($v['allow_platform_contact']) ? 1 : 0) : 1,
        'show_email' => !empty($v['show_email']) ? 1 : 0,
    ];
}

/** A draft in the API's report field names, so the form reads it like a report. */
function draft_shape(array $row): array
{
    return [
        'draft_id' => (int) $row['draft_id'],
        'report_type' => $row['report_type'],
        'species' => $row['species'],
        'pet_name' => $row['pet_name'],
        'breed' => $row['breed'],
        'size' => $row['pet_size'],
        'sex' => $row['pet_sex'],
        'primary_color' => $row['primary_color'],
        'secondary_color' => $row['secondary_color'],
        'distinct_features' => $row['distinct_features'],
        'description' => $row['description'],
        'has_collar' => $row['has_collar'],
        'condition' => $row['pet_condition'],
        'incident_date' => $row['incident_date'],
        'incident_time' => $row['incident_time'],
        'location_label' => $row['location_label'],
        'area_code' => $row['area_code'],
        'area_name' => $row['area_name'] ?? null,
        'city_code' => $row['city_code'],
        'city_name' => $row['city_name'] ?? null,
        'lat' => $row['latitude'] === null ? null : (float) $row['latitude'],
        'lng' => $row['longitude'] === null ? null : (float) $row['longitude'],
        'allow_platform_contact' => (bool) $row['allow_platform_contact'],
        'show_email' => (bool) $row['show_email'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
}
