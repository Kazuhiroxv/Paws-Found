<?php
/**
 * Paws&Found — the mail transports.
 *
 * `send_mail()` is the one door every account email goes through: registration
 * verification, resend, forgot password, reset, and the email change. None of
 * them care which transport is configured, so the thing worth testing is the
 * door, not five identical callers.
 *
 * What matters here is that a failure is a failure. The unacceptable outcome
 * is `email_sent: true` when nothing was sent, so every path that cannot
 * deliver has to throw rather than return quietly.
 *
 * One test really does call Brevo, with a deliberately invalid key, and
 * insists on being refused. No credential is involved — an invalid key is not
 * a secret — and it proves the parts a fake server cannot: that the container
 * can reach api.brevo.com over 443, that TLS verifies, and that a refusal ends
 * as a MailFailure. Pass --offline to skip it.
 *
 *     php scripts/mail_transport.php
 *     php scripts/mail_transport.php --offline
 */

declare(strict_types=1);

$offline = in_array('--offline', $argv, true);

// The transports are chosen by constants, and constants cannot be redefined.
// Each case therefore runs in its own process: this file re-invokes itself
// with the case name and the settings it needs.
if (isset($argv[1]) && $argv[1] !== '--offline') {
    run_case($argv[1]);
    exit(0);
}

$results = [];

function check(string $id, string $what, string $expected, string $actual): void
{
    global $results;
    $ok = $expected === $actual;
    $results[] = [$id, $what, $ok];
    printf("  %-6s %-54s %-26s %-26s %s\n", $id, $what, $expected, $actual, $ok ? 'PASS' : 'FAIL');
}

