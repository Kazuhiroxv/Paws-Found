"""
The print ERD, generated from the running database.

    python scripts/erd.py

writes, into docs/diagrams/:

    erd-a3.svg   the diagram (the source of the two below)
    erd-a3.pdf   A3 landscape, vector, for printing
    erd-a3.png   A3 landscape at 300 DPI
    erd.mmd      the same tables and relationships as a Mermaid erDiagram

Tables, columns, types, keys and relationships are read from
information_schema; nothing about the schema is typed into this file. What is
typed here is only the layout: where each table sits and which way each line
runs. The script refuses to draw if

  - the database does not have 24 tables and 34 foreign keys (the schema
    frozen after migration 013; docs/final-schema-audit.md),
  - information_schema and database/schema.sql disagree on any table, column
    or foreign key,
  - a foreign key has no line, or a line has no foreign key.

The two operational tables (schema_migrations, auth_rate_limits) are left off,
as on every other diagram of this project; the page says so.

Reads the XAMPP MariaDB by default, like scripts/audit.py:
PAWS_MYSQL and PAWS_MYSQL_ARGS point it elsewhere.
"""
import os
import re
import subprocess
import sys
from datetime import date
from html import escape

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJECT, 'docs', 'diagrams')
MYSQL = os.environ.get('PAWS_MYSQL', r'C:\xampp\mysql\bin\mysql.exe')
MYSQL_ARGS = os.environ.get('PAWS_MYSQL_ARGS', '-u root -h 127.0.0.1 -P 3307').split()
DB = os.environ.get('PAWS_DB', 'pawsandfound')
OPERATIONAL = ('schema_migrations', 'auth_rate_limits')


def query(sql):
    out = subprocess.run([MYSQL, *MYSQL_ARGS, '-N', '-B', DB, '-e', sql],
                         capture_output=True, text=True, check=True).stdout
    return [line.split('\t') for line in out.splitlines() if line]


# --- 1. The schema, from information_schema -----------------------------------

columns = {}
for table, name, ctype, nullable, key in query(
        "SELECT table_name, column_name, column_type, is_nullable, column_key "
        "FROM information_schema.columns WHERE table_schema = DATABASE() "
        "ORDER BY table_name, ordinal_position"):
    columns.setdefault(table, []).append(
        {'name': name, 'type': ctype, 'null': nullable == 'YES', 'key': key})

fks = [dict(zip(('name', 'table', 'column', 'ref_table', 'ref_column'), row)) for row in query(
    "SELECT constraint_name, table_name, column_name, referenced_table_name, referenced_column_name "
    "FROM information_schema.key_column_usage "
    "WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL "
    "ORDER BY table_name, ordinal_position")]

uniques = {}
for table, name, cols in query(
        "SELECT tc.table_name, tc.constraint_name, "
        "GROUP_CONCAT(k.column_name ORDER BY k.ordinal_position) "
        "FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage k "
        "  ON k.constraint_schema = tc.constraint_schema AND k.table_name = tc.table_name "
        " AND k.constraint_name = tc.constraint_name "
        "WHERE tc.table_schema = DATABASE() AND tc.constraint_type = 'UNIQUE' "
        "GROUP BY tc.table_name, tc.constraint_name"):
    uniques.setdefault(table, []).append((name, cols.split(',')))

if len(columns) != 24 or len(fks) != 34:
    sys.exit(f'Expected 24 tables and 34 foreign keys, found {len(columns)} and {len(fks)}.')
if any(fk['table'] in OPERATIONAL or fk['ref_table'] in OPERATIONAL for fk in fks):
    sys.exit('An operational table has a foreign key; it can no longer be left off the ERD.')

# --- 2. The same, from database/schema.sql ------------------------------------

