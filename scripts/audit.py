"""
Paws&Found — full system audit.

Runs every documented test case against the running system and prints a table
per category with the expected and actual result. Re-runnable: it restores the
demonstration data at the end, so it can be run again after the UI revisions.

Stdlib only, so there is nothing to install.
"""
import http.cookiejar
import ipaddress
import json
import mimetypes
import os
import socket
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

# Where to point the suite: the local XAMPP deployment. The suites built on this
# module reseed and rewrite the database they reach, so they only ever run
# against this machine; see "Target safety" below. audit_cases.py,
# multi_device.py and auth_lifecycle.py also refuse a non-local PAWS_API.
API = os.environ.get('PAWS_API', 'http://localhost/pawsandfound/api').rstrip('/')

# The repository root, derived from this file's own location. A fixed path
# means the audit only runs on the machine it was written on.
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MYSQL = os.environ.get('PAWS_MYSQL', r'C:\xampp\mysql\bin\mysql.exe')
MYSQL_ARGS = os.environ.get('PAWS_MYSQL_ARGS', '-u root -h 127.0.0.1 -P 3307').split()
PW = os.environ.get('PAWS_PW', 'demo1234')

# Forty-nine assertions read the database directly, which is the point of them:
# a response saying a row was written proves nothing on its own. A hosted
# database is usually not reachable from outside the host, so rather than let
# those checks fail for the wrong reason, sql() reports that it could not look,
# and the summary says how many were skipped instead of quietly printing a
# smaller total as though it were the whole suite.
DB_REACHABLE = None

ACCOUNTS = {
    'customer': 'maria.santos@example.com',
    'customer2': 'liza.ocampo@example.com',
    'finder': 'noel.aguilar@example.com',
    'staff': 'patricia.lim@example.com',
    # The second Pet Coordinator: reviews what the first files, because nobody
    # reviews their own report and no administrator reviews at all (6A).
    'staff2': 'rafael.mendoza@example.com',
    'admin': 'grace.bautista@example.com',
}

results = []          # (category, id, description, expected, actual, ok)
_sessions = {}


# ------------------------------------------------------------- Target safety
# reseed() replaces the whole database and many cases UPDATE or DELETE rows, so
# these suites must never reach production (CLAUDE.md, Production safety). The
# check uses the destination the tools will actually use, not the variable
# that happened to be set:
#
#   * MySQL, before connecting: the client's own option resolution
#     (`mysql --print-defaults`, which reads my.ini as well as PAWS_MYSQL_ARGS
#     and does not connect) must name a loopback host or a local socket/pipe.
#   * MySQL, once connected and before any statement but a SELECT: the server
#     must report this machine's hostname. That catches a local port that is
#     really a tunnel to another server.
#   * The API (audit_cases.py only): the URL's host must resolve to loopback
#     addresses only.
#
# Anything else is refused, including LAN addresses and local containers,
# because nobody has decided yet that those count as local.

LOCAL_IPC = {'socket', 'pipe', 'memory'}
# Options that load other option files or credentials; the check cannot see
# through them, so it refuses rather than guess.
OPAQUE_OPTIONS = ('--defaults-file', '--defaults-extra-file', '--login-path',
                  '--no-defaults', '--defaults-group-suffix')

_db_checked_for = None   # the (MYSQL, MYSQL_ARGS) the database check last passed


class UnsafeTarget(SystemExit):
    """Raised before any mutation when a target is not this machine."""

    def __init__(self, what):
        super().__init__(
            f'\n  REFUSED: {what}\n'
            '  This suite reseeds and rewrites the database it reaches, so it only\n'
            '  runs against this machine (localhost, 127.0.0.1 or ::1). Nothing was\n'
            '  changed. See CLAUDE.md, Production safety.\n')


def is_loopback(host):
    """True only if every address `host` resolves to is a loopback address."""
    if not host:
        return False
    host = host.strip('[]')
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        pass
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except OSError:
        return False
    return bool(addresses) and all(
        ipaddress.ip_address(a.split('%')[0]).is_loopback for a in addresses)


def mysql_destination():
    """(host, protocol) the MySQL client will use, as the client resolves it."""
    if any(arg.split('=')[0] in OPAQUE_OPTIONS for arg in MYSQL_ARGS):
        raise UnsafeTarget('PAWS_MYSQL_ARGS loads another option file, so its '
                           'database host cannot be checked.')
    try:
        out = subprocess.run([MYSQL, '--print-defaults', *MYSQL_ARGS],
                             capture_output=True, text=True, encoding='utf-8',
                             errors='replace', timeout=20)
    except (OSError, subprocess.SubprocessError) as e:
        raise UnsafeTarget(f'could not ask the MySQL client where it would connect ({e}).')
    lines = out.stdout.strip().splitlines()
    if out.returncode != 0 or not lines or 'would have been started' not in lines[0]:
        raise UnsafeTarget('could not ask the MySQL client where it would connect.')
    args = ' '.join(lines[1:]).split()

    host = protocol = None
    i = 0
    while i < len(args):
        arg = args[i]
        value = args[i + 1] if i + 1 < len(args) else None
        if arg in ('-h', '--host'):
            host, i = value, i + 1
        elif arg.startswith('--host='):
            host = arg.split('=', 1)[1]
        elif arg.startswith('-h') and len(arg) > 2:
            host = arg[2:]
        elif arg == '--protocol':
            protocol, i = (value or '').lower(), i + 1
        elif arg.startswith('--protocol='):
            protocol = arg.split('=', 1)[1].lower()
        elif arg in ('-W', '--pipe'):
            protocol = 'pipe'
        i += 1
    if host is None:
        host = os.environ.get('MYSQL_HOST') or 'localhost'   # the client's own fallback
    return host, protocol


