"""The test cases themselves. Run this file."""
import json
import os
import struct
import sys
import urllib.parse
import zlib

import audit
from audit import (PROJECT, check, file_report, multipart, reseed, results,
                   session, sql, status)


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
    status(C, 'IV-10', 'Registration password under 8 characters', 'guest', 'POST', '/auth/register',
           {'full_name': 'Audit', 'email': 'audit.short@example.com', 'password': 'short',
            'privacy_consent': True}, 422)
    status(C, 'IV-11', 'Registration with a malformed email', 'guest', 'POST', '/auth/register',
           {'full_name': 'Audit', 'email': 'not-an-email', 'password': 'longenough1',
            'privacy_consent': True}, 422)
    status(C, 'IV-12', 'Registration with no name', 'guest', 'POST', '/auth/register',
           {'full_name': '', 'email': 'audit.noname@example.com', 'password': 'longenough1',
            'privacy_consent': True}, 422)
    status(C, 'IV-13', 'Registration reusing an existing email', 'guest', 'POST', '/auth/register',
           {'full_name': 'Audit', 'email': 'maria.santos@example.com', 'password': 'longenough1',
            'privacy_consent': True}, 409)
    status(C, 'IV-14', 'Sign in with both fields blank', 'guest', 'POST', '/auth/login',
           {'email': '', 'password': ''}, 422)
    status(C, 'IV-15', 'Profile update with no email', 'customer', 'PATCH', '/users/me',
           {'full_name': 'Maria Santos'}, 422)
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
    # 15: the 14 tables on the ERD, plus schema_migrations, which is
    # infrastructure rather than a domain table (database/migrations/README.md).
    check(C, 'SQL-12', 'Schema intact afterwards', '15 tables',
          sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='pawsandfound';") + ' tables',
          sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='pawsandfound';") == '15')
    # The ERD claims 23. A diagram cannot be wrong quietly if the suite counts
    # the same thing the diagram is drawing.
    fks = sql("SELECT COUNT(*) FROM information_schema.table_constraints "
              "WHERE table_schema='pawsandfound' AND constraint_type='FOREIGN KEY';")
    check(C, 'SQL-14', 'Foreign keys match the ERD', '23 keys', fks + ' keys', fks == '23')
    roles = sql('SELECT GROUP_CONCAT(role ORDER BY user_id) FROM users WHERE user_id<=3;')
    check(C, 'SQL-13', 'No account was promoted', 'user,user,user', roles, roles == 'user,user,user')


# =========================================================== C. AUTHENTICATION
def authentication():
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
        'full_name': 'Audit Registrant', 'email': 'audit.new@example.com',
        'password': 'auditpass123', 'contact_number': '+63 917 000 0000',
        'privacy_consent': True})
    check(C, 'AU-09', 'Register a new account', 201, code, code == 201)
    role = sql("SELECT role FROM users WHERE email='audit.new@example.com';")
    check(C, 'AU-10', 'New account is signed in immediately', 'session started',
          'session started' if reg.call('GET', '/auth/me')[1].get('user') else 'not signed in',
          bool(reg.call('GET', '/auth/me')[1].get('user')))

    esc = Session()
    esc.call('POST', '/auth/register', {
        'full_name': 'Audit Escalator', 'email': 'audit.esc@example.com',
        'password': 'auditpass123', 'role': 'admin', 'account_status': 'active',
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
    # The checkbox on the form is a convenience. What makes the consent record
    # trustworthy is that the account cannot be created without it here.
    status(C, 'AU-25', 'Registering without the privacy acknowledgement',
           'guest', 'POST', '/auth/register',
           {'full_name': 'Consent Audit', 'email': 'audit.consent@example.com',
            'password': 'auditpass123'}, 422)
    status(C, 'AU-26', 'Sending the acknowledgement as a string rather than true',
           'guest', 'POST', '/auth/register',
           {'full_name': 'Consent Audit', 'email': 'audit.consent@example.com',
            'password': 'auditpass123', 'privacy_consent': 'true'}, 422)

    none_yet = sql("SELECT COUNT(*) FROM users WHERE email='audit.consent@example.com';")
    check(C, 'AU-27', 'Neither refusal created an account', '0', none_yet, none_yet == '0')

    status(C, 'AU-28', 'Registering with the acknowledgement given',
           'guest', 'POST', '/auth/register',
           {'full_name': 'Consent Audit', 'email': 'audit.consent@example.com',
            'password': 'auditpass123', 'privacy_consent': True}, 201)

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
                             {'full_name': 'Forged Name', 'email': ACCOUNTS['customer']},
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
                          {'full_name': 'Forged Name', 'email': ACCOUNTS['customer']})
    check(C, 'AU-32', "Another session's token", 403, code, code == 403)
    forged.csrf = borrowed['csrf']

    # And the control: the same request, with the right token, goes through.
    forged.prime_csrf()
    code, _ = forged.call('PATCH', '/users/me',
                          {'full_name': 'Maria Santos', 'email': ACCOUNTS['customer'],
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


# ============================================================ D. AUTHORIZATION
def authorization():
    C = 'D. Authorization'
    cases = [
        ('AZ-01', 'guest', 'GET', '/reports', 200, 'Anyone may browse reports'),
        ('AZ-02', 'guest', 'GET', '/reports/1', 200, 'Anyone may open a report'),
        ('AZ-03', 'guest', 'GET', '/categories', 200, 'Anyone may read the species list'),
        ('AZ-04', 'guest', 'GET', '/matches', 200, 'Pairings are public by design'),
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
        'full_name': 'Maria Santos', 'email': 'maria.santos@example.com', 'role': 'admin'})
    got = sql('SELECT role FROM users WHERE user_id=1;')
    check(C, 'AZ-29', 'Customer sending "role":"admin" to their own profile', 'user', got, got == 'user')

    status(C, 'AZ-30', 'Administrator suspending their own account', 'admin', 'PATCH',
           '/users/10', {'account_status': 'suspended'}, 422)
    status(C, 'AZ-31', 'Administrator demoting themselves', 'admin', 'PATCH', '/users/10',
           {'role': 'user'}, 422)


# ====================================================================== E. XSS
def xss():
    C = 'E. Cross-site scripting'
    payloads = {
        'pet_name': '<script>alert(1)</script>',
        'distinct_features': '<img src=x onerror=alert(document.cookie)>',
        'description': '"><svg/onload=alert(1)>',
    }
    rid, code = file_report('customer', **payloads)
    check(C, 'XSS-01', 'Report accepted with script payloads in three fields', 200, code, code == 200)

    stored = sql(f"SELECT pet_name FROM pet_reports WHERE report_id={rid};")
    check(C, 'XSS-02', 'Payload stored verbatim (escaping belongs at output)',
          payloads['pet_name'], stored, stored == payloads['pet_name'])

    _, body = session('guest').call('GET', f'/reports/{rid}')
    returned = body.get('data', {}).get('pet_name')
    check(C, 'XSS-03', 'API returns it as data, not markup', payloads['pet_name'],
          returned, returned == payloads['pet_name'])

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
           {'pet_name': 'Audit Dog', 'description': 'Updated during the audit.'}, 200)
    status(C, 'FN-15', 'The owner closes their own report', 'customer', 'PATCH', f'/reports/{r2}',
           {'status': 'closed'}, 200)

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
           {'full_name': 'Maria Santos', 'email': 'maria.santos@example.com',
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
    status(C, 'FN-31', 'The reporter closes an open report',
           'customer', 'PATCH', '/reports/18', {'status': 'closed'}, 200)
    code, body = session('customer').call('PATCH', '/reports/18', {'status': 'active'})
    check(C, 'FN-32', 'A closed report does not reopen', '409 with no moves left',
          f'{code} with {len(body.get("allowed", ["?"]))} moves left',
          code == 409 and body.get('allowed') == [])

    after = sql('SELECT status FROM pet_reports WHERE report_id=18;')
    check(C, 'FN-33', 'A refused move changes nothing in the database',
          'closed', after, after == 'closed')

    sql("UPDATE pet_reports SET status='active' WHERE report_id=18;")


# ============================================================ H. ERROR HANDLING
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
    status(C, 'EH-10', 'The one real sub-path still works', 'guest', 'GET', '/matches/1', None, 200)



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

    # Forty-nine of these assertions read the database directly, and that is
    # the point of them: a response that says a row was written proves nothing
    # on its own. Without the database this suite would run about two thirds of
    # itself and print a smaller total as though it were the whole thing, which
    # is a worse outcome than not running.
    if not audit.db_reachable():
        print()
        print('  Cannot reach the database, so this suite will not run.')
        print()
        print('  It needs BOTH the API and the MySQL server that API is using.')
        print('  Against a hosted site that usually means turning on the host')
        print('  control panel\'s "Remote MySQL" for this machine, then:')
        print()
        print('    PAWS_API=https://<domain>/api \\')
        print('    PAWS_MYSQL_ARGS="-u <dbuser> -p<password> -h <dbhost>" \\')
        print('    python scripts/audit_cases.py')
        print()
        print('  Or run it on the host itself. `npm run multi-device` needs only')
        print('  the API and is the one to reach for when the database is not')
        print('  reachable from here.')
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

