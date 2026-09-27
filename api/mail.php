<?php
/**
 * Sending email.
 *
 * WHY THIS IS NOT PHPMailer
 *
 * PHPMailer would be the obvious choice and it is a better library than this
 * file. It needs Composer, which is not installed on any machine in this
 * project, so adopting it means every member installing new tooling — or
 * committing somebody else's source into our repository — two days before the
 * presentation, to send three emails. CLAUDE.md §15 asks whether a feature can
 * be built with what is already here first, and for three fixed messages over
 * one connection, it can.
 *
 * What this deliberately does NOT do: attachments, alternative encodings,
 * DKIM, pooling, or anything else a real application needs. If the project
 * ever sends mail that is not one of these three messages, replace this with
 * PHPMailer rather than growing it.
 *
 * FAILURE IS LOUD
 *
 * Every function here either sends or throws. Nothing returns a quiet false
 * that a caller can forget to check, because the one unacceptable outcome is
 * telling somebody their verification email is on its way when it is not.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/** Thrown when a message could not be handed to the mail server. */
class MailFailure extends RuntimeException
{
}

/**
 * Send one message.
 *
 * @throws MailFailure when the transport is unconfigured or the server refuses
 */
function send_mail(string $toAddress, string $toName, string $subject, string $html, string $text): void
{
    $transport = MAIL_TRANSPORT;

    if ($transport === 'capture') {
        mail_capture($toAddress, $subject, $html, $text);
        return;
    }

    if ($transport === 'log') {
        // Development without an SMTP server: the message goes to the PHP
        // error log so the flow can be followed, and the caller is still told
        // it succeeded — which is true, it was delivered to the log.
        error_log(sprintf('[pawsandfound] mail to %s: %s', $toAddress, $subject));
        return;
    }

    if ($transport === 'brevo_api') {
        if (BREVO_API_KEY === '' || MAIL_FROM_ADDRESS === '') {
            throw new MailFailure('Mail is not configured on this server.');
        }

        brevo_send($toAddress, $toName, $subject, $html, $text);
        return;
    }

    if ($transport !== 'smtp') {
        // Without this, a typo in the variable — 'brevo-api', 'Brevo_API' — falls
        // through to SMTP and fails fifteen seconds later complaining about a
        // mail server nobody configured. Naming the real problem in the log is
        // the difference between a two-minute fix and an evening.
        error_log('[pawsandfound] unknown MAIL_TRANSPORT: ' . $transport);
        throw new MailFailure('Mail is not configured on this server.');
    }

    if (MAIL_HOST === '' || MAIL_FROM_ADDRESS === '') {
        throw new MailFailure('Mail is not configured on this server.');
    }

    smtp_send($toAddress, $toName, $subject, $html, $text);
}

/**
 * Hand the message to Brevo over HTTPS instead of SMTP.
 *
 * WHY THIS EXISTS
 *
 * Railway's trial plan blocks outbound SMTP. Not slowly — the container cannot
 * open a connection to smtp-relay.brevo.com:587 at all, and the attempt ends
 * in a timeout after fifteen seconds. Every verification email failed, and the
 * hosting plan is not something the code can argue with.
 *
 * Port 443 is not blocked, because the site is served over it. So the same
 * message goes to the same provider through their HTTPS API instead. This is
 * a transport, not a rewrite: the messages, the templates and every caller are
 * unchanged, and `smtp` still works anywhere outbound 587 is allowed.
 *
 * cURL rather than a stream, to match `turnstile_or_fail()` in tokens.php. It
 * is not an added dependency: ext-curl is compiled into the official
 * php:8.3-apache image, `php -m` lists it in our built image, and Turnstile
 * has been verifying through it in production already.
 *
 * @throws MailFailure unless Brevo accepts the message
 */
/**
 * The JSON body Brevo expects.
 *
 * Separate from the request so the shape can be checked without sending
 * anything. The names are Brevo's, not ours — `htmlContent`, `textContent`,
 * and `to` as a list even for one recipient.
 *
 * Display names still go through mail_header_safe(). They cannot inject a
 * header here the way they could into SMTP, but the name comes from an account
 * and a stray newline in it has no business reaching a provider either way.
 *
 * @return array<string, mixed>
 */
