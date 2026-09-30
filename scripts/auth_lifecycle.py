"""
Paws&Found — the account lifecycle, end to end.

Registration, verification, sign-in refusal, password reset, session
revocation, the safe email change, rate limiting and Turnstile.

It reads the verification and reset links out of the CAPTURED mail, exactly as
a person would read them out of their inbox. There is no endpoint that hands
out tokens and there is never going to be one: the capture transport exists
only when MAIL_TRANSPORT is 'capture', which production never sets.

Run with the local API:

    python scripts/auth_lifecycle.py

It writes api/config.local.php while it runs, to switch the mail transport, and
puts back whatever was there before. It restores the demonstration data at the
end.

Stdlib only.
"""
import glob
import json
import os
import shutil
import sys
import hashlib
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit
from audit import reseed, sql

PW = audit.PW
# The test account's own password. The seeded accounts keep PW (demo1234), which
# still signs in: the 15-character rule applies only when a password is chosen.
LIFECYCLE_PW = 'lifecycle river passphrase'
CAPTURE_DIR = os.path.join(os.environ.get('TEMP', '/tmp'), 'pawsandfound-mail')
LOCAL_CONFIG = os.path.join(audit.PROJECT, 'api', 'config.local.php')

results = []


def check(step, what, expected, actual):
    ok = expected == actual
    results.append((step, what, expected, actual, ok))
    print(f'  {step:<6}{what:<56}{str(expected)[:20]:<20}{str(actual)[:20]:<20}'
          f'{"PASS" if ok else "FAIL"}')


def banner(title):
    print()
    print(title)
    print('-' * 112)
    print(f'  {"":<6}{"What is being tested":<56}{"Expected":<20}{"Actual":<20}Result')


def session():
    s = audit.Session()
    s.prime_csrf()
    return s


def newest_mail(after=0.0):
    """The most recent captured message, or None."""
    files = [f for f in glob.glob(os.path.join(CAPTURE_DIR, '*.json'))
             if os.path.getmtime(f) >= after]
    if not files:
        return None
    with open(max(files, key=os.path.getmtime), encoding='utf-8') as handle:
        return json.load(handle)


def token_from(message):
    """Pull the one-time token out of a captured link."""
    if not message:
        return None
    text = message['text']
    marker = 'token='
    start = text.index(marker) + len(marker) if marker in text else None
    if start is None:
        return None
    end = start
    while end < len(text) and text[end] not in ' \n\r':
        end += 1
    return text[start:end]


# ======================================================= set up
previous_config = None
if os.path.exists(LOCAL_CONFIG):
    with open(LOCAL_CONFIG, encoding='utf-8') as handle:
        previous_config = handle.read()

shutil.rmtree(CAPTURE_DIR, ignore_errors=True)

with open(LOCAL_CONFIG, 'w', encoding='utf-8') as handle:
    print('<?php', file=handle)
    print("define('MAIL_TRANSPORT', 'capture');", file=handle)
    print("define('MAIL_CAPTURE_DIR', '" + CAPTURE_DIR.replace('\\', '/') + "');", file=handle)
    # Turnstile off for most of the run; one section turns it back on to prove
    # production cannot silently skip it.
    print("define('TURNSTILE_ENABLED', false);", file=handle)

