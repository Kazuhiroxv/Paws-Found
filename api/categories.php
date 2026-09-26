<?php
/**
 * Pet categories — the species list an administrator manages.
 *
 * Reading is public: the report form and the Explore filters both need the
 * list before anyone signs in. Changing it is an administrator's job, and the
 * whole point of §4.3 of the project context — "manage pet categories" — is
 * that those changes are kept.
 *
 * A category is identified here by its code ('dog'), not by the number in the
 * primary key, because the code is what a report actually stores. Renaming a
 * category is therefore always safe.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function handle_categories(string $method, ?string $identifier): never
{
    if ($method === 'GET' && $identifier === null) {
        categories_list();
    }

    if ($method === 'POST' && $identifier === null) {
        category_create();
    }

    if ($identifier !== null && preg_match('/^[a-z0-9-]{1,30}$/', $identifier) === 1) {
        if ($method === 'PATCH') category_update($identifier);
        if ($method === 'DELETE') category_delete($identifier);
    }

    json_error('No such endpoint.', 404);
}

/**
 * The species list.
 *
 * By default only the active ones, because that is what a dropdown should
 * offer. `?all=1` returns every category with the number of reports filed
 * against it, which is what the administrator's screen needs in order to say
 * whether one can safely be removed. That view is administrators only — the
 * counts are management information, not something a visitor needs.
 */
function categories_list(): never
{
    $all = query_string_param('all') !== null;

    if (!$all) {
        $statement = db()->query(
            'SELECT category_id, category_code, category_name
               FROM pet_categories
              WHERE is_active = TRUE
              ORDER BY category_name'
        );

        json_response(['data' => array_map(fn ($c) => [
            'category_id' => (int) $c['category_id'],
            'code' => $c['category_code'],
            'label' => $c['category_name'],
        ], $statement->fetchAll())]);
    }

    require_role('admin');

    // One query rather than one per category: counting in a loop would issue a
    // query per row for a list that is only ever a handful long, but the join
    // is no harder to read and does not grow worse if the list does.
    $statement = db()->query(
        'SELECT c.category_id, c.category_code, c.category_name, c.is_active,
                COUNT(r.report_id) AS report_count
           FROM pet_categories c
      LEFT JOIN pet_reports r ON r.category_id = c.category_id
          GROUP BY c.category_id, c.category_code, c.category_name, c.is_active
          ORDER BY c.category_name'
    );

    json_response(['data' => array_map(fn ($c) => [
        'category_id' => (int) $c['category_id'],
        'code' => $c['category_code'],
        'label' => $c['category_name'],
        'is_active' => (bool) $c['is_active'],
        'report_count' => (int) $c['report_count'],
    ], $statement->fetchAll())]);
}

/**
 * Turn a label into the code reports will store.
 *
 * Readable on purpose: a report saying its species is 'guinea-pig' can be
 * understood by anyone reading the table, which a random identifier could not.
 */
function category_code_from(string $label): string
{
    $code = strtolower($label);
    $code = preg_replace('/[^a-z0-9]+/', '-', $code) ?? '';

    return trim($code, '-');
}

/** Reject a label that is empty or too long for the column. */
function validated_category_label(mixed $value): string
{
    $label = trim((string) $value);

    if ($label === '') {
        json_error('A category needs a name.', 422, ['fields' => ['label' => 'A category needs a name.']]);
    }

    if (mb_strlen($label) > 60) {
        json_error('That name is too long (60 characters maximum).', 422, [
            'fields' => ['label' => 'That name is too long (60 characters maximum).'],
        ]);
    }

    return $label;
}

function category_create(): never
{
    $admin = require_role('admin');

    $body = request_body();
    $label = validated_category_label($body['label'] ?? '');
    $code = category_code_from($label);

    if ($code === '') {
        json_error('That name cannot be used as a category.', 422, [
            'fields' => ['label' => 'Use at least one letter or number.'],
        ]);
    }

    $statement = db()->prepare(
        'INSERT INTO pet_categories (category_code, category_name, is_active)
              VALUES (:code, :name, TRUE)'
    );

    try {
        $statement->execute([':code' => $code, ':name' => $label]);
    } catch (PDOException $exception) {
        // The unique index on the code decides, rather than a prior SELECT,
        // so two administrators adding the same species at once cannot both
        // pass the check.
        if ($exception->getCode() === '23000') {
            json_error('There is already a category with that name.', 409, [
                'fields' => ['label' => 'There is already a category with that name.'],
            ]);
        }

        throw $exception;
    }

    // The species list is what every report form and every filter offers, so a
    // change to it is felt across the whole site by people who did not make it.
    // Unlike a report or a pairing, a category keeps no history of its own —
    // this row is the only record that it was ever added, renamed or removed.
    $newId = (int) db()->lastInsertId();
    audit_log('category_changed', (int) $admin['user_id'], $admin['email'],
        'category', $newId, 'success', "created: {$label}");

    json_response(['data' => [
        'category_id' => $newId,
        'code' => $code,
        'label' => $label,
        'is_active' => true,
        'report_count' => 0,
    ]], 201);
}

