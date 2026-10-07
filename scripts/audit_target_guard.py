"""
The audit suites refuse any database or API that is not this machine.

    python scripts/audit_target_guard.py        (npm run test:audit-guard)

`npm run audit` and the seven suites built on scripts/audit.py reseed and
rewrite the database they reach, so audit.py checks the destination before
anything changes data (its "Target safety" section). This suite proves:

  * refused targets stop before any MySQL statement except the read-only
    identity probe, and before any HTTP request at all;
  * the local XAMPP targets still pass, against the real local database.

It never contacts production. MySQL and HTTP are instrumented: the only MySQL
call allowed through is the client's own `--print-defaults`, which does not
connect, and every HTTP request raises inside the test instead of being sent.
The refused hosts are documentation addresses (203.0.113.0/24), an unresolvable
`.invalid` name, the LAN address from docs/lan-testing.md and the production
URL's hostname, which is only ever resolved, never requested.

Needs XAMPP's MariaDB running (port 3307) for the allowed-target checks.
"""
import contextlib
import io
import os
import runpy
import socket
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ARGS = list(audit.MYSQL_ARGS)
DEFAULT_API = audit.API
PRODUCTION_API = 'https://paws-found-production.up.railway.app/api'
LAN_API = 'http://192.168.254.108/pawsandfound/api'

REAL_RUN = subprocess.run
REAL_OPEN = urllib.request.OpenerDirector.open

results = []


def check(name, ok, detail=''):
    results.append(bool(ok))
    print(f'  {"PASS" if ok else "FAIL"}  {name}' + (f'  ({detail})' if detail and not ok else ''))


class Instrumented:
    """Record every MySQL invocation and HTTP request; let none through except
    `mysql --print-defaults` (which only prints, never connects), unless the
    case supplies a fake answer for the identity probe."""

    def __init__(self, server_hostname=None):
        self.server_hostname = server_hostname
        self.mysql = []
        self.http = []

    def run(self, cmd, *args, **kwargs):
        cmd = [str(c) for c in cmd]
        if len(cmd) > 1 and cmd[1] == '--print-defaults':
            return REAL_RUN(cmd, *args, **kwargs)
        self.mysql.append(cmd)
        if self.server_hostname is not None and cmd[-1] == 'SELECT 1, @@hostname':
            return subprocess.CompletedProcess(cmd, 0, f'1\t{self.server_hostname}\n', '')
        raise AssertionError('MySQL was invoked past the guard: ' + ' '.join(cmd))

    def open(self, opener, req, *args, **kwargs):
        self.http.append(getattr(req, 'full_url', req))
        raise AssertionError('an HTTP request was attempted past the guard')

    def statements(self):
        """Everything sent to MySQL other than the read-only identity probe."""
        return [c for c in self.mysql if c[-1] != 'SELECT 1, @@hostname']

    @contextlib.contextmanager
    def active(self):
        subprocess.run = self.run
        urllib.request.OpenerDirector.open = lambda opener, req, *a, **k: self.open(opener, req, *a, **k)
        try:
            yield self
        finally:
            subprocess.run = REAL_RUN
            urllib.request.OpenerDirector.open = REAL_OPEN


def configure(mysql_args=None, api=None, mysql_host_env=None):
    audit.MYSQL_ARGS = list(mysql_args if mysql_args is not None else DEFAULT_ARGS)
    audit.API = api or DEFAULT_API
    audit.DB_REACHABLE = None
    audit._db_checked_for = None
    if mysql_host_env is None:
        os.environ.pop('MYSQL_HOST', None)
    else:
        os.environ['MYSQL_HOST'] = mysql_host_env


def refused(action, **target):
    """Run `action` against `target`; report whether it was refused and what
    reached MySQL or HTTP first."""
    configure(**{k: v for k, v in target.items() if k != 'server_hostname'})
    probe = Instrumented(server_hostname=target.get('server_hostname'))
    message = ''
    with probe.active(), contextlib.redirect_stdout(io.StringIO()):
        try:
            action()
            outcome = 'ran'
        except audit.UnsafeTarget as e:
            outcome, message = 'refused', str(e.code)
        except AssertionError as e:
            outcome, message = 'leaked', str(e)
    configure()
    return outcome, message, probe


def run_audit_main():
    runpy.run_path(os.path.join(HERE, 'audit_cases.py'), run_name='__main__')


