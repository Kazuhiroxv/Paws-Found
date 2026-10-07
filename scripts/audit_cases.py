"""The test cases themselves. Run this file."""
import json
import os
import struct
import sys
import urllib.parse
import zlib

import audit
from audit import (PROJECT, check, file_report, multipart, place_codes, reseed,
                   results, session, sql, status)


def png(width=40, height=30):
    def chunk(kind, data):
        c = kind + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes([90, 140, 160] * width) for _ in range(height))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 1)) + chunk(b'IEND', b''))


# =============================================================== A. VALIDATION
def input_validation():
    # Registration is rate-limited per address; this suite registers far more
    # often than a person would. Cleared at the top of every block that
    # registers, exactly as the lock cases clear login_attempts — these are
    # testing validation, and the limit has its own cases in
    # scripts/auth_lifecycle.py.
    sql("DELETE FROM auth_rate_limits;")

    C = 'A. Input validation'
    status(C, 'IV-01', 'Report with an empty body', 'customer', 'POST', '/reports', {}, 422)
    status(C, 'IV-02', 'Report with no species', 'customer', 'POST', '/reports',
           {'report_type': 'lost', 'pet_name': 'X', 'incident_date': '2026-09-01',
            'city': 'Cebu City', 'province': 'Cebu'}, 422)
    status(C, 'IV-03', 'Lost report with no pet name', 'customer', 'POST', '/reports',
           {'report_type': 'lost', 'species': 'dog', 'incident_date': '2026-09-01',
            'city': 'Cebu City', 'province': 'Cebu'}, 422)
    status(C, 'IV-04', 'Report with no city or province', 'customer', 'POST', '/reports',
           {'report_type': 'lost', 'species': 'dog', 'pet_name': 'X',
            'incident_date': '2026-09-01'}, 422)
    status(C, 'IV-05', 'Incident date in the future', 'customer', 'POST', '/reports',
           {'report_type': 'lost', 'species': 'dog', 'pet_name': 'X',
            'incident_date': '2027-01-01', 'city': 'Cebu City', 'province': 'Cebu'}, 422)
    status(C, 'IV-06', 'Malformed incident date', 'customer', 'POST', '/reports',
           {'report_type': 'lost', 'species': 'dog', 'pet_name': 'X',
            'incident_date': '31/12/2026', 'city': 'Cebu City', 'province': 'Cebu'}, 422)
    status(C, 'IV-07', 'Size outside the permitted list', 'customer', 'POST', '/reports',
           {'report_type': 'lost', 'species': 'dog', 'pet_name': 'X', 'size': 'enormous',
            'incident_date': '2026-09-01', 'city': 'Cebu City', 'province': 'Cebu'}, 422)
    status(C, 'IV-08', 'Sort key outside the whitelist', 'guest', 'GET', '/reports?sort=bogus', None, 422)
    status(C, 'IV-09', 'Status filter outside the ENUM', 'guest', 'GET', '/reports?status=nonsense', None, 422)
    status(C, 'IV-10', 'Registration password under 15 characters', 'guest', 'POST', '/auth/register',
           {'first_name': 'Audit', 'last_name': 'Tester', 'email': 'audit.short@example.com', 'password': 'short',
            'privacy_consent': True}, 422)
    status(C, 'IV-11', 'Registration with a malformed email', 'guest', 'POST', '/auth/register',
           {'first_name': 'Audit', 'last_name': 'Tester', 'email': 'not-an-email', 'password': 'long enough passphrase',
            'privacy_consent': True}, 422)
    status(C, 'IV-12', 'Registration with no name', 'guest', 'POST', '/auth/register',
           {'first_name': '', 'last_name': '', 'email': 'audit.noname@example.com', 'password': 'long enough passphrase',
            'privacy_consent': True}, 422)
    status(C, 'IV-13', 'Registration reusing an existing email', 'guest', 'POST', '/auth/register',
           {'first_name': 'Audit', 'last_name': 'Tester', 'email': 'maria.santos@example.com', 'password': 'long enough passphrase',
            'privacy_consent': True}, 409)
    status(C, 'IV-14', 'Sign in with both fields blank', 'guest', 'POST', '/auth/login',
           {'email': '', 'password': ''}, 422)
    status(C, 'IV-15', 'Profile update with no email', 'customer', 'PATCH', '/users/me',
           {'first_name': 'Maria', 'last_name': 'Santos'}, 422)
    status(C, 'IV-16', 'Coordinator asking for information with no note', 'staff', 'PATCH',
           '/matches/2', {'action': 'request_information'}, 422)
    status(C, 'IV-17', 'Match action outside the permitted list', 'staff', 'PATCH',
           '/matches/2', {'action': 'obliterate'}, 422)
    status(C, 'IV-18', 'Moderation flag with an unknown reason', 'customer', 'POST',
           '/moderation', {'report_id': 5, 'reason': 'because'}, 422)

    code, payload = session('customer').call(
        'POST', '/reports', raw=b'{not json', content_type='application/json')
    check(C, 'IV-19', 'Body that is not valid JSON', 400, code, code == 400)


