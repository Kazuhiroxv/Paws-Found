<?php
/**
 * The matching algorithm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO AI. This compares two reports attribute by attribute and adds up the
 * weights of the ones that agree. Every point in a score can be traced to a
 * specific signal, which is the whole idea: a person is shown *why* two reports
 * might be the same animal, not just a number (CLAUDE.md §6.5, §26).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A score is a suggestion, never a conclusion. Nothing here decides anything —
 * a Pet Coordinator verifies ownership before a handover is arranged.
 *
 * WHY THIS IS ON THE SERVER. The same algorithm existed in JavaScript, but it
 * was never reached: nothing called it, so filing a report produced no
 * suggestions at all. Running it here means it happens whenever a report is
 * created, including by a request that never went near the interface. It also
 * means there is one copy of the rules rather than two that can drift apart.
 *
 * The weights and thresholds are provisional and belong to the team
 * (CLAUDE.md §6.5). They are constants at the top of this file for that reason.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/** Provisional weights, totalling 100. */
const MATCH_WEIGHTS = [
    'species' => 25,
    'location' => 20,
    'breed' => 15,
    'color' => 15,
    'size' => 10,
    'date' => 10,
    'characteristics' => 5,
];

/** Two reports this far apart or closer count as nearby. */
const MATCH_MAX_DISTANCE_KM = 15;

/** A found report this many days either side of a loss still counts as close. */
const MATCH_MAX_DAY_GAP = 14;

/**
 * Below this, a suggestion is too weak to be worth anyone's attention.
 *
 * Species and location are already required, which puts a floor of 45 on
 * anything considered at all — so this asks for at least 20 further points of
 * agreement on top of "same animal, same area".
 */
const MATCH_MIN_SCORE = 65;

/** A report is only compared while it is still open. */
const MATCH_OPEN_STATUSES = ['active', 'possible_match'];

/**
 * Words too common to mean anything when both reports use them. Size words have
 * their own signal; counting them here too would score the same agreement twice.
 */
const MATCH_STOP_WORDS = [
    'with', 'that', 'this', 'have', 'from', 'both', 'very', 'over', 'near',
    'some', 'left', 'right', 'front', 'back', 'about', 'around', 'looks',
    'wearing', 'small', 'medium', 'large',
];

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * Compare one report against every open report of the opposite kind, and store
 * the pairings worth suggesting.
 *
 * Called after a report is filed. Returns the pairings created, newest score
 * first, so the caller can say how many were found.
 */
function generate_matches_for_report(int $reportId): array
{
    // A pairing that should have appeared and did not can be traced: with
    // MATCH_DEBUG on, one line per filing says which candidates the query
    // returned, how each scored and what was stored. A failure is always
    // logged, with the stage it stopped at. Report ids, scores and yes/no
    // only; nothing about the people or where they are.
    $trace = ['report=' . $reportId];
    $stage = 'load';

    try {
        return matching_generate($reportId, $trace, $stage);
    } catch (Throwable $exception) {
        $sqlState = $exception instanceof PDOException ? ($exception->errorInfo[0] ?? $exception->getCode()) : '-';
        matching_log($trace, "FAILED at {$stage}: " . get_class($exception) . " sqlstate={$sqlState} " . $exception->getMessage(), true);
        throw $exception;
    }
}

