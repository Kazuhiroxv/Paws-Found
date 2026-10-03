"""
Paws&Found — sessions, the activity trail and the log viewer (Correction 5).

    python scripts/session_activity.py        (npm run test:sessions)

Against the local API and database. It writes api/config.local.php while it
runs — to turn the session clocks down to seconds and to capture email instead
of sending it — and puts back whatever was there. It restores the
demonstration data at the end.

  SES   one session record per sign-in, and every way one ends
  ACT   what the activity trail records, and what it refuses to
  LOG   who may read the logs, and the filters and paging
  SENS  sentinel secrets that must never reach any log table
  IP    a forwarded address is not believed from just anyone

Stdlib only.
"""
import glob
import json
import os
import re
import shutil
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit
from audit import reseed, sql

PW = audit.PW
LOCAL_CONFIG = os.path.join(audit.PROJECT, 'api', 'config.local.php')
CAPTURE_DIR = os.path.join(os.environ.get('TEMP', '/tmp'), 'pawsandfound-mail-sessions')

CUSTOMER = 'maria.santos@example.com'          # user 1
CUSTOMER2 = 'liza.ocampo@example.com'          # user 3
LOCKME = 'kenneth.villanueva@example.com'      # user 5
SUSPENDME = 'jomar.delacruz@example.com'       # user 2
PROMOTEME = 'aileen.reyes@example.com'         # user 4
RESETME = 'noel.aguilar@example.com'          # user 6
STAFF2 = 'rafael.mendoza@example.com'          # user 9, a coordinator nothing else signs in as
ADMIN = 'grace.bautista@example.com'           # user 10

NEW_PASSWORD = 'quiet harbour passphrase'       # no piece of "Noel Aguilar"
SENTINEL_PW = 'SENTINEL-pw-91f3c7e2-never-log'
SENTINEL_CAPTCHA = 'SENTINEL-turnstile-5a7d1c'

LOG_TABLES = {
    'user_sessions': "CONCAT_WS('|', session_reference, ip_address, user_agent, end_reason)",
    'user_activity_logs': "CONCAT_WS('|', action, route, target_type, detail, ip_address)",
    'audit_logs': "CONCAT_WS('|', actor_email, action, detail, ip_address)",
}

results = []


def php_list(name):
    """A constant list from api/helpers.php, so the suite checks against the real allowlist."""
    text = open(os.path.join(audit.PROJECT, 'api', 'helpers.php'), encoding='utf-8').read()
    block = text[text.index(f'const {name}'):]
    return re.findall(r"'([a-z_]+)'", block[:block.index('];')])


ACTIONS = php_list('ACTIVITY_ACTIONS')


def check(step, what, expected, actual):
    ok = expected == actual
    results.append((step, what, expected, actual, ok))
    print(f'  {step:<8}{what:<64}{str(expected)[:22]:<23}{str(actual)[:22]:<23}{"PASS" if ok else "FAIL"}')


def banner(title):
    print()
    print(title)
    print('-' * 122)


def write_config(**defines):
    """api/config.local.php for this run: email captured, plus any overrides."""
    with open(LOCAL_CONFIG, 'w', encoding='utf-8') as handle:
        print('<?php', file=handle)
        print("define('MAIL_TRANSPORT', 'capture');", file=handle)
        print("define('MAIL_CAPTURE_DIR', '" + CAPTURE_DIR.replace('\\', '/') + "');", file=handle)
        print("define('TURNSTILE_ENABLED', false);", file=handle)
        for name, value in defines.items():
            print(f"define('{name}', {value});", file=handle)


def device(email, password=PW):
    s = audit.Session()
    s.prime_csrf()
    code, payload = s.call('POST', '/auth/login', {'email': email, 'password': password})
    s.prime_csrf()
    return s, code, payload


def me(s):
    """(role or 'signed out', session_ended) as /auth/me says now."""
    _, payload = s.call('GET', '/auth/me')
    user = payload.get('user')
    return (user or {}).get('role') or 'signed out', payload.get('session_ended')


def uid(email):
    return int(sql(f"SELECT user_id FROM users WHERE email = '{email}'"))


