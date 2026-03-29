# browser.py — what changed

## root cause
chromium flags `--no-sandbox` and `--disable-dev-shm-usage` were always passed, even on windows. these are linux-only — on windows they silently prevent the browser window from appearing in mode b.

## fixes

| what | before | after |
|------|--------|-------|
| linux-only flags on windows | always added | skipped via `platform.system()` check in `_chromium_args()` |
| route handler | inline lambda (closure-prone) | named `async def _block_heavy_resources()` |
| cleanup before mode b fallback | partial — missed resetting `_page` | full `_cleanup_browser()` resets all three handles |
| screenshot paths | `/tmp/` (linux-only) | `./` (works on windows + linux) |
| `stop()` | duplicated cleanup logic | calls `_cleanup_browser()` then stops playwright |

## mode a/b detection — replaced with http pre-flight probe

old approach tried `connect_over_cdp()` directly and waited for playwright's timeout (up to 30s) before falling back to mode b.

new `_cdp_is_reachable()` does a plain `GET /json/version` on the cdp port first (stdlib `urllib`, no playwright). if the port is closed it fails in <5ms.

| scenario | before | after |
|----------|--------|-------|
| chrome not running | waits up to 30s | fails in <5ms |
| chrome running | works | works |
| no `CDP_URL` set | goes straight to b | goes straight to b |
| extra dependency | — | none (`urllib` is stdlib) |

## startup decision tree

```
CDP_URL set?
  ├─ yes → http get /json/version  (<5ms)
  │          ├─ 200 ok   → mode a (cdp connect)
  │          │               └─ connect fails anyway? → mode b
  │          └─ refused  → mode b immediately
  └─ no  → mode b directly
```

no `.env` changes needed.