/** The work itself; `$trace` and `$stage` are filled in as it goes, for the log. */
function matching_generate(int $reportId, array &$trace, string &$stage): array
{
    $report = matching_load_report($reportId);

    if ($report === null || !in_array($report['status'], MATCH_OPEN_STATUSES, true)) {
        matching_log($trace, $report === null ? 'report not found' : "not open ({$report['status']})");
        return [];
    }

    $trace[] = "{$report['report_type']}/{$report['status']}/{$report['species']}";
    $stage = 'candidates';

    $isLost = $report['report_type'] === 'lost';
    $opposite = $isLost ? 'found' : 'lost';

    // Species is a gate, so filtering on it in SQL avoids comparing a report
    // against every cat in the country to discover it is a dog.
    $statement = db()->prepare(
        'SELECT r.report_id, r.user_id, r.report_type, r.status,
                c.category_code AS species,
                b.breed_name AS breed,
                r.pet_size AS size, r.primary_color, r.secondary_color,
                r.distinct_features, r.incident_date,
                l.city, l.province, l.latitude, l.longitude
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
      LEFT JOIN pet_breeds b     ON b.breed_id = r.breed_id
           JOIN locations l      ON l.location_id = r.location_id
          WHERE r.report_type = :type
            AND r.status IN ("active", "possible_match")
            AND c.category_code = :species
            AND r.report_id <> :self
            AND r.report_id NOT IN (
                  SELECT CASE WHEN m.lost_report_id = :a THEN m.found_report_id
                              ELSE m.lost_report_id END
                    FROM match_claims m
                   WHERE m.lost_report_id = :b OR m.found_report_id = :c
                )'
    );
    $statement->execute([
        ':type' => $opposite,
        ':species' => $report['species'],
        ':self' => $reportId,
        ':a' => $reportId,
        ':b' => $reportId,
        ':c' => $reportId,
    ]);

    $candidates = $statement->fetchAll();
    $trace[] = 'candidates=[' . implode(',', array_column($candidates, 'report_id')) . ']';
    $stage = 'compare';

    $suggestions = [];

    foreach ($candidates as $candidate) {
        $lost = $isLost ? $report : $candidate;
        $found = $isLost ? $candidate : $report;

        $comparison = compare_reports($lost, $found);
        $worth = matching_is_worth_suggesting($comparison);
        $gate = array_column($comparison['signals'], 'matched', 'key');
        $trace[] = sprintf(
            '%d:score=%d,species=%s,location=%s,suggest=%s',
            $candidate['report_id'],
            $comparison['score'],
            $gate['species'] ? 'y' : 'n',
            $gate['location'] ? 'y' : 'n',
            $worth ? 'y' : 'n'
        );

        if (!$worth) {
            continue;
        }

        $suggestions[] = [
            'lost' => $lost,
            'found' => $found,
            'score' => $comparison['score'],
            'signals' => $comparison['signals'],
        ];
    }

    // Strongest first, so the coordinator's queue leads with the best lead.
    usort($suggestions, fn ($a, $b) => $b['score'] <=> $a['score']);

    $stage = 'store (' . count($suggestions) . ')';
    $created = matching_store($suggestions);
    $trace[] = 'stored=[' . implode(',', array_column($created, 'match_id')) . ']';
    matching_log($trace, 'ok');

    return $created;
}

/**
 * Write the trace as one line, prefixed so it can be found among the rest.
 * Routine outcomes only with MATCH_DEBUG on; a failure always.
 */
function matching_log(array $trace, string $outcome, bool $isFailure = false): void
{
    if (!$isFailure && !MATCH_DEBUG) {
        return;
    }

    error_log('[pawsandfound][matching] ' . implode(' ', $trace) . ' -> ' . $outcome);
}

/**
 * Write the pairings, tell both reporters, and move both reports on.
 *
 * One transaction for the lot. A pairing whose signals failed to save would be
 * a score with no explanation behind it, which is the one thing this feature
 * must never produce.
 */