sql_text = open(os.path.join(PROJECT, 'database', 'schema.sql'), encoding='utf-8').read()
sql_text = re.sub(r'--[^\n]*', '', sql_text)
file_cols, file_fks = {}, set()
for m in re.finditer(r'CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?\s*\((.*?)\)\s*ENGINE', sql_text, re.S):
    names = []
    for line in m.group(2).split('\n'):
        c = re.match(r'\s*`?(\w+)`?\s+(TINYINT|SMALLINT|INT|VARCHAR|CHAR|TEXT|DATE|DATETIME|'
                     r'TIMESTAMP|TIME|DECIMAL|ENUM|BOOLEAN|BOOL)\b', line, re.I)
        if c:
            names.append(c.group(1))
    file_cols[m.group(1)] = names
    for f in re.finditer(r'CONSTRAINT\s+`?(\w+)`?\s+FOREIGN KEY\s*\(`?(\w+)`?\)\s*'
                         r'REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)', m.group(2), re.S):
        file_fks.add((f.group(1), m.group(1), f.group(2), f.group(3), f.group(4)))

db_fks = {(f['name'], f['table'], f['column'], f['ref_table'], f['ref_column']) for f in fks}
db_cols = {t: [c['name'] for c in cols] for t, cols in columns.items()}
if file_cols != db_cols or file_fks != db_fks:
    sys.exit('information_schema and database/schema.sql disagree. Fix that before drawing.')

domain = [t for t in columns if t not in OPERATIONAL]
assert len(domain) == 22


def show_type(ctype):
    """The type as MySQL 8 and later print it: no display widths, except tinyint(1)."""
    ctype = ctype.lower()
    if ctype.startswith('enum('):
        return 'enum'
    if ctype == 'tinyint(1)':
        return ctype
    return re.sub(r'^(tinyint|smallint|mediumint|int|bigint)\(\d+\)', r'\1', ctype)


# --- 3. Layout ----------------------------------------------------------------
# A3 landscape is 420 x 297 mm: 1587 x 1123 CSS pixels at 96 per inch. The PNG
# is the same page at 300 DPI.

PAGE_W, PAGE_H = 1587, 1123
W, HEAD, ROW = 236, 28, 17
# Five columns, 77 px apart. Everything, lines included, stays at least 7 mm
# inside the page edge, where any printer can reach.
COL = {c: 40 + i * (W + 77) for i, c in enumerate('ABCDE')}
TOP = 156


def ch(c, offset):
    """A vertical lane in the channel to the right of column c."""
    return COL[c] + W + offset

GROUPS = {
    'accounts': ('1 · Accounts & Security', '#7A4B0C', '#FBF6EE'),
    'taxonomy': ('2 · Pet Taxonomy', '#4B3F7A', '#F5F3FA'),
    'reporting': ('3 · Reporting', '#0E5D5B', '#F1F7F6'),
    'matching': ('4 · Matching', '#1D4F86', '#F1F5FA'),
    'workflow': ('5 · Workflow & Audit', '#6A2F3B', '#FAF3F4'),
}

# table -> (column, top, group). A None top stacks it under the table above.
PLACE = [
    ('pet_categories', 'A', TOP, 'taxonomy'),
    ('pet_breeds', 'A', None, 'taxonomy'),
    ('locations', 'A', 434, 'reporting'),
    ('pet_reports', 'B', TOP, 'reporting'),
    ('report_images', 'C', TOP, 'reporting'),
    ('status_logs', 'C', None, 'reporting'),
    ('match_claims', 'D', TOP, 'matching'),
    ('match_signals', 'D', None, 'matching'),
    ('notifications', 'E', TOP, 'workflow'),
    ('moderation_cases', 'E', None, 'workflow'),
    ('audit_logs', 'E', None, 'workflow'),
    ('users', 'B', 746, 'accounts'),
    ('login_attempts', 'A', 746, 'accounts'),
    ('privacy_consents', 'A', None, 'accounts'),
    ('auth_tokens', 'C', 746, 'accounts'),
]
# Room for the two match_claims lines between status_logs and report_images,
# and for the labels on the two short vertical lines.
GAP = {'status_logs': 36, 'pet_breeds': 40, 'match_signals': 40}

box, last_bottom = {}, {}
for table, col, top, group in PLACE:
    height = HEAD + ROW * len(columns[table])
    if top is None:
        top = last_bottom[col] + GAP.get(table, 24)
    box[table] = {'x': COL[col], 'y': top, 'h': height, 'group': group}
    last_bottom[col] = top + height
assert sorted(box) == sorted(domain)


