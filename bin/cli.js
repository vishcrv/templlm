#!/usr/bin/env node
"use strict";

const http     = require("http");
const net      = require("net");
const path     = require("path");
const fs       = require("fs");
const os       = require("os");
const readline = require("readline");
const { spawn }          = require("child_process");
const { detectPython }   = require("../scripts/python");
const { getMode, ensureBrowser } = require("../scripts/browser");
const { ensureDeps }     = require("../scripts/deps");
const { version }        = require("../package.json");

const HOST     = "127.0.0.1";
const PORT     = 8000;
const ENDPOINT = `http://${HOST}:${PORT}`;
const ROOT     = path.join(__dirname, "..");
const LOG_FILE = path.join(os.tmpdir(), "templlm-server.log");
const PYTHON   = (detectPython() || {}).bin || "python";

// ── Colours ──────────────────────────────────────────────────────────────────
const c = process.stdout.isTTY ? {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", red: "\x1b[31m",
} : { reset:"", bold:"", dim:"", green:"", yellow:"", cyan:"", red:"" };

// ── Network helpers ───────────────────────────────────────────────────────────

function isPortOpen() {
  return new Promise(resolve => {
    const s = net.createConnection(PORT, HOST);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error",   () => resolve(false));
  });
}

function httpGet(urlPath) {
  return new Promise(resolve => {
    http.get(`${ENDPOINT}${urlPath}`, res => resolve(res.statusCode))
        .on("error", () => resolve(null));
  });
}

async function waitForServer(timeoutSecs = 90) {
  const deadline = Date.now() + timeoutSecs * 1000;
  while (Date.now() < deadline) {
    if (await httpGet("/health") !== null) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// ── Server management ─────────────────────────────────────────────────────────

async function ensureServer() {
  if (await isPortOpen()) return;

  const runPy = path.join(ROOT, "run.py");
  if (!fs.existsSync(runPy)) {
    console.error(`${c.red}Error:${c.reset} run.py not found. Reinstall: npm install -g templlm`);
    process.exit(1);
  }

  ensureDeps(PYTHON, c);

  const logFd = fs.openSync(LOG_FILE, "w");
  const child = spawn(PYTHON, [runPy], {
    detached:    true,
    stdio:       ["ignore", logFd, logFd],
    cwd:         ROOT,
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(logFd);

  process.stderr.write(`${c.dim}Starting server...${c.reset}`);
  const tick = setInterval(() => process.stderr.write("."), 1000);
  const ready = await waitForServer(90);
  clearInterval(tick);
  process.stderr.write("\n");

  if (!ready) {
    console.error(`${c.red}Server failed to start.${c.reset}`);
    if (fs.existsSync(LOG_FILE)) {
      const log = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").slice(-20).join("\n");
      if (log) {
        console.error(`\n${c.dim}── server log ──${c.reset}`);
        console.error(log);
        console.error(`${c.dim}────────────────${c.reset}\n`);
      }
    }
    console.error(`Full log: ${c.dim}${LOG_FILE}${c.reset}`);
    process.exit(1);
  }
}

async function ensureBackend() {
  const mode = getMode();
  if (mode === "cdp") {
    const ok = await ensureBrowser();
    if (!ok) {
      console.error(`${c.red}CDP mode set but Chrome not found.${c.reset} Run \`templlm init\` to reconfigure.`);
      process.exit(1);
    }
  }
  await ensureServer();
}

// ── HTTP post ─────────────────────────────────────────────────────────────────

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body);
    const options = {
      hostname: HOST, port: PORT, path: urlPath, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    };
    const req = http.request(options, resolve);
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Streaming response ────────────────────────────────────────────────────────

async function streamResponse(prompt, new_chat = false) {
  const res = await post("/ask/stream", { prompt, new_chat });
  let event = "";
  let buf   = "";

  return new Promise((resolve, reject) => {
    res.on("data", chunk => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop();

      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith("event:")) { event = t.slice(6).trim(); continue; }
        if (!t.startsWith("data:"))  continue;

        let data;
        try { data = JSON.parse(t.slice(5).trim()); } catch { data = { raw: t.slice(5).trim() }; }

        if      (event === "message") process.stdout.write((data.delta ?? "").replace(/\\n/g, "\n"));
        else if (event === "done")    { process.stdout.write("\n"); resolve(); return; }
        else if (event === "error")   { reject(new Error(data.error || "Server error")); return; }
      }
    });

    res.on("end", resolve);
    res.on("error", reject);
  });
}

// ── Interactive REPL ──────────────────────────────────────────────────────────

async function repl() {
  console.log(`${c.bold}${c.cyan}templlm${c.reset} ${c.dim}— type a prompt and press Enter · Ctrl+C to exit${c.reset}\n`);

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: `${c.green}> ${c.reset}`,
  });

  let firstMessage = true;
  rl.prompt();

  rl.on("line", async line => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    if (input === "exit" || input === "quit") { rl.close(); return; }

    rl.pause();
    try {
      process.stdout.write(`\n${c.cyan}`);
      await streamResponse(input, firstMessage);
      firstMessage = false;
      process.stdout.write(`${c.reset}\n`);
    } catch (err) {
      console.error(`\n${c.red}Error: ${err.message}${c.reset}\n`);
    }
    rl.resume();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(`\n${c.dim}Bye!${c.reset}`);
    process.exit(0);
  });
}

