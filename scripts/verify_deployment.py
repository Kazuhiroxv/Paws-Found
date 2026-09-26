"""
Paws&Found — is this deployment actually working?

Run it against a URL, not against localhost. It checks the things that go
wrong when a site moves from XAMPP to a host, which are mostly not the things
that go wrong while writing it:

    python scripts/verify_deployment.py https://pawsandfound.example.com

The free-host trap is the reason this exists. Several free hosts answer a
request that does not look like a browser with an HTML challenge page instead
of the response. For a page view that is invisible; for a REST API it means
`fetch` receives HTML where it expected JSON, and neither the application nor
`audit_cases.py` can run at all. That is the single most useful thing to find
out a week early rather than on the day.

It signs in once and uploads one small PNG to a report the demo account
already owns, because that is the only honest way to test the upload path —
the seeded photographs are bundled with the frontend and never touch the
server. Re-importing `database/seed.sql` clears it. Nothing else is written.

Stdlib only.
"""
import http.cookiejar
import json
import re
import ssl
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
import zlib

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost/pawsandfound').rstrip('/')
API = BASE + '/api'
DEMO_ACCOUNT = ('maria.santos@example.com', 'demo1234')

results = []
# Some hosts serve a certificate this machine has no root for. What is being
# checked here is whether the application works, not whether this laptop trusts
# the chain, so the handshake is not verified — §7 reports the scheme itself.
CONTEXT = ssl.create_default_context()
CONTEXT.check_hostname = False
CONTEXT.verify_mode = ssl.CERT_NONE

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(jar),
    urllib.request.HTTPSHandler(context=CONTEXT))


def check(step, what, expected, actual, ok, note=''):
    results.append((step, what, expected, actual, ok, note))
    print(f'  {step:<5} {what:<52} {str(expected)[:20]:<20} {str(actual)[:26]:<26} '
          f'{"PASS" if ok else "FAIL"}')
    if note and not ok:
        print(f'        {note}')


def fetch(url, method='GET', body=None, headers=None, follow=True):
    """Returns (status, headers, text). Never raises for an HTTP status."""
    request = urllib.request.Request(url, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        request.add_header('Content-Type', 'application/json')
        request.data = data

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None

    use = opener
    if not follow:
        use = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar),
            urllib.request.HTTPSHandler(context=CONTEXT),
            NoRedirect)

    try:
        with use.open(request, timeout=30) as response:
            return response.status, dict(response.headers), response.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read().decode('utf-8', 'replace')
    except Exception as error:                                   # noqa: BLE001
        return 0, {}, f'{type(error).__name__}: {error}'


def banner(title):
    print()
    print(title)
    print('-' * 112)
    print(f'  {"":<5} {"What is being checked":<52} {"Expected":<20} {"Actual":<26} Result')


print('Paws&Found — deployment verification')
print(f'  {BASE}')

# ================================================================ 1. the site
banner('1. The site itself')
status, headers, page = fetch(BASE + '/')
check('1.1', 'The homepage answers', 200, status, status == 200)
check('1.2', 'It is HTML', True, 'text/html' in headers.get('Content-Type', ''),
      'text/html' in headers.get('Content-Type', ''))
check('1.3', 'It is the built app, not a host placeholder', True,
      'id="root"' in page or 'id=root' in page, 'id="root"' in page or 'id=root' in page,
      'A host parking page or an "account suspended" notice looks like a working site to curl.')

assets = re.findall(r'(?:src|href)="([^"]*/assets/[^"]+\.(?:js|css))"', page)
if assets:
    asset = urllib.parse.urljoin(BASE + '/', assets[0])
    status, headers, _ = fetch(asset)
    check('1.4', 'A hashed asset loads', 200, status, status == 200,
          f'{asset}\n        A 404 here means the build base and RewriteBase disagree.')
else:
    check('1.4', 'A hashed asset loads', 'found one', 'no asset tags', False,
          'index.html references no /assets/ file — this is not the built bundle.')

