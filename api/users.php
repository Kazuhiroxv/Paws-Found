<?php
/**
 * Accounts.
 *
 *   GET   /api/users        every account (administrators only)
 *   GET   /api/users/5      one account
 *   PATCH /api/users/5      change a role or suspend an account (administrators)
 *
 * Nothing here is public. A person's email and phone number are not browsing
 * material, so every route requires a signed-in account and the listing
 * requires an administrator.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function handle_users(string $method, ?string $identifier): never
{
    if ($method === 'GET' && $identifier === null) {
        users_list();
    }

    if (ctype_digit((string) $identifier)) {
        $id = (int) $identifier;

        if ($method === 'GET') user_detail($id);
        if ($method === 'PATCH') user_update($id);
    }

    // Your own details. Deliberately a separate route from PATCH /users/{id}:
    // that one is an administrator changing somebody else's role, this one is
    // a person editing their own contact details, and they must never be the
    // same endpoint.
    if ($method === 'PATCH' && $identifier === 'me') {
        profile_update();
    }

    json_error('No such endpoint.', 404);
}

function users_list(): never
{
    require_role('admin');

    $where = [];
    $params = [];

    $role = require_one_of(query_string_param('role'), ['user', 'staff', 'admin'], 'role');
    if ($role !== null) {
        $where[] = 'role = :role';
        $params[':role'] = $role;
    }

    $status = require_one_of(query_string_param('status'), ['active', 'suspended', 'locked'], 'status');
    if ($status !== null) {
        $where[] = 'account_status = :status';
        $params[':status'] = $status;
    }

    if (($search = query_string_param('q')) !== null) {
        // One placeholder per column: a native prepared statement binds each
        // marker exactly once.
        $where[] = '(full_name LIKE :q1 OR email LIKE :q2)';
        $params[':q1'] = '%' . $search . '%';
        $params[':q2'] = '%' . $search . '%';
    }

    $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

    $statement = db()->prepare(
        "SELECT user_id, full_name, email, contact_number, role, account_status,
                preferred_location, created_at
           FROM users
           {$clause}
           ORDER BY full_name"
    );
    $statement->execute($params);

    json_response(['data' => array_map('shape_user', $statement->fetchAll())]);
}

/**
 * One account.
 *
 * Any signed-in account may look one up — coordinators need the names of the
 * people on a case. Contact details are only included for staff and
 * administrators, who need them to coordinate a handover.
 */
function user_detail(int $id): never
{
    $viewer = require_login();

    $statement = db()->prepare(
        'SELECT user_id, full_name, email, contact_number, role, account_status,
                preferred_location, created_at
           FROM users
          WHERE user_id = :id'
    );
    $statement->execute([':id' => $id]);
    $user = $statement->fetch();

    if (!$user) {
        json_error('That account does not exist.', 404);
    }

    $privileged = in_array($viewer['role'], ['staff', 'admin'], true)
        || (int) $viewer['user_id'] === $id;

    json_response(['data' => shape_user($user, $privileged)]);
}

/**
 * Update the signed-in account's own details.
 *
 * The id comes from the session, never from the request, so this cannot be
 * pointed at somebody else's account. Role and account_status are not readable
 * here at all: an account may not promote or un-suspend itself.
 */
function profile_update(): never
{
    $user = require_login();
    $body = request_body();
    $id = (int) $user['user_id'];

    $errors = [];

    $fullName = trim((string) ($body['full_name'] ?? ''));
    if ($fullName === '') {
        $errors['full_name'] = 'Enter your name.';
    } elseif (mb_strlen($fullName) > 120) {
        $errors['full_name'] = 'That name is too long (120 characters maximum).';
    }

    $email = trim((string) ($body['email'] ?? ''));
    if ($email === '') {
        $errors['email'] = 'Enter your email address.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
        $errors['email'] = 'Enter a valid email address.';
    }

    $phone = trim((string) ($body['contact_number'] ?? ''));
    if (mb_strlen($phone) > 30) {
        $errors['contact_number'] = 'That phone number is too long.';
    }

    $location = trim((string) ($body['preferred_location'] ?? ''));
    if (mb_strlen($location) > 120) {
        $errors['preferred_location'] = 'That location is too long.';
    }

    if ($errors !== []) {
        json_error('Please check the highlighted fields.', 422, ['fields' => $errors]);
    }

    $statement = db()->prepare(
        'UPDATE users
            SET full_name = :name,
                email = :email,
                contact_number = :phone,
                preferred_location = :location,
                notify_matches = :matches,
                notify_status = :status,
                notify_staff = :staff
          WHERE user_id = :id'
    );

    try {
        $statement->execute([
            ':name' => $fullName,
            ':email' => $email,
            ':phone' => $phone === '' ? null : $phone,
            ':location' => $location === '' ? null : $location,
            // Absent means "leave as it is", so an update that only changes a
            // phone number does not silently switch every notification off.
            ':matches' => array_key_exists('notify_matches', $body) ? (int) (bool) $body['notify_matches'] : (int) $user['notify_matches'],
            ':status' => array_key_exists('notify_status', $body) ? (int) (bool) $body['notify_status'] : (int) $user['notify_status'],
            ':staff' => array_key_exists('notify_staff', $body) ? (int) (bool) $body['notify_staff'] : (int) $user['notify_staff'],
            ':id' => $id,
        ]);
    } catch (PDOException $exception) {
        // The unique index on email decides, so two people cannot claim the
        // same address by saving at the same moment.
        if ($exception->getCode() === '23000') {
            json_error('Another account already uses that email address.', 409, [
                'fields' => ['email' => 'Another account already uses that email address.'],
            ]);
        }

        throw $exception;
    }

    user_detail($id);
}

