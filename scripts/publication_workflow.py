"""
Correction 4 through the API: reviewed publication, drafts, and Removed apart
from Closed.

    python scripts/publication_workflow.py        (npm run test:publication)

  PUB    the publication state machine, and who may move it
  VIS    who may see a report that is not published (direct URLs and lists)
  MATCH  matching only once a report is published (MATCH-PUB-1..9)
  DR     drafts: saved to MySQL, private, validated loosely, submitted strictly
  RM     removal: not public, not Closed, not matched, kept with its history
  NT     notifications for each publication decision, none for a draft
  CNT    dashboards count published reports
  LEG    what migration 010 did to the reports that already existed

Local only: it files reports and decides them, then restores the
demonstration data. Never point it at the hosted site.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import check, file_report, reseed, results, session, sql  # noqa: E402

DOG = dict(species='dog', breed='Beagle', size='medium', sex='male', primary_color='Brown',
           distinct_features='Notched left ear, white tail tip')


def call(role, method, path, body=None):
    return session(role).call(method, path, body)


def publication(rid):
    return sql(f'SELECT publication_status FROM pet_reports WHERE report_id = {rid};')


def decide(role, rid, action, note=None):
    return call(role, 'PATCH', f'/reports/{rid}/publication', {'action': action, 'note': note})


def pairings(rid):
    return sql(f'SELECT COUNT(*) FROM match_claims WHERE lost_report_id = {rid} OR found_report_id = {rid};')


def lost_and_found(city, publish_lost=True, publish_found=True):
    """A lost dog and a found dog that match each other perfectly, in a place of their own."""
    lost, _ = file_report('customer', publish=publish_lost, incident_date='2026-09-20', city=city, **DOG)
    found, _ = file_report('finder', publish=publish_found, report_type='found', pet_name=None,
                           incident_date='2026-09-21', city=city, **DOG)
    return lost, found


# ====================================================================== PUB
def state_machine():
    C = 'PUB. The publication state machine'
    rid, code = file_report('customer', publish=False, publication_status='published', status='returned')
    check(C, 'PUB-1', 'A filed report waits for review — a crafted "published" in the request is ignored',
          '200 pending_review/active', f"{code} {publication(rid)}/{sql(f'SELECT status FROM pet_reports WHERE report_id = {rid};')}",
          code == 200 and publication(rid) == 'pending_review'
          and sql(f'SELECT status FROM pet_reports WHERE report_id = {rid};') == 'active')
    check(C, 'PUB-2', '...its publication history starts with the submission, by the reporter', 'submitted by owner',
          sql(f'SELECT CONCAT(IFNULL(previous_state, "-"), ">", new_state) FROM publication_logs WHERE report_id = {rid};'),
          sql(f'SELECT CONCAT(IFNULL(previous_state, "-"), ">", new_state, ":", actor_user_id = (SELECT user_id FROM pet_reports WHERE report_id = {rid})) '
              f'FROM publication_logs WHERE report_id = {rid};') == '->pending_review:1')
    check(C, 'PUB-3', '...and its case history has not started (no status_logs row yet)', 0,
          sql(f'SELECT COUNT(*) FROM status_logs WHERE report_id = {rid};'),
          sql(f'SELECT COUNT(*) FROM status_logs WHERE report_id = {rid};') == '0')

    code, _ = decide('customer', rid, 'approve')
    code2, _ = decide('customer2', rid, 'approve')
    check(C, 'PUB-4', 'A customer cannot approve: their own 403; another\'s 404 (they cannot see it)', '403, 404',
          f'{code}, {code2}', code == 403 and code2 == 404)
    code, _ = call('customer', 'PATCH', f'/reports/{rid}', {'status': 'returned'})
    check(C, 'PUB-5', 'A report waiting for review has no case to mark returned or closed', 409, code, code == 409)
    code, _ = call('customer', 'PUT', f'/reports/{rid}', {'sex': 'female'})
    check(C, 'PUB-6', 'Waiting for review, the reporter cannot change it', 409, code, code == 409)

    staff = sql("SELECT user_id FROM users WHERE email = 'patricia.lim@example.com';")
    code, _ = call('staff', 'PATCH', f'/reports/{rid}/publication',
                   {'action': 'approve', 'actor_user_id': 1, 'reviewer_id': 1})
    actor = sql(f"SELECT actor_user_id FROM publication_logs WHERE report_id = {rid} AND new_state = 'published';")
    check(C, 'PUB-7', 'A coordinator approves; the reviewer is the session, never the request', f'200, actor {staff}',
          f'{code}, actor {actor}', code == 200 and actor == staff and publication(rid) == 'published')
    check(C, 'PUB-8', '...and the case history starts: "Published after review."', 'Published after review.',
          sql(f'SELECT note FROM status_logs WHERE report_id = {rid};'),
          sql(f'SELECT note FROM status_logs WHERE report_id = {rid};') == 'Published after review.')
    code, body = decide('staff', rid, 'approve')
    check(C, 'PUB-9', 'Approving it again is refused, naming the state it is in', '409 published',
          f"{code} {body.get('publication_status')}", code == 409 and body.get('publication_status') == 'published')

    own, _ = file_report('staff', publish=False)
    code, _ = decide('staff', own, 'approve')
    check(C, 'PUB-10', 'A coordinator cannot review a report they filed themselves', 403, code, code == 403)
    code, _ = decide('admin', own, 'approve')
    code2, _ = decide('staff2', own, 'approve')
    check(C, 'PUB-11', '...nor can an administrator (403, Correction 6A); another coordinator can', '403, 200',
          f'{code}, {code2}', code == 403 and code2 == 200)

    bad, _ = file_report('customer', publish=False)
    code, _ = decide('staff', bad, 'reject')
    code2, _ = decide('staff', bad, 'reject', '   ')
    check(C, 'PUB-12', 'A rejection needs a reason', '422, 422', f'{code}, {code2}', code == 422 and code2 == 422)
    code, _ = decide('staff', bad, 'reject', 'The photo shows a cat, but the report says dog. Please check.')
    check(C, 'PUB-13', 'With a reason it is not approved: rejected, not public', '200 rejected',
          f'{code} {publication(bad)}', code == 200 and publication(bad) == 'rejected')
    code, _ = decide('customer2', bad, 'resubmit')
    check(C, 'PUB-14', 'Only its reporter can submit it again', 404, code, code == 404)
    code, _ = call('customer', 'PUT', f'/reports/{bad}', {'description': 'Corrected after review: a brown dog, as the photo shows.'})
    check(C, 'PUB-15', 'The reporter can edit a report that was not approved', 200, code, code == 200)
    code, _ = decide('customer', bad, 'resubmit')
    history = sql(f'SELECT GROUP_CONCAT(new_state ORDER BY log_id) FROM publication_logs WHERE report_id = {bad};')
    check(C, 'PUB-16', '...and submit it again; the rejection stays in its history',
          'pending_review,rejected,pending_review', f'{code} {history}',
          code == 200 and history == 'pending_review,rejected,pending_review')
    code, _ = decide('customer', bad, 'resubmit')
    check(C, 'PUB-17', 'Resubmitting while it waits for review is refused', 409, code, code == 409)
    code, _ = decide('staff', rid, 'cancel')
    code2, _ = decide('staff', rid, 'publish')
    check(C, 'PUB-18', 'There is no "cancel" or other invented decision: unknown actions are refused',
          '422, 422', f'{code}, {code2}', code == 422 and code2 == 422)


# ====================================================================== VIS
def visibility():
    C = 'VIS. Who may see an unpublished report'
    pending, _ = file_report('customer', publish=False)
    rejected, _ = file_report('customer', publish=False)
    decide('staff', rejected, 'reject', 'Not enough detail to identify the pet.')

    for tid, rid, label in (('VIS-1', pending, 'waiting for review'), ('VIS-2', rejected, 'not approved')):
        codes = {role: call(role, 'GET', f'/reports/{rid}')[0] for role in ('guest', 'finder', 'customer', 'staff', 'admin')}
        check(C, tid, f'A report {label}: guest and other member 404; reporter, coordinator, admin 200',
              'guest404 finder404 customer200 staff200 admin200',
              ' '.join(f'{k}{v}' for k, v in codes.items()),
              codes == {'guest': 404, 'finder': 404, 'customer': 200, 'staff': 200, 'admin': 200})

    _, rows = call('guest', 'GET', '/reports?per_page=50&sort=newest')
    ids = {r['report_id'] for r in rows.get('data') or []}
    check(C, 'VIS-3', 'The public list never carries them', 'absent', 'present' if ids & {pending, rejected} else 'absent',
          not (ids & {pending, rejected}))
    _, rows = call('finder', 'GET', '/reports?per_page=50&q=Audit')
    ids = {r['report_id'] for r in rows.get('data') or []}
    check(C, 'VIS-4', 'Nor does a signed-in member\'s search', 'absent', 'present' if ids & {pending, rejected} else 'absent',
          not (ids & {pending, rejected}))
    codes = [call('guest', 'GET', '/reports?publication=pending_review')[0],
             call('finder', 'GET', '/reports?publication=all')[0],
             call('finder', 'GET', f"/reports?publication=all&reporter_id={sql('SELECT user_id FROM users WHERE email = \"maria.santos@example.com\";')}")[0]]
    check(C, 'VIS-5', 'Asking for unpublished reports: guest 401, a member 403 — even naming another reporter',
          '401, 403, 403', ', '.join(map(str, codes)), codes == [401, 403, 403])
    maria = sql("SELECT user_id FROM users WHERE email = 'maria.santos@example.com';")
    _, own = call('customer', 'GET', f'/reports?publication=all&reporter_id={maria}&per_page=50')
    own_ids = {r['report_id'] for r in own.get('data') or []}
    check(C, 'VIS-6', 'The reporter lists their own, whatever the state', 'both present',
          'both present' if {pending, rejected} <= own_ids else 'missing', {pending, rejected} <= own_ids)
    _, queue = call('staff', 'GET', '/reports?publication=pending_review&per_page=50')
    queue_rows = queue.get('data') or []
    check(C, 'VIS-7', 'A coordinator\'s review queue: pending only, and this one in it', 'pending only',
          ','.join(sorted({r['publication_status'] for r in queue_rows})),
          pending in {r['report_id'] for r in queue_rows}
          and {r['publication_status'] for r in queue_rows} == {'pending_review'})
    code, _ = call('finder', 'POST', '/moderation', {'report_id': pending, 'reason': 'spam',
                                                     'details': 'Looks like spam to me.'})
    check(C, 'VIS-8', 'Nobody can flag a report they cannot see', 404, code, code == 404)


# ====================================================================== MATCH-PUB
def matching():
    C = 'MATCH. Matching starts at publication'
    before = sql('SELECT COUNT(*) FROM match_claims;')
    code, draft = call('customer', 'POST', '/drafts', {'report_type': 'lost', 'pet_name': 'Draft Dog', 'species': 'dog',
                                                      'breed': 'Shih Tzu', 'primary_color': 'Brown', 'size': 'small'})
    check(C, 'MATCH-PUB-1', 'A draft is compared with nothing', f'201, {before} pairings',
          f"{code}, {sql('SELECT COUNT(*) FROM match_claims;')} pairings",
          code == 201 and sql('SELECT COUNT(*) FROM match_claims;') == before)

    lost, found = lost_and_found('Audit Publication Match City', publish_lost=True, publish_found=False)
    check(C, 'MATCH-PUB-2', 'A perfect partner waiting for review is not paired', 0, pairings(found), pairings(found) == '0')
    decide('staff', found, 'reject', 'Please add where exactly you found the dog.')
    check(C, 'MATCH-PUB-3', '...nor once it is not approved', 0, pairings(found), pairings(found) == '0')
    call('finder', 'PUT', f'/reports/{found}', {'location_label': 'Outside the barangay hall, by the gate'})
    check(C, 'MATCH-PUB-3b', '...nor when its reporter edits it (an edit before review compares nothing)', 0,
          pairings(found), pairings(found) == '0')
    decide('finder', found, 'resubmit')
    decide('staff', found, 'approve')
    score = sql(f'SELECT match_score FROM match_claims WHERE lost_report_id = {lost} AND found_report_id = {found};')
    check(C, 'MATCH-PUB-5', 'Approval triggers matching: the pair appears at once', 'a pairing', score or 'NONE', bool(score))

    # A found report exactly like seeded report 2, approved: it pairs with
    # report 1 at the score the demonstration has always shown for 1/2.
    _, two = call('staff', 'GET', '/reports/2')
    r2 = two.get('data') or {}
    twin, _ = file_report('finder', publish=False, report_type='found', pet_name=None, species=r2.get('species'),
                          breed=r2.get('breed'), size=r2.get('size'), sex=r2.get('sex'),
                          primary_color=r2.get('primary_color'), secondary_color=r2.get('secondary_color'),
                          distinct_features=r2.get('distinct_features'), incident_date=r2.get('incident_date'),
                          area_code=r2['location']['area_code'], city_code=r2['location']['city_code'],
                          lat=r2['location']['lat'], lng=r2['location']['lng'])
    check(C, 'MATCH-PUB-6a', '(report 2\'s twin, waiting: not paired with report 1)', 'none',
          sql(f'SELECT match_score FROM match_claims WHERE lost_report_id = 1 AND found_report_id = {twin};') or 'none',
          not sql(f'SELECT match_score FROM match_claims WHERE lost_report_id = 1 AND found_report_id = {twin};'))
    decide('staff', twin, 'approve')
    twin_score = sql(f'SELECT match_score FROM match_claims WHERE lost_report_id = 1 AND found_report_id = {twin};')
    check(C, 'MATCH-PUB-6', 'Approved, report 2\'s twin pairs with report 1 at 85 — the demonstration\'s own score',
          85, twin_score, twin_score == '85')

    alone, _ = file_report('customer', city='Audit Publication Rematch City', species='cat', breed='Persian',
                           size='medium', sex='female', primary_color='White', distinct_features='Blue eyes')
    partner, _ = file_report('finder', report_type='found', pet_name=None, city='Audit Publication Rematch City', **DOG)
    code, _ = call('customer', 'PUT', f'/reports/{alone}', DOG)
    check(C, 'MATCH-PUB-7', 'A published report, edited to match, is compared again at once', 'a pairing',
          sql(f'SELECT match_score FROM match_claims WHERE lost_report_id = {alone} AND found_report_id = {partner};') or 'NONE',
          code == 200 and bool(sql(f'SELECT match_score FROM match_claims WHERE lost_report_id = {alone} AND found_report_id = {partner};')))
    code, _ = call('customer', 'PUT', f'/reports/{alone}', {'sex': 'female'})
    check(C, 'MATCH-PUB-8', 'With that pairing open, the report is frozen (existing protection)', 409, code, code == 409)

    m = sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {alone} AND found_report_id = {partner};')
    flag_code, flag = call('finder', 'POST', '/moderation', {'report_id': alone, 'reason': 'false_report',
                                                            'details': 'Audit: this report is not genuine.'})
    case = (flag.get('data') or {}).get('case_id')
    code, _ = call('admin', 'PATCH', f'/moderation/{case}', {'action': 'remove', 'note': 'Audit: removed to test matching.'})
    state = sql(f"SELECT CONCAT((SELECT match_status FROM match_claims WHERE match_id = {m}), '/', "
                f"(SELECT status FROM pet_reports WHERE report_id = {partner}))")
    check(C, 'MATCH-PUB-9', 'Removing a report withdraws its open pairing; the partner is Active again',
          'dismissed/active', state, flag_code == 201 and code == 200 and state == 'dismissed/active')
    newcomer, _ = file_report('finder', report_type='found', pet_name=None, city='Audit Publication Rematch City', **DOG)
    check(C, 'MATCH-PUB-4', 'A removed report is never paired again, even with a perfect newcomer', 'none',
          sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {alone} AND found_report_id = {newcomer};') or 'none',
          not sql(f'SELECT match_id FROM match_claims WHERE lost_report_id = {alone} AND found_report_id = {newcomer};'))
    return (draft.get('data') or {}).get('draft_id')


# ====================================================================== DR
def drafts():
    C = 'DR. Drafts'
    code, body = call('customer', 'POST', '/drafts', {'report_type': 'lost', 'pet_name': 'A', 'species': 'dog',
                                                     'description': 'Ran off'})
    draft = (body.get('data') or {}).get('draft_id')
    check(C, 'DR-1', 'A draft saves with almost nothing — even a name and a description too short to submit',
          201, code, code == 201 and bool(draft))
    check(C, 'DR-2', '...into report_drafts, not pet_reports', 'draft row, no report',
          sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {draft};'),
          sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {draft};') == '1')
    bad = [call('customer', 'PUT', f'/drafts/{draft}', b)[0] for b in (
        {'primary_color': 'Mauve'}, {'incident_date': '2099-01-01'}, {'area_code': '0702200000', 'city_code': '1380300000'},
        {'size': 'enormous'}, {'lat': 35.6, 'lng': 139.7}, {'pet_name': 'x' * 41})]
    check(C, 'DR-3', 'What a draft does hold must be real: colour, date, place, size, pin, length', 'all 422',
          ','.join(map(str, bad)), all(c == 422 for c in bad))
    codes = [call(r, m, f'/drafts/{draft}', b)[0] for r, m, b in
             (('finder', 'GET', None), ('finder', 'PUT', {'pet_name': 'Stolen'}), ('finder', 'DELETE', None),
              ('staff', 'GET', None), ('admin', 'GET', None), ('guest', 'GET', None))]
    check(C, 'DR-4', 'Nobody else can read, change or delete it — coordinators and administrators included',
          '404 x5, guest 401', ','.join(map(str, codes)), codes == [404, 404, 404, 404, 404, 401])
    _, rows = call('staff', 'GET', '/reports?publication=all&per_page=50&q=Ran')
    check(C, 'DR-5', 'A draft is in no report list', 'absent',
          'present' if any(r.get('pet_name') == 'A' for r in rows.get('data') or []) else 'absent',
          not any(r.get('pet_name') == 'A' for r in rows.get('data') or []))
    notes = sql('SELECT COUNT(*) FROM notifications;')
    call('customer', 'PUT', f'/drafts/{draft}', {'pet_name': 'Bo', 'species': 'dog', 'breed': 'Beagle'})
    check(C, 'DR-6', 'Saving a draft notifies nobody', notes, sql('SELECT COUNT(*) FROM notifications;'),
          sql('SELECT COUNT(*) FROM notifications;') == notes)
    rid, code = file_report('customer', publish=False, draft_id=draft, description='Ran')
    check(C, 'DR-7', 'Submitting an incomplete draft is refused by the full rules, and the draft is kept',
          '422, kept', f"{code}, {'kept' if sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {draft};') == '1' else 'gone'}",
          code == 422 and sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {draft};') == '1')
    rid, code = file_report('finder', publish=False, draft_id=draft)
    check(C, 'DR-8', 'Somebody else cannot submit it', 404, code, code == 404)
    rid, code = file_report('customer', publish=False, draft_id=draft)
    check(C, 'DR-9', 'Submitted complete: a report waiting for review, and the draft is gone',
          '200 pending_review, gone', f"{code} {publication(rid)}, {sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {draft};')}",
          code == 200 and publication(rid) == 'pending_review'
          and sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {draft};') == '0')
    code, body = call('customer', 'POST', '/drafts', {'report_type': 'found'})
    other = (body.get('data') or {}).get('draft_id')
    reports_before = sql('SELECT COUNT(*) FROM pet_reports;')
    code, _ = call('customer', 'DELETE', f'/drafts/{other}')
    check(C, 'DR-10', 'Deleting a draft deletes it, and closes nothing', 'gone, no report, no history',
          f"{code} {sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {other};')} {sql('SELECT COUNT(*) FROM pet_reports;')}",
          code == 200 and sql(f'SELECT COUNT(*) FROM report_drafts WHERE draft_id = {other};') == '0'
          and sql('SELECT COUNT(*) FROM pet_reports;') == reports_before)
    code, _ = call('customer', 'POST', '/drafts', {'report_type': 'adopted'})
    check(C, 'DR-11', 'A draft must still say lost or found', 422, code, code == 422)


# ====================================================================== RM
def removal():
    C = 'RM. Removed is not Closed'
    rid, _ = file_report('customer', city='Audit Removal City')
    _, rows = call('guest', 'GET', '/reports?per_page=50')
    check(C, 'RM1', 'A published report is public', 'listed', 'listed' if rid in {r['report_id'] for r in rows.get('data') or []} else 'absent',
          rid in {r['report_id'] for r in rows.get('data') or []})
    code, _ = decide('staff', rid, 'remove', 'Staff should not be able to.')
    code2, _ = decide('admin', rid, 'remove')
    check(C, 'RM2a', 'Removal is an administrator\'s, and needs a reason', '403, 422', f'{code}, {code2}',
          code == 403 and code2 == 422)
    before = sql(f'SELECT status FROM pet_reports WHERE report_id = {rid};')
    code, _ = decide('admin', rid, 'remove', 'Duplicate of another report.')
    check(C, 'RM2', 'An administrator removes it', '200 removed', f'{code} {publication(rid)}',
          code == 200 and publication(rid) == 'removed')
    _, rows = call('guest', 'GET', '/reports?per_page=50')
    check(C, 'RM3', 'It is no longer public', 'absent', 'present' if rid in {r['report_id'] for r in rows.get('data') or []} else 'absent',
          rid not in {r['report_id'] for r in rows.get('data') or []})
    after = sql(f'SELECT status FROM pet_reports WHERE report_id = {rid};')
    _, closed = call('customer', 'GET', '/reports?status=closed&per_page=50')
    check(C, 'RM4', 'It is not Closed: its case status is unchanged, and no Closed list holds it',
          f'{before}, not in Closed', f"{after}, {'in Closed' if rid in {r['report_id'] for r in closed.get('data') or []} else 'not in Closed'}",
          after == before and rid not in {r['report_id'] for r in closed.get('data') or []})
    _, own = call('customer', 'GET', f'/reports/{rid}')
    data = own.get('data') or {}
    note = next((e.get('note') for e in data.get('publication_history') or [] if e.get('new_state') == 'removed'), None)
    check(C, 'RM5', 'Its reporter sees it removed, and why', 'removed: Duplicate of another report.',
          f"{data.get('publication_status')}: {note}",
          data.get('publication_status') == 'removed' and note == 'Duplicate of another report.')
    codes = [call(r, 'GET', f'/reports/{rid}')[0] for r in ('guest', 'finder')]
    check(C, 'RM8', 'Its URL answers 404 to the public and to other members', '404, 404', ', '.join(map(str, codes)),
          codes == [404, 404])
    codes = [call(r, 'GET', f'/reports/{rid}')[0] for r in ('staff', 'admin')]
    check(C, 'RM9', 'Coordinators and administrators can still open the record', '200, 200', ', '.join(map(str, codes)),
          codes == [200, 200])
    logged = sql(f"SELECT CONCAT(previous_state, '>', new_state, ':', note) FROM publication_logs "
                 f"WHERE report_id = {rid} AND new_state = 'removed';")
    audited = sql(f"SELECT COUNT(*) FROM audit_logs WHERE action = 'report_removed' AND target_id = {rid};")
    check(C, 'RM7', 'The removal is kept: publication history and the audit log', 'logged, audited',
          f'{logged}; audit {audited}', logged == 'published>removed:Duplicate of another report.' and audited == '1')
    check(C, 'RM10', 'No Closed event is invented', 0,
          sql(f"SELECT COUNT(*) FROM status_logs WHERE report_id = {rid} AND new_status = 'closed';"),
          sql(f"SELECT COUNT(*) FROM status_logs WHERE report_id = {rid} AND new_status = 'closed';") == '0')
    codes = [decide('customer', rid, 'resubmit')[0], decide('staff', rid, 'approve')[0],
             call('customer', 'PUT', f'/reports/{rid}', {'sex': 'female'})[0],
             call('customer', 'PATCH', f'/reports/{rid}', {'status': 'closed', 'note': 'Trying to close it.'})[0]]
    check(C, 'RM11', 'Nobody turns it back: resubmit, approve, edit and close are all refused',
          '409 x4', ','.join(map(str, codes)), codes == [409, 409, 409, 409])
    code, _ = decide('admin', rid, 'remove', 'Again.')
    check(C, 'RM12', 'Removing it twice is refused', 409, code, code == 409)


# ====================================================================== NT
def notifications():
    C = 'NT. Notifications'
    maria = sql("SELECT user_id FROM users WHERE email = 'maria.santos@example.com';")

    def latest(rid):
        return sql(f"SELECT CONCAT(notification_type, '|', IFNULL(body, '')) FROM notifications "
                   f"WHERE user_id = {maria} AND report_id = {rid} ORDER BY notification_id DESC LIMIT 1;")
    rid, _ = file_report('customer', publish=False)
    check(C, 'NT-1', 'Submitting tells the reporter it is waiting for review', 'report_submitted',
          (latest(rid) or '').split('|')[0], (latest(rid) or '').startswith('report_submitted|'))
    decide('staff', rid, 'approve')
    check(C, 'NT-2', 'Approval tells the reporter it is published', 'report_published',
          (latest(rid) or '').split('|')[0], (latest(rid) or '').startswith('report_published|'))
    other, _ = file_report('customer', publish=False)
    decide('staff', other, 'reject', 'Please add a photo of the whole dog.')
    check(C, 'NT-3', 'A rejection tells the reporter why', 'report_rejected|Please add a photo of the whole dog.',
          latest(other), latest(other) == 'report_rejected|Please add a photo of the whole dog.')
    decide('admin', rid, 'remove', 'Reported as a scam; removed after review.')
    check(C, 'NT-4', 'A removal tells the reporter why', 'report_removed|Reported as a scam; removed after review.',
          latest(rid), latest(rid) == 'report_removed|Reported as a scam; removed after review.')


# ====================================================================== CNT
def counts():
    C = 'CNT. Dashboards count published reports'
    _, before = call('staff', 'GET', '/reports/stats')
    file_report('customer', publish=False)
    _, after = call('staff', 'GET', '/reports/stats')
    b, a = before.get('data') or {}, after.get('data') or {}
    check(C, 'CNT-1', 'A report waiting for review is not counted as Active, Lost or a monthly report',
          'unchanged', 'unchanged' if (a.get('totals'), a.get('monthly'), a.get('by_species')) == (b.get('totals'), b.get('monthly'), b.get('by_species')) else 'changed',
          (a.get('totals'), a.get('monthly'), a.get('by_species')) == (b.get('totals'), b.get('monthly'), b.get('by_species')))
    check(C, 'CNT-2', '...it is counted, separately, as waiting for review', '+1',
          f"{(b.get('publication') or {}).get('pending_review')} -> {(a.get('publication') or {}).get('pending_review')}",
          (a.get('publication') or {}).get('pending_review') == (b.get('publication') or {}).get('pending_review', 0) + 1)
    code, _ = call('customer', 'GET', '/reports/stats')
    check(C, 'CNT-3', 'The figures stay coordinators\' and administrators\'', 403, code, code == 403)


# ====================================================================== LEG
def legacy():
    C = 'LEG. Reports that existed before review'
    check(C, 'LEG-1', 'Seeded report 9, removed by moderation, is Removed — and its case was never Closed',
          'removed/active, 0 closed entries',
          f"{publication(9)}/{sql('SELECT status FROM pet_reports WHERE report_id = 9;')}, "
          f"{sql(chr(83) + 'ELECT COUNT(*) FROM status_logs WHERE report_id = 9 AND new_status = ' + repr('closed') + ';')} closed entries",
          publication(9) == 'removed' and sql('SELECT status FROM pet_reports WHERE report_id = 9;') == 'active'
          and sql("SELECT COUNT(*) FROM status_logs WHERE report_id = 9 AND new_status = 'closed';") == '0')
    check(C, 'LEG-2', 'The other 31 are published, with no approval invented for them', '31 published, 1 log row',
          f"{sql(chr(83) + 'ELECT COUNT(*) FROM pet_reports WHERE report_id <= 32 AND publication_status = ' + repr('published') + ';')} published, "
          f"{sql('SELECT COUNT(*) FROM publication_logs WHERE report_id <= 32;')} log row",
          sql("SELECT COUNT(*) FROM pet_reports WHERE report_id <= 32 AND publication_status = 'published';") == '31'
          and sql('SELECT COUNT(*) FROM publication_logs WHERE report_id <= 32;') == '1')
    check(C, 'LEG-3', 'Reports closed by their reporters (8, 14) stay Closed and published', 'closed/published x2',
          sql("SELECT GROUP_CONCAT(CONCAT(status, '/', publication_status) ORDER BY report_id) FROM pet_reports WHERE report_id IN (8, 14);"),
          sql("SELECT GROUP_CONCAT(CONCAT(status, '/', publication_status) ORDER BY report_id) FROM pet_reports WHERE report_id IN (8, 14);")
          == 'closed/published,closed/published')
    check(C, 'LEG-4', 'The four demonstration pairings are untouched', '4, scores 85/75/100/100',
          sql('SELECT GROUP_CONCAT(match_score ORDER BY match_id) FROM match_claims WHERE match_id <= 4;'),
          sql('SELECT GROUP_CONCAT(match_score ORDER BY match_id) FROM match_claims WHERE match_id <= 4;') == '85,75,100,100')


if __name__ == '__main__':
    if sql('SELECT 1') != '1':
        print('The local database is not reachable; this suite needs it.')
        sys.exit(2)
    reseed()
    legacy()
    state_machine()
    visibility()
    matching()
    drafts()
    removal()
    notifications()
    counts()

    failed = [r for r in results if not r[5]]
    for cat, tid, desc, expected, actual, ok in results:
        print(f'{"PASS" if ok else "FAIL"}  {tid:<13} {desc}' + ('' if ok else f'  (expected {expected}, got {actual})'))
    print(f'\n{len(results) - len(failed)}/{len(results)} passed')
    reseed()
    sys.exit(0 if not failed else 1)
