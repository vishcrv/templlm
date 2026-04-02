<div align="center">

# tempLLM

**local llm api — no sdk, no api key**

spin up a local server · hit clean REST endpoints · get responses

[![npm version](https://img.shields.io/npm/v/templlm)](https://www.npmjs.com/package/templlm)

</div>

---

## how it works

templlm drives a live browser session via Playwright and exposes it as a FastAPI server with REST endpoints. the `templlm` CLI talks to that server over HTTP.

```
templlm "prompt"  →  POST /ask  →  FastAPI server  →  Playwright  →  ChatGPT  →  response
```

---

## requirements

| dependency | version | notes |
|------------|---------|-------|
| Node.js    | 18+     | runs the CLI |
| Python     | 3.8+    | runs the server |
| Google Chrome | any recent | for authenticated mode (recommended) |

---

## install

templlm is published on npm — no cloning required.

```bash
npm install -g templlm
```

Dependencies (Python packages + Playwright browser) are installed automatically. Once done you'll see:

```
✓ Ready!

Get started:
  templlm init      ← run this first to set up your browser & login
  templlm --help    ← all commands
```

Then run the setup wizard:

```bash
templlm init
```

### install from source

```bash
git clone https://github.com/vishcrv/tempLLM.git
cd tempLLM
npm install -g .
templlm init
```

### updating

```bash
npm update -g templlm
```

---

## platform setup

<details>
<summary><strong>Linux</strong></summary>

```bash
# Arch / Manjaro
sudo pacman -S python python-pip nodejs npm
yay -S google-chrome          # for Mode A (CDP)

# Ubuntu / Debian
sudo apt install python3 python3-pip nodejs npm
# Chrome: https://google.com/chrome

# Fedora
sudo dnf install python3 python3-pip nodejs npm
sudo dnf install google-chrome-stable

npm install -g templlm
templlm init
```

**PATH note:** npm global bins land in `~/.local/bin`. Make sure it's in your PATH:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc   # bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc    # zsh
source ~/.bashrc   # or open a new terminal
```

</details>

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install python node
brew install --cask google-chrome    # for Mode A (CDP)

npm install -g templlm
templlm init
```

</details>

<details>
<summary><strong>Windows</strong></summary>

```powershell
winget install Python.Python.3
winget install OpenJS.NodeJS
winget install Google.Chrome        # for Mode A (CDP)

npm install -g templlm
templlm init
```

Or via [Chocolatey](https://chocolatey.org/):

```powershell
choco install python nodejs googlechrome
npm install -g templlm
templlm init
```

**Note:** Run PowerShell as Administrator for global npm installs, or configure a user-local npm prefix:

```powershell
npm config set prefix "$env:APPDATA\npm"
# add %APPDATA%\npm to your PATH in System Environment Variables
```

</details>

---

## commands

```bash
templlm init                    # first-time setup wizard (mode + browser + login)
templlm setup                   # re-run login wizard (session expired)
templlm "your prompt"           # one-shot prompt — always opens a new chat
templlm                         # interactive REPL — context retained across messages
templlm status                  # check API status, start or stop the server
templlm stop                    # kill the background server (+ browser in CDP mode)
templlm logs                    # tail the server log file live
templlm --version               # print installed version
templlm --help                  # show all commands and examples
```

The server starts automatically in the background when you send a prompt. No need to run `python run.py` manually.

---

## setup wizard

`templlm init` detects your OS and walks you through everything:

```
┌────────────────────────────────────────┐
│          templlm  ·  setup wizard       │
└────────────────────────────────────────┘

Detected OS:  Windows
Python:       ✓ 3.12  (python3)

Which connection mode?
  1  Mode A — CDP  (recommended)  Connect to your own Chrome with an active session
  2  Mode B — Headless            Playwright launches Chromium in the background
```

It launches Chrome with remote debugging, waits for you to log in, then writes `.env` automatically.

---

## connection modes

### mode A — CDP (recommended)

Connect to your existing Chrome with a live logged-in session. `templlm init` handles launching Chrome for you. To do it manually:

<details>
<summary>Linux</summary>

```bash
google-chrome-stable --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp-profile
```

</details>

<details>
<summary>macOS</summary>

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp-profile
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir=C:\temp\chrome-cdp-profile
```

</details>

Log in to ChatGPT in that window, then run `templlm init` or set `CDP_URL=http://localhost:9222` in `.env`.

> The Chrome profile is saved — you only log in once.

### mode B — headless

No Chrome needed. Playwright manages its own Chromium in the background. Session is limited to unauthenticated access unless you have a saved `session.json`.

---

## endpoints

| method | endpoint | description |
|--------|----------|-------------|
| `POST` | `/ask` | full JSON response |
| `POST` | `/ask/stream` | server-sent events (SSE) stream |
| `GET`  | `/health` | server & browser status |
| `POST` | `/screenshot` | debug screenshot, returns path |
| `POST` | `/session/invalidate` | clear saved session |

Interactive docs → `http://localhost:8000/docs`

---

## test the api

```bash
# Linux / macOS
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "give me a bubble sort"}'
```

```powershell
# Windows PowerShell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/ask `
  -ContentType "application/json" `
  -Body '{"prompt": "give me a bubble sort"}'
```

```bash
# Python test client
python test_client.py "give me a bubble sort"
```

---

## configuration

```dotenv
# .env

CDP_URL=http://localhost:9222   # blank = Mode B (headless)

HEADLESS=false                  # true = no visible browser in Mode B
SESSION_FILE=./session.json
SLOW_MO=0
RESPONSE_TIMEOUT=120

HOST=0.0.0.0
PORT=8000
```

---

## project structure

```
tempLLM/
│
├── app/
│   ├── main.py          FastAPI app + lifespan
│   ├── config.py        env config
│   ├── models.py        pydantic schemas
│   ├── browser.py       Playwright automation + mode detection
│   └── routes/
│       └── ask.py       endpoints
│
├── bin/
│   └── cli.js           CLI entry point
│
├── scripts/
│   ├── init.js          setup wizard (templlm init / setup)
│   ├── status.js        status + supervisor (templlm status)
│   ├── browser.js       Chrome detection + CDP launch
│   ├── deps.js          Python dependency installer
│   ├── python.js        Python binary detection
│   └── postinstall.js   runs on npm install -g
│
├── run.py               server entry point
├── requirements.txt     Python dependencies
└── package.json         npm package
```
