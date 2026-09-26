# Testing Paws&Found on several devices, before it is hosted

**Written:** 25 September 2026 · ITS122P–AM5 · Group 3

One laptop runs XAMPP. Every other device on the same Wi-Fi opens that
laptop's address instead of `localhost`. All of them then talk to **one Apache,
one PHP, one MySQL** — which is the only thing the multi-device tests actually
require.

This is not a substitute for hosting. The instructor will open the site on her
own devices, on a network that is not ours, so a real URL is still needed. It
is a way to run every multi-device test **now**, for nothing, and to find the
bugs while hosting is still being decided.

---

## 1. It already works

Checked on the development laptop, 25 September 2026:

| Thing that usually blocks this | State |
| --- | --- |
| Apache listening on all interfaces | `Listen 80` with no address bound — `0.0.0.0:80` confirmed in `netstat` |
| Windows Firewall inbound rule | "Apache HTTP Server" present and enabled |
| Firewall profile vs network profile | Rule is **Public**; the Wi-Fi is classified **Public**. They match |
| Site over the LAN address | `http://192.168.254.108/pawsandfound/` → 200, page renders |
| API over the LAN address | `http://192.168.254.108/pawsandfound/api/reports` → 200, JSON |

Nothing had to be changed. If it stops working later, the table above is the
list of things to check, in that order.

---

## 2. Finding the address

On the host laptop:

```bash
ipconfig
```

Take the **IPv4 Address** under the Wi-Fi adapter — `192.168.254.108` on this
machine. Ignore anything starting `172.` (WSL) or `169.254.` (no DHCP lease).

It is handed out by DHCP, so **it can change when the laptop reconnects.**
Check it again on the day rather than trusting a number written down last week.

---

## 3. What every other device opens

```
http://192.168.254.108/pawsandfound/
```

**Not** `http://localhost/pawsandfound/`, and **not** `http://localhost:5173`.
On a classmate's laptop `localhost` means *their* laptop; on a phone it means
the phone. Both will simply fail to connect, which looks like the server being
down and is not.

Use the **built** site served by Apache, not `npm run dev`. The Vite dev server
binds to localhost only unless started with `--host`, and it is not what will
be deployed anyway — testing the thing you are going to ship is the point.

To refresh the built copy after a code change, on the host laptop:

```bash
npm run build
```

then copy `dist/` into `C:\xampp\htdocs\pawsandfound\`, leaving the `api`
folder alone.

---

## 4. Why nothing needed reconfiguring

Three earlier decisions happen to make this free:

**The frontend never names a host.** `src/services/api.js` builds its URL from
`import.meta.env.BASE_URL`, so it asks for `/pawsandfound/api/...` relative to
whatever address the page was opened from. A hard-coded
`http://localhost/pawsandfound/api` would have made every phone call itself and
fail.

**The session cookie's Secure flag is computed, not constant.**
`request_is_https()` in `api/helpers.php` returns false over plain HTTP, so the
cookie is sent normally on the LAN. Had it been hard-coded `true` for
production, the browser would refuse to return it over `http://` and every
sign-in on every device would fail with no visible reason.

**Same origin.** The built site and the API are served by one Apache from one
address, so there is no CORS to configure — `ALLOWED_ORIGINS` is not consulted
at all. That is the same property the hosted version will rely on.

---

## 5. The tests this makes possible today

### 5.1 The part that is automated

    npm run multi-device

`scripts/multi_device.py` opens **three independent sessions** — three cookie
jars, three CSRF tokens, exactly as three browsers on three machines have — and
runs the whole sequence against one Apache, one PHP and one MySQL. **40 checks,
all passing as of 25 September 2026.** It restores the demonstration data at
the end, so it can be run as often as the code changes.

| | What it proves |
| --- | --- |
| A | One account signs in on three devices without logging the others out |
| B | A report filed and then closed on one device is what the other two see, and the database agrees |
| C | Marking notifications read on one device reads them on the others — the state is in MySQL, not in a device |
| D | An administrator downgrading the role mid-session takes effect on the other two devices' **very next request**, without them refreshing; a coordinator endpoint then answers 403; the audit log names who did it |
| E | Suspension drops all three sessions to signed-out, and a protected call from each returns 401 |
| F | Three wrong passwords on device A lock the account; **the correct password on device B is still refused**; `login_attempts.failed_count` is 3 in the database |
| G | The administrator unlock clears the counter as well as the status, device B can sign in again, and the unlock is in the audit log |
| H | A customer typing `/users`, `/moderation`, `/categories`, somebody else's report, or an invented endpoint gets 403, 403, 403, 403, 404 — and nothing is created |

Run it against the LAN address on the day too, which tests the same things
across the network rather than through the loopback:

```bash
PAWS_API=http://192.168.254.108/pawsandfound/api python scripts/multi_device.py
```

### 5.2 The part only real hardware can show

The script proves the **server** is the authority. It cannot prove anything
about the browser, and three of these matter:

1. **The 10-second refetch.** `useSession` re-reads `/auth/me` on load, on
   window focus, on tab visibility, on route change and on a timer. The script
   calls the endpoint directly, so it shows the server answering correctly —
   not the second laptop's screen changing on its own while nobody touches it.
   That is the thing worth watching happen.
2. **The cookie.** Three tabs in one browser share a cookie jar, so "three
   devices" made of three tabs is one session wearing a disguise. Three
   machines is the only way to show three cookies.
3. **The phone.** Layout, the drawer, the chip row, and whether a report can
   actually be filed one-handed outdoors.

So: run `npm run multi-device` for the evidence, and run the sequence by hand
on three devices at least once before the presentation for the demonstration.
They answer different questions.

---

## 6. What this cannot prove

* **HTTPS.** The LAN runs over plain HTTP, so the `Secure` cookie flag, the
  certificate and any mixed-content problem stay untested until there is a
  host.
* **The host's own behaviour.** Free hosts in particular can answer
  non-browser requests with an HTML challenge page instead of JSON, which
  breaks the API and the test suite. Nothing on the LAN will reveal that.
* **Anything about the public internet** — latency, DNS, the venue's Wi-Fi.

So: run the eight tests here, fix what they find, and treat the hosted
deployment as a separate thing that still has to be proven on its own.

---

## 7. If a device cannot connect

In this order:

1. **Wrong address.** Re-run `ipconfig`; DHCP may have moved it.
2. **Different network.** Phones drift onto mobile data, or onto a "5G" SSID
   that is a separate subnet from the "2.4G" one. Check both ends.
3. **Apache not running.** XAMPP Control Panel on the host laptop.
4. **Firewall.** If the Wi-Fi is ever reclassified from Public to Private, the
   existing rule stops applying. Either set the network back to Public, or add
   a rule for Private — in an **administrator** PowerShell:

   ```
   New-NetFirewallRule -DisplayName "Apache HTTP Server (Private)" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private
   ```

5. **Client isolation.** Some routers — especially guest networks and campus
   Wi-Fi — deliberately stop devices seeing each other. Nothing on the laptop
   can fix that. Use a phone hotspot instead, with the host laptop joined to
   it.
