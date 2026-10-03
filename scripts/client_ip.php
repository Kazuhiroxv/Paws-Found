<?php
/**
 * Which address the logs record, and when a forwarded one is believed.
 *
 *   php scripts/client_ip.php        (npm run test:client-ip)
 *
 * client_ip() (api/helpers.php) reads X-Forwarded-For only when the connection
 * itself came from a trusted proxy — on Railway, its edge, which connects from
 * 100.0.0.0/8. Anybody else's X-Forwarded-For is ignored, so a visitor cannot
 * choose the address written into the logs. The trusted list is set here the
 * way a deployment sets it, through the TRUSTED_PROXY_CIDRS variable, before
 * the configuration is read. No database, no network.
 */
putenv('TRUSTED_PROXY_CIDRS=100.0.0.0/8, fd00::/8');
require __DIR__ . '/../api/helpers.php';

$failed = 0;
$total = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed, &$total): void {
    $total++;
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-6s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};

/** client_ip() for a connection from $remote carrying this X-Forwarded-For. */
$ip = function (?string $remote, ?string $forwarded = null): ?string {
    $_SERVER['REMOTE_ADDR'] = $remote;
    if ($forwarded === null) {
        unset($_SERVER['HTTP_X_FORWARDED_FOR']);
    } else {
        $_SERVER['HTTP_X_FORWARDED_FOR'] = $forwarded;
    }

    return client_ip();
};

$check('IP-1', 'The setting is read from the environment', TRUSTED_PROXY_CIDRS === ['100.0.0.0/8', 'fd00::/8'],
    implode(',', TRUSTED_PROXY_CIDRS));

// A browser talking to the server directly: its own address, whatever it claims.
$check('IP-2', 'Direct connection: REMOTE_ADDR', $ip('203.0.113.5') === '203.0.113.5');
$check('IP-3', 'Direct connection claiming another address: ignored', $ip('203.0.113.5', '198.51.100.1') === '203.0.113.5');
$check('IP-4', 'A laptop (127.0.0.1) is not a trusted proxy', $ip('127.0.0.1', '198.51.100.1') === '127.0.0.1');

// Through the trusted edge: the first forwarded address is the visitor.
$check('IP-5', "Through the edge: the visitor's address", $ip('100.64.0.12', '198.51.100.23') === '198.51.100.23');
$check('IP-6', 'Through the edge, a chain: the first entry', $ip('100.64.0.12', '198.51.100.23, 100.64.0.9') === '198.51.100.23');
$check('IP-7', 'Through the edge, IPv6 visitor', $ip('100.64.0.12', '2001:db8::7') === '2001:db8::7');
$check('IP-8', 'Through an IPv6 trusted proxy', $ip('fd00::1', '198.51.100.40') === '198.51.100.40');
$check('IP-9', 'Through the edge with junk forwarded: the edge itself, never the junk',
    $ip('100.64.0.12', "<script>, 1.2.3.4") === '100.64.0.12');
$check('IP-10', 'Through the edge with nothing forwarded: the edge', $ip('100.64.0.12') === '100.64.0.12');

// What is never recorded.
$check('IP-11', 'No address at all: null, not an empty string', $ip(null) === null);
$check('IP-12', 'A malformed REMOTE_ADDR: null', $ip('not-an-ip') === null);
$check('IP-13', 'Every result fits VARCHAR(45)', strlen((string) $ip('100.64.0.12', '0000:0000:0000:0000:0000:ffff:192.168.100.228')) <= 45);

// The range test underneath.
$check('IP-14', 'ip_in_range: inside a /8', ip_in_range('100.127.255.255', '100.0.0.0/8'));
$check('IP-15', 'ip_in_range: just outside', !ip_in_range('101.0.0.1', '100.0.0.0/8'));
$check('IP-16', 'ip_in_range: a /12 boundary', ip_in_range('172.31.0.1', '172.16.0.0/12') && !ip_in_range('172.32.0.1', '172.16.0.0/12'));
$check('IP-17', 'ip_in_range: IPv4 never matches an IPv6 range', !ip_in_range('100.0.0.1', 'fd00::/8'));
$check('IP-18', 'ip_in_range: a single address', ip_in_range('192.0.2.1', '192.0.2.1') && !ip_in_range('192.0.2.2', '192.0.2.1'));

echo "\n" . ($total - $failed) . "/{$total} passed\n";
exit($failed ? 1 : 0);
