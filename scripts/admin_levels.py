"""
Paws&Found — administrator privilege levels (Correction 6).

    python scripts/admin_levels.py        (npm run test:admin-levels)

Against the local API and database; reseeds at the start and the end.

The seed has one administrator, Grace, a Super Administrator. The other
levels are made here, through the API, by her — which is itself under test:

    Rafael   staff -> Administrator, Moderator
    Kenneth  customer -> Administrator, Manager
    Patricia stays a Pet Coordinator; Maria and Liza stay customers

  CAP   what /auth/me tells each kind of account
  MOD   a Moderator, by direct API call: moderation yes, everything else no
  MAN   a Manager: accounts and categories yes, administrators and logs no
  SUP   a Super Administrator: roles, levels, administrators, logs
  OUT   coordinators, customers and guests still reach none of it
  BIZ   a Super Administrator cannot bypass the case workflow
  SA    never no active Super Administrator, including two at once
  SES   sessions: newest-login-wins at every level; a level change ends them
  AUD   the audit and activity trail of every privilege change

Stdlib only.
"""
import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit
from audit import reseed, sql

PW = audit.PW
SUPER = 'grace.bautista@example.com'
MODERATOR = 'rafael.mendoza@example.com'
MANAGER = 'kenneth.villanueva@example.com'
COORDINATOR = 'patricia.lim@example.com'
CUSTOMER = 'maria.santos@example.com'
CUSTOMER2 = 'liza.ocampo@example.com'
SPARE = 'aileen.reyes@example.com'     # promoted and demoted along the way

results = []


def check(step, what, expected, actual):
    ok = expected == actual
    results.append((step, what, expected, actual, ok))
    print(f'  {step:<8}{what:<70}{str(expected)[:20]:<21}{str(actual)[:20]:<21}{"PASS" if ok else "FAIL"}')


def banner(title):
    print()
    print(title)
    print('-' * 124)


def uid(email):
    return int(sql(f"SELECT user_id FROM users WHERE email = '{email}'"))


def device(email):
    s = audit.Session()
    s.prime_csrf()
    code, _ = s.call('POST', '/auth/login', {'email': email, 'password': PW})
    s.prime_csrf()
    assert code == 200, f'{email} could not sign in: {code}'
    return s


def me(s):
    _, payload = s.call('GET', '/auth/me')
    return payload.get('user') or {}, payload.get('session_ended')


def role_of(email):
    return sql(f"SELECT CONCAT(role, '/', IFNULL(admin_level, '-'), '/', account_status) FROM users WHERE email = '{email}'")


def active_supers():
    return int(sql("SELECT COUNT(*) FROM users WHERE role = 'admin' AND admin_level = 'super_admin' "
                   "AND account_status = 'active'"))


def code(s, method, path, body=None):
    return s.call(method, path, body)[0]


reseed()
sql('DELETE FROM auth_rate_limits')