def left(t): return box[t]['x']
def right(t): return box[t]['x'] + W
def top(t): return box[t]['y']
def bottom(t): return box[t]['y'] + box[t]['h']
def cx(t): return box[t]['x'] + W / 2


def row(t, column):
    names = [c['name'] for c in columns[t]]
    return box[t]['y'] + HEAD + ROW * names.index(column) + ROW / 2


# --- 4. Lines -----------------------------------------------------------------
# One per foreign key, keyed by constraint name. Each runs from the child
# table (the side with the foreign key, drawn "many") to the parent ("one").
# Where a line leaves from the foreign key's own row it needs no label; the
# few that leave from the top or bottom of a table are labelled with the column.

gap_images_status = (bottom('report_images') + top('status_logs')) / 2
CORRIDOR = bottom('pet_reports') + 26          # between the upper groups and Accounts
ENTRY = [left('users') + 80 + 24 * i for i in range(7)]   # where lines meet users from above
LANE_TOP = [104, 112]                           # above every group, for two long lines


def to_users_top(child, column, exits_left, lane, k):
    """Down a channel, along the corridor, into the top of users."""
    y0 = row(child, column)
    x0 = left(child) if exits_left else right(child)
    y = CORRIDOR + 14 * k
    return [(x0, y0), (lane, y0), (lane, y), (ENTRY[k], y), (ENTRY[k], top('users'))]


ROUTES = {
    # Pet taxonomy
    'fk_breeds_category': dict(points=[(cx('pet_breeds'), top('pet_breeds')),
                                       (cx('pet_breeds'), bottom('pet_categories'))], label='category_id'),
    'fk_reports_category': dict(points=[(left('pet_reports'), row('pet_reports', 'category_id')), (ch('A', 20), row('pet_reports', 'category_id')),
                                        (ch('A', 20), row('pet_categories', 'category_id')), (right('pet_categories'), row('pet_categories', 'category_id'))]),
    'fk_reports_breed': dict(points=[(left('pet_reports'), row('pet_reports', 'breed_id')), (ch('A', 35), row('pet_reports', 'breed_id')),
                                     (ch('A', 35), row('pet_breeds', 'breed_id')), (right('pet_breeds'), row('pet_breeds', 'breed_id'))]),
    # Reporting
    'fk_reports_location': dict(points=[(left('pet_reports'), row('pet_reports', 'location_id')), (ch('A', 50), row('pet_reports', 'location_id')),
                                        (ch('A', 50), row('locations', 'location_id')), (right('locations'), row('locations', 'location_id'))]),
    'fk_reports_user': dict(points=[(left('pet_reports') + 26, bottom('pet_reports')), (left('pet_reports') + 26, top('users'))],
                            label='user_id'),
    # Steps down so the two long lines from the Workflow group can reach the
    # top of pet_reports above it without crossing.
    'fk_images_report': dict(points=[(left('report_images'), row('report_images', 'report_id')), (ch('B', 58), row('report_images', 'report_id')),
                                     (ch('B', 58), row('pet_reports', 'category_id')), (right('pet_reports'), row('pet_reports', 'category_id'))]),
    'fk_logs_report': dict(points=[(left('status_logs'), row('status_logs', 'report_id')),
                                   (right('pet_reports'), row('status_logs', 'report_id'))]),
    'fk_logs_user': dict(points=to_users_top('status_logs', 'updated_by_user_id', True, ch('B', 44), 0)),
    # Matching
    'fk_match_lost': dict(points=[(left('match_claims'), row('match_claims', 'lost_report_id')), (ch('C', 22), row('match_claims', 'lost_report_id')),
                                  (ch('C', 22), gap_images_status - 6), (right('pet_reports'), gap_images_status - 6)]),
    'fk_match_found': dict(points=[(left('match_claims'), row('match_claims', 'found_report_id')), (ch('C', 34), row('match_claims', 'found_report_id')),
                                   (ch('C', 34), gap_images_status + 6), (right('pet_reports'), gap_images_status + 6)]),
    'fk_match_submitted_by': dict(points=to_users_top('match_claims', 'submitted_by_user_id', True, ch('C', 46), 1)),
    'fk_match_reviewed_by': dict(points=to_users_top('match_claims', 'reviewed_by_user_id', True, ch('C', 58), 2)),
    'fk_signals_match': dict(points=[(cx('match_signals'), top('match_signals')), (cx('match_signals'), bottom('match_claims'))],
                             label='match_id'),
    # Workflow
    'fk_notifications_user': dict(points=to_users_top('notifications', 'user_id', True, ch('D', 22), 3)),
    'fk_notifications_match': dict(points=[(left('notifications'), row('notifications', 'match_id')),
                                           (right('match_claims'), row('notifications', 'match_id'))]),
    'fk_notifications_report': dict(points=[(right('notifications'), row('notifications', 'report_id')), (ch('E', 22), row('notifications', 'report_id')),
                                            (ch('E', 22), LANE_TOP[1]), (ch('B', 30), LANE_TOP[1]), (ch('B', 30), row('pet_reports', 'user_id')), (right('pet_reports'), row('pet_reports', 'user_id'))]),
    'fk_moderation_report': dict(points=[(right('moderation_cases'), row('moderation_cases', 'report_id')), (ch('E', 32), row('moderation_cases', 'report_id')),
                                         (ch('E', 32), LANE_TOP[0]), (ch('B', 18), LANE_TOP[0]), (ch('B', 18), row('pet_reports', 'report_id')), (right('pet_reports'), row('pet_reports', 'report_id'))]),
    'fk_moderation_reporter': dict(points=to_users_top('moderation_cases', 'reported_by_user_id', True, ch('D', 34), 4)),
    'fk_moderation_admin': dict(points=to_users_top('moderation_cases', 'resolved_by_admin_id', True, ch('D', 46), 5)),
    'fk_audit_actor': dict(points=to_users_top('audit_logs', 'actor_user_id', True, ch('D', 58), 6)),
    # Accounts & security
    'fk_attempts_user': dict(points=[(right('login_attempts'), row('login_attempts', 'user_id')),
                                     (left('users'), row('login_attempts', 'user_id'))]),
    'fk_consent_user': dict(points=[(right('privacy_consents'), row('privacy_consents', 'user_id')),
                                    (left('users'), row('privacy_consents', 'user_id'))]),
    'fk_auth_tokens_user': dict(points=[(left('auth_tokens'), row('auth_tokens', 'user_id')),
                                        (right('users'), row('auth_tokens', 'user_id'))]),
}

