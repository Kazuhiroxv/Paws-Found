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
require_once __DIR__ . '/tokens.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/mail_messages.php';

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

    // Correction 7: "I have been shown the updated Privacy Notice."
    if ($method === 'POST' && $action === 'privacy-acknowledgement') {
        auth_acknowledge_privacy_notice();
    }

    // Proving an address, and getting back in without an administrator.
    if ($method === 'POST' && $action === 'verify-email') {
        auth_verify_email();
    }

    if ($method === 'POST' && $action === 'resend-verification') {
        auth_resend_verification();
    }

    if ($method === 'POST' && $action === 'forgot-password') {
        auth_forgot_password();
    }

    if ($method === 'POST' && $action === 'reset-password') {
        auth_reset_password();
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
        'SELECT user_id, full_name, email, password_hash, role, account_status,
                email_verified_at, session_version
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

        json_error('This account has been suspended by an administrator.', 403, ['code' => 'account_suspended']);
    }

    // Belt and braces: the counter above is the usual way in here, but if a
    // lock were ever cleared without the account being reactivated, the account
    // state itself still refuses.
    if ($user['account_status'] === 'locked') {
        audit_log('login_failed', null, $email, 'user', (int) $user['user_id'],
            'failure', 'account locked');

        json_error(LOCKED_MESSAGE, 403, ['locked' => true, 'attempts_remaining' => 0]);
    }

    // An address nobody has proved belongs to them cannot sign in.
    //
    // Checked AFTER the password, on purpose: answering before it would tell
    // anybody who typed an address whether an account exists and is pending,
    // which is the enumeration the whole sign-in path is careful to avoid.
    // Getting this far already required the correct password.
    if ($user['email_verified_at'] === null) {
        clear_login_attempts($email);

        json_error('Check your email and follow the verification link before signing in.', 403, [
            'code' => 'verification_required',
            'verification_required' => true,
        ]);
    }

    // Signing in successfully is what clears the counter. Nothing else does,
    // apart from an administrator unlocking the account.
    clear_login_attempts($email);

    // One session at a time for a privileged account. A coordinator or an
    // administrator signing in starts a new generation, so a session left open
    // on another machine stops working on its next request (current_user()
    // compares the numbers). A customer keeps every device: a phone and a
    // laptop at once is ordinary, and nothing they can reach needs the limit.
    //
    // Only here, after every refusal above, so a wrong password, a locked or
    // suspended account or an unverified address never ends anybody's session.
    // LAST_INSERT_ID(expr) hands this connection the value it wrote, so two
    // sign-ins at the same moment cannot both keep the winning number.
    $sessionVersion = (int) $user['session_version'];
    $privileged = in_array($user['role'], PRIVILEGED_ROLES, true);

    if ($privileged) {
        db()->prepare('UPDATE users SET session_version = LAST_INSERT_ID(session_version + 1) WHERE user_id = :id')
            ->execute([':id' => $user['user_id']]);
        $sessionVersion = (int) db()->lastInsertId();

        // The session records say so too, so the device that was replaced is
        // told why, and the Sessions log shows which one ended and when.
        end_open_sessions((int) $user['user_id'], 'new_privileged_login');
    }

    start_session();

    // A new session id on sign-in, so a session cookie captured beforehand
    // cannot be reused afterwards (session fixation).
    session_regenerate_id(true);
    session_started_now();
    // Whatever ended this browser's last session is old news now.
    unset($_SESSION['session_ended']);
    $_SESSION['user_id'] = (int) $user['user_id'];
    // The generation this session belongs to. A password reset bumps the
    // column and every session carrying an older number stops working, without
    // anybody having to find and delete session files on disk.
    $_SESSION['session_version'] = $sessionVersion;

    // Its record: account, address, browser, start (Correction 5). Known in
    // the logs by a random reference, never by the session id above.
    session_record_start((int) $user['user_id'], $sessionVersion);

    audit_log('login', (int) $user['user_id'], $user['email'], 'user', (int) $user['user_id'], 'success',
        $privileged ? 'earlier sessions for this account ended' : null);
    activity_log((int) $user['user_id'], 'login', 'user', (int) $user['user_id']);

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
        // Whether any earlier session for this account stopped working. True
        // for every privileged sign-in, because the server cannot tell whether
        // another session was open; the wording on the page says "any".
        'previous_sessions_ended' => $privileged,
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

        // Every session it has open ends here, on every device.
        // The generation moves on too (Correction 6A), so a session that made
        // no request while locked does not come back to life when an
        // administrator unlocks the account; its record already says why.
        if ($update->rowCount() > 0) {
            db()->prepare('UPDATE users SET session_version = session_version + 1 WHERE user_id = :id')->execute([':id' => $userId]);
            end_open_sessions($userId, 'account_locked');
        }

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

    // Before anything is validated or written. Rate limiting answers "how
    // often", Turnstile answers "is this a person" — related, but not the same
    // question, and a script that solves one does not solve the other.
    rate_limit_or_fail('register', 'ip:' . client_ip());
    turnstile_or_fail(isset($body['captcha_token']) ? (string) $body['captcha_token'] : null);

    $email = normalise_email((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $contact = trim((string) ($body['contact_number'] ?? ''));

    // Every problem is collected before answering, so the form can mark all of
    // the bad fields at once instead of revealing them one submission at a time.
    $errors = [];

    // First and last name separately (migration 008), each by the same rule
    // the profile form uses (helpers.php).
    [$firstName, $firstError] = validate_name_part((string) ($body['first_name'] ?? ''), 'first');
    if ($firstError !== null) {
        $errors['first_name'] = $firstError;
    }
    [$lastName, $lastError] = validate_name_part((string) ($body['last_name'] ?? ''), 'last');
    if ($lastError !== null) {
        $errors['last_name'] = $lastError;
    }

    if ($email === '') {
        $errors['email'] = 'Enter your email address.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 190) {
        $errors['email'] = 'Enter a valid email address.';
    }

    // The same rule the password reset uses (helpers.php), checked against
    // this person's own address and both parts of their name.
    $passwordError = password_policy_error($password, $email, $firstName, $lastName);
    if ($passwordError !== null) {
        $errors['password'] = $passwordError;
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

    // For the greeting in the verification email. The same value the database
    // generates into users.full_name from the two parts.
    $fullName = $firstName . ' ' . $lastName;

    // The role is never read from the request body. A new account is always an
    // ordinary user; accepting a role here would let anyone register as an
    // administrator by adding one line to the request.
    $statement = db()->prepare(
        "INSERT INTO users (first_name, last_name, email, password_hash, contact_number, role, account_status)
              VALUES (:first_name, :last_name, :email, :password_hash, :contact_number, 'user', 'active')"
    );

    // The account and the record of what they agreed to are written together.
    // An account with no consent row, or a consent row with no account, would
    // each be a worse outcome than the registration simply failing.
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $statement->execute([
            ':first_name' => $firstName,
            ':last_name' => $lastName,
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

    audit_log('register', $userId, $email, 'user', $userId);

    // Registering no longer signs anybody in. The account exists and cannot be
    // used until the address is proved, so handing out a session here would be
    // a session that is not allowed to do anything.
    //
    // Creating the row and sending the mail cannot be one transaction: MySQL
    // and an SMTP server do not share one. So the account is committed first
    // and the send is reported honestly — an account that exists with no email
    // delivered is recoverable by pressing resend, whereas rolling back a
    // perfectly good account because a mail server answered slowly is not.
    $delivered = true;
    $token = token_issue($userId, 'email_verification');

    try {
        send_mail(
            $email,
            $fullName,
            'Verify your Paws&Found email',
            mail_body_verification($fullName, $token),
            mail_text_verification($fullName, $token)
        );
    } catch (MailFailure $failure) {
        // The reason goes to the log, never to the browser: it can name the
        // mail host and quote its refusal.
        error_log('[pawsandfound] verification email to user ' . $userId . ' failed: ' . $failure->getMessage());
        $delivered = false;
    }

    json_response([
        'verification_required' => true,
        'email_sent' => $delivered,
        'email' => mask_email($email),
    ], 201);
}

/**
 * Show enough of an address to recognise it, not enough to learn it.
 *
 * The person who just typed it knows what it says; anybody reading over their
 * shoulder, or reading a screenshot afterwards, does not need the whole thing.
 */
function mask_email(string $email): string
{
    [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

    $shown = mb_substr($local, 0, 1);
    $hidden = str_repeat('*', max(1, mb_strlen($local) - 1));

    return $domain === '' ? $shown . $hidden : $shown . $hidden . '@' . $domain;
}

/**
 * One spelling of an address.
 *
 * Trim and lower-case, and nothing else. Deliberately NOT the clever
 * provider-specific canonicalisation — stripping dots or +tags — because those
 * rules belong to one provider, not to email, and applying them elsewhere
 * merges two people who are not the same person.
 *
 * The column is utf8mb4_unicode_ci, so uniqueness was already
 * case-insensitive; this makes what is stored match what is compared.
 */
function normalise_email(string $email): string
{
    return mb_strtolower(trim($email));
}

/**
 * Prove an email address.
 *
 * Handles both purposes, because to the person clicking they are the same act:
 * a link arrived, they followed it, the address is theirs now. An email-change
 * token additionally moves `pending_email` into `email`.
 */
function auth_verify_email(): never
{
    $body = request_body();
    $raw = trim((string) ($body['token'] ?? ''));

    $token = token_consume($raw, 'email_verification') ?? token_consume($raw, 'email_change');

    if ($token === null) {
        // Wrong, expired and already used are one answer on purpose. A link
        // that says "expired" tells whoever holds it that it was once real.
        json_error('That link is no longer valid. Ask for a new one.', 400, [
            'code' => 'token_invalid',
        ]);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        if ($token['purpose'] === 'email_change') {
            $newEmail = (string) $token['target_email'];

            // Somebody else may have taken the address during the wait. The
            // unique index decides; this only makes the refusal readable.
            $taken = $pdo->prepare('SELECT 1 FROM users WHERE email = :email AND user_id <> :id');
            $taken->execute([':email' => $newEmail, ':id' => $token['user_id']]);

            if ($taken->fetchColumn()) {
                $pdo->rollBack();
                json_error('That email address is now in use by another account.', 409, [
                    'code' => 'email_taken',
                ]);
            }

            $update = $pdo->prepare(
                'UPDATE users
                    SET email = :email, pending_email = NULL, email_verified_at = NOW()
                  WHERE user_id = :id'
            );
            $update->execute([':email' => $newEmail, ':id' => $token['user_id']]);
        } else {
            $update = $pdo->prepare(
                'UPDATE users SET email_verified_at = NOW()
                  WHERE user_id = :id AND email_verified_at IS NULL'
            );
            $update->execute([':id' => $token['user_id']]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    $person = $pdo->prepare('SELECT email FROM users WHERE user_id = :id');
    $person->execute([':id' => $token['user_id']]);
    $address = (string) ($person->fetchColumn() ?: '');

    audit_log(
        $token['purpose'] === 'email_change' ? 'email_change_completed' : 'email_verified',
        (int) $token['user_id'],
        $address,
        'user',
        (int) $token['user_id']
    );

    json_response(['verified' => true, 'email' => mask_email($address)]);
}

/**
 * Send the verification email again.
 *
 * Answers the same way whatever the address is. An endpoint that says "no such
 * account" is a list of which addresses have accounts, available to anybody.
 */
function auth_resend_verification(): never
{
    $body = request_body();
    $email = normalise_email((string) ($body['email'] ?? ''));

    rate_limit_or_fail('resend_verification', $email);
    rate_limit_or_fail('resend_verification', 'ip:' . client_ip());

    $statement = db()->prepare(
        'SELECT user_id, full_name, email FROM users
          WHERE email = :email AND email_verified_at IS NULL'
    );
    $statement->execute([':email' => $email]);
    $user = $statement->fetch();

    if ($user) {
        $token = token_issue((int) $user['user_id'], 'email_verification');

        try {
            send_mail(
                $user['email'],
                $user['full_name'],
                'Verify your Paws&Found email',
                mail_body_verification($user['full_name'], $token),
                mail_text_verification($user['full_name'], $token)
            );
        } catch (MailFailure $failure) {
            error_log('[pawsandfound] resend to user ' . $user['user_id'] . ' failed: ' . $failure->getMessage());
        }
    }

    json_response([
        'message' => 'If an unverified account uses that email address, '
            . 'a new verification link has been sent.',
    ]);
}

/**
 * Begin a password reset.
 *
 * The answer never varies. Not for an unknown address, not for an unverified
 * one, not for a suspended account, and not when the mail server refuses —
 * because any difference at all is a way of asking whether an address is
 * registered.
 */
function auth_forgot_password(): never
{
    $body = request_body();
    $email = normalise_email((string) ($body['email'] ?? ''));

    rate_limit_or_fail('forgot_password', $email);
    rate_limit_or_fail('forgot_password', 'ip:' . client_ip());

    $statement = db()->prepare(
        'SELECT user_id, full_name, email FROM users
          WHERE email = :email AND email_verified_at IS NOT NULL'
    );
    $statement->execute([':email' => $email]);
    $user = $statement->fetch();

    if ($user) {
        $token = token_issue((int) $user['user_id'], 'password_reset');

        try {
            send_mail(
                $user['email'],
                $user['full_name'],
                'Reset your Paws&Found password',
                mail_body_reset($user['full_name'], $token),
                mail_text_reset($user['full_name'], $token)
            );
        } catch (MailFailure $failure) {
            error_log('[pawsandfound] reset mail to user ' . $user['user_id'] . ' failed: ' . $failure->getMessage());
        }
    }

    json_response([
        'message' => 'If an account uses that email address, '
            . 'password reset instructions have been sent.',
    ]);
}

/**
 * Finish a password reset.
 *
 * Deliberately does NOT unlock a locked account or reinstate a suspended one.
 * Those are an administrator's decision about a person; this is a person
 * proving they can read their own email. Conflating them would turn the reset
 * form into a way around the three-attempt lock.
 */
function auth_reset_password(): never
{
    $body = request_body();
    $raw = trim((string) ($body['token'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    // Look first, spend later. The link is only read here; it is spent inside
    // the transaction below, once the new password has been accepted. So a
    // refusal — too short, too common, the person's own name, or the password
    // the account already has — leaves the same link working for a better one.
    $pending = token_peek($raw, 'password_reset');

    if ($pending === null) {
        json_error('That link is no longer valid. Ask for a new one.', 400, [
            'code' => 'token_invalid',
        ]);
    }

    $account = db()->prepare('SELECT first_name, last_name, email, password_hash FROM users WHERE user_id = :id');
    $account->execute([':id' => $pending['user_id']]);
    $account = $account->fetch();

    // The same rule as registration (helpers.php), so a reset is never a way
    // round it, checked against the account's own name and address.
    $policyError = password_policy_error($password, $account['email'], $account['first_name'], $account['last_name']);
    if ($policyError !== null) {
        json_error($policyError, 422, ['fields' => ['password' => $policyError]]);
    }

    // A reset to the password the account already has used to be accepted: a
    // fresh hash of the same secret, every other session signed out, and
    // "Password changed" for a password that had not.
    if (password_verify($password, (string) $account['password_hash'])) {
        $message = 'Choose a new password that is different from your current password.';
        json_error($message, 422, ['fields' => ['password' => $message]]);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        // Spent inside the transaction that changes the password. Its UPDATE
        // claims the row, so a second request arriving together waits, then
        // finds the link used and is refused; and if the password could not
        // be saved, the rollback leaves the link unspent.
        $token = token_consume($raw, 'password_reset');

        if ($token === null) {
            $pdo->rollBack();
            json_error('That link is no longer valid. Ask for a new one.', 400, [
                'code' => 'token_invalid',
            ]);
        }

        // Both in one statement: the new password, and the generation bump that
        // makes every session signed in under the old one stop working.
        $update = $pdo->prepare(
            'UPDATE users
                SET password_hash = :hash, session_version = session_version + 1
              WHERE user_id = :id'
        );
        $update->execute([
            ':hash' => password_hash($password, PASSWORD_DEFAULT),
            ':id' => $token['user_id'],
        ]);

        // And every session record of the account says why it ended.
        end_open_sessions((int) $token['user_id'], 'password_reset');

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    $person = $pdo->prepare('SELECT email FROM users WHERE user_id = :id');
    $person->execute([':id' => $token['user_id']]);

    audit_log('password_reset', (int) $token['user_id'], $person->fetchColumn() ?: null,
        'user', (int) $token['user_id'], 'success', 'reset by email link; other sessions ended');

    json_response(['reset' => true]);
}

function auth_logout(): never
{
    // Read before the session is torn down: afterwards there is nobody left to
    // record as having signed out.
    $user = current_user();

    if ($user !== null) {
        audit_log('logout', (int) $user['user_id'], $user['email'], 'user', (int) $user['user_id']);
        activity_log((int) $user['user_id'], 'logout', 'user', (int) $user['user_id']);

        if (!empty($_SESSION['session_record_id'])) {
            session_record_end((int) $_SESSION['session_record_id'], 'logout');
        }
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
    //
    // A browser whose session the server ended is also told why
    // (`session_ended`), so the page can say "your session expired" rather
    // than appearing at Sign in with no explanation.
    if ($user === null) {
        json_response(['user' => null, 'csrf_token' => csrf_token()] + session_end_notice());
    }

    json_response([
        'csrf_token' => csrf_token(),
        'user' => [
            'user_id' => (int) $user['user_id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'contact_number' => $user['contact_number'],
            'role' => $user['role'],
            'preferred_location' => $user['preferred_location'],
            'notify_matches' => (bool) $user['notify_matches'],
            'notify_status' => (bool) $user['notify_status'],
            'notify_staff' => (bool) $user['notify_staff'],
            // The person's own account, so both are theirs to see. The profile
            // needs them to show "awaiting verification" rather than claiming
            // an address change is already done.
            'email_verified_at' => $user['email_verified_at'],
            'pending_email' => $user['pending_email'],
            // Correction 7: whether this account has been shown the notice as
            // it now reads. An account that registered under an earlier
            // version is told, once, without being stopped from working.
            'privacy_notice' => [
                'version' => PRIVACY_NOTICE_VERSION,
                'acknowledged' => privacy_notice_acknowledged((int) $user['user_id']),
            ],
        ] + ($user['role'] === 'admin' ? [
            // Correction 6. The capabilities are what the interface reads to
            // decide what to show; they are derived here from the level, so
            // the browser never reconstructs the rules from a label. Every
            // endpoint still checks for itself.
            'admin_level' => $user['admin_level'],
            'capabilities' => admin_capabilities($user),
        ] : []),
    ]);
}


/**
 * Whether this account has a `privacy_consents` row for the notice as it now
 * reads (PRIVACY_NOTICE_VERSION). Registering writes one; acknowledging an
 * update writes one.
 */
function privacy_notice_acknowledged(int $userId): bool
{
    $statement = db()->prepare(
        'SELECT 1 FROM privacy_consents WHERE user_id = :user_id AND notice_version = :version'
    );
    $statement->execute([':user_id' => $userId, ':version' => PRIVACY_NOTICE_VERSION]);

    return (bool) $statement->fetchColumn();
}

/**
 * The signed-in person acknowledges the current Privacy Notice (Correction 7).
 *
 * "Acknowledge" means "I have been shown it", not "I agree to optional
 * processing": the security records the notice describes are kept whether or
 * not anybody presses the button, and the notice says so. The row goes into
 * the same `privacy_consents` table registration writes to, against the
 * current version, so there is one record of which notice each account has
 * seen, not two.
 *
 * Always the session's own account — the body is not read, so nobody can
 * acknowledge for somebody else. Pressing it twice is harmless: the unique
 * key on (user_id, notice_version) keeps one row, and the first one's time.
 */
function auth_acknowledge_privacy_notice(): never
{
    $user = require_login();
    $userId = (int) $user['user_id'];

    if (!privacy_notice_acknowledged($userId)) {
        db()->prepare(
            'INSERT IGNORE INTO privacy_consents (user_id, notice_version, ip_address)
                  VALUES (:user_id, :version, :ip)'
        )->execute([
            ':user_id' => $userId,
            ':version' => PRIVACY_NOTICE_VERSION,
            ':ip' => client_ip(),
        ]);

        activity_log($userId, 'privacy_notice_acknowledged', null, null, PRIVACY_NOTICE_VERSION);
    }

    json_response(['ok' => true, 'privacy_notice' => [
        'version' => PRIVACY_NOTICE_VERSION,
        'acknowledged' => true,
    ]]);
}