/**
 * Rename a category, or retire it.
 *
 * The code is never changed. Reports store it, so altering it would silently
 * detach every report already filed under this species.
 */
function category_update(string $code): never
{
    $admin = require_role('admin');

    $body = request_body();
    $category = find_category_or_404($code);

    $fields = [];
    $params = [':id' => $category['category_id']];

    if (array_key_exists('label', $body)) {
        $fields[] = 'category_name = :name';
        $params[':name'] = validated_category_label($body['label']);
    }

    if (array_key_exists('is_active', $body)) {
        $fields[] = 'is_active = :active';
        $params[':active'] = $body['is_active'] ? 1 : 0;
    }

    if ($fields === []) {
        json_error('Nothing to change.', 422);
    }

    $statement = db()->prepare(
        'UPDATE pet_categories SET ' . implode(', ', $fields) . ' WHERE category_id = :id'
    );
    $statement->execute($params);

    // What changed, in the words the administrator used, so the entry can be
    // read without looking anything else up.
    $what = [];
    if (array_key_exists('label', $body)) $what[] = "renamed to {$params[':name']}";
    if (array_key_exists('is_active', $body)) $what[] = $params[':active'] ? 'made active' : 'retired';

    audit_log('category_changed', (int) $admin['user_id'], $admin['email'],
        'category', (int) $category['category_id'], 'success',
        "{$category['category_name']}: " . implode(', ', $what));

    json_response(['data' => category_row($code)]);
}

/**
 * Remove a category outright.
 *
 * Refused while any report is filed under it. The database enforces the same
 * rule with ON DELETE RESTRICT; this check exists so the administrator is told
 * why, and how many reports are in the way, rather than being shown a server
 * error. Retiring the category is the safe alternative and is offered instead.
 */
function category_delete(string $code): never
{
    $admin = require_role('admin');

    $category = find_category_or_404($code);

    $used = db()->prepare('SELECT COUNT(*) FROM pet_reports WHERE category_id = :id');
    $used->execute([':id' => $category['category_id']]);
    $count = (int) $used->fetchColumn();

    if ($count > 0) {
        json_error(
            $count . ' report' . ($count === 1 ? '' : 's') .
            ' still use this category. Retire it instead of deleting it.',
            409
        );
    }

    $delete = db()->prepare('DELETE FROM pet_categories WHERE category_id = :id');
    $delete->execute([':id' => $category['category_id']]);

    audit_log('category_changed', (int) $admin['user_id'], $admin['email'],
        'category', (int) $category['category_id'], 'success',
        "deleted: {$category['category_name']}");

    // 200 with a small body rather than 204: json_response() always writes
    // one, and a 204 carrying content is not a 204.
    json_response(['ok' => true]);
}

function find_category_or_404(string $code): array
{
    $statement = db()->prepare(
        'SELECT category_id, category_code, category_name, is_active
           FROM pet_categories
          WHERE category_code = :code'
    );
    $statement->execute([':code' => $code]);
    $category = $statement->fetch();

    if (!$category) {
        json_error('That category does not exist.', 404);
    }

    return $category;
}

/** One category in the shape the administrator's screen reads. */
function category_row(string $code): array
{
    $statement = db()->prepare(
        'SELECT c.category_id, c.category_code, c.category_name, c.is_active,
                COUNT(r.report_id) AS report_count
           FROM pet_categories c
      LEFT JOIN pet_reports r ON r.category_id = c.category_id
          WHERE c.category_code = :code
          GROUP BY c.category_id, c.category_code, c.category_name, c.is_active'
    );
    $statement->execute([':code' => $code]);
    $row = $statement->fetch();

    return [
        'category_id' => (int) $row['category_id'],
        'code' => $row['category_code'],
        'label' => $row['category_name'],
        'is_active' => (bool) $row['is_active'],
        'report_count' => (int) $row['report_count'],
    ];
}