try:
    # ================================================================= setup
    banner('Setup — the Super Administrator makes a Moderator and a Manager through the API')
    sa = device(SUPER)
    check('SET-1', 'Rafael (coordinator) -> Administrator, Moderator', 200,
          code(sa, 'PATCH', f'/users/{uid(MODERATOR)}', {'role': 'admin', 'admin_level': 'moderator'}))
    check('SET-2', 'Kenneth (customer) -> Administrator, Manager', 200,
          code(sa, 'PATCH', f'/users/{uid(MANAGER)}', {'role': 'admin', 'admin_level': 'manager'}))
    check('SET-3', 'The database holds role and level together', ('admin/moderator/active', 'admin/manager/active'),
          (role_of(MODERATOR), role_of(MANAGER)))
    mod = device(MODERATOR)
    man = device(MANAGER)
    staff = device(COORDINATOR)
    cust = device(CUSTOMER)

    # =================================================================== CAP
    banner('CAP — what /auth/me says each account may do')
    check('CAP-1', 'Moderator: moderate_reports only', ('moderator', ['moderate_reports']),
          (me(mod)[0].get('admin_level'), me(mod)[0].get('capabilities')))
    check('CAP-2', 'Manager: + manage_accounts, manage_reference_data',
          ['moderate_reports', 'manage_accounts', 'manage_reference_data'], me(man)[0].get('capabilities'))
    check('CAP-3', 'Super Administrator: + manage_admins, view_security_logs',
          ['moderate_reports', 'manage_accounts', 'manage_reference_data', 'manage_admins', 'view_security_logs'],
          me(sa)[0].get('capabilities'))
    check('CAP-4', 'A coordinator and a customer are sent no level and no capabilities', (False, False),
          ('capabilities' in me(staff)[0] or 'admin_level' in me(staff)[0],
           'capabilities' in me(cust)[0] or 'admin_level' in me(cust)[0]))

    # =================================================================== MOD
    banner('MOD — a Moderator, by direct API call')
    check('MOD-01', 'Logs: activity, sessions, security events -> 403', [403] * 3,
          [code(mod, 'GET', f'/logs/{k}') for k in ('activity', 'sessions', 'audit')])
    check('MOD-02', 'Suspend a customer -> 403', 403,
          code(mod, 'PATCH', f'/users/{uid(CUSTOMER)}', {'account_status': 'suspended', 'reason': 'test'}))
    check('MOD-03', 'Unlock (set active) an account -> 403', 403,
          code(mod, 'PATCH', f'/users/{uid(CUSTOMER)}', {'account_status': 'active'}))
    check('MOD-04', 'Promote a customer to Administrator -> 403', 403,
          code(mod, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'role': 'admin', 'admin_level': 'moderator'}))
    check('MOD-05', "Change the Manager's level -> 403", 403,
          code(mod, 'PATCH', f'/users/{uid(MANAGER)}', {'admin_level': 'moderator'}))
    check('MOD-06', 'Create, rename, delete a pet category -> 403', [403] * 3,
          [code(mod, 'POST', '/categories', {'label': 'Moderator Category'}),
           code(mod, 'PATCH', '/categories/dog', {'label': 'Doggo'}),
           code(mod, 'DELETE', '/categories/other')])
    check('MOD-07', 'The moderation queue -> 200', 200, code(mod, 'GET', '/moderation'))
    check('MOD-08', 'The account list: names, but no email or phone', (200, False, False),
          (lambda r: (r[0], any('email' in u for u in r[1]['data']), any('contact_number' in u for u in r[1]['data'])))(
              mod.call('GET', '/users')))
    check('MOD-09', "One account's details: no contact details either", False,
          'email' in mod.call('GET', f'/users/{uid(CUSTOMER)}')[1].get('data', {}))
    flagged = sql("SELECT case_id FROM moderation_cases WHERE case_status = 'open' ORDER BY case_id LIMIT 1")
    check('MOD-10', 'A moderation decision "suspend" (account management) -> 403', 403,
          code(mod, 'PATCH', f'/moderation/{flagged}', {'action': 'suspend', 'note': 'Fake listing.'}))
    check('MOD-11', 'The same case, decided "remove" -> 200; the report is Removed, not Closed',
          (200, 'removed'), (code(mod, 'PATCH', f'/moderation/{flagged}', {'action': 'remove', 'note': 'Fake listing.'}),
                             sql(f'SELECT r.publication_status FROM pet_reports r JOIN moderation_cases c '
                                 f'ON c.report_id = r.report_id WHERE c.case_id = {flagged}')))
    check('MOD-12', 'The audit row says which level decided it', True,
          '(by moderator)' in (sql(f"SELECT detail FROM audit_logs WHERE action = 'moderation_resolved' "
                                   f"AND target_id = {flagged} ORDER BY audit_id DESC LIMIT 1") or ''))
    published = int(sql("SELECT MIN(report_id) FROM pet_reports WHERE publication_status = 'published' AND status = 'active'"))
    check('MOD-13', 'Remove a published report from its page -> 200', 200,
          code(mod, 'PATCH', f'/reports/{published}/publication', {'action': 'remove', 'note': 'Moderator test.'}))

    # =================================================================== MAN
    banner('MAN — a Manager, by direct API call')
    check('MAN-01', 'Logs -> 403', [403] * 3, [code(man, 'GET', f'/logs/{k}') for k in ('activity', 'sessions', 'audit')])
    check('MAN-02', 'Suspend a customer -> 200', 200,
          code(man, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'account_status': 'suspended', 'reason': 'Manager test.'}))
    check('MAN-03', 'Reinstate them -> 200', (200, 'user/-/active'),
          (code(man, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'account_status': 'active'}), role_of(CUSTOMER2)))
    guesser = audit.Session()
    guesser.prime_csrf()
    for _ in range(3):
        guesser.call('POST', '/auth/login', {'email': CUSTOMER2, 'password': 'not the password at all'})
    check('MAN-04', 'Unlock a customer locked by three failures -> 200', ('user/-/locked', 200, 'user/-/active'),
          (lambda before: (before, code(man, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'account_status': 'active'}),
                           role_of(CUSTOMER2)))(role_of(CUSTOMER2)))
    check('MAN-05', 'Suspend and reinstate a Pet Coordinator -> 200, 200', [200, 200],
          [code(man, 'PATCH', f'/users/{uid(COORDINATOR)}', {'account_status': 'suspended', 'reason': 'Manager test.'}),
           code(man, 'PATCH', f'/users/{uid(COORDINATOR)}', {'account_status': 'active'})])
    check('MAN-06', 'Create a pet category, then delete it -> 201, 200', (201, 200),
          (code(man, 'POST', '/categories', {'label': 'Manager Test Hedgehog'}),
           code(man, 'DELETE', '/categories/manager-test-hedgehog')))
    check('MAN-07', 'The moderation queue -> 200', 200, code(man, 'GET', '/moderation'))
    check('MAN-08', 'Promote a customer to Administrator -> 403', 403,
          code(man, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'role': 'admin', 'admin_level': 'moderator'}))
    check('MAN-09', 'Make a customer a Pet Coordinator -> 403 (roles are the Super Administrator\'s)', 403,
          code(man, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'role': 'staff'}))
    check('MAN-10', "Change the Moderator's level -> 403", 403,
          code(man, 'PATCH', f'/users/{uid(MODERATOR)}', {'admin_level': 'manager'}))
    check('MAN-11', 'Suspend another administrator -> 403', 403,
          code(man, 'PATCH', f'/users/{uid(MODERATOR)}', {'account_status': 'suspended', 'reason': 'test'}))
    check('MAN-12', 'Suspend the Super Administrator -> 403', 403,
          code(man, 'PATCH', f'/users/{uid(SUPER)}', {'account_status': 'suspended', 'reason': 'test'}))
    check('MAN-13', 'Make themselves Super Administrator -> 422 (own account)', 422,
          code(man, 'PATCH', f'/users/{uid(MANAGER)}', {'admin_level': 'super_admin'}))
    check('MAN-14', 'The account list includes contact details', True,
          any('email' in u for u in man.call('GET', '/users')[1]['data']))
    check('MAN-15', 'Nothing above changed an administrator', ('admin/moderator/active', 'admin/super_admin/active'),
          (role_of(MODERATOR), role_of(SUPER)))

    # =================================================================== SUP
    banner('SUP — a Super Administrator')
    check('SUP-01', 'Logs -> 200', [200] * 3, [code(sa, 'GET', f'/logs/{k}') for k in ('activity', 'sessions', 'audit')])
    check('SUP-02', 'Promote to Administrator without a level -> 422', 422,
          code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'role': 'admin'}))
    bad = [code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'role': 'admin', 'admin_level': level})
           for level in ('god', 'root', '', 'SUPER_ADMIN')]
    check('SUP-03', 'Levels god, root, "", SUPER_ADMIN -> 422', [422] * 4, bad)
    check('SUP-04', 'role=user with admin_level=super_admin -> 422, nothing stored', (422, 'user/-/active'),
          (code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'role': 'user', 'admin_level': 'super_admin'}), role_of(SPARE)))
    check('SUP-05', 'A level on a customer without changing the role -> 422', 422,
          code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'admin_level': 'moderator'}))
    spare = device(SPARE)
    check('SUP-06', 'Promote a customer to Administrator, Moderator -> 200', (200, 'admin/moderator/active'),
          (code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'role': 'admin', 'admin_level': 'moderator'}), role_of(SPARE)))
    check('SUP-07', '...and their customer session ends: role_promoted', ('', 'role_promoted'),
          (lambda m: (m[0].get('role', ''), m[1]))(me(spare)))
    spare = device(SPARE)
    check('SUP-08', 'Change their level to Manager -> 200', (200, 'admin/manager/active'),
          (code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'admin_level': 'manager'}), role_of(SPARE)))
    check('SUP-09', '...and their session ends: privilege_changed', ('', 'privilege_changed'),
          (lambda m: (m[0].get('role', ''), m[1]))(me(spare)))
    spare = device(SPARE)
    check('SUP-10', 'Remove the Administrator role (-> Pet Coordinator) -> 200, level cleared', (200, 'staff/-/active'),
          (code(sa, 'PATCH', f'/users/{uid(SPARE)}', {'role': 'staff'}), role_of(SPARE)))
    check('SUP-11', '...and that session ends too: privilege_changed', 'privilege_changed', me(spare)[1])
    check('SUP-12', 'Suspend and reinstate another administrator (the Moderator) -> 200, 200', [200, 200],
          [code(sa, 'PATCH', f'/users/{uid(MODERATOR)}', {'account_status': 'suspended', 'reason': 'Super test.'}),
           code(sa, 'PATCH', f'/users/{uid(MODERATOR)}', {'account_status': 'active'})])
    check('SUP-13', 'Own level, own role, own status -> 422 each', [422] * 3,
          [code(sa, 'PATCH', f'/users/{uid(SUPER)}', {'admin_level': 'manager'}),
           code(sa, 'PATCH', f'/users/{uid(SUPER)}', {'role': 'staff'}),
           code(sa, 'PATCH', f'/users/{uid(SUPER)}', {'account_status': 'suspended', 'reason': 'x'})])
    mod = device(MODERATOR)

    # =================================================================== OUT
    banner('OUT — coordinators, customers and guests')
    guest = audit.Session()
    for label, s, expect in (('Coordinator', staff, 403), ('Customer', cust, 403), ('Guest', guest, 401)):
        check(f'OUT-{label[:3]}', f'{label}: logs, account changes, categories, moderation queue', [expect] * 5,
              [code(s, 'GET', '/logs/sessions'),
               code(s, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'role': 'admin', 'admin_level': 'super_admin'}),
               code(s, 'PATCH', f'/users/{uid(CUSTOMER2)}', {'account_status': 'suspended', 'reason': 'x'}),
               code(s, 'POST', '/categories', {'label': 'Outsider'}),
               code(s, 'GET', '/moderation')])
    check('OUT-5', 'Nobody outside Administration managed to change anything', ('user/-/active', 'admin/super_admin/active'),
          (role_of(CUSTOMER2), role_of(SUPER)))

    # =================================================================== BIZ
    banner('BIZ — a Super Administrator does not bypass the case workflow')
    owned = int(sql(f"SELECT MIN(report_id) FROM pet_reports WHERE user_id = {uid(CUSTOMER)} AND status = 'active' "
                    "AND publication_status = 'published'"))
    check('BIZ-1', "Edit a customer's report as if it were theirs -> 403", 403,
          code(sa, 'PUT', f'/reports/{owned}', {'description': 'Edited by an administrator pretending to own it.'}))
    rejected, _ = audit.file_report('customer2', publish=False, pet_name='Workflow Bypass Dog')
    audit.session('staff').call('PATCH', f'/reports/{rejected}/publication', {'action': 'reject', 'note': 'Needs a photo.'})
    check('BIZ-2', "Resubmit a customer's rejected report for them -> 403", 403,
          code(sa, 'PATCH', f'/reports/{rejected}/publication', {'action': 'resubmit'}))
    match = sql("SELECT match_id FROM match_claims WHERE match_status = 'under_review' ORDER BY match_id LIMIT 1") or \
        sql("SELECT match_id FROM match_claims ORDER BY match_id LIMIT 1")
    check('BIZ-3', "Answer a coordinator's question as one of the reporters -> 403", 403,
          code(sa, 'PATCH', f'/matches/{match}', {'action': 'provide_information', 'note': 'I am the owner, honestly.'}))
    check('BIZ-4', 'There is no endpoint that writes or deletes the audit log', [404, 404],
          [code(sa, 'DELETE', '/logs/audit'), code(sa, 'POST', '/logs/audit', {'action': 'login'})])

    # ==================================================================== SA
    banner('SA — never no active Super Administrator')
    check('SA-01', 'One active Super Administrator to begin with', 1, active_supers())
    check('SA-02', 'Demote them (only they could: own account) -> refused', 422,
          code(sa, 'PATCH', f'/users/{uid(SUPER)}', {'admin_level': 'manager'}))
    check('SA-03', 'Remove their Administrator role -> refused', 422,
          code(sa, 'PATCH', f'/users/{uid(SUPER)}', {'role': 'user'}))
    check('SA-04', 'Suspend them -> refused', 422,
          code(sa, 'PATCH', f'/users/{uid(SUPER)}', {'account_status': 'suspended', 'reason': 'x'}))
    # Counted now, before the Manager becomes a Super Administrator and makes
    # changes that are allowed (AUD-5).
    refused_changes = sql(f"SELECT COUNT(*) FROM audit_logs WHERE action IN ('admin_level_changed', 'role_changed') "
                          f"AND actor_user_id IN ({uid(MODERATOR)}, {uid(MANAGER)})")
    check('SA-05', 'Make the Manager a second Super Administrator -> 200', (200, 2),
          (code(sa, 'PATCH', f'/users/{uid(MANAGER)}', {'admin_level': 'super_admin'}), active_supers()))
    second = device(MANAGER)
    check('SA-06', 'The second demotes the first -> 200; one remains', (200, 1, 'admin/manager/active'),
          (code(second, 'PATCH', f'/users/{uid(SUPER)}', {'admin_level': 'manager'}), active_supers(), role_of(SUPER)))
    check('SA-07', 'The demoted one, signed in again, cannot demote the last -> 403', 403,
          code(device(SUPER), 'PATCH', f'/users/{uid(MANAGER)}', {'admin_level': 'manager'}))
    check('SA-07b', 'Nor can a Moderator by direct API -> 403; still one', (403, 1),
          (code(mod, 'PATCH', f'/users/{uid(MANAGER)}', {'role': 'user'}), active_supers()))
    check('SA-07c', 'Restore: the last Super Administrator makes Grace one again -> 200', (200, 2),
          (code(second, 'PATCH', f'/users/{uid(SUPER)}', {'admin_level': 'super_admin'}), active_supers()))

    # Two Super Administrators demote each other at the same moment, ten times.
    outcomes = []
    for round_ in range(10):
        a, b = device(SUPER), device(MANAGER)
        barrier = threading.Barrier(2)
        got = {}

        def demote(name, s, target):
            barrier.wait()
            got[name] = code(s, 'PATCH', f'/users/{uid(target)}', {'admin_level': 'manager'})

        threads = [threading.Thread(target=demote, args=('a', a, MANAGER)),
                   threading.Thread(target=demote, args=('b', b, SUPER))]
        for th in threads:
            th.start()
        for th in threads:
            th.join()
        # The loser is refused either way: 403 if it reached the lock after the
        # winner committed (no longer a Super Administrator), or 401 if its
        # session had already been ended by that demotion (privilege_changed).
        verdict = sorted(('refused' if c in (401, 403) else c for c in got.values()), key=str)
        outcomes.append((verdict, active_supers()))
        # Back to two Super Administrators for the next round.
        survivor = SUPER if role_of(SUPER).startswith('admin/super_admin') else MANAGER
        other = MANAGER if survivor == SUPER else SUPER
        if role_of(other) != 'admin/super_admin/active':
            code(device(survivor), 'PATCH', f'/users/{uid(other)}', {'admin_level': 'super_admin'})
    check('SA-08', 'Ten rounds of two simultaneous cross-demotions: one wins, one refused, one remains',
          [([200, 'refused'], 1)] * 10, [(sorted(v, key=str), n) for v, n in outcomes])
    check('SA-08b', 'No round ended with a server error (no deadlock surfaced)', True,
          all(500 not in o[0] and 0 not in o[0] for o in outcomes))

    # =================================================================== SES
    banner('SES — sessions at every level')
    code(device(SUPER), 'PATCH', f'/users/{uid(MANAGER)}', {'admin_level': 'manager'})
    for step, email, level in (('SES-1', MODERATOR, 'moderator'), ('SES-2', MANAGER, 'manager'), ('SES-3', SUPER, 'super_admin')):
        first = device(email)
        first_rid = int(sql(f'SELECT MAX(session_record_id) FROM user_sessions WHERE user_id = {uid(email)}'))
        second = device(email)
        check(step, f'{level}: signs in with a session record; a second sign-in ends the first',
              ('signed out', 'new_privileged_login', 'admin'),
              (me(first)[0].get('role') or 'signed out',
               sql(f'SELECT end_reason FROM user_sessions WHERE session_record_id = {first_rid}'),
               me(second)[0].get('role')))
    phone, laptop = device(CUSTOMER), device(CUSTOMER)
    check('SES-4', 'A customer on two devices: both still signed in', ('user', 'user'),
          (me(phone)[0].get('role'), me(laptop)[0].get('role')))
    sa = device(SUPER)
    target = device(MODERATOR)
    code(sa, 'PATCH', f'/users/{uid(MODERATOR)}', {'admin_level': 'manager'})
    check('SES-5', 'A level change ends the target\'s session (privilege_changed), not the actor\'s',
          ('privilege_changed', 'admin'), (me(target)[1], me(sa)[0].get('role')))
    check('SES-6', 'Its record says so', 'privilege_changed',
          sql(f'SELECT end_reason FROM user_sessions WHERE user_id = {uid(MODERATOR)} ORDER BY session_record_id DESC LIMIT 1'))

    # =================================================================== AUD
    banner('AUD — the audit and activity trail of privilege changes')
    row = sql(f"SELECT actor_user_id, target_id, detail, ip_address IS NOT NULL FROM audit_logs "
              f"WHERE action = 'admin_level_changed' AND target_id = {uid(MODERATOR)} ORDER BY audit_id DESC LIMIT 1")
    check('AUD-1', 'admin_level_changed: actor, target, old -> new, IP', f'{uid(SUPER)}\t{uid(MODERATOR)}\tmoderator -> manager\t1', row)
    check('AUD-2', 'role_changed carries the levels: "customer -> admin (manager)" style', 'user -> admin (manager)',
          sql(f"SELECT detail FROM audit_logs WHERE action = 'role_changed' AND target_id = {uid(MANAGER)} "
              'ORDER BY audit_id LIMIT 1'))
    check('AUD-3', 'Removing the role is recorded with the level it took away', 'admin (manager) -> staff',
          sql(f"SELECT detail FROM audit_logs WHERE action = 'role_changed' AND target_id = {uid(SPARE)} "
              'ORDER BY audit_id DESC LIMIT 1'))
    check('AUD-4', 'The activity trail has the same change, on the actor\'s session', ('moderator -> manager', '1'),
          tuple(sql(f"SELECT a.detail, a.session_record_id = (SELECT MAX(session_record_id) FROM user_sessions "
                    f"WHERE user_id = {uid(SUPER)}) FROM user_activity_logs a WHERE a.action = 'admin_level_changed' "
                    f"AND a.target_id = {uid(MODERATOR)} ORDER BY a.activity_id DESC LIMIT 1").split('\t')))
    check('AUD-5', 'Refused attempts changed nobody: no role or level change by a Moderator or Manager', '0',
          refused_changes)
finally:
    passed = sum(1 for row in results if row[4])
    print()
    print('=' * 124)
    print(f'  {passed}/{len(results)} passed')
    for step, what, expected, actual, ok in results:
        if not ok:
            print(f'  FAILED  {step}  {what}: expected {expected}, got {actual}')
    print()
    print('Restoring the demonstration data...')
    reseed()

sys.exit(0 if results and all(row[4] for row in results) else 1)
