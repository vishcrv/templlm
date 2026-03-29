# branch - g-auth : what i broke, learnt.

> This branch is the official graveyard of the OAuth approach.  
> The CDP remote debugging approach works. This one didn't. Here's exactly why.

---

## what i was trying to do

Build a FastAPI server that:
1. Logs into ChatGPT using Google OAuth (automated, via Playwright)
2. Submits prompts and streams responses back via SSE
3. Persists the session so login only happens once

Simple idea. Turns out Google and Cloudflare have opinions about that.

---

## the stack i started with

- **Playwright** (Python async) — browser automation
- **playwright-stealth** — to mask automation fingerprints
- **Chromium** (Playwright's bundled browser) — default browser engine
- **Persistent context** (`launch_persistent_context`) — to save session to disk
- **Google OAuth** — the only login method available (account was created via Google)

---

## what went wrong

### 1. Resource Blocking Was Killing the Google Login Page

Early on, I blocked all `image`, `font`, and `media` resource types globally to speed up page loads. This is fine for ChatGPT itself.

**The problem:** Google's OAuth page (`accounts.google.com`) needs fonts and images to render. When those were blocked, the "Continue with Google" page would load the shell but the email input field never appeared — it just spun forever.

**Fix applied:** Exempted all Google domains from the resource block. That fixed the spinner.

But then the next wall appeared.

---

### 2. Chromium Is Not a Trusted Browser — Google Knows

After fixing the spinner, clicking "Continue with Google" gave:

> **"Couldn't sign you in. This browser or app may not be secure."**

This is Google's server-side bot detection, and it operates at a level that no stealth patch can fix:

- Google checks **TLS fingerprints** — Playwright's Chromium has a different fingerprint than real Chrome
- Google checks **browser binary signatures** — Chromium is not on Google's allowlist
- `playwright-stealth` patches JavaScript-level fingerprints (navigator.webdriver, etc.) but does nothing about the network/binary-level checks

Tried switching to `channel="chrome"` (real Chrome binary). Same result. Google's check runs before the page even fully loads — it's server-side, not client-side.

**This is a hard wall. No code fix gets past it.**

---

### 3. Stealth Wasn't Applied to the OAuth Popup

Secondary issue discovered alongside the above: when ChatGPT opens Google's auth, it spawns a **new popup page**. Stealth was only applied to the main page at startup, so the popup had zero stealth patches — making it even more obviously a bot.

Fixed this with a `context.on("page", ...)` listener that applied stealth to every new page automatically. Didn't matter in the end because of problem #2, but it was still a real bug.

---

### 4. Session Copy (Fix 3) — The Windows Problem

The fallback plan was to copy a real, already-authenticated Chrome profile into the project directory so Playwright inherits the Google session cookies without needing to log in at all.

On Linux this is straightforward. On Windows, the Chrome profile lives at:
```
C:\Users\<User>\AppData\Local\Google\Chrome\User Data\Default
```

The problem: Chrome locks its profile files while running. You have to fully kill every `chrome.exe` process before copying. Fiddly. Error-prone. And even after copying, Playwright's Chromium reading a real Chrome profile has compatibility edge cases.

This approach would have worked eventually but it's fragile — every Chrome update can change the profile format, and it requires manual intervention any time the session expires.

---

## Why OAuth-Via-Playwright Was the Wrong Approach Entirely

Stepping back: the whole OAuth automation idea has a fundamental conflict.

Google OAuth exists specifically to verify that a **human** is logging in. Every layer of their system — bot detection, TLS fingerprinting, CAPTCHA, "not secure browser" errors — is designed to stop exactly what I was trying to do.

Playwright's job is to automate browsers. Google's job is to detect automated browsers. These two things cannot coexist cleanly in an OAuth flow.

The more I patched around one detection layer, the more another one appeared. This is a cat-and-mouse game I was always going to lose.

---

## what actually works — CDP Remote Debugging

Instead of trying to automate login, the CDP (Chrome DevTools Protocol) approach sidesteps the problem entirely:

1. **Launch real Chrome manually** with remote debugging enabled:
   ```
   chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\chrome-cdp-profile"
   ```

2. **Log in to ChatGPT once, manually, in that Chrome window** — as a human, with your real browser, solving any CAPTCHAs yourself. Google sees a real Chrome. No issues.

3. **Connect Playwright to that already-running Chrome instance** via CDP:
   ```python
   browser = await playwright.chromium.connect_over_cdp("http://localhost:9222")
   ```

4. The session is saved in `chrome-cdp-profile`. Future runs just reconnect — no login needed again.

**why this works:**
- Google never sees automation. The login was done by a human in real Chrome.
- Playwright only takes control *after* auth is complete.
- The CDP connection gives full Playwright API access — `page.goto()`, `locator()`, streaming, everything works identically.
- Session persists in the Chrome profile directory indefinitely (until Google expires it).

---

## Lessons Summary

| What I tried | Why it failed |
|---|---|
| Automate Google OAuth with Playwright Chromium | Chromium binary is not trusted by Google — blocked at TLS/binary level |
| `playwright-stealth` to bypass detection | Only patches JS fingerprints, not network-level checks |
| `channel="chrome"` (real Chrome binary) | Google's check is server-side, binary channel didn't help |
| Block all resources for speed | Broke Google's auth page rendering (email input never appeared) |
| Copy Chrome profile on Windows | Fragile, file locking issues, maintenance burden |
| **CDP remote debugging** | **Works — human logs in once, Playwright connects after** |

---

## The Correct Mental Model

```
WRONG approach:   Playwright → tries to log in → Google blocks it
RIGHT approach:   Human logs in → Chrome saves session → Playwright connects to Chrome
```

Don't automate login. Automate everything *after* login. That's the boundary.

---

## Branch Status

This branch (`oauth-approach` or wherever this lives) is kept for reference only. The working implementation is on the CDP branch. do not try to revive this — the OAuth wall is real and not worth fighting.
