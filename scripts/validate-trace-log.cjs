const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_TRACE = path.join(ROOT, 'dist-harness', 'harness', 'trace.js');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = path.resolve(args.run || args._[0] || '');
  if (!target || !fs.existsSync(target)) {
    throw new Error('Usage: node scripts/validate-trace-log.cjs --run <jsonl-or-directory>');
  }

  const { validateTraceEvent } = require(DIST_TRACE);
  const files = collectJsonlFiles(target);
  let checkedEntries = 0;
  const issues = [];

  for (const file of files) {
    const entries = readJsonl(file);
    entries.forEach((entry, index) => {
      if (!entry.trace) {
        issues.push({
          file,
          index,
          severity: 'error',
          message: 'log entry missing trace'
        });
        return;
      }
      checkedEntries += 1;
      for (const issue of validateTraceEvent(entry.trace, index)) {
        issues.push({ file, ...issue });
      }
    });
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const summary = {
    schema: 'theysing.traceValidationSummary.v1',
    files: files.length,
    checkedEntries,
    errors: errors.length,
    warnings: issues.length - errors.length,
    issues: issues.map((issue) => ({
      ...issue,
      file: path.relative(ROOT, issue.file)
    }))
  };

  console.log(JSON.stringify(summary, null, 2));
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

function collectJsonlFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith('.jsonl') ? [target] : [];
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonlFiles(child));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(child);
    }
  }
  return files.sort();
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line.replace(/^\uFEFF/, ''));
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path.relative(ROOT, file)}:${index + 1}: ${error.message}`);
      }
    });
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args._.push(arg);
    }
  }
  return args;
}

main();

