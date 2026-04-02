#!/usr/bin/env node
"use strict";

const http     = require("http");
const net      = require("net");
const path     = require("path");
const readline = require("readline");
const os       = require("os");
const fs       = require("fs");
const { spawnSync, spawn } = require("child_process");
const { detectPython }     = require("./python");
const { getMode, ensureBrowser, CDP_PORT } = require("./browser");
const { ensureDeps }       = require("./deps");

const HOST     = "127.0.0.1";
const PORT     = 8000;
const ROOT     = path.join(__dirname, "..");
const LOG_FILE = path.join(os.tmpdir(), "templlm-server.log");
const PYTHON   = (detectPython() || {}).bin || "python";

// ── Colours ───────────────────────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  red:    "\x1b[31m",
};

function isPortOpen(port = PORT) {
  return new Promise(resolve => {
    const s = net.createConnection(port, HOST);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error",   () => resolve(false));
  });
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function confirm(rl, question, defaultYes = true) {
  const hint = defaultYes ? "(Y/n)" : "(y/N)";
  const ans  = (await prompt(rl, `${c.bold}${question}${c.reset} ${c.dim}${hint}${c.reset} `)).trim().toLowerCase();
  if (!ans) return defaultYes;
  return ans === "y" || ans === "yes";
}

async function startServer() {
  const runPy = path.join(ROOT, "run.py");
  ensureDeps(PYTHON, c);
  process.stdout.write(`${c.dim}Starting server${c.reset}`);

  const logFd = fs.openSync(LOG_FILE, "w");
  const child = spawn(PYTHON, [runPy], {
    detached:    true,
    stdio:       ["ignore", logFd, logFd],
    cwd:         ROOT,
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(logFd);

  for (let i = 0; i < 30; i++) {
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 1000));
    if (await isPortOpen(PORT)) {
      process.stdout.write(`\n${c.green}● Server started at http://${HOST}:${PORT}${c.reset}\n`);
      return true;
    }
  }
  process.stdout.write(`\n${c.red}Failed to start server. Check logs: ${LOG_FILE}${c.reset}\n`);
  return false;
}

function killServer() {
  if (process.platform === "win32") {
    spawnSync("powershell.exe", [
      "-Command",
      "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match 'run.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    ], { stdio: "ignore" });
  } else {
    spawnSync("pkill", ["-f", "run.py"], { stdio: "ignore" });
  }
}

function killBrowser() {
  if (process.platform === "win32") {
    spawnSync("powershell.exe", [
      "-Command",
      `Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match '${CDP_PORT}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ], { stdio: "ignore" });
  } else {
    spawnSync("pkill", ["-f", `--remote-debugging-port=${CDP_PORT}`], { stdio: "ignore" });
  }
}

async function stopAll(mode) {
  process.stdout.write(`${c.dim}Stopping server...${c.reset}`);
  killServer();
  for (let i = 0; i < 10; i++) {
    if (!(await isPortOpen(PORT))) { process.stdout.write(` ${c.green}✓${c.reset}\n`); break; }
    await new Promise(r => setTimeout(r, 500));
  }
  if (mode === "cdp") {
    process.stdout.write(`${c.dim}Stopping browser...${c.reset}`);
    killBrowser();
    process.stdout.write(` ${c.green}✓${c.reset}\n`);
  }
}

async function run() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const mode      = getMode();
  const serverUp  = await isPortOpen(PORT);
  const browserUp = mode === "cdp" ? await isPortOpen(CDP_PORT) : true;
  const active    = serverUp && browserUp;

  console.log(`\n${c.bold}templlm status${c.reset}  ${c.dim}(mode: ${mode})${c.reset}`);

  if (active) {
    console.log(`API: ${c.green}● ACTIVE${c.reset}`);
    if (mode === "cdp") {
      console.log(`  ${c.dim}server :${PORT} ✓   browser CDP :${CDP_PORT} ✓${c.reset}`);
    } else {
      console.log(`  ${c.dim}server :${PORT} ✓${c.reset}`);
    }
    console.log();

    const turnOff = await confirm(rl, "Turn it off?", false);
    rl.close();
    if (turnOff) await stopAll(mode);
    return;

  } else if (serverUp && !browserUp) {
    console.log(`API: ${c.yellow}◑ PARTIAL${c.reset}  ${c.dim}(server up, browser missing on :${CDP_PORT})${c.reset}\n`);

    const fix = await confirm(rl, "Start the browser?", true);
    rl.close();
    if (fix) {
      const ok = await ensureBrowser();
      if (ok) {
        console.log(`${c.green}✓ Browser started. API is now ACTIVE.${c.reset}`);
        _supervisor(mode);
      } else {
        console.log(`${c.red}✗ Could not start browser. Run \`templlm init\` to reconfigure.${c.reset}`);
      }
    }
    return;

  } else {
    console.log(`API: ${c.dim}○ DOWN${c.reset}\n`);

    const turnOn = await confirm(rl, "Start it?", true);
    rl.close();
    if (!turnOn) { console.log(`${c.dim}Stayed off.${c.reset}`); return; }

    if (mode === "cdp") {
      const browserOk = await ensureBrowser();
      if (!browserOk) {
        console.log(`${c.red}Chrome not found. Run \`templlm init\` to configure.${c.reset}`);
        return;
      }
    }
    const serverOk = await startServer();
    if (!serverOk) {
      if (mode === "cdp") killBrowser();
      return;
    }
    console.log(`\n${c.green}● API is ACTIVE${c.reset}`);
    _supervisor(mode);
  }
}

function _supervisor(mode) {
  console.log(`${c.dim}[Supervisor] Monitoring... Ctrl+C to stop.${c.reset}`);
  setInterval(async () => {
    const sUp = await isPortOpen(PORT);
    const bUp = mode === "cdp" ? await isPortOpen(CDP_PORT) : true;
    if (!sUp || !bUp) {
      console.log(`\n${c.red}${!bUp ? "Browser" : "Server"} went down — shutting everything off.${c.reset}`);
      await stopAll(mode);
      process.exit(1);
    }
  }, 3000);
}

module.exports = { killServer, killBrowser, stopAll, run };

// Auto-run when invoked directly (templlm status)
if (require.main === module) {
  run().catch(e => { console.error(e.message); process.exit(1); });
}