def newest_record(email):
    """(id, ended?, reason) of the account's latest session record."""
    row = sql(f"SELECT session_record_id, ended_at IS NOT NULL, IFNULL(end_reason, '-') FROM user_sessions "
              f"WHERE user_id = {uid(email)} ORDER BY session_record_id DESC LIMIT 1")
    rid, ended, reason = row.split('\t')
    return int(rid), ended == '1', reason


def record_of(rid):
    ended, reason = sql(f"SELECT ended_at IS NOT NULL, IFNULL(end_reason, '-') FROM user_sessions "
                        f"WHERE session_record_id = {rid}").split('\t')
    return ended == '1', reason


def cookie(s, name='PHPSESSID'):
    return next((c.value for c in s.jar if c.name == name), None)


def activity_count(where):
    return int(sql(f'SELECT COUNT(*) FROM user_activity_logs WHERE {where}') or 0)


def latest_activity(user_email, action):
    row = sql(f"SELECT target_type, target_id FROM user_activity_logs WHERE user_id = {uid(user_email)} "
              f"AND action = '{action}' ORDER BY activity_id DESC LIMIT 1")
    return tuple(row.split('\t')) if row else None


def newest_mail(after):
    files = [f for f in glob.glob(os.path.join(CAPTURE_DIR, '*.json')) if os.path.getmtime(f) >= after]
    if not files:
        return None
    with open(max(files, key=os.path.getmtime), encoding='utf-8') as handle:
        return json.load(handle)


def token_from(message):
    match = re.search(r'token=([0-9a-f]+)', (message or {}).get('text', ''))
    return match.group(1) if match else None