function matching_store(array $suggestions): array
{
    if ($suggestions === []) {
        return [];
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $insertMatch = $pdo->prepare(
            'INSERT INTO match_claims (lost_report_id, found_report_id, match_score, match_status)
                  VALUES (:lost, :found, :score, "suggested")'
        );
        $insertSignal = $pdo->prepare(
            'INSERT INTO match_signals (match_id, signal_key, is_matched, weight, detail)
                  VALUES (:match, :key, :matched, :weight, :detail)'
        );
        $notify = $pdo->prepare(
            'INSERT INTO notifications (user_id, notification_type, title, body, report_id, match_id)
                  VALUES (:user, "match_suggested", :title, :body, :report, :match)'
        );

        $created = [];

        foreach ($suggestions as $suggestion) {
            $insertMatch->execute([
                ':lost' => $suggestion['lost']['report_id'],
                ':found' => $suggestion['found']['report_id'],
                ':score' => $suggestion['score'],
            ]);
            $matchId = (int) $pdo->lastInsertId();

            foreach ($suggestion['signals'] as $signal) {
                $insertSignal->execute([
                    ':match' => $matchId,
                    ':key' => $signal['key'],
                    ':matched' => $signal['matched'] ? 1 : 0,
                    ':weight' => $signal['weight'],
                    ':detail' => $signal['detail'],
                ]);
            }

            // Both people are told, because either of them may recognise the
            // other's pet. The wording is a suggestion, never a conclusion.
            foreach ([$suggestion['lost'], $suggestion['found']] as $side) {
                if (!wants_notification((int) $side['user_id'], 'match_suggested')) {
                    continue;
                }

                $notify->execute([
                    ':user' => $side['user_id'],
                    ':title' => 'A possible match was found',
                    ':body' => 'A report shares ' . $suggestion['score'] .
                        '% of the details with yours. Review it to see whether it could be the same pet.',
                    ':report' => $side['report_id'],
                    ':match' => $matchId,
                ]);
            }

            matching_mark_possible($suggestion['lost']['report_id'], $suggestion['lost']['status']);
            matching_mark_possible($suggestion['found']['report_id'], $suggestion['found']['status']);

            $created[] = ['match_id' => $matchId, 'score' => $suggestion['score']];
        }

        $pdo->commit();

        return $created;
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}

/**
 * Move a report from Active to Possible Match.
 *
 * Left alone if it is already there, so a second suggestion does not write a
 * meaningless "possible_match -> possible_match" line into the case history.
 * The history entry records no user, because no user did this — the schema
 * allows a null actor for exactly this reason.
 */
function matching_mark_possible(int $reportId, string $currentStatus): void
{
    if ($currentStatus !== 'active') {
        return;
    }

    $update = db()->prepare(
        'UPDATE pet_reports SET status = "possible_match" WHERE report_id = :id AND status = "active"'
    );
    $update->execute([':id' => $reportId]);

    log_status_change($reportId, null, 'active', 'possible_match', 'A possible match was found.');
}

function matching_load_report(int $reportId): ?array
{
    $statement = db()->prepare(
        'SELECT r.report_id, r.user_id, r.report_type, r.status,
                c.category_code AS species,
                b.breed_name AS breed,
                r.pet_size AS size, r.primary_color, r.secondary_color,
                r.distinct_features, r.incident_date,
                l.city, l.province, l.latitude, l.longitude
           FROM pet_reports r
           JOIN pet_categories c ON c.category_id = r.category_id
      LEFT JOIN pet_breeds b     ON b.breed_id = r.breed_id
           JOIN locations l      ON l.location_id = r.location_id
          WHERE r.report_id = :id'
    );
    $statement->execute([':id' => $reportId]);
    $row = $statement->fetch();

    return $row ?: null;
}

// -----------------------------------------------------------------------------
// The comparison
// -----------------------------------------------------------------------------

/**
 * Should this comparison be shown at all?
 *
 * Score alone is not enough. Species and location act as gates, because no
 * amount of agreement elsewhere makes a cat the same animal as a dog, or makes
 * a pet found 800 km away the one that went missing here.
 */
function matching_is_worth_suggesting(array $comparison): bool
{
    $matched = function (string $key) use ($comparison): bool {
        foreach ($comparison['signals'] as $signal) {
            if ($signal['key'] === $key) {
                return $signal['matched'];
            }
        }

        return false;
    };

    return $matched('species')
        && $matched('location')
        && $comparison['score'] >= MATCH_MIN_SCORE;
}

/**
 * Compare a lost report with a found report.
 *
 * The score is the sum of the weights of the matched signals, so it is always
 * explainable by the list itself.
 */
function compare_reports(array $lost, array $found): array
{
    $signals = [
        matching_species_signal($lost, $found),
        matching_location_signal($lost, $found),
        matching_breed_signal($lost, $found),
        matching_color_signal($lost, $found),
        matching_size_signal($lost, $found),
        matching_date_signal($lost, $found),
        matching_characteristics_signal($lost, $found),
    ];

    $score = 0;
    foreach ($signals as $signal) {
        if ($signal['matched']) {
            $score += $signal['weight'];
        }
    }

    return ['score' => $score, 'signals' => $signals];
}

function matching_species_signal(array $lost, array $found): array
{
    $matched = matching_normalise($lost['species']) === matching_normalise($found['species']);

    return [
        'key' => 'species',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['species'],
        'detail' => $matched
            ? 'Both reports describe a ' . matching_normalise($found['species']) . '.'
            : 'The reports describe different kinds of animal.',
    ];
}

/**
 * Distance when both reports have coordinates, city name otherwise.
 *
 * Reports carry approximate, barangay-level coordinates (CLAUDE.md §14), so
 * this is proximity of areas, not of addresses.
 */
function matching_location_signal(array $lost, array $found): array
{
    $distance = matching_distance_km(
        $lost['latitude'], $lost['longitude'],
        $found['latitude'], $found['longitude']
    );

    if ($distance !== null) {
        $matched = $distance <= MATCH_MAX_DISTANCE_KM;
        $howFar = $distance < 1 ? 'less than a kilometre' : 'about ' . round($distance) . ' km';

        return [
            'key' => 'location',
            'matched' => $matched,
            'weight' => MATCH_WEIGHTS['location'],
            'detail' => $matched
                ? "The two areas are {$howFar} apart."
                : "The two areas are {$howFar} apart, which is further than we treat as nearby.",
        ];
    }

    // No coordinates on one side — fall back to the city.
    $matched = matching_same_city($lost, $found);

    return [
        'key' => 'location',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['location'],
        'detail' => $matched
            ? 'Both reports are in ' . $found['city'] . '.'
            : $lost['city'] . ' and ' . $found['city'] . ' are different areas.',
    ];
}

/**
 * Whether two reports name the same city, for when there is no map pin.
 *
 * Case and spacing never matter. "Pasig City" and "Pasig" are the same place,
 * but only when both reports give the same province: "Quezon City" (Metro
 * Manila) and "Quezon" (the province) are not, and neither are a city and a
 * town of the same name elsewhere. Nothing looser than that: no guessing at
 * spelling, which would pair reports from different places.
 */
function matching_same_city(array $lost, array $found): bool
{
    $lostCity = matching_place($lost['city']);
    $foundCity = matching_place($found['city']);

    if ($lostCity === $foundCity) {
        return true;
    }

    $lostProvince = matching_place($lost['province'] ?? '');
    if ($lostProvince === '' || $lostProvince !== matching_place($found['province'] ?? '')) {
        return false;
    }

    $withoutCity = fn (string $name): string => preg_replace('/ city$/', '', $name) ?? $name;

    return $withoutCity($lostCity) !== '' && $withoutCity($lostCity) === $withoutCity($foundCity);
}

/** A place name for comparing: lower case, trimmed, single spaces. */
function matching_place(mixed $value): string
{
    return preg_replace('/\s+/', ' ', matching_normalise($value)) ?? '';
}

function matching_breed_signal(array $lost, array $found): array
{
    $lostBreed = matching_normalise($lost['breed']);
    $foundBreed = matching_normalise($found['breed']);
    $matched = $lostBreed !== '' && $lostBreed === $foundBreed;

    return [
        'key' => 'breed',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['breed'],
        'detail' => $matched
            ? 'Both reports say ' . $found['breed'] . '.'
            : matching_describe_difference('breed', $lost['breed'], $found['breed']),
    ];
}

/** The main colour must agree, and any secondary colours given must agree too. */
function matching_color_signal(array $lost, array $found): array
{
    $primaryMatches = matching_normalise($lost['primary_color']) === matching_normalise($found['primary_color']);
    $lostSecondary = matching_normalise($lost['secondary_color']);
    $foundSecondary = matching_normalise($found['secondary_color']);
    $secondaryMatches = $lostSecondary === '' || $foundSecondary === '' || $lostSecondary === $foundSecondary;
    $matched = $primaryMatches && $secondaryMatches;

    if ($matched) {
        $detail = 'Both reports describe a ' . matching_normalise($found['primary_color']) . ' pet.';
    } elseif ($primaryMatches) {
        $detail = 'Main colour matches (' . matching_normalise($found['primary_color']) .
            '), but the second colour differs: ' . $lost['secondary_color'] . ' and ' . $found['secondary_color'] . '.';
    } else {
        $detail = matching_describe_difference('main colour', $lost['primary_color'], $found['primary_color']);
    }

    return [
        'key' => 'color',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['color'],
        'detail' => $detail,
    ];
}

function matching_size_signal(array $lost, array $found): array
{
    $matched = matching_normalise($lost['size']) !== ''
        && matching_normalise($lost['size']) === matching_normalise($found['size']);

    return [
        'key' => 'size',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['size'],
        'detail' => $matched
            ? 'Both reports say ' . matching_normalise($found['size']) . '.'
            : matching_describe_difference('size', $lost['size'], $found['size']),
    ];
}

/**
 * A pet is usually found within a couple of weeks of going missing, and a
 * sighting before the loss cannot be the same event.
 */
function matching_date_signal(array $lost, array $found): array
{
    $gap = matching_day_gap($lost['incident_date'], $found['incident_date']);

    if ($gap === null) {
        return [
            'key' => 'date',
            'matched' => false,
            'weight' => MATCH_WEIGHTS['date'],
            'detail' => 'One of the reports has no usable date.',
        ];
    }

    $matched = $gap >= 0 && $gap <= MATCH_MAX_DAY_GAP;

    if ($gap < 0) {
        $detail = 'The pet was found ' . abs($gap) . ' days before it was reported missing.';
    } elseif ($matched) {
        $detail = $gap === 0
            ? 'Found on the same day.'
            : 'Found ' . $gap . ' day' . ($gap === 1 ? '' : 's') . ' after going missing.';
    } else {
        $detail = 'Found ' . $gap . ' days after going missing, which is a long gap.';
    }

    return [
        'key' => 'date',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['date'],
        'detail' => $detail,
    ];
}

/**
 * Do the two descriptions of distinguishing features share anything specific?
 *
 * Deliberately crude — a shared meaningful word such as "collar", "scar" or
 * "notched". It is the smallest signal for a reason: it is the least reliable.
 */
function matching_characteristics_signal(array $lost, array $found): array
{
    $shared = matching_shared_words($lost['distinct_features'], $found['distinct_features']);
    $matched = $shared !== [];

    return [
        'key' => 'characteristics',
        'matched' => $matched,
        'weight' => MATCH_WEIGHTS['characteristics'],
        'detail' => $matched
            ? 'Both mention: ' . implode(', ', array_slice($shared, 0, 3)) . '.'
            : 'The distinctive features described do not obviously overlap.',
    ];
}

// -----------------------------------------------------------------------------
// Small shared pieces
// -----------------------------------------------------------------------------

function matching_normalise(mixed $value): string
{
    return strtolower(trim((string) ($value ?? '')));
}

function matching_describe_difference(string $what, mixed $lostValue, mixed $foundValue): string
{
    if (matching_normalise($lostValue) === '' || matching_normalise($foundValue) === '') {
        return "Only one report gives a {$what}.";
    }

    return "Different {$what}: {$lostValue} and {$foundValue}.";
}

/** Meaningful words the two descriptions have in common. */
function matching_shared_words(mixed $a, mixed $b): array
{
    $tokens = function (mixed $text): array {
        $clean = preg_replace('/[^a-z\s]/', ' ', matching_normalise($text)) ?? '';
        $words = preg_split('/\s+/', $clean, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_unique(array_filter(
            $words,
            fn ($word) => strlen($word) >= 4 && !in_array($word, MATCH_STOP_WORDS, true)
        ));
    };

    return array_values(array_intersect($tokens($b), $tokens($a)));
}

/**
 * Whole days from the loss to the find. Negative means the pet was found before
 * it went missing, which rules the pairing out.
 */
function matching_day_gap(mixed $lostDate, mixed $foundDate): ?int
{
    if (!$lostDate || !$foundDate) {
        return null;
    }

    $lost = date_create_immutable((string) $lostDate);
    $found = date_create_immutable((string) $foundDate);

    if ($lost === false || $found === false) {
        return null;
    }

    return (int) $lost->diff($found)->format('%r%a');
}

/**
 * Great-circle distance between two report locations, or null when either has
 * no coordinates. Standard haversine formula.
 */
function matching_distance_km(mixed $lat1, mixed $lng1, mixed $lat2, mixed $lng2): ?float
{
    if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) {
        return null;
    }

    $earthRadiusKm = 6371;

    $dLat = deg2rad((float) $lat2 - (float) $lat1);
    $dLng = deg2rad((float) $lng2 - (float) $lng1);
    $a = deg2rad((float) $lat1);
    $b = deg2rad((float) $lat2);

    $h = sin($dLat / 2) ** 2 + sin($dLng / 2) ** 2 * cos($a) * cos($b);

    return 2 * $earthRadiusKm * asin(sqrt($h));
}