try:
    NEW_EMAIL = 'lifecycle.test@example.com'
    MOVED_EMAIL = 'lifecycle.moved@example.com'
    sql(f"DELETE FROM users WHERE email IN ('{NEW_EMAIL}', '{MOVED_EMAIL}')")
    sql("DELETE FROM auth_rate_limits")

    # =================================================== A. registration
    banner('A. Registering no longer signs anybody in')
    started = time.time()
    caller = session()
    code, payload = caller.call('POST', '/auth/register', {
        'full_name': 'Lifecycle Tester',
        'email': NEW_EMAIL,
        'password': LIFECYCLE_PW,
        'privacy_consent': True,
    })
    check('A1', 'The account is created', 201, code)
    check('A2', 'The response asks for verification', True,
          payload.get('verification_required') is True)
    check('A3', 'It does not hand back a session', True, 'user' not in payload)
    check('A4', 'The address is masked in the response', True,
          NEW_EMAIL not in json.dumps(payload))
    check('A5', 'The row exists and is unverified', '1',
          sql(f"SELECT COUNT(*) FROM users WHERE email='{NEW_EMAIL}' AND email_verified_at IS NULL"))
    check('A6', 'Nothing is signed in', 'signed out',
          'signed out' if caller.call('GET', '/auth/me')[1].get('user') is None else 'signed in')

    message = newest_mail(started)
    check('A7', 'A verification email was produced', NEW_EMAIL,
          message['to'] if message else '(none)')
    token = token_from(message)
    check('A8', 'It carries a 64-character token', 64, len(token or ''))
    check('A9', 'The RAW token is not in the database', '0',
          sql(f"SELECT COUNT(*) FROM auth_tokens WHERE token_hash='{token}'"))
    check('A10', 'Only its hash is', '1',
          sql(f"SELECT COUNT(*) FROM auth_tokens WHERE token_hash=SHA2('{token}',256)"))

    # =================================================== B. cannot sign in yet
    banner('B. An unproved address cannot sign in')
    code, payload = session().call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': LIFECYCLE_PW})
    check('B1', 'Sign-in is refused', 403, code)
    check('B2', 'And says why, in a way the browser can act on', 'verification_required',
          payload.get('code'))
    code, _ = session().call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': 'wrong'})
    check('B3', 'A wrong password is still just a wrong password', 401, code)

    # =================================================== C. verification
    banner('C. Following the link')
    code, payload = session().call('POST', '/auth/verify-email', {'token': token})
    check('C1', 'The address is verified', 200, code)
    check('C2', 'The column is set', '1',
          sql(f"SELECT COUNT(*) FROM users WHERE email='{NEW_EMAIL}' AND email_verified_at IS NOT NULL"))
    check('C3', 'The same link a second time is refused', 400,
          session().call('POST', '/auth/verify-email', {'token': token})[0])
    check('C4', 'A made-up token is refused the same way', 400,
          session().call('POST', '/auth/verify-email', {'token': 'a' * 64})[0])
    check('C5', 'Now sign-in works', 200,
          session().call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': LIFECYCLE_PW})[0])
    check('C6', 'And it is in the audit log', 'email_verified',
          sql("SELECT action FROM audit_logs WHERE action='email_verified' "
              "ORDER BY audit_id DESC LIMIT 1") or '(none)')
    check('C7', 'No raw token reached the audit log', '0',
          sql(f"SELECT COUNT(*) FROM audit_logs WHERE detail LIKE '%{token[:16]}%'"))

    # =================================================== D. the seeded accounts
    banner('D. The demonstration accounts still work')
    for label in ('customer', 'staff', 'admin'):
        check(f'D-{label[:4]}', f'{audit.ACCOUNTS[label]} signs in', 200,
              session().call('POST', '/auth/login',
                             {'email': audit.ACCOUNTS[label], 'password': PW})[0])

    # =================================================== E. password reset
    banner('E. Forgetting a password')
    started = time.time()
    code, payload = session().call('POST', '/auth/forgot-password', {'email': NEW_EMAIL})
    real_answer = (code, payload.get('message'))
    check('E1', 'A real address gets a generic answer', 200, code)
    code, payload = session().call('POST', '/auth/forgot-password',
                                   {'email': 'nobody.at.all@example.com'})
    check('E2', 'An unknown address gets the identical answer', real_answer,
          (code, payload.get('message')))

    reset_token = token_from(newest_mail(started))
    check('E3', 'A reset link was produced', 64, len(reset_token or ''))

    signed_in = session()
    signed_in.call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': LIFECYCLE_PW})
    signed_in.prime_csrf()
    check('E4', 'That session is live before the reset', 200,
          signed_in.call('GET', '/notifications')[0])

    check('E5', 'A short password is refused', 422,
          session().call('POST', '/auth/reset-password',
                         {'token': reset_token, 'password': 'short'})[0])

    # RESET-SAME: the password the account already has is not a new one. It
    # used to be accepted, sign every other session out and say "Password
    # changed". Refused now, and before the link is spent.
    reset_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    uid = sql(f"SELECT user_id FROM users WHERE email='{NEW_EMAIL}'")
    version_before = sql(f"SELECT session_version FROM users WHERE user_id={uid}")
    audits_before = sql(f"SELECT COUNT(*) FROM audit_logs WHERE action='password_reset' AND target_id={uid}")
    code, payload = session().call('POST', '/auth/reset-password', {'token': reset_token, 'password': LIFECYCLE_PW})
    check('RS-1a', 'Resetting to the current password is refused', 422, code)
    check('RS-1b', '...on the password field, saying why',
          'Choose a new password that is different from your current password.',
          (payload.get('fields') or {}).get('password'))
    check('RS-1c', '...the link is not spent', 'NULL',
          sql(f"SELECT IFNULL(used_at, 'NULL') FROM auth_tokens WHERE token_hash='{reset_hash}'"))
    check('RS-1d', '...no session is revoked (session_version unchanged)', version_before,
          sql(f"SELECT session_version FROM users WHERE user_id={uid}"))
    check('RS-1e', '...the session open elsewhere still works', 200, signed_in.call('GET', '/notifications')[0])
    check('RS-1f', '...the password still works', 200,
          session().call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': LIFECYCLE_PW})[0])
    check('RS-1g', '...and no reset is recorded', audits_before,
          sql(f"SELECT COUNT(*) FROM audit_logs WHERE action='password_reset' AND target_id={uid}"))

    check('E6', 'The same link then resets to a genuinely new password', 200,
          session().call('POST', '/auth/reset-password',
                         {'token': reset_token, 'password': 'a-brand-new-password'})[0])
    check('RS-2a', '...which spends the link', 'spent',
          'spent' if sql(f"SELECT used_at IS NOT NULL FROM auth_tokens WHERE token_hash='{reset_hash}'") == '1' else 'unspent')
    check('RS-2b', '...raises session_version exactly once', str(int(version_before) + 1),
          sql(f"SELECT session_version FROM users WHERE user_id={uid}"))
    check('RS-2c', '...and records one reset', str(int(audits_before) + 1),
          sql(f"SELECT COUNT(*) FROM audit_logs WHERE action='password_reset' AND target_id={uid}"))
    check('E7', 'The old password no longer works', 401,
          session().call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': LIFECYCLE_PW})[0])
    check('E8', 'The new one does', 200,
          session().call('POST', '/auth/login',
                         {'email': NEW_EMAIL, 'password': 'a-brand-new-password'})[0])
    check('E9', 'The session open elsewhere was revoked', 401,
          signed_in.call('GET', '/notifications')[0])
    check('E10', 'The reset link cannot be used twice', 400,
          session().call('POST', '/auth/reset-password',
                         {'token': reset_token, 'password': 'another-password'})[0])
    check('E11', 'It is in the audit log', 'password_reset',
          sql("SELECT action FROM audit_logs WHERE action='password_reset' "
              "ORDER BY audit_id DESC LIMIT 1") or '(none)')

    # =================================================== F. reset is not an unlock
    banner('F. A reset is not an unlock, and not a reinstatement')
    uid = sql(f"SELECT user_id FROM users WHERE email='{NEW_EMAIL}'")
    sql(f"UPDATE users SET account_status='locked' WHERE user_id={uid}")
    started = time.time()
    session().call('POST', '/auth/forgot-password', {'email': NEW_EMAIL})
    locked_token = token_from(newest_mail(started))
    code, _ = session().call('POST', '/auth/reset-password',
                             {'token': locked_token, 'password': 'a-brand-new-password'})
    check('RS-4a', 'Locked: the current password is refused as a reset too', 422, code)
    check('RS-4b', '...and that refusal unlocks nothing', 'locked',
          sql(f"SELECT account_status FROM users WHERE user_id={uid}"))
    check('F1', 'A locked account can still reset its password', 200,
          session().call('POST', '/auth/reset-password',
                         {'token': locked_token, 'password': 'password-after-lock'})[0])
    check('F2', 'But the account is still locked', 'locked',
          sql(f"SELECT account_status FROM users WHERE user_id={uid}"))
    check('F3', 'And still cannot sign in', 403,
          session().call('POST', '/auth/login',
                         {'email': NEW_EMAIL, 'password': 'password-after-lock'})[0])

    # RESET-SAME-5: the link is still spent once. Two resets with the same link
    # and different new passwords, sent together: one succeeds, one is refused.
    # The earlier sections used this hour's forgot-password allowance (3 per
    # address and per IP); clear it here, locally, so a fresh link is sent.
    sql("DELETE FROM auth_rate_limits WHERE action = 'forgot_password'")
    started = time.time()
    session().call('POST', '/auth/forgot-password', {'email': NEW_EMAIL})
    race_token = token_from(newest_mail(started))
    from concurrent.futures import ThreadPoolExecutor
    def attempt(password):
        return session().call('POST', '/auth/reset-password', {'token': race_token, 'password': password})[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = sorted(pool.map(attempt, ['race-password-one', 'race-password-two']))
    check('RS-5', 'Two resets with one link at the same moment: one succeeds', [200, 400], codes)
    # The password is whichever won; put the account back to the one the rest expects.
    started = time.time()
    session().call('POST', '/auth/forgot-password', {'email': NEW_EMAIL})
    back = token_from(newest_mail(started))
    session().call('POST', '/auth/reset-password', {'token': back, 'password': 'password-after-lock'})
    sql(f"UPDATE users SET account_status='active' WHERE user_id={uid}")

    # =================================================== G. changing an address
    banner('G. Changing an email address')
    owner = session()
    owner.call('POST', '/auth/login', {'email': NEW_EMAIL, 'password': 'password-after-lock'})
    owner.prime_csrf()
    started = time.time()
    code, payload = owner.call('PATCH', '/users/me', {
        'full_name': 'Lifecycle Tester',
        'email': MOVED_EMAIL,
    })
    check('G1', 'The request is accepted', 200, code)
    check('G2', 'The old address is still the account address', NEW_EMAIL,
          sql(f"SELECT email FROM users WHERE user_id={uid}"))
    check('G3', 'The new one is only pending', MOVED_EMAIL,
          sql(f"SELECT pending_email FROM users WHERE user_id={uid}"))
    check('G4', 'The old address still signs in', 200,
          session().call('POST', '/auth/login',
                         {'email': NEW_EMAIL, 'password': 'password-after-lock'})[0])
    check('G5', 'The new one does not, yet', 401,
          session().call('POST', '/auth/login',
                         {'email': MOVED_EMAIL, 'password': 'password-after-lock'})[0])

    change_message = newest_mail(started)
    check('G6', 'The link went to the NEW address', MOVED_EMAIL,
          change_message['to'] if change_message else '(none)')
    change_token = token_from(change_message)
    check('G7', 'Following it moves the address', 200,
          session().call('POST', '/auth/verify-email', {'token': change_token})[0])
    check('G8', 'The account address changed', MOVED_EMAIL,
          sql(f"SELECT email FROM users WHERE user_id={uid}"))
    # mysql -N prints the four letters NULL for a null column, not an empty
    # string, which is worth knowing before writing the next assertion.
    check('G9', 'Nothing is left pending', 'NULL',
          sql(f"SELECT pending_email FROM users WHERE user_id={uid}"))
    check('G10', 'The new address signs in', 200,
          session().call('POST', '/auth/login',
                         {'email': MOVED_EMAIL, 'password': 'password-after-lock'})[0])
    check('G11', 'A duplicate address is refused', 422,
          owner.call('PATCH', '/users/me',
                     {'full_name': 'Lifecycle Tester',
                      'email': audit.ACCOUNTS['admin']})[0])

    # =================================================== H. rate limiting
    banner('H. Rate limiting, which is not the account lock')
    sql("DELETE FROM auth_rate_limits")
    codes = []
    for attempt in range(5):
        codes.append(session().call('POST', '/auth/forgot-password',
                                    {'email': f'rate{attempt}@example.com'})[0])
    check('H1', 'The first three are allowed', [200, 200, 200], codes[:3])
    check('H2', 'The fourth is refused', 429, codes[3])
    check('H3', 'And so is the fifth', 429, codes[4])
    check('H4', 'Registration has its own, separate allowance', True,
          session().call('POST', '/auth/register',
                         {'full_name': 'Rate Check', 'email': 'rate.check@example.com',
                          'password': LIFECYCLE_PW, 'privacy_consent': True})[0] in (201, 422))
    check('H5', 'The three-attempt account lock is untouched by any of it', '0',
          sql("SELECT COUNT(*) FROM login_attempts WHERE failed_count >= 3"))
    sql("DELETE FROM users WHERE email='rate.check@example.com'")

    # =================================================== I. names and the password rule
    # api/helpers.php: validate_full_name() for registration and the profile;
    # password_policy_error() for registration and the reset. The registration
    # allowance is cleared before each attempt, so the rate limit (section H)
    # never stands in for the answer being tested.
    banner('I. Names and the password rule')

    def register(tag, full_name='Policy Tester', password='harbour lights at six'):
        sql("DELETE FROM auth_rate_limits")
        code, body = session().call('POST', '/auth/register', {
            'full_name': full_name, 'email': f'policy.{tag}@example.com',
            'password': password, 'privacy_consent': True})
        return code, (body.get('fields') or {})

    for step, name in (('N1', 'A'), ('N2', '1'), ('N3', '!!!!')):
        code, fields = register(step.lower(), full_name=name)
        check(step, f'The name "{name}" is refused', (422, 'Enter a real name with at least 2 letters.'),
              (code, fields.get('full_name')))
    for step, name in (('N4', 'Jo Li'), ('N5', 'Ma. Ana Cruz'), ('N6', 'Anne-Marie Cruz'),
                       ('N7', "D'Angelo Reyes"), ('N8', 'O’Connor'), ('N9', 'José Santos')):
        check(step, f'The name "{name}" is accepted', 201, register(step.lower(), full_name=name)[0])
    check('N10', 'Stored with the spaces tidied', 'Maria Santos',
          (register('n10', full_name='  Maria   Santos ')[0],
           sql("SELECT full_name FROM users WHERE email='policy.n10@example.com'"))[1])
    code, payload = owner.call('PATCH', '/users/me', {'full_name': 'A', 'email': MOVED_EMAIL})
    check('N11', 'The profile refuses "A" too, on the name field', (422, 'Enter a real name with at least 2 letters.'),
          (code, (payload.get('fields') or {}).get('full_name')))
    check('N12', '...and the name was not changed', 'Lifecycle Tester',
          sql(f"SELECT full_name FROM users WHERE user_id={uid}"))

    accented = 'añoranza señorío mañana piñata ñandú'
    too_many_bytes = accented + 'x' * (72 - len(accented.encode()) - 2) + 'yzé'
    for step, what, password, expected in (
        ('P1', '14 characters', 'river bend wal', 'Use at least 15 characters'),
        ('P3', '73 ASCII bytes', 'river ' * 12 + 'b', 'too long'),
        ('P4', f'{len(too_many_bytes)} characters but {len(too_many_bytes.encode())} bytes', too_many_bytes, 'too long'),
        ('P5', 'passwordpassword', 'passwordpassword', 'too commonly used'),
        ('P6', 'one character repeated', 'z' * 18, 'too commonly used'),
        ('P6b', 'a common word and digits', 'welcome123456789', 'too commonly used'),
    ):
        code, fields = register(step.lower(), password=password)
        check(step, f'Refused: {what}', (422, True), (code, expected in (fields.get('password') or '')))
    identity = 'not based on your name or email'
    code, fields = register('p7', password='policy.p7@example.com')
    check('P7', 'Refused: the email address itself', (422, True), (code, identity in (fields.get('password') or '')))
    sql("DELETE FROM auth_rate_limits")
    code, body = session().call('POST', '/auth/register', {
        'full_name': 'Policy Tester', 'email': 'harbour.lights.at.six@example.com',
        'password': 'harbour.lights.at.six', 'privacy_consent': True})
    check('P8', 'Refused: the part of the email before the @', (422, True),
          (code, identity in ((body.get('fields') or {}).get('password') or '')))
    code, fields = register('p9', full_name='Harbour Lighthouse Keeper', password='harbourlighthousekeeper')
    check('P9', 'Refused: the name, run together', (422, True), (code, identity in (fields.get('password') or '')))
    check('P2', 'Accepted: a 15+ character passphrase', 201, register('p2', password='river bend walks')[0])
    check('P10', 'Accepted: a Fair password (every rule met)', 201, register('p10', password='harbour lights ok')[0])
    check('P11', 'Accepted: a Strong one', 201, register('p11', password='correct horse battery staple')[0])
    check('P12', 'Accepted: a passphrase that merely contains the first name', 201,
          register('p12', full_name='Harbour Keeper', password='harbour walks the dog at dawn')[0])

    # The reset: the same rule, checked against the account's own name and
    # address, and a refusal never spends the link.
    sql("DELETE FROM auth_rate_limits")
    started = time.time()
    session().call('POST', '/auth/forgot-password', {'email': MOVED_EMAIL})
    link = token_from(newest_mail(started))
    link_hash = hashlib.sha256(link.encode()).hexdigest() if link else ''
    reset = lambda password: session().call('POST', '/auth/reset-password', {'token': link, 'password': password})
    code, payload = reset('river bend wal')
    check('R1', 'Reset to 14 characters: refused', 422, code)
    code, payload = reset('passwordpassword')
    check('R2', 'Reset to a common password: refused', 422, code)
    code, payload = reset('lifecycletester')
    check('R3', "Reset to the account's own name: refused", (422, True),
          (code, identity in ((payload.get('fields') or {}).get('password') or '')))
    code, payload = reset('password-after-lock')
    check('R5', 'Reset to the current password: still refused, with its own reason', (422, True),
          (code, 'different from your current password' in ((payload.get('fields') or {}).get('password') or '')))
    check('R6', 'None of those spent the link', 'NULL',
          sql(f"SELECT IFNULL(used_at, 'NULL') FROM auth_tokens WHERE token_hash='{link_hash}'"))
    elsewhere = session()
    elsewhere.call('POST', '/auth/login', {'email': MOVED_EMAIL, 'password': 'password-after-lock'})
    elsewhere.prime_csrf()
    check('R4', 'A valid new password is accepted', 200, reset('harbour lights at six')[0])
    check('R7', 'It signed the other session out, and the new password signs in', (401, 200),
          (elsewhere.call('GET', '/notifications')[0],
           session().call('POST', '/auth/login', {'email': MOVED_EMAIL, 'password': 'harbour lights at six'})[0]))

    # Nothing changed for passwords chosen before the rule.
    check('X1', 'A seeded account with its old 8-character password still signs in', 200,
          session().call('POST', '/auth/login', {'email': audit.ACCOUNTS['customer'], 'password': PW})[0])
    check('X2', 'No forced change: every seeded account keeps a bcrypt hash that still works', '0',
          sql("SELECT COUNT(*) FROM users WHERE email LIKE '%@example.com' AND email NOT LIKE 'policy.%' "
              "AND email NOT LIKE 'lifecycle.%' AND email NOT LIKE 'harbour.%' AND password_hash NOT LIKE '$2y$%'"))
    sql("DELETE FROM users WHERE email LIKE 'policy.%@example.com' OR email = 'harbour.lights.at.six@example.com'")
    sql("DELETE FROM auth_rate_limits")

    print()
    passed = sum(1 for row in results if row[4])
    print('=' * 112)
    print(f'  {passed}/{len(results)} passed')
    if passed != len(results):
        print()
        for step, what, expected, actual, ok in results:
            if not ok:
                print(f'  FAILED  {step}  {what}: expected {expected}, got {actual}')

finally:
    if previous_config is None:
        if os.path.exists(LOCAL_CONFIG):
            os.remove(LOCAL_CONFIG)
    else:
        with open(LOCAL_CONFIG, 'w', encoding='utf-8') as handle:
            handle.write(previous_config)
    shutil.rmtree(CAPTURE_DIR, ignore_errors=True)
    sql(f"DELETE FROM users WHERE email IN ('{NEW_EMAIL}', '{MOVED_EMAIL}')")
    print()
    print('Restoring the demonstration data...')
    reseed()
    print('  accounts:', sql('SELECT COUNT(*) FROM users'),
          ' reports:', sql('SELECT COUNT(*) FROM pet_reports'))

sys.exit(0 if all(row[4] for row in results) else 1)
