const fs = require('fs');
const { execSync } = require('child_process');

// Re-verifies the winning candidate for real: syntax check, the actual test
// suite, and a simple static scan. Swaps the file in, runs the checks,
// restores the original — permanent write only happens on Approval.
function runGate(targetFile, testFile, candidateContent) {
  const original = fs.readFileSync(targetFile, 'utf8');
  fs.writeFileSync(targetFile, candidateContent);

  const results = { syntax: null, tests: null, staticScan: null };

  try {
    let t0 = Date.now();
    try {
      execSync(`node --check "${targetFile}"`, { stdio: 'pipe' });
      results.syntax = { ok: true, detail: 'No syntax errors', durationMs: Date.now() - t0 };
    } catch (err) {
      results.syntax = { ok: false, detail: String(err.stderr || err), durationMs: Date.now() - t0 };
    }

    t0 = Date.now();
    let testOutput = '';
    try {
      testOutput = execSync(`node --test --test-reporter=tap "${testFile}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err) {
      testOutput = (err.stdout || '') + (err.stderr || '');
    }
    const passed = (testOutput.match(/^ok \d+/gm) || []).length;
    const failed = (testOutput.match(/^not ok \d+/gm) || []).length;
    results.tests = { passed, failed, total: passed + failed, ok: failed === 0, durationMs: Date.now() - t0 };

    t0 = Date.now();
    const debugHits = (candidateContent.match(/console\.log/g) || []).length;
    results.staticScan = { ok: debugHits === 0, debugStatements: debugHits, durationMs: Date.now() - t0 };
  } finally {
    fs.writeFileSync(targetFile, original);
  }

  return results;
}

module.exports = { runGate };
