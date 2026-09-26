"""
Paws&Found — full system audit.

Runs every documented test case against the running system and prints a table
per category with the expected and actual result. Re-runnable: it restores the
demonstration data at the end, so it can be run again after the UI revisions.

Stdlib only, so there is nothing to install.
"""
import http.cookiejar
import json
import mimetypes
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

# Where to point the suite. The default is the local XAMPP deployment; set
# PAWS_API to run the same cases against the LAN address or the hosted site:
#
#   PAWS_API=https://<domain>/api python scripts/audit_cases.py
#
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
    'admin': 'grace.bautista@example.com',
}

results = []          # (category, id, description, expected, actual, ok)
_sessions = {}


def db_reachable():
    """Can this machine query the database the API is using?"""
    global DB_REACHABLE
    if DB_REACHABLE is None:
        try:
            out = subprocess.run(
                [MYSQL, *MYSQL_ARGS, '-B', '-N', 'pawsandfound', '-e', 'SELECT 1'],
                capture_output=True, text=True, encoding='utf-8',
                errors='replace', timeout=20)
            DB_REACHABLE = out.stdout.strip() == '1'
        except (OSError, subprocess.SubprocessError):
            DB_REACHABLE = False
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


def file_report(role, **overrides):
    body = {
        'report_type': 'lost', 'species': 'dog', 'pet_name': 'Audit Dog',
        'breed': 'Aspin (Philippine Native Dog)', 'size': 'medium', 'sex': 'male',
        'primary_color': 'Brown', 'distinct_features': 'A notched left ear',
        'incident_date': '2026-09-09', 'city': 'Pasay City', 'province': 'Metro Manila',
    }
    body.update(overrides)
    code, payload = session(role).call('POST', '/reports', body)
    return payload.get('data', {}).get('report_id'), code
