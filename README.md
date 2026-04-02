<div align="center">
  <br />
  <h1>tempLLM</h1>
  <p><strong>a free, local LLM API — no key, no cost, no SDK.</strong></p>
  <p>Spin up a server once. Hit REST endpoints from any project, any language, forever.</p>
  <br />

  [![npm version](https://img.shields.io/npm/v/templlm?style=flat-square&color=black)](https://www.npmjs.com/package/templlm)
  [![npm downloads](https://img.shields.io/npm/dm/templlm?style=flat-square&color=black)](https://www.npmjs.com/package/templlm)
  [![license](https://img.shields.io/npm/l/templlm?style=flat-square&color=black)](./LICENSE)
  [![node](https://img.shields.io/badge/node-18%2B-black?style=flat-square)](https://nodejs.org)

  <br />
</div>

---

## Overview

tempLLM uses the **Chrome DevTools Protocol (CDP)** to drive a real browser session and exposes it as a local HTTP API. Call it from Python, JavaScript, Go, curl — anything that can make an HTTP request gets free LLM access.

```
your app  ──►  POST localhost:8000/ask  ──►  templlm  ──►  CDP  ──►  browser  ──►  LLM  ──►  response
```

No API key. No billing page. No rate limit emails. Just a local server you own and control.

> **Disclaimer:** tempLLM is a personal learning project built to explore browser automation with Playwright and the Chrome DevTools Protocol. It is intended strictly for **educational and experimental use**. This project is not affiliated with, endorsed by, or sponsored by OpenAI. Users are responsible for complying with OpenAI's Terms of Service. The author does not encourage using this tool in ways that violate any platform's terms.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Terminal Usage](#terminal-usage)
- [API Usage](#api-usage)
- [Endpoints](#endpoints)
- [Supported Models](#supported-models)
- [Installation](#installation)
- [Setup](#setup)
- [Connection Modes](#connection-modes)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)
- [Platform Setup](#platform-setup)

---

## Quick Start

```bash
npm install -g templlm   
templlm init             # one-time setup 
```

That's it. The server starts automatically the first time you use it.

---

## Terminal Usage

No code needed. Use it straight from your terminal.

**Quick one-liners:**

```bash
templlm "what's the difference between Promise.all and Promise.allSettled?"
templlm "write a debounce function in TypeScript with proper types"
templlm "explain what EXPLAIN ANALYZE does in Postgres"
```

**Interactive session** (context retained across messages):

```bash
$ templlm
```

```
you  > I'm getting "cannot read properties of undefined (reading 'map')" in React

llm  > You're likely rendering before your data loads.
       Add a guard before the map: if (!data) return null

you  > state is initialised as undefined, would that cause it?

llm  > Yes. Change useState() to useState([])
       Undefined breaks .map() — an empty array won't.

you  > should I even use useEffect for fetching or is there something better?

llm  > Fine for simple cases. For anything serious, use React Query or SWR.
       They handle loading states, caching, and refetching out of the box.
```

---

## API Usage

Once the server is running, your projects can talk to it directly.

**Python**
```python
import requests

response = requests.post("http://localhost:8000/ask", json={
    "prompt": "summarise this in 3 bullet points: ..."
})

print(response.json()["response"])
```

**JavaScript / Node**
```javascript
const res = await fetch("http://localhost:8000/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "refactor this function: ..." })
});

const { response } = await res.json();
```

**Streaming (SSE)**
```javascript
const res = await fetch("http://localhost:8000/ask/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "write me a sorting algorithm" })
});

for await (const chunk of res.body) {
  process.stdout.write(new TextDecoder().decode(chunk));
}
```

**curl**
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "give me a bubble sort in Python"}'
```

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ask` | Full response as JSON |
| `POST` | `/ask/stream` | Streaming response via SSE |
| `GET` | `/health` | Server + browser status |
| `POST` | `/screenshot` | Debug screenshot |
| `POST` | `/session/invalidate` | Clear saved session |

> Interactive API docs available at `http://localhost:8000/docs` when the server is running.

---

## Models & Features

**LLMs**

| | Status |
|---|--------|
| ChatGPT | live |
| Claude | working on it |

**Features**

| | Status |
|---|--------|
| Model switching — choose your LLM and model per request | working on it |

---

## Installation

tempLLM is on npm. Python dependencies and the Playwright browser install automatically on first run.

```bash
npm install -g templlm
```

> first install takes ~3-5 minutes — pip packages + Chromium download. subsequent installs are instant.

After install you'll see:

```
✓ Ready!

  templlm init      ← run this first to set up your browser & login
  templlm --help    ← see all commands
```

**Requirements**

| Dependency | Version |
|------------|---------|
| Node.js | 18+ |
| Python | 3.8+ |
| Google Chrome | Latest (for CDP mode) |

**Updating**

```bash
npm update -g templlm
```

---

## Setup

Run once after install:

```bash
templlm init
```

```
┌────────────────────────────────────────┐
│          templlm  ·  setup wizard       │
└────────────────────────────────────────┘

Detected OS:  Windows
Python:       ✓ 3.12  (python3)

Which connection mode?

  1  Mode A — CDP  (recommended)
     Connect to your own Chrome with an active session

  2  Mode B — Headless
     Playwright launches Chromium in the background
```

The wizard launches Chrome, waits for you to log in, and saves your session. **You only do this once.**

If your session expires later, just run `templlm setup` to log in again.

---

## Connection Modes

### Mode A — CDP *(recommended)*

Uses the **Chrome DevTools Protocol** to attach to a running Chrome instance via a remote debugging port (`--remote-debugging-port=9222`). Playwright connects over WebSocket and controls it directly — no new process, just your existing browser.

`templlm init` launches Chrome with the right flags automatically. You log in once, session is saved.

- Works with your real logged-in accounts
- Session persists across restarts, no re-login needed
- Fastest and most stable

### Mode B — Headless

Playwright spawns its own Chromium process in the background. No Chrome install required.

- Good for servers or CI environments
- Unauthenticated by default unless you supply a saved `session.json`

---

## CLI Reference

```
templlm init              First-time setup wizard
templlm setup             Re-run login flow (session expired)
templlm status            Check API status — start or stop the server
templlm stop              Kill the background server
templlm logs              Tail the server log file live
templlm "prompt"          One-shot prompt (always a fresh chat)
templlm                   Interactive REPL (context retained)
templlm --version         Print version
templlm --help            Show all commands
```

---

## Configuration

`templlm init` creates a `.env` file automatically. You can edit it manually:

```dotenv
CDP_URL=http://localhost:9222   # leave blank for headless mode

HEADLESS=false                  # show/hide browser window in headless mode
SESSION_FILE=./session.json     # where to persist your login session
RESPONSE_TIMEOUT=120            # seconds before a request times out
HOST=0.0.0.0
PORT=8000
```

---

## Platform Setup

<details>
<summary><b>Linux</b></summary>
<br />

```bash
# Arch / Manjaro
sudo pacman -S python python-pip nodejs npm
yay -S google-chrome

# Ubuntu / Debian
sudo apt install python3 python3-pip nodejs npm
# Chrome → https://google.com/chrome

# Fedora
sudo dnf install python3 python3-pip nodejs npm
sudo dnf install google-chrome-stable
```

> **PATH note:** npm global binaries land in `~/.local/bin` on some distros. If `templlm` is not found after install:
> ```bash
> echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
> ```

</details>

<details>
<summary><b>macOS</b></summary>
<br />

```bash
brew install python node
brew install --cask google-chrome

npm install -g templlm
templlm init
```

</details>

<details>
<summary><b>Windows</b></summary>
<br />

```powershell
winget install Python.Python.3
winget install OpenJS.NodeJS
winget install Google.Chrome

npm install -g templlm
templlm init
```

> **Note:** Run PowerShell as Administrator for global npm installs, or configure a user-level prefix:
> ```powershell
> npm config set prefix "$env:APPDATA\npm"
> # then add %APPDATA%\npm to PATH in System Environment Variables
> ```

</details>

---

