"""
The two A4 defence sheets: current architecture, and roles + matching workflow.

    python scripts/print_sheets.py

writes, into docs/diagrams/:

    architecture-a4.html / .pdf / .png
    roles-workflow-a4.html / .pdf / .png

The HTML is the editable source; the PDF (A4 landscape, vector) is what gets
printed. Every number on the sheets is read from the project at run time:
package versions from node_modules, the PHP image from the Dockerfile, the
matching weights and thresholds from api/matching.php, who may act on a
pairing from api/matches.php, and the table and key counts from
information_schema. The access matrix is written out by hand, so each of its
rules is pinned to the line of code that enforces it (CHECKS below), and the
script refuses to build if any of those lines has changed.
"""
import json
import os
import re
import subprocess
import sys
from html import escape

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJECT, 'docs', 'diagrams')
MYSQL = os.environ.get('PAWS_MYSQL', r'C:\xampp\mysql\bin\mysql.exe')
MYSQL_ARGS = os.environ.get('PAWS_MYSQL_ARGS', '-u root -h 127.0.0.1 -P 3307').split()
DB = os.environ.get('PAWS_DB', 'pawsandfound')


def read(path):
    return open(os.path.join(PROJECT, path), encoding='utf-8').read()


def version(package):
    with open(os.path.join(PROJECT, 'node_modules', package, 'package.json'), encoding='utf-8') as handle:
        major_minor = json.load(handle)['version'].split('.')[:2]
    return '.'.join(major_minor)


def query(sql):
    out = subprocess.run([MYSQL, *MYSQL_ARGS, '-N', '-B', DB, '-e', sql],
                         capture_output=True, text=True, check=True).stdout
    return out.strip()


# --- Facts --------------------------------------------------------------------

V = {name: version(pkg) for name, pkg in [
    ('react', 'react'), ('vite', 'vite'), ('tailwind', 'tailwindcss'),
    ('router', 'react-router-dom'), ('leaflet', 'leaflet')]}
PHP = re.search(r'^FROM php:(\d+\.\d+)-apache', read('Dockerfile'), re.M).group(1)

matching = read('api/matching.php')
WEIGHTS = dict(re.findall(r"'(\w+)' => (\d+),", re.search(r'const MATCH_WEIGHTS = \[(.*?)\];', matching, re.S).group(1)))
WEIGHTS = {k: int(v) for k, v in WEIGHTS.items()}
MIN_SCORE = int(re.search(r'const MATCH_MIN_SCORE = (\d+);', matching).group(1))
MAX_KM = int(re.search(r'const MATCH_MAX_DISTANCE_KM = (\d+);', matching).group(1))
assert sum(WEIGHTS.values()) == 100, WEIGHTS

matches_php = read('api/matches.php')
ACTIONS = dict(re.findall(r"'(\w+)'\s*=> \['(\w+)'\]", re.search(r'const MATCH_ACTIONS = \[(.*?)\];', matches_php, re.S).group(1)))
assert ACTIONS == {'request_verification': 'reporter', 'dismiss': 'reporter', 'confirm': 'staff',
                   'reject': 'staff', 'request_information': 'staff', 'provide_information': 'reporter'}, ACTIONS

