# SachinDev X FFFZ

Free Fire squad automation suite with a real-time web dashboard.

> **Disclaimer:** This project uses unofficial game protocols and automates
> gameplay. It can violate the Free Fire Terms of Service and can get accounts
> banned. Use it only with accounts you own and only where it is legal for you
> to do so. The project is provided as-is, without warranty. You are responsible
> for how you run it.

---

## Table of contents

- [What this project does](#what-this-project-does)
- [Features](#features)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Choosing an entry point](#choosing-an-entry-point)
- [Dashboard](#dashboard)
- [Account file format](#account-file-format)
- [Configuration](#configuration)
- [HTTP API](#http-api)
- [Creating accounts](#creating-accounts)
- [Guild join helper](#guild-join-helper)
- [Running 24/7](#running-247)
- [Troubleshooting](#troubleshooting)
- [Security checklist](#security-checklist)
- [Code analysis](#code-analysis)
- [Rebranding map](#rebranding-map)
- [FAQ](#faq)

---

## What this project does

The project has two bot entry points:

1. **`main.py`** — a four-account squad bot. It logs in accounts, forms a team,
   sends invites, accepts team invites, starts Battle Royale matches, sends
   movement packets, and reports progress to the dashboard on port `20333`.
2. **`app.py`** — a four-bot team runner with account creation, movement,
   match watchdog, auto-restart, and its own dashboard on port `25567`.

Both entry points share the same HTML dashboard template:
`templates/index.html`.

The dashboard shows account status, level and EXP progress, matches played, EXP
per hour, current matches, logs, and controls for adding, pausing, restarting,
refreshing, and deleting accounts.

---

## Features

| Feature | `main.py` | `app.py` |
|---|---:|---:|
| Four-account squad team | Yes | Yes |
| Team create / invite / accept | Yes | Yes |
| Battle Royale auto start | Yes | Yes |
| Anti-AFK movement | Yes | Yes |
| Web dashboard | Yes | Yes |
| Account pause / restart / delete | Yes | Yes |
| Add guest UID or access token | Yes | Yes |
| Auto-create guest accounts | No | Yes, API-driven |
| Match-end detection | Yes | Yes |
| No-match watchdog restart | No | Yes |
| Region rotation | Yes | No, region is chosen per account |
| Token cache | Yes | Yes |
| Device profile cache | Yes | Yes |
| Guild join helper | Separate `guild.py` | Separate `guild.py` |

Additional behavior:

- Guest accounts can be added with UID and password, or with an access token.
- Account sessions reconnect automatically after disconnect.
- EXP is refreshed periodically and after matches.
- The dashboard falls back to demo data when the backend API is unreachable.
- The dashboard has themes, keyboard shortcuts, log filtering, a command
  palette, and a bulk account import flow.
- `guild.py` joins accounts to a guild through an external HTTP service.

---

## Project layout

```text
FF GUILD BOT/
├── app.py                     # 4-bot team + auto-create + dashboard on 25567
├── main.py                    # squad bot + dashboard on 20333
├── dashboard_server.py        # shared dashboard state, API, and HTTP server
├── guild.py                   # guild join helper
├── GUEST_GEN_FIXED.py         # obfuscated standalone guest/account helper
├── accounts.json              # account credentials and optional metadata
├── token_cache.json           # cached login tokens and profile data
├── devices.json               # per-account device profiles
├── requirements.txt           # Python dependencies
├── templates/
│   ├── index.html             # dashboard UI
│   └── index.html.bak         # dashboard backup
├── message_ids.py             # Free Fire packet/message name map
├── thunderFF_pb2.py
├── RbcFF_pb2.py
├── RbcTeam_pb2.py
├── StartMatch_pb2.py
├── reqClan_pb2.py
├── encode_id_clan_pb2.py
├── data_pb2.py
└── README.md
```

Do not edit the generated `*_pb2.py` files by hand. They are protobuf modules
used by the packet layer.

---

## Requirements

- Windows 10/11, Linux, or macOS
- Python **3.10 or newer** (3.11–3.13 recommended)
- Internet access
- A Free Fire account, or accounts you are allowed to use
- Open TCP port for the dashboard:
  - `20333` for `main.py`
  - `25567` for `app.py`

Python packages:

```text
httpx
google-play-scraper
pycryptodome
protobuf-decoder
protobuf
requests
aiohttp
```

Dependency set used during the rebrand check:

| Package | Version |
|---|---:|
| Python | 3.14 |
| `protobuf` | 7.36.2 |
| `aiohttp` | 3.14.5 |
| `httpx` | 0.28.1 |
| `pycryptodome` | 4.1.0 |
| `protobuf-decoder` | 0.4.0 |
| `google-play-scraper` | 1.2.7 |

`requirements.txt` is intentionally unpinned. If a future release breaks the
bot, pin the versions above in a local requirements file and reinstall.

---

## Quick start

### Windows PowerShell

```powershell
cd "C:\Users\This PC\Desktop\FF GUILD BOT"

py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt

python main.py
```

If PowerShell blocks the activation script, run this once for the current
terminal session:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

Then activate the virtual environment again.

### Windows Command Prompt

```bat
cd /d "C:\Users\This PC\Desktop\FF GUILD BOT"
py -3 -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
python main.py
```

### Linux or macOS

```bash
cd "FF GUILD BOT"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python3 main.py
```

### Run the other entry point

```bash
python app.py
```

Do not run both entry points against the same accounts at the same time. The
game session will conflict, and both processes may fight over the same account
state.

### Open the dashboard

- `main.py`: <http://localhost:20333>
- `app.py`: <http://localhost:25567>

The server binds to `0.0.0.0`. That makes it reachable from other devices on
your network. The dashboard has **no login**, so do not expose it directly to
the public internet. See [Security checklist](#security-checklist).

---

## Choosing an entry point

### Use `main.py` when:

- You already have accounts in `accounts.json`.
- You want the squad bot to create a team, invite the other accounts, accept
  invites, and start Battle Royale matches.
- You want a lighter dashboard with the shared `dashboard_server.py` backend.

### Use `app.py` when:

- You want the extra match watchdog and automatic restart behavior.
- You want the API endpoint that can create guest accounts.
- You want the standalone 4-bot movement loop.

`app.py` has its own `BotState` and its own HTTP server. It does not use the
`dashboard_server.py` global state. This is why the two dashboards expose
slightly different APIs.

---

## Dashboard

The dashboard provides:

- **Active accounts** — number of monitored accounts.
- **Total EXP gained** — EXP delta since each account was registered.
- **Matches completed** and **matches started**.
- **Uptime**, **EXP per hour**, and **average EXP per match**.
- **In match now** and **top grinder**.
- **EXP gain timeline** chart.
- **Monitored accounts** list with status, level, EXP, region, and match count.
- **Activity log** with info / success / warning / error filters.
- **Add account** modal with single and bulk import modes.
- Account controls for pause, resume, refresh, restart, and delete.
- Theme switcher: neon, blood, matrix, ice.
- Optional sound, effects, grid/list view, and command palette.

Keyboard shortcuts:

| Key | Action |
|---|---|
| `Ctrl + K` | Open command palette |
| `A` | Add account |
| `R` | Refresh data |
| `/` | Search accounts |
| `T` | Cycle theme |
| `F` | Toggle effects |
| `M` | Toggle sound |
| `G` | Grid / list view |
| `?` | Shortcuts help |
| `Esc` | Close any modal |

The template falls back to demo accounts and demo logs when `/api/stats` cannot
be reached. This is only a UI fallback; it does not start real game sessions.

---

## Account file format

`accounts.json` must contain a JSON array. The simplest guest format is:

```json
[
  {
    "uid": "1000000001",
    "password": "your-guest-password"
  },
  {
    "uid": "1000000002",
    "password": "your-guest-password"
  }
]
```

Optional fields supported by parts of the code:

```json
[
  {
    "uid": "1000000001",
    "password": "your-guest-password",
    "name": "FFFZ Demo",
    "region": "IND",
    "clan_id": "1234567890",
    "account_id": "18800000000",
    "created_at": "2026-01-01 00:00:00"
  }
]
```

Token-based account entries:

```json
[
  {
    "token": "ACCESS_TOKEN_HERE"
  }
]
```

Notes:

- `main.py` autoloads both UID/password and `token` entries.
- `app.py` autoloads UID/password entries. Add a token at runtime through the
  dashboard or `/api/account/add`.
- `devices.json` stores a device fingerprint per account. The code creates one
  when a new account is seen. Keep this file if you want stable device profiles.
- `token_cache.json` stores tokens and profile snapshots. Treat it as a secret.
- Both files can contain live credentials. Never commit or share them.

---

## Configuration

There is no `.env` loader in the current code. Edit the constants near the top of
each entry point, then restart the process.

### `main.py` settings

| Constant | Default | Purpose |
|---|---:|---|
| `WEB_HOST` | `0.0.0.0` | Dashboard bind address |
| `WEB_PORT` | `20333` | Dashboard port |
| `TOKEN_CACHE_TTL` | `4500` | Cached token lifetime in seconds |
| `START_MATCH_INTERVAL` | `4.0` | Delay between match-start attempts |
| `MAX_MATCH_DURATION` | `3000` | Maximum match time in seconds |
| `MATCH_IDLE_TIMEOUT` | `90.0` | Idle time before treating a match as ended |
| `EXP_REFRESH_INTERVAL` | `30.0` | Profile refresh interval |
| `TEAM_MODE` | `True` | Enable four-player team flow |
| `TEAM_SIZE` | `4` | Target team size |
| `TEAM_PEER_WAIT_TIMEOUT` | `90.0` | Wait for peers before creating a team |
| `REGION_ROTATION_LIST` | `["ID","SG","TH","MY","VN","PH"]` | Regions used for search rotation |
| `MAX_SEARCH_ATTEMPTS` | `25` | Search retry limit |
| `ENABLE_SPEED_MOVEMENT` | `True` | Enable movement packets |
| `MOVEMENT_SPEED_MIN` / `MAX` | `1.0` / `1.4` | Movement speed range |
| `MOVEMENT_PATTERN` | `"circle"` | Movement pattern |
| `ENABLE_HTTP_PING` | `True` | Enable HTTP keepalive ping |
| `DEBUG_TEAM_PACKETS` | `True` | Verbose team packet logging |

Set `DEBUG_TEAM_PACKETS = False` if the console is too noisy.

### `app.py` settings

| Constant | Default | Purpose |
|---|---:|---|
| `WEB_HOST` | `0.0.0.0` | Dashboard bind address |
| `WEB_PORT` | `25567` | Dashboard port |
| `TOKEN_CACHE_TTL` | `1200` | Cached token lifetime in seconds |
| `START_MATCH_INTERVAL` | `3.0` | Delay between match-start attempts |
| `MAX_MATCH_DURATION` | `1500` | Maximum match time in seconds |
| `MATCH_IDLE_TIMEOUT` | `35.0` | UDP idle time before match end |
| `NO_MATCH_RESTART_ENABLED` | `True` | Restart the process when no match is found |
| `NO_MATCH_RESTART_TIMEOUT` | `90.0` | No-match time before restart |
| `TEAM_MODE` | `True` | Enable team flow |
| `TEAM_SIZE` | `4` | Team size |
| `CLAN_ID_DEFAULT` | `3105331459` | Default clan ID for new accounts |
| `TEAM_READY_DELAY` | `5.0` | Delay before ready/start |
| `TEAM_INVITE_WAIT` | `2.5` | Delay between invite retries |

`app.py` also accepts region and clan overrides per account through
`accounts.json`.

### `guild.py` settings

| Variable | Default | Purpose |
|---|---|---|
| `FFFZ_GUILD_API` | Upstream service URL | Override the guild join endpoint |

Example:

```powershell
$env:FFFZ_GUILD_API = "https://your-service.example/join"
python guild.py
```

The default endpoint is a third-party service. If it is offline or changed, the
script will fail until you point it at a working compatible endpoint.

---

## HTTP API

### `app.py` — port `25567`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Dashboard |
| `GET` | `/api/ping` | Health check |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/state` | Full state snapshot |
| `GET` | `/api/progress` | Account creation progress |
| `POST` | `/api/create_team` | Create guest accounts |
| `POST` | `/api/account/add` | Add UID/password or token |
| `POST` | `/api/account/delete` | Remove an account |
| `POST` | `/api/account/refresh` | Refresh profile and EXP |
| `POST` | `/api/account/restart` | Restart an account worker |
| `POST` | `/api/account/pause` | Pause or resume one account |
| `POST` | `/api/account/pause_all` | Pause or resume all accounts |
| `POST` | `/api/logs/clear` | Clear dashboard logs |

### `main.py` — port `20333`

The shared dashboard server exposes:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Dashboard |
| `GET` | `/api/stats` | Dashboard statistics |
| `POST` | `/api/account/add` | Add UID/password or token |
| `POST` | `/api/account/delete` | Remove an account |
| `POST` | `/api/account/refresh` | Refresh profile |
| `POST` | `/api/account/restart` | Restart an account worker |
| `POST` | `/api/account/pause` | Pause or resume one account |
| `POST` | `/api/account/pause_all` | Pause or resume all accounts |
| `POST` | `/api/logs/clear` | Clear dashboard logs |

Example health check:

```powershell
Invoke-RestMethod http://localhost:25567/api/ping
```

```bash
curl http://localhost:25567/api/ping
```

There is no authentication layer on these endpoints. Keep the ports private.

---

## Creating accounts

`app.py` exposes `POST /api/create_team`. It starts an asynchronous account
creation job and returns immediately.

Request body:

```json
{
  "region": "IND",
  "clan_id": "1234567890",
  "count": 4,
  "password": "FFFZ"
}
```

Rules in the current code:

- `region` is uppercased.
- `clan_id` is required.
- `count` is clamped to `1..4`.
- Only one creation job can run at a time.
- New accounts are written to `accounts.json`.
- New nicknames use the `FFFZ•` prefix.
- The default password is `FFFZ` when none is supplied.

Example:

```bash
curl -X POST http://localhost:25567/api/create_team \
  -H "Content-Type: application/json" \
  -d "{\"region\":\"IND\",\"clan_id\":\"1234567890\",\"count\":4}"
```

Progress is available from `/api/progress` and in the dashboard activity log.

Account creation depends on the current game registration API. It can fail when
Garena changes the endpoint, app version, region rules, or anti-automation
checks. A failure is not a bug in the dashboard; check the console log first.

---

## Guild join helper

`guild.py` is a standalone script. It reads `accounts.json`, asks for a guild ID,
and calls the configured join endpoint.

```bash
python guild.py
```

Example session:

```text
Enter Guild ID : 1234567890
```

Optional endpoint override:

```powershell
$env:FFFZ_GUILD_API = "https://your-service.example/join"
python guild.py
```

The script masks passwords in its output, but `accounts.json` still contains the
real credentials. Do not run it on a shared machine without protecting the file.

---

## Running 24/7

### Linux systemd

Create `/etc/systemd/system/fffz-main.service`:

```ini
[Unit]
Description=SachinDev X FFFZ - main squad bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=fffz
WorkingDirectory=/opt/ff-guild-bot
ExecStart=/opt/ff-guild-bot/.venv/bin/python /opt/ff-guild-bot/main.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fffz-main
sudo journalctl -u fffz-main -f
```

Replace the user, directory, and entry point to match your server. Use
`app.py` in `ExecStart` if you want the other runtime.

### Windows Task Scheduler

1. Create a task with trigger **At startup** or **At log on**.
2. Set **Program/script** to your Python executable.
3. Set **Add arguments** to `main.py` or `app.py`.
4. Set **Start in** to the project directory.
5. Enable **Run whether user is logged on or not** if needed.

Test the exact command in a terminal first. Service managers will not show
interactive prompts, so make sure no step asks for input.

---

## Troubleshooting

### `ModuleNotFoundError`

Activate the virtual environment and reinstall:

```bash
pip install -r requirements.txt
```

If `Crypto` is missing, install `pycryptodome`, not `crypto`.

### Dashboard does not open

- Confirm the process is still running.
- Check the port: `20333` for `main.py`, `25567` for `app.py`.
- Test the health endpoint:

```bash
curl http://localhost:25567/api/ping
```

- Check Windows Firewall or the Linux firewall.
- If the port is already in use, change `WEB_PORT` and restart.

### `Address already in use`

Another bot instance is already running. Stop it before starting a second one.
On Windows:

```powershell
Get-NetTCPConnection -LocalPort 25567
```

### Dashboard shows demo data

The browser could not reach `/api/stats`. Check the backend console, the port,
and whether the page was opened from the same host. Demo mode is intentional and
does not indicate a live bot session.

### Account stays at `CONNECTING` or `ERROR`

- Verify UID and password.
- Check the console for the exact login error.
- Clear `token_cache.json` and try again.
- Confirm the account region matches the selected server.
- Check whether the current game version changed the login flow.

### No match is found

- Check `REGION_ROTATION_LIST` and the account region.
- Increase `MAX_SEARCH_ATTEMPTS`.
- Restart the process.
- In `app.py`, the no-match watchdog restarts after `NO_MATCH_RESTART_TIMEOUT`
  seconds while accounts are online or searching.

### Team never fills

- All four accounts must be online and in the same region.
- Check the team invite logs.
- Increase `TEAM_PEER_WAIT_TIMEOUT` for slow logins.
- Do not run the two entry points against the same accounts.

### Token login fails

Access tokens expire. Remove the stale entry from `token_cache.json`, or add a
fresh token through the dashboard. Do not paste tokens into issues or chat.

### Unicode or emoji output looks broken on Windows

The scripts try to set UTF-8 output. If the console still corrupts characters,
run in Windows Terminal, or set:

```powershell
$env:PYTHONIOENCODING = "utf-8"
```

### `main.py` packet region patch did not apply

Older code referenced an undefined `CguFF_pb2` module. It has been changed to
`StartMatch_pb2.StartUDPMatch`, which now parses the Battle Royale start packet.
The broad `except Exception: pass` around that block still hides parse errors,
so check the console if region patching behaves unexpectedly.

---

## Security checklist

Read this before putting the bot on a VPS or sharing the repository.

1. **The dashboard has no authentication.** Anyone who can reach the port can
   add, delete, pause, or restart accounts.
2. **Bind to localhost when possible.** Change `WEB_HOST` from `0.0.0.0` to
   `127.0.0.1`, or put the dashboard behind a firewall, VPN, or authenticated
   reverse proxy.
3. **Do not expose ports `20333` or `25567` to the public internet.** The
   `dashboard_server.py` CORS policy is `Access-Control-Allow-Origin: *`.
4. **Treat `accounts.json`, `token_cache.json`, and `devices.json` as secrets.**
   They can contain UID/password pairs, access tokens, and account metadata.
5. **Rotate credentials if they were ever committed or shared.** Adding a file to
   `.gitignore` does not remove it from Git history. If this repository was
   pushed with real account data, rotate the passwords and tokens, then remove
   the files from the index and history before publishing.
6. **Use secondary accounts.** Automation can trigger bans or account locks.
7. **Review `GUEST_GEN_FIXED.py` before running it.** It is obfuscated, so its
   behavior cannot be audited by reading the source. Run it only if you trust the
   file and understand the risk.
8. **Do not run untrusted pull requests or "patched" copies.** The bot handles
   account credentials and network sessions.

### Remove credentials from a future commit

If `accounts.json` or `token_cache.json` is already tracked:

```bash
git rm --cached accounts.json token_cache.json
git commit -m "stop tracking runtime credentials"
```

This removes the files from the next commit, but old commits still contain them.
Rotate the credentials if the history was pushed anywhere.

---

## Code analysis

This section is a quick review of the current source, not a guarantee of
correctness.

### Architecture

```text
main.py
  ├── protocol / packet helpers
  ├── account login and session loops
  ├── team coordinator and match loop
  ├── imports dashboard_server.bot_state
  └── starts dashboard_server on 20333

app.py
  ├── own protocol / packet helpers
  ├── own BotState and account loops
  ├── auto-create guest account flow
  ├── match watchdog and process restart
  └── own aiohttp server on 25567

dashboard_server.py
  ├── BotState
  ├── EXP table and level progress
  ├── dashboard API handlers
  └── shared HTTP server for main.py

templates/index.html
  └── single-page dashboard, themes, demo fallback, API polling
```

### Strengths

- The dashboard is self-contained and does not require a Node build step.
- Account workers reconnect instead of failing permanently.
- Profile EXP is refreshed before and after matches.
- Device profiles and token caches reduce repeated login work.
- The dashboard has a demo fallback, so the UI is still inspectable when the
  backend is offline.
- `app.py` separates creation progress from normal account state.

### Risks and technical debt

1. **Two copies of the protocol layer.** `app.py` and `main.py` duplicate a large
   amount of packet, encryption, login, and match logic. Any protocol fix must be
   applied twice. The two files already have different timeout values and
   behavior.
2. **Two state models.** `main.py` uses `dashboard_server.bot_state`; `app.py`
   defines its own `BotState`. The dashboards therefore expose different APIs and
   can drift apart.
3. **No automated tests.** There is no test suite for packet encoding, login,
   team flow, or API handlers.
4. **Broad exception handlers.** Several critical blocks end in
   `except Exception: pass`. The old `CguFF_pb2` NameError was hidden this way.
   Failures can look like "nothing happened" instead of a clear error.
5. **Hardcoded configuration.** Ports, regions, clan ID, timeouts, and protocol
   keys live in source files. There is no environment-based configuration.
6. **Unpinned dependencies.** `requirements.txt` has no versions. A future
   `protobuf`, `aiohttp`, or `pycryptodome` release can break the runtime.
7. **No dashboard authentication.** The UI and API trust every request. CORS is
   open on the shared dashboard server.
8. **Plaintext credentials at rest.** `accounts.json` and `token_cache.json`
   store live secrets without encryption.
9. **Obfuscated helper.** `GUEST_GEN_FIXED.py` is not readable and cannot be
   reviewed with normal static analysis.
10. **Unofficial protocol dependency.** Garena can change packet formats, app
    versions, or registration endpoints at any time. Breakage is expected.
11. **Process restart in `app.py`.** The watchdog can restart the interpreter
    with `os.execv` or spawn a new process. Under a service manager this can
    produce duplicate processes if not supervised carefully.
12. **Large generated/static files.** `message_ids.py` and the protobuf modules
    are large and should be regenerated from source descriptors when possible.

### What was fixed during rebranding

- `main.py` referenced `CguFF_pb2`, which was never imported. It now uses the
  existing `StartMatch_pb2.StartUDPMatch` message class.
- `app.py` fallback HTML and `/api/ping` still used `RAW ANON`. They now use
  `SachinDev X FFFZ`.
- The dashboard title, boot screen, logo, watermark, ticker, log export name,
  storage keys, demo names, and placeholders were rebranded.
- `guild.py` now supports `FFFZ_GUILD_API` instead of requiring a source edit to
  change the upstream endpoint.
- `.gitignore` now excludes account credentials and token cache files.

---

## Rebranding map

| Old value | New value |
|---|---|
| `CODEXGOJO` | `SachinDev X FFFZ` |
| `CGU` | `SachinDev X FFFZ` |
| `TEAM RBC` | `SachinDev X FFFZ` |
| `RAW ANON` | `SachinDev X FFFZ` |
| Logo letter `C` | Logo letter `S` |
| `cgj_` localStorage prefix | `sdfz_` |
| `codexgojo-logs-*.txt` | `sachindev-x-fffz-logs-*.txt` |
| `GOJO MODE` | `FFFZ MODE` |
| `ANON•` nickname prefix | `FFFZ•` |
| Default password `ANON` | `FFFZ` |
| `Danger Guild Management` banner | `SachinDev X FFFZ — Guild Join Bot` |

The generated protobuf module names (`RbcFF_pb2`, `RbcTeam_pb2`, etc.) were not
renamed. Renaming them would break imports and generated descriptor references.
They are internal implementation names, not visible branding.

The default guild API host still contains the old upstream name because it is an
external service. Change it with `FFFZ_GUILD_API` only if you have a compatible
endpoint.

---

## FAQ

### Is this the same bot as before?

Yes. The runtime behavior is the same. This change is a rebrand plus a small
packet-import fix and documentation.

### Which file should I run?

Start with `main.py`. Use `app.py` if you need its account creation API or the
no-match watchdog.

### Can I run it on a VPS?

Yes, but bind the dashboard to localhost or protect it with a firewall and
reverse proxy. The dashboard has no login.

### Does it need a database?

No. State is kept in JSON files and in memory.

### Does it support more than four accounts?

The team size is currently four. `app.py` clamps account creation to four per
job. More accounts can be added, but the team flow is written around a
four-player squad.

### Why does the dashboard show fake accounts?

That is the demo fallback. It means the browser could not reach the backend API.
It does not mean the bot is running.

### Will my account get banned?

There is a real risk. This project automates gameplay through unofficial
protocols. Use secondary accounts and accept the risk.

### Why does account creation fail?

The registration flow depends on Garena endpoints and the current app version.
It can fail for a region, IP, device fingerprint, or rate-limit reason. Check the
console and try a different region or a fresh account.

### Can I change the dashboard port?

Yes. Edit `WEB_PORT` in `main.py` or `app.py` and open the new port.

### Can I change the brand again?

Search for `SachinDev X FFFZ` in `app.py`, `main.py`, `dashboard_server.py`,
`guild.py`, and `templates/index.html`. Also update the logo letter, localStorage
prefix, demo names, and download filename in the template.

---

## Credits

Rebranded for **SachinDev X FFFZ**.

Built on Python, asyncio, aiohttp, httpx, protobuf, and pycryptodome.

Use responsibly. Keep your credentials private.
