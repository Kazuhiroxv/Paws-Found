"""
Correction 3 through the API: the lists a report is chosen from, and what a
hand-built request can and cannot get past them.

    python scripts/report_controls.py        (npm run test:controls)

  BR   breeds: the suggested list per species, typed breeds kept but unlisted
  CO   colours: the list, codes or names in, the listed name stored
  PH   areas and cities: PSGC, dependent, the names written by the server
  PSGC PSA's official counts kept apart from the 84-entry area list (3A)
  RS   size: Extra Large (XL)
  RN, RD, RT   the name, description and time rules, enforced by the API
  CONTACT      a phone number is never published, whatever is sent
  MAP          a pin must be inside the Philippines
  MG   the database has migration 009's reference data, and the seed's places

Local only: it files reports and edits rows, then restores the demonstration
data. Never point it at the hosted site.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import check, file_report, reseed, results, session, sql  # noqa: E402

NCR, MAKATI, PASAY = '1300000000', '1380300000', '1381100000'
CEBU, CEBU_CITY = '0702200000', '0730600000'


def data(role, path):
    code, payload = session(role).call('GET', path)
    return code, payload.get('data')


def breeds():
    C = 'BR. Breeds'
    code, dogs = data('guest', '/reference/breeds?species=dog')
    listed = set((sql("SELECT b.breed_name FROM pet_breeds b JOIN pet_categories c USING (category_id) "
                      "WHERE c.category_code = 'dog' AND b.is_listed = TRUE;") or '').splitlines())
    names = [b['name'] for b in dogs or []]
    check(C, 'BR-1', 'The dog list is exactly the listed dog breeds, from MySQL', 'listed only',
          f'{len(names)} of {len(listed)}', code == 200 and set(names) == listed and len(names) > 10)
    _, cats = data('guest', '/reference/breeds?species=cat')
    cat_names = [b['name'] for b in cats or []]
    check(C, 'BR-2', 'Filtered by species: no dog breed among the cats; "Mixed breed" last', 'yes',
          ','.join(cat_names[-2:]), 'Shih Tzu' not in cat_names and cat_names[-1:] == ['Mixed breed'])
    code, _ = session('guest').call('GET', '/reference/breeds')
    check(C, 'BR-3', 'The breed list needs a species', 422, code, code == 422)

    rid, code = file_report('customer', breed='Shiba Inu')
    row = sql("SELECT CONCAT(b.breed_name, '|', b.is_listed) FROM pet_reports r "
              f"JOIN pet_breeds b ON b.breed_id = r.breed_id WHERE r.report_id = {rid};")
    _, after = data('guest', '/reference/breeds?species=dog')
    check(C, 'BR-4', 'A typed breed is kept on the report but not listed for anyone else', 'Shiba Inu|0, unlisted',
          f'{row}, {"listed" if any(b["name"] == "Shiba Inu" for b in after or []) else "unlisted"}',
          code == 200 and row == 'Shiba Inu|0' and not any(b['name'] == 'Shiba Inu' for b in after or []))
    before = sql('SELECT COUNT(*) FROM pet_breeds;')
    rid, code = file_report('customer', breed='shih tzu')
    stored = sql(f'SELECT b.breed_name FROM pet_reports r JOIN pet_breeds b ON b.breed_id = r.breed_id '
                 f'WHERE r.report_id = {rid};')
    check(C, 'BR-5', 'A listed breed typed in another case uses the listed row', 'Shih Tzu, no new row',
          f'{stored}, {before}->{sql("SELECT COUNT(*) FROM pet_breeds;")}',
          stored == 'Shih Tzu' and sql('SELECT COUNT(*) FROM pet_breeds;') == before)
    rid, code = file_report('customer', breed='')
    check(C, 'BR-6', '"Not sure" (no breed) is accepted when a feature is given', '200, NULL',
          f'{code}, {sql(f"SELECT IFNULL(breed_id, %s) FROM pet_reports WHERE report_id = {rid};" % repr("NULL"))}',
          code == 200 and sql(f'SELECT breed_id IS NULL FROM pet_reports WHERE report_id = {rid};') == '1')


def colours():
    C = 'CO. Colours'
    code, rows = data('guest', '/reference/colours')
    codes = [r['code'] for r in rows or []]
    check(C, 'CO-1', 'The colour list: 17 colours with stable codes, "Other" last', '17, other last',
          f'{len(codes)}, {codes[-1] if codes else "-"}', code == 200 and len(codes) == 17 and codes[-1] == 'other')
    a, _ = file_report('customer', primary_color='black', secondary_color='WHITE')
    stored = sql(f"SELECT CONCAT(primary_color, '/', secondary_color) FROM pet_reports WHERE report_id = {a};")
    check(C, 'CO-2', 'A code or any case is stored as the listed name', 'Black/White', stored, stored == 'Black/White')
    _, code = file_report('customer', primary_color='Mauve')
    check(C, 'CO-3', 'A colour that is not listed is refused', 422, code, code == 422)
    _, code = file_report('customer', secondary_color='Sparkly')
    _, ok = file_report('customer', secondary_color='')
    check(C, 'CO-4', 'The second colour is optional, but must be listed if given', '422 then 200',
          f'{code} then {ok}', code == 422 and ok == 200)
    _, rows = data('guest', '/reports?colour=tan&per_page=50')
    colours_seen = {(r['primary_color'], r['secondary_color']) for r in rows or []}
    check(C, 'CO-5', 'Explore: a listed colour filters exactly, either colour field', 'every row has Tan',
          f'{len(rows or [])} rows', bool(rows) and all('Tan' in pair for pair in colours_seen))


def places():
    C = 'PH. Areas and cities'
    code, areas = data('guest', '/reference/areas')
    names = {a['name'] for a in areas or []}
    check(C, 'PH-1', 'The area list: 84 entries, Metro Manila among them, each with a type', '84, typed',
          len(areas or []), code == 200 and len(areas) == 84 and 'Metro Manila' in names
          and all(a.get('type') in ('province', 'ncr', 'special_area') for a in areas))
    _, metro = data('guest', f'/reference/cities?area={NCR}')
    _, cebu = data('guest', f'/reference/cities?area={CEBU}')
    check(C, 'PH-2', 'Cities depend on the area: 17 in Metro Manila; City of Cebu under Cebu', '17, yes',
          f'{len(metro or [])}, {"yes" if any(c["code"] == CEBU_CITY for c in cebu or []) else "no"}',
          len(metro or []) == 17 and any(c['code'] == CEBU_CITY for c in cebu or []))
    _, code = file_report('customer', area_code=CEBU, city_code=MAKATI)
    check(C, 'PH-3', 'A city outside the chosen area is refused', 422, code, code == 422)
    _, code = file_report('customer', area_code=NCR, city_code='9999999999')
    _, blank = file_report('customer', area_code='', city_code='')
    check(C, 'PH-4', 'An unknown city code, or none, is refused', '422, 422', f'{code}, {blank}',
          code == 422 and blank == 422)
    # Sent by hand, so the typed names really are in the request.
    body = {'report_type': 'lost', 'species': 'dog', 'pet_name': 'Audit Dog', 'breed': 'Beagle',
            'size': 'medium', 'sex': 'male', 'primary_color': 'Brown', 'incident_date': '2026-09-09',
            'area_code': NCR, 'city_code': MAKATI, 'city': 'Somewhere Typed', 'province': 'Typed Province',
            'allow_platform_contact': True, 'location_label': 'Near the barangay hall',
            'description': 'Filed by the automated audit, to check the API end to end.'}
    _, payload = session('customer').call('POST', '/reports', body)
    rid = (payload.get('data') or {}).get('report_id')
    stored = sql('SELECT CONCAT_WS("|", l.city, l.province, l.city_code) FROM pet_reports r '
                 f'JOIN locations l ON l.location_id = r.location_id WHERE r.report_id = {rid};')
    check(C, 'PH-5', 'The names stored are written from the list, never taken from the request',
          'City of Makati|Metro Manila|' + MAKATI, stored, stored == f'City of Makati|Metro Manila|{MAKATI}')
    _, rows = data('guest', f'/reports?area_code={CEBU}&per_page=50')
    _, city_rows = data('guest', f'/reports?city_code={MAKATI}&per_page=50')
    check(C, 'PH-6', 'Explore filters by area and by city code',
          'Cebu only; Makati only',
          f'{len(rows or [])} / {len(city_rows or [])}',
          bool(rows) and all(r['location']['area_code'] == CEBU for r in rows)
          and bool(city_rows) and all(r['location']['city_code'] == MAKATI for r in city_rows))


def psgc():
    """Correction 3A: PSA's facts kept apart from the application's grouping."""
    C = 'PSGC. Official facts vs the area list'
    _, areas = data('guest', '/reference/areas')
    areas = areas or []
    kinds = {k: [a for a in areas if a['type'] == k] for k in ('province', 'ncr', 'special_area')}
    check(C, 'PSGC1', "PSA's provinces: exactly 82 areas are of type province", 82,
          len(kinds['province']), len(kinds['province']) == 82)
    cities = sql('SELECT COUNT(*) FROM ph_cities WHERE is_city = TRUE;')
    municipalities = sql('SELECT COUNT(*) FROM ph_cities WHERE is_city = FALSE;')
    check(C, 'PSGC2', "PSA's cities: 149", 149, cities, cities == '149')
    check(C, 'PSGC3', "PSA's municipalities: 1,493", 1493, municipalities, municipalities == '1493')
    check(C, 'PSGC4', 'The area list is 82 provinces + Metro Manila (ncr) + the SGA (special_area) = 84',
          '82+1+1', f"{len(kinds['province'])}+{len(kinds['ncr'])}+{len(kinds['special_area'])}",
          len(areas) == 84 and len(kinds['ncr']) == 1 and len(kinds['special_area']) == 1
          and kinds['ncr'][0]['code'] == NCR and kinds['special_area'][0]['code'] == '1999900000')
    in_db = sql(f"SELECT area_type FROM ph_areas WHERE area_code = '{NCR}';")
    check(C, 'PSGC5', 'NCR is never typed a province: ncr in the database and in the API', 'ncr, ncr',
          f"{in_db}, {kinds['ncr'][0]['type'] if kinds['ncr'] else '-'}",
          in_db == 'ncr' and bool(kinds['ncr']) and kinds['ncr'][0]['name'] == 'Metro Manila')
    seen = {}
    for area in areas:
        _, rows = data('guest', f"/reference/cities?area={area['code']}")
        for row in rows or []:
            seen[row['code']] = row
    total = sql('SELECT COUNT(*) FROM ph_cities;')
    check(C, 'PSGC6', 'All 1,642 cities and municipalities are reachable through their area, once each',
          '1642 of 1642', f'{len(seen)} of {total}', len(seen) == 1642 and total == '1642')
    # The 32 seeded reports (ids 1-32); the checks above have filed more.
    resolved = sql('SELECT COUNT(*) FROM pet_reports r JOIN locations l ON l.location_id = r.location_id '
                   'JOIN ph_cities c ON c.city_code = l.city_code JOIN ph_areas a ON a.area_code = c.area_code '
                   'WHERE r.report_id <= 32;')
    count = sql('SELECT COUNT(*) FROM pet_reports WHERE report_id <= 32;')
    check(C, 'PSGC7', 'Every seeded report location resolves to a city and an area', '32 of 32',
          f'{resolved} of {count}', resolved == '32' and count == '32')
    hexed = sql("SELECT HEX(city_name) FROM ph_cities WHERE city_code = '1380200000';")
    via_api = seen.get('1380200000', {}).get('name')
    check(C, 'PSGC8', '"City of Las Piñas" is UTF-8 in MySQL and comes back intact from the API',
          'C3B1, City of Las Piñas', f'{"C3B1" if hexed and "C3B1" in hexed else hexed}, {via_api}',
          bool(hexed) and 'C3B1' in hexed and via_api == 'City of Las Piñas')
    renamed = {'1102324000': 'Sawata', '1004217000': 'Don Victoriano',
               '0201522000': 'Sanchez Mira', '1903638000': 'Tagoloan II'}
    got = {code: seen.get(code, {}).get('name') for code in renamed}
    check(C, 'PSGC10', 'The 30 June 2026 names: San Isidro is Sawata; three spellings corrected', 'all four',
          ', '.join(str(v) for v in got.values()), got == renamed)


def sizes():
    C = 'RS. Size'
    rid, code = file_report('customer', size='xl')
    check(C, 'RS-1', 'Extra Large is accepted and stored as "xl"', '200 xl',
          f'{code} {sql(f"SELECT pet_size FROM pet_reports WHERE report_id = {rid};")}',
          code == 200 and sql(f'SELECT pet_size FROM pet_reports WHERE report_id = {rid};') == 'xl')
    _, code = file_report('customer', size='huge')
    check(C, 'RS-2', 'A size outside the list is still refused', 422, code, code == 422)
    _, rows = data('guest', '/reports?size=xl&per_page=50')
    check(C, 'RS-3', 'Explore can filter by XL', 'only xl', len(rows or []),
          bool(rows) and all(r['size'] == 'xl' for r in rows))
    other, _ = file_report('customer', size='large')
    code, _ = session('customer').call('PUT', f'/reports/{other}', {'size': 'xl'})
    check(C, 'RS-4', 'An edit can change a size to XL', '200 xl',
          f'{code} {sql(f"SELECT pet_size FROM pet_reports WHERE report_id = {other};")}',
          code == 200 and sql(f'SELECT pet_size FROM pet_reports WHERE report_id = {other};') == 'xl')
    _, detail = data('finder', f'/reports/{rid}')
    check(C, 'RS-5', 'The detail returns "xl"', 'xl', (detail or {}).get('size'), (detail or {}).get('size') == 'xl')
    code, _ = session('guest').call('GET', '/reports?size=huge')
    check(C, 'RS-6', 'The size filter still refuses an unknown value', 422, code, code == 422)
    enum = sql("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'pawsandfound' "
               "AND TABLE_NAME = 'pet_reports' AND COLUMN_NAME = 'pet_size';")
    check(C, 'RS-7', 'The column allows xl and every older value', "enum('small','medium','large','xl')",
          enum, enum == "enum('small','medium','large','xl')")


def text_rules():
    C = 'RN/RD/RT. Name, description, time'
    _, one = file_report('customer', pet_name='A')
    _, two = file_report('customer', pet_name='Bo')
    check(C, 'RN-API-1', 'A one-letter lost pet name is refused; "Bo" is accepted', '422, 200',
          f'{one}, {two}', one == 422 and two == 200)
    _, dash = file_report('customer', pet_name='-')
    check(C, 'RN-API-2', 'A name with no letter or digit is refused', 422, dash, dash == 422)
    _, found = file_report('finder', report_type='found', pet_name=None)
    check(C, 'RN-API-3', 'A found report still needs no name', 200, found, found == 200)
    _, spaces = file_report('customer', description=' ' * 40)
    _, short = file_report('customer', description='Twenty-nine characters, near.')
    _, enough = file_report('customer', description='Exactly thirty characters here')
    check(C, 'RD-API-1', 'Forty spaces and 29 characters are refused; 30 are accepted', '422, 422, 200',
          f'{spaces}, {short}, {enough}', spaces == 422 and short == 422 and enough == 200)
    # Somewhere of its own, so no pairing makes it read-only before the edit.
    rid, _ = file_report('customer', city='Audit Description Edit City')
    code, payload = session('customer').call('PUT', f'/reports/{rid}', {'description': 'Too short.'})
    check(C, 'RD-API-2', 'An edit is held to the same minimum, and says which field', '422 description',
          f'{code} {",".join((payload.get("fields") or {}).keys())}',
          code == 422 and 'description' in (payload.get('fields') or {}))
    rid, code = file_report('customer', incident_time='13:05')
    check(C, 'RT-API-1', '1:05 PM arrives as 13:05 and is stored as TIME', '13:05:00',
          sql(f'SELECT incident_time FROM pet_reports WHERE report_id = {rid};'),
          sql(f'SELECT incident_time FROM pet_reports WHERE report_id = {rid};') == '13:05:00')
    _, code = file_report('customer', incident_time='1:05 PM')
    check(C, 'RT-API-2', 'The API takes 24-hour time only; "1:05 PM" is refused', 422, code, code == 422)
    rid, _ = file_report('customer', incident_time='')
    check(C, 'RT-API-3', 'No time stays no time (NULL)', 'NULL',
          sql(f'SELECT IFNULL(incident_time, "NULL") FROM pet_reports WHERE report_id = {rid};'),
          sql(f'SELECT incident_time IS NULL FROM pet_reports WHERE report_id = {rid};') == '1')


def contact():
    C = 'CONTACT. No public phone number'
    maria = sql("SELECT user_id FROM users WHERE email = 'maria.santos@example.com';")
    sql(f"UPDATE users SET contact_number = '+63 917 555 0101' WHERE user_id = {maria};")
    rid, code = file_report('customer', show_phone=True)
    check(C, 'CONTACT-1', 'A crafted show_phone=true is accepted but not stored', '200, 0',
          f'{code}, {sql(f"SELECT show_phone FROM pet_reports WHERE report_id = {rid};")}',
          code == 200 and sql(f'SELECT show_phone FROM pet_reports WHERE report_id = {rid};') == '0')
    sql(f'UPDATE pet_reports SET show_phone = 1 WHERE report_id = {rid};')
    _, other_view = data('finder', f'/reports/{rid}')
    _, own_view = data('customer', f'/reports/{rid}')
    _, staff_view = data('staff', f'/reports/{rid}')
    phones = [((v or {}).get('reporter') or {}).get('phone') for v in (other_view, own_view, staff_view)]
    check(C, 'CONTACT-2', 'Even with show_phone = 1 in the database, no report detail carries the number',
          'null x3', str(phones), phones == [None, None, None])
    check(C, 'CONTACT-3', "The owner's edit form is told the phone option is off", False,
          ((own_view or {}).get('contact_preferences') or {}).get('show_phone'),
          ((own_view or {}).get('contact_preferences') or {}).get('show_phone') is False)
    _, rows = data('guest', '/reports?per_page=50')
    leaked = [r['report_id'] for r in rows or [] if 'reporter' in r or 'phone' in str(r).lower()]
    check(C, 'CONTACT-4', 'The public list carries no contact details at all', 'none', leaked or 'none', not leaked)
    _, code = file_report('customer', allow_platform_contact=False, show_email=False, show_phone=True)
    check(C, 'CONTACT-5', 'The phone is not a way to be reached on its own', 422, code, code == 422)
    _, as_staff = data('staff', f'/users/{maria}')
    _, as_member = data('finder', f'/users/{maria}')
    check(C, 'CONTACT-6', 'A Pet Coordinator still sees the account phone; another member does not',
          'staff yes, member no',
          f'staff {"yes" if (as_staff or {}).get("contact_number") else "no"}, '
          f'member {"yes" if (as_member or {}).get("contact_number") else "no"}',
          bool((as_staff or {}).get('contact_number')) and not (as_member or {}).get('contact_number'))


def map_bounds():
    C = 'MAP. Pins inside the Philippines'
    cases = [
        ('MAP-API-1', 'A pin in Tokyo is refused', 35.68, 139.69, 422),
        ('MAP-API-2', 'A pin in Kalayaan (Pag-asa Island), Palawan, is accepted', 11.05, 114.28, 200),
        ('MAP-API-3', 'A pin in Batanes is accepted', 20.45, 121.97, 200),
        ('MAP-API-4', 'A pin in Tawi-Tawi is accepted', 5.03, 119.77, 200),
        ('MAP-API-5', 'A pin in Kota Kinabalu, Malaysia, is refused', 5.98, 116.07, 422),
        ('MAP-API-7', 'A pin in Sandakan, Malaysia, is refused', 5.84, 118.07, 422),
        ('MAP-API-8', 'A pin in Miangas, Indonesia, is refused', 5.56, 126.58, 422),
        ('MAP-API-9', 'The Turtle Islands (Taganak), Tawi-Tawi, are accepted', 6.08, 118.31, 200),
        ('MAP-API-10', 'Mangsee Islands, Balabac, Palawan, are accepted', 7.50, 117.30, 200),
        ('MAP-API-11', 'Sitangkai, Tawi-Tawi, is accepted', 4.66, 119.39, 200),
    ]
    for tid, desc, lat, lng, want in cases:
        _, code = file_report('customer', lat=lat, lng=lng)
        check(C, tid, desc, want, code, code == want)
    _, code = file_report('customer', lat=14.5, lng=None)
    check(C, 'MAP-API-6', 'Half a pin is refused', 422, code, code == 422)


def migration_state():
    C = 'MG. Reference data in the database'
    check(C, 'MG-1', 'Migration 009 is recorded', '009',
          sql("SELECT version FROM schema_migrations WHERE version = '009';"),
          sql("SELECT version FROM schema_migrations WHERE version = '009';") == '009')
    counts = sql('SELECT CONCAT((SELECT COUNT(*) FROM ph_areas), "/", (SELECT COUNT(*) FROM ph_cities), "/", '
                 '(SELECT COUNT(*) FROM pet_colours));')
    check(C, 'MG-2', 'Areas, cities and colours are all there', '84/1642/17', counts, counts == '84/1642/17')
    check(C, 'MG-3', 'Every seeded location has its PSGC code', '0 without',
          sql('SELECT COUNT(*) FROM locations WHERE city_code IS NULL;'),
          sql('SELECT COUNT(*) FROM locations WHERE city_code IS NULL;') == '0')
    las_pinas = sql("SELECT HEX(city_name) FROM ph_cities WHERE city_code = '1380200000';")
    check(C, 'MG-4', '"Las Piñas" is stored as UTF-8, not mojibake', 'C3B1 (ñ)',
          las_pinas, bool(las_pinas) and 'C3B1' in las_pinas)


if __name__ == '__main__':
    if sql('SELECT 1') != '1':
        print('The local database is not reachable; this suite needs it.')
        sys.exit(2)
    reseed()
    migration_state()
    breeds()
    colours()
    places()
    psgc()
    sizes()
    text_rules()
    contact()
    map_bounds()

    failed = [r for r in results if not r[5]]
    for cat, tid, desc, expected, actual, ok in results:
        print(f'{"PASS" if ok else "FAIL"}  {tid:<11} {desc}' + ('' if ok else f'  (expected {expected}, got {actual})'))
    print(f'\n{len(results) - len(failed)}/{len(results)} passed')
    reseed()
    sys.exit(0 if not failed else 1)
