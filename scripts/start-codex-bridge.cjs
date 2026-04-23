const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--env' && i + 1 < argv.length) {
      args.envPath = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripQuotes(rawValue);

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(process.cwd(), args.envPath || 'playtest/codex-bridge.env');
  loadEnvFile(envPath);

  const targetScript = path.resolve(process.cwd(), 'dist-harness/harness/webhookBridge.js');
  if (!fs.existsSync(targetScript)) {
    console.error('[codex-bridge] dist-harness/harness/webhookBridge.js not found. Run `npm run build:harness` first.');
    process.exit(1);
  }

  console.log(`[codex-bridge] using env file: ${envPath}`);
  console.log(
    `[codex-bridge] mode=${process.env.THEYSING_BRIDGE_MODE || 'policy'} ` +
    `baseUrl=${process.env.THEYSING_BRIDGE_OPENAI_BASE_URL || process.env.LOCAL_OPENAI_BASE_URL || 'unset'} ` +
    `model=${process.env.THEYSING_BRIDGE_OPENAI_MODEL || 'unset'}`
  );

  const child = spawn(process.execPath, [targetScript], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });
}

main();