def require_local_database():
    """Refuse, before connecting, unless the client would reach this machine."""
    host, protocol = mysql_destination()
    # A socket, pipe or shared memory is only local when it names this machine:
    # on Windows `--pipe -h otherhost` opens a named pipe on otherhost.
    if host == '.' and protocol in LOCAL_IPC:
        return
    if not is_loopback(host):
        raise UnsafeTarget(f'the MySQL client would connect to {host!r}, '
                           'which is not this machine.')


def require_local_api():
    """Refuse unless the API URL points at this machine."""
    host = urllib.parse.urlsplit(API).hostname
    if not is_loopback(host):
        raise UnsafeTarget(f'PAWS_API points at {host!r} ({API}), which is not this machine.')


def db_reachable():
    """Can this machine query the database the API is using? Refuses (raises
    UnsafeTarget) when that database is not on this machine."""
    global DB_REACHABLE, _db_checked_for
    target = (MYSQL, tuple(MYSQL_ARGS))
    if _db_checked_for != target:
        require_local_database()
        _db_checked_for, DB_REACHABLE = target, None
    if DB_REACHABLE is None:
        fields = []
        try:
            out = subprocess.run(
                [MYSQL, *MYSQL_ARGS, '-B', '-N', 'pawsandfound', '-e',
                 'SELECT 1, @@hostname'],
                capture_output=True, text=True, encoding='utf-8',
                errors='replace', timeout=20)
            fields = out.stdout.strip().split('\t')
            DB_REACHABLE = fields[0] == '1'
        except (OSError, subprocess.SubprocessError):
            DB_REACHABLE = False
        if DB_REACHABLE:
            server = fields[1].strip() if len(fields) > 1 else ''
            if server.lower() != socket.gethostname().lower():
                DB_REACHABLE = None
                raise UnsafeTarget(f'the MySQL server reports hostname {server!r}, but '
                                   f'this machine is {socket.gethostname()!r}.')
    return DB_REACHABLE


def sql(query):
    if not db_reachable():
        return None
    out = subprocess.run(
        [MYSQL, *MYSQL_ARGS,
         '--default-character-set=utf8mb4', '-B', '-N', 'pawsandfound', '-e', query],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    return out.stdout.strip()


def reseed():
    if not db_reachable():
        return False
    with open(os.path.join(PROJECT, 'database', 'seed.sql'), 'rb') as f:
        subprocess.run([MYSQL, *MYSQL_ARGS,
                        '--default-character-set=utf8mb4', 'pawsandfound'],
                       stdin=f, capture_output=True)
    return True


class Session:
    """One signed-in browser, with its own cookie jar."""

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar))
        # This session's CSRF token, exactly as a browser would hold it: picked
        # up from a response body and sent back in a header on every write.
        self.csrf = None

    def prime_csrf(self):
        """Fetch a token, the way the app does on load."""
        _, payload = self.call('GET', '/auth/me')
        self.csrf = payload.get('csrf_token')
        return self.csrf

    def call(self, method, path, body=None, raw=None, content_type=None, csrf=True):
        """Make a request. `csrf=False` deliberately omits the token, which is
        how the CSRF tests prove the check is doing something."""
        data = None
        headers = {}
        if raw is not None:
            data, headers['Content-Type'] = raw, content_type
        elif body is not None:
            data = json.dumps(body).encode()
            headers['Content-Type'] = 'application/json'

        writes = method.upper() not in ('GET', 'HEAD', 'OPTIONS')
        if writes and csrf:
            if self.csrf is None:
                self.prime_csrf()
            if self.csrf:
                headers['X-CSRF-Token'] = self.csrf

        req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=25) as r:
                payload = json.loads(r.read() or b'{}')
                # Signing in and out rotate the token; keep up, as the app does.
                if isinstance(payload, dict) and payload.get('csrf_token'):
                    self.csrf = payload['csrf_token']
                return r.status, payload
        except urllib.error.HTTPError as e:
            payload = e.read()
            try:
                return e.code, json.loads(payload or b'{}')
            except json.JSONDecodeError:
                return e.code, {'raw': payload[:120].decode('utf-8', 'replace')}
        except Exception as e:                       # noqa: BLE001
            return 0, {'error': str(e)[:100]}