/** Change a role or suspend an account. Administrators only. */
function user_update(int $id): never
{
    $admin = require_role('admin');
    $body = request_body();

    // An administrator must not be able to lock themselves out, which is what
    // demoting or suspending your own account would do.
    if ((int) $admin['user_id'] === $id) {
        json_error('You cannot change your own role or suspend your own account.', 422);
    }

    // The current values, so the audit entries below can say what changed
    // rather than only what it changed to.
    $exists = db()->prepare('SELECT user_id, email, role, account_status FROM users WHERE user_id = :id');
    $exists->execute([':id' => $id]);
    $before = $exists->fetch();

    if (!$before) {
        json_error('That account does not exist.', 404);
    }

    $sets = [];
    $params = [':id' => $id];
    $newRole = null;
    $newStatus = null;

    if (array_key_exists('role', $body)) {
        $newRole = require_one_of(trim((string) $body['role']), ['user', 'staff', 'admin'], 'role');
        $sets[] = 'role = :role';
        $params[':role'] = $newRole;
    }

    if (array_key_exists('account_status', $body)) {
        // 'locked' is missing from this list on purpose. Nobody chooses it: an
        // account arrives there by failing to sign in three times, and the only
        // way out is an administrator setting it back to active. Offering it
        // here would make it look like a punishment an administrator hands out,
        // which is what 'suspended' is for.
        $newStatus = require_one_of(trim((string) $body['account_status']), ['active', 'suspended'], 'account_status');
        $sets[] = 'account_status = :status';
        $params[':status'] = $newStatus;
    }

    if ($sets === []) {
        json_error('Nothing to change.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $statement = $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE user_id = :id');
        $statement->execute($params);

        // Reactivating a locked account is the unlock, so the counter that
        // locked it has to go with it. Leaving the row behind would lock the
        // account again on the very next failed attempt, which is not what
        // "unlocked" means to the person who did it.
        if ($newStatus === 'active' && $before['account_status'] === 'locked') {
            clear_login_attempts($before['email']);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    // Logged after the change is committed, so the trail records what happened
    // rather than what was attempted.
    if ($newRole !== null && $newRole !== $before['role']) {
        audit_log('role_changed', (int) $admin['user_id'], $admin['email'], 'user', $id, 'success',
            "{$before['role']} -> {$newRole}");
    }

    if ($newStatus !== null && $newStatus !== $before['account_status']) {
        $action = match (true) {
            $newStatus === 'suspended' => 'account_suspended',
            $before['account_status'] === 'locked' => 'account_unlocked',
            default => 'account_reinstated',
        };

        audit_log($action, (int) $admin['user_id'], $admin['email'], 'user', $id, 'success',
            "{$before['account_status']} -> {$newStatus}");
    }

    user_detail($id);
}

/** A user row as JSON. Contact details only when the viewer should see them. */
function shape_user(array $row, bool $includeContact = true): array
{
    $user = [
        'user_id' => (int) $row['user_id'],
        'full_name' => $row['full_name'],
        'role' => $row['role'],
        'account_status' => $row['account_status'],
        'preferred_location' => $row['preferred_location'],
        'created_at' => $row['created_at'],
    ];

    if ($includeContact) {
        $user['email'] = $row['email'];
        $user['contact_number'] = $row['contact_number'];
    }

    return $user;
}