# ============================================================ B. SQL INJECTION
def sql_injection():
    C = 'B. SQL injection'
    payloads = [
        ('SQL-01', "' OR '1'='1"),
        ('SQL-02', "'; DROP TABLE pet_reports; --"),
        ('SQL-03', "' UNION SELECT email, password_hash FROM users --"),
        ('SQL-04', "admin'--"),
        ('SQL-05', "1; UPDATE users SET role='admin' WHERE user_id=1; --"),
        ('SQL-06', "%' OR 1=1 --"),
    ]
    for tid, payload in payloads:
        code, body = session('guest').call(
            'GET', '/reports?q=' + urllib.parse.quote(payload))
        rows = len(body.get('data', []))
        ok = code == 200 and rows == 0
        check(C, tid, f'Search field: {payload[:38]}', '200, 0 rows', f'{code}, {rows} rows', ok)

    code, body = session('guest').call('GET', '/reports?q=aspin')
    rows = len(body.get('data', []))
    check(C, 'SQL-07', 'Control: a genuine search still works', '200, rows > 0',
          f'{code}, {rows} rows', code == 200 and rows > 0)

    for tid, payload in [('SQL-08', "' OR '1'='1"), ('SQL-09', "admin'--"),
                         ('SQL-10', "' OR 1=1 --")]:
        code, _ = session('guest').call('POST', '/auth/login',
                                        {'email': payload, 'password': payload})
        check(C, tid, f'Sign-in form: {payload[:38]}', 401, code, code == 401)

    check(C, 'SQL-11', 'pet_reports table intact afterwards', '32 rows',
          sql('SELECT COUNT(*) FROM pet_reports;') + ' rows',
          sql('SELECT COUNT(*) FROM pet_reports;') == '32')
    # 22 physical: the 15 on the ERD, the three reference lists migration 009
    # added (ph_areas, ph_cities, pet_colours), publication_logs and
    # report_drafts from 010, user_sessions and user_activity_logs from 011,
    # plus schema_migrations and
    # auth_rate_limits, which are infrastructure rather than domain tables
    # (database/migrations/README.md).
    check(C, 'SQL-12', 'Schema intact afterwards', '24 tables',
          sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='pawsandfound';") + ' tables',
          sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='pawsandfound';") == '24')
    # 26 after migration 009 (ph_cities -> ph_areas, locations -> ph_cities);
    # 32 after 010 (publication_logs -> pet_reports, users; report_drafts ->
    # users, pet_categories, ph_areas, ph_cities); 35 after 011 (user_sessions
    # -> users; user_activity_logs -> users, user_sessions); 34 after 013
    # (pet_reports.assigned_staff_id, never used, removed with its key).
    # docs/erd-defense.md lists 34 (the figure is redrawn in the final ERD
    # pass). A diagram cannot be wrong quietly if the suite counts
    # the same thing the diagram is drawing.
    fks = sql("SELECT COUNT(*) FROM information_schema.table_constraints "
              "WHERE table_schema='pawsandfound' AND constraint_type='FOREIGN KEY';")
    check(C, 'SQL-14', 'Foreign keys match the ERD', '34 keys', fks + ' keys', fks == '34')
    roles = sql('SELECT GROUP_CONCAT(role ORDER BY user_id) FROM users WHERE user_id<=3;')
    check(C, 'SQL-13', 'No account was promoted', 'user,user,user', roles, roles == 'user,user,user')


# =========================================================== C. AUTHENTICATION
def authentication():
    # Registration is rate-limited per address; this suite registers far more
    # often than a person would. Cleared at the top of every block that
    # registers, exactly as the lock cases clear login_attempts — these are
    # testing validation, and the limit has its own cases in
    # scripts/auth_lifecycle.py.
    sql("DELETE FROM auth_rate_limits;")

    C = 'C. Authentication'
    from audit import ACCOUNTS, PW, Session
    status(C, 'AU-01', 'Sign in with correct credentials', 'guest', 'POST', '/auth/login',
           {'email': 'maria.santos@example.com', 'password': 'demo1234'}, 200)
    status(C, 'AU-02', 'Sign in with a wrong password', 'guest', 'POST', '/auth/login',
           {'email': 'maria.santos@example.com', 'password': 'wrong'}, 401)
    status(C, 'AU-03', 'Sign in with an account that does not exist', 'guest', 'POST',
           '/auth/login', {'email': 'nobody@example.com', 'password': 'demo1234'}, 401)

    # Both addresses start from a clean counter, or the two messages would
    # differ only because one of them had already failed more often — which
    # would make this test pass or fail by accident rather than on its merits.
    sql("DELETE FROM login_attempts;")
    _, a = session('guest').call('POST', '/auth/login',
                                 {'email': 'maria.santos@example.com', 'password': 'wrong'})
    _, b = session('guest').call('POST', '/auth/login',
                                 {'email': 'nobody@example.com', 'password': 'demo1234'})
    same = a.get('error') == b.get('error')
    check(C, 'AU-04', 'Both failures give the same message (no account enumeration)',
          'identical', 'identical' if same else 'different', same)
    sql("DELETE FROM login_attempts;")

    fresh = Session()
    fresh.call('POST', '/auth/login', {'email': 'maria.santos@example.com', 'password': 'demo1234'})
    code, _ = fresh.call('GET', '/notifications')
    check(C, 'AU-05', 'Protected endpoint while signed in', 200, code, code == 200)
    fresh.call('POST', '/auth/logout')
    code, _ = fresh.call('GET', '/notifications')
    check(C, 'AU-06', 'Same cookie after signing out', 401, code, code == 401)
    code, me = fresh.call('GET', '/auth/me')
    check(C, 'AU-07', 'auth/me after signing out', 'user: null',
          f'user: {me.get("user")}', me.get('user') is None)

    status(C, 'AU-08', 'Protected endpoint with no session at all', 'guest', 'GET',
           '/notifications', None, 401)

    reg = Session()
    code, _ = reg.call('POST', '/auth/register', {
        'first_name': 'Audit', 'last_name': 'Registrant', 'email': 'audit.new@example.com',
        'password': 'quiet river passphrase', 'contact_number': '+63 917 000 0000',
        'privacy_consent': True})
    check(C, 'AU-09', 'Register a new account', 201, code, code == 201)
    role = sql("SELECT role FROM users WHERE email='audit.new@example.com';")
    # Since migration 005 registering does NOT sign anybody in: the address has
    # not been proved yet, so a session here would be one that is not allowed
    # to do anything. The old case asserted the opposite and was right at the
    # time; it is inverted rather than deleted, because "does not happen" is
    # worth asserting once it used to.
    check(C, 'AU-10', 'A new account is NOT signed in', 'not signed in',
          'session started' if reg.call('GET', '/auth/me')[1].get('user') else 'not signed in',
          not reg.call('GET', '/auth/me')[1].get('user'))
    check(C, 'AU-10b', 'And it is unverified until the link is followed', '1',
          sql("SELECT COUNT(*) FROM users WHERE email='audit.new@example.com' "
              "AND email_verified_at IS NULL;"),
          sql("SELECT COUNT(*) FROM users WHERE email='audit.new@example.com' "
              "AND email_verified_at IS NULL;") == '1')
    # The CORRECT password, deliberately. A wrong one answers 401 whether or
    # not the address is verified — the password is checked first on purpose,
    # so that "this account exists but is pending" is never something an
    # attacker can learn by guessing at addresses.
    check(C, 'AU-10c', 'And cannot sign in yet, even with the right password', 403,
          Session().call('POST', '/auth/login',
                         {'email': 'audit.new@example.com', 'password': 'quiet river passphrase'})[0],
          Session().call('POST', '/auth/login',
                         {'email': 'audit.new@example.com', 'password': 'quiet river passphrase'})[0] == 403)
    check(C, 'AU-10d', 'And a wrong password is still only a wrong password', 401,
          Session().call('POST', '/auth/login',
                         {'email': 'audit.new@example.com', 'password': 'not-it'})[0],
          Session().call('POST', '/auth/login',
                         {'email': 'audit.new@example.com', 'password': 'not-it'})[0] == 401)

    esc = Session()
    esc.call('POST', '/auth/register', {
        'first_name': 'Audit', 'last_name': 'Escalator', 'email': 'audit.esc@example.com',
        'password': 'quiet river passphrase', 'role': 'admin', 'account_status': 'active',
        'privacy_consent': True})
    got = sql("SELECT role FROM users WHERE email='audit.esc@example.com';")
    check(C, 'AU-11', 'Register sending "role":"admin" in the body', 'user', got, got == 'user')

    hashes = sql("SELECT LEFT(password_hash,4), LENGTH(password_hash) FROM users WHERE user_id=1;")
    check(C, 'AU-12', 'Passwords stored as bcrypt hashes', '$2y$\t60', hashes, hashes == '$2y$\t60')

    sql("UPDATE users SET account_status='suspended' WHERE user_id=3;")
    susp = Session()
    code, _ = susp.call('POST', '/auth/login',
                        {'email': 'liza.ocampo@example.com', 'password': 'demo1234'})
    check(C, 'AU-13', 'A suspended account cannot sign in', 403, code, code == 403)
    sql("UPDATE users SET account_status='active' WHERE user_id=3;")

    # ---------------------------------------------------- the three-attempt lock
    #
    # Kenneth Villanueva files no reports in the demonstration data, so locking
    # and unlocking him disturbs nothing else the suite checks.
    sql("DELETE FROM login_attempts;")
    sql("UPDATE users SET account_status='active' WHERE user_id=5;")
    target = {'email': 'kenneth.villanueva@example.com', 'password': 'wrong'}

    codes, bodies = [], []
    for _ in range(3):
        code, body = session('guest').call('POST', '/auth/login', target)
        codes.append(code)
        bodies.append(body)

    check(C, 'AU-14', 'First failure reports the attempts remaining', 2,
          bodies[0].get('attempts_remaining'), bodies[0].get('attempts_remaining') == 2)
    check(C, 'AU-15', 'Second failure reports one attempt left', 1,
          bodies[1].get('attempts_remaining'), bodies[1].get('attempts_remaining') == 1)
    check(C, 'AU-16', 'Third failure locks the account', '403 locked',
          f'{codes[2]} {"locked" if bodies[2].get("locked") else "not locked"}',
          codes[2] == 403 and bodies[2].get('locked') is True)

    got = sql("SELECT account_status FROM users WHERE user_id=5;")
    check(C, 'AU-17', 'The lock is recorded in the database, not the session',
          'locked', got, got == 'locked')

    # The point of the whole feature: knowing the password is not a way out.
    code, _ = session('guest').call(
        'POST', '/auth/login',
        {'email': 'kenneth.villanueva@example.com', 'password': 'demo1234'})
    check(C, 'AU-18', 'The correct password does not lift the lock', 403, code, code == 403)

    # A locked account's existing sessions die too, because current_user()
    # re-reads the account on every request.
    sql("DELETE FROM login_attempts;")
    sql("UPDATE users SET account_status='active' WHERE user_id=5;")
    from audit import Session as _S
    live = _S()
    live.call('POST', '/auth/login',
              {'email': 'kenneth.villanueva@example.com', 'password': 'demo1234'})
    sql("UPDATE users SET account_status='locked' WHERE user_id=5;")
    code, _ = live.call('GET', '/notifications')
    check(C, 'AU-19', 'An open session on another device loses access at once',
          401, code, code == 401)

    # An unknown address must walk the same three steps, word for word, or the
    # countdown becomes a way of asking which addresses are registered.
    sql("DELETE FROM login_attempts;")
    unknown = []
    for _ in range(3):
        _, body = session('guest').call(
            'POST', '/auth/login',
            {'email': 'no.such.person@example.com', 'password': 'wrong'})
        unknown.append(body.get('error'))
    real = [b.get('error') for b in bodies]
    check(C, 'AU-20', 'An unknown address gives the identical three messages',
          'identical', 'identical' if unknown == real else 'different', unknown == real)

    # Unlocking is an administrator action, and it clears the counter with it —
    # otherwise the next wrong password locks the account straight back up.
    sql("UPDATE users SET account_status='locked' WHERE user_id=5;")
    code, _ = session('admin').call('PATCH', '/users/5', {'account_status': 'active'})
    check(C, 'AU-21', 'An administrator unlocks the account', 200, code, code == 200)
    code, _ = session('guest').call(
        'POST', '/auth/login',
        {'email': 'kenneth.villanueva@example.com', 'password': 'demo1234'})
    check(C, 'AU-22', 'Signing in works again after the unlock', 200, code, code == 200)

    # A customer must not be able to unlock anybody, including themselves.
    sql("UPDATE users SET account_status='locked' WHERE user_id=5;")
    code, _ = session('customer').call('PATCH', '/users/5', {'account_status': 'active'})
    check(C, 'AU-23', 'A customer cannot unlock an account', 403, code, code == 403)
    sql("UPDATE users SET account_status='active' WHERE user_id=5;")
    sql("DELETE FROM login_attempts;")

    # --------------------------------------------- the privacy acknowledgement
    #
    sql("DELETE FROM auth_rate_limits;")

    # The checkbox on the form is a convenience. What makes the consent record
    # trustworthy is that the account cannot be created without it here.
    status(C, 'AU-25', 'Registering without the privacy acknowledgement',
           'guest', 'POST', '/auth/register',
           {'first_name': 'Consent', 'last_name': 'Audit', 'email': 'audit.consent@example.com',
            'password': 'quiet river passphrase'}, 422)
    status(C, 'AU-26', 'Sending the acknowledgement as a string rather than true',
           'guest', 'POST', '/auth/register',
           {'first_name': 'Consent', 'last_name': 'Audit', 'email': 'audit.consent@example.com',
            'password': 'quiet river passphrase', 'privacy_consent': 'true'}, 422)

    none_yet = sql("SELECT COUNT(*) FROM users WHERE email='audit.consent@example.com';")
    check(C, 'AU-27', 'Neither refusal created an account', '0', none_yet, none_yet == '0')

    status(C, 'AU-28', 'Registering with the acknowledgement given',
           'guest', 'POST', '/auth/register',
           {'first_name': 'Consent', 'last_name': 'Audit', 'email': 'audit.consent@example.com',
            'password': 'quiet river passphrase', 'privacy_consent': True}, 201)

    recorded = sql("""SELECT c.notice_version FROM privacy_consents c
                        JOIN users u ON u.user_id = c.user_id
                       WHERE u.email = 'audit.consent@example.com';""")
    check(C, 'AU-29', 'The agreement is recorded against a notice version',
          'a version', recorded or 'nothing recorded', bool(recorded))

    # ----------------------------------------- cross-site request forgery
    #
    # The session cookie alone proves the request came from a signed-in
    # browser, not that the person meant to make it. These send a perfectly
    # valid request from a perfectly valid session, with the token left off —
    # which is exactly what a form on somebody else's site can manage.
    forged = Session()
    forged.call('POST', '/auth/login', {'email': ACCOUNTS['customer'], 'password': PW})

    code, body = forged.call('PATCH', '/users/me',
                             {'first_name': 'Forged', 'last_name': 'Name', 'email': ACCOUNTS['customer']},
                             csrf=False)
    check(C, 'AU-30', 'A write from a signed-in session with no token', '403 marked csrf',
          f'{code} {"marked" if body.get("csrf") else "unmarked"}',
          code == 403 and body.get('csrf') is True)

    code, _ = forged.call('POST', '/reports',
                          {'report_type': 'lost', 'species': 'dog', 'pet_name': 'Forged',
                           'incident_date': '2026-09-01', 'city': 'Cebu City', 'province': 'Cebu'},
                          csrf=False)
    check(C, 'AU-31', 'Filing a report with no token', 403, code, code == 403)

    # A token belonging to a different session is no better than none.
    stranger = Session()
    stranger.prime_csrf()
    borrowed = dict(forged.__dict__)                       # keep the real one
    forged.csrf = stranger.csrf
    code, _ = forged.call('PATCH', '/users/me',
                          {'first_name': 'Forged', 'last_name': 'Name', 'email': ACCOUNTS['customer']})
    check(C, 'AU-32', "Another session's token", 403, code, code == 403)
    forged.csrf = borrowed['csrf']

    # And the control: the same request, with the right token, goes through.
    forged.prime_csrf()
    code, _ = forged.call('PATCH', '/users/me',
                          {'first_name': 'Maria', 'last_name': 'Santos', 'email': ACCOUNTS['customer'],
                           'contact_number': '+63 917 010 0101',
                           'preferred_location': 'Makati City, Metro Manila'})
    check(C, 'AU-33', 'Control: the same write with the token', 200, code, code == 200)

    unchanged = sql("SELECT full_name FROM users WHERE email='%s';" % ACCOUNTS['customer'])
    check(C, 'AU-34', 'None of the forged writes changed anything',
          'Maria Santos', unchanged, unchanged == 'Maria Santos')

    # Reads need no token, or every page would have to ask permission to load.
    code, _ = Session().call('GET', '/reports')
    check(C, 'AU-35', 'Reading still needs no token', 200, code, code == 200)

    logged = sql("SELECT GROUP_CONCAT(DISTINCT action ORDER BY action) FROM audit_logs;")
    wanted = {'account_locked', 'account_unlocked', 'login', 'login_failed'}
    have = set(logged.split(',')) if logged and logged != 'NULL' else set()
    check(C, 'AU-24', 'The audit log recorded the lock and the unlock',
          'locked, unlocked, login, login_failed',
          ', '.join(sorted(have & wanted)) or 'nothing logged', wanted <= have)

    # GET /api/config exists to hand the browser the Turnstile SITE key, which
    # is meant to be public. Everything else the server is configured with is
    # not, and this endpoint is the one place a secret could plausibly be added
    # by accident - it is the only settings-shaped thing the frontend reads.
    code, body = Session().call('GET', '/config')
    data = body.get('data', {}) if isinstance(body, dict) else {}
    check(C, 'AU-36', 'The public config answers', 200, code, code == 200)
    check(C, 'AU-37', 'It offers only the Turnstile flag and site key',
          'turnstile_enabled, turnstile_site_key',
          ', '.join(sorted(data.keys())) or 'nothing',
          set(data.keys()) == {'turnstile_enabled', 'turnstile_site_key'})

    # Named rather than pattern-matched: a key is only a long string, and a
    # rule that flags long strings would flag the site key, which belongs here.
    leaked = [name for name in ('brevo', 'api_key', 'secret', 'password', 'mail_')
              if name in json.dumps(body).lower()]
    check(C, 'AU-38', 'No mail or secret setting reaches the browser', 'none',
          ', '.join(leaked) or 'none', not leaked)


# ============================================================ D. AUTHORIZATION
def authorization():
    C = 'D. Authorization'
    cases = [
        ('AZ-01', 'guest', 'GET', '/reports', 200, 'Anyone may browse reports'),
        ('AZ-02', 'guest', 'GET', '/reports/1', 401, 'A full report needs a session'),
        ('AZ-03', 'guest', 'GET', '/categories', 200, 'Anyone may read the species list'),
        ('AZ-04', 'guest', 'GET', '/matches', 401, 'Pairings need a session'),
        ('AZ-05', 'guest', 'POST', '/reports', 401, 'Filing needs a session'),
        ('AZ-06', 'guest', 'GET', '/notifications', 401, 'Notifications need a session'),
        ('AZ-07', 'guest', 'GET', '/reports/stats', 401, 'Dashboard figures need a session'),
        ('AZ-08', 'guest', 'GET', '/moderation', 401, 'Moderation queue needs a session'),
        ('AZ-09', 'guest', 'GET', '/users', 401, 'Account list needs a session'),
        ('AZ-10', 'customer', 'GET', '/reports/stats', 403, 'Customer may not read dashboard figures'),
        ('AZ-11', 'customer', 'GET', '/moderation', 403, 'Customer may not read the moderation queue'),
        ('AZ-12', 'customer', 'GET', '/users', 403, 'Customer may not list accounts'),
        ('AZ-13', 'staff', 'GET', '/reports/stats', 200, 'Coordinator may read dashboard figures'),
        ('AZ-14', 'staff', 'GET', '/moderation', 403, 'Coordinator may not read the moderation queue'),
        ('AZ-15', 'staff', 'GET', '/users', 403, 'Coordinator may not list accounts'),
        ('AZ-16', 'admin', 'GET', '/moderation', 200, 'Administrator may read the moderation queue'),
        ('AZ-17', 'admin', 'GET', '/users', 200, 'Administrator may list accounts'),
        ('AZ-18', 'admin', 'GET', '/reports/stats', 200, 'Administrator may read dashboard figures'),
    ]
    for tid, role, method, path, expect, desc in cases:
        status(C, tid, f'{role}: {desc}', role, method, path, None, expect)

    status(C, 'AZ-19', 'Customer editing a report they do not own', 'customer', 'PUT',
           '/reports/3', {'pet_name': 'Hijacked'}, 403)
    status(C, 'AZ-20', 'Customer changing the status of a report they do not own', 'customer',
           'PATCH', '/reports/3', {'status': 'closed'}, 403)
    status(C, 'AZ-21', 'Customer confirming a pairing', 'customer', 'PATCH', '/matches/2',
           {'action': 'confirm'}, 403)
    status(C, 'AZ-22', 'Customer rejecting a pairing', 'customer', 'PATCH', '/matches/2',
           {'action': 'reject'}, 403)
    status(C, 'AZ-23', 'Customer creating a pet category', 'customer', 'POST', '/categories',
           {'code': 'audit', 'label': 'Audit'}, 403)
    status(C, 'AZ-24', 'Coordinator deciding a moderation case', 'staff', 'PATCH',
           '/moderation/1', {'action': 'dismiss', 'note': 'x'}, 403)
    status(C, 'AZ-25', 'Customer changing another account', 'customer', 'PATCH', '/users/2',
           {'role': 'admin'}, 403)

    _, before = session('customer').call('GET', '/users/2')
    fields = before.get('data', {})
    leaked = [k for k in ('email', 'contact_number') if fields.get(k)]
    check(C, 'AZ-26', 'Customer reading another account sees no contact details',
          'no email or phone', ', '.join(leaked) or 'no email or phone', not leaked)

    sql("UPDATE match_claims SET proof_notes='AUDIT SECRET' WHERE match_id=2;")
    _, guest_view = session('guest').call('GET', '/matches/2')
    _, staff_view = session('staff').call('GET', '/matches/2')
    check(C, 'AZ-27', 'Signed-out caller cannot read a claimant\'s proof notes',
          'withheld', 'withheld' if 'proof_notes' not in guest_view.get('data', {}) else 'EXPOSED',
          'proof_notes' not in guest_view.get('data', {}))
    check(C, 'AZ-28', 'Coordinator can read proof notes',
          'present', 'present' if 'proof_notes' in staff_view.get('data', {}) else 'withheld',
          'proof_notes' in staff_view.get('data', {}))
    sql("UPDATE match_claims SET proof_notes=NULL WHERE match_id=2;")

    _, me = session('customer').call('PATCH', '/users/me', {
        'first_name': 'Maria', 'last_name': 'Santos', 'email': 'maria.santos@example.com', 'role': 'admin'})
    got = sql('SELECT role FROM users WHERE user_id=1;')
    check(C, 'AZ-29', 'Customer sending "role":"admin" to their own profile', 'user', got, got == 'user')

    status(C, 'AZ-30', 'Administrator suspending their own account', 'admin', 'PATCH',
           '/users/10', {'account_status': 'suspended'}, 422)
    status(C, 'AZ-31', 'Administrator demoting themselves', 'admin', 'PATCH', '/users/10',
           {'role': 'user'}, 422)


# ====================================================================== E. XSS
def xss():
    C = 'E. Cross-site scripting'
    # Since Correction 3 a pet's name takes letters, digits, spaces and
    # ' . - only, so markup there is refused outright (XSS-00). The stored-
    # and-escaped path is tested through the free-text fields instead.
    _, code = file_report('customer', pet_name='<script>alert(1)</script>')
    check(C, 'XSS-00', 'Markup in a pet name is refused (Correction 3 name rule)', 422, code, code == 422)
    payloads = {
        'location_label': '<script>alert(1)</script>',
        'distinct_features': '<img src=x onerror=alert(document.cookie)>',
        'description': '"><svg/onload=alert(1)> and enough words to pass the minimum',
    }
    rid, code = file_report('customer', **payloads)
    check(C, 'XSS-01', 'Report accepted with script payloads in three fields', 200, code, code == 200)

    stored = sql(f"SELECT l.label FROM pet_reports r JOIN locations l ON l.location_id = r.location_id "
                 f"WHERE r.report_id={rid};")
    check(C, 'XSS-02', 'Payload stored verbatim (escaping belongs at output)',
          payloads['location_label'], stored, stored == payloads['location_label'])

    _, body = session('finder').call('GET', f'/reports/{rid}')
    returned = (body.get('data', {}).get('location') or {}).get('label')
    check(C, 'XSS-03', 'API returns it as data, not markup', payloads['location_label'],
          returned, returned == payloads['location_label'])

    src = open(os.path.join(PROJECT, 'src', 'pages', 'public', 'PetDetailPage.jsx'),
                encoding='utf-8').read()
    check(C, 'XSS-04', 'No dangerouslySetInnerHTML on the page that renders it',
          'absent', 'absent' if 'dangerouslySetInnerHTML' not in src else 'PRESENT',
          'dangerouslySetInnerHTML' not in src)
    return rid


# =============================================================== F. FILE UPLOAD
def uploads(report_id):
    C = 'F. File upload'
    good = png()
    body, ctype = multipart([], [('photos[]', 'audit.png', good)])
    code, payload = session('customer').call('POST', f'/reports/{report_id}/photos',
                                             raw=body, content_type=ctype)
    check(C, 'UP-01', 'A real PNG is accepted', 201, code, code == 201)
    stored = sql(f'SELECT image_path FROM report_images WHERE report_id={report_id} LIMIT 1;')
    check(C, 'UP-02', 'Stored under a generated name, not the one sent',
          'not "audit.png"', stored or '(none)', bool(stored) and stored != 'audit.png')

    evil = b"<?php echo shell_exec('whoami'); ?>"
    body, ctype = multipart([], [('photos[]', 'cat.jpg', evil)])
    code, _ = session('customer').call('POST', f'/reports/{report_id}/photos',
                                       raw=body, content_type=ctype)
    check(C, 'UP-03', 'A PHP script renamed .jpg is refused', 422, code, code == 422)

    oversize = png(1500, 1500) + b'\x00' * (5 * 1024 * 1024)
    body, ctype = multipart([], [('photos[]', 'big.png', oversize)])
    code, _ = session('customer').call('POST', f'/reports/{report_id}/photos',
                                       raw=body, content_type=ctype)
    check(C, 'UP-04', 'A file over 5 MB is refused', 422, code, code == 422)

    body, ctype = multipart([], [('photos[]', 'audit.png', good)])
    code, _ = session('customer2').call('POST', f'/reports/{report_id}/photos',
                                        raw=body, content_type=ctype)
    check(C, 'UP-05', 'Uploading to a report you do not own is refused', 403, code, code == 403)

    body, ctype = multipart([], [('photos[]', 'audit.png', good)])
    code, _ = session('guest').call('POST', f'/reports/{report_id}/photos',
                                    raw=body, content_type=ctype)
    check(C, 'UP-06', 'Uploading with no session is refused', 401, code, code == 401)

    htaccess = os.path.join(PROJECT, 'api', 'uploads', '.htaccess')
    check(C, 'UP-07', 'The upload folder forbids execution', 'present',
          'present' if os.path.isfile(htaccess) else 'MISSING', os.path.isfile(htaccess))



# ================================================================ G. FUNCTIONAL
def functional():
    C = 'G. Functional'
    lost, code = file_report('customer', pet_name='Audit Tikoy', species='cat',
                             breed='Puspin (Philippine Domestic Shorthair)', size='small',
                             primary_color='Orange', distinct_features='White bib, crooked whisker pad',
                             incident_date='2026-09-05', city='Iloilo City', province='Iloilo')
    check(C, 'FN-01', 'A customer can file a lost report', 200, code, code == 200)

    found, code = file_report('finder', report_type='found', pet_name=None, species='cat',
                              breed='Puspin (Philippine Domestic Shorthair)', size='small',
                              primary_color='Orange',
                              distinct_features='White bib under the chin, crooked whisker pad',
                              incident_date='2026-09-07', city='Iloilo City', province='Iloilo')
    check(C, 'FN-02', 'A finder can file a found report with no pet name', 200, code, code == 200)

    match = sql(f'SELECT match_id FROM match_claims WHERE lost_report_id={lost} AND found_report_id={found};')
    check(C, 'FN-03', 'The system raises a possible match unprompted', 'a pairing',
          f'match {match}' if match else 'NONE', bool(match))
    signals = sql(f"SELECT COUNT(*) FROM match_signals WHERE match_id='{match}';") if match else '0'
    check(C, 'FN-04', 'All seven comparison signals are stored', '7', signals, signals == '7')
    statuses = sql(f'SELECT GROUP_CONCAT(status) FROM pet_reports WHERE report_id IN ({lost},{found});')
    check(C, 'FN-05', 'Both reports move to Possible Match', 'possible_match,possible_match',
          statuses, statuses == 'possible_match,possible_match')
    notes = sql(f"SELECT COUNT(*) FROM notifications WHERE match_id='{match}';") if match else '0'
    check(C, 'FN-06', 'Both reporters are notified', '2', notes, notes == '2')

    status(C, 'FN-07', 'The owner asks for verification', 'customer', 'PATCH', f'/matches/{match}',
           {'action': 'request_verification'}, 200)
    status(C, 'FN-08', 'The coordinator asks for more information', 'staff', 'PATCH',
           f'/matches/{match}', {'action': 'request_information', 'note': 'Describe the collar tag.'}, 200)
    status(C, 'FN-09', 'The coordinator confirms the pairing', 'staff', 'PATCH',
           f'/matches/{match}', {'action': 'confirm'}, 200)
    statuses = sql(f'SELECT GROUP_CONCAT(status) FROM pet_reports WHERE report_id IN ({lost},{found});')
    check(C, 'FN-10', 'Both reports become Returned', 'returned,returned', statuses,
          statuses == 'returned,returned')
    status(C, 'FN-11', 'Confirming the same pairing twice', 'staff', 'PATCH', f'/matches/{match}',
           {'action': 'confirm'}, 409)

    r2, _ = file_report('customer')
    m2 = sql(f'SELECT match_id FROM match_claims WHERE lost_report_id={r2} LIMIT 1;')
    if m2:
        status(C, 'FN-12', 'The coordinator rules a pairing out', 'staff', 'PATCH',
               f'/matches/{m2}', {'action': 'reject'}, 200)
        st = sql(f'SELECT status FROM pet_reports WHERE report_id={r2};')
        check(C, 'FN-13', 'A ruled-out report goes back to Active', 'active', st, st == 'active')

    status(C, 'FN-14', 'The owner edits their own report', 'customer', 'PUT', f'/reports/{r2}',
           {'pet_name': 'Audit Dog', 'description': 'Updated during the audit, with enough words to count.'}, 200)
    status(C, 'FN-15', 'The owner closes their own report', 'customer', 'PATCH', f'/reports/{r2}',
           {'status': 'closed', 'note': 'Found on our own.'}, 200)

    code, payload = session('customer').call('POST', '/moderation',
                                             {'report_id': 5, 'reason': 'spam',
                                              'details': 'Audit flag.'})
    check(C, 'FN-16', 'A customer can flag a report', 201, code, code == 201)
    case = sql('SELECT MAX(case_id) FROM moderation_cases;')
    status(C, 'FN-17', 'An administrator decides the case', 'admin', 'PATCH',
           f'/moderation/{case}', {'action': 'dismiss', 'note': 'Audit: not spam.'}, 200)
    status(C, 'FN-18', 'Deciding the same case twice', 'admin', 'PATCH', f'/moderation/{case}',
           {'action': 'dismiss', 'note': 'again'}, 409)

    code, body = session('customer').call('GET', '/notifications')
    check(C, 'FN-19', 'Notifications carry an unread count', 'meta.unread present',
          f"meta.unread = {body.get('meta', {}).get('unread')}",
          'unread' in body.get('meta', {}))
    status(C, 'FN-20', 'Marking every notification read', 'customer', 'PATCH', '/notifications', None, 200)
    left = sql('SELECT COUNT(*) FROM notifications WHERE user_id=1 AND is_read=0;')
    check(C, 'FN-21', 'No unread notifications remain', '0', left, left == '0')

    status(C, 'FN-22', 'An administrator adds a pet category', 'admin', 'POST', '/categories',
           {'code': 'ferret', 'label': 'Ferret'}, 201)
    status(C, 'FN-23', 'An administrator renames it', 'admin', 'PATCH', '/categories/ferret',
           {'label': 'Ferret / Weasel'}, 200)
    status(C, 'FN-24', 'An administrator deletes an unused category', 'admin', 'DELETE',
           '/categories/ferret', None, 200)
    status(C, 'FN-25', 'A category still in use cannot be deleted', 'admin', 'DELETE',
           '/categories/dog', None, 409)
    status(C, 'FN-26', 'A person updates their own profile', 'customer', 'PATCH', '/users/me',
           {'first_name': 'Maria', 'last_name': 'Santos', 'email': 'maria.santos@example.com',
            'contact_number': '+63 917 010 0101', 'preferred_location': 'Makati City, Metro Manila'}, 200)

    # ------------------------------------------------- the report state machine
    #
    # The interface only ever offers the moves that are allowed. These requests
    # are built by hand, which the interface cannot prevent — so the rule has to
    # be the server's, and this is where that is demonstrated.
    #
    # Report 18 is Maria's and Active; report 10 is hers and Returned.
    sql("UPDATE pet_reports SET status='active' WHERE report_id=18;")
    sql("UPDATE pet_reports SET status='returned' WHERE report_id=10;")

    status(C, 'FN-27', 'Active cannot be pushed to Possible Match by hand',
           'customer', 'PATCH', '/reports/18', {'status': 'possible_match'}, 409)
    status(C, 'FN-28', 'A returned report cannot go back to Active',
           'customer', 'PATCH', '/reports/10', {'status': 'active'}, 409)
    status(C, 'FN-29', 'Moving a report to the status it already has',
           'customer', 'PATCH', '/reports/18', {'status': 'active'}, 409)
    status(C, 'FN-30', 'A finished report can no longer be edited',
           'customer', 'PUT', '/reports/10', {'description': 'rewritten afterwards'}, 409)

    # Closed is the end of the line, and the refusal says so rather than
    # listing alternatives there are none of.
    # Closing ends a case, so it has to say why. Refused first, then accepted
    # with a reason, so the rule is proved in both directions rather than only
    # being stepped around.
    status(C, 'FN-31a', 'Closing a report with no reason is refused',
           'customer', 'PATCH', '/reports/18', {'status': 'closed'}, 422)
    check(C, 'FN-31b', 'And the report did not move', 'active',
          sql('SELECT status FROM pet_reports WHERE report_id=18;'),
          sql('SELECT status FROM pet_reports WHERE report_id=18;') == 'active')
    status(C, 'FN-31c', 'A reason of spaces is still no reason',
           'customer', 'PATCH', '/reports/18', {'status': 'closed', 'note': '   '}, 422)
    status(C, 'FN-31', 'The reporter closes an open report, with a reason',
           'customer', 'PATCH', '/reports/18',
           {'status': 'closed', 'note': 'The pet came home on its own.'}, 200)
    check(C, 'FN-31d', 'The reason is on the case history', True,
          sql("SELECT note FROM status_logs WHERE report_id=18 "
              "ORDER BY log_id DESC LIMIT 1;") == 'The pet came home on its own.',
          sql("SELECT note FROM status_logs WHERE report_id=18 "
              "ORDER BY log_id DESC LIMIT 1;") == 'The pet came home on its own.')
    code, body = session('customer').call('PATCH', '/reports/18', {'status': 'active'})
    check(C, 'FN-32', 'A closed report does not reopen', '409 with no moves left',
          f'{code} with {len(body.get("allowed", ["?"]))} moves left',
          code == 409 and body.get('allowed') == [])

    after = sql('SELECT status FROM pet_reports WHERE report_id=18;')
    check(C, 'FN-33', 'A refused move changes nothing in the database',
          'closed', after, after == 'closed')

    sql("UPDATE pet_reports SET status='active' WHERE report_id=18;")


# ============================================================ H. ERROR HANDLING
    # ---- reasons on consequential actions, and the contact preference ----
    #
    # All three are things the interface asks for. These prove the SERVER asks
    # too, because a request built by hand is not limited to the interface.
    mid = sql("SELECT match_id FROM match_claims WHERE match_status NOT IN "
              "('confirmed','rejected','dismissed') LIMIT 1;")
    if mid:
        status(C, 'FN-34', 'Ruling a pairing out with no reason is refused',
               'staff', 'PATCH', f'/matches/{mid}', {'action': 'reject'}, 422)
        check(C, 'FN-35', 'And the pairing did not move', True,
              sql(f"SELECT match_status FROM match_claims WHERE match_id={mid};")
              not in ('rejected',),
              sql(f"SELECT match_status FROM match_claims WHERE match_id={mid};") != 'rejected')
        status(C, 'FN-36', 'With a reason it is ruled out',
               'staff', 'PATCH', f'/matches/{mid}',
               {'action': 'reject', 'note': 'Different chest markings.'}, 200)

    uid = sql("SELECT user_id FROM users WHERE role='user' AND account_status='active' "
              "ORDER BY user_id DESC LIMIT 1;")
    status(C, 'FN-37', 'Suspending an account with no reason is refused',
           'admin', 'PATCH', f'/users/{uid}', {'account_status': 'suspended'}, 422)
    check(C, 'FN-38', 'And the account is untouched', 'active',
          sql(f"SELECT account_status FROM users WHERE user_id={uid};"),
          sql(f"SELECT account_status FROM users WHERE user_id={uid};") == 'active')
    status(C, 'FN-39', 'With a reason it is suspended',
           'admin', 'PATCH', f'/users/{uid}',
           {'account_status': 'suspended', 'reason': 'Repeated false reports.'}, 200)
    check(C, 'FN-40', 'The reason is in the audit log', True,
          'Repeated false reports.' in (sql(
              f"SELECT detail FROM audit_logs WHERE target_id={uid} "
              "AND action='account_suspended' ORDER BY audit_id DESC LIMIT 1;") or ''),
          'Repeated false reports.' in (sql(
              f"SELECT detail FROM audit_logs WHERE target_id={uid} "
              "AND action='account_suspended' ORDER BY audit_id DESC LIMIT 1;") or ''))
    session('admin').call('PATCH', f'/users/{uid}', {'account_status': 'active'})

    # The contact preference is a stored value, not something to be guessed
    # from whether a phone number came back. Report 1 belongs to the customer.
    sql("UPDATE users SET contact_number = NULL WHERE user_id = 1;")
    sql("UPDATE pet_reports SET show_phone = 1 WHERE report_id = 1;")
    _, owner_view = session('customer').call('GET', '/reports/1')
    prefs = (owner_view.get('data') or {}).get('contact_preferences')
    # Reversed by Correction 3: a phone number is never published, so even a
    # stored show_phone = 1 is reported as off — no form offers it back.
    check(C, 'FN-41', 'A stored show_phone = 1 reaches the owner as off (phone never published)',
          False, prefs.get('show_phone') if prefs else '(absent)',
          bool(prefs) and prefs.get('show_phone') is False)
    _, public_view = session('finder').call('GET', '/reports/1')
    check(C, 'FN-42', 'Another member is told nothing about preferences', True,
          'contact_preferences' not in (public_view.get('data') or {}),
          'contact_preferences' not in (public_view.get('data') or {}))


def location_privacy():
    """The pin a reporter drops is stored exactly and published approximately.

    The report form promises the pin is "shown publicly as an area of roughly
    400 m". The API used to return it to anybody at the full DECIMAL(9,6).
    """
    import math
    C = 'I. Location privacy'
    grid, worst_m = 0.004, 314

    def metres(a, b):
        (la1, lo1), (la2, lo2) = a, b
        p1, p2 = math.radians(la1), math.radians(la2)
        h = (math.sin((p2 - p1) / 2) ** 2
             + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2)
        return 2 * 6371000 * math.asin(math.sqrt(h))

    def on_grid(v):
        return abs(v / grid - round(v / grid)) < 1e-6

    # A pin the grid moves by ~218 m, and a second pin 14.93 km due north of it
    # that the grid would put 15.14 km away: either side of the 15 km cut-off
    # in api/matching.php, so the pairing's location signal says which
    # coordinates the matcher measured from.
    pin = (14.501937, 121.012345)
    north = (14.636235, 121.012345)
    common = dict(species='cat', breed='Puspin (Philippine Domestic Shorthair)', size='small',
                  primary_color='Calico', distinct_features='Kinked tail, one white forepaw',
                  city='Audit Town', province='Laguna', incident_date='2026-09-10')
    lost, code = file_report('customer', pet_name='Audit Pinpoint', lat=pin[0], lng=pin[1], **common)
    found, _ = file_report('finder', report_type='found', pet_name=None,
                           lat=north[0], lng=north[1], **common)

    stored = sql('SELECT CONCAT(l.latitude, ",", l.longitude) FROM pet_reports r '
                 f'JOIN locations l ON l.location_id = r.location_id WHERE r.report_id = {lost};')
    check(C, 'LP-01', 'The database keeps the pin as it was dropped',
          '14.501937,121.012345', stored, stored == '14.501937,121.012345')

    def published(role, path):
        code, payload = session(role).call('GET', path)
        data = payload.get('data')
        if isinstance(data, list):
            data = next((r for r in data if r['report_id'] == lost), None)
        loc = (data or {}).get('location') or {}
        return code, (loc.get('lat'), loc.get('lng'))

    _, point = published('guest', f'/reports?city_code={place_codes("Audit Town", "Laguna")[1]}&per_page=50')
    check(C, 'LP-02', 'Anonymous list: the grid point, not the pin', 'grid point', str(point),
          None not in point and point != pin and all(map(on_grid, point)))
    code, _ = published('guest', f'/reports/{lost}')
    check(C, 'LP-03', 'Anonymous detail is refused, pin and all', 401, code, code == 401)
    _, detail = published('finder', f'/reports/{lost}')
    gap = metres(pin, detail) if None not in detail else 1e9
    check(C, 'LP-04', "Another member's detail: a grid point in the circle",
          f'grid, <= {worst_m} m', f'{gap:.0f} m',
          detail != pin and None not in detail and all(map(on_grid, detail)) and gap <= worst_m)
    check(C, 'LP-05', 'Another member gets no more than the public list', str(point), str(detail),
          detail == point)
    _, own = published('customer', f'/reports/{lost}')
    check(C, 'LP-06', 'The reporter still sees their own pin (edit form)', str(pin), str(own),
          own == pin)
    _, staff = published('staff', f'/reports/{lost}')
    check(C, 'LP-07', 'A coordinator still sees the pin', str(pin), str(staff), staff == pin)

    signal = sql('SELECT s.is_matched FROM match_signals s JOIN match_claims m '
                 'ON m.match_id = s.match_id WHERE s.signal_key = "location" '
                 f'AND m.lost_report_id = {lost} AND m.found_report_id = {found};')
    check(C, 'LP-08', 'Matching measures from the stored pin (14.93 km, not 15.14)', '1',
          signal or 'no pairing', signal == '1')


def access_control():
    """Who receives what: the guest summary, members, owners, staff, pairings."""
    C = 'J. Report access'
    maria = int(sql("SELECT user_id FROM users WHERE email = 'maria.santos@example.com';"))
    noel = int(sql("SELECT user_id FROM users WHERE email = 'noel.aguilar@example.com';"))
    # Everybody whose name could appear on a history as staff or admin.
    names = set(sql("SELECT GROUP_CONCAT(full_name SEPARATOR '|') FROM users "
                    "WHERE role IN ('staff', 'admin');").split('|'))

    # ---- the guest summary
    summary = {'report_id', 'report_type', 'status', 'pet_name', 'species', 'species_label',
               'breed', 'size', 'sex', 'primary_color', 'secondary_color', 'incident_date',
               'location', 'primary_image', 'primary_image_alt'}
    _, body = session('guest').call('GET', '/reports?per_page=50')
    rows = body.get('data') or []
    keys = set().union(*(r.keys() for r in rows)) if rows else set()
    check(C, 'RA-01', 'A guest list row is the public summary, exactly', 'summary keys',
          'extra: ' + ','.join(sorted(keys - summary)) if keys - summary else 'summary keys',
          bool(rows) and keys == summary)
    loc_keys = set().union(*(r['location'].keys() for r in rows)) if rows else set()
    check(C, 'RA-02', 'Its location has no place label', 'city,city_code,lat,lng,province,area_code',
          ','.join(sorted(loc_keys)),
          loc_keys == {'city', 'province', 'city_code', 'area_code', 'lat', 'lng'})
    code, body = session('guest').call('GET', '/reports/1')
    check(C, 'RA-03', 'A guest opening a real report: 401 auth_required', '401 auth_required',
          f'{code} {body.get("code")}', code == 401 and body.get('code') == 'auth_required')
    status(C, 'RA-04', 'A guest opening a missing report: still 404', 'guest', 'GET',
           '/reports/99999', None, 404)
    status(C, 'RA-05', 'A guest cannot list reports by account', 'guest', 'GET',
           f'/reports?reporter_id={maria}', None, 401)

    # A word that exists only in a description, and one only in the markings.
    rid, _ = file_report('customer', description='Answers to a whistle; zephyrine collar charm.',
                         distinct_features='A quillonbar-shaped scar on the muzzle')
    for tid, word in (('RA-06', 'zephyrine'), ('RA-07', 'quillonbar')):
        _, g = session('guest').call('GET', f'/reports?q={word}')
        _, m = session('finder').call('GET', f'/reports?q={word}')
        gt, mt = g.get('meta', {}).get('total'), m.get('meta', {}).get('total')
        check(C, tid, f'Guest search cannot find a hidden word ({word})', 'guest 0, member 1+',
              f'guest {gt}, member {mt}', gt == 0 and (mt or 0) >= 1)

    # ---- another signed-in customer
    _, body = session('finder').call('GET', '/reports?per_page=50')
    leaked = [r['report_id'] for r in body.get('data') or []
              if 'reporter_id' in r and r['reporter_id'] != noel]
    check(C, 'RA-08', "A member's list: no one else's reporter_id", 'none', str(leaked[:5]) or 'none',
          not leaked)
    status(C, 'RA-09', "A member cannot list someone else's reports", 'finder', 'GET',
           f'/reports?reporter_id={maria}', None, 403)
    status(C, 'RA-10', 'A member can list their own', 'finder', 'GET',
           f'/reports?reporter_id={noel}', None, 200)

    _, other = session('finder').call('GET', '/reports/1')
    data = other.get('data') or {}
    check(C, 'RA-11', "Another member's detail: no reporter_id anywhere", 'absent',
          'absent' if 'reporter_id' not in data and 'user_id' not in (data.get('reporter') or {})
          else 'PRESENT', 'reporter_id' not in data and 'user_id' not in (data.get('reporter') or {}))
    history = data.get('history') or []
    notes = [h['note'] for h in history if h.get('note')]
    check(C, 'RA-12', 'Another member sees every status change', '>= 2 entries', len(history),
          len(history) >= 2)
    check(C, 'RA-13', '...but no notes written with them', '0 notes', f'{len(notes)} notes',
          not notes)
    actors = {h.get('actor_name') for h in history}
    check(C, 'RA-14', '...and roles, not names', 'roles only', ','.join(sorted(map(str, actors))),
          actors <= {None, 'Reporter', 'Pet Coordinator', 'Administrator'})

    # ---- the owner, and staff
    _, own = session('customer').call('GET', '/reports/1')
    own_history = (own.get('data') or {}).get('history') or []
    own_names = {h.get('actor_name') for h in own_history} & names
    check(C, 'RA-15', 'The owner sees the coordinator by name', 'a staff name',
          ','.join(own_names) or 'none', bool(own_names))
    check(C, 'RA-16', 'The owner sees the notes on their case', '1+ notes',
          sum(1 for h in own_history if h.get('note')), any(h.get('note') for h in own_history))
    check(C, 'RA-17', 'The owner still gets their reporter_id', maria,
          (own.get('data') or {}).get('reporter_id'), (own.get('data') or {}).get('reporter_id') == maria)
    _, staff = session('staff').call('GET', '/reports/1')
    sd = staff.get('data') or {}
    check(C, 'RA-18', 'Staff see names, notes and reporter_id', 'all three',
          'all three' if sd.get('reporter_id') == maria and any(h.get('note') for h in sd.get('history') or [])
          and ({h.get('actor_name') for h in sd.get('history') or []} & names) else 'missing',
          sd.get('reporter_id') == maria and any(h.get('note') for h in sd.get('history') or [])
          and bool({h.get('actor_name') for h in sd.get('history') or []} & names))

    # ---- contact details still follow the per-report choice
    sql(f"UPDATE users SET contact_number = '+63 917 555 0101' WHERE user_id = {maria};")
    shown, _ = file_report('customer', show_email=True, show_phone=False)
    hidden, _ = file_report('customer', show_email=False, show_phone=True)
    a = (session('finder').call('GET', f'/reports/{shown}')[1].get('data') or {}).get('reporter') or {}
    b = (session('finder').call('GET', f'/reports/{hidden}')[1].get('data') or {}).get('reporter') or {}
    check(C, 'RA-19', 'Email shared, phone not: exactly that', 'email only',
          f"email {'yes' if a.get('email') else 'no'}, phone {'yes' if a.get('phone') else 'no'}",
          bool(a.get('email')) and a.get('phone') is None)
    # Reversed by Correction 3: asking to show the phone shows nothing.
    check(C, 'RA-20', 'Phone asked for, email not: neither is shown (a phone is never published)',
          'neither', f"email {'yes' if b.get('email') else 'no'}, phone {'yes' if b.get('phone') else 'no'}",
          b.get('email') is None and b.get('phone') is None)

    # ---- pairings
    status(C, 'RA-21', 'A guest cannot list pairings', 'guest', 'GET', '/matches', None, 401)
    status(C, 'RA-22', 'A guest cannot open one', 'guest', 'GET', '/matches/1', None, 401)
    mine = {int(x) for x in sql(f'SELECT GROUP_CONCAT(report_id) FROM pet_reports '
                                f'WHERE user_id = {maria};').split(',')}
    _, body = session('customer').call('GET', '/matches')
    pairs = body.get('data') or []
    stray = [p['match_id'] for p in pairs
             if p['lost_report_id'] not in mine and p['found_report_id'] not in mine]
    check(C, 'RA-23', "A member's pairings all involve their own reports", 'none stray',
          f'{len(pairs)} pairings, stray {stray}', bool(pairs) and not stray)
    status(C, 'RA-24', "A member cannot ask for someone else's", 'customer', 'GET',
           f'/matches?user_id={noel}', None, 403)
    foreign = sql('SELECT m.match_id FROM match_claims m '
                  'JOIN pet_reports l ON l.report_id = m.lost_report_id '
                  'JOIN pet_reports f ON f.report_id = m.found_report_id '
                  f'WHERE l.user_id <> {maria} AND f.user_id <> {maria} LIMIT 1;')
    if foreign:
        status(C, 'RA-25', "...or open a pairing they are not in", 'customer', 'GET',
               f'/matches/{foreign}', None, 403)
    total = int(sql('SELECT COUNT(*) FROM match_claims;'))
    _, body = session('staff').call('GET', '/matches')
    check(C, 'RA-26', 'Staff see every pairing', total, len(body.get('data') or []),
          len(body.get('data') or []) == total)
    status(C, 'RA-27', 'An administrator can open any pairing', 'admin', 'GET',
           f'/matches/{foreign or 1}', None, 200)


def information_reply():
    """A reporter answers a coordinator's request for more information.

    The answer goes to the coordinators as notifications and nowhere else: not
    to the other reporter, not into proof_notes, staff_notes or any history.
    """
    C = 'K. Information requests'
    maria = int(sql("SELECT user_id FROM users WHERE email = 'maria.santos@example.com';"))
    match = sql("SELECT m.match_id FROM match_claims m JOIN pet_reports l ON l.report_id = m.lost_report_id "
                f"WHERE l.user_id = {maria} AND m.match_status IN ('suggested', 'verification_requested') "
                "ORDER BY m.match_id LIMIT 1;")
    if not match:
        check(C, 'IR-00', 'A pairing to test with exists', 'a pairing', 'none', False)
        return
    counterpart = int(sql('SELECT f.user_id FROM match_claims m JOIN pet_reports f '
                          f'ON f.report_id = m.found_report_id WHERE m.match_id = {match};'))
    path = f'/matches/{match}'
    answer = 'Milo has a small white patch under his chin and a bent left ear tip.'
    # Whichever of the two other audit customers is NOT in this pairing is the
    # unrelated one; the one who is, is the counterpart.
    ids = {role: int(sql(f"SELECT user_id FROM users WHERE email = '{audit.ACCOUNTS[role]}';"))
           for role in ('customer2', 'finder')}
    other = next((r for r, i in ids.items() if i == counterpart), None)
    unrelated = next(r for r, i in ids.items() if i != counterpart)

    status(C, 'IR-01', 'Before any question is asked, an answer is refused', 'customer',
           'PATCH', path, {'action': 'provide_information', 'note': answer}, 409)
    status(C, 'IR-02', 'The coordinator asks for more information', 'staff', 'PATCH', path,
           {'action': 'request_information', 'note': 'Describe two markings only the owner would know.'}, 200)

    def snapshot():
        return sql('SELECT CONCAT_WS("|", m.match_status, IFNULL(m.proof_notes, "-"), IFNULL(m.staff_notes, "-"), '
                   '(SELECT COUNT(*) FROM status_logs s WHERE s.report_id IN (m.lost_report_id, m.found_report_id))) '
                   f'FROM match_claims m WHERE m.match_id = {match};')
    before = snapshot()

    status(C, 'IR-03', 'A guest cannot answer', 'guest', 'PATCH', path,
           {'action': 'provide_information', 'note': answer}, 401)
    status(C, 'IR-04', 'An unrelated customer cannot answer', unrelated, 'PATCH', path,
           {'action': 'provide_information', 'note': answer}, 403)
    status(C, 'IR-05', 'A coordinator cannot answer their own question', 'staff', 'PATCH', path,
           {'action': 'provide_information', 'note': answer}, 403)
    status(C, 'IR-06', 'An empty answer is refused', 'customer', 'PATCH', path,
           {'action': 'provide_information', 'note': '   '}, 422)
    status(C, 'IR-07', 'An answer over 255 characters is refused, not cut', 'customer', 'PATCH', path,
           {'action': 'provide_information', 'note': 'x' * 256}, 422)
    status(C, 'IR-08', 'The involved customer can answer', 'customer', 'PATCH', path,
           {'action': 'provide_information', 'note': answer}, 200)

    after = snapshot()
    check(C, 'IR-09', 'The pairing stays under review', 'under_review', after.split('|')[0],
          after.split('|')[0] == 'under_review')
    check(C, 'IR-10', 'No proof_notes, staff_notes or history written', 'unchanged',
          'unchanged' if after == before else f'{before} -> {after}', after == before)

    staff_ids = sql("SELECT GROUP_CONCAT(user_id) FROM users WHERE role = 'staff' AND account_status = 'active';")
    got = sql('SELECT COUNT(*) FROM notifications WHERE notification_type = "verification_requested" '
              f'AND match_id = {match} AND user_id IN ({staff_ids}) AND body = "{answer}";')
    check(C, 'IR-11', 'Every active coordinator is notified with the answer',
          len(staff_ids.split(',')), got, int(got) == len(staff_ids.split(',')))
    leaked = sql(f'SELECT COUNT(*) FROM notifications WHERE body = "{answer}" '
                 f'AND user_id NOT IN ({staff_ids});')
    check(C, 'IR-12', 'Nobody else is sent it (counterpart, other customers)', '0', leaked, leaked == '0')

    _, body = session('staff').call('GET', '/notifications')
    mine = [n for n in (body.get('data') or []) if n.get('match_id') == int(match) and n.get('body') == answer]
    check(C, 'IR-13', 'The coordinator can read it through the API', '1', len(mine), len(mine) == 1)
    check(C, 'IR-14', 'The other reporter is one of the audit accounts', 'found', other or 'none',
          other is not None)
    _, body = session(other or unrelated).call('GET', '/notifications')
    seen = [n for n in (body.get('data') or []) if n.get('body') == answer]
    check(C, 'IR-15', "The other reporter's notifications do not carry it", '0', len(seen), not seen)
    _, pairing = session(other or unrelated).call('GET', path)
    check(C, 'IR-16', "...nor does the pairing they can open", 'absent',
          'absent' if answer not in json.dumps(pairing) else 'PRESENT', answer not in json.dumps(pairing))

    decided = sql("SELECT m.match_id FROM match_claims m JOIN pet_reports l ON l.report_id = m.lost_report_id "
                  "JOIN pet_reports f ON f.report_id = m.found_report_id "
                  f"WHERE {maria} IN (l.user_id, f.user_id) AND m.match_status IN ('confirmed', 'rejected') LIMIT 1;")
    if decided:
        status(C, 'IR-17', 'A confirmed or rejected pairing refuses an answer', 'customer', 'PATCH',
               f'/matches/{decided}', {'action': 'provide_information', 'note': answer}, 409)


def report_editing():
    """If the edit form lets the owner change a field, the change must persist."""
    C = 'L. Report editing'
    # Filed where no seeded report is near, so it stays Active: a report with
    # an open possible match is frozen, and this section edits it freely.
    rid, _ = file_report('customer', pet_name='Audit Edit', species='dog', breed='Beagle',
                         sex='male', has_collar='no', incident_date='2026-09-01', incident_time='08:00',
                         location_label='Near the old chapel', city='Tuguegarao City', province='Cagayan',
                         lat=17.6132, lng=121.7270, allow_platform_contact=True)
    path = f'/reports/{rid}'
    loc_before = sql(f'SELECT location_id FROM pet_reports WHERE report_id = {rid};')
    locations_before = sql('SELECT COUNT(*) FROM locations;')

    code, _ = session('customer').call('PUT', path, {
        'species': 'cat', 'breed': 'Persian', 'sex': 'female', 'has_collar': 'yes',
        'incident_date': '2026-09-03', 'incident_time': '19:45',
        # Somewhere no seeded report is near: an Active report is compared
        # again after an edit, and a pairing would freeze it for the photo
        # checks below. This section is about edits persisting, not matching.
        'location_label': 'Behind the public market',
        'area_code': '0200900000', 'city_code': '0200901000',   # Basco, Batanes
        'lat': 20.4487, 'lng': 121.9702,
        'allow_platform_contact': False, 'show_phone': True, 'show_email': True,
    })
    check(C, 'ED-01', 'The owner saves an edit to every field group', 200, code, code == 200)

    def col(expr):
        return sql(f'SELECT {expr} FROM pet_reports r JOIN pet_categories c ON c.category_id = r.category_id '
                   'LEFT JOIN pet_breeds b ON b.breed_id = r.breed_id JOIN locations l ON l.location_id = r.location_id '
                   f'WHERE r.report_id = {rid};')
    for tid, desc, expr, want in [
        ('ED-02', 'Species and breed persist', 'CONCAT(c.category_code, "/", b.breed_name)', 'cat/Persian'),
        ('ED-03', 'Sex persists', 'r.pet_sex', 'female'),
        ('ED-04', 'Collar answer persists', 'r.has_collar', 'yes'),
        ('ED-05', 'Date and time persist', 'CONCAT(r.incident_date, " ", r.incident_time)', '2026-09-03 19:45:00'),
        ('ED-06', 'Label, city and province persist',
         'CONCAT_WS("|", l.label, l.city, l.province)', 'Behind the public market|Basco|Batanes'),
        ('ED-07', 'The map pin persists exactly', 'CONCAT(l.latitude, ",", l.longitude)', '20.448700,121.970200'),
        # show_phone stays 0 whatever is sent: a phone is never published.
        ('ED-08', 'Contact choices persist (show_phone ignored)',
         'CONCAT(r.allow_platform_contact, r.show_phone, r.show_email)', '001'),
        ('ED-08b', 'The place is stored by its PSGC code', 'l.city_code', '0200901000'),
    ]:
        got = col(expr)
        check(C, tid, desc, want, got, got == want)
    same = sql(f'SELECT location_id FROM pet_reports WHERE report_id = {rid};') == loc_before
    check(C, 'ED-09', 'The same location row is updated, none orphaned', 'same row, same count',
          f'same={same}, locations {locations_before}->{sql("SELECT COUNT(*) FROM locations;")}',
          same and sql('SELECT COUNT(*) FROM locations;') == locations_before)

    status(C, 'ED-10', 'Someone else cannot edit it', 'finder', 'PUT', path, {'sex': 'male'}, 403)
    status(C, 'ED-11', 'An inactive or invented species is refused', 'customer', 'PUT', path, {'species': 'dragon'}, 422)
    status(C, 'ED-12', 'An invalid collar answer is refused', 'customer', 'PUT', path, {'has_collar': 'maybe'}, 422)
    status(C, 'ED-13', 'A future date is refused', 'customer', 'PUT', path, {'incident_date': '2099-01-01'}, 422)
    status(C, 'ED-14', "A lost pet's name cannot be emptied", 'customer', 'PUT', path, {'pet_name': '  '}, 422)
    status(C, 'ED-15', 'A city cannot be emptied', 'customer', 'PUT', path, {'city_code': ''}, 422)

    # ---- photographs
    def upload(role, rid_, n):
        body, ctype = multipart([('alt[]', f'Audit photo {i}') for i in range(n)],
                                [('photos[]', f'p{i}.png', png(40 + i, 30)) for i in range(n)])
        return session(role).call('POST', f'/reports/{rid_}/photos', raw=body, content_type=ctype)

    code, payload = upload('customer', rid, 3)
    ids = sorted(p['image_id'] for p in (payload.get('data') or []))
    check(C, 'ED-16', 'Photos can be added to an existing report', '201, 3 photos',
          f'{code}, {len(ids)} photos', code == 201 and len(ids) == 3)
    first, second, third = ids
    files = {i: sql(f'SELECT image_path FROM report_images WHERE image_id = {i};') for i in ids}

    photos = f'{path}/photos'
    code, _ = session('customer').call('PATCH', photos, {'alt': {str(second): 'Sitting on the steps'}})
    alt = sql(f'SELECT alt_text FROM report_images WHERE image_id = {second};')
    check(C, 'ED-17', 'Alt text persists', 'Sitting on the steps', alt, code == 200 and alt == 'Sitting on the steps')

    session('customer').call('PATCH', photos, {'primary': second})
    primaries = sql(f'SELECT GROUP_CONCAT(image_id) FROM report_images WHERE report_id = {rid} AND is_primary_photo = 1;')
    check(C, 'ED-18', 'Choosing the main photo persists, and only one is main', str(second), primaries,
          primaries == str(second))

    code, _ = session('customer').call('PATCH', photos, {'remove': [second]})
    left = sql(f'SELECT GROUP_CONCAT(image_id ORDER BY image_id) FROM report_images WHERE report_id = {rid};')
    primaries = sql(f'SELECT GROUP_CONCAT(image_id) FROM report_images WHERE report_id = {rid} AND is_primary_photo = 1;')
    check(C, 'ED-19', 'Removing a photo persists', f'{first},{third}', left, code == 200 and left == f'{first},{third}')
    check(C, 'ED-20', 'Removing the main photo hands it to the earliest left', str(first), primaries,
          primaries == str(first))
    gone = not os.path.exists(os.path.join(PROJECT, 'api', 'uploads', files[second]))
    check(C, 'ED-21', "The removed photo's file is deleted too", 'deleted', 'deleted' if gone else 'still there', gone)

    code, _ = upload('customer', rid, 3)
    check(C, 'ED-22', 'Up to five photos in total are allowed', 201, code, code == 201)
    code, _ = upload('customer', rid, 1)
    check(C, 'ED-23', 'A sixth photo is refused', 422, code, code == 422)

    other = sql(f'SELECT image_id FROM report_images WHERE report_id <> {rid} LIMIT 1;')
    before = sql('SELECT COUNT(*) FROM report_images;')
    status(C, 'ED-24', "A photo from another report cannot be removed here", 'customer', 'PATCH', photos,
           {'remove': [int(other)]}, 422)
    check(C, 'ED-25', '...and nothing was deleted', before, sql('SELECT COUNT(*) FROM report_images;'),
          sql('SELECT COUNT(*) FROM report_images;') == before)
    status(C, 'ED-26', "Someone else cannot change this report's photos", 'finder', 'PATCH', photos,
           {'primary': first}, 403)
    status(C, 'ED-27', 'Editing photos needs a session', 'guest', 'PATCH', photos, {'primary': first}, 401)

    bad = sql('SELECT COUNT(*) FROM (SELECT report_id FROM report_images GROUP BY report_id '
              'HAVING SUM(is_primary_photo) <> 1) x;')
    check(C, 'ED-28', 'No report anywhere has zero or several main photos', '0', bad, bad == '0')

    # ---- a finished report stays finished
    session('customer').call('PATCH', path, {'status': 'closed', 'note': 'Audit: closing to test edits.'})
    status(C, 'ED-29', 'A closed report refuses edits', 'customer', 'PUT', path, {'sex': 'male'}, 409)
    status(C, 'ED-30', '...photo changes', 'customer', 'PATCH', photos, {'primary': first}, 409)
    code, _ = upload('customer', rid, 1)
    check(C, 'ED-31', '...and new photos', 409, code, code == 409)


def qa_rules():
    """Avery's QA rules, held by the server as well as the form."""
    C = 'M. Report QA rules'
    _, code = file_report('finder', report_type='found', pet_name=None, has_collar=None)
    check(C, 'QA-01', 'A found report must answer the collar question', 422, code, code == 422)
    # A city of its own, so the report stays Active and can be edited: one with
    # an open possible match is frozen, which is tested separately (EM-).
    rid, code = file_report('finder', report_type='found', pet_name=None, has_collar='unknown',
                            city='Audit QA City')
    check(C, 'QA-02', '"Not sure" is a valid, deliberate answer', 200, code, code == 200)
    status(C, 'QA-03', "A found report's collar answer cannot be blanked on edit", 'finder', 'PUT',
           f'/reports/{rid}', {'has_collar': ''}, 422)

    _, code = file_report('customer', allow_platform_contact=False, show_phone=False, show_email=False)
    check(C, 'QA-04', 'A report nobody can reach is refused', 422, code, code == 422)
    _, code = file_report('customer', allow_platform_contact=False, show_email=True)
    check(C, 'QA-05', 'Any one way is enough (email only)', 200, code, code == 200)
    mine, _ = file_report('customer', city='Audit QA Contact City')
    status(C, 'QA-06', 'An edit cannot switch off every way', 'customer', 'PUT', f'/reports/{mine}',
           {'allow_platform_contact': False, 'show_phone': False, 'show_email': False}, 422)
    kept = sql(f'SELECT CONCAT(allow_platform_contact, show_phone, show_email) FROM pet_reports WHERE report_id = {mine};')
    check(C, 'QA-07', '...and the report keeps its contact method', '100', kept, kept == '100')

    other, code = file_report('customer', species='other', breed='Turtle', pet_name='Shelly')
    got = sql('SELECT CONCAT(c.category_code, "/", b.breed_name) FROM pet_reports r '
              'JOIN pet_categories c ON c.category_id = r.category_id '
              f'JOIN pet_breeds b ON b.breed_id = r.breed_id WHERE r.report_id = {other};')
    check(C, 'QA-08', '"Other" stores the named animal in breed', 'other/Turtle', got, got == 'other/Turtle')


def final_integrity():
    """The final batch: the server holds every rule the form does, finished
    reports end their pairings, and destructive decisions need a reason."""
    C = 'N. Final integrity'

    # ---- A4: a hand-built request cannot skip what the form requires
    for tid, field, value, why in [
        ('FI-01', 'pet_name', '', "A lost pet's name"), ('FI-02', 'species', '', 'Species'),
        ('FI-03', 'size', '', 'Size'), ('FI-04', 'primary_color', '', 'Main colour'),
        ('FI-05', 'incident_date', '', 'Date'), ('FI-06', 'location_label', '', 'Where it happened'),
        ('FI-07', 'city_code', '', 'City'), ('FI-08', 'area_code', '', 'Province'),
        ('FI-09', 'description', '', 'Description'), ('FI-10', 'sex', None, 'Sex (B4)'),
    ]:
        _, code = file_report('customer', **{field: value})
        check(C, tid, f'{why} is required by the server', 422, code, code == 422)
    _, code = file_report('customer', breed='', distinct_features='')
    check(C, 'FI-11', 'A breed or a distinctive feature is required', 422, code, code == 422)
    _, code = file_report('customer', species='other', breed='')
    check(C, 'FI-12', '"Other" must name the animal', 422, code, code == 422)
    _, code = file_report('customer', sex='unknown')
    check(C, 'FI-13', '"Unknown" sex is a valid answer', 200, code, code == 200)

    limits = {'pet_name': 40, 'breed': 60, 'primary_color': 30, 'secondary_color': 30,
              'distinct_features': 300, 'description': 1000, 'location_label': 120,
              'condition': 300}
    over = {f: file_report('customer', **{f: 'x' * (n + 1)})[1] for f, n in limits.items()}
    check(C, 'FI-14', 'Every text field over its limit is a 422, never a 500', 'all 422',
          ','.join(f'{f}={c}' for f, c in over.items() if c != 422) or 'all 422',
          all(c == 422 for c in over.values()))
    _, code = file_report('customer', incident_time='25:99')
    check(C, 'FI-15', 'An impossible time is refused', 422, code, code == 422)
    _, code = file_report('customer', lat=123.4, lng=121.0)
    check(C, 'FI-16', 'An impossible map pin is refused', 422, code, code == 422)

    rid, _ = file_report('customer', city='Audit Edit Rules City')   # stays Active, so editable
    path = f'/reports/{rid}'
    status(C, 'FI-17', 'An edit cannot blank a required field', 'customer', 'PUT', path, {'description': '  '}, 422)
    status(C, 'FI-18', 'An edit cannot leave neither breed nor feature', 'customer', 'PUT', path,
           {'breed': '', 'distinct_features': ''}, 422)
    status(C, 'FI-19', 'An edit to "Other" must name the animal', 'customer', 'PUT', path, {'species': 'other'}, 422)
    status(C, 'FI-20', 'An edit over a length limit is a 422', 'customer', 'PUT', path,
           {'location_label': 'x' * 121}, 422)

    # ---- B5: a phone that does not exist is not a way to be reached
    liza = sql("SELECT user_id FROM users WHERE email = 'liza.ocampo@example.com';")
    phone = sql(f'SELECT contact_number FROM users WHERE user_id = {liza};')
    sql(f'UPDATE users SET contact_number = NULL WHERE user_id = {liza};')
    _, code = file_report('customer2', allow_platform_contact=False, show_phone=True)
    check(C, 'FI-21', '"Show phone" is not a way to be reached (never published)', 422, code, code == 422)
    _, code = file_report('customer2', allow_platform_contact=True, show_phone=False)
    check(C, 'FI-22', '...another way to be reached still works', 200, code, code == 200)
    sql(f"UPDATE users SET contact_number = '{phone}' WHERE user_id = {liza};")

    # ---- B6 and note limits
    open_pair = sql("SELECT match_id FROM match_claims WHERE match_status IN ('suggested','verification_requested') LIMIT 1;")
    status(C, 'FI-23', 'Ruling a pairing out needs a note (server)', 'staff', 'PATCH', f'/matches/{open_pair}',
           {'action': 'reject'}, 422)
    status(C, 'FI-24', 'A coordinator note over 255 characters is refused', 'staff', 'PATCH', f'/matches/{open_pair}',
           {'action': 'request_information', 'note': 'x' * 256}, 422)

    # ---- B7: a finished report ends its open pairings
    def pair(city):
        common = dict(species='cat', breed='Puspin (Philippine Domestic Shorthair)', size='small',
                      primary_color='Orange', incident_date='2026-09-05', city=city, province='Iloilo')
        lost, _ = file_report('customer', pet_name='Audit Mingming', distinct_features='White bib, crooked whisker pad', **common)
        found, _ = file_report('finder', report_type='found', pet_name=None,
                               distinct_features='White bib under the chin, crooked whisker pad', **common)
        m = sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')
        return lost, found, m

    others_before = sql("SELECT COUNT(*) FROM match_claims WHERE match_status IN ('suggested','verification_requested','under_review');")
    decided_before = sql("SELECT GROUP_CONCAT(CONCAT(match_id, ':', match_status) ORDER BY match_id) FROM match_claims "
                         "WHERE match_status IN ('confirmed','rejected');")

    lost, found, m = pair('Audit Returned City')
    check(C, 'FI-25', '(a pairing was raised to test with)', 'a pairing', m or 'none', bool(m))
    status(C, 'FI-26', 'The owner marks the lost pet returned', 'customer', 'PATCH', f'/reports/{lost}',
           {'status': 'returned', 'note': 'Came home on its own.'}, 200)
    got = sql(f'SELECT match_status FROM match_claims WHERE match_id = {m};') if m else ''
    check(C, 'FI-27', '...its open pairing is dismissed', 'dismissed', got, got == 'dismissed')
    back = sql(f'SELECT status FROM pet_reports WHERE report_id = {found};')
    check(C, 'FI-28', '...and the other report goes back to Active', 'active', back, back == 'active')
    _, body = session('staff').call('GET', '/matches?status=verification_requested')
    queue = [x['match_id'] for x in (body.get('data') or [])]
    check(C, 'FI-29', '...it is not in the Verification queue', 'absent', 'present' if m and int(m) in queue else 'absent',
          not (m and int(m) in queue))
    status(C, 'FI-30', '...and the other reporter cannot act on it', 'finder', 'PATCH', f'/matches/{m}',
           {'action': 'request_verification'}, 409)
    told = sql(f"SELECT COUNT(*) FROM notifications WHERE match_id = {m} AND title = 'A possible match is no longer open';")
    check(C, 'FI-31', '...who is told it is no longer open', '1', told, told == '1')

    lost2, _, m2 = pair('Audit Closed City')
    status(C, 'FI-32', 'The owner closes a report', 'customer', 'PATCH', f'/reports/{lost2}',
           {'status': 'closed', 'note': 'Found another way.'}, 200)
    got = sql(f'SELECT match_status FROM match_claims WHERE match_id = {m2};') if m2 else ''
    check(C, 'FI-33', '...its open pairing is dismissed too', 'dismissed', got, got == 'dismissed')

    others_after = sql("SELECT COUNT(*) FROM match_claims WHERE match_status IN ('suggested','verification_requested','under_review');")
    check(C, 'FI-34', 'Unrelated open pairings are untouched', others_before, others_after, others_after == others_before)
    decided_after = sql("SELECT GROUP_CONCAT(CONCAT(match_id, ':', match_status) ORDER BY match_id) FROM match_claims "
                        "WHERE match_status IN ('confirmed','rejected');")
    check(C, 'FI-35', 'Confirmed and rejected pairings are untouched', 'unchanged',
          'unchanged' if decided_after == decided_before else 'CHANGED', decided_after == decided_before)

    # ---- B8: removal needs a reason
    case = sql("SELECT case_id FROM moderation_cases WHERE case_status = 'open' LIMIT 1;")
    status(C, 'FI-36', 'Removing a flagged report needs a reason', 'admin', 'PATCH', f'/moderation/{case}',
           {'action': 'remove'}, 422)
    status(C, 'FI-37', 'Remove and suspend needs a reason', 'admin', 'PATCH', f'/moderation/{case}',
           {'action': 'suspend'}, 422)
    still = sql(f'SELECT case_status FROM moderation_cases WHERE case_id = {case};')
    check(C, 'FI-38', '...and the case is still open', 'open', still, still == 'open')


def match_rejection():
    """A coordinator's "Not the same pet" decides the pairing, not the reports.

    It says this lost report and this found report are different animals.
    Each report stays open to be matched again, and its reporter may still
    finish it on their own later: that is the report's lifecycle, not the
    pairing's, and it must never turn the rejected pairing into a confirmed
    one. Each scenario uses its own city, because a pairing needs the location
    to agree and these reports carry no map pin.
    """
    C = 'O. Match rejection'
    common = dict(species='cat', breed='Puspin (Philippine Domestic Shorthair)', size='small',
                  primary_color='Orange', incident_date='2026-09-05', province='Iloilo')

    def lost_in(city):
        report, _ = file_report('customer', pet_name='Audit Kiko',
                                distinct_features='White bib, crooked whisker pad', city=city, **common)
        return report

    def found_in(city):
        report, _ = file_report('finder', report_type='found', pet_name=None,
                                distinct_features='White bib under the chin, crooked whisker pad',
                                city=city, **common)
        return report

    def pairing(lost, found):
        return sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')

    def report_status(report):
        return sql(f'SELECT status FROM pet_reports WHERE report_id = {report};')

    def pairing_status(match):
        return sql(f'SELECT match_status FROM match_claims WHERE match_id = {match};')

    reject = {'action': 'reject', 'note': 'Different markings under the chin.'}

    # ---- MR-1: the only open pairing is ruled out
    lost, found = lost_in('Audit Reject City'), found_in('Audit Reject City')
    m = pairing(lost, found)
    check(C, 'MR-01', '(one pairing raised; both reports Possible Match)', 'possible_match x2',
          f'{report_status(lost)},{report_status(found)}',
          bool(m) and report_status(lost) == report_status(found) == 'possible_match')
    status(C, 'MR-02', 'Coordinator: Not the same pet', 'staff', 'PATCH', f'/matches/{m}', reject, 200)
    check(C, 'MR-03', '...that pairing is rejected', 'rejected', pairing_status(m), pairing_status(m) == 'rejected')
    both = f'{report_status(lost)},{report_status(found)}'
    check(C, 'MR-04', '...both reports go back to Active', 'active,active', both, both == 'active,active')
    moved = sql(f"SELECT COUNT(*) FROM status_logs WHERE report_id IN ({lost},{found}) "
                f"AND previous_status = 'possible_match' AND new_status = 'active';")
    check(C, 'MR-05', '...each report\'s history records it', '2', moved, moved == '2')
    told = sql(f"SELECT COUNT(*) FROM notifications WHERE match_id = {m} AND notification_type = 'match_rejected';")
    check(C, 'MR-06', '...and both reporters are told', '2', told, told == '2')

    # ---- MR-5: a decided pairing takes no second decision, however it is asked
    status(C, 'MR-07', 'Confirming the rejected pairing', 'staff', 'PATCH', f'/matches/{m}',
           {'action': 'confirm'}, 409)
    status(C, 'MR-08', 'Rejecting it a second time', 'staff', 'PATCH', f'/matches/{m}', reject, 409)
    status(C, 'MR-09', 'A reporter asking for verification on it', 'finder', 'PATCH', f'/matches/{m}',
           {'action': 'request_verification'}, 409)
    check(C, 'MR-10', '...and it is still rejected', 'rejected', pairing_status(m), pairing_status(m) == 'rejected')

    # ---- MR-6: nothing offers it as work any more
    queued = []
    for waiting in ('verification_requested', 'under_review', 'suggested'):
        _, body = session('staff').call('GET', f'/matches?status={waiting}')
        queued += [x['match_id'] for x in (body.get('data') or [])]
    check(C, 'MR-11', 'Not in any open staff queue', 'absent', 'present' if int(m) in queued else 'absent',
          int(m) not in queued)
    _, body = session('customer').call('GET', '/matches?user_id=1')
    mine = {x['match_id']: x.get('match_status') or x.get('status') for x in (body.get('data') or [])}
    check(C, 'MR-12', 'The reporter sees it as rejected (settled), not open', 'rejected',
          str(mine.get(int(m))), mine.get(int(m)) == 'rejected')

    # ---- MR-3: the finder later finishes their own report independently
    status(C, 'MR-13', 'The finder marks the found report returned', 'finder', 'PATCH', f'/reports/{found}',
           {'status': 'returned', 'note': 'The owner turned up through a neighbour.'}, 200)
    check(C, 'MR-14', '...the found report is Returned', 'returned', report_status(found),
          report_status(found) == 'returned')
    check(C, 'MR-15', '...the rejected pairing stays rejected, not confirmed', 'rejected', pairing_status(m),
          pairing_status(m) == 'rejected')
    check(C, 'MR-16', '...and the lost report is untouched', 'active', report_status(lost),
          report_status(lost) == 'active')

    # ---- MR-2: two open pairings on one report, one ruled out
    lost2 = lost_in('Audit Two Pairings City')
    first, second = found_in('Audit Two Pairings City'), found_in('Audit Two Pairings City')
    m1, m2 = pairing(lost2, first), pairing(lost2, second)
    check(C, 'MR-17', '(the lost report has two open pairings)', 'two', f'{m1},{m2}', bool(m1) and bool(m2))
    status(C, 'MR-18', 'Coordinator rules the first one out', 'staff', 'PATCH', f'/matches/{m1}', reject, 200)
    check(C, 'MR-19', '...the lost report stays Possible Match', 'possible_match', report_status(lost2),
          report_status(lost2) == 'possible_match')
    check(C, 'MR-20', '...the other pairing is still open', 'suggested', pairing_status(m2),
          pairing_status(m2) == 'suggested')
    check(C, 'MR-21', '...the ruled-out found report goes back to Active', 'active', report_status(first),
          report_status(first) == 'active')

    # ---- MR-4: finishing the report ends only what is still open
    status(C, 'MR-22', 'The owner then marks the lost pet returned', 'customer', 'PATCH', f'/reports/{lost2}',
           {'status': 'returned', 'note': 'Came home on its own.'}, 200)
    after = f'{pairing_status(m1)},{pairing_status(m2)}'
    check(C, 'MR-23', '...the open pairing is dismissed, the rejected one kept', 'rejected,dismissed', after,
          after == 'rejected,dismissed')
    check(C, 'MR-24', '...and neither became confirmed', '0',
          sql(f"SELECT COUNT(*) FROM match_claims WHERE match_id IN ({m1},{m2}) AND match_status = 'confirmed';"),
          sql(f"SELECT COUNT(*) FROM match_claims WHERE match_id IN ({m1},{m2}) AND match_status = 'confirmed';") == '0')


def repeat_matching():
    """MG-REPEAT: the production sequence behind the missing #18/#36 pairing.

    A lost report pairs with found report A at 95; that pairing is settled and A
    closed; the same reporter files found report B with A's exact details. B
    must pair with the lost report again, as a fresh suggestion, and the old
    decision must stay as it was. Mirrors #18 (pinned) with #35 and #36 (no
    pin, no distinctive features, so location falls back to the city).
    """
    C = 'P. Repeat matching'
    city = 'Audit Repeat City'
    golden = dict(species='dog', breed='Golden Retriever', size='large', sex='male',
                  primary_color='Golden', province='Metro Manila', city=city)

    lost, _ = file_report('customer', pet_name='Audit Simba', incident_date='2026-07-11',
                          distinct_features='Thick golden coat, greying muzzle, walks with a slight limp.',
                          lat=14.5486, lng=121.0509, **golden)

    def found_like_35():
        report, _ = file_report('finder', report_type='found', pet_name=None, incident_date='2026-07-22',
                                distinct_features='', **golden)
        return report

    def pairing(found):
        return sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')

    def status_of(report):
        return sql(f'SELECT status FROM pet_reports WHERE report_id = {report};')

    first = found_like_35()
    m1 = pairing(first)
    score1 = sql(f'SELECT match_score FROM match_claims WHERE match_id = {m1};') if m1 else ''
    check(C, 'MG-01', 'Found A pairs with the lost report at 95', '95', score1 or 'none', score1 == '95')

    status(C, 'MG-02', 'The finder says A is not their match', 'finder', 'PATCH', f'/matches/{m1}',
           {'action': 'dismiss'}, 200)
    status(C, 'MG-03', '...and closes report A', 'finder', 'PATCH', f'/reports/{first}',
           {'status': 'closed', 'note': 'Filed twice by mistake.'}, 200)
    check(C, 'MG-04', 'The lost report is Active again', 'active', status_of(lost), status_of(lost) == 'active')

    second = found_like_35()
    m2 = pairing(second)
    check(C, 'MG-05', 'Found B, identical to A, pairs again (MG-REPEAT)', 'a new pairing', m2 or 'NONE', bool(m2))
    score2 = sql(f'SELECT match_score FROM match_claims WHERE match_id = {m2};') if m2 else ''
    check(C, 'MG-06', '...at 95', '95', score2 or 'none', score2 == '95')
    signals = sql(f'SELECT COUNT(*) FROM match_signals WHERE match_id = {m2};') if m2 else '0'
    check(C, 'MG-07', '...with seven signals', '7', signals, signals == '7')
    summed = sql(f'SELECT SUM(CASE WHEN is_matched THEN weight ELSE 0 END) FROM match_signals WHERE match_id = {m2};') if m2 else ''
    check(C, 'MG-08', '...whose matched weights add up to the score', score2 or 'none', summed or 'none',
          bool(summed) and summed == score2)
    both = f'{status_of(lost)},{status_of(second)}'
    check(C, 'MG-09', '...and both reports are Possible Match', 'possible_match x2', both,
          both == 'possible_match,possible_match')
    told = sql(f"SELECT COUNT(*) FROM notifications WHERE match_id = {m2} AND notification_type = 'match_suggested';") if m2 else '0'
    check(C, 'MG-10', '...both reporters told', '2', told, told == '2')
    old = sql(f'SELECT match_status FROM match_claims WHERE match_id = {m1};')
    check(C, 'MG-11', 'The earlier pairing with A stays dismissed', 'dismissed', old, old == 'dismissed')


def calendar_dates():
    """An incident date is a Philippine calendar day, whatever zone the server is in.

    The API compared with the server's own date, and the server runs in UTC,
    which is behind Manila until 8 AM: a report dated today was refused as
    future every morning. The exact boundary is tested with an injected clock
    in `npm run test:calendar`; these check the live API on the real clock.
    """
    import datetime as dt
    C = 'Q. Calendar dates'
    manila = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    for tid, days, expected, label in [
        ('CD-01', 0, 200, "today's date in Manila is accepted"),
        ('CD-02', -1, 200, "yesterday's date is accepted"),
        ('CD-03', 1, 422, "tomorrow's date is refused as future"),
    ]:
        day = (manila + dt.timedelta(days=days)).isoformat()
        _, code = file_report('customer', incident_date=day, city='Audit Calendar City')
        check(C, tid, f'A report dated {label}', str(expected), str(code), code == expected)


def city_names():
    """Without a map pin, "Pasig City" and "Pasig" are one place if the province agrees.

    Location is a gate, so a city written two ways used to stop a pairing from
    being suggested at all. The rule itself is tested case by case in
    `npm run test:city`; these file real reports through the API.
    """
    C = 'R. City names'
    pet = dict(species='cat', breed='Puspin (Philippine Domestic Shorthair)', size='small',
               primary_color='Orange', incident_date='2026-09-05',
               distinct_features='White bib, crooked whisker pad')

    def pairing(lost_place, found_place):
        lost, _ = file_report('customer', pet_name='Audit Mingming', **pet, **lost_place)
        found, _ = file_report('finder', report_type='found', pet_name=None, **pet, **found_place)
        return sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')

    same = pairing(dict(city='Auditville City', province='Audit Province'),
                   dict(city='auditville', province='Audit Province'))
    check(C, 'RC-01', '"Auditville City" and "auditville", same province: paired', 'a pairing', same or 'NONE', bool(same))
    other = pairing(dict(city='Auditburg City', province='Audit Province'),
                    dict(city='Auditburg', province='Other Province'))
    check(C, 'RC-02', 'The same names in different provinces: not paired', 'none', other or 'none', not other)


def edit_while_matched():
    """A report is frozen while a possible match is open, and compared again after an edit.

    A pairing's score and seven signals describe the reports as they were
    compared. Editing a report underneath an open pairing left a coordinator
    reading "Both reports describe a dog" beside a report that now said turtle.
    Now a report with an open possible match refuses edits and photo changes
    (409); once every open pairing is settled it is Active again, and an edit
    runs the comparison afresh on the new details. Decided pairings are never
    rewritten or resurrected.
    """
    C = 'S. Editing and matching'
    dog = dict(species='dog', breed='Shih Tzu', size='small', sex='male', primary_color='Brown',
               distinct_features='White chest patch, one floppy ear')

    def status_of(report):
        return sql(f'SELECT status FROM pet_reports WHERE report_id = {report};')

    def pairing(lost, found):
        return sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')

    # EM-01: an Active report with no open match can be edited.
    alone, _ = file_report('customer', city='Audit Alone City', **dog)
    status(C, 'EM-01', 'An Active report with no open match can be edited', 'customer', 'PUT',
           f'/reports/{alone}', {'description': 'Edited while nothing is open, with enough words to count.'}, 200)

    # The reported bug: a dog/Shih Tzu pair, then the found report edited into a turtle.
    city = 'Audit Freeze City'
    lost, _ = file_report('customer', incident_date='2026-09-10', city=city, **dog)
    found, _ = file_report('finder', report_type='found', pet_name=None, incident_date='2026-09-11', city=city, **dog)
    m = pairing(lost, found)
    before = sql(f"SELECT CONCAT(r.status,'/',c.category_code,'/',b.breed_name) FROM pet_reports r "
                 f"JOIN pet_categories c ON c.category_id=r.category_id LEFT JOIN pet_breeds b ON b.breed_id=r.breed_id "
                 f"WHERE r.report_id={found};")
    check(C, 'EM-02', '(a dog/Shih Tzu pair is suggested; the found report is Possible Match)', 'possible_match/dog/Shih Tzu',
          before, bool(m) and before == 'possible_match/dog/Shih Tzu')

    code, body = session('finder').call('PUT', f'/reports/{found}', {'species': 'other', 'breed': 'turtle'})
    check(C, 'EM-03', 'Editing it while the match is open is refused (409)', 409, code, code == 409)
    after = sql(f"SELECT CONCAT(c.category_code,'/',b.breed_name) FROM pet_reports r "
                f"JOIN pet_categories c ON c.category_id=r.category_id LEFT JOIN pet_breeds b ON b.breed_id=r.breed_id "
                f"WHERE r.report_id={found};")
    check(C, 'EM-04', '...and the report still reads dog/Shih Tzu, as its pairing says', 'dog/Shih Tzu', after,
          after == 'dog/Shih Tzu')

    body_, ctype = multipart([('alt[]', 'A photo')], [('photos[]', 'p.png', png(40, 30))])
    code, _ = session('finder').call('POST', f'/reports/{found}/photos', raw=body_, content_type=ctype)
    check(C, 'EM-05', 'Adding a photograph while the match is open is refused too', 409, code, code == 409)
    photo = sql(f'SELECT image_id FROM report_images WHERE report_id = {found} LIMIT 1;')
    if photo:
        status(C, 'EM-05b', '...and so is changing one', 'finder', 'PATCH', f'/reports/{found}/photos',
               {'primary': int(photo)}, 409)

    signals = sql(f"SELECT detail FROM match_signals WHERE match_id = {m} AND signal_key = 'species';")
    check(C, 'EM-06', "The pairing's reasons are untouched", 'Both reports describe a dog.', signals,
          signals == 'Both reports describe a dog.')

    # Settle the pairing: the report is Active again, and editable.
    status(C, 'EM-07', 'The finder says it is not their match', 'finder', 'PATCH', f'/matches/{m}', {'action': 'dismiss'}, 200)
    check(C, 'EM-08', '...both reports are Active again', 'active,active', f'{status_of(lost)},{status_of(found)}',
          status_of(lost) == 'active' and status_of(found) == 'active')
    status(C, 'EM-09', 'Now the found report can be edited into a turtle', 'finder', 'PUT', f'/reports/{found}',
           {'species': 'other', 'breed': 'turtle'}, 200)
    pairs = sql(f'SELECT COUNT(*) FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')
    check(C, 'EM-10', '...which is compared again and pairs with no dog; the old pairing stays dismissed',
          '1 pairing, dismissed', f'{pairs} pairing, {sql(f"SELECT match_status FROM match_claims WHERE match_id = {m};")}',
          pairs == '1' and sql(f'SELECT match_status FROM match_claims WHERE match_id = {m};') == 'dismissed')

    # An Active report edited so that it now qualifies is paired on its new details.
    city2 = 'Audit Rematch City'
    target, _ = file_report('customer', incident_date='2026-09-10', city=city2, **dog)
    stray, _ = file_report('finder', report_type='found', pet_name=None, incident_date='2026-09-11', city=city2,
                           species='cat', breed='Persian', size='medium', sex='female', primary_color='White',
                           distinct_features='Blue eyes')
    check(C, 'EM-11', '(a found cat beside a lost dog: no pairing, both Active)', 'none',
          pairing(target, stray) or 'none', not pairing(target, stray) and status_of(stray) == 'active')
    status(C, 'EM-12', 'The finder corrects it: it was a small brown Shih Tzu', 'finder', 'PUT', f'/reports/{stray}',
           {'species': 'dog', 'breed': 'Shih Tzu', 'size': 'small', 'sex': 'male', 'primary_color': 'Brown',
            'distinct_features': 'White chest patch, one floppy ear'}, 200)
    fresh = pairing(target, stray)
    check(C, 'EM-13', '...and the edit is compared at once: a pairing appears', 'a pairing', fresh or 'NONE', bool(fresh))
    if fresh:
        n = sql(f'SELECT COUNT(*) FROM match_signals WHERE match_id = {fresh};')
        species = sql(f"SELECT detail FROM match_signals WHERE match_id = {fresh} AND signal_key = 'species';")
        summed = sql(f'SELECT SUM(CASE WHEN is_matched THEN weight ELSE 0 END) FROM match_signals WHERE match_id = {fresh};')
        score = sql(f'SELECT match_score FROM match_claims WHERE match_id = {fresh};')
        check(C, 'EM-14', '...with seven reasons that describe the edited report', '7, a dog',
              f'{n}, {species}', n == '7' and species == 'Both reports describe a dog.')
        check(C, 'EM-15', '...a score equal to its matched weights', score, summed, summed == score)
        check(C, 'EM-16', '...and both reports are Possible Match', 'possible_match,possible_match',
              f'{status_of(target)},{status_of(stray)}',
              status_of(target) == 'possible_match' and status_of(stray) == 'possible_match')

    # Decided pairings are history: an edit rewrites none of them.
    decided = sql("SELECT GROUP_CONCAT(CONCAT(match_id,':',match_status,':',match_score) ORDER BY match_id) FROM match_claims "
                  "WHERE match_status IN ('confirmed','rejected');")
    status(C, 'EM-17', 'An unrelated Active report is edited', 'customer', 'PUT', f'/reports/{alone}',
           {'description': 'Edited again, with enough words to count.'}, 200)
    after_decided = sql("SELECT GROUP_CONCAT(CONCAT(match_id,':',match_status,':',match_score) ORDER BY match_id) FROM match_claims "
                        "WHERE match_status IN ('confirmed','rejected');")
    check(C, 'EM-18', '...and no confirmed or rejected pairing changes', 'unchanged',
          'unchanged' if after_decided == decided else 'CHANGED', after_decided == decided)



def reopen_decisions():
    """A Pet Coordinator can undo a rejection, confirmation or "Not my pet", safely.

    Reopening puts the pairing back to under_review and both reports back to
    Possible Match, tells both reporters why, and leaves the stored comparison
    untouched. It is refused for a withdrawal (a report was finished), when a
    report has been closed since, and when a report has changed so that the
    stored comparison no longer describes it (the dog/turtle case).
    """
    C = 'T. Reopening a decision'
    dog = dict(species='dog', breed='Shih Tzu', size='small', sex='male', primary_color='Brown',
               distinct_features='White chest patch, one floppy ear')

    def pair(city):
        lost, _ = file_report('customer', incident_date='2026-09-10', city=city, **dog)
        found, _ = file_report('finder', report_type='found', pet_name=None, incident_date='2026-09-11', city=city, **dog)
        return lost, found, sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')

    def state(m, lost, found):
        return '/'.join([sql(f'SELECT match_status FROM match_claims WHERE match_id = {m};'),
                         sql(f'SELECT status FROM pet_reports WHERE report_id = {lost};'),
                         sql(f'SELECT status FROM pet_reports WHERE report_id = {found};')])

    lost, found, m = pair('Audit Reopen City')
    reason = {'action': 'reopen', 'note': 'Ruled out by mistake; the owner sent a clearer photo.'}
    status(C, 'RO-01', 'A guest cannot reopen anything', 'guest', 'PATCH', f'/matches/{m}', reason, 401)
    status(C, 'RO-02', 'Nor can a reporter in the pairing', 'customer', 'PATCH', f'/matches/{m}', reason, 403)
    status(C, 'RO-03', 'An open pairing has nothing to reopen', 'staff', 'PATCH', f'/matches/{m}', reason, 409)

    status(C, 'RO-04', '(the coordinator rules it out)', 'staff', 'PATCH', f'/matches/{m}',
           {'action': 'reject', 'note': 'Different markings.'}, 200)
    signals_before = sql(f"SELECT GROUP_CONCAT(signal_key, is_matched ORDER BY signal_id) FROM match_signals WHERE match_id = {m};")
    score_before = sql(f'SELECT match_score FROM match_claims WHERE match_id = {m};')
    status(C, 'RO-05', 'Reopening needs a reason', 'staff', 'PATCH', f'/matches/{m}', {'action': 'reopen'}, 422)
    status(C, 'RO-06', 'With one, the rejection is reopened', 'staff', 'PATCH', f'/matches/{m}', reason, 200)
    check(C, 'RO-07', '...the pairing is under review and both reports Possible Match',
          'under_review/possible_match/possible_match', state(m, lost, found),
          state(m, lost, found) == 'under_review/possible_match/possible_match')
    lines = sql(f"SELECT COUNT(*) FROM status_logs WHERE report_id IN ({lost}, {found}) "
                "AND note = 'A Pet Coordinator reopened the pairing for review.';")
    check(C, 'RO-08', '...each case history says so', '2', lines, lines == '2')
    told = sql(f"SELECT COUNT(*) FROM notifications WHERE match_id = {m} AND notification_type = 'staff_reviewed' "
               "AND title = 'A pairing was reopened for review';")
    check(C, 'RO-09', '...both reporters are told, with the reason', '2', told, told == '2')
    logged = sql(f"SELECT detail FROM audit_logs WHERE action = 'match_decided' AND target_id = {m} "
                 "ORDER BY audit_id DESC LIMIT 1;")
    check(C, 'RO-10', '...and it is in the audit log', 'reopen: rejected -> under_review', logged,
          logged == 'reopen: rejected -> under_review')
    same = (sql(f"SELECT GROUP_CONCAT(signal_key, is_matched ORDER BY signal_id) FROM match_signals WHERE match_id = {m};"),
            sql(f'SELECT match_score FROM match_claims WHERE match_id = {m};'))
    check(C, 'RO-11', 'The stored comparison is untouched', (signals_before, score_before), same,
          same == (signals_before, score_before))
    code, _ = session('finder').call('PUT', f'/reports/{found}', {'description': 'Edited while reopened, with enough words to count.'})
    check(C, 'RO-12', 'The reports are frozen again while it is open', 409, code, code == 409)

    status(C, 'RO-13', 'It can then be confirmed as usual', 'staff', 'PATCH', f'/matches/{m}', {'action': 'confirm'}, 200)
    status(C, 'RO-14', 'A confirmation can be reopened too', 'staff', 'PATCH', f'/matches/{m}', reason, 200)
    check(C, 'RO-15', '...both reports come out of Returned', 'under_review/possible_match/possible_match',
          state(m, lost, found), state(m, lost, found) == 'under_review/possible_match/possible_match')

    # Confirmed, then the owner closes the report: the case has ended.
    status(C, 'RO-16', '(confirmed again)', 'staff', 'PATCH', f'/matches/{m}', {'action': 'confirm'}, 200)
    session('customer').call('PATCH', f'/reports/{lost}', {'status': 'closed', 'note': 'All settled.'})
    status(C, 'RO-17', 'Once a report is closed, the confirmation cannot be reopened', 'staff', 'PATCH',
           f'/matches/{m}', reason, 409)

    # A reporter's "Not my pet" pressed on the wrong pairing: the coordinator can reopen it.
    lost2, found2, m2 = pair('Audit Reopen Dismiss City')
    session('finder').call('PATCH', f'/matches/{m2}', {'action': 'dismiss'})
    status(C, 'RO-18', 'A reporter\'s "Not my pet" can be reopened by a coordinator', 'staff', 'PATCH', f'/matches/{m2}', reason, 200)
    check(C, 'RO-19', '...the pairing is under review and both reports Possible Match',
          'under_review/possible_match/possible_match', state(m2, lost2, found2),
          state(m2, lost2, found2) == 'under_review/possible_match/possible_match')

    # A withdrawal is final: the pairing was dismissed because a report ended.
    lost4, found4, m4 = pair('Audit Reopen Withdrawn City')
    session('finder').call('PATCH', f'/reports/{found4}', {'status': 'closed', 'note': 'Handed to the city shelter.'})
    check(C, 'RO-20', '(closing the found report withdraws the pairing)', 'dismissed/active/closed',
          state(m4, lost4, found4), state(m4, lost4, found4) == 'dismissed/active/closed')
    code, payload = session('staff').call('PATCH', f'/matches/{m4}', reason)
    check(C, 'RO-21', 'A withdrawn pairing cannot be reopened', 409, code,
          code == 409 and 'withdrawn' in str(payload))
    check(C, 'RO-22', '...and nothing moved', 'dismissed/active/closed', state(m4, lost4, found4),
          state(m4, lost4, found4) == 'dismissed/active/closed')

    # The dog/turtle case: ruled out, then the found report edited into a turtle.
    lost3, found3, m3 = pair('Audit Reopen Turtle City')
    session('staff').call('PATCH', f'/matches/{m3}', {'action': 'reject', 'note': 'Not the same dog.'})
    code, _ = session('finder').call('PUT', f'/reports/{found3}', {'species': 'other', 'breed': 'turtle'})
    check(C, 'RO-23', '(after the rejection, the found report is edited into a turtle)', 200, code, code == 200)
    code, payload = session('staff').call('PATCH', f'/matches/{m3}', reason)
    check(C, 'RO-24', 'Reopening it is refused: the comparison no longer describes the reports',
          (409, 'comparison_changed'), (code, payload.get('code')), (code, payload.get('code')) == (409, 'comparison_changed'))
    check(C, 'RO-25', '...and nothing moved', 'rejected/active/active', state(m3, lost3, found3),
          state(m3, lost3, found3) == 'rejected/active/active')

def error_handling():
    C = 'H. Error handling'
    status(C, 'EH-01', 'A report that does not exist', 'guest', 'GET', '/reports/99999', None, 404)
    status(C, 'EH-02', 'A resource that does not exist', 'guest', 'GET', '/nosuchthing', None, 404)
    status(C, 'EH-03', 'A pairing that does not exist', 'staff', 'GET', '/matches/99999', None, 404)
    status(C, 'EH-04', 'An account that does not exist', 'admin', 'GET', '/users/99999', None, 404)
    status(C, 'EH-05', 'A method the endpoint does not accept', 'admin', 'DELETE', '/reports/1', None, 404)

    code, body = session('guest').call('GET', '/reports/99999')
    text = json.dumps(body).lower()
    clean = not any(w in text for w in ('select ', 'pdo', 'c:\\', '.php', 'sqlstate'))
    check(C, 'EH-06', 'Errors disclose no SQL, path or exception text', 'clean',
          'clean' if clean else 'LEAKS DETAIL', clean)

    # Only /reports/{id}/photos has a third path segment. Every other handler
    # takes the resource and the identifier, so an extra segment used to be
    # dropped and the request answered as though it had not been typed:
    # /matches/1/claims returned the match. A URL that does not exist has to
    # say so, or the API quietly invents endpoints it does not have.
    status(C, 'EH-07', 'An invented sub-path on a real resource', 'guest', 'GET', '/matches/1/claims', None, 404)
    status(C, 'EH-08', 'An invented sub-path on a protected resource', 'admin', 'GET', '/users/1/password', None, 404)
    status(C, 'EH-09', 'A fourth path segment', 'customer', 'POST', '/reports/1/photos/extra', None, 404)
    status(C, 'EH-10', 'The one real sub-path still works', 'staff', 'GET', '/matches/1', None, 200)



# ===================================================================== SUMMARY
def report():
    width = 118
    category = None
    for cat, tid, desc, expected, actual, ok in results:
        if cat != category:
            category = cat
            print()
            print(cat)
            print('-' * width)
            print(f'  {"ID":<8} {"Test":<52} {"Expected":<16} {"Actual":<16} Result')
        mark = 'PASS' if ok else '*** FAIL ***'
        print(f'  {tid:<8} {desc[:52]:<52} {expected[:16]:<16} {actual[:16]:<16} {mark}')

    print()
    print('=' * width)
    print(f'  {"Category":<28} {"Tests":>7} {"Passed":>8} {"Failed":>8}')
    print('  ' + '-' * (width - 4))
    total = passed = 0
    for cat in dict.fromkeys(r[0] for r in results):
        rows = [r for r in results if r[0] == cat]
        p = sum(1 for r in rows if r[5])
        total += len(rows)
        passed += p
        print(f'  {cat:<28} {len(rows):>7} {p:>8} {len(rows) - p:>8}')
    print('  ' + '-' * (width - 4))
    print(f'  {"TOTAL":<28} {total:>7} {passed:>8} {total - passed:>8}')
    print()
    failures = [r for r in results if not r[5]]
    if failures:
        print('  FAILURES:')
        for cat, tid, desc, expected, actual, _ in failures:
            print(f'    {tid}  {desc}')
            print(f'         expected {expected}, got {actual}')
    else:
        print('  Every test passed.')
    return total, passed


if __name__ == '__main__':
    print('Paws&Found — system audit')
    print(f'  API: {audit.API}')

    # This suite reseeds and rewrites what it reaches, so it refuses any API or
    # database that is not this machine before it sends anything that changes
    # data (audit.py, "Target safety"). The database half runs inside
    # db_reachable(), below.
    audit.require_local_api()

    # Forty-nine of these assertions read the database directly, and that is
    # the point of them: a response that says a row was written proves nothing
    # on its own. Without the database this suite would run about two thirds of
    # itself and print a smaller total as though it were the whole thing, which
    # is a worse outcome than not running.
    if not audit.db_reachable():
        print()
        print('  Cannot reach the database, so this suite will not run.')
        print()
        print('  It needs BOTH the local API and the local MySQL server that API')
        print('  is using: start XAMPP\'s Apache and MariaDB (port 3307). See')
        print('  docs/CURRENT_STATE.md, "Running it locally".')
        sys.exit(2)

    reseed()
    input_validation()
    sql_injection()
    authentication()
    authorization()
    rid = xss()
    uploads(rid)
    functional()
    error_handling()
    location_privacy()
    access_control()
    information_reply()
    report_editing()
    qa_rules()
    final_integrity()
    match_rejection()
    repeat_matching()
    calendar_dates()
    city_names()
    edit_while_matched()
    reopen_decisions()
    total, passed = report()

    reseed()
    for f in os.listdir(os.path.join(PROJECT, 'api', 'uploads')):
        if f != '.htaccess':
            os.remove(os.path.join(PROJECT, 'api', 'uploads', f))
    print()
    print(f'  Data restored: {sql("SELECT COUNT(*) FROM pet_reports;")} reports, '
          f'{sql("SELECT COUNT(*) FROM match_claims;")} pairings, '
          f'{sql("SELECT COUNT(*) FROM users;")} accounts.')
    sys.exit(0 if passed == total else 1)