missing = {f['name'] for f in fks} - set(ROUTES)
invented = set(ROUTES) - {f['name'] for f in fks}
if missing or invented:
    sys.exit(f'Lines and foreign keys differ. No line: {sorted(missing)}. No key: {sorted(invented)}.')

# --- 5. Drawing ---------------------------------------------------------------

INK, MUTED, LINE = '#1B1F1F', '#5C6664', '#3A4240'
MONO = "Consolas, 'Cascadia Mono', 'Courier New', monospace"
SANS = "'Segoe UI', Arial, Helvetica, sans-serif"
svg = []


def text(x, y, s, size, weight=400, fill=INK, anchor='start', family=SANS, style='', extra=''):
    svg.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
               f'text-anchor="{anchor}" font-family="{family}"{f" font-style={chr(34)}{style}{chr(34)}" if style else ""}{extra}>'
               f'{escape(s)}</text>')


def unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = (dx * dx + dy * dy) ** 0.5
    return dx / length, dy / length


def end_mark(p, toward, kind):
    """Crow's-foot symbol at table edge point p; `toward` is the next point along the line."""
    ux, uy = unit(p, toward)
    px, py = -uy, ux
    at = lambda d, s=0: (p[0] + ux * d + px * s, p[1] + uy * d + py * s)
    parts = []
    stroke = f'stroke="{LINE}" stroke-width="1" fill="none"'
    if kind == 'many':
        # three toes on the table edge, joining 11 px out; a circle beyond: zero or many
        j = at(11)
        for s in (-6, 0, 6):
            e = at(0, s)
            parts.append(f'<line x1="{j[0]:.1f}" y1="{j[1]:.1f}" x2="{e[0]:.1f}" y2="{e[1]:.1f}" {stroke}/>')
        c = at(16)
        parts.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="3.2" fill="#fff" stroke="{LINE}" stroke-width="1"/>')
    else:
        bars = (6, 10) if kind == 'one' else (6,)
        for d in bars:
            a, b = at(d, -5.5), at(d, 5.5)
            parts.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" {stroke}/>')
        if kind == 'zero_one':
            c = at(14)
            parts.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="3.2" fill="#fff" stroke="{LINE}" stroke-width="1"/>')
    return ''.join(parts)


svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE_W} {PAGE_H}" width="420mm" height="297mm">')
svg.append(f'<rect width="{PAGE_W}" height="{PAGE_H}" fill="#FFFFFF"/>')

# Title
text(28, 52, 'Paws&Found', 28, 700)
text(28, 77, 'Entity Relationship Diagram', 17, 600, MUTED)
text(PAGE_W - 28, 48, 'Production MySQL Schema', 15, 700, anchor='end')
text(PAGE_W - 28, 68, f'{len(domain)} Domain Tables · {len(fks)} Foreign Keys', 13, 400, anchor='end')
text(PAGE_W - 28, 87, 'Operational tables omitted from conceptual ERD: schema_migrations, auth_rate_limits',
     10.5, 400, MUTED, anchor='end')

# Group panels
def extent(tables, pad=12, label=22):
    xs = [left(t) for t in tables] + [right(t) for t in tables]
    ys = [top(t) for t in tables] + [bottom(t) for t in tables]
    return min(xs) - pad, min(ys) - pad - label, max(xs) + pad, max(ys) + pad


members = {g: [t for t, *_ , grp in PLACE if grp == g] for g in GROUPS}
panels = {}
for g, tables in members.items():
    if g == 'reporting':
        continue
    panels[g] = extent(tables)
# Reporting is L-shaped: locations sits under the taxonomy tables, beside pet_reports.
bx1, by1, bx2, by2 = extent(['pet_reports', 'report_images', 'status_logs'])
lx1, ly1, lx2, ly2 = extent(['locations'])
by2 = max(by2, ly2)
panels['reporting'] = (lx1, by1, bx2, by2)
reporting_poly = [(bx1, by1), (bx2, by1), (bx2, by2), (lx1, by2), (lx1, ly1), (bx1, ly1)]

for g, (x1, y1, x2, y2) in panels.items():
    name, color, tint = GROUPS[g]
    if g == 'reporting':
        pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in reporting_poly)
        svg.append(f'<polygon points="{pts}" fill="{tint}" stroke="{color}" stroke-opacity="0.35" stroke-width="1"/>')
        text(bx1 + 10, by1 + 15, name.upper(), 10, 700, color, extra=' letter-spacing="0.6"')
    else:
        svg.append(f'<rect x="{x1:.1f}" y="{y1:.1f}" width="{x2 - x1:.1f}" height="{y2 - y1:.1f}" rx="6" '
                   f'fill="{tint}" stroke="{color}" stroke-opacity="0.35" stroke-width="1"/>')
        text(x1 + 10, y1 + 15, name.upper(), 10, 700, color, extra=' letter-spacing="0.6"')

# Lines under the tables, so an end symbol is never hidden by a line.
fk_by_name = {f['name']: f for f in fks}
nullable = {(t, c['name']): c['null'] for t, cols in columns.items() for c in cols}
for name, route in ROUTES.items():
    fk = fk_by_name[name]
    pts = route['points']
    d = 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    svg.append(f'<path d="{d}" fill="none" stroke="{LINE}" stroke-width="1" stroke-linejoin="round"><title>{name}</title></path>')
    svg.append(end_mark(pts[0], pts[1], 'many'))
    svg.append(end_mark(pts[-1], pts[-2], 'zero_one' if nullable[(fk['table'], fk['column'])] else 'one'))
    if 'label' in route:
        (x1, y1), (x2, y2) = pts[0], pts[1]
        mid = (y1 + y2) / 2
        if abs(y2 - y1) < 60:  # a short hop between stacked tables: label beside it
            text(x1 + 8, mid + 3.5, route['label'], 9, 400, MUTED, 'start', MONO, 'italic')
        else:  # a long one: the label runs up the line
            text(x1 - 4, mid, route['label'], 9, 400, MUTED, 'middle', MONO, 'italic',
                 f' transform="rotate(-90 {x1 - 4:.1f} {mid:.1f})"')

