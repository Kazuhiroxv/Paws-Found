<?php
/**
 * Matching after Correction 3: same weights, same demonstration scores, and
 * the new values treated honestly.
 *
 *   php scripts/match_scores.php        (npm run test:scores)
 *
 * Needs the local database with the seed loaded. Recomputes the four seeded
 * pairings with the real compare_reports() and holds them to the scores the
 * demonstration has always shown. If one of these moves, a correction changed
 * matching — stop and explain it, do not edit the number here.
 */
require __DIR__ . '/../api/helpers.php';
require __DIR__ . '/../api/matching.php';

$failed = 0;
$total = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed, &$total): void {
    $total++;
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-6s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};

$check('MT-1', 'Weights unchanged: species 25, location 20, breed 15, colour 15, size 10, date 10, features 5',
    MATCH_WEIGHTS === ['species' => 25, 'location' => 20, 'breed' => 15, 'color' => 15,
                       'size' => 10, 'date' => 10, 'characteristics' => 5]);

// The demonstration's four pairings: lost, found, score.
foreach ([[1, 2, 85], [3, 4, 75], [7, 10, 100], [25, 26, 100]] as $i => [$lost, $found, $score]) {
    $result = compare_reports(matching_load_report($lost), matching_load_report($found));
    $check('MT-' . ($i + 2), "Seeded pairing {$lost}/{$found} still scores {$score}", $result['score'] === $score,
        'computed ' . $result['score']);
}

// The new values, on two otherwise identical reports.
$base = matching_load_report(25);
$other = matching_load_report(26);
$signal = function (array $lost, array $found, string $key): bool {
    foreach (compare_reports($lost, $found)['signals'] as $s) {
        if ($s['key'] === $key) {
            return $s['matched'];
        }
    }
    return false;
};
$check('MT-6', 'Both "Mixed breed": the breed signal does not count it as agreement',
    !$signal(['breed' => 'Mixed breed'] + $base, ['breed' => 'Mixed breed'] + $other, 'breed'));
$check('MT-7', 'Both "Other" colour: the colour signal does not count it as agreement',
    !$signal(['primary_color' => 'Other'] + $base, ['primary_color' => 'Other'] + $other, 'color'));
$check('MT-8', 'XL against XL is a size match, XL against Large is not',
    $signal(['size' => 'xl'] + $base, ['size' => 'xl'] + $other, 'size')
    && !$signal(['size' => 'xl'] + $base, ['size' => 'large'] + $other, 'size'));

// Location without pins: the PSGC code decides when both reports have one.
$noPin = ['latitude' => null, 'longitude' => null];
$check('MT-9', 'Same city code, names written differently ("Makati City" / "City of Makati"): same place',
    $signal(['city' => 'Makati City', 'province' => 'Metro Manila', 'city_code' => '1380300000'] + $noPin + $base,
            ['city' => 'City of Makati', 'province' => 'Metro Manila', 'city_code' => '1380300000'] + $noPin + $other,
            'location'));
$check('MT-10', 'Different city codes, even with the same written name: not the same place',
    !$signal(['city' => 'San Fernando', 'province' => 'X', 'city_code' => '0330100000'] + $noPin + $base,
             ['city' => 'San Fernando', 'province' => 'X', 'city_code' => '0133100000'] + $noPin + $other,
             'location'));
$check('MT-11', 'One report without a code: the old name rule still applies',
    $signal(['city' => 'Pasig City', 'province' => 'Metro Manila', 'city_code' => null] + $noPin + $base,
            ['city' => 'Pasig', 'province' => 'Metro Manila', 'city_code' => '1381200000'] + $noPin + $other,
            'location'));

printf("\n%d/%d passed\n", $total - $failed, $total);
exit($failed === 0 ? 0 : 1);
