<?php
/**
 * Which address the logs and the rate limits use (Correction 5A).
 *
 *   php scripts/client_ip.php        (npm run test:client-ip)
 *
 * client_ip() (api/helpers.php) believes a header only behind Railway's HTTP
 * edge — BEHIND_RAILWAY_EDGE in api/config.php, decided from the deployment
 * (production + a variable Railway sets), never from the request or from the
 * address the request came from. There it takes X-Real-IP, which Railway
 * sets and overwrites; everywhere else REMOTE_ADDR, whatever headers arrive.
 *
 * The decision is a constant, fixed when the configuration loads, so each
 * situation runs in a PHP process of its own: this file starts itself once per
 * case and adds up what the children report. No database, no network.
 */

$mode = $argv[1] ?? 'all';

if ($mode === 'all') {
    $cases = ['detect', 'local', 'railway'];
    $passed = 0;
    $total = 0;
    foreach ($cases as $case) {
        $output = [];
        exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . $case, $output);
        foreach ($output as $line) {
            if (preg_match('#^(\d+)/(\d+) passed$#', $line, $m)) {
                $passed += (int) $m[1];
                $total += (int) $m[2];
            } else {
                echo $line, "\n";
            }
        }
    }
    echo "\n{$passed}/{$total} passed\n";
    exit($passed === $total && $total > 0 ? 0 : 1);
}

$failed = 0;
$total = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed, &$total): void {
    $total++;
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-7s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};
$finish = function () use (&$failed, &$total): never {
    echo ($total - $failed) . "/{$total} passed\n";
    exit($failed ? 1 : 0);
};

// ------------------------------------------------- how the decision is made
if ($mode === 'detect') {
    // Each environment in a grandchild of its own: the constant is set once.
    $decide = function (array $env): string {
        $prefix = '';
        foreach ($env as $name => $value) {
            $prefix .= "putenv('{$name}={$value}');";
        }
        $code = $prefix . "require " . var_export(__DIR__ . '/../api/config.php', true)
            . "; echo BEHIND_RAILWAY_EDGE ? 'railway' : 'not';";
        return trim((string) shell_exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($code)));
    };
    $check('DET-1', 'Production on Railway (RAILWAY_ENVIRONMENT_ID set): behind the edge',
        $decide(['APP_ENV' => 'production', 'RAILWAY_ENVIRONMENT_ID' => 'c0ffee']) === 'railway');
    $check('DET-2', 'Production image run locally (no Railway variable): not behind it',
        $decide(['APP_ENV' => 'production', 'RAILWAY_ENVIRONMENT_ID' => '']) === 'not');
    $check('DET-3', 'Development, even with the Railway variable: not behind it',
        $decide(['APP_ENV' => 'development', 'RAILWAY_ENVIRONMENT_ID' => 'c0ffee']) === 'not');
    $finish();
}

define('BEHIND_RAILWAY_EDGE', $mode === 'railway');
require __DIR__ . '/../api/helpers.php';

/** client_ip() for a connection from $remote carrying these headers. */
$ip = function (?string $remote, array $headers = []): ?string {
    $_SERVER['REMOTE_ADDR'] = $remote;
    unset($_SERVER['HTTP_X_REAL_IP'], $_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['HTTP_CF_CONNECTING_IP']);
    foreach ($headers as $name => $value) {
        $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $name))] = $value;
    }
    return client_ip();
};

// --------------------------------------- off Railway: XAMPP, local Docker
if ($mode === 'local') {
    $check('IP-01', 'Local: a spoofed X-Real-IP is ignored', $ip('127.0.0.1', ['X-Real-IP' => '203.0.113.9']) === '127.0.0.1');
    $check('IP-02', 'Local: a spoofed X-Forwarded-For is ignored',
        $ip('127.0.0.1', ['X-Forwarded-For' => '203.0.113.9']) === '127.0.0.1');
    $check('IP-03', 'Local: the connecting address is used (IPv4 and IPv6)',
        $ip('192.168.1.20') === '192.168.1.20' && $ip('::1') === '::1');
    $check('IP-03b', 'Local: a 100.x peer is not special any more',
        $ip('100.64.0.12', ['X-Forwarded-For' => '198.51.100.23', 'X-Real-IP' => '198.51.100.24']) === '100.64.0.12');
    $check('IP-03c', 'No address at all: null, not an empty string', $ip(null) === null && $ip('not-an-ip') === null);
    $finish();
}

// ----------------------------------------- behind Railway's edge (simulated)
// The fallback writes to the server log; captured here so it can be checked.
$log = tempnam(sys_get_temp_dir(), 'paws-ip');
ini_set('error_log', $log);
$check('IP-04', "Railway: X-Real-IP is the visitor's address", $ip('10.250.3.4', ['X-Real-IP' => '198.51.100.23']) === '198.51.100.23');
$check('IP-05', 'Railway: IPv4', $ip('10.250.3.4', ['X-Real-IP' => '203.0.113.7']) === '203.0.113.7');
$check('IP-06', 'Railway: IPv6', $ip('10.250.3.4', ['X-Real-IP' => '2001:db8::7']) === '2001:db8::7');
$check('IP-06b', 'Railway: surrounding spaces are tolerated', $ip('10.250.3.4', ['X-Real-IP' => ' 203.0.113.8 ']) === '203.0.113.8');
$check('IP-07', 'Railway: a malformed X-Real-IP falls back to REMOTE_ADDR',
    $ip('10.250.3.4', ['X-Real-IP' => '<script>']) === '10.250.3.4'
    && $ip('10.250.3.4', ['X-Real-IP' => '203.0.113.7, 198.51.100.1']) === '10.250.3.4'
    && $ip('10.250.3.4', ['X-Real-IP' => '999.1.1.1']) === '10.250.3.4');
$check('IP-08', 'Railway: a missing X-Real-IP falls back to REMOTE_ADDR', $ip('10.250.3.4') === '10.250.3.4');
$check('IP-08b', 'Railway: X-Forwarded-For and CF-Connecting-IP are never read',
    $ip('10.250.3.4', ['X-Forwarded-For' => '198.51.100.23', 'CF-Connecting-IP' => '198.51.100.24']) === '10.250.3.4');
$check('IP-08c', 'Railway: the peer address does not matter (no 100.0.0.0/8 rule)',
    $ip('172.20.0.5', ['X-Real-IP' => '198.51.100.30']) === '198.51.100.30'
    && $ip('100.64.0.1', ['X-Real-IP' => '198.51.100.31']) === '198.51.100.31');
$check('IP-08d', 'Every result fits VARCHAR(45)',
    strlen((string) $ip('10.250.3.4', ['X-Real-IP' => '0000:0000:0000:0000:0000:ffff:192.168.100.228'])) <= 45);
$written = (string) file_get_contents($log);
unlink($log);
$check('IP-07b', 'Railway: each fallback is logged, without the header value',
    substr_count($written, 'using REMOTE_ADDR') === 5 && !str_contains($written, '<script>') && !str_contains($written, '999.1.1.1'));
$finish();
