"""
Paws&Found — the multi-device rehearsal.

Three sessions, each with its own cookie jar, exactly as three browsers on
three machines would have. They all talk to one Apache, one PHP and one MySQL,
which is the only thing the scenario actually requires: what is being tested is
whether the *database* is the authority, or whether each session is quietly
carrying its own copy of the truth.

This is not a substitute for the real rehearsal on real devices — see
docs/lan-testing.md, which says what only hardware can show. It is what can be
run on any machine, in twenty seconds, as often as the code changes.

Run it against the LAN address on the day as well:

    PAWS_API=http://192.168.254.108/pawsandfound/api python scripts/multi_device.py

It restores the demonstration data at the end, so it can be run again.

Stdlib only. Nothing to install.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit
from audit import reseed, sql

# A run against PAWS_API is driving a server whose source tree this machine may
# not own — a container, or a host. Two checks in section K turn the session
# timeout down by writing a local config file, and such a server never reads it.
REMOTE = bool(os.environ.get('PAWS_API'))
if REMOTE:
    audit.API = os.environ['PAWS_API']

PW = audit.PW
results = []


def check(step, what, expected, actual):
    ok = expected == actual
    results.append((step, what, expected, actual, ok))
    verdict = 'PASS' if ok else 'FAIL'
    print(f'  {step:<5} {what:<56} {str(expected):<22} {str(actual):<22} {verdict}')


skipped = []


def skip(step, what, why):
    """A check this run is not in a position to make.

    Not a pass and not a failure. Counting it either way would be a lie: one
    hides that the check did not happen, the other reports the product as
    broken when it is the harness that cannot reach far enough.
    """
    skipped.append((step, what, why))
    print(f'  {step:<5} {what:<56} {"-":<22} {"-":<22} SKIP')
    print(f'        {why}')


def device(email, password=PW):
    """One browser on one machine: its own cookies, its own CSRF token."""
    session = audit.Session()
    session.prime_csrf()
    code, payload = session.call('POST', '/auth/login', {'email': email, 'password': password})
    session.prime_csrf()
    return session, code, payload


def role_of(session):
    """What the server thinks this session is, right now. Not what it was told
    at sign-in — current_user() re-reads the row on every request."""
    code, payload = session.call('GET', '/auth/me')
    if code != 200:
        return str(code)
    # /auth/me answers {csrf_token, user}, not {data} — it is the one endpoint
    # that hands back a token as well as a person.
    return ((payload.get('user') or {}).get('role')) or 'signed out'


def banner(title):
    print()
    print(title)
    print('-' * 118)
    print(f'  {"":<5} {"What is being tested":<56} {"Expected":<22} {"Actual":<22} Result')


# ======================================================= A — one account, three devices
# A customer may be signed in on any number of devices. A coordinator or an
# administrator keeps one session at a time; that is section L.
banner('A. The same customer account signed in on three devices')
STAFF = audit.ACCOUNTS['staff']
CUSTOMER = audit.ACCOUNTS['customer']
a, code_a, _ = device(CUSTOMER)
b, code_b, _ = device(CUSTOMER)
c, code_c, _ = device(CUSTOMER)
check('A1', 'Device A signs in', 200, code_a)
check('A2', 'Device B signs in, A is not logged out', 200, code_b)
check('A3', 'Device C signs in, A and B are not logged out', 200, code_c)
check('A4', 'All three are the same person on the server',
      'user/user/user', '/'.join(role_of(d) for d in (a, b, c)))

# ======================================================= B — a change on one device
banner('B. A report is filed and changed on one device')
customer, _, _ = device(audit.ACCOUNTS['customer'])
report_id, code = audit.file_report('customer', pet_name='Multi Device Dog')
check('B1', 'A report is filed', 200, code)
check('B2', 'Device B sees it without signing in again', 'Multi Device Dog',
      b.call('GET', f'/reports/{report_id}')[1].get('data', {}).get('pet_name'))
customer.call('PATCH', f'/reports/{report_id}', {'status': 'closed', 'note': 'Found on our own.'})
check('B3', 'Device C sees the new status on refresh', 'closed',
      c.call('GET', f'/reports/{report_id}')[1].get('data', {}).get('status'))
check('B4', 'The database agrees, not just the response', 'closed',
      sql(f'SELECT status FROM pet_reports WHERE report_id={report_id}'))

# ======================================================= C — read state is shared
banner('C. Read state lives in the database, not in a device')
first, _, _ = device(audit.ACCOUNTS['customer'])
second, _, _ = device(audit.ACCOUNTS['customer'])
unread_before = int(sql("SELECT COUNT(*) FROM notifications n JOIN users u ON u.user_id = n.user_id "
                        f"WHERE u.email = '{audit.ACCOUNTS['customer']}' AND n.is_read = 0") or 0)
check('C1', 'There were unread notifications to begin with', True, unread_before > 0)
check('C2', 'Device 1 marks them all read', 200, first.call('PATCH', '/notifications')[0])
unread_after = int(sql("SELECT COUNT(*) FROM notifications n JOIN users u ON u.user_id = n.user_id "
                       f"WHERE u.email = '{audit.ACCOUNTS['customer']}' AND n.is_read = 0") or 0)
check('C3', 'Device 2 has nothing unread either', 0, unread_after)
check('C4', "Device 2's own request agrees", 0,
      sum(1 for n in (second.call('GET', '/notifications')[1].get('data') or [])
          if not n.get('is_read', n.get('read', False))))

# ======================================================= D — role change mid-session
banner('D. An administrator changes the role while the account is signed in')
admin, _, _ = device(audit.ACCOUNTS['admin'])
staff_id = int(sql(f"SELECT user_id FROM users WHERE email = '{STAFF}'"))
coordinator, _, _ = device(STAFF)
check('D1', 'Administrator downgrades staff to user', 200,
      admin.call('PATCH', f'/users/{staff_id}', {'role': 'user'})[0])
check('D2', "The coordinator's device is a customer on its very next request", 'user', role_of(coordinator))
check('D3', 'Calling a coordinator endpoint from it is refused', 403,
      coordinator.call('GET', '/reports/stats')[0])
check('D4', 'The audit log says who did it', 'role_changed',
      sql(f"SELECT action FROM audit_logs WHERE target_id = {staff_id} "
          "AND action = 'role_changed' ORDER BY audit_id DESC LIMIT 1") or '(none)')
# Now a customer, the account may sign in on a second device as well.
second_device, code, _ = device(STAFF)
check('D5', 'As a customer it signs in on a second device too', 'user/user',
      f'{role_of(coordinator)}/{role_of(second_device)}')
# Promoted back: sessions that were open as a customer's would all become a
# coordinator's at once, so every one of them ends instead.
check('D6', 'Administrator promotes it back to staff', 200,
      admin.call('PATCH', f'/users/{staff_id}', {'role': 'staff'})[0])
check('D7', 'Both earlier sessions end with the promotion', 'signed out/signed out',
      f'{role_of(coordinator)}/{role_of(second_device)}')
promoted, code, _ = device(STAFF)
check('D8', 'Signing in again gives one coordinator session', 'staff', role_of(promoted))

# ======================================================= E — suspension mid-session
banner('E. The account is suspended while all three are signed in')
customer_id = int(sql(f"SELECT user_id FROM users WHERE email = '{CUSTOMER}'"))
check('E1', 'Administrator suspends the account', 200,
      admin.call('PATCH', f'/users/{customer_id}',
                 {'account_status': 'suspended',
                  'reason': 'Suspended by the multi-device rehearsal.'})[0])
# `/auth/me` answers 200 with `user: null` rather than 401 — it is the "who am
# I" endpoint, which a signed-out visitor calls too, and it has to be able to
# say "nobody" without that being an error. So the test that matters is not
# what /auth/me returns, it is whether a protected call is still allowed.
for label, dev in (('A', a), ('B', b), ('C', c)):
    check(f'E{ord(label) - 63}', f'Device {label}: /auth/me says nobody is signed in',
          'signed out', role_of(dev))
    check(f'E{ord(label) - 63}b', f'Device {label}: a protected call is refused',
          401, dev.call('GET', '/notifications')[0])
admin.call('PATCH', f'/users/{customer_id}', {'account_status': 'active'})

# ======================================================= F — the lock is in the database
banner('F. Three wrong passwords on one device lock the account everywhere')
sql(f"DELETE FROM login_attempts WHERE email = '{STAFF}'")
wrong = audit.Session()
wrong.prime_csrf()
for attempt in (1, 2, 3):
    code, _ = wrong.call('POST', '/auth/login', {'email': STAFF, 'password': 'not-the-password'})
    check(f'F{attempt}', f'Attempt {attempt} on device A', 401 if attempt < 3 else 403, code)
check('F4', 'The counter is in MySQL, not in a cookie', '3',
      sql(f"SELECT failed_count FROM login_attempts WHERE email = '{STAFF}'"))
elsewhere = audit.Session()
elsewhere.prime_csrf()
check('F5', 'The CORRECT password on device B is still refused', 403,
      elsewhere.call('POST', '/auth/login', {'email': STAFF, 'password': PW})[0])
check('F6', 'The account really is locked in the database', 'locked',
      sql(f"SELECT account_status FROM users WHERE email = '{STAFF}'"))

# ======================================================= G — administrator unlock
banner('G. The administrator unlocks it')
check('G1', 'Administrator reinstates the account', 200,
      admin.call('PATCH', f'/users/{staff_id}', {'account_status': 'active'})[0])
check('G2', 'The failed-attempt counter went with it', '',
      sql(f"SELECT failed_count FROM login_attempts WHERE email = '{STAFF}'"))
returning = audit.Session()
returning.prime_csrf()
check('G3', 'Device B can sign in again', 200,
      returning.call('POST', '/auth/login', {'email': STAFF, 'password': PW})[0])
check('G4', 'The unlock is in the audit log', 'account_unlocked',
      sql(f"SELECT action FROM audit_logs WHERE target_id = {staff_id} "
          "AND action = 'account_unlocked' ORDER BY audit_id DESC LIMIT 1") or '(none)')

# ======================================================= H — typing a forbidden address
banner('H. A customer goes looking for somewhere they are not allowed')
cust, _, _ = device(audit.ACCOUNTS['customer'])
check('H1', 'GET /users — the administrator account list', 403, cust.call('GET', '/users')[0])
check('H2', 'GET /moderation — the flag queue', 403, cust.call('GET', '/moderation')[0])
check('H3', 'POST /categories — managing species', 403,
      cust.call('POST', '/categories', {'label': 'Should Not Exist'})[0])
check('H4', "PATCH somebody else's report", 403,
      cust.call('PATCH', '/reports/5', {'status': 'closed'})[0])
check('H5', 'An endpoint that does not exist', 404, cust.call('GET', '/users/1/password')[0])
check('H6', 'Nothing was created by H3', '0',
      sql("SELECT COUNT(*) FROM pet_categories WHERE category_name = 'Should Not Exist'"))

# ============================== I — two coordinators, one case
banner('I. Two coordinators decide the same pairing at the same moment')
# The real shape of the race: both devices loaded the page while the pairing
# was open, so both believe it is undecided. One of them is wrong by the time
# they click, and the database is the only thing that knows which.
sql("UPDATE match_claims SET match_status='suggested', reviewed_by_user_id=NULL "
    "WHERE match_id=1")
sql("DELETE FROM status_logs WHERE note LIKE 'Ownership verified%'")

staff_a, _, _ = device(audit.ACCOUNTS['staff'])
staff_b, _, _ = device(audit.ACCOUNTS['admin'])
before_logs = int(sql("SELECT COUNT(*) FROM status_logs") or 0)
before_notes = int(sql("SELECT COUNT(*) FROM notifications") or 0)

check('I1', 'Both coordinators see an undecided pairing', 'suggested/suggested',
      '/'.join(d.call('GET', '/matches/1')[1]['data']['status'] for d in (staff_a, staff_b)))
check('I2', 'A confirms', 200,
      staff_a.call('PATCH', '/matches/1', {'action': 'confirm'})[0])
check('I3', 'B rules it out from a page that is now stale', 409,
      staff_b.call('PATCH', '/matches/1', {'action': 'reject', 'note': 'Different dog.'})[0])
check('I4', "The database keeps A's result", 'confirmed',
      sql("SELECT match_status FROM match_claims WHERE match_id=1"))
check('I5', 'B wrote no contradicting case history', before_logs + 2,
      int(sql("SELECT COUNT(*) FROM status_logs") or 0))
check('I6', 'B notified nobody', before_notes + 2,
      int(sql("SELECT COUNT(*) FROM notifications") or 0))

# ============================== J — two people move the same report
banner('J. Two people move the same report at the same moment')
owner_one, _, _ = device(audit.ACCOUNTS['customer'])
owner_two, _, _ = device(audit.ACCOUNTS['customer'])
rid, _ = audit.file_report('customer', pet_name='Race Dog')
reason = {'status': 'closed', 'note': 'Came home on its own.'}
check('J1', 'The first close succeeds', 200,
      owner_one.call('PATCH', f'/reports/{rid}', reason)[0])
check('J2', 'The second, from a stale page, is refused', 409,
      owner_two.call('PATCH', f'/reports/{rid}', reason)[0])
check('J3', 'The report closed exactly once', 1,
      int(sql(f"SELECT COUNT(*) FROM status_logs WHERE report_id={rid} "
              "AND new_status='closed'") or 0))

# ============================== K — the session runs out
banner('K. Sessions expire on the server, not in the browser')
# Rather than waiting an hour, the timeouts are turned down to a second in a
# gitignored local config, then removed again. The point is that the SERVER
# enforces it: nothing in the browser is asked.
local_config = os.path.join(audit.PROJECT, 'api', 'config.local.php')
existing = open(local_config, encoding='utf-8').read() if os.path.exists(local_config) else None
try:
    with open(local_config, 'w', encoding='utf-8') as handle:
        # Written line by line: an escaped newline in a literal does not
        # survive being copied between tools, and a config file that is
        # half-written is a confusing way to fail.
        print("<?php", file=handle)
        print("define('SESSION_IDLE_TIMEOUT', 1);", file=handle)
        print("define('SESSION_ABSOLUTE_TIMEOUT', 1);", file=handle)

    expiring, code, _ = device(audit.ACCOUNTS['customer'])
    check('K1', 'Signs in normally', 200, code)
    check('K2', 'And is signed in', 'user', role_of(expiring))
    time.sleep(2.5)
    if REMOTE:
        why = ('the timeout is turned down by writing api/config.local.php here, '
               'which a server running elsewhere never reads')
        skip('K3', 'After the timeout, /auth/me says nobody', why)
        skip('K4', 'And a protected call is refused', why)
    else:
        check('K3', 'After the timeout, /auth/me says nobody', 'signed out', role_of(expiring))
        check('K4', 'And a protected call is refused', 401,
              expiring.call('GET', '/notifications')[0])
finally:
    if existing is None:
        os.remove(local_config)
    else:
        with open(local_config, 'w', encoding='utf-8') as handle:
            handle.write(existing)

fresh_again, code, _ = device(audit.ACCOUNTS['customer'])
check('K5', 'With the normal policy restored, signing in works', 200, code)
check('K6', 'And the session holds', 'user', role_of(fresh_again))

# ============================== L — one session for a privileged account
banner('L. A coordinator or an administrator keeps one session at a time')


def version_of(email):
    return int(sql(f"SELECT session_version FROM users WHERE email = '{email}'"))


for role, label, first_step in (('staff', 'coordinator', 1), ('admin', 'administrator', 6)):
    email = audit.ACCOUNTS[role]
    one, _, _ = device(email)
    step = lambda n: f'L{first_step + n}'
    check(step(0), f'The {label} signs in on device one', role, role_of(one))
    before = version_of(email)
    two, code, payload = device(email)
    check(step(1), '...then on device two, which is told earlier sessions ended', (200, True),
          (code, payload.get('previous_sessions_ended')))
    check(step(2), 'Device two works', role, role_of(two))
    check(step(3), 'Device one is signed out on its next request', ('signed out', 401),
          (role_of(one), one.call('GET', '/notifications')[0]))
    check(step(4), 'The account moved on exactly one generation', before + 1, version_of(email))

# A wrong password is no sign-in: it must not end the session that is open.
ADMIN = audit.ACCOUNTS['admin']
kept, _, _ = device(ADMIN)
before = version_of(ADMIN)
stranger = audit.Session()
stranger.prime_csrf()
check('L11', 'A wrong password for the administrator from elsewhere', 401,
      stranger.call('POST', '/auth/login', {'email': ADMIN, 'password': 'not-the-password'})[0])
check('L12', '...leaves the open administrator session working', ('admin', before),
      (role_of(kept), version_of(ADMIN)))
sql(f"DELETE FROM login_attempts WHERE email = '{ADMIN}'")

# A customer is not limited, and signing out ends only the device it is on.
phone, _, first = device(CUSTOMER)
laptop, _, second = device(CUSTOMER)
check('L13', 'A customer on two devices: both work, nothing ended', ('user/user', False, False),
      (f'{role_of(phone)}/{role_of(laptop)}', first.get('previous_sessions_ended'),
       second.get('previous_sessions_ended')))
before = version_of(CUSTOMER)
check('L14', 'Signing out on the phone', 200, phone.call('POST', '/auth/logout')[0])
check('L15', '...signs out the phone only; the laptop stays signed in', ('signed out', 'user', before),
      (role_of(phone), role_of(laptop), version_of(CUSTOMER)))

# ======================================================= summary
passed = sum(1 for row in results if row[4])
print()
print('=' * 118)
print(f'  {passed}/{len(results)} passed'
      + (f', {len(skipped)} skipped' if skipped else ''))
for step, what, why in skipped:
    print(f'  SKIPPED {step}  {what}: {why}')
if passed != len(results):
    print()
    for step, what, expected, actual, ok in results:
        if not ok:
            print(f'  FAILED  {step}  {what}: expected {expected}, got {actual}')
print()
print('Restoring the demonstration data...')
reseed()
print('  reports:', sql('SELECT COUNT(*) FROM pet_reports'),
      ' accounts:', sql('SELECT COUNT(*) FROM users'),
      ' lock counters:', sql('SELECT COUNT(*) FROM login_attempts'))
sys.exit(0 if passed == len(results) else 1)
