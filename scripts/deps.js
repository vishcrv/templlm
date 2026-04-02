"use strict";

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/**
 * Ensure fastapi, uvicorn, playwright are installed.
 * Exits the process on failure.
 * @param {string} python - python binary name
 * @param {object} c      - colour map (may be empty {})
 */
function ensureDeps(python, c = {}) {
  const y = c.yellow || "";
  const r = c.red   || "";
  const x = c.reset || "";

  try {
    execSync(`${python} -c "import fastapi, uvicorn, playwright"`,
      { stdio: "pipe", cwd: ROOT, timeout: 10000 });
    return; // already installed
  } catch {}

  console.log(`${y}First run — installing dependencies...${x}`);
  try {
    try {
      execSync(`${python} -m pip --version`, { stdio: "ignore" });
    } catch {
      console.log(`${y}Installing pip...${x}`);
      execSync(`${python} -m ensurepip --upgrade`, { stdio: "inherit" });
    }
    execSync(
      `${python} -m pip install -r requirements.txt --quiet`,
      { stdio: "inherit", cwd: ROOT, timeout: 300000 }
    );
    console.log(`${y}Installing browser (chromium)...${x}`);
    execSync(
      `${python} -m playwright install chromium`,
      { stdio: "inherit", cwd: ROOT, timeout: 300000 }
    );
  } catch {
    console.error(`${r}Dependency install failed.${x} Run manually:`);
    console.error(`  ${python} -m pip install -r requirements.txt`);
    console.error(`  ${python} -m playwright install chromium`);
    process.exit(1);
  }
}

module.exports = { ensureDeps };