function brevo_payload(string $toAddress, string $toName, string $subject, string $html, string $text): array
{
    return [
        'sender' => [
            'email' => MAIL_FROM_ADDRESS,
            'name' => mail_header_safe(MAIL_FROM_NAME),
        ],
        'to' => [[
            'email' => $toAddress,
            'name' => mail_header_safe($toName) ?: $toAddress,
        ]],
        'subject' => mail_header_safe($subject),
        'htmlContent' => $html,
        'textContent' => $text,
    ];
}

function brevo_send(string $toAddress, string $toName, string $subject, string $html, string $text): void
{
    $body = json_encode(
        brevo_payload($toAddress, $toName, $subject, $html, $text),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    if ($body === false) {
        throw new MailFailure('The message could not be prepared.');
    }

    $request = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($request, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => MAIL_TIMEOUT,
        CURLOPT_HTTPHEADER => [
            'api-key: ' . BREVO_API_KEY,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_POSTFIELDS => $body,
    ]);

    $response = curl_exec($request);
    $status = (int) curl_getinfo($request, CURLINFO_RESPONSE_CODE);
    $transportError = $response === false ? curl_error($request) : '';
    curl_close($request);

    if ($response === false) {
        // The URL is safe to log and the key is not in it. curl_error() never
        // contains the request headers, which is where the key lives.
        error_log('[pawsandfound] could not reach the Brevo API: ' . $transportError);
        throw new MailFailure('The mail service could not be reached.');
    }

    // Brevo answers 201 with a messageId when it has accepted the message for
    // delivery. Anything else is a refusal, and the difference matters: the
    // whole point of this file is that nobody is told their email is on its
    // way when it is not.
    if ($status < 200 || $status >= 300) {
        // Their body explains the refusal to whoever reads the log — a wrong
        // key, an unverified sender — and means nothing to a visitor. It is
        // never returned to the browser. It does not contain the key.
        error_log('[pawsandfound] Brevo refused the message, HTTP ' . $status . ': '
            . substr((string) $response, 0, 400));
        throw new MailFailure('The mail service refused the message.');
    }
}

/**
 * Write the message to a file instead of sending it.
 *
 * This is how the tests read a verification link without an SMTP server and
 * without a production endpoint that hands out tokens. Only ever reachable
 * when MAIL_TRANSPORT is 'capture', which production never sets.
 */
function mail_capture(string $toAddress, string $subject, string $html, string $text): void
{
    $directory = MAIL_CAPTURE_DIR;

    if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
        throw new MailFailure('Could not write the captured message.');
    }

    $payload = json_encode([
        'to' => $toAddress,
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
        'sent_at' => date('c'),
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    $file = $directory . '/' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';

    if (file_put_contents($file, $payload) === false) {
        throw new MailFailure('Could not write the captured message.');
    }
}

/**
 * Talk SMTP.
 *
 * Deliberately linear and readable: connect, greet, upgrade to TLS,
 * authenticate, send, quit. Every step checks the reply code, and any reply
 * that is not the expected one stops the whole thing — a half-completed SMTP
 * conversation must never look like a delivered message.
 */
function smtp_send(string $toAddress, string $toName, string $subject, string $html, string $text): void
{
    $context = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);

    // 'tls' means implicit TLS from the first byte (port 465). Anything else
    // connects in the clear and upgrades with STARTTLS (port 587).
    $scheme = MAIL_ENCRYPTION === 'tls' ? 'ssl://' : '';
    $socket = @stream_socket_client(
        $scheme . MAIL_HOST . ':' . MAIL_PORT,
        $errorNumber,
        $errorMessage,
        MAIL_TIMEOUT,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if ($socket === false) {
        throw new MailFailure('Could not reach the mail server.');
    }

    stream_set_timeout($socket, MAIL_TIMEOUT);

    try {
        smtp_expect($socket, 220);

        $hostname = parse_url(APP_URL, PHP_URL_HOST) ?: 'localhost';
        smtp_command($socket, 'EHLO ' . $hostname, 250);

        if (MAIL_ENCRYPTION === 'starttls') {
            smtp_command($socket, 'STARTTLS', 220);

            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new MailFailure('The mail server would not start TLS.');
            }

            // Everything before the upgrade is discarded; the server must be
            // greeted again over the encrypted channel.
            smtp_command($socket, 'EHLO ' . $hostname, 250);
        }

        if (MAIL_USERNAME !== '') {
            smtp_command($socket, 'AUTH LOGIN', 334);
            smtp_command($socket, base64_encode(MAIL_USERNAME), 334);
            smtp_command($socket, base64_encode(MAIL_PASSWORD), 235);
        }

        smtp_command($socket, 'MAIL FROM:<' . MAIL_FROM_ADDRESS . '>', 250);
        smtp_command($socket, 'RCPT TO:<' . $toAddress . '>', 250);
        smtp_command($socket, 'DATA', 354);

        fwrite($socket, smtp_message($toAddress, $toName, $subject, $html, $text) . "\r\n.\r\n");
        smtp_expect($socket, 250);

        // Best effort: the message is already accepted by this point, so a
        // server that hangs up rudely on QUIT has not lost anything.
        @fwrite($socket, "QUIT\r\n");
    } finally {
        fclose($socket);
    }
}

/** Send one line and check the reply. */
function smtp_command($socket, string $line, int $expected): void
{
    if (fwrite($socket, $line . "\r\n") === false) {
        throw new MailFailure('The connection to the mail server was lost.');
    }

    smtp_expect($socket, $expected);
}

/**
 * Read a reply and insist on a code.
 *
 * SMTP replies can span several lines — `250-SIZE` then `250 HELP` — and the
 * last one is marked by a space rather than a hyphen in the fourth character.
 * Reading only the first line is the classic way to desynchronise the
 * conversation and then misread the next reply.
 */
function smtp_expect($socket, int $expected): string
{
    $reply = '';

    while (true) {
        $line = fgets($socket, 515);

        if ($line === false) {
            $info = stream_get_meta_data($socket);
            throw new MailFailure($info['timed_out']
                ? 'The mail server stopped responding.'
                : 'The mail server closed the connection.');
        }

        $reply .= $line;

        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }

    $code = (int) substr($reply, 0, 3);

    if ($code !== $expected) {
        // The server's own words are useful to whoever reads the log and
        // useless to anybody else, so they are logged but never returned to a
        // browser. A message body can echo an address back.
        error_log('[pawsandfound] smtp expected ' . $expected . ', got: ' . trim($reply));
        throw new MailFailure('The mail server refused the message.');
    }

    return $reply;
}

/** Build the message: headers, then a plain part and an HTML part. */
function smtp_message(string $toAddress, string $toName, string $subject, string $html, string $text): string
{
    $boundary = 'pf' . bin2hex(random_bytes(12));

    // Anything that reaches a header is stripped of CR and LF first. A newline
    // in a display name is how a header injection begins, and the name comes
    // from the account.
    $safeName = mail_header_safe($toName);
    $safeSubject = mail_header_safe($subject);

    $headers = [
        'From: ' . mail_header_safe(MAIL_FROM_NAME) . ' <' . MAIL_FROM_ADDRESS . '>',
        'To: ' . ($safeName === '' ? $toAddress : $safeName . ' <' . $toAddress . '>'),
        'Subject: =?UTF-8?B?' . base64_encode($safeSubject) . '?=',
        'MIME-Version: 1.0',
        'Date: ' . date('r'),
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];

    $body = '--' . $boundary . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text)) . "\r\n"
        . '--' . $boundary . "\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html)) . "\r\n"
        . '--' . $boundary . "--\r\n";

    // A line of a single dot ends the DATA section, so any such line in the
    // body has to be escaped or the message is truncated there.
    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;

    return preg_replace('/^\./m', '..', $message);
}

/** Strip anything that could start a new header line. */
function mail_header_safe(string $value): string
{
    return trim(str_replace(["\r", "\n", "\0"], '', $value));
}