status, _, deep = fetch(BASE + '/explore')
check('1.5', 'A deep link refreshes (SPA routing)', 200, status, status == 200,
      '404 here means .htaccess is missing, or mod_rewrite is off.')
check('1.6', 'The deep link returns the app, not a directory listing', True,
      'id="root"' in deep, 'id="root"' in deep)

# ================================================================= 2. the API
banner('2. The API answers JSON, not HTML')
status, headers, body = fetch(API + '/')
is_json = 'application/json' in headers.get('Content-Type', '')
check('2.1', 'GET /api/ answers', 200, status, status == 200)
check('2.2', 'Content-Type is application/json', True, is_json, is_json,
      'THE FREE-HOST TRAP. An HTML challenge page here breaks fetch() and the\n'
      '        test suite, and nothing in the browser will show you why.')
check('2.3', 'The body parses as JSON', True, body.lstrip().startswith('{'),
      body.lstrip()[:1] == '{', (body[:160] + '...') if not body.lstrip().startswith('{') else '')

status, headers, body = fetch(API + '/reports')
try:
    reports = json.loads(body).get('data', [])
except json.JSONDecodeError:
    reports = None
check('2.4', 'GET /api/reports returns reports', True, isinstance(reports, list) and len(reports) > 0,
      isinstance(reports, list) and len(reports) > 0,
      'An empty list means the seed data was not imported.')

status, _, _ = fetch(API + '/reports/999999')
check('2.5', 'A report that does not exist is a 404', 404, status, status == 404)
status, _, _ = fetch(API + '/matches/1/nonsense')
check('2.6', 'An invented sub-path is a 404', 404, status, status == 404)

# ============================================================= 3. no leakage
banner('3. Production tells nobody anything useful')
leaks = []
for path in ('/reports/999999', '/matches/1/nonsense', '/reports/abc', '/nope'):
    _, _, body = fetch(API + path)
    lowered = body.lower()
    leaks += [w for w in ('select ', 'pdoexception', 'stack trace', 'c:\\', '/home/',
                          '.php on line', 'sqlstate', 'fatal error', 'warning:')
              if w in lowered]
check('3.1', 'No SQL, path or exception text in error bodies', 'clean',
      'clean' if not leaks else ', '.join(sorted(set(leaks))), not leaks,
      'display_errors is on. Turn it off — see api/config.php and APP_ENV.')

_, headers, _ = fetch(API + '/')
cors = headers.get('Access-Control-Allow-Origin', '(none)')
check('3.2', 'No wildcard CORS header', True, cors, cors != '*',
      'Same-origin deployment should send no CORS header at all.')

# ================================================= 4. sessions over the real domain
banner('4. Sessions and cookies on the real domain')
status, headers, body = fetch(API + '/auth/me')
try:
    token = json.loads(body).get('csrf_token')
except json.JSONDecodeError:
    token = None
check('4.1', 'A CSRF token is issued', True, bool(token), bool(token))

status, _, _ = fetch(API + '/auth/login', 'POST', {'email': DEMO_ACCOUNT[0], 'password': DEMO_ACCOUNT[1]})
check('4.2', 'A write with no CSRF token is refused', True, status in (403, 419),
      status in (403, 419), 'CSRF is not being enforced on this deployment.')

status, headers, body = fetch(API + '/auth/login', 'POST',
                              {'email': DEMO_ACCOUNT[0], 'password': DEMO_ACCOUNT[1]},
                              {'X-CSRF-Token': token or ''})
check('4.3', 'Signing in works', 200, status, status == 200,
      (body[:150] if status != 200 else ''))

cookie = next((c for c in jar if c.name.lower().startswith('paws') or 'sess' in c.name.lower()), None)
check('4.4', 'A session cookie was set', True, cookie.name if cookie else 'none', cookie is not None)
if cookie:
    https = BASE.startswith('https://')
    check('4.5', 'Secure flag matches the scheme', https, bool(cookie.secure),
          bool(cookie.secure) == https,
          'Secure on plain HTTP is never sent back; missing it on HTTPS ships the\n'
          '        session unprotected. request_is_https() decides this, and it reads\n'
          '        X-Forwarded-Proto for hosts that terminate TLS at a proxy.')
    check('4.6', 'HttpOnly is set', True, bool(cookie.has_nonstandard_attr('HttpOnly')),
          bool(cookie.has_nonstandard_attr('HttpOnly')))

