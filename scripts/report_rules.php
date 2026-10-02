<?php
/**
 * The report form's text rules, as the server enforces them.
 *
 *   php scripts/report_rules.php        (npm run test:report-rules)
 *
 * Post-defense Correction 3. Calls the server's own rules directly, with no
 * database and no HTTP: a lost pet's name needs two letters or digits, a
 * description thirty characters (spaces in a row counted once), and a time is
 * stored as 24-hour HH:MM. The browser's copy is held to the same cases by
 * scripts/report-rules.test.mjs; both read scripts/report-rules-cases.json.
 */
require __DIR__ . '/../api/reports.php';

$failed = 0;
$total = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed, &$total): void {
    $total++;
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-6s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};

$cases = json_decode((string) file_get_contents(__DIR__ . '/report-rules-cases.json'), true, 512, JSON_THROW_ON_ERROR);

// --- RN: a lost pet's name -----------------------------------------------------
$n = 0;
foreach ($cases['pet_names_accepted'] as $name) {
    $problem = pet_name_problem(meaningful_text($name), true);
    $check('RN-' . ++$n, 'accepted: "' . $name . '"', $problem === null, (string) $problem);
}
foreach ($cases['pet_names_refused'] as $name) {
    $problem = pet_name_problem(meaningful_text($name), true);
    $check('RN-' . ++$n, 'refused: "' . $name . '"', $problem !== null, (string) $problem);
}
$check('RN-' . ++$n, 'a found report needs no name', pet_name_problem('', false) === null);
$check('RN-' . ++$n, 'spaces inside a name are tidied ("Mr.   Bean" -> "Mr. Bean")',
    meaningful_text('  Mr.   Bean ') === 'Mr. Bean', meaningful_text('  Mr.   Bean '));

// --- RD: the description ----------------------------------------------------------
$n = 0;
foreach ($cases['descriptions_accepted'] as $text) {
    $problem = description_problem($text);
    $check('RD-' . ++$n, 'accepted: ' . json_encode($text, JSON_UNESCAPED_UNICODE), $problem === null, (string) $problem);
}
foreach ($cases['descriptions_refused'] as $text) {
    $problem = description_problem($text);
    $check('RD-' . ++$n, 'refused: ' . json_encode($text, JSON_UNESCAPED_UNICODE), $problem !== null, (string) $problem);
}
$problem = description_problem('Brown dog.');
$check('RD-' . ++$n, 'the refusal says how many characters there are', str_contains((string) $problem, 'you have 10'),
    (string) $problem);

// --- RT: the stored time ---------------------------------------------------------
// The server takes 24-hour HH:MM; converting AM/PM is the form's job, and its
// conversions are checked against these same values in the JS test.
$pattern = '/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/';
$n = 0;
foreach ($cases['times_24_valid'] as $time) {
    $check('RT-' . ++$n, "the API accepts {$time}", preg_match($pattern, $time) === 1);
}
foreach ($cases['times_24_invalid'] as $time) {
    $check('RT-' . ++$n, "the API refuses \"{$time}\"", preg_match($pattern, $time) !== 1);
}
foreach ($cases['times_12_to_24'] as [, $time]) {
    if ($time !== '') {
        $check('RT-' . ++$n, "every converted time the form can send is accepted ({$time})", preg_match($pattern, $time) === 1);
    }
}

// --- the source of the pattern above is the API's, not a copy -------------------
$source = (string) file_get_contents(__DIR__ . '/../api/reports.php');
$check('RT-' . ++$n, 'the pattern tested is the one api/reports.php uses',
    str_contains($source, "preg_match('/^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$/', \$time)"));

printf("\n%d/%d passed\n", $total - $failed, $total);
exit($failed === 0 ? 0 : 1);
