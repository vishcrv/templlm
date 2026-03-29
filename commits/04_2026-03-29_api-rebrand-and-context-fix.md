# Update: API Rebrand, Context Management & Status CLI

**Date:** March 29, 2026

## 1. Auto-Bootstrapping Pip
**Why:** The setup wizard (`templlm init`) and the background server runner (`bin/cli.js`) were failing silently or erroring out for users installing templlm on fresh Python 3.13 environments lacking `pip`. 
**How:** Added a safe validation block that attempts `python -m pip --version`. If it fails, the script automatically self-heals by running `python -m ensurepip --upgrade` before attempting to resolve `requirements.txt`.

## 2. Differentiated Chat Context 
**Why:** Users noted that running repetitive prompts inside the interactive `templlm` session dropped the context of the previous request and started a brand new chat.
**How:** 
- Added a `new_chat: bool` flag to the `AskRequest` Pydantic model. 
- Passed this flag from the Node CLI through the FastAPI backend directly to Playwright. 
- `templlm` (interactive) sets this to `false`, causing Playwright to type into the existing `chatgpt.com` window and preserve history.
- `templlm "prompt"` (one-shot) sets this to `true`, actively redirecting Playwright to `/?model=auto` to ensure solitary, pristine runs.

## 3. Rebranding & API Advertisement
**Why:** The goal is to highlight `templlm` as a powerful generic API wrapper for high-end LLMs, rather than merely a "ChatGPT terminal clone."
**How:** 
- Refactored UI copy across the Python standard client and Node CLI wrappers from "ChatGPT CLI" to "LLM in your terminal".
- Added a bold, green console broadcast on every prompt triggering the backend successfully: `● API is ACTIVE at http://0.0.0.0:8000` to actively encourage API integration into external apps.

## 4. Server Status Utility
**Why:** Users lacked visibility into whether the background Python engine was bound to the port or draining system memory unnecessarily.
**How:** 
- Created `scripts/status.js` and wired it to `templlm status`. 
- Performs a swift TCP socket test on `127.0.0.1:8000`. 
- Features a graceful `(Y/n)` prompt allowing users to spawn the orchestrator or kill the background process (`pkill` / `Stop-Process`) effortlessly.


easy to undeerstand:
1. i fixed a python version err : auto bootstrap pip
2. for terminal interactive llm, i made a change so tht the next propmts stay in the same chat not like go and create new chat for every llm call. to preserve context nigga :)
3. i felt like we need to know when the server is running or not so i created a new script called status, so when called it tellls the status and provides you a choice to kill or boot.