def expect_refusal(name, action, **target):
    outcome, message, probe = refused(action, **target)
    clean = not probe.statements() and not probe.http
    check(name, outcome == 'refused' and clean and 'REFUSED' in message,
          f'outcome={outcome}, mysql={probe.statements()}, http={probe.http}, {message.strip()[:120]}')


print('Audit target guard')
print()
print('  Refused, before any change')

REMOTE_IP = '203.0.113.10'
expect_refusal('reseed(): -h <remote IP>', audit.reseed,
               mysql_args=['-u', 'root', '-h', REMOTE_IP, '-P', '3306'])
expect_refusal('reseed(): --host=<remote name>', audit.reseed,
               mysql_args=['-u', 'root', '--host=mysql.prod.example.invalid'])
expect_refusal('sql("DELETE ..."): -h<remote IP> (attached form)',
               lambda: audit.sql('DELETE FROM login_attempts'),
               mysql_args=['-u', 'root', f'-h{REMOTE_IP}'])
expect_refusal('sql("UPDATE ..."): no -h, MYSQL_HOST=<remote IP>',
               lambda: audit.sql("UPDATE users SET status = 'active'"),
               mysql_args=['-u', 'root', '-P', '3306'], mysql_host_env=REMOTE_IP)
expect_refusal('reseed(): LAN address 192.168.254.108 (not classified as local)',
               audit.reseed, mysql_args=['-u', 'root', '-h', '192.168.254.108', '-P', '3307'])
expect_refusal('reseed(): --pipe to another host', audit.reseed,
               mysql_args=['-u', 'root', '--pipe', '-h', 'dbserver.example.invalid'])
expect_refusal('reseed(): option file the guard cannot see through', audit.reseed,
               mysql_args=['--defaults-extra-file=C:/elsewhere/prod.cnf', '-u', 'root'])
expect_refusal('reseed(): local port, but the server is another machine (tunnel)',
               audit.reseed, server_hostname='railway-mysql-7f3a')
expect_refusal('npm run audit: PAWS_API = production', run_audit_main, api=PRODUCTION_API)
expect_refusal('npm run audit: PAWS_API = LAN address', run_audit_main, api=LAN_API)
expect_refusal('npm run audit: local API, remote database', run_audit_main,
               mysql_args=['-u', 'root', '-h', REMOTE_IP, '-P', '3306'])

# The production API is refused before even the database check runs.
_, _, probe = refused(run_audit_main, api=PRODUCTION_API)
check('npm run audit: production API stops before any MySQL invocation', not probe.mysql,
      f'mysql={probe.mysql}')
# A tunnel is caught by the identity probe, and the seed never follows it.
_, _, probe = refused(audit.reseed, server_hostname='railway-mysql-7f3a')
check('tunnel: only the read-only identity probe reached the server',
      [c[-1] for c in probe.mysql] == ['SELECT 1, @@hostname'], f'mysql={probe.mysql}')

print()
print('  Allowed: this machine')

configure()
check('default PAWS_MYSQL_ARGS resolves to 127.0.0.1',
      audit.mysql_destination()[0] == '127.0.0.1', str(audit.mysql_destination()))
for host in ('localhost', '127.0.0.1', '::1', '[::1]', '127.0.0.2'):
    check(f'is_loopback({host!r})', audit.is_loopback(host))
for api in (DEFAULT_API, 'http://127.0.0.1/pawsandfound/api', 'http://localhost:8080/api',
            'http://[::1]/pawsandfound/api'):
    configure(api=api)
    try:
        audit.require_local_api()
        ok = True
    except audit.UnsafeTarget:
        ok = False
    check(f'require_local_api(): {api}', ok)
for args in (DEFAULT_ARGS, ['-u', 'root', '-h', 'localhost', '-P', '3307'],
             ['-u', 'root', '--host=127.0.0.1', '--port=3307'],
             ['-u', 'root', '--pipe', '-h', '.']):
    configure(mysql_args=args)
    try:
        audit.require_local_database()
        ok = True
    except audit.UnsafeTarget:
        ok = False
    check(f'require_local_database(): {" ".join(args)}', ok)

configure()
try:
    reachable = audit.db_reachable()
    detail = ''
except audit.UnsafeTarget as e:
    reachable, detail = False, str(e.code).strip()
check('real local database: reachable, and reports this machine '
      f'({socket.gethostname()})', reachable is True, detail or 'is XAMPP MariaDB running on 3307?')

print(f'\n{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
