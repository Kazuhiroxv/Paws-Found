<?php
/**
 * How matching compares places when a report has no map pin.
 *
 *   php scripts/city_fallback.php        (npm run test:city)
 *
 * Location is a gate: if it fails, no pairing is suggested at all. Without a
 * pin the city name decides, and it used to have to be character for
 * character the same, so "Pasig City" and "Pasig" never met. Now case and
 * spacing never matter, and a trailing "City" is optional only when both
 * reports give the same province. Pins, when both reports have one, still
 * decide by distance. Runs the real compare_reports(); needs no database.
 */
require __DIR__ . '/../api/matching.php';

$failed = 0;
$total = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed, &$total): void {
    $total++;
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-8s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};

/** Two reports identical in everything but place; returns [location matched, suggested, score]. */
$pair = function (array $lostPlace, array $foundPlace): array {
    $pet = [
        'species' => 'dog', 'breed' => 'Aspin (Philippine Native Dog)', 'size' => 'medium',
        'primary_color' => 'Brown', 'secondary_color' => null, 'distinct_features' => 'Notched left ear',
        'latitude' => null, 'longitude' => null,
    ];
    $c = compare_reports(
        array_merge($pet, ['incident_date' => '2026-09-10'], $lostPlace),
        array_merge($pet, ['incident_date' => '2026-09-12'], $foundPlace)
    );
    $location = array_column($c['signals'], 'matched', 'key')['location'];

    return [$location, matching_is_worth_suggesting($c), $c['score']];
};
$show = fn (array $r): string => ($r[0] ? 'location y' : 'location n') . ', score ' . $r[2] . ', ' . ($r[1] ? 'suggested' : 'not suggested');

$metro = ['province' => 'Metro Manila'];

$r = $pair(['city' => 'Pasig City'] + $metro, ['city' => 'Pasig'] + $metro);
$check('CITY-1', '"Pasig City" and "Pasig", same province, no pins: the same place', $r[0] && $r[1], $show($r));

$r = $pair(['city' => 'Pasig City'] + $metro, ['city' => 'Pasig', 'province' => 'Rizal']);
$check('CITY-2', '"Pasig City" and "Pasig", different provinces: not the same place', !$r[0] && !$r[1], $show($r));

$r = $pair(['city' => 'Pasig  City'] + $metro, ['city' => 'pasig city '] + $metro);
$check('CITY-3', 'Case and repeated spaces never matter', $r[0], $show($r));

// Both pinned, about 1 km apart, city names that do not match: distance decides.
$r = $pair(['city' => 'Pasig City', 'latitude' => 14.5764, 'longitude' => 121.0851] + $metro,
    ['city' => 'Somewhere Else', 'latitude' => 14.5850, 'longitude' => 121.0851] + $metro);
$check('CITY-4a', 'Both pinned 1 km apart, city names differ: distance says match', $r[0], $show($r));
$r = $pair(['city' => 'Pasig City', 'latitude' => 14.5764, 'longitude' => 121.0851] + $metro,
    ['city' => 'Pasig City', 'latitude' => 14.8000, 'longitude' => 121.0851] + $metro);
$check('CITY-4b', 'Both pinned 25 km apart, same city name: distance says no', !$r[0], $show($r));

$r = $pair(['city' => 'Pasig City'] + $metro, ['city' => 'Makati City'] + $metro);
$check('CITY-5', 'Two different cities in the same province: not the same place', !$r[0], $show($r));

$r = $pair(['city' => 'Quezon City'] + $metro, ['city' => 'Quezon', 'province' => 'Quezon']);
$check('CITY-6', '"Quezon City", Metro Manila and "Quezon", Quezon province: kept apart', !$r[0], $show($r));

$r = $pair(['city' => 'Cebu City', 'province' => 'Cebu'], ['city' => 'Cebu', 'province' => 'Cebu']);
$check('CITY-7', '"Cebu City" and "Cebu", both Cebu province: the same place', $r[0], $show($r));

$r = $pair(['city' => 'Davao City', 'province' => 'Davao del Sur'], ['city' => 'davao', 'province' => 'Davao  del Sur']);
$check('CITY-8', '"Davao City" and "davao", same province spelled with extra space: the same place', $r[0], $show($r));

$r = $pair(['city' => 'Pasig City', 'province' => ''], ['city' => 'Pasig', 'province' => '']);
$check('CITY-9', 'No province on either side: "City" is not dropped', !$r[0], $show($r));

$r = $pair(['city' => 'City'] + $metro, ['city' => ''] + $metro);
$check('CITY-10', 'A bare "City" does not match an empty name', !$r[0], $show($r));

echo "\n" . ($total - $failed) . "/{$total} passed\n";
exit($failed ? 1 : 0);