def session(role):
    """A signed-in session for a role.

    'guest' returns a brand-new jar every time, deliberately. A cached guest
    would pick up a cookie the moment a test posted to /auth/login through it,
    and every later "signed out" check would silently run as that account —
    which is exactly what happened on the first run of this audit.
    """
    if role == 'guest':
        return Session()

    if role not in _sessions:
        s = Session()
        s.call('POST', '/auth/login', {'email': ACCOUNTS[role], 'password': PW})
        _sessions[role] = s
    return _sessions[role]


def check(category, tid, description, expected, actual, ok):
    results.append((category, tid, description, str(expected), str(actual), ok))


def status(category, tid, description, role, method, path, body=None, expect=None):
    code, payload = session(role).call(method, path, body)
    check(category, tid, description, expect, code, code == expect)
    return code, payload


def multipart(fields, files):
    """Build a multipart body without a third-party library."""
    boundary = uuid.uuid4().hex
    out = []
    for name, value in fields:
        out.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    for name, filename, content in files:
        ctype = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        out.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; '
                   f'filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode())
        out.append(content)
        out.append(b'\r\n')
    out.append(f'--{boundary}--\r\n'.encode())
    return b''.join(out), f'multipart/form-data; boundary={boundary}'


_PLACES = None


def place_codes(city, province=None):
    """(area_code, city_code) for a place named the way these cases always
    named it, now that the API takes the place by PSGC code (Correction 3).

    A real place is found by name, the way migration 009 finds one: "Iloilo
    City" in Iloilo is the City of Iloilo. A made-up one ("Audit QA City")
    is what the cases use to put a report where no other report is, so it
    still gets a place of its own: a municipality chosen by a hash of the name
    and province, so the same name always lands in the same place and two
    different names almost never share one. Only municipalities, never the
    cities the seeded reports are in.
    """
    global _PLACES
    import re
    import zlib
    if _PLACES is None:
        rows = sql('SELECT c.city_code, c.area_code, c.city_name, p.area_name, c.is_city '
                   'FROM ph_cities c JOIN ph_areas p ON p.area_code = c.area_code '
                   'ORDER BY c.city_code;') or ''
        _PLACES = [line.split('	') for line in rows.splitlines() if line.strip()]

    def key(name):
        name = re.sub(r'\s+', ' ', (name or '').strip().lower())
        return re.sub(r' city$', '', re.sub(r'^city of ', '', name))

    real = [r for r in _PLACES if key(r[2]) == key(city)
            and (province is None or r[3].lower() == province.strip().lower())]
    if len(real) == 1:
        return real[0][1], real[0][0]
    pool = [r for r in _PLACES if r[4] == '0']
    pick = pool[zlib.crc32(f'{key(city)}|{(province or "").strip().lower()}'.encode()) % len(pool)]
    return pick[1], pick[0]


def file_report(role, publish=True, **overrides):
    """File a report as `role`, and — unless publish=False — have it published.

    Since Correction 4 a filed report waits for a Pet Coordinator. Nearly every
    case here is about a report that is public (matched, listed, edited), so
    by default a coordinator approves it straight away, exactly as one would
    in the interface. A report filed by a coordinator is approved by the
    other coordinator: nobody reviews their own report, and since Correction
    6A no administrator reviews at all.
    """
    body = {
        'report_type': 'lost', 'species': 'dog', 'pet_name': 'Audit Dog',
        'breed': 'Aspin (Philippine Native Dog)', 'size': 'medium', 'sex': 'male',
        'primary_color': 'Brown', 'distinct_features': 'A notched left ear',
        'incident_date': '2026-09-09',
        # Pasay City, Metro Manila, by PSGC code: the place is chosen from a
        # list now, and the server writes the names (Correction 3).
        'area_code': '1300000000', 'city_code': '1381100000',
        # As the form sends them: a report must be reachable some way, and a
        # found report must answer the collar question (not sure is an answer).
        'allow_platform_contact': True, 'has_collar': 'unknown',
        'location_label': 'Near the barangay hall',
        # At least 30 characters since Correction 3.
        'description': 'Filed by the automated audit, to check the API end to end.',
    }
    # Cases written before the place lists name a city (and sometimes a
    # province) in words; they become codes here, so each keeps its meaning.
    if 'city' in overrides or 'province' in overrides:
        area_code, city_code = place_codes(overrides.pop('city', 'Pasay City'),
                                               overrides.pop('province', None))
        body['area_code'], body['city_code'] = area_code, city_code
    body.update(overrides)
    code, payload = session(role).call('POST', '/reports', body)
    # A suite that suspended or locked this account in between has, rightly,
    # ended the cached session (Correction 6A): sign in again, once.
    if code == 401:
        _sessions.pop(role, None)
        code, payload = session(role).call('POST', '/reports', body)
    rid = payload.get('data', {}).get('report_id')
    if publish and rid:
        reviewer = 'staff2' if role == 'staff' else 'staff'
        approved, _ = session(reviewer).call('PATCH', f'/reports/{rid}/publication', {'action': 'approve'})
        # A suite that ends sessions (sign-out everywhere, a password change)
        # leaves the cached one dead: sign in again, once.
        if approved == 401:
            _sessions.pop(reviewer, None)
            session(reviewer).call('PATCH', f'/reports/{rid}/publication', {'action': 'approve'})
    return rid, code
