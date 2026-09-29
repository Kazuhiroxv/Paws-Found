<?php
/**
 * One-time links, and how often a stranger may ask for one.
 *
 * THE RULE THAT MATTERS
 *
 * The raw token goes in the email and is never written down. What the database
 * holds is a SHA-256 of it, so a copy of `auth_tokens` is not a set of working
 * links — somebody with the whole table still cannot verify an address or
 * reset a password. Exactly the reasoning behind `password_hash`, applied to
 * the thing that can replace a password.
 *
 * SHA-256 rather than bcrypt here on purpose. A password is short, guessable
 * and chosen by a person, so it needs a slow hash. These are 32 bytes from
 * random_bytes(): there is nothing to guess, and the lookup has to be fast
 * enough to do on every click.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/** Seconds a token of each purpose stays usable. */
function token_lifetime(string $purpose): int
{
    return match ($purpose) {
        'email_verification' => TOKEN_TTL_EMAIL_VERIFICATION,
        'password_reset' => TOKEN_TTL_PASSWORD_RESET,
        'email_change' => TOKEN_TTL_EMAIL_CHANGE,
    };
}

/**
 * Issue a token and return the RAW value, which is the only time it exists.
 *
 * Any earlier unused token of the same purpose is spent first. Asking for a
 * second verification email should not leave two working links: the one in the
 * newest message is the one that works, which is also what the person expects.
 *
 * @param string|null $targetEmail only for 'email_change' — the address being
 *                                 proved, which is not yet the account's.
 */
function token_issue(int $userId, string $purpose, ?string $targetEmail = null): string
{
    token_invalidate($userId, $purpose);

    $raw = bin2hex(random_bytes(32));

    $statement = db()->prepare(
        'INSERT INTO auth_tokens (user_id, purpose, token_hash, target_email, expires_at)
              VALUES (:user_id, :purpose, :hash, :target, DATE_ADD(NOW(), INTERVAL :ttl SECOND))'
    );
    $statement->execute([
        ':user_id' => $userId,
        ':purpose' => $purpose,
        ':hash' => hash('sha256', $raw),
        ':target' => $targetEmail,
        ':ttl' => token_lifetime($purpose),
    ]);

    return $raw;
}

/** Spend every unused token of one purpose, without sending anything. */
function token_invalidate(int $userId, string $purpose): void
{
    $statement = db()->prepare(
        'UPDATE auth_tokens SET used_at = NOW()
          WHERE user_id = :user_id AND purpose = :purpose AND used_at IS NULL'
    );
    $statement->execute([':user_id' => $userId, ':purpose' => $purpose]);
}

/**
 * Check a token and spend it, in one statement.
 *
 * Returns the row when the token was valid, null otherwise. The caller cannot
 * tell the difference between wrong, expired and already used — and neither
 * can anybody holding a link, which is the point.
 *
 * The UPDATE carries every condition rather than a SELECT followed by an
 * UPDATE. Two clicks on the same link arriving together would both pass a
 * prior SELECT and both be honoured; here the second one changes no rows and
 * gets nothing. The same lesson as the match decisions in matches.php.
 */
function token_consume(string $raw, string $purpose): ?array
{
    if ($raw === '' || !ctype_xdigit($raw) || strlen($raw) !== 64) {
        return null;
    }

    $hash = hash('sha256', $raw);
    $pdo = db();

    $claim = $pdo->prepare(
        'UPDATE auth_tokens SET used_at = NOW()
          WHERE token_hash = :hash
            AND purpose = :purpose
            AND used_at IS NULL
            AND expires_at > NOW()'
    );
    $claim->execute([':hash' => $hash, ':purpose' => $purpose]);

    if ($claim->rowCount() === 0) {
        return null;
    }

    $row = $pdo->prepare(
        'SELECT token_id, user_id, purpose, target_email FROM auth_tokens WHERE token_hash = :hash'
    );
    $row->execute([':hash' => $hash]);

    return $row->fetch() ?: null;
}

/**
 * Look at a token without spending it.
 *
 * The same conditions as token_consume() and the same silence about why a
 * token fails, but nothing changes. For a caller that must refuse a request on
 * other grounds first (a reset to the password the account already has)
 * without burning the one-time link. The spending still happens in
 * token_consume(), which is what keeps two requests from both succeeding.
 */
function token_peek(string $raw, string $purpose): ?array
{
    if ($raw === '' || !ctype_xdigit($raw) || strlen($raw) !== 64) {
        return null;
    }

    $row = db()->prepare(
        'SELECT token_id, user_id, purpose, target_email FROM auth_tokens
          WHERE token_hash = :hash
            AND purpose = :purpose
            AND used_at IS NULL
            AND expires_at > NOW()'
    );
    $row->execute([':hash' => hash('sha256', $raw), ':purpose' => $purpose]);

    return $row->fetch() ?: null;
}

// -----------------------------------------------------------------------------
// Rate limiting
// -----------------------------------------------------------------------------

