# Cross-platform UX overhaul — what changed

## session summary
date: 2026-03-29

---

## problem

The CLI (`templlm init`, `templlm "hello"`) did not work on Windows because:
1. Python was only detected as `python3`/`python`, missing the Windows `py` launcher
2. `postinstall.js` used Unix-only `which` command to find Python
3. Chrome detection used `which` (fails on Windows) and unexpanded `%LOCALAPPDATA%`
4. Version comparison bug: `parseFloat("3.11") < parseFloat("3.8")` evaluated to `true`
5. Server spawn didn't use `windowsHide` on Windows
6. Chrome profile dir was hardcoded (`/tmp` on Unix, `C:\temp` on Windows)
7. Users had to manually start the server in a separate terminal
8. No interactive REPL mode — only one-shot with separate `--stream` flag

---

## files changed

### new: `scripts/python.js`
Shared cross-platform Python detection module. Checks `python3`, `python`, and `py` (Windows launcher) in order. Uses proper integer-based semver comparison (major.minor) instead of `parseFloat` to avoid the 3.11 < 3.8 bug. All three consumers now import from here instead of duplicating detection logic.

### modified: `bin/cli.js` (full rewrite)
- **Interactive REPL**: `templlm` with no args opens a chat prompt (`> `) where users type prompts and get streaming responses. Type `exit` or Ctrl+C to quit.
- **One-shot streaming**: `templlm "hello"` streams the response and exits. No `--stream` flag needed — streaming is always on.
- **Auto-dependency install**: On first run, checks if `fastapi`, `uvicorn`, `playwright` are importable. If not, auto-runs `pip install -r requirements.txt` and `playwright install chromium`.
- **Auto-server start with diagnostics**: Server starts in background with logs captured to `$TMPDIR/templlm-server.log`. If startup fails, the last 20 lines of the log are printed instead of a useless "timed out" message.
- **Uses shared `scripts/python.js`** instead of inline detection.
- **`windowsHide: true`** on spawn for proper Windows background process.
- **Colour support detection**: Colours only emitted if stdout is a TTY.

### modified: `scripts/init.js`
- **Uses shared `scripts/python.js`** instead of inline `detectPython()`.
- **Chrome detection**: `which` replaced with `where` on Windows, `which` on Unix.
- **`%LOCALAPPDATA%`**: Now uses `process.env.LOCALAPPDATA` with null guard — skips the path entirely if env var is undefined instead of creating an invalid relative path.
- **Chrome profile dir**: Uses `os.tmpdir()` instead of hardcoded `/tmp` or `C:\temp`.
- **Chrome command quoting**: Always quotes `--user-data-dir` path (handles spaces on all platforms).

### modified: `scripts/postinstall.js`
- Replaced broken `which`-based Python detection with shared `scripts/python.js`.
- Prints detected Python binary and version.

### modified: `package.json`
- No structural changes (the `scripts/` glob already includes `python.js`).

---

## user experience before vs after

| before | after |
|--------|-------|
| `templlm "hello"` → "server did not become ready" | `templlm "hello"` → auto-installs deps, starts server, streams response |
| `templlm` with no args → prints help and exits | `templlm` → interactive chat REPL with streaming |
| Must run `python run.py` in separate terminal | Server auto-starts in background |
| Server failure shows "timed out" with no details | Shows last 20 lines of server log |
| `--stream` flag required for streaming | Always streams (flag removed) |
| `templlm init` fails on Windows ("Python not found") | Detects `py` launcher, works on all platforms |
| Python version 3.11 rejected as "too old" | Fixed integer-based version comparison |

---

## architecture

```
User runs `templlm` or `templlm "prompt"`
  │
  ├─ detectPython() → finds python3 / python / py
  │
  ├─ ensureServer()
  │    ├─ Port 8000 open? → skip
  │    ├─ Check deps importable? → if not, pip install + playwright install
  │    └─ Spawn python run.py in background (logs to tmpdir)
  │
  └─ prompt given? → streamResponse() one-shot
     no prompt?    → repl() interactive chat loop
```
