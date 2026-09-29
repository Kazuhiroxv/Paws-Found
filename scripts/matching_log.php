<?php
/**
 * What the matching engine writes to the server log.
 *
 *   php scripts/matching_log.php        (npm run test:matching-log)
 *
 * MATCH_DEBUG off, the normal setting: a routine run writes nothing. On: it
 * writes its one trace line. A failure is written either way, with the stage
 * it stopped at, and the exception still reaches the caller.
 *
 * Each case runs in its own PHP process, because MATCH_DEBUG is a constant.
 * The routine case asks for a finished report (10, Returned in the seed), so
 * nothing is compared and nothing is written to the database. The failure case
 * points the connection at a closed port. Needs the local database for the
 * first two cases; changes no data.
 */

if (($argv[1] ?? '') === 'case') {
    // A child process: set up exactly one situation, then report what was logged.
    [, , $debug, $scenario] = $argv;
    define('MATCH_DEBUG', $debug === 'on');
    if ($scenario === 'failure') {
        define('DB_PORT', 1);
    }

    $log = tempnam(sys_get_temp_dir(), 'matchlog');
    ini_set('log_errors', '1');
    ini_set('error_log', $log);

    require __DIR__ . '/../api/matching.php';

    $threw = false;
    try {
        generate_matches_for_report(10);
    } catch (Throwable $exception) {
        $threw = true;
    }

    $lines = array_values(array_filter(
        file($log, FILE_IGNORE_NEW_LINES) ?: [],
        fn ($line) => str_contains($line, '[pawsandfound][matching]')
    ));
    unlink($log);

    echo json_encode(['threw' => $threw, 'lines' => $lines]);
    exit(0);
}

$php = PHP_BINARY;
$self = escapeshellarg(__FILE__);
$run = function (string $debug, string $scenario) use ($php, $self): array {
    $output = shell_exec(escapeshellarg($php) . " {$self} case {$debug} {$scenario} 2>&1");
    $result = json_decode(trim((string) $output), true);

    return is_array($result) ? $result : ['threw' => null, 'lines' => [], 'raw' => $output];
};

$failed = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed): void {
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-5s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};

$off = $run('off', 'routine');
$check('ML-1', 'MATCH_DEBUG off: a routine run writes nothing', $off['lines'] === [] && $off['threw'] === false,
    count($off['lines']) . ' line(s)');

$on = $run('on', 'routine');
$check('ML-2', 'MATCH_DEBUG on: it writes its one trace line', count($on['lines']) === 1
    && str_contains($on['lines'][0] ?? '', 'report=10') && str_contains($on['lines'][0] ?? '', 'not open (returned)'),
    $on['lines'][0] ?? 'none');

$failure = $run('off', 'failure');
$line = $failure['lines'][0] ?? '';
$check('ML-3', 'MATCH_DEBUG off: a failure is still written, with its stage', count($failure['lines']) === 1
    && str_contains($line, 'FAILED at load') && str_contains($line, 'PDOException'), $line !== '' ? substr($line, strpos($line, 'FAILED')) : 'none');
$check('ML-4', '...and the exception still reaches the caller', $failure['threw'] === true);

$failureOn = $run('on', 'failure');
$check('ML-5', 'MATCH_DEBUG on: a failure is written once, not twice', count($failureOn['lines']) === 1
    && str_contains($failureOn['lines'][0] ?? '', 'FAILED at load'));

$leaks = array_filter(array_merge($off['lines'], $on['lines'], $failure['lines'], $failureOn['lines']),
    fn ($l) => preg_match('/\d{1,3}\.\d{4,}|@|password|token/i', $l));
$check('ML-6', 'No coordinates, email addresses, passwords or tokens in any line', $leaks === []);

echo "\n" . (6 - $failed) . "/6 passed\n";
exit($failed ? 1 : 0);