/** Run one case in a fresh process and return what it printed. */
function child(string $case, array $env = []): string
{
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($case);

    foreach ($env as $name => $value) {
        putenv($name . '=' . $value);
    }

    $output = (string) shell_exec($command . ' 2>&1');

    foreach (array_keys($env) as $name) {
        putenv($name);
    }

    // error_log() writes to stderr, and several of these cases are supposed to
    // log something. Both streams are kept so a real crash is visible, and the
    // answer is picked out by its marker rather than by being the only thing
    // printed.
    foreach (explode("
", $output) as $line) {
        if (str_starts_with(trim($line), 'RESULT:')) {
            return trim(substr(trim($line), 7));
        }
    }

    return 'no result from child: ' . trim($output);
}

/**
 * The body of one case, in its own process.
 *
 * APP_ENV is forced to development so config.php does not refuse to start over
 * production settings that have nothing to do with mail.
 */
function run_case(string $case): void
{
    putenv('APP_ENV=development');
    putenv('MAIL_FROM_ADDRESS=pawsandfound@example.test');
    putenv('MAIL_FROM_NAME=Paws&Found');

    switch ($case) {
        case 'payload':
            putenv('MAIL_TRANSPORT=log');
            require_once __DIR__ . '/../api/config.php';
            require_once __DIR__ . '/../api/mail.php';

            $payload = brevo_payload(
                'finder@example.test',
                "Maria\r\nInjected: header",
                "Verify your email\r\nBcc: someone@example.test",
                '<p>hello</p>',
                'hello'
            );

            echo 'RESULT:', json_encode([
                'sender_email' => $payload['sender']['email'],
                'sender_name' => $payload['sender']['name'],
                'to_email' => $payload['to'][0]['email'],
                'to_is_list' => array_is_list($payload['to']) ? 'yes' : 'no',
                'name_has_newline' => preg_match('/[\r\n]/', $payload['to'][0]['name']) ? 'yes' : 'no',
                'subject_has_newline' => preg_match('/[\r\n]/', $payload['subject']) ? 'yes' : 'no',
                'html' => $payload['htmlContent'],
                'text' => $payload['textContent'],
            ]);
            return;

        case 'missing_key':
            putenv('MAIL_TRANSPORT=brevo_api');
            putenv('BREVO_API_KEY=');
            break;

        case 'unknown_transport':
            putenv('MAIL_TRANSPORT=brevo-api');   // a hyphen, as a typo would be
            break;

        case 'refused':
            putenv('MAIL_TRANSPORT=brevo_api');
            putenv('BREVO_API_KEY=this-key-is-deliberately-not-valid');
            break;

        case 'log':
            putenv('MAIL_TRANSPORT=log');
            break;

        case 'capture':
            putenv('MAIL_TRANSPORT=capture');
            break;

        case 'smtp_unreachable':
            putenv('MAIL_TRANSPORT=smtp');
            putenv('MAIL_HOST=127.0.0.1');
            putenv('MAIL_PORT=1');            // nothing listens here
            break;
    }

    require_once __DIR__ . '/../api/config.php';
    require_once __DIR__ . '/../api/mail.php';

    try {
        send_mail('finder@example.test', 'Maria Santos', 'Verify your email', '<p>hi</p>', 'hi');
        echo 'RESULT:sent';
    } catch (MailFailure $failure) {
        echo 'RESULT:MailFailure: ' . $failure->getMessage();
    }
}

echo "\nParcels\n";
echo str_repeat('-', 140), "\n";
printf("  %-6s %-54s %-26s %-26s %s\n", '', 'What is being tested', 'Expected', 'Actual', 'Result');

$payload = json_decode(child('payload'), true) ?: [];

check('P1', 'The sender is the configured address', 'pawsandfound@example.test', (string) ($payload['sender_email'] ?? ''));
check('P2', 'Brevo wants a list of recipients, even for one', 'yes', (string) ($payload['to_is_list'] ?? ''));
check('P3', 'The recipient is the address passed in', 'finder@example.test', (string) ($payload['to_email'] ?? ''));
check('P4', 'A newline in a display name is stripped', 'no', (string) ($payload['name_has_newline'] ?? ''));
check('P5', 'A newline in a subject is stripped', 'no', (string) ($payload['subject_has_newline'] ?? ''));
check('P6', 'The HTML body is passed through untouched', '<p>hello</p>', (string) ($payload['html'] ?? ''));
check('P7', 'The plain-text body is sent as well', 'hello', (string) ($payload['text'] ?? ''));

echo "\nRefusing to lie about delivery\n";
echo str_repeat('-', 140), "\n";
printf("  %-6s %-54s %-26s %-26s %s\n", '', 'What is being tested', 'Expected', 'Actual', 'Result');

$noKey = child('missing_key');
check('F1', 'No API key is a failure, not a silent send', 'yes',
    str_starts_with($noKey, 'MailFailure') ? 'yes' : 'no');
check('F2', 'And the wording gives nothing away', 'Mail is not configured on this server.',
    trim(str_replace('MailFailure:', '', $noKey)));

$typo = child('unknown_transport');
check('F3', 'A typo in MAIL_TRANSPORT fails rather than trying SMTP', 'yes',
    str_starts_with($typo, 'MailFailure') ? 'yes' : 'no');

$unreachable = child('smtp_unreachable');
check('F4', 'An unreachable SMTP server is still a failure', 'yes',
    str_starts_with($unreachable, 'MailFailure') ? 'yes' : 'no');

echo "\nThe transports that must keep working\n";
echo str_repeat('-', 140), "\n";
printf("  %-6s %-54s %-26s %-26s %s\n", '', 'What is being tested', 'Expected', 'Actual', 'Result');

check('T1', 'log still reports success', 'sent', child('log'));
check('T2', 'capture still writes the message for the tests', 'sent', child('capture'));

echo "\nBrevo itself\n";
echo str_repeat('-', 140), "\n";
printf("  %-6s %-54s %-26s %-26s %s\n", '', 'What is being tested', 'Expected', 'Actual', 'Result');

if ($offline) {
    echo "  B1     skipped (--offline): needs to reach api.brevo.com over 443\n";
} else {
    $refused = child('refused');
    check('B1', 'An invalid key is refused, and becomes a MailFailure', 'yes',
        str_starts_with($refused, 'MailFailure') ? 'yes' : 'no');
    check('B2', "Brevo's own words never reach the caller", 'The mail service refused the message.',
        trim(str_replace('MailFailure:', '', $refused)));
}

$passed = count(array_filter($results, static fn (array $row): bool => $row[2]));
$total = count($results);

echo "\n", str_repeat('=', 140), "\n";
echo "  {$passed}/{$total} passed\n";

foreach ($results as [$id, $what, $ok]) {
    if (!$ok) {
        echo "  FAILED  {$id}  {$what}\n";
    }
}

echo "\n";
exit($passed === $total ? 0 : 1);