_, _, body = fetch(API + '/auth/me')
try:
    who = (json.loads(body).get('user') or {}).get('email')
except json.JSONDecodeError:
    who = None
check('4.7', 'The session survives the next request', DEMO_ACCOUNT[0], who, who == DEMO_ACCOUNT[0],
      'Signed in then signed out again is the cookie not coming back: mixed\n'
      '        HTTP/HTTPS, or Secure set while serving over HTTP.')

# ================================================================ 5. uploads
banner('5. Uploaded photographs')

# The seeded photographs are NOT in api/uploads/ — they are bundled with the
# frontend and resolved by assetUrl()'s filename map (src/services/api.js:59).
# Only a file somebody actually uploaded lives on the server, so the only
# honest way to test the upload path is to upload something.
#
# It attaches one 40x30 PNG to a report the signed-in demo account already
# owns, rather than filing a new report. Re-importing database/seed.sql clears
# report_images, so the presentation reset removes it.
def tiny_png():
    def chunk(tag, data):
        block = tag + data
        return struct.pack('>I', len(data)) + block + struct.pack('>I', zlib.crc32(block))
    raw = b''.join(bytes([0]) + bytes((60, 140, 130)) * 40 for _ in range(30))
    # The eight-byte PNG signature, written as numbers rather than as an
    # escaped literal: two of those bytes are CR and LF, and a source file
    # that carries them raw does not survive being copied about.
    signature = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    return (signature
            + chunk(b'IHDR', struct.pack('>IIBBBBB', 40, 30, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))


# Signing in ROTATES the CSRF token (api/auth.php), so the one fetched before
# the sign-in is already stale. Using it here returns 403 and looks like a
# broken upload path when it is only a stale token.
_, _, body = fetch(API + '/auth/me')
try:
    token = json.loads(body).get('csrf_token') or token
except json.JSONDecodeError:
    pass

_, _, body = fetch(API + '/reports/activity')
try:
    own_report = json.loads(body)['data'][0]['report_id']
except (json.JSONDecodeError, KeyError, IndexError):
    own_report = None

if own_report is None:
    check('5.1', 'A report owned by the demo account was found', True, False, False,
          'GET /reports/activity returned nothing, so there is nothing to attach to.')
else:
    # A multipart body, built by hand so there is nothing to install. CRLF is
    # written as an escape rather than as a real line break: the boundaries in
    # a multipart body are literal carriage returns, and a source file that
    # carries them raw is one careless copy away from being broken.
    boundary = 'pawsverify' + str(id(jar))
    # chr(13) + chr(10) rather than an escape. The boundaries in a multipart
    # body are literal carriage returns, and a source file that carries one
    # raw is one careless copy away from being broken.
    crlf = chr(13) + chr(10)
    parts = [
        (f'--{boundary}{crlf}'
         f'Content-Disposition: form-data; name="captions[]"{crlf}{crlf}'
         f'Deployment check{crlf}').encode(),
        (f'--{boundary}{crlf}'
         f'Content-Disposition: form-data; name="photos[]"; filename="deploy-check.png"{crlf}'
         f'Content-Type: image/png{crlf}{crlf}').encode(),
        tiny_png(),
        crlf.encode(),
        f'--{boundary}--{crlf}'.encode(),
    ]
    request = urllib.request.Request(f'{API}/reports/{own_report}/photos', method='POST',
                                     data=b''.join(parts))
    request.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    request.add_header('X-CSRF-Token', token or '')
    try:
        with opener.open(request, timeout=30) as response:
            status, body = response.status, response.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read().decode('utf-8', 'replace')

    check('5.1', 'A photograph uploads', 201, status, status == 201, body[:150] if status != 201 else '')

    # The response carries EVERY photograph on that report, primary first, so
    # photos[0] is the seeded one that was already there. The upload is the
    # highest image_id.
    stored = None
    try:
        photos = json.loads(body).get('data') or []
        stored = max(photos, key=lambda photo: photo['image_id'])['path']
    except (json.JSONDecodeError, AttributeError, TypeError, ValueError, KeyError):
        pass

    # Only when the upload actually worked. Otherwise the last photograph on
    # that report is a seeded one, which is bundled with the frontend and was
    # never in api/uploads/ — reporting a 404 for it would blame the host for
    # something it never had.
    if not stored and status == 201:
        _, _, detail = fetch(f'{API}/reports/{own_report}')
        try:
            stored = json.loads(detail)['data']['photos'][-1]['path']
        except (json.JSONDecodeError, KeyError, IndexError):
            stored = None

    if stored:
        # A SIGNED-OUT visitor, with its own cookie jar: a photograph that only
        # loads for the person who uploaded it is not actually published.
        anonymous = urllib.request.build_opener(urllib.request.HTTPSHandler(context=CONTEXT))
        url = f'{API}/uploads/{stored}'
        try:
            with anonymous.open(url, timeout=30) as response:
                img_status, ctype, size = response.status, response.headers.get('Content-Type', ''), len(response.read())
        except urllib.error.HTTPError as error:
            img_status, ctype, size = error.code, '', 0
        check('5.2', 'A signed-out visitor can fetch it', 200, img_status, img_status == 200, url)
        check('5.3', 'It is served as an image, with bytes', True,
              f'{ctype} {size}B', ctype.startswith('image/') and size > 0,
              'An HTML body here means the upload directory is being '
              'rewritten into index.php, or the host is serving a challenge page.')
    else:
        check('5.2', 'The stored filename came back', True, False, False,
              'The API did not say where it put the file.')

status, _, listing = fetch(API + '/uploads/')
check('5.4', 'The uploads directory is not browsable', True,
      status in (403, 404) or 'Index of' not in listing,
      status in (403, 404) or 'Index of' not in listing)

# ========================================================== 6. dev-only things
banner('6. Nothing development-only shipped')
bundle = ''
for asset in assets:
    if asset.endswith('.js'):
        _, _, text = fetch(urllib.parse.urljoin(BASE + '/', asset))
        bundle += text
found = [w for w in ('demo1234', 'localhost/pawsandfound', '127.0.0.1', 'VITE_DEV') if w in bundle]
check('6.1', 'No demo password or dev host in the bundle', 'clean',
      'clean' if not found else ', '.join(found), not found)
status, _, _ = fetch(BASE + '/api/config.local.php')
check('6.2', 'config.local.php is not readable over the web', True,
      status in (403, 404) or status == 200,
      status in (403, 404), 'A 200 here would serve the database password as text.')

# ================================================================== 7. HTTPS
banner('7. HTTPS')
if BASE.startswith('https://'):
    plain = 'http://' + BASE.split('://', 1)[1]
    status, headers, _ = fetch(plain, follow=False)
    location = headers.get('Location', '')
    check('7.1', 'http:// redirects to https://', True,
          f'{status} -> {location[:40]}' if status else 'no answer',
          status in (301, 302, 307, 308) and location.startswith('https://'))
else:
    check('7.1', 'The site is served over HTTPS', True, BASE.split('://')[0], False,
          'Run this again against the https:// address once the certificate is issued.\n'
          '        Everything about the Secure cookie flag is untested until then.')

# ================================================================== summary
passed = sum(1 for row in results if row[4])
print()
print('=' * 112)
print(f'  {passed}/{len(results)} passed')
if passed != len(results):
    print()
    for step, what, expected, actual, ok, note in results:
        if not ok:
            print(f'  FAILED  {step}  {what}: expected {expected}, got {actual}')
    print()
    print('  Fix these before running the full suites against this deployment.')
else:
    print()
    print('  Now run the two suites against it:')
    print(f'    PAWS_API={API} PAWS_MYSQL_ARGS="..." python scripts/audit_cases.py')
    print(f'    PAWS_API={API} python scripts/multi_device.py')
sys.exit(0 if passed == len(results) else 1)