/**
 * What the limit counts, as a keyed hash.
 *
 * An email address or an IP goes in; 64 hex characters come out. The table
 * needs to count, not to know who — and an HMAC rather than a plain hash so
 * the values cannot be checked against a list of guessed addresses.
 */
function rate_limit_subject(string $value): string
{
    return hash_hmac('sha256', strtolower(trim($value)), RATE_LIMIT_SECRET);
}

/**
 * Count one attempt, and say whether it is allowed.
 *
 * Returns the seconds to wait when it is not, and null when it is.
 *
 * Insert-or-increment in one statement, as `login_failed()` does, so two
 * simultaneous requests cannot both read the same count and both write it
 * back. The window restarts when it has expired, which is what makes this a
 * rolling allowance rather than a permanent ban.
 */
function rate_limit_hit(string $action, string $subject): ?int
{
    [$allowed, $window] = RATE_LIMITS[$action];
    $hash = rate_limit_subject($subject);

    $statement = db()->prepare(
        'INSERT INTO auth_rate_limits (action, subject_hash, window_started_at, attempt_count)
              VALUES (:action, :subject, NOW(), 1)
         ON DUPLICATE KEY UPDATE
              window_started_at = IF(window_started_at < DATE_SUB(NOW(), INTERVAL :window SECOND),
                                     NOW(), window_started_at),
              attempt_count     = IF(window_started_at < DATE_SUB(NOW(), INTERVAL :window2 SECOND),
                                     1, attempt_count + 1)'
    );
    $statement->execute([
        ':action' => $action,
        ':subject' => $hash,
        ':window' => $window,
        ':window2' => $window,
    ]);

    $current = db()->prepare(
        'SELECT attempt_count, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(window_started_at, INTERVAL :window SECOND)) AS retry_after
           FROM auth_rate_limits WHERE action = :action AND subject_hash = :subject'
    );
    $current->execute([':action' => $action, ':subject' => $hash, ':window' => $window]);
    $row = $current->fetch();

    if (!$row || (int) $row['attempt_count'] <= $allowed) {
        return null;
    }

    return max(1, (int) $row['retry_after']);
}

/** Refuse with 429 and a Retry-After, or carry on. */
function rate_limit_or_fail(string $action, string $subject): void
{
    $retryAfter = rate_limit_hit($action, $subject);

    if ($retryAfter === null) {
        return;
    }

    header('Retry-After: ' . $retryAfter);
    json_error('Too many attempts. Please try again later.', 429, [
        'code' => 'rate_limited',
        'retry_after' => $retryAfter,
    ]);
}

// -----------------------------------------------------------------------------
// Cloudflare Turnstile
// -----------------------------------------------------------------------------

/**
 * Check the registration form was filled in by a person.
 *
 * The browser's token proves nothing on its own — it is a string the browser
 * handed us, and a script can hand us one too. It only means anything once
 * Cloudflare confirms it was issued for this site and has not been used, which
 * is what this asks.
 *
 * Refuses rather than passes when production is missing its configuration. A
 * deployed site that silently stops checking because a variable went missing
 * is worse than one that says it is broken.
 */
function turnstile_or_fail(?string $token): void
{
    if (!TURNSTILE_ENABLED) {
        if (APP_ENV === 'production' && TURNSTILE_SECRET_KEY === '') {
            // Explicitly switched off in production: allowed, but said out loud
            // in the log so it is a decision somebody made rather than a
            // setting that quietly went missing.
            error_log('[pawsandfound] Turnstile is disabled in production');
        }

        return;
    }

    if (TURNSTILE_SECRET_KEY === '') {
        error_log('[pawsandfound] Turnstile is enabled but TURNSTILE_SECRET_KEY is empty');
        json_error('Registration is temporarily unavailable. Please try again later.', 503, [
            'code' => 'captcha_misconfigured',
        ]);
    }

    if ($token === null || $token === '') {
        json_error('Please complete the verification below the form.', 422, [
            'code' => 'captcha_required',
            'fields' => ['captcha' => 'Confirm you are a person before continuing.'],
        ]);
    }

    $request = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($request, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_POSTFIELDS => http_build_query([
            'secret' => TURNSTILE_SECRET_KEY,
            'response' => $token,
            'remoteip' => client_ip(),
        ]),
    ]);

    $body = curl_exec($request);
    $failed = $body === false;
    curl_close($request);

    if ($failed) {
        error_log('[pawsandfound] could not reach Turnstile siteverify');
        json_error('Registration is temporarily unavailable. Please try again.', 503, [
            'code' => 'captcha_unreachable',
        ]);
    }

    $result = json_decode((string) $body, true);

    if (!is_array($result) || ($result['success'] ?? false) !== true) {
        json_error('That verification could not be confirmed. Please try again.', 422, [
            'code' => 'captcha_failed',
            'fields' => ['captcha' => 'Please complete the check again.'],
        ]);
    }
}
