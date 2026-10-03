<?php
/**
 * Reference lists for the report form and the Explore filters (Correction 3).
 *
 *   GET /api/reference/colours                     the colour list
 *   GET /api/reference/breeds?species=dog          the suggested breeds of one species
 *   GET /api/reference/areas                       the 84 areas: 82 provinces, Metro Manila, the SGA
 *   GET /api/reference/cities?area=0702200000      the cities and municipalities of one
 *
 * All public and read only: the lists are needed before anyone signs in, and
 * nothing in them is about a person. They come from the database, never from
 * the browser's code, so changing a list is a change to MySQL, not a redeploy.
 *
 * The places are PSA's Philippine Standard Geographic Code (as of 30 June
 * 2026); how they were loaded is in scripts/psgc_reference.py and migration
 * 009. An AREA is a province, or one of the two places PSA files under no
 * province: Metro Manila (NCR) and BARMM's Special Geographic Area. Each
 * comes with its type, so nothing presents Metro Manila as a province.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function handle_reference(string $method, ?string $identifier): never
{
    if ($method === 'GET') {
        match ($identifier) {
            'colours' => reference_colours(),
            'breeds' => reference_breeds(),
            'areas' => reference_areas(),
            'cities' => reference_cities(),
            default => null,
        };
    }

    json_error('No such endpoint.', 404);
}

function reference_colours(): never
{
    $rows = db()->query('SELECT colour_code, colour_name FROM pet_colours ORDER BY sort_order, colour_name')->fetchAll();

    json_response(['data' => array_map(fn ($row) => [
        'code' => $row['colour_code'],
        'name' => $row['colour_name'],
    ], $rows)]);
}

/**
 * The listed breeds of one species, "Mixed breed" last. A breed somebody once
 * typed is in pet_breeds too, but is_listed keeps it out of this list.
 */
function reference_breeds(): never
{
    $species = query_string_param('species');
    if ($species === null || preg_match('/^[a-z0-9-]{1,30}$/', $species) !== 1) {
        json_error("Say which species: 'species' is required.", 422);
    }

    $statement = db()->prepare(
        "SELECT b.breed_id, b.breed_name
           FROM pet_breeds b
           JOIN pet_categories c ON c.category_id = b.category_id
          WHERE c.category_code = :species AND b.is_listed = TRUE
          ORDER BY b.breed_name = 'Mixed breed', b.breed_name"
    );
    $statement->execute([':species' => $species]);

    json_response(['data' => array_map(fn ($row) => [
        'breed_id' => (int) $row['breed_id'],
        'name' => $row['breed_name'],
    ], $statement->fetchAll())]);
}

/** The 84 areas, by name, each with its type: 'province', 'ncr' or 'special_area'. */
function reference_areas(): never
{
    $rows = db()->query('SELECT area_code, area_name, area_type FROM ph_areas ORDER BY area_name')->fetchAll();

    json_response(['data' => array_map(fn ($row) => [
        'code' => $row['area_code'],
        'name' => $row['area_name'],
        'type' => $row['area_type'],
    ], $rows)]);
}

/**
 * The cities and municipalities of one area. Sorted as people look for
 * them: "City of Makati" under M, not among every other "City of".
 */
function reference_cities(): never
{
    $area = query_string_param('area');
    if ($area === null || preg_match('/^\d{10}$/', $area) !== 1) {
        json_error("Say which area: 'area' must be a 10-digit PSGC code.", 422);
    }

    $statement = db()->prepare(
        "SELECT city_code, city_name, is_city
           FROM ph_cities
          WHERE area_code = :area
          ORDER BY CASE WHEN city_name LIKE 'City of %' THEN SUBSTRING(city_name, 9) ELSE city_name END,
                   city_name"
    );
    $statement->execute([':area' => $area]);
    $rows = $statement->fetchAll();

    if ($rows === []) {
        json_error('No such area.', 404);
    }

    json_response(['data' => array_map(fn ($row) => [
        'code' => $row['city_code'],
        'name' => $row['city_name'],
        'is_city' => (bool) $row['is_city'],
    ], $rows)]);
}
