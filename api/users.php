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
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/tokens.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/mail_messages.php';

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

/**
 * Every account. Any administrator: the Overview and Records pages name the
 * people behind reports and flags. Contact details only with manage_accounts
 * (Manager and above) — a Moderator needs to know who, not how to reach them.
 */
function users_list(): never
{
    $viewer = require_role('admin');
    $withContact = user_can($viewer, 'manage_accounts');

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
        "SELECT user_id, first_name, last_name, full_name, email, contact_number, role, admin_level,
                account_status, preferred_location, created_at
           FROM users
           {$clause}
           ORDER BY full_name"
    );
    $statement->execute($params);

    json_response(['data' => array_map(
        fn ($row) => shape_user($row, $withContact, true),
        $statement->fetchAll()
    )]);
}

/**
 * One account.
 *
 * Any signed-in account may look one up — coordinators need the names of the
 * people on a case. Contact details are only included for staff and
 * administrators, who need them to coordinate a handover.
 */
/**
 * @param array<string, mixed> $extra Merged into the response. Used by
 *        profile_update() to report whether the email-change message actually
 *        went out, which the browser has to know in order to offer a retry.
 */
function user_detail(int $id, array $extra = []): never
{
    $viewer = require_login();

    $statement = db()->prepare(
        'SELECT user_id, first_name, last_name, full_name, email, contact_number, role, admin_level,
                account_status, preferred_location, created_at, email_verified_at, pending_email
           FROM users
          WHERE user_id = :id'
    );
    $statement->execute([':id' => $id]);
    $user = $statement->fetch();

    if (!$user) {
        json_error('That account does not exist.', 404);
    }

    // Coordinators arrange handovers; Managers and above manage accounts. A
    // Moderator is an administrator without either job (Correction 6).
    $privileged = $viewer['role'] === 'staff'
        || user_can($viewer, 'manage_accounts')
        || (int) $viewer['user_id'] === $id;

    json_response(['data' => shape_user($user, $privileged, $viewer['role'] === 'admin')] + $extra);
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

    // The same rule as registration (helpers.php), so a name refused there
    // cannot be saved here afterwards. Two parts since migration 008; the
    // database derives full_name from them.
    [$firstName, $firstError] = validate_name_part((string) ($body['first_name'] ?? ''), 'first');
    if ($firstError !== null) {
        $errors['first_name'] = $firstError;
    }
    [$lastName, $lastError] = validate_name_part((string) ($body['last_name'] ?? ''), 'last');
    if ($lastError !== null) {
        $errors['last_name'] = $lastError;
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

    // For the greeting in the email-change message. The same value the
    // database generates into users.full_name from the two parts.
    $fullName = $firstName . ' ' . $lastName;

    // The address is NOT changed here.
    //
    // A verified address is the only way back into an account: it is where a
    // password reset goes. Letting the profile form replace it with an
    // unverified one means a typo locks somebody out of their own account, and
    // means anyone who borrows an unlocked laptop can move the account
    // somewhere they control.
    //
    // So the new address becomes `pending_email`, a link goes to it, and the
    // current one keeps working until somebody proves they can read the new
    // one. api/auth.php's verify-email endpoint is what finally moves it.
    $pendingChange = null;

    if ($email !== '' && $email !== normalise_email($user['email'])) {
        $taken = db()->prepare('SELECT 1 FROM users WHERE email = :email AND user_id <> :id');
        $taken->execute([':email' => $email, ':id' => $user['user_id']]);

        if ($taken->fetchColumn()) {
            // The same words the registration form uses for the same
            // situation. This one is reachable only by somebody already signed
            // in, about their own account, so it reveals nothing they could
            // not learn by trying to register.
            json_error('Please check the highlighted fields.', 422, [
                'fields' => ['email' => 'An account already uses that email address.'],
            ]);
        }

        $pendingChange = $email;
    }

    $statement = db()->prepare(
        'UPDATE users
            SET first_name = :first_name,
                last_name = :last_name,
                contact_number = :phone,
                preferred_location = :location,
                notify_matches = :matches,
                notify_status = :status,
                notify_staff = :staff
          WHERE user_id = :id'
    );

    try {
        $statement->execute([
            ':first_name' => $firstName,
            ':last_name' => $lastName,
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

    // Now the address, if one was asked for. After the rest is saved, so a mail
    // server having a bad morning does not also lose the name and phone number
    // the person just corrected.
    $emailSent = null;

    if ($pendingChange !== null) {
        $pending = db()->prepare('UPDATE users SET pending_email = :email WHERE user_id = :id');
        $pending->execute([':email' => $pendingChange, ':id' => $id]);

        $token = token_issue((int) $id, 'email_change', $pendingChange);
        $emailSent = true;

        try {
            send_mail(
                $pendingChange,
                $fullName,
                'Confirm your new Paws&Found email address',
                mail_body_email_change($fullName, $token),
                mail_text_email_change($fullName, $token)
            );
        } catch (MailFailure $failure) {
            error_log('[pawsandfound] email-change mail for user ' . $id . ' failed: ' . $failure->getMessage());
            $emailSent = false;
        }
    }

    // Which kind of change, never the values: a name or a phone number in the
    // activity log would be a second copy of personal data nobody needs.
    activity_log($id, 'profile_updated', 'user', $id);
    if ($pendingChange !== null) {
        activity_log($id, 'email_change_requested', 'user', $id);
    }

    user_detail($id, ['email_change_sent' => $emailSent]);
}

/**
 * Change a role, an administrator level, or an account's status.
 *
 * Who may do what (Correction 6; ADMIN_CAPABILITIES in helpers.php):
 *
 *   suspend, reinstate, unlock a customer or coordinator   manage_accounts  (Manager+)
 *   change any role, set an administrator level             manage_admins    (Super Administrator)
 *   anything at all to another administrator's account     manage_admins    (Super Administrator)
 *   anything to your own account                            nobody
 *
 * A role and its level are one change: an administrator always has a level
 * and nobody else has one (chk_users_admin_level). Promoting to administrator
 * needs a level chosen on purpose — nobody becomes a Super Administrator by
 * default — and demoting from administrator clears it.
 *
 * THE LAST SUPER ADMINISTRATOR. The system must never be left without an
 * active one. Nobody may change their own account, and only a Super
 * Administrator may change an administrator, so the one danger left is two
 * Super Administrators demoting each other at the same moment: each sees the
 * other still there, and both succeed. So the decision is taken inside a
 * transaction that first locks every active Super Administrator's row, the
 * acting one's and the target's, in one order (FOR UPDATE). A second request
 * waits for the first to commit, then re-reads the actor — who may no longer
 * be a Super Administrator — and the count, from the rows as they now are.
 */
function user_update(int $id): never
{
    $admin = require_role('admin');
    $body = request_body();

    // An administrator must not be able to lock themselves out, which is what
    // demoting or suspending your own account would do.
    if ((int) $admin['user_id'] === $id) {
        json_error('You cannot change your own role, administrator level or account status.', 422);
    }

    $changesRole = array_key_exists('role', $body);
    $changesLevel = array_key_exists('admin_level', $body);
    $changesStatus = array_key_exists('account_status', $body);

    if (!$changesRole && !$changesLevel && !$changesStatus) {
        json_error('Nothing to change.', 422);
    }

    $requestedRole = $changesRole
        ? require_one_of(trim((string) $body['role']), ['user', 'staff', 'admin'], 'role')
        : null;

    // null is allowed only to clear it (a demotion); any string must be a level.
    $requestedLevel = null;
    if ($changesLevel && $body['admin_level'] !== null) {
        $requestedLevel = require_one_of(is_string($body['admin_level']) ? $body['admin_level'] : '',
            ADMIN_LEVELS, 'admin_level');
    }

    $newStatus = null;
    if ($changesStatus) {
        // 'locked' is missing from this list on purpose. Nobody chooses it: an
        // account arrives there by failing to sign in three times, and the only
        // way out is an administrator setting it back to active. Offering it
        // here would make it look like a punishment an administrator hands out,
        // which is what 'suspended' is for.
        $newStatus = require_one_of(trim((string) $body['account_status']), ['active', 'suspended'], 'account_status');

        // Suspending somebody needs a reason. It is the one administrator
        // action that takes a person's access away, and "suspended" with no
        // note leaves the next administrator — or the account holder asking
        // why — with nothing. Reinstating and unlocking take an optional note
        // instead: giving access back does not need defending, and forcing
        // prose every time is how note fields fill up with "ok".
        if ($newStatus === 'suspended' && blank_to_null($body['reason'] ?? null) === null) {
            json_error('Say why this account is being suspended.', 422, [
                'fields' => ['reason' => 'It goes in the audit log, next to your name.'],
            ]);
        }
    }

    // Before anything is read: roles and levels are a Super Administrator's,
    // status a Manager's. Checked again below against the locked rows.
    if (($changesRole || $changesLevel) && !user_can($admin, 'manage_admins')) {
        json_error('Only a Super Administrator can change roles or administrator levels.', 403, ['code' => 'admin_level']);
    }
    if ($changesStatus && !user_can($admin, 'manage_accounts')) {
        json_error('Your administrator level does not include managing accounts.', 403, ['code' => 'admin_level']);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        // Every active Super Administrator, then the actor and the target, all
        // locked in user_id order so two requests cannot lock them crosswise.
        $pdo->query("SELECT user_id FROM users
                      WHERE role = 'admin' AND admin_level = 'super_admin' AND account_status = 'active'
                      ORDER BY user_id FOR UPDATE")->fetchAll();
        $lock = $pdo->prepare('SELECT user_id, email, role, admin_level, account_status
                                 FROM users WHERE user_id IN (:actor, :target) ORDER BY user_id FOR UPDATE');
        $lock->execute([':actor' => (int) $admin['user_id'], ':target' => $id]);
        $rows = [];
        foreach ($lock->fetchAll() as $row) {
            $rows[(int) $row['user_id']] = $row;
        }

        $before = $rows[$id] ?? null;
        if ($before === null) {
            json_error('That account does not exist.', 404);
        }

        // The actor as they are now, under the lock — not as they were when
        // this request began. A Super Administrator demoted a moment ago by
        // somebody else is not one any more.
        $actor = $rows[(int) $admin['user_id']] ?? null;
        $actorNow = $actor === null || $actor['account_status'] !== 'active' ? [] : $actor;
        if (($changesRole || $changesLevel || $before['role'] === 'admin') && !user_can($actorNow, 'manage_admins')) {
            json_error($before['role'] === 'admin' && !$changesRole && !$changesLevel
                ? "Only a Super Administrator can manage another administrator's account."
                : 'Only a Super Administrator can change roles or administrator levels.',
                403, ['code' => 'admin_level']);
        }
        if ($changesStatus && !user_can($actorNow, 'manage_accounts')) {
            json_error('Your administrator level does not include managing accounts.', 403, ['code' => 'admin_level']);
        }

        // The role and level this account will have.
        $newRole = $requestedRole ?? $before['role'];
        if ($newRole === 'admin') {
            $newLevel = $changesLevel ? $requestedLevel : ($before['role'] === 'admin' ? $before['admin_level'] : null);
            if ($newLevel === null) {
                json_error('Choose the administrator level: moderator, manager or super administrator.', 422, [
                    'fields' => ['admin_level' => 'An administrator needs a level.'],
                ]);
            }
        } else {
            if ($requestedLevel !== null) {
                json_error('Only an administrator has an administrator level.', 422, [
                    'fields' => ['admin_level' => 'Leave it empty unless the role is Administrator.'],
                ]);
            }
            $newLevel = null;
        }
        $statusAfter = $newStatus ?? $before['account_status'];

        // Never no active Super Administrator. Counted from the locked rows.
        $wasActiveSuper = $before['role'] === 'admin' && $before['admin_level'] === 'super_admin'
            && $before['account_status'] === 'active';
        $staysActiveSuper = $newRole === 'admin' && $newLevel === 'super_admin' && $statusAfter === 'active';
        if ($wasActiveSuper && !$staysActiveSuper) {
            $others = $pdo->prepare("SELECT COUNT(*) FROM users
                                      WHERE role = 'admin' AND admin_level = 'super_admin'
                                        AND account_status = 'active' AND user_id <> :id");
            $others->execute([':id' => $id]);
            if ((int) $others->fetchColumn() === 0) {
                json_error('This is the last active Super Administrator. Make another account a Super Administrator first.',
                    409, ['code' => 'last_super_admin']);
            }
        }

        $roleChanged = $newRole !== $before['role'];
        $levelChanged = $newLevel !== $before['admin_level'];

        // One statement, so the CHECK never sees a role without its level.
        $pdo->prepare('UPDATE users SET role = :role, admin_level = :level, account_status = :status WHERE user_id = :id')
            ->execute([':role' => $newRole, ':level' => $newLevel, ':status' => $statusAfter, ':id' => $id]);

        // Which sessions end, and why.
        //   into a privileged role (customer -> coordinator, anyone -> admin):
        //     role_promoted — the open sessions would otherwise all become
        //     privileged together, and a privileged account keeps one.
        //   an administrator's level changes, or the administrator role is
        //     removed: privilege_changed — a browser must not keep a screen
        //     built for powers it no longer has (or has newly).
        //   a coordinator stepped down to customer: nothing, as before.
        $endReason = null;
        if ($roleChanged && $newRole !== 'user' && ($before['role'] === 'user' || $newRole === 'admin')) {
            $endReason = 'role_promoted';
        } elseif ($before['role'] === 'admin' && ($roleChanged || $levelChanged)) {
            $endReason = 'privilege_changed';
        }
        if ($endReason !== null) {
            $pdo->prepare('UPDATE users SET session_version = session_version + 1 WHERE user_id = :id')
                ->execute([':id' => $id]);
            end_open_sessions($id, $endReason);
        }

        // Suspended: every session the account has open ends, and its records
        // say why. current_user() would refuse them on their next request
        // anyway; this is what makes the Sessions log agree straight away.
        if ($newStatus === 'suspended' && $before['account_status'] !== 'suspended') {
            end_open_sessions($id, 'account_suspended');
        }

        // Reactivating a locked account is the unlock, so the counter that
        // locked it has to go with it. Leaving the row behind would lock the
        // account again on the very next failed attempt, which is not what
        // "unlocked" means to the person who did it.
        if ($newStatus === 'active' && $before['account_status'] === 'locked') {
            clear_login_attempts($before['email']);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    // Logged after the change is committed, so the trail records what happened
    // rather than what was attempted. A level travels with its role.
    $describe = fn (string $role, ?string $level) => $role . ($level === null ? '' : " ({$level})");
    if ($roleChanged) {
        $detail = $describe($before['role'], $before['admin_level']) . ' -> ' . $describe($newRole, $newLevel);
        audit_log('role_changed', (int) $admin['user_id'], $admin['email'], 'user', $id, 'success', $detail);
        activity_log((int) $admin['user_id'], 'role_changed', 'user', $id, $detail);
    } elseif ($levelChanged) {
        $detail = "{$before['admin_level']} -> {$newLevel}";
        audit_log('admin_level_changed', (int) $admin['user_id'], $admin['email'], 'user', $id, 'success', $detail);
        activity_log((int) $admin['user_id'], 'admin_level_changed', 'user', $id, $detail);
    }

    if ($newStatus !== null && $newStatus !== $before['account_status']) {
        $action = match (true) {
            $newStatus === 'suspended' => 'account_suspended',
            $before['account_status'] === 'locked' => 'account_unlocked',
            default => 'account_reinstated',
        };

        $reason = blank_to_null($body['reason'] ?? null);
        audit_log($action, (int) $admin['user_id'], $admin['email'], 'user', $id, 'success',
            "{$before['account_status']} -> {$newStatus}" . ($reason === null ? '' : ": {$reason}"));
        // The administrator's own trail: what they did, not why (the reason
        // is in the audit row above, where it belongs).
        activity_log((int) $admin['user_id'], 'account_status_changed', 'user', $id,
            "{$before['account_status']} -> {$newStatus}");
    }

    user_detail($id);
}

/**
 * A user row as JSON. Contact details only when the viewer should see them;
 * an administrator's level only to another administrator.
 */
function shape_user(array $row, bool $includeContact = true, bool $includeAdminLevel = false): array
{
    $user = [
        'user_id' => (int) $row['user_id'],
        'first_name' => $row['first_name'],
        'last_name' => $row['last_name'],
        'full_name' => $row['full_name'],
        'role' => $row['role'],
        'account_status' => $row['account_status'],
        'preferred_location' => $row['preferred_location'],
        'created_at' => $row['created_at'],
    ];

    if ($includeAdminLevel) {
        $user['admin_level'] = $row['admin_level'] ?? null;
    }

    if ($includeContact) {
        $user['email'] = $row['email'];
        $user['contact_number'] = $row['contact_number'];
        // Both are about the person's own address, so they travel with the
        // contact details rather than being public. The profile needs them to
        // show "awaiting verification" instead of pretending the change is
        // already done.
        $user['email_verified'] = ($row['email_verified_at'] ?? null) !== null;
        $user['pending_email'] = $row['pending_email'] ?? null;
    }

    return $user;
}
