<div align="center">

# tempLLM

**local llm api for testing & demos**

spin it up · hit an endpoint · get a response

</div>

---

## overview

templlm wraps an llm session in a fastapi server that drives a live browser session via playwright and exposes 
the responses as clean rest endpoints. no sdk, no api key.

built for internal testing, rapid prototyping, and
wiring llm responses into tools or demos without production overhead.



## requirements

| dependency | version |
|------------|---------|
| python | 3.11+ |
| google chrome | any recent |

---

## quickstart

```bash
# 1. install dependencies
pip install -r requirements.txt
playwright install chromium

# 2. configure
cp .env.example .env

# 3. start
python run.py
```

when you see this, you're ready:

```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## connection modes

templlm picks its mode automatically on startup — **no config changes needed between them.**

<br>

### ✦ mode a — authenticated *(recommended)*

you open a chrome window with remote debugging, log in once, then start the server.
the server connects to that live session.

<br>

**step 1 — open the debug chrome window**

> this is an isolated chrome profile. it won't touch your regular browser.

<details>
<summary>windows — powershell</summary>

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir=C:\temp\chrome-cdp-profile
```

</details>

<details>
<summary>windows — cmd</summary>

```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\temp\chrome-cdp-profile
```

</details>

<details>
<summary>linux</summary>

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp-profile
```

</details>

<br>

**step 2 — log in**

in that chrome window, navigate to the llm provider's site and sign in with your account.

**step 3 — start the server**

```bash
python run.py
```

the server will detect the open chrome window and connect automatically.

> **tip:** you only need to log in once. the profile is saved to `--user-data-dir`, so next time you run the chrome command it'll already be authenticated.

<br>

### ✦ mode b — unauthenticated *(fallback)*

don't open the debug chrome window. just run `python run.py` directly.

the server launches its own chromium instance in the background.
no login is performed — sessions are limited to what's available without authentication.

---

## endpoints

| method | endpoint | description |
|--------|----------|-------------|
| `POST` | `/ask` | full json response |
| `POST` | `/ask/stream` | server-sent events (sse) stream |
| `GET` | `/health` | server & browser status |
| `POST` | `/screenshot` | saves a debug screenshot, returns path |
| `POST` | `/session/invalidate` | clears saved session |

interactive docs → [`http://localhost:8000/docs`](http://localhost:8000/docs)

---

## test api

### postman

```
POST  http://localhost:8000/ask
Body  raw → JSON
```

```json
{
  "prompt": "give me a code for bubble sort"
}
```

```json
{
  "status": "ok",
  "response": "...",
  "error": null
}
```

<br>

### curl

<details>
<summary>linux / macos</summary>

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "give me a code for bubble sort"}'
```

</details>

<details>
<summary>windows — powershell</summary>

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/ask `
  -ContentType "application/json" `
  -Body '{"prompt": "give me a code for bubble sort"}'
```

</details>

<details>
<summary>windows — cmd</summary>

```cmd
curl -X POST http://localhost:8000/ask -H "Content-Type: application/json" -d "{\"prompt\": \"give me a code for bubble sort\"}"
```

</details>

<br>

### test_client.py

included in the repo, stdlib only — no extra installs.

```bash
# json response
python test_client.py "give me a code for bubble sort"

# streaming response
python test_client.py --stream "give me a code for bubble sort"
```

---

## configuration

all options live in `.env`:

```dotenv
# ── mode ──────────────────────────────────────────────────────────────────────
# point to your remote debug chrome instance (mode a).
# if chrome isn't running, the server falls back to mode b automatically.
CDP_URL=http://localhost:9222

# ── browser ───────────────────────────────────────────────────────────────────
HEADLESS=false          # false shows the browser window in mode b
SESSION_FILE=./session.json

# ── tuning ────────────────────────────────────────────────────────────────────
SLOW_MO=0
RESPONSE_TIMEOUT=120

# ── server ────────────────────────────────────────────────────────────────────
HOST=0.0.0.0
PORT=8000
```

---

## project structure

```
templlm/
│
├── app/
│   ├── main.py          fastapi app + lifespan
│   ├── config.py        env config
│   ├── models.py        pydantic schemas
│   ├── browser.py       playwright automation + mode detection
│   └── routes/
│       └── ask.py       all endpoints
│
├── run.py               entry point
├── test_client.py       cli test client
└── .env                 your local config
```
