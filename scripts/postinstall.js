#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");
const { detectPython } = require("./python");

const ROOT = path.join(__dirname, "..");

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

console.log("\n── templlm: setting up Python dependencies ──\n");

const py = detectPython();
if (!py) {
  console.error("WARNING: Python 3.8+ not found. Install Python then run:");
  console.error("  pip install -r requirements.txt");
  console.error("  python -m playwright install chromium\n");
  process.exit(0);
}

console.log(`Using: ${py.bin} (${py.version})\n`);

try {
  console.log("1/2  Installing pip packages...");
  run(`${py.bin} -m pip install -r requirements.txt --quiet`);

  console.log("2/2  Installing Playwright browser (chromium)...");
  run(`${py.bin} -m playwright install chromium`);

  console.log("\n✓ Setup complete. Run `templlm --setup` to log in to ChatGPT.\n");
} catch (err) {
  console.error("\nWARNING: Automatic setup failed. Run these manually:");
  console.error(`  ${py.bin} -m pip install -r requirements.txt`);
  console.error(`  ${py.bin} -m playwright install chromium\n`);
}
