"""
A fresh install and an upgraded install must end up the same database.

    python scripts/migration_parity.py        (npm run test:migrations)

For each engine — MySQL 9.4 in strict mode (Docker, as Railway runs) and
XAMPP's MariaDB (scratch databases, never `pawsandfound`) — it builds two
databases:

    upgrade   production's schema and seed at 2947a43, then 008, then 009,
              then 009 again (a migration must survive being run twice)
    fresh     today's schema.sql + seed.sql

and requires them to agree: identical table structure, identical reference
rows (areas, cities, colours, listed breeds), the same counts, every seeded
location coded, and "Las Piñas" stored as UTF-8.

Correction 3A (PSGC9). Never touches Railway; needs Docker for the MySQL half.
"""
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE = '2947a43'   # what production runs
MARIADB = [r'C:\xampp\mysql\bin\mysql.exe', '-uroot', '-P3307', '-h127.0.0.1',
           '--default-character-set=utf8mb4']
MARIADB_DUMP = [r'C:\xampp\mysql\bin\mysqldump.exe', '-uroot', '-P3307', '-h127.0.0.1',
                '--no-data', '--skip-dump-date', '--skip-comments']

FACTS = """SELECT CONCAT_WS(' | ',
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()),
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'),
  (SELECT GROUP_CONCAT(version ORDER BY version) FROM schema_migrations),
  (SELECT GROUP_CONCAT(CONCAT(area_type, '=', n) ORDER BY area_type)
     FROM (SELECT area_type, COUNT(*) n FROM ph_areas GROUP BY area_type) t),
  (SELECT COUNT(*) FROM ph_cities),
  (SELECT COUNT(*) FROM pet_colours),
  (SELECT COUNT(*) FROM pet_breeds WHERE is_listed),
  (SELECT COUNT(*) FROM locations WHERE city_code IS NULL),
  (SELECT HEX(city_name) FROM ph_cities WHERE city_code = '1380200000'))"""
REFERENCE = """SELECT CONCAT_WS('|', area_code, area_name, area_type) FROM ph_areas ORDER BY 1;
SELECT CONCAT_WS('|', city_code, area_code, city_name, is_city) FROM ph_cities ORDER BY 1;
SELECT CONCAT_WS('|', colour_code, colour_name, sort_order) FROM pet_colours ORDER BY 1;
SELECT CONCAT_WS('|', c.category_code, b.breed_name) FROM pet_breeds b
  JOIN pet_categories c ON c.category_id = b.category_id WHERE b.is_listed ORDER BY 1;"""

results = []


def check(name, ok, detail=''):
    results.append(ok)
    print(f'{"PASS" if ok else "FAIL"}  {name}' + (f'  ({detail})' if detail else ''))


def files(folder):
    """The SQL each path imports, written to `folder`, in order."""
    def save(name, text):
        path = os.path.join(folder, name)
        with open(path, 'w', encoding='utf-8', newline='\n') as out:
            out.write(text)
        return path

    def show(path):
        return subprocess.run(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT, capture_output=True,
                              text=True, encoding='utf-8', check=True).stdout

    def current(path):
        with open(os.path.join(ROOT, path), encoding='utf-8') as source:
            return source.read()

    upgrade = [save('a-schema.sql', show('database/schema.sql')),
               save('b-seed.sql', show('database/seed.sql')),
               save('c-008.sql', current('database/migrations/008_split_user_names.sql')),
               save('d-009.sql', current('database/migrations/009_report_reference_data.sql'))]
    upgrade.append(upgrade[-1])
    fresh = [save('e-schema.sql', current('database/schema.sql')),
             save('f-seed.sql', current('database/seed.sql'))]
    return upgrade, fresh


def normalise(dump):
    dump = re.sub(r' AUTO_INCREMENT=\d+', '', dump)
    return re.sub(r'`?(c3p_\w+|pawsandfound)`?', 'DB', dump)


