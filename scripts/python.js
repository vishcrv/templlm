#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");

/**
 * Cross-platform Python binary detection.
 * Checks python3, python, py (Windows launcher) in order.
 * Returns { bin, version } or null.
 */
function detectPython() {
  const candidates = process.platform === "win32"
    ? ["python3", "python", "py"]
    : ["python3", "python"];

  for (const bin of candidates) {
    try {
      const out = execSync(`${bin} --version 2>&1`, {
        stdio: "pipe",
        timeout: 5000,
      }).toString().trim();
      const m = out.match(/Python (\d+)\.(\d+)/);
      if (m && (parseInt(m[1]) > 3 || (parseInt(m[1]) === 3 && parseInt(m[2]) >= 8))) {
        return { bin, version: `${m[1]}.${m[2]}` };
      }
    } catch {}
  }
  return null;
}

module.exports = { detectPython };
