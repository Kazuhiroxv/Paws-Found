<?php
/**
 * Authentication: sign in, sign out, and "who am I".
 *
 * Passwords are never compared with `===`. They are checked with
 * password_verify() against the bcrypt hash in the database, which is both
 * correct and resistant to timing attacks.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function handle_auth(string $method, ?string $action): never
{
    if ($method === 'POST' && $action === 'login') {
        auth_login();
    }

    if ($method === 'POST' && $action === 'register') {
        auth_register();
    }

    if ($method === 'POST' && $action === 'logout') {
        auth_logout();
    }

    if ($method === 'GET' && $action === 'me') {
        auth_me();
    }

    json_error('No such endpoint.', 404);
}

/**
 * What the person is told when the account is locked.
 *
 * The same sentence whether or not the address belongs to an account, because
 * the counter behind it is kept per address typed rather than per account.
 */
const LOCKED_MESSAGE = 'This account is locked after '
    . MAX_LOGIN_ATTEMPTS
    . ' failed sign-in attempts. An administrator has to unlock it before you can sign in again.';

function auth_login(): never
{
    $body = request_body();
    $email = trim((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    if ($email === '' || $password === '') {
        json_error('Enter your email address and password.', 422);
    }

    // The counter for this address. It exists whether or not an account does,
    // which is the whole reason the messages below can be honest about how many
    // attempts are left without confirming that the address is registered.
    $attempts = login_attempts_for($email);

    // Checked BEFORE the password is verified. This is the line that makes the
    // lock a lock: typing the correct password afterwards does not lift it, it
    // just arrives at this same refusal.
    if ((int) $attempts['failed_count'] >= MAX_LOGIN_ATTEMPTS) {
        audit_log('login_failed', null, $email, 'user', $attempts['user_id'] ? (int) $attempts['user_id'] : null,
            'failure', 'attempted while locked');

        json_error(LOCKED_MESSAGE, 403, ['locked' => true, 'attempts_remaining' => 0]);
    }

    $statement = db()->prepare(
        'SELECT user_id, full_name, email, password_hash, role, account_status
           FROM users
          WHERE email = :email'
    );
    $statement->execute([':email' => $email]);
    $user = $statement->fetch();

    // One message for "no such account" and "wrong password" on purpose. Telling
    // them apart would confirm which email addresses are registered.
    if (!$user || !password_verify($password, $user['password_hash'])) {
        login_failed($email, $user ? (int) $user['user_id'] : null);
    }

    if ($user['account_status'] === 'suspended') {
        // Actor NULL for the same reason as the failed attempts above: the
        // password was right, but that still does not prove who typed it.
        audit_log('login_failed', null, $email, 'user', (int) $user['user_id'],
            'failure', 'account suspended');

        json_error('This account has been suspended. Contact an administrator.', 403);
    }

    // Belt and braces: the counter above is the usual way in here, but if a
    // lock were ever cleared without the account being reactivated, the account
    // state itself still refuses.
    if ($user['account_status'] === 'locked') {
        audit_log('login_failed', null, $email, 'user', (int) $user['user_id'],
            'failure', 'account locked');

        json_error(LOCKED_MESSAGE, 403, ['locked' => true, 'attempts_remaining' => 0]);
    }

    // Signing in successfully is what clears the counter. Nothing else does,
    // apart from an administrator unlocking the account.
    clear_login_attempts($email);

    start_session();

    // A new session id on sign-in, so a session cookie captured beforehand
    // cannot be reused afterwards (session fixation).
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['user_id'];

    audit_log('login', (int) $user['user_id'], $user['email'], 'user', (int) $user['user_id']);

    json_response([
        // The session id just changed, so the token paired with it changes too.
        // Returned here so the browser does not have to ask for it before its
        // next action.
        'csrf_token' => rotate_csrf_token(),
        'user' => [
            'user_id' => (int) $user['user_id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ],
    ]);
}

// -----------------------------------------------------------------------------
// The three-attempt lock
// -----------------------------------------------------------------------------

/**
 * The counter row for an address, creating it if this is the first time the
 * address has been seen.
 *
 * Keyed by the address that was typed rather than by the account, so an address
 * belonging to nobody is counted exactly like one that does. That symmetry is
 * what stops the "2 attempts left" message from being an account-enumeration
 * oracle: it is said to everybody, in the same words, at the same moment.
 */
function login_attempts_for(string $email): array
{
    $select = db()->prepare(
        'SELECT attempt_id, email, user_id, failed_count, locked_at
           FROM login_attempts
          WHERE email = :email'
    );
    $select->execute([':email' => $email]);
    $row = $select->fetch();

    if ($row) {
        return $row;
    }

    return ['attempt_id' => null, 'email' => $email, 'user_id' => null,
            'failed_count' => 0, 'locked_at' => null];
}

/**
 * Record a failed sign-in, lock the account if that was the last attempt, and
 * answer. Never returns.
 *
 * The count is written before the response is chosen, so the number in the
 * message and the number in the database are the same number.
 */
function login_failed(string $email, ?int $userId): never
{
    // One statement does insert-or-increment. Two statements — SELECT then
    // UPDATE — would let two simultaneous attempts both read 1 and both write
    // 2, which is a free extra guess.
    $statement = db()->prepare(
        'INSERT INTO login_attempts (email, user_id, failed_count, first_failed_at, last_failed_at)
              VALUES (:email, :user_id, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
              failed_count = failed_count + 1,
              last_failed_at = NOW(),
              user_id = COALESCE(VALUES(user_id), user_id)'
    );
    $statement->execute([':email' => $email, ':user_id' => $userId]);

    $count = (int) login_attempts_for($email)['failed_count'];
    $remaining = max(0, MAX_LOGIN_ATTEMPTS - $count);

    // The actor is NULL on purpose. A failed sign-in tells us which account was
    // being aimed at — that is the target — but not who was doing the aiming.
    // Naming the account holder as the actor would put "Kenneth Villanueva
    // failed to sign in" in the log when it may well have been somebody else.
    audit_log('login_failed', null, $email, $userId ? 'user' : null, $userId, 'failure',
        "failed attempt {$count} of " . MAX_LOGIN_ATTEMPTS);

    if ($count < MAX_LOGIN_ATTEMPTS) {
        json_error(attempts_message($remaining), 401, [
            'attempts_remaining' => $remaining,
            'locked' => false,
        ]);
    }

    // The third failure. Mark the moment on the counter either way, and move
    // the account itself to 'locked' when there is an account — which is what
    // ends every session it has open, on every device, because current_user()
    // refuses anything that is not active.
    $lock = db()->prepare('UPDATE login_attempts SET locked_at = NOW() WHERE email = :email');
    $lock->execute([':email' => $email]);

    if ($userId !== null) {
        $update = db()->prepare(
            "UPDATE users SET account_status = 'locked' WHERE user_id = :id AND account_status = 'active'"
        );
        $update->execute([':id' => $userId]);

        audit_log('account_locked', null, $email, 'user', $userId, 'success',
            MAX_LOGIN_ATTEMPTS . ' failed sign-in attempts');
    }

    json_error(LOCKED_MESSAGE, 403, ['attempts_remaining' => 0, 'locked' => true]);
}

/** The refusal, with the count of what is left said out loud. */
function attempts_message(int $remaining): string
{
    if ($remaining === 1) {
        return 'That email address and password do not match. This is the last attempt — '
             . 'one more failure locks the account, and an administrator will have to unlock it.';
    }

    return "That email address and password do not match. {$remaining} attempts remain "
         . 'before the account is locked.';
}

function auth_register(): never
{
    $body = request_body();
    $fullName = trim((string) ($body['full_name'] ?? ''));
    $email = trim((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $contact = trim((string) ($body['contact_number'] ?? ''));

    // Every problem is collected before answering, so the form can mark all of
    // the bad fields at once instead of revealing them one submission at a time.
    $errors = [];

    if ($fullName === '') {
        $errors['full_name'] = 'Enter your name.';
    } elseif (mb_strlen($fullName) > 120) {
        $errors['full_name'] = 'That name is too long (120 characters maximum).';
    }

    if ($email === '') {
        $errors['email'] = 'Enter your email address.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
        $errors['email'] = 'Enter a valid email address.';
    }

    if (strlen($password) < 8) {
        $errors['password'] = 'Use at least 8 characters.';
    } elseif (strlen($password) > 72) {
        // bcrypt ignores everything past 72 bytes, so a longer password would
        // not mean what the person choosing it thinks it means.
        $errors['password'] = 'Use 72 characters or fewer.';
    }

    if ($contact !== '' && mb_strlen($contact) > 30) {
        $errors['contact_number'] = 'That phone number is too long.';
    }

    // The privacy acknowledgement. Checked here and not only in the form,
    // because the form is not what creates the account — and a consent record
    // that a crafted request could skip would be worth nothing.
    if (($body['privacy_consent'] ?? false) !== true) {
        $errors['privacy_consent'] =
            'Please confirm you have read the Privacy Notice before creating an account.';
    }

    if ($errors !== []) {
        json_error('Please check the highlighted fields.', 422, ['fields' => $errors]);
    }

    // The role is never read from the request body. A new account is always an
    // ordinary user; accepting a role here would let anyone register as an
    // administrator by adding one line to the request.
    $statement = db()->prepare(
        "INSERT INTO users (full_name, email, password_hash, contact_number, role, account_status)
              VALUES (:full_name, :email, :password_hash, :contact_number, 'user', 'active')"
    );

    // The account and the record of what they agreed to are written together.
    // An account with no consent row, or a consent row with no account, would
    // each be a worse outcome than the registration simply failing.
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $statement->execute([
            ':full_name' => $fullName,
            ':email' => $email,
            // Never the password itself. PASSWORD_DEFAULT is bcrypt here, the
            // same algorithm the seeded accounts were hashed with.
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ':contact_number' => $contact === '' ? null : $contact,
        ]);

        $userId = (int) $pdo->lastInsertId();

        $consent = $pdo->prepare(
            'INSERT INTO privacy_consents (user_id, notice_version, ip_address)
                  VALUES (:user_id, :version, :ip)'
        );
        $consent->execute([
            ':user_id' => $userId,
            ':version' => PRIVACY_NOTICE_VERSION,
            ':ip' => client_ip(),
        ]);

        $pdo->commit();
    } catch (PDOException $exception) {
        $pdo->rollBack();

        // 23000 is the integrity-constraint class, which here can only be the
        // unique index on email. Letting the database decide closes the gap
        // between checking and inserting, where two people registering the same
        // address at the same moment would both pass a prior SELECT.
        if ($exception->getCode() === '23000') {
            json_error('An account already uses that email address.', 409, [
                'fields' => ['email' => 'An account already uses that email address.'],
            ]);
        }

        throw $exception;
    }

    // Registering signs you in, so nobody has to retype the password they just
    // chose. Same fresh session id as auth_login(), for the same reason.
    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;

    audit_log('register', $userId, $email, 'user', $userId);

    json_response([
        'csrf_token' => rotate_csrf_token(),
        'user' => [
            'user_id' => $userId,
            'full_name' => $fullName,
            'email' => $email,
            'role' => 'user',
        ],
    ], 201);
}

function auth_logout(): never
{
    // Read before the session is torn down: afterwards there is nobody left to
    // record as having signed out.
    $user = current_user();

    if ($user !== null) {
        audit_log('logout', (int) $user['user_id'], $user['email'], 'user', (int) $user['user_id']);
    }

    start_session();

    $_SESSION = [];

    // Clear the cookie too, or the browser keeps sending a dead session id.
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'],
            $params['secure'], $params['httponly']);
    }

    session_destroy();

    // A fresh session for whoever is now using this browser, with a token of
    // its own — otherwise the next person to sign in has no way to make the
    // request that signs them in.
    json_response(['ok' => true, 'csrf_token' => rotate_csrf_token()]);
}

function auth_me(): never
{
    $user = current_user();

    // This endpoint is also where the browser gets its CSRF token. The app
    // calls it on load, before it can possibly have anything to submit, so by
    // the time somebody presses a button the token is already in hand — even
    // when the answer is "nobody is signed in", because signing in is itself a
    // request that has to be verified.
    if ($user === null) {
        json_response(['user' => null, 'csrf_token' => csrf_token()]);
    }

    json_response([
        'csrf_token' => csrf_token(),
        'user' => [
            'user_id' => (int) $user['user_id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'contact_number' => $user['contact_number'],
            'role' => $user['role'],
            'preferred_location' => $user['preferred_location'],
            'notify_matches' => (bool) $user['notify_matches'],
            'notify_status' => (bool) $user['notify_status'],
            'notify_staff' => (bool) $user['notify_staff'],
        ],
    ]);
}
