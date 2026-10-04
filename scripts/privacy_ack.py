"""
Paws&Found — the Privacy Notice update acknowledgement (Correction 7).

    python scripts/privacy_ack.py        (npm run test:privacy-ack)

Against the local API and database; reseeds at the start and the end. The
seeded accounts agreed to the notice of 2026-09-23, before Correction 5
described the session and activity records (the current version is
PRIVACY_NOTICE_VERSION in api/config.php).

  PRIV-01  an account that agreed to an older version is told: /auth/me says
           the current notice is not acknowledged
  PRIV-02  an account already on the current version is not
  PRIV-04  acknowledging records the current version in privacy_consents —
           the one consent table, no second system — and /auth/me agrees
  PRIV-05  it is not a consent to optional processing: nothing in the body
           is read, there is no "decline", and the security and activity
           records are kept before, during and after, acknowledged or not
  PRIV-06  the notice blocks nothing: an unacknowledged account works as usual
  PRIV-07  nobody can acknowledge for somebody else; a guest cannot at all;
           a request without the CSRF token is refused
  PRIV-08  the acknowledgement is in the activity trail, once, with the
           version, the network address and the session

Stdlib only.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit
from audit import reseed, sql

PW = audit.PW
CUSTOMER = 'maria.santos@example.com'     # user 1
OTHER = 'liza.ocampo@example.com'         # user 3
STAFF = 'patricia.lim@example.com'
CURRENT = open(os.path.join(audit.PROJECT, 'api', 'config.php'), encoding='utf-8').read() \
    .split("define('PRIVACY_NOTICE_VERSION', '")[1].split("'")[0]

results = []


def check(tid, what, expected, actual):
    ok = expected == actual
    results.append(ok)
    print(f'  {tid:<9}{what:<70}{str(expected)[:18]:<19}{str(actual)[:18]:<19}{"PASS" if ok else "FAIL"}')


def signed_in(email):
    s = audit.Session()
    s.prime_csrf()
    code, _ = s.call('POST', '/auth/login', {'email': email, 'password': PW})
    assert code == 200, f'could not sign in as {email}: {code}'
    s.prime_csrf()
    return s


def notice(s):
    _, payload = s.call('GET', '/auth/me')
    return (payload.get('user') or {}).get('privacy_notice') or {}


def uid(email):
    return int(sql(f"SELECT user_id FROM users WHERE email = '{email}'"))


def rows(user_id):
    return int(sql(f"SELECT COUNT(*) FROM privacy_consents WHERE user_id = {user_id} AND notice_version = '{CURRENT}'"))


def trail(user_id):
    return int(sql(f"SELECT COUNT(*) FROM user_activity_logs WHERE user_id = {user_id} AND action = 'privacy_notice_acknowledged'"))


if not audit.db_reachable():
    print('The local database is not reachable.')
    sys.exit(2)

reseed()
print(f'Current notice: {CURRENT}\n')

customer = signed_in(CUSTOMER)
me = uid(CUSTOMER)
other = uid(OTHER)

print('PRIV-01  an older agreement is told')
n = notice(customer)
check('PRIV-01', '/auth/me names the current version', CURRENT, n.get('version'))
check('PRIV-01', 'and says it has not been acknowledged', False, n.get('acknowledged'))
check('PRIV-01', 'the seeded agreement is to an older version', '2026-09-23',
      sql(f'SELECT MAX(notice_version) FROM privacy_consents WHERE user_id = {me}'))

print('\nPRIV-06  nothing is blocked meanwhile')
code, _ = customer.call('GET', '/reports?publication=all&reporter_id=' + str(me))
check('PRIV-06', 'an unacknowledged account still lists its own reports', 200, code)
code, _ = customer.call('POST', '/activity/page-view', {'path': '/dashboard'})
check('PRIV-06', 'and still records a page view', 201, code)
code, _ = customer.call('GET', '/notifications')
check('PRIV-06', 'and still reads its notifications', 200, code)

print('\nPRIV-05  a notice, not an optional consent')
before = int(sql(f"SELECT COUNT(*) FROM user_activity_logs WHERE user_id = {me} AND action = 'page_view'"))
check('PRIV-05', 'page views were recorded before any acknowledgement', True, before >= 1)
code, payload = customer.call('POST', '/auth/privacy-acknowledgement',
                              {'consent': False, 'decline': True, 'user_id': other, 'version': '1999-01-01'})
check('PRIV-05', 'a body asking to decline is not a choice: it is ignored', 200, code)
check('PRIV-05', 'and the answer is simply "acknowledged"', True, (payload.get('privacy_notice') or {}).get('acknowledged'))
customer.call('POST', '/activity/page-view', {'path': '/dashboard/profile'})
after = int(sql(f"SELECT COUNT(*) FROM user_activity_logs WHERE user_id = {me} AND action = 'page_view'"))
check('PRIV-05', 'and recording carries on exactly as before', True, after == before + 1)
check('PRIV-05', 'no row for a made-up version', 0,
      int(sql(f"SELECT COUNT(*) FROM privacy_consents WHERE notice_version = '1999-01-01'")))

print('\nPRIV-04  the acknowledgement is recorded where agreements are')
check('PRIV-04', 'one privacy_consents row for the current version', 1, rows(me))
check('PRIV-04', 'with the network address it came from', True,
      bool(sql(f"SELECT ip_address FROM privacy_consents WHERE user_id = {me} AND notice_version = '{CURRENT}'")))
check('PRIV-04', '/auth/me now says acknowledged', True, notice(customer).get('acknowledged'))
code, _ = customer.call('POST', '/auth/privacy-acknowledgement')
check('PRIV-04', 'acknowledging twice is harmless', 200, code)
check('PRIV-04', 'and still one row, the first one kept', 1, rows(me))
check('PRIV-04', 'no table but privacy_consents holds it', 0,
      int(sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'pawsandfound' "
              "AND table_name LIKE '%acknowledg%'")))
again = signed_in(CUSTOMER)
check('PRIV-04', 'a new sign-in is not told again', True, notice(again).get('acknowledged'))

print('\nPRIV-02  an account on the current version is not told')
check('PRIV-02', 'the coordinator, given a current agreement, is not told', True,
      (sql(f"INSERT INTO privacy_consents (user_id, notice_version) SELECT user_id, '{CURRENT}' FROM users "
           f"WHERE email = '{STAFF}'") or True) and notice(signed_in(STAFF)).get('acknowledged'))

print('\nPRIV-07  only for yourself')
check('PRIV-07', 'the body named another account; that account is untouched', 0, rows(other))
other_s = signed_in(OTHER)
check('PRIV-07', 'and is still told', False, notice(other_s).get('acknowledged'))
code, _ = audit.Session().call('POST', '/auth/privacy-acknowledgement')
check('PRIV-07', 'a guest cannot acknowledge', True, code in (401, 403))
code, _ = other_s.call('POST', '/auth/privacy-acknowledgement', csrf=False)
check('PRIV-07', 'a request without the CSRF token is refused', 403, code)
check('PRIV-07', 'so it is still unacknowledged', 0, rows(other))

print('\nPRIV-08  in the activity trail')
check('PRIV-08', 'one privacy_notice_acknowledged entry, however many presses', 1, trail(me))
check('PRIV-08', 'naming the version', CURRENT,
      sql(f"SELECT detail FROM user_activity_logs WHERE user_id = {me} AND action = 'privacy_notice_acknowledged'"))
check('PRIV-08', 'with an address and the session it happened in', True,
      sql(f"SELECT CONCAT(ip_address IS NOT NULL, session_record_id IS NOT NULL) FROM user_activity_logs "
          f"WHERE user_id = {me} AND action = 'privacy_notice_acknowledged'") == '11')
admin = signed_in('grace.bautista@example.com')
code, payload = admin.call('GET', '/logs/activity?action=privacy_notice_acknowledged')
check('PRIV-08', 'a Super Administrator can filter the log by it', 200, code)
check('PRIV-08', 'and finds it', True, any(r.get('action') == 'privacy_notice_acknowledged' for r in payload.get('data', [])))

reseed()
failed = results.count(False)
print(f'\n{len(results) - failed}/{len(results)} passed')
sys.exit(1 if failed else 0)
