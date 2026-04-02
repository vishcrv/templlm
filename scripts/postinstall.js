#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");
const { detectPython } = require("./python");

const ROOT = path.join(__dirname, "..");

const isTTY = process.stdout.isTTY;
const c = isTTY ? {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
} : { reset:"", bold:"", dim:"", green:"", yellow:"", cyan:"" };

console.log(`
${c.bold}${c.cyan}┌────────────────────────────────────────┐
│         templlm installed!              │
└────────────────────────────────────────┘${c.reset}
`);

const py = detectPython();
if (!py) {
  console.warn(`${c.yellow}Python 3.8+ not found.${c.reset} Install it, then run:`);
  console.warn(`  pip install -r requirements.txt`);
  console.warn(`  python -m playwright install chromium\n`);
  console.log(`Then run ${c.cyan}templlm init${c.reset} to get started.\n`);
  process.exit(0);
}

console.log(`${c.dim}Using Python ${py.version} (${py.bin})${c.reset}`);
console.log(`${c.dim}Installing dependencies — this only happens once...${c.reset}\n`);

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

try {
  console.log("1/2  Installing Python packages...");
  run(`${py.bin} -m pip install -r requirements.txt --quiet`);

  console.log("2/2  Installing Playwright browser...");
  run(`${py.bin} -m playwright install chromium`);

  console.log(`
${c.green}${c.bold}✓ Ready!${c.reset}

${c.bold}Get started:${c.reset}
  ${c.cyan}templlm init${c.reset}      ← run this first to set up your browser & login
  ${c.cyan}templlm --help${c.reset}    ← all commands
`);
} catch {
  console.error(`\n${c.yellow}Automatic setup failed. Run these manually:${c.reset}`);
  console.error(`  ${py.bin} -m pip install -r requirements.txt`);
  console.error(`  ${py.bin} -m playwright install chromium`);
  console.error(`\nThen run ${c.cyan}templlm init${c.reset} to get started.\n`);
}