# Tables
unique_single = {(t, cols[0]) for t, us in uniques.items() for _, cols in us if len(cols) == 1}
fk_cols = {(f['table'], f['column']) for f in fks}
for t in domain:
    b = box[t]
    color, tint = GROUPS[b['group']][1], GROUPS[b['group']][2]
    x, y = b['x'], b['y']
    svg.append(f'<g><rect x="{x}" y="{y}" width="{W}" height="{b["h"]}" rx="4" fill="#FFFFFF" stroke="{color}" stroke-width="1.2"/>')
    svg.append(f'<path d="M {x} {y + HEAD} V {y + 4} Q {x} {y} {x + 4} {y} H {x + W - 4} Q {x + W} {y} {x + W} {y + 4} V {y + HEAD} Z" fill="{color}"/>')
    text(x + 10, y + 19, t, 13, 700, '#FFFFFF')
    for i, c in enumerate(columns[t]):
        ry = y + HEAD + ROW * i
        badges = []
        if c['key'] == 'PRI':
            badges.append('PK')
        if (t, c['name']) in fk_cols:
            badges.append('FK')
        if (t, c['name']) in unique_single:
            badges.append('UQ')
        if 'PK' in badges:
            svg.append(f'<rect x="{x + 1}" y="{ry}" width="{W - 2}" height="{ROW}" fill="{tint}"/>')
        if i:
            svg.append(f'<line x1="{x + 1}" y1="{ry}" x2="{x + W - 1}" y2="{ry}" stroke="#E4E8E7" stroke-width="0.6"/>')
        bx = x + 6
        for badge in badges:
            fill = {'PK': color, 'FK': '#FFFFFF', 'UQ': '#FFFFFF'}[badge]
            ink = {'PK': '#FFFFFF', 'FK': color, 'UQ': MUTED}[badge]
            svg.append(f'<rect x="{bx}" y="{ry + 3}" width="17" height="11" rx="2" fill="{fill}" stroke="{color if badge != "UQ" else MUTED}" stroke-width="0.8"/>')
            text(bx + 8.5, ry + 11.6, badge, 7.5, 700, ink, 'middle')
            bx += 19
        name_x = x + 6 + 19 * max(len(badges), 1) + 3
        weight = 700 if 'PK' in badges else 400
        text(name_x, ry + 12.4, c['name'], 10, weight, INK, family=MONO, style='italic' if 'FK' in badges and 'PK' not in badges else '')
        type_label = show_type(c['type']) + (' null' if c['null'] else '')
        text(x + W - 7, ry + 12.2, type_label, 8.5, 400, MUTED, 'end', MONO)
    svg.append('</g>')

