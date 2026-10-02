<?php
/**
 * First and last names, and a password that may not contain them.
 *
 *   php scripts/identity_rules.php        (npm run test:identity)
 *
 * Post-defense Correction 2. Calls the server's own rules directly, with no
 * database and no HTTP, so every name and password case below is checked
 * against exactly what the API enforces. The browser has a copy of both rules
 * (src/utils/nameRules.js, passwordRules.js); scripts/identity-rules.test.mjs
 * holds that copy to these same cases.
 */
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

// The shared cases: the same file scripts/identity-rules.test.mjs checks the
// browser's copy against.
$cases = json_decode((string) file_get_contents(__DIR__ . '/identity-cases.json'), true, 512, JSON_THROW_ON_ERROR);

// --- Names -------------------------------------------------------------------

foreach ($cases['names_accepted'] as $i => [$first, $last]) {
    [, $firstError] = validate_name_part($first, 'first');
    [, $lastError] = validate_name_part($last, 'last');
    $check('NM-' . ($i + 1), "accepted: {$first} / {$last}", $firstError === null && $lastError === null,
        $firstError ?? $lastError ?? '');
}

$n = count($cases['names_accepted']);
foreach ($cases['names_refused'] as $i => $bad) {
    [, $error] = validate_name_part($bad, 'first');
    $check('NM-' . ($n + $i + 1), 'refused as a first name: "' . $bad . '"', $error !== null, (string) $error);
}

[, $lastOne] = validate_name_part('A', 'last');
$check('NM-L1', 'a one-letter last name is refused, and the message says "last name"',
    $lastOne === 'Enter a real last name with at least 2 letters.', (string) $lastOne);

[$cleaned] = validate_name_part("  Dela   Cruz ", 'last');
$check('NM-L2', 'surrounding and repeated spaces are tidied', $cleaned === 'Dela Cruz', $cleaned);

[, $long] = validate_name_part(str_repeat('a', 61), 'first');
$check('NM-L3', 'longer than the 60-character column is refused', $long !== null, (string) $long);

// --- Password: first and last name anywhere ----------------------------------

$pw = fn (string $password, string $first, string $last, string $email = 'person@example.com') =>
    password_policy_error($password, $email, $first, $last);

foreach ($cases['passwords'] as $i => $case) {
    $error = $pw($case['password'], $case['first'], $case['last']);
    $verdict = $case['accepted'] ? 'accepted' : 'refused';
    $ok = $case['accepted'] ? $error === null
        : $error === 'Choose a password that does not contain your first or last name.';
    $check('PW-' . ($i + 1), "{$case['first']} / {$case['last']}: {$case['password']} is {$verdict}", $ok, (string) $error);
}

// --- The rules kept from before ----------------------------------------------

$check('PK-1', 'still at least 15 characters', $pw('short-pass', 'Kai', 'Ng') !== null);
$check('PK-2', 'still at most 72 bytes', $pw(str_repeat('é', 40), 'Kai', 'Ng') !== null);
$check('PK-3', 'still refuses a common password', $pw('Password123456789', 'Kai', 'Ng') !== null);
$check('PK-4', 'still refuses the email address itself',
    $pw('kyle.austria.2026@example.com', 'Kai', 'Ng', 'kyle.austria.2026@example.com') !== null);
$check('PK-5', 'no composition rule: all lower case, no digits, is fine',
    $pw('lantern-harbor-meadow-glass', 'Kai', 'Ng') === null);
$check('PK-6', 'with no name known, the name rule is simply not applied',
    password_policy_error('maria-santos-passphrase', null, null, null) === null);

printf("\n%d/%d passed\n", $total - $failed, $total);
exit($failed === 0 ? 0 : 1);