def raw_call(s, method, path, body, headers):
    """A request with extra headers (audit.Session.call cannot add any)."""
    data = json.dumps(body).encode()
    request = urllib.request.Request(audit.API + path, data=data, method=method, headers={
        'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf or '', **headers})
    try:
        with s.opener.open(request, timeout=25) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def in_any_log(value):
    """How many rows of the three log tables contain `value` anywhere."""
    if not value:
        return 0
    needle = value.replace('\\', '\\\\').replace("'", "''")
    return sum(int(sql(f"SELECT COUNT(*) FROM {table} WHERE {columns} LIKE CONCAT('%', '{needle}', '%')") or 0)
               for table, columns in LOG_TABLES.items())


# ======================================================================= set up
previous_config = open(LOCAL_CONFIG, encoding='utf-8').read() if os.path.exists(LOCAL_CONFIG) else None
shutil.rmtree(CAPTURE_DIR, ignore_errors=True)
reseed()
sql('DELETE FROM auth_rate_limits')
write_config()
cookies_seen = []
csrf_seen = []

try:
    # =================================================================== SES
    banner('SES. One session record per sign-in, and how each one ends')
    before = int(sql(f'SELECT COUNT(*) FROM user_sessions WHERE user_id = {uid(CUSTOMER)}'))
    phone, code, _ = device(CUSTOMER)
    cookies_seen.append(cookie(phone))
    csrf_seen.append(phone.csrf)
    rid, ended, _ = newest_record(CUSTOMER)
    after = int(sql(f'SELECT COUNT(*) FROM user_sessions WHERE user_id = {uid(CUSTOMER)}'))
    check('SES-01', 'A successful sign-in creates one session record', (200, before + 1), (code, after))
    check('SES-02', 'It belongs to the account that signed in', str(uid(CUSTOMER)),
          sql(f'SELECT user_id FROM user_sessions WHERE session_record_id = {rid}'))
    ip = sql(f'SELECT ip_address FROM user_sessions WHERE session_record_id = {rid}')
    check('SES-03', 'The IP address is recorded', True, ip in ('::1', '127.0.0.1'))
    check('SES-04', "The browser's user agent is recorded", True,
          (sql(f'SELECT user_agent FROM user_sessions WHERE session_record_id = {rid}') or '').startswith('Python-urllib'))
    check('SES-05', 'The start time is recorded, just now', '1',
          sql(f'SELECT ABS(TIMESTAMPDIFF(SECOND, started_at, NOW())) < 60 FROM user_sessions WHERE session_record_id = {rid}'))
    reference = sql(f'SELECT session_reference FROM user_sessions WHERE session_record_id = {rid}')
    check('SES-06', 'A random 32-hex reference, unique across every record', (True, '1'),
          (bool(re.fullmatch(r'[0-9a-f]{32}', reference or '')),
           sql('SELECT COUNT(*) = COUNT(DISTINCT session_reference) FROM user_sessions')))
    check('SES-07', 'The PHP session id itself is stored nowhere', (True, 0),
          (bool(cookies_seen[0]) and cookies_seen[0] != reference, in_any_log(cookies_seen[0])))

    laptop, _, _ = device(CUSTOMER)
    cookies_seen.append(cookie(laptop))
    check('SES-14', 'A customer on two devices: two open records, both work', ('2', 'user', 'user'),
          (sql(f'SELECT COUNT(*) FROM user_sessions WHERE user_id = {uid(CUSTOMER)} AND ended_at IS NULL'),
           me(phone)[0], me(laptop)[0]))

    check('SES-08a', 'Signing out on the phone', 200, phone.call('POST', '/auth/logout')[0])
    check('SES-08', '...ends its record as a sign-out; the laptop record stays open',
          ((True, 'logout'), 'user'), (record_of(rid), me(laptop)[0]))

    first, _, _ = device(STAFF2)
    first_rid, _, _ = newest_record(STAFF2)
    second, _, payload = device(STAFF2)
    second_rid, _, _ = newest_record(STAFF2)
    cookies_seen += [cookie(first), cookie(second)]
    check('SES-12', 'Coordinator signs in again elsewhere: the first record ends',
          ((True, 'new_privileged_login'), (False, '-')), (record_of(first_rid), record_of(second_rid)))
    check('SES-12b', '...and the first device is told why', ('signed out', 'new_privileged_login'), me(first))

    kept, _, _ = device(ADMIN)
    kept_rid, _, _ = newest_record(ADMIN)
    stranger = audit.Session()
    stranger.prime_csrf()
    stranger.call('POST', '/auth/login', {'email': ADMIN, 'password': SENTINEL_PW})
    check('SES-13', 'A wrong password elsewhere does not end the open session',
          ('admin', (False, '-')), (me(kept)[0], record_of(kept_rid)))
    sql(f"DELETE FROM login_attempts WHERE email = '{ADMIN}'")

    # The clocks, turned down to seconds.
    write_config(SESSION_LAST_SEEN_INTERVAL=1)
    toucher, _, _ = device(CUSTOMER2)
    touch_rid, _, _ = newest_record(CUSTOMER2)
    time.sleep(2.2)
    me(toucher)
    check('SES-18', 'Last seen moves on with use (interval turned down to 1 s)', '1',
          sql(f'SELECT last_seen_at > started_at FROM user_sessions WHERE session_record_id = {touch_rid}'))

    write_config(SESSION_IDLE_TIMEOUT=1, SESSION_ABSOLUTE_TIMEOUT=3600)
    idle, _, _ = device(CUSTOMER2)
    idle_rid, _, _ = newest_record(CUSTOMER2)
    time.sleep(2.5)
    check('SES-09', 'Idle past the limit: signed out, told why', ('signed out', 'idle_timeout'), me(idle))
    check('SES-09b', '...the record says idle_timeout', (True, 'idle_timeout'), record_of(idle_rid))
    check('SES-09c', '...dated when it expired, not when somebody noticed', '1',
          sql(f'SELECT ended_at <= NOW() - INTERVAL 1 SECOND FROM user_sessions WHERE session_record_id = {idle_rid}'))
    code, payload = idle.call('GET', '/notifications')
    check('SES-09d', 'A protected call says so too: 401 with the reason', (401, 'idle_timeout'),
          (code, payload.get('session_ended')))

    write_config(SESSION_IDLE_TIMEOUT=3600, SESSION_ABSOLUTE_TIMEOUT=1)
    absolute, _, _ = device(CUSTOMER2)
    absolute_rid, _, _ = newest_record(CUSTOMER2)
    time.sleep(2.5)
    check('SES-10', 'Past the absolute limit: signed out, told why', ('signed out', 'absolute_timeout'), me(absolute))
    check('SES-10b', '...the record says absolute_timeout', (True, 'absolute_timeout'), record_of(absolute_rid))
    write_config()

    # A password reset ends every session of the account.
    one, _, _ = device(RESETME)
    two, _, _ = device(RESETME)
    cookies_seen += [cookie(one), cookie(two)]
    open_before = sql(f'SELECT GROUP_CONCAT(session_record_id) FROM user_sessions '
                      f'WHERE user_id = {uid(RESETME)} AND ended_at IS NULL')
    started = time.time()
    audit.Session().call('POST', '/auth/forgot-password', {'email': RESETME})
    reset_token = token_from(newest_mail(started))
    resetter = audit.Session()
    resetter.prime_csrf()
    check('SES-11a', 'The password is reset through the emailed link', 200,
          resetter.call('POST', '/auth/reset-password', {'token': reset_token, 'password': NEW_PASSWORD})[0])
    check('SES-11', 'Every open record of the account ends: password_reset', 'password_reset',
          sql(f'SELECT GROUP_CONCAT(DISTINCT end_reason) FROM user_sessions WHERE session_record_id IN ({open_before})'))
    check('SES-11b', 'Both devices are told why', [('signed out', 'password_reset')] * 2, [me(one), me(two)])

    # A lock ends the sessions it finds open.
    locked_device, _, _ = device(LOCKME)
    lock_rid, _, _ = newest_record(LOCKME)
    guesser = audit.Session()
    guesser.prime_csrf()
    for _ in range(3):
        guesser.call('POST', '/auth/login', {'email': LOCKME, 'password': SENTINEL_PW})
    check('SES-15', 'Three wrong passwords lock the account; its record ends', (True, 'account_locked'),
          record_of(lock_rid))
    check('SES-15b', 'The signed-in device is told why', ('signed out', 'account_locked'), me(locked_device))

    admin, _, _ = device(ADMIN)
    cookies_seen.append(cookie(admin))
    csrf_seen.append(admin.csrf)
    admin.call('PATCH', f'/users/{uid(LOCKME)}', {'account_status': 'active'})

    suspended, _, _ = device(SUSPENDME)
    suspend_rid, _, _ = newest_record(SUSPENDME)
    admin.call('PATCH', f'/users/{uid(SUSPENDME)}', {'account_status': 'suspended', 'reason': 'Session suite.'})
    check('SES-16', 'A suspension ends the open record', (True, 'account_suspended'), record_of(suspend_rid))
    check('SES-16b', 'The device is told why', ('signed out', 'account_suspended'), me(suspended))
    admin.call('PATCH', f'/users/{uid(SUSPENDME)}', {'account_status': 'active'})
    check('SES-16c', 'Reinstating does not bring the ended session back', 'signed out', me(suspended)[0])

    promoted, _, _ = device(PROMOTEME)
    promote_rid, _, _ = newest_record(PROMOTEME)
    admin.call('PATCH', f'/users/{uid(PROMOTEME)}', {'role': 'staff'})
    check('SES-17', 'Promotion to coordinator ends the customer sessions', (True, 'role_promoted'),
          record_of(promote_rid))
    check('SES-17b', '...and the device is told why', ('signed out', 'role_promoted'), me(promoted))
    as_staff, _, _ = device(PROMOTEME)
    staff_rid, _, _ = newest_record(PROMOTEME)
    admin.call('PATCH', f'/users/{uid(PROMOTEME)}', {'role': 'user'})
    check('SES-17c', 'Demotion keeps the session, now as a customer (policy unchanged)',
          ('user', (False, '-')), (me(as_staff)[0], record_of(staff_rid)))

    stale_ref = 'feedc0de' + '0' * 24
    sql(f"INSERT INTO user_sessions (session_reference, user_id, session_version, ip_address, started_at, last_seen_at) "
        f"VALUES ('{stale_ref}', {uid(CUSTOMER)}, 1, '192.0.2.44', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY)")
    _, payload = admin.call('GET', '/logs/sessions?session=feedc0de')
    states = [row['state'] for row in payload.get('data', [])]
    _, payload = admin.call('GET', f'/logs/sessions?session={reference[:10]}')
    check('SES-19', 'A record never ended, three days old, is "expired" — never "open"', (['expired'], ['ended']),
          (states, [row['state'] for row in payload.get('data', [])]))
    _, payload = admin.call('GET', '/logs/sessions?state=open&per_page=100')
    check('SES-19b', 'Only records still in time are listed as open', True,
          all(row['state'] == 'open' and row['ended_at'] is None for row in payload.get('data', []))
          and stale_ref not in [row['session_reference'] for row in payload.get('data', [])])

    # =================================================================== ACT
    banner('ACT. What the activity trail records, and what it refuses')
    walker, _, _ = device(CUSTOMER)
    walk_rid, _, _ = newest_record(CUSTOMER)
    cookies_seen.append(cookie(walker))
    csrf_seen.append(walker.csrf)
    check('ACT-16', 'Sign-in is in the trail, on its own session', '1',
          sql(f"SELECT COUNT(*) FROM user_activity_logs WHERE action = 'login' AND session_record_id = {walk_rid}"))
    check('ACT-01', 'A page view is recorded (201)', 201, walker.call('POST', '/activity/page-view', {'path': '/dashboard'})[0])
    _, again = walker.call('POST', '/activity/page-view', {'path': '/dashboard'})
    check('ACT-03', 'The same page again within seconds is one visit, not two', (False, 1),
          (again.get('logged'), activity_count(f"session_record_id = {walk_rid} AND route = '/dashboard'")))
    walker.call('POST', '/activity/page-view', {'path': '/pet/1'})
    check('ACT-02', 'Opening another page adds a row, with the report it is about', ('report', '1'),
          tuple(sql(f"SELECT target_type, target_id FROM user_activity_logs WHERE session_record_id = {walk_rid} "
                    "AND route = '/pet/1'").split('\t')))
    refused = [walker.call('POST', '/activity/page-view', {'path': path})[0]
               for path in ('/reset-password?token=abc123', '/pet/1#private', 'https://evil.example/x', '//evil',
                            '/a\nb', '/' + 'x' * 250)]
    check('ACT-05', 'A query, a #fragment, an outside URL, a control character: refused', [422] * 6, refused)
    check('ACT-06', 'Nothing with a ? or # or "token" reached the trail', '0',
          sql("SELECT COUNT(*) FROM user_activity_logs WHERE route LIKE '%?%' OR route LIKE '%#%' OR route LIKE '%token%'"))
    check('ACT-18', 'Each row carries its session and the IP', ('0', '0'),
          (sql(f'SELECT COUNT(*) FROM user_activity_logs WHERE session_record_id = {walk_rid} AND ip_address IS NULL'),
           sql(f'SELECT COUNT(*) FROM user_activity_logs a JOIN user_sessions s USING (session_record_id) '
               f'WHERE a.session_record_id = {walk_rid} AND a.user_id <> s.user_id')))

    rows_before = activity_count(f'session_record_id = {walk_rid}')
    for _ in range(4):
        walker.call('GET', '/auth/me')
    walker.call('GET', '/notifications')
    walker.call('GET', '/reports?per_page=3')
    walker.call('GET', '/drafts')
    check('ACT-21', 'The background check and plain reads add nothing', rows_before,
          activity_count(f'session_record_id = {walk_rid}'))

    guest = audit.Session()
    guest.prime_csrf()
    total = activity_count('1')
    check('ACT-22', 'A guest cannot report a page view (401), and nothing is stored', (401, total),
          (guest.call('POST', '/activity/page-view', {'path': '/explore'})[0], activity_count('1')))

    forger, _, _ = device(RESETME, NEW_PASSWORD)
    forger.call('POST', '/activity/page-view', {'path': '/explore', 'user_id': uid(ADMIN), 'action': 'report_removed',
                                                 'ip_address': '203.0.113.99', 'detail': 'forged'})
    forged = sql("SELECT user_id, action, IFNULL(detail, '-'), ip_address <> '203.0.113.99' FROM user_activity_logs "
                 "WHERE route = '/explore' ORDER BY activity_id DESC LIMIT 1")
    check('ACT-19', 'Actor, action, detail and IP in the body are ignored', f"{uid(RESETME)}\tpage_view\t-\t1", forged)
    check('ACT-20', 'An invented action is not an endpoint, and none is stored',
          (404, '0'), (forger.call('POST', '/activity/report_removed', {'path': '/'})[0],
                       sql("SELECT COUNT(*) FROM user_activity_logs WHERE action NOT IN ("
                           + ','.join(f"'{a}'" for a in ACTIONS) + ")")))

    flooder, _, _ = device(CUSTOMER2)
    burst = [flooder.call('POST', '/activity/page-view', {'path': f'/burst/{n}'})[0] for n in range(70)]
    check('ACT-23', 'A flood is cut off at 60 a minute (429), and only 60 are stored', (True, '60'),
          (429 in burst, sql("SELECT COUNT(*) FROM user_activity_logs WHERE route LIKE '/burst/%'")))

    rid_report, _ = audit.file_report('customer', pet_name='Activity Trail Dog')
    check('ACT-07', 'Filing a report: report_submitted, with the report', ('report', str(rid_report)),
          latest_activity(CUSTOMER, 'report_submitted'))
    check('ACT-10', "The coordinator's approval: report_approved", ('report', str(rid_report)),
          latest_activity(audit.ACCOUNTS['staff'], 'report_approved'))
    customer = audit.session('customer')
    code, payload = customer.call('POST', '/drafts', {'report_type': 'lost', 'pet_name': 'Draft Trail'})
    draft_id = (payload.get('data') or {}).get('draft_id')
    customer.call('PUT', f'/drafts/{draft_id}', {'pet_name': 'Draft Trail Two'})
    customer.call('DELETE', f'/drafts/{draft_id}')
    check('ACT-08', 'Draft saved, updated, deleted: three rows, the draft named',
          [('draft', str(draft_id))] * 3,
          [latest_activity(CUSTOMER, a) for a in ('draft_saved', 'draft_updated', 'draft_deleted')])
    check('ACT-09', 'Submitting for review is the report_submitted row (ACT-07)', True,
          latest_activity(CUSTOMER, 'report_submitted') is not None)
    rejected, _ = audit.file_report('customer', publish=False, pet_name='Activity Rejected Dog')
    audit.session('staff').call('PATCH', f'/reports/{rejected}/publication', {'action': 'reject', 'note': 'Photo needed.'})
    check('ACT-11', 'A rejection: report_rejected', ('report', str(rejected)),
          latest_activity(audit.ACCOUNTS['staff'], 'report_rejected'))
    customer.call('PUT', f'/reports/{rid_report}', {'description': 'Edited by the session suite, long enough to count.'})
    check('ACT-12', 'An edit: report_edited', ('report', str(rid_report)), latest_activity(CUSTOMER, 'report_edited'))
    match_id = sql("SELECT match_id FROM match_claims WHERE match_status = 'suggested' ORDER BY match_id LIMIT 1")
    audit.session('staff').call('PATCH', f'/matches/{match_id}', {'action': 'request_information',
                                                                   'note': 'A photo of the collar, please.'})
    check('ACT-13', 'A matching decision: match_request_information', ('match', match_id),
          latest_activity(audit.ACCOUNTS['staff'], 'match_request_information'))
    flagger = audit.session('customer2')
    code, payload = flagger.call('POST', '/moderation', {'report_id': rid_report, 'reason': 'spam', 'details': 'Session suite flag.'})
    case_id = (payload.get('data') or {}).get('case_id')
    admin.call('PATCH', f'/moderation/{case_id}', {'action': 'dismiss'})
    check('ACT-14', 'A flag and its moderation decision are both recorded',
          (('report', str(rid_report)), ('moderation_case', str(case_id))),
          (latest_activity(audit.ACCOUNTS['customer2'], 'report_flagged'), latest_activity(ADMIN, 'moderation_decided')))
    customer.call('PATCH', '/users/me', {'first_name': 'Maria', 'last_name': 'Santos', 'email': CUSTOMER,
                                         'contact_number': '+63 917 010 0101'})
    check('ACT-15', 'A profile update: profile_updated, with no values in it', (('user', str(uid(CUSTOMER))), '0'),
          (latest_activity(CUSTOMER, 'profile_updated'),
           sql("SELECT COUNT(*) FROM user_activity_logs WHERE detail LIKE '%917%' OR detail LIKE '%Santos%'")))
    walker.call('POST', '/auth/logout')
    check('ACT-17', 'Sign-out is in the trail, on the session it ended', '1',
          sql(f"SELECT COUNT(*) FROM user_activity_logs WHERE action = 'logout' AND session_record_id = {walk_rid}"))

    # =================================================================== LOG
    banner('LOG. Who may read the logs; filtering and paging')
    codes = {kind: admin.call('GET', f'/logs/{kind}')[0] for kind in ('activity', 'sessions', 'audit')}
    check('LOG-01', 'Administrator: the activity log', 200, codes['activity'])
    check('LOG-02', 'Administrator: the sessions log', 200, codes['sessions'])
    _, payload = admin.call('GET', '/logs/audit?action=login_failed')
    check('LOG-03', 'Administrator: security events, failed sign-ins among them', (200, True),
          (codes['audit'], payload.get('meta', {}).get('total', 0) >= 3))
    staff = audit.session('staff')
    customer2 = audit.session('customer2')
    check('LOG-04', 'Pet Coordinator: 403 on all three', [403] * 3,
          [staff.call('GET', f'/logs/{k}')[0] for k in ('activity', 'sessions', 'audit')])
    check('LOG-05', 'Customer: 403 on all three', [403] * 3,
          [customer2.call('GET', f'/logs/{k}')[0] for k in ('activity', 'sessions', 'audit')])
    check('LOG-06', 'Guest: 401 on all three', [401] * 3,
          [audit.Session().call('GET', f'/logs/{k}')[0] for k in ('activity', 'sessions', 'audit')])

    # Ten thousand rows for one account, spread over a week, on 200 addresses.
    digits = 'SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 ' \
             'UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9'
    sql('INSERT INTO user_activity_logs (user_id, action, route, ip_address, created_at) '
        f"SELECT {uid(STAFF2)}, IF(n % 10 = 0, 'login', 'page_view'), CONCAT('/volume/', n), "
        "CONCAT('198.51.100.', n % 200), NOW() - INTERVAL n MINUTE FROM "
        f'(SELECT a.d + 10 * b.d + 100 * c.d + 1000 * e.d AS n FROM ({digits}) a, ({digits}) b, '
        f'({digits}) c, ({digits}) e) numbers')
    started = time.time()
    _, page1 = admin.call('GET', '/logs/activity?per_page=50&page=1')
    elapsed = time.time() - started
    _, page2 = admin.call('GET', '/logs/activity?per_page=50&page=2')
    ids1 = [row['activity_id'] for row in page1['data']]
    ids2 = [row['activity_id'] for row in page2['data']]
    meta = page1['meta']
    check('LOG-07', 'Paging 10,000+ rows: 50 a page, no overlap, honest totals, under 2 s',
          (50, 50, True, True, True),
          (len(ids1), len(ids2), not set(ids1) & set(ids2), meta['total'] >= 10000 and meta['total_pages'] == -(-meta['total'] // 50),
           elapsed < 2))
    stamps = [row['created_at'] for row in page1['data'] + page2['data']]
    check('LOG-13', 'Newest first, across the page boundary', True, stamps == sorted(stamps, reverse=True))

    day = (datetime.now(timezone(timedelta(hours=8))) - timedelta(days=3)).strftime('%Y-%m-%d')
    _, payload = admin.call('GET', f'/logs/activity?from={day}&to={day}&per_page=100')
    manila_days = {(datetime.strptime(r['created_at'], '%Y-%m-%d %H:%M:%S') + timedelta(hours=8)).strftime('%Y-%m-%d')
                   for r in payload['data']}
    expected_total = int(sql(f"SET time_zone = '+08:00'; SELECT COUNT(*) FROM user_activity_logs "
                             f"WHERE created_at >= '{day} 00:00:00' AND created_at < '{day} 00:00:00' + INTERVAL 1 DAY"))
    check('LOG-08', 'Date filter: only that Manila day, and all of it', ({day}, expected_total),
          (manila_days, payload['meta']['total']))
    _, payload = admin.call('GET', '/logs/activity?user=rafael.mendoza&per_page=100')
    check('LOG-09', 'Person filter: only that account', {STAFF2},
          {row['user']['email'] for row in payload['data']})
    _, payload = admin.call('GET', '/logs/activity?ip=198.51.100.7&per_page=100')
    check('LOG-10', 'IP filter: only that address, and every row of it',
          ({'198.51.100.7'}, int(sql("SELECT COUNT(*) FROM user_activity_logs WHERE ip_address = '198.51.100.7'"))),
          ({row['ip_address'] for row in payload['data']}, payload['meta']['total']))
    _, logins = admin.call('GET', '/logs/activity?action=login&per_page=100')
    _, actions = admin.call('GET', '/logs/activity?action=actions&per_page=100')
    check('LOG-11', 'Action filter: one action; "actions" leaves out page views; nonsense is 422',
          ({'login'}, False, 422),
          ({row['action'] for row in logins['data']}, any(r['action'] == 'page_view' for r in actions['data']),
           admin.call('GET', '/logs/activity?action=admin_removed_report')[0]))
    _, payload = admin.call('GET', f'/logs/activity?session={reference[:8]}&per_page=100')
    check('LOG-12', 'Session filter: the shortened reference finds that session only', {reference},
          {row['session_reference'] for row in payload['data']})
    check('LOG-12b', 'A malformed reference or IP is refused, not searched', [422, 422],
          [admin.call('GET', '/logs/activity?session=zz')[0], admin.call('GET', '/logs/sessions?ip=999.1.1.1')[0]])

    # =================================================================== IP
    banner('IP. A forwarded address is not believed from just anyone')
    spoofer, _, _ = device(CUSTOMER)
    raw_call(spoofer, 'POST', '/activity/page-view', {'path': '/help'}, {'X-Forwarded-For': '203.0.113.9'})
    check('IP-01', 'X-Forwarded-For from a browser is ignored on this server', '0',
          sql("SELECT COUNT(*) FROM user_activity_logs WHERE ip_address = '203.0.113.9'"))
    check('IP-02', 'The session records hold no forged address either', '0',
          sql("SELECT COUNT(*) FROM user_sessions WHERE ip_address = '203.0.113.9'"))

    # ================================================================== SENS
    banner('SENS. Sentinel secrets never reach a log table')
    started = time.time()
    newcomer = audit.Session()
    newcomer.prime_csrf()
    newcomer.call('POST', '/auth/register', {'first_name': 'Sentinel', 'last_name': 'Checker',
                                             'email': 'sentinel.checker@example.com', 'password': 'amber lantern mountain',
                                             'privacy_consent': True, 'captcha_token': SENTINEL_CAPTCHA})
    verify_token = token_from(newest_mail(started))
    newcomer.call('POST', '/auth/verify-email', {'token': verify_token})
    signed, _, _ = device('sentinel.checker@example.com', 'amber lantern mountain')
    signed.call('POST', '/activity/page-view', {'path': '/dashboard', 'password': SENTINEL_PW, 'token': verify_token})
    cookies_seen.append(cookie(signed))
    csrf_seen.append(signed.csrf)
    check('SENS-01', 'The sentinel password (typed at failed sign-ins)', 0, in_any_log(SENTINEL_PW))
    check('SENS-02', 'Any bcrypt hash', 0, in_any_log('$2y$'))
    check('SENS-03', 'Any CSRF token handed out', [0] * len(csrf_seen), [in_any_log(t) for t in csrf_seen])
    check('SENS-04', 'The password-reset token', (True, 0), (bool(reset_token), in_any_log(reset_token)))
    check('SENS-05', 'The email-verification token', (True, 0), (bool(verify_token), in_any_log(verify_token)))
    sessions_seen = [c for c in cookies_seen if c]
    check('SENS-06', 'Any PHP session id (cookie value)', (True, [0] * len(sessions_seen)),
          (len(sessions_seen) >= 8, [in_any_log(c) for c in sessions_seen]))
    check('SENS-07', 'The Turnstile token', 0, in_any_log(SENTINEL_CAPTCHA))
    check('SENS-08', 'A cookie header', 0, in_any_log('PHPSESSID'))
    check('SENS-09', 'The new password chosen at the reset', 0, in_any_log(NEW_PASSWORD))
finally:
    if previous_config is None:
        if os.path.exists(LOCAL_CONFIG):
            os.remove(LOCAL_CONFIG)
    else:
        with open(LOCAL_CONFIG, 'w', encoding='utf-8') as handle:
            handle.write(previous_config)
    shutil.rmtree(CAPTURE_DIR, ignore_errors=True)

passed = sum(1 for row in results if row[4])
print()
print('=' * 122)
print(f'  {passed}/{len(results)} passed')
for step, what, expected, actual, ok in results:
    if not ok:
        print(f'  FAILED  {step}  {what}: expected {expected}, got {actual}')
print()
print('Restoring the demonstration data...')
reseed()
sys.exit(0 if passed == len(results) else 1)