# Legend and notes, bottom right
lx, ly, lw = COL['D'] - 12, panels['workflow'][3] + 12, COL['E'] + W + 12 - (COL['D'] - 12)
lh = panels['accounts'][3] - ly
svg.append(f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="6" fill="#FFFFFF" stroke="#B9C2C0" stroke-width="1"/>')
text(lx + 14, ly + 22, 'HOW TO READ IT', 10, 700, INK, extra=' letter-spacing="0.6"')
samples = [('one', 'exactly one: the foreign key is NOT NULL'),
           ('zero_one', 'zero or one: the foreign key may be NULL'),
           ('many', 'zero or many: the table holding the foreign key')]
for i, (kind, words) in enumerate(samples):
    yy = ly + 44 + 20 * i
    x1, x2 = lx + 18, lx + 70
    svg.append(f'<line x1="{x1}" y1="{yy}" x2="{x2}" y2="{yy}" stroke="{LINE}" stroke-width="1"/>')
    svg.append(end_mark((x2, yy), (x1, yy), kind))
    text(lx + 84, yy + 3.5, words, 10)
col2 = lx + 300
for i, (badge, words) in enumerate([('PK', 'primary key'), ('FK', 'foreign key (name in italics)'), ('UQ', 'unique on its own')]):
    yy = ly + 38 + 20 * i
    color = GROUPS['reporting'][1]
    fill = color if badge == 'PK' else '#FFFFFF'
    svg.append(f'<rect x="{col2}" y="{yy}" width="17" height="11" rx="2" fill="{fill}" stroke="{color if badge != "UQ" else MUTED}" stroke-width="0.8"/>')
    text(col2 + 8.5, yy + 8.6, badge, 7.5, 700, '#FFFFFF' if badge == 'PK' else (color if badge == 'FK' else MUTED), 'middle')
    text(col2 + 24, yy + 9, words, 10)
text(col2, ly + 38 + 20 * 3 + 9, 'grey = column type; "null" = the column allows NULL', 10, 400, MUTED)
text(lx + 18, ly + 38 + 20 * 3 + 9, "The crow's foot sits on the foreign-key row.", 10, 400, MUTED)

composite = [(t, n, cols) for t, us in sorted(uniques.items()) if t in domain for n, cols in us if len(cols) > 1]
yy = ly + 132
text(lx + 14, yy, 'UNIQUE ACROSS TWO COLUMNS', 10, 700, INK, extra=' letter-spacing="0.6"')
for i, (t, n, cols) in enumerate(composite):
    text(lx + 14, yy + 17 + 15 * i, f'{t} ({", ".join(cols)})', 9.5, 400, INK, family=MONO)
text(lx + 14, yy + 17 + 15 * len(composite) + 4,
     'match_claims pairs one lost report with one found report; each pair is stored once.', 9.5, 400, MUTED)

# Footer: where this came from
text(28, PAGE_H - 30,
     f'Generated by scripts/erd.py from information_schema, cross-checked column by column against '
     f'database/schema.sql (the file the production database was imported from) · {date.today().isoformat()} · '
     f'{len(domain)} tables · {len(fks)} foreign keys drawn', 9, 400, MUTED)

svg.append('</svg>')
os.makedirs(OUT, exist_ok=True)
svg_path = os.path.join(OUT, 'erd-a3.svg')
with open(svg_path, 'w', encoding='utf-8', newline='\n') as handle:
    handle.write('\n'.join(svg) + '\n')

# --- 6. Mermaid, from the same data -------------------------------------------

mmd = ['erDiagram']
for f in sorted(fks, key=lambda f: (f['ref_table'], f['table'], f['column'])):
    left_end = '|o' if nullable[(f['table'], f['column'])] else '||'
    mmd.append(f'    {f["ref_table"]} {left_end}--o{{ {f["table"]} : "{f["column"]}"')
for t in sorted(domain):
    mmd.append(f'    {t} {{')
    for c in columns[t]:
        keys = [k for k, on in (('PK', c['key'] == 'PRI'), ('FK', (t, c['name']) in fk_cols),
                                ('UK', (t, c['name']) in unique_single)) if on]
        mtype = re.sub(r'[^A-Za-z0-9_()]', '_', show_type(c['type']).replace(',', '_'))
        mmd.append(f'        {mtype} {c["name"]}{" " + ", ".join(keys) if keys else ""}'
                   f'{" " + chr(34) + "NULL" + chr(34) if c["null"] else ""}')
    mmd.append('    }')
with open(os.path.join(OUT, 'erd.mmd'), 'w', encoding='utf-8', newline='\n') as handle:
    handle.write('%% Generated by scripts/erd.py from information_schema. Edit the database, not this file.\n')
    handle.write('\n'.join(mmd) + '\n')

# --- 7. PDF and PNG -----------------------------------------------------------

subprocess.run(['node', os.path.join(PROJECT, 'scripts', 'print-render.mjs'), svg_path, '420', '297'], check=True)
try:
    from PIL import Image
    png = os.path.join(OUT, 'erd-a3.png')
    Image.open(png).save(png, dpi=(300, 300))
except ImportError:
    pass

print(f'{len(domain)} tables, {len(fks)} foreign keys, {sum(len(columns[t]) for t in domain)} columns')
print('Left off:', ', '.join(OPERATIONAL))
for name in ('erd-a3.svg', 'erd-a3.pdf', 'erd-a3.png', 'erd.mmd'):
    print('  docs/diagrams/' + name)