TABLES = int(query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"))
FKS = int(query("SELECT COUNT(*) FROM information_schema.table_constraints "
                "WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'"))
OPERATIONAL = ('schema_migrations', 'auth_rate_limits')
DOMAIN = TABLES - len(OPERATIONAL)
if (TABLES, FKS) != (17, 24):
    sys.exit(f'Expected 17 tables and 24 foreign keys, found {TABLES} and {FKS}.')

# Each rule on the sheets, and the code that makes it true. A missing pattern
# means the code changed and the sheet may now be wrong.
CHECKS = [
    ('api/db.php', r'PDO::ATTR_EMULATE_PREPARES => false', 'native prepared statements'),
    ('api/helpers.php', r"'httponly' => true", 'HttpOnly session cookie'),
    ('api/helpers.php', r"'samesite' => 'Lax'", 'SameSite=Lax'),
    ('api/helpers.php', r"'secure' => request_is_https\(\)", 'Secure cookie over HTTPS'),
    ('api/helpers.php', r'function csrf_token', 'CSRF token'),
    ('api/auth.php', r'password_hash\(\$password, PASSWORD_DEFAULT\)', 'bcrypt password hashes'),
    ('api/auth.php', r'turnstile_or_fail\(', 'Turnstile on registration'),
    ('api/config.php', r'brevo', 'Brevo HTTPS mail API'),
    ('Dockerfile', r'/var/lib/pawsandfound/sessions', 'sessions on the volume'),
    ('Dockerfile', r'ln -s /var/lib/pawsandfound/uploads api/uploads', 'uploads on the volume'),
    ('src/components/mapSetup.js', r'tile\.openstreetmap\.org', 'OpenStreetMap tiles'),
    # Access matrix
    ('api/reports.php', r"json_error\(\"Sign in or create an account to see this report's details\.\", 401", 'details need sign-in'),
    ('api/reports.php', r'function report_create\(\): never\s*\{\s*\$user = require_login\(\);', 'any signed-in role may file'),
    ('api/reports.php', r"Only the person who filed a report can edit it", 'only the owner edits'),
    ('api/reports.php', r"'code' => 'match_open'", 'no edit while a match is open'),
    ('api/matches.php', r"\$isStaff = in_array\(\$user\['role'\], \['staff', 'admin'\], true\);", 'admin counts as staff for pairings'),
    ('api/matches.php', r"if \(\$action === 'provide_information' && !\$isReporter\)", 'only a reporter answers'),
    ('api/matches.php', r"if \(!\$isStaff\) \{\s*\$where\[\] = '\(lr\.user_id = :me_a OR fr\.user_id = :me_b\)';", 'customers see own pairings'),
    ('api/users.php', r"\$privileged = in_array\(\$viewer\['role'\], \['staff', 'admin'\], true\)", 'staff/admin see contact'),
    ('api/moderation.php', r'function moderation_create\(\): never\s*\{\s*\$user = require_login\(\);', 'anyone signed in may flag'),
    ('api/moderation.php', r"\$admin = require_role\('admin'\);", 'admin resolves flags'),
    ('api/users.php', r"\$admin = require_role\('admin'\);", 'admin manages accounts'),
    ('api/categories.php', r"\$admin = require_role\('admin'\);", 'admin manages categories'),
    ('api/reports.php', r"dismiss_open_pairings_for_report\(\$id, \$user\)", 'finishing a report withdraws its pairings'),
    ('src/pages/public/PetDetailPage.jsx', r"\{isOwner && report\.status !== REPORT_STATUSES\.CLOSED && \(", 'only the owner gets the finish buttons'),
    ('api/index.php', r'verify_csrf\(\);', 'CSRF checked before routing'),
    ('api/reports.php', r'\$pdo->commit\(\);.*?generate_matches_for_report\(\$reportId\);', 'matching runs after the report is saved'),
    ('src/App.jsx', r'allowed=\{\[ROLES\.STAFF\]\}', 'staff workspace is staff only'),
    ('src/App.jsx', r'allowed=\{\[ROLES\.ADMIN\]\}', 'admin workspace is admin only'),
]
failed = [(f, meaning) for f, pattern, meaning in CHECKS if not re.search(pattern, read(f), re.S)]
if failed:
    sys.exit('The code no longer says what the sheets say:\n' + '\n'.join(f'  {f}: {m}' for f, m in failed))


# --- Shared style -------------------------------------------------------------

STYLE = """
@page { size: 297mm 210mm; margin: 0 }
:root {
  --ink: #1B1F1F; --muted: #56605E; --line: #C9D1CF;
  --teal: #0E5D5B; --teal-tint: #EEF6F5; --amber: #8A5A12; --amber-tint: #FBF5EA;
  --slate: #2F3A4A; --slate-tint: #F2F4F7;
}
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: 297mm; height: 210mm; background: #fff; color: var(--ink);
  font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { width: 297mm; height: 210mm; padding: 8mm 9mm 7mm; display: flex; flex-direction: column; overflow: hidden }
header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 7px;
  border-bottom: 2px solid var(--teal); margin-bottom: 10px }
header h1 { font-size: 23px; font-weight: 700; line-height: 1 }
header h2 { font-size: 15px; font-weight: 600; color: var(--muted); margin-top: 4px }
header .meta { text-align: right; font-size: 11px; color: var(--muted); line-height: 1.45 }
header .meta b { color: var(--ink); font-size: 12.5px }
.label { font-size: 9.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase }
code, .mono { font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace }
.foot { font-size: 8.5px; color: var(--muted); margin-top: auto; padding-top: 5px }
"""


def page(title, subtitle, meta, body, extra_style=''):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{escape(title)} · {escape(subtitle)}</title>
<style>{STYLE}{extra_style}</style></head>
<body><div class="page">
<header><div><h1>{escape(title)}</h1><h2>{escape(subtitle)}</h2></div><div class="meta">{meta}</div></header>
{body}
</div></body></html>
"""


# --- Sheet 1: architecture ----------------------------------------------------

ARCH_STYLE = """
main { display: grid; grid-template-columns: 1fr 76mm; gap: 11px; flex: 1; min-height: 0 }
.stack { display: flex; flex-direction: column; justify-content: space-between }
.roles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px }
.role { border: 1.3px solid var(--slate); border-radius: 6px; padding: 5px 8px; background: var(--slate-tint) }
.role b { font-size: 12px; display: block }
.role span { font-size: 9.8px; color: var(--muted); line-height: 1.3; display: block; margin-top: 2px }
.conn { display: flex; align-items: center; gap: 10px; min-height: 30px; padding-left: 50% }
.conn svg { margin-left: -6px; flex: none }
.conn p { font-size: 10px; color: var(--muted); line-height: 1.25 }
.conn p b { color: var(--ink); font-weight: 600 }
.layer { border: 1.6px solid; border-radius: 7px; display: grid; grid-template-columns: 30mm 1fr; overflow: hidden }
.layer > .side { color: #fff; padding: 8px 9px; display: flex; flex-direction: column; justify-content: space-between }
.layer > .side .label { color: #fff; font-size: 10px }
.layer > .side .where { font-size: 10px; opacity: .92 }
.layer > .side .motto { font-size: 11.5px; font-weight: 700; line-height: 1.2 }
.layer > .body { padding: 8px 10px }
.pres { border-color: var(--teal) } .pres > .side { background: var(--teal) } .pres > .body { background: var(--teal-tint) }
.app { border-color: var(--amber) } .app > .side { background: var(--amber) } .app > .body { background: var(--amber-tint) }
.data { border-color: var(--slate) } .data > .side { background: var(--slate) } .data > .body { background: var(--slate-tint) }
.chips { display: flex; flex-wrap: wrap; gap: 6px }
.chip { border: 1px solid var(--line); background: #fff; border-radius: 5px; padding: 4px 8px; font-size: 11.5px; font-weight: 600 }
.chip small { font-weight: 400; color: var(--muted); font-size: 10px; margin-left: 3px }
.modules { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px }
.module { background: #fff; border: 1px solid #E3D3B6; border-radius: 5px; padding: 5px 7px }
.module b { font-size: 11px; display: block; margin-bottom: 1px }
.module span { font-size: 9.3px; color: var(--muted); line-height: 1.3; display: block }
.apphead { font-size: 12px; font-weight: 700; margin-bottom: 6px }
.apphead span { font-weight: 400; color: var(--muted); font-size: 10.5px }
.stats { display: flex; gap: 8px; align-items: stretch }
.stat { background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 4px 10px; text-align: center; min-width: 25mm }
.stat b { font-size: 21px; display: block; line-height: 1.1 }
.stat span { font-size: 9.5px; color: var(--muted) }
.dbnote { font-size: 10px; color: var(--muted); line-height: 1.35; align-self: center; margin-left: 4px }
aside { display: flex; flex-direction: column; gap: 8px; min-height: 0 }
.panel { border: 1.4px solid var(--teal); border-radius: 7px; padding: 8px 10px }
.panel .label { color: var(--teal); margin-bottom: 5px }
.svc { padding: 5px 0; border-top: 1px solid #E1E7E6 }
.svc:first-of-type { border-top: 0; padding-top: 1px }
.svc b { font-size: 11.5px; display: block }
.svc span { font-size: 9.6px; color: var(--muted); line-height: 1.32; display: block }
.path { font-size: 9.6px; color: var(--muted); line-height: 1.33; padding-left: 15px }
.path li { margin: 2px 0 } .path b { color: var(--ink) }
.local { border: 1.3px dashed #9AA3A1; border-radius: 7px; padding: 7px 10px; background: #FAFAFA }
.local .label { color: var(--muted) }
.local p { font-size: 9.6px; color: var(--muted); line-height: 1.35; margin-top: 3px }
.thesis { margin-top: 9px; background: var(--teal); color: #fff; border-radius: 7px; padding: 8px 14px;
  display: flex; justify-content: center; gap: 22px; font-size: 15.5px; font-weight: 700 }
.thesis span:nth-child(2) { color: #FFE1A6 }
"""

ARROW = ('<svg width="12" height="24" viewBox="0 0 12 24"><path d="M6 0 V18" stroke="#56605E" stroke-width="1.4"/>'
         '<path d="M1.5 15 L6 22 L10.5 15" fill="none" stroke="#56605E" stroke-width="1.4"/></svg>')


def conn(text):
    return f'<div class="conn">{ARROW}<p>{text}</p></div>'


arch_body = f"""
<main>
<section class="stack">
  <div class="roles">
    <div class="role"><b>Guest</b><span>Browses and searches public reports and the map</span></div>
    <div class="role"><b>Customer / User</b><span>Files lost and found reports, reviews possible matches</span></div>
    <div class="role"><b>Staff / Pet Coordinator</b><span>Verifies pairings, coordinates the handover</span></div>
    <div class="role"><b>Administrator</b><span>Accounts, roles, categories, moderation</span></div>
  </div>
  {conn('<b>HTTPS</b> · one origin: the site and the API are served together')}
  <div class="layer pres">
    <div class="side"><div><div class="label">Presentation</div><div class="where">in the browser</div></div>
      <div class="motto">Displays state</div></div>
    <div class="body">
      <div class="chips">
        <span class="chip">React {V['react']}</span>
        <span class="chip">Vite {V['vite']}</span>
        <span class="chip">Tailwind CSS {V['tailwind']}</span>
        <span class="chip">React Router {V['router']}</span>
        <span class="chip">Leaflet {V['leaflet']}<small>+ OpenStreetMap</small></span>
      </div>
      <p style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.35">
        Pages ask the API for everything through one service layer. Hiding a button is never the
        security: every action the page offers is checked again by the server.</p>
    </div>
  </div>
  {conn('<b>Fetch / AJAX · JSON</b> · PHP session cookie (HttpOnly, SameSite=Lax, Secure) · CSRF token header on every change')}
  <div class="layer app">
    <div class="side"><div><div class="label">Application</div><div class="where">on the server</div></div>
      <div class="motto">Enforces rules</div></div>
    <div class="body">
      <div class="apphead">PHP {PHP} REST API <span>· Apache · JSON in, JSON out · our own endpoints</span></div>
      <div class="modules">
        <div class="module"><b>Authentication</b><span>bcrypt hashes, sessions, lock after 3 failed sign-ins, email verification</span></div>
        <div class="module"><b>Authorization</b><span>role re-read from the database on every request; 401 / 403</span></div>
        <div class="module"><b>Validation</b><span>every field checked on the server; 422 names the field</span></div>
        <div class="module"><b>Privacy filtering</b><span>unpublished contact never leaves the server; guests get a summary</span></div>
        <div class="module"><b>Rule-based matching</b><span>{len(WEIGHTS)} weighted signals, suggestion at {MIN_SCORE}+ of 100; no AI</span></div>
        <div class="module"><b>Notifications</b><span>in-app, stored per user; email only for account links</span></div>
        <div class="module"><b>Moderation</b><span>anyone signed in flags; an administrator decides</span></div>
        <div class="module"><b>Audit log</b><span>sign-ins, role changes, decisions: who, what, when</span></div>
      </div>
    </div>
  </div>
  {conn('<b>PDO · native prepared statements</b> (emulation off) · transactions for multi-step changes')}
  <div class="layer data">
    <div class="side"><div><div class="label">Data</div><div class="where">Railway MySQL service</div></div>
      <div class="motto">Owns persistent state</div></div>
    <div class="body" style="display:flex;align-items:center;gap:10px">
      <div style="font-size:13px;font-weight:700;min-width:23mm">MySQL 9.4<br><span style="font-size:10px;font-weight:400;color:var(--muted)">InnoDB · utf8mb4</span></div>
      <div class="stats">
        <div class="stat"><b>{TABLES}</b><span>physical tables</span></div>
        <div class="stat"><b>{DOMAIN}</b><span>domain tables</span></div>
        <div class="stat"><b>{FKS}</b><span>foreign keys</span></div>
      </div>
      <div class="dbnote">{DOMAIN} on the ERD. The other two, <code>{OPERATIONAL[0]}</code> and <code>{OPERATIONAL[1]}</code>, are operational.</div>
    </div>
  </div>
</section>
<aside>
  <div class="panel">
    <div class="label">Production · Railway</div>
    <div class="svc"><b>Application service</b><span>One Docker container: Apache + PHP {PHP} serving the built React site and <code>/api</code> from one origin. Health check <code>/api/health</code>.</span></div>
    <div class="svc"><b>MySQL 9.4 service</b><span>Separate service; the app reads its address and credentials from environment variables.</span></div>
    <div class="svc"><b>Persistent volume</b><span><code>/var/lib/pawsandfound</code>: uploaded photos and PHP sessions, kept across redeploys.</span></div>
  </div>
  <div class="panel">
    <div class="label">External services</div>
    <div class="svc"><b>Brevo HTTPS Mail API</b><span>Email verification, password reset and email-change links.</span></div>
    <div class="svc"><b>Cloudflare Turnstile</b><span>Bot check on registration.</span></div>
    <div class="svc"><b>OpenStreetMap tiles</b><span>Map imagery, loaded by the browser through Leaflet.</span></div>
  </div>
  <div class="panel">
    <div class="label">One request, end to end: filing a report</div>
    <ol class="path">
      <li>React form → <code>POST /api/reports</code>, JSON, with the session cookie and CSRF token</li>
      <li>PHP checks the CSRF token, then that someone is signed in and active</li>
      <li>Every field validated again; a bad one is a 422 naming it</li>
      <li>Location, report and first history line saved in <b>one transaction</b></li>
      <li>After the commit, matching compares it with open reports and notifies both reporters</li>
    </ol>
  </div>
  <div class="local">
    <div class="label">Local development only, not production</div>
    <p>XAMPP (Apache + PHP, MariaDB 10.4 on port 3307) and the Vite dev server. Same code, same
      <code>database/schema.sql</code>.</p>
  </div>
</aside>
</main>
<div class="thesis"><span>React displays state.</span><span>PHP enforces rules.</span><span>MySQL owns persistent state.</span></div>
"""

META = '<b>ITS122P – AM5 · Group 3</b><br>Production: Railway'


# --- Sheet 2: roles and workflow ----------------------------------------------

Y, N = '<span class="y">✓</span>', '<span class="n">—</span>'


def own(text='own'):
    return f'<span class="o">{text}</span>'


def api(text):
    return f'<span class="a">{text}†</span>'


# (action, guest, customer, staff, admin). Each rule is one of the CHECKS above.
MATRIX = [
    ('Browse public reports, search, map', Y, Y, Y, Y),
    ('Open full report details', N, Y, Y, Y),
    ('File a lost or found report', N, Y, Y, Y),
    ('Edit own report (Active only)', N, own(), api('own'), api('own')),
    ('Mark report Returned / Closed', N, own(), api('any'), api('any')),
    ('See possible matches', N, own(), Y, api('all')),
    ('Request verification / "Not my pet"', N, own(), api('any'), api('any')),
    ("Answer a coordinator's question", N, own(), N, N),
    ('Confirm / reject a match, ask a question', N, N, Y, api('yes')),
    ('See unpublished reporter contact', N, N, Y, Y),
    ('Flag a listing', N, Y, Y, Y),
    ('Resolve flags: dismiss, warn, remove, suspend', N, N, N, Y),
    ('Manage users and roles', N, N, N, Y),
    ('Suspend / reinstate / unlock accounts', N, N, N, Y),
    ('Manage pet categories', N, N, N, Y),
]

LABELS = {'species': 'Species', 'location': 'Location', 'breed': 'Breed', 'color': 'Colour',
          'size': 'Size', 'date': 'Date', 'characteristics': 'Other characteristics'}

ROLES_STYLE = """
main { display: grid; grid-template-columns: 1fr 112mm; gap: 12px; flex: 1; min-height: 0 }
.label.t { color: var(--teal); margin-bottom: 5px }
table.m { width: 100%; border-collapse: collapse; font-size: 11px }
table.m th { font-size: 10px; text-align: center; padding: 5px 3px; color: #fff; background: var(--teal); line-height: 1.15 }
table.m th:first-child { text-align: left; padding-left: 8px; background: var(--slate) }
table.m td { border-bottom: 1px solid #E1E7E6; padding: 4.2px 3px; text-align: center; font-size: 12px }
table.m td:first-child { text-align: left; padding-left: 8px; font-size: 11px }
table.m tr:nth-child(even) td { background: #F7FAF9 }
.y { color: var(--teal); font-weight: 700 }
.n { color: #A7B0AE }
.o { color: var(--teal); font-weight: 600; font-size: 10.5px }
.a { color: var(--amber); font-weight: 600; font-size: 10.5px }
.notes { font-size: 9.4px; color: var(--muted); line-height: 1.4; margin-top: 7px }
.notes b { color: var(--ink) }
.rule { margin-top: 7px; border-left: 3px solid var(--teal); background: var(--teal-tint); padding: 5px 9px;
  font-size: 10.3px; line-height: 1.35 }
.flow { display: flex; flex-direction: column; align-items: stretch }
.step { border: 1.4px solid var(--teal); border-radius: 6px; padding: 4px 9px; background: #fff }
.step b { font-size: 11.5px } .step span { font-size: 9.6px; color: var(--muted); display: block; line-height: 1.3 }
.step.key { background: var(--teal); color: #fff; border-color: var(--teal) } .step.key span { color: #DDEEEC }
.down { height: 14px; display: flex; justify-content: center }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 8px }
.step.no { border-color: #9A3B3B } .step.no b { color: #8B2F2F }
.step.yes { border-color: var(--teal); background: var(--teal-tint) }
.side-by { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 9px }
.box { border: 1.3px solid var(--line); border-radius: 6px; padding: 6px 9px }
table.w { width: 100%; border-collapse: collapse; font-size: 10.5px }
table.w td { padding: 1.6px 0 }
table.w td:last-child { text-align: right; font-weight: 700; width: 9mm }
table.w td.bar { width: 14mm; padding-left: 6px } .bar i { display: block; height: 6px; background: var(--teal); border-radius: 2px }
table.w tr.total td { border-top: 1px solid var(--ink); font-weight: 700; padding-top: 3px }
.box p { font-size: 9.7px; line-height: 1.38; color: var(--muted) }
.box p b { color: var(--ink) }
.warn { border-color: var(--amber); background: var(--amber-tint) }
.warn .label { color: var(--amber) }
.noai { margin-top: 8px; text-align: center; font-size: 12.5px; font-weight: 700; color: var(--teal);
  border: 1.6px solid var(--teal); border-radius: 6px; padding: 5px }
"""

DOWN = ('<div class="down"><svg width="12" height="14" viewBox="0 0 12 14"><path d="M6 0 V10" stroke="#56605E" stroke-width="1.4"/>'
        '<path d="M2 7.5 L6 13 L10 7.5" fill="none" stroke="#56605E" stroke-width="1.4"/></svg></div>')

matrix_rows = '\n'.join(
    f'<tr><td>{escape(a)}</td><td>{g}</td><td>{c}</td><td>{s}</td><td>{ad}</td></tr>' for a, g, c, s, ad in MATRIX)
max_w = max(WEIGHTS.values())
weight_rows = '\n'.join(
    f'<tr><td>{LABELS[k]}</td><td class="bar"><i style="width:{v / max_w * 100:.0f}%"></i></td><td>{v}</td></tr>'
    for k, v in WEIGHTS.items())

roles_body = f"""
<main>
<section>
  <div class="label t">Who may do what: enforced by the PHP API on every request</div>
  <table class="m">
    <thead><tr><th style="width:44%">Action</th><th>Guest</th><th>Customer /<br>User</th><th>Staff / Pet<br>Coordinator</th><th>Admin</th></tr></thead>
    <tbody>{matrix_rows}</tbody>
  </table>
  <p class="notes"><span class="y">✓</span> allowed &nbsp; <span class="o">own</span> only on their own reports or pairings &nbsp;
    <span class="n">—</span> refused (401 not signed in / 403 wrong role)<br>
    <span class="a">†</span> <b>The API accepts it from this role, but the interface gives that role no screen for it.</b>
    Staff work in the Staff workspace and administrators in Administration; only Pet Coordinators verify pairings in the interface.</p>
  <div class="rule">The role is re-read from the database on every request, so a role change or suspension takes effect at once.
    Nobody edits another person's report: the server lets staff change a report's <i>status</i>, never its details,
    and a Pet Coordinator's confirmation is what marks both reports Returned.</div>
</section>
<section>
  <div class="label t">Matching and verification</div>
  <div class="flow">
    <div class="step"><b>Lost report + Found report</b><span>when one is filed, or edited while Active</span></div>
    {DOWN}
    <div class="step"><b>Rule-based comparison</b><span>against every open report of the other type · must be the same species and
      within {MAX_KM} km (same city when a report has no map point)</span></div>
    {DOWN}
    <div class="step key"><b>Score ≥ {MIN_SCORE} of 100 → Possible Match</b><span>both reports marked Possible Match; both reporters notified</span></div>
    {DOWN}
    <div class="step"><b>Reporter review</b><span>"This could be mine" → verification requested &nbsp;·&nbsp; "Not my pet" → dismissed, report back to Active</span></div>
    {DOWN}
    <div class="step"><b>Pet Coordinator verification</b><span>compares both reports and the proof; may ask a question, which the reporter answers</span></div>
    {DOWN}
    <div class="split">
      <div class="step no"><b>Reject</b><span>pairing rejected; both reports back to Active</span></div>
      <div class="step yes"><b>Confirm</b><span>both reports Returned; their other open pairings withdrawn; coordinator arranges a safe handover</span></div>
    </div>
  </div>
  <div class="side-by">
    <div class="box">
      <div class="label t">Weights (points)</div>
      <table class="w">{weight_rows}
        <tr class="total"><td>Total</td><td></td><td>{sum(WEIGHTS.values())}</td></tr></table>
    </div>
    <div class="box warn">
      <div class="label">Finished while a pairing is open</div>
      <p>If a reporter marks their report <b>Returned</b> or <b>Closed</b> while a pairing is still open, the pairing is
        <b>withdrawn</b> (stored as dismissed). It is <b>never</b> confirmed automatically: only a Pet Coordinator confirms.
        The other report goes back to Active and its reporter is told.</p>
    </div>
  </div>
  <div class="noai">Rule-based matching: no AI, no image recognition.</div>
</section>
</main>
"""

# --- Write and render ---------------------------------------------------------

os.makedirs(OUT, exist_ok=True)
sheets = {
    'architecture-a4.html': page('Paws&Found', 'Current System Architecture', META, arch_body, ARCH_STYLE),
    'roles-workflow-a4.html': page('Paws&Found', 'Roles, Access & Matching Workflow', META, roles_body, ROLES_STYLE),
}
for name, html in sheets.items():
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(html)
    subprocess.run(['node', os.path.join(PROJECT, 'scripts', 'print-render.mjs'), path, '297', '210'], check=True)
    try:
        from PIL import Image
        png = path.replace('.html', '.png')
        Image.open(png).save(png, dpi=(300, 300))
    except ImportError:
        pass
    print('  docs/diagrams/' + name.replace('.html', '.{html,pdf,png}'))
print(f'{len(CHECKS)} code checks passed; weights {WEIGHTS}; threshold {MIN_SCORE}; {TABLES} tables, {FKS} FKs')
