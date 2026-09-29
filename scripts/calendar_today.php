<?php
/**
 * Which day "today" is, and which zone the database speaks.
 *
 *   php scripts/calendar_today.php        (npm run test:calendar)
 *
 * An incident date is a Philippine calendar day, but the server runs in UTC,
 * which is still on yesterday until 8 AM in Manila. The API used to compare
 * with date('Y-m-d') and so refused a report dated today every morning.
 * app_today() takes an injected clock, so the boundary is tested exactly
 * rather than whenever the suite happens to run. The last checks ask the
 * database which zone the connection uses. Needs the local database for those;
 * changes no data.
 */
require __DIR__ . '/../api/helpers.php';

$failed = 0;
$total = 0;
$check = function (string $id, string $description, bool $ok, string $detail = '') use (&$failed, &$total): void {
    $total++;
    if (!$ok) {
        $failed++;
    }
    printf("%s  %-5s %s%s\n", $ok ? 'PASS' : 'FAIL', $id, $description, $detail !== '' ? "  ({$detail})" : '');
};
$future = fn (string $date, DateTimeImmutable $now): bool => $date > app_today($now);
$utc = fn (string $when): DateTimeImmutable => new DateTimeImmutable($when, new DateTimeZone('UTC'));

$zoneBefore = date_default_timezone_get();

// 22:00 UTC on the 29th is 06:00 on the 30th in Manila.
$morning = $utc('2026-09-29 22:00:00');
$check('CT-1', 'At 06:00 Manila (22:00 UTC the day before), today is the Manila date',
    app_today($morning) === '2026-09-30', app_today($morning));
$check('CT-2', '...a report dated that day is accepted', !$future('2026-09-30', $morning));
$check('CT-3', '...the day before is accepted', !$future('2026-09-29', $morning));
$check('CT-4', '...the day after is refused as future', $future('2026-10-01', $morning));
$check('CT-5', '...where the old UTC comparison refused a report dated today',
    '2026-09-30' > $morning->format('Y-m-d'));

// 01:00 UTC on the 30th is 09:00 in Manila: both calendars agree again.
$later = $utc('2026-09-30 01:00:00');
$check('CT-6', 'At 09:00 Manila the same date is still accepted', !$future('2026-09-30', $later) && app_today($later) === '2026-09-30');

$check('CT-7', 'Asking for the Manila date leaves the PHP time zone alone', date_default_timezone_get() === $zoneBefore, $zoneBefore);

// The connection itself: UTC, whatever the database server's own zone is.
$zone = db()->query('SELECT @@session.time_zone')->fetchColumn();
$drift = db()->query('SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW())')->fetchColumn();
$check('CT-8', 'Every database connection uses UTC', $zone === '+00:00' && (int) $drift === 0, "time_zone {$zone}, NOW() - UTC {$drift}s");

echo "\n" . ($total - $failed) . "/{$total} passed\n";
exit($failed ? 1 : 0);
