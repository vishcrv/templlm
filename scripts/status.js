#!/usr/bin/env node
"use strict";

const http = require("http");
const net = require("net");
const path = require("path");
const readline = require("readline");
const { spawnSync, spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const { detectPython } = require("./python");

const HOST = "127.0.0.1";
const PORT = 8000;
const ROOT = path.join(__dirname, "..");
const LOG_FILE = path.join(os.tmpdir(), "templlm-server.log");

const PYTHON = (detectPython() || {}).bin || "python";

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

function isPortOpen() {
  return new Promise(resolve => {
    const s = net.createConnection(PORT, HOST);
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
  console.log(`${c.dim}Starting server...${c.reset}`);
  
  const logFd = fs.openSync(LOG_FILE, "w");
  const child = spawn(PYTHON, [runPy], {
    detached:     true,
    stdio:        ["ignore", logFd, logFd],
    cwd:          ROOT,
    windowsHide:  true,
  });
  child.unref();
  fs.closeSync(logFd);

  for (let i = 0; i < 30; i++) {
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 1000));
    if (await isPortOpen()) {
      console.log(`\n${c.green}● Server started successfully at http://${HOST}:${PORT}${c.reset}`);
      return;
    }
  }
  console.log(`\n${c.red}Failed to start server. Check logs: ${LOG_FILE}${c.reset}`);
}

async function killServer() {
  if (process.platform === "win32") {
    console.log(`${c.dim}Stopping Python background processes...${c.reset}`);
    spawnSync("powershell.exe", ["-Command", "Stop-Process -Name 'python' -PassThru | Where-Object {$_.CommandLine -match 'run.py'}"], { stdio: "ignore" });
  } else {
    spawnSync("pkill", ["-f", "run.py"]);
  }
  
  // Wait a moment for port to free
  for (let i = 0; i < 10; i++) {
    if (!(await isPortOpen())) {
      console.log(`${c.green}✓ Server turned off.${c.reset}`);
      return;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`${c.red}✗ Could not fully confirm server shutdown.${c.reset}`);
}

async function run() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  console.log(`\n${c.bold}templlm Server Status${c.reset}`);
  const up = await isPortOpen();
  
  if (up) {
    console.log(`Status: ${c.green}● UP (Running on port ${PORT})${c.reset}\n`);
    const turnOff = await confirm(rl, "Do you want to turn it off?", true);
    if (turnOff) {
      await killServer();
    } else {
      console.log("Leaving server running.");
    }
  } else {
    console.log(`Status: ${c.dim}○ DOWN (Not running)${c.reset}\n`);
    const turnOn = await confirm(rl, "Do you want to start it?", true);
    if (turnOn) {
      await startServer();
    } else {
      console.log("Server remains off.");
    }
  }
  
  rl.close();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