# ----------------------------------------------------------------- MySQL 9.4
def mysql94(upgrade, fresh):
    name = 'paws-parity-mysql94'
    subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
    subprocess.run(['docker', 'run', '-d', '--name', name, '-e', 'MYSQL_ROOT_PASSWORD=parity', 'mysql:9.4'],
                   check=True, capture_output=True)
    try:
        # The image boots a temporary server (no TCP port) to initialise,
        # stops it, then starts the real one. Only the second says port 3306.
        for _ in range(120):
            logs = subprocess.run(['docker', 'logs', name], capture_output=True, text=True, encoding='utf-8')
            if 'ready for connections' in logs.stderr + logs.stdout and 'port: 3306' in logs.stderr + logs.stdout:
                break
            time.sleep(2)

        def run(db, path=None, query=None):
            # Both paths create `pawsandfound`, so each runs in its own pass,
            # renamed on the way in.
            if path:
                with open(path, encoding='utf-8') as source:
                    sql = re.sub(r'\bpawsandfound\b', db, source.read())
                return subprocess.run(['docker', 'exec', '-i', name, 'mysql', '-uroot', '-pparity',
                                       '--default-character-set=utf8mb4'], input=sql, capture_output=True,
                                      text=True, encoding='utf-8')
            return subprocess.run(['docker', 'exec', name, 'mysql', '-uroot', '-pparity', '-N', '-B',
                                   '--default-character-set=utf8mb4', db, '-e', query],
                                  capture_output=True, text=True, encoding='utf-8')

        return compare('MySQL 9.4 (strict)', run,
                       lambda db: subprocess.run(['docker', 'exec', name, 'mysqldump', '-uroot', '-pparity',
                                                  '--no-data', '--skip-dump-date', '--skip-comments', db],
                                                 capture_output=True, text=True, encoding='utf-8').stdout,
                       upgrade, fresh)
    finally:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True)


# ----------------------------------------------------------------- MariaDB
def mariadb(upgrade, fresh):
    def run(db, path=None, query=None):
        if path:
            with open(path, encoding='utf-8') as source:
                sql = re.sub(r'\bpawsandfound\b', db, source.read())
            return subprocess.run(MARIADB, input=sql, capture_output=True, text=True, encoding='utf-8')
        return subprocess.run(MARIADB + ['-N', '-B', db, '-e', query], capture_output=True, text=True,
                              encoding='utf-8')

    try:
        return compare('MariaDB (XAMPP)', run,
                       lambda db: subprocess.run(MARIADB_DUMP + [db], capture_output=True, text=True,
                                                 encoding='utf-8').stdout,
                       upgrade, fresh)
    finally:
        subprocess.run(MARIADB + ['-e', 'DROP DATABASE IF EXISTS c3p_upgrade; DROP DATABASE IF EXISTS c3p_fresh;'],
                       capture_output=True)


def compare(engine, run, dump, upgrade, fresh):
    for db, paths in (('c3p_upgrade', upgrade), ('c3p_fresh', fresh)):
        for path in paths:
            result = run(db, path=path)
            errors = [line for line in result.stderr.splitlines()
                      if 'ERROR' in line and 'Using a password' not in line]
            check(f'{engine}: {db[4:]} — {os.path.basename(path)[2:]} imports without an error', not errors,
                  errors[0] if errors else '')
    facts = {db: run(db, query=FACTS).stdout.strip() for db in ('c3p_upgrade', 'c3p_fresh')}
    check(f'{engine}: the counts agree', facts['c3p_upgrade'] == facts['c3p_fresh'] != '',
          facts['c3p_upgrade'])
    # area_type is an ENUM, so GROUP_CONCAT orders it by its declared order.
    expected = ('20 | 26 | 001,002,003,004,005,006,007,008,009 | province=82,ncr=1,special_area=1'
                ' | 1642 | 17 | 32 | 0 | 43697479206F66204C6173205069C3B16173')
    check(f'{engine}: and they are the expected ones', facts['c3p_upgrade'] == expected,
          'tables | FKs | migrations | areas | cities | colours | listed breeds | uncoded places | Las Piñas')
    structure = {db: normalise(dump(db)) for db in ('c3p_upgrade', 'c3p_fresh')}
    check(f'{engine}: the table structure is identical', structure['c3p_upgrade'] == structure['c3p_fresh']
          and 'CREATE TABLE' in structure['c3p_fresh'])
    reference = {db: run(db, query=REFERENCE).stdout for db in ('c3p_upgrade', 'c3p_fresh')}
    check(f'{engine}: the reference rows are identical', reference['c3p_upgrade'] == reference['c3p_fresh']
          and reference['c3p_fresh'].count('\n') > 1700)
    return reference['c3p_fresh']


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as folder:
        upgrade, fresh = files(folder)
        mysql_rows = mysql94(upgrade, fresh)
        maria_rows = mariadb(upgrade, fresh)
        check('Both engines hold exactly the same reference rows', mysql_rows == maria_rows and bool(mysql_rows))
    print(f'\n{sum(results)}/{len(results)} passed')
    sys.exit(0 if all(results) else 1)
