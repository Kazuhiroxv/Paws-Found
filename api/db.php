<?php
/**
 * Database connection.
 *
 * PDO rather than mysqli, for one reason that matters more than any other:
 * named placeholders in prepared statements. Every query in this API sends the
 * SQL and the values separately, so a value can never be read as SQL. That is
 * what protects us from injection — not escaping, not filtering the input.
 *
 * The connection is created once and reused for the life of the request.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Is there an open transaction on the connection, if one was ever made?
 *
 * Deliberately does NOT open a connection to find out — json_response() asks
 * this on every error, including errors raised before the database was ever
 * touched, and connecting just to answer "no" would turn a validation failure
 * into a database round trip.
 */
function db_has_open_transaction(): bool
{
    return db_connected() && db()->inTransaction();
}

/** Records, and reports, whether db() has actually opened a connection yet. */
function db_connected(?bool $value = null): bool
{
    static $connected = false;

    if ($value !== null) {
        $connected = $value;
    }

    return $connected;
}

function db(): PDO
{
    // Held between calls within the same request; PHP throws the whole thing
    // away when the request ends.
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        // Throw on error instead of returning false. Silent failures are how
        // bugs survive to the demonstration.
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,

        // Return plain associative arrays; json_encode understands them.
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,

        // Use MySQL's real prepared statements rather than PDO emulating them
        // by building a string. With emulation off, the value genuinely never
        // touches the SQL text.
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Timestamps in UTC on every connection. The columns are TIMESTAMP, which
    // MySQL hands back in the connection's time zone with no marker: Railway's
    // was UTC and XAMPP's the computer's (+08:00), so the same instant came
    // back as two different strings. The frontend reads these as UTC
    // (src/utils/date.js). A no-op where the server is already UTC.
    $pdo->exec("SET time_zone = '+00:00'");

    db_connected(true);

    return $pdo;
}