// ── Help ──────────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${c.bold}${c.cyan}templlm${c.reset} v${version} — LLM in your terminal

${c.bold}Usage:${c.reset}
  ${c.cyan}templlm init${c.reset}              First-time setup wizard (choose mode, open browser)
  ${c.cyan}templlm setup${c.reset}             Re-run login flow (session expired)
  ${c.cyan}templlm "prompt"${c.reset}          Send a one-shot prompt (opens a new chat)
  ${c.cyan}templlm${c.reset}                   Interactive REPL — context retained across messages
  ${c.cyan}templlm status${c.reset}            Check API status / start or stop the server
  ${c.cyan}templlm stop${c.reset}              Kill the background server (and browser if CDP mode)
  ${c.cyan}templlm logs${c.reset}              Tail the server log file
  ${c.cyan}templlm --version${c.reset}         Print version
  ${c.cyan}templlm --help${c.reset}            Show this help

${c.bold}Examples:${c.reset}
  templlm init
  templlm "summarise this file: $(cat README.md)"
  templlm
  templlm stop
`);
}

// ── Logs ──────────────────────────────────────────────────────────────────────

function tailLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`${c.dim}No log file found. Start the server first.${c.reset}`);
    return;
  }

  process.stdout.write(fs.readFileSync(LOG_FILE, "utf8"));

  let size = fs.statSync(LOG_FILE).size;
  console.log(`\n${c.dim}─── watching for new output (Ctrl+C to exit) ───${c.reset}`);

  const watcher = fs.watch(LOG_FILE, () => {
    try {
      const newSize = fs.statSync(LOG_FILE).size;
      if (newSize <= size) return;
      const fd  = fs.openSync(LOG_FILE, "r");
      const buf = Buffer.alloc(newSize - size);
      fs.readSync(fd, buf, 0, buf.length, size);
      fs.closeSync(fd);
      process.stdout.write(buf.toString());
      size = newSize;
    } catch {}
  });

  process.on("SIGINT", () => { watcher.close(); process.exit(0); });
}

// ── Stop ──────────────────────────────────────────────────────────────────────

async function stopAll() {
  // Defer to status.js's exported helpers to avoid duplication
  const { stopAll: _stop } = require("../scripts/status");
  const mode = getMode();
  await _stop(mode);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd  = args[0];

if (cmd === "--help" || cmd === "-h") {
  showHelp();
  process.exit(0);
}

if (cmd === "--version" || cmd === "-v") {
  console.log(`templlm v${version}`);
  process.exit(0);
}

if (cmd === "init" || cmd === "setup") {
  // init.js exports nothing — auto-runs on require, which is intentional
  require("../scripts/init.js");

} else if (cmd === "status") {
  const { run } = require("../scripts/status.js");
  run().catch(e => { console.error(e.message); process.exit(1); });

} else if (cmd === "stop") {
  (async () => {
    await stopAll();
    process.exit(0);
  })();

} else if (cmd === "logs") {
  tailLogs();

} else {
  // One-shot prompt or interactive REPL
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.log(`\n${c.bold}Welcome to templlm!${c.reset}`);
    console.log(`Run ${c.cyan}templlm init${c.reset} first to set things up.\n`);
    process.exit(0);
  }

  const prompt = args.join(" ");

  (async () => {
    try {
      await ensureBackend();

      if (prompt) {
        await streamResponse(prompt, true);
      } else {
        await repl();
      }
    } catch (err) {
      console.error(`${c.red}Error: ${err.message}${c.reset}`);
      process.exit(1);
    }
  })();
}
