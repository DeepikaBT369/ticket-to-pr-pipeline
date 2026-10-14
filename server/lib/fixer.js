const fs = require('fs');
const { execSync } = require('child_process');

// Swaps the target file for a candidate's content, runs the REAL test suite
// against it with `node --test`, then restores the original file no matter
// what happens. This is a simplification of what a production agent would do
// (isolated git worktree or container per candidate) but it genuinely
// executes the candidate code and the real tests — nothing here is faked.
function tryCandidate(targetFile, candidateContent, testFile) {
  const original = fs.readFileSync(targetFile, 'utf8');
  fs.writeFileSync(targetFile, candidateContent);

  let output = '';
  try {
    output = execSync(`node --test --test-reporter=tap "${testFile}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err) {
    output = (err.stdout || '') + (err.stderr || '');
  } finally {
    fs.writeFileSync(targetFile, original);
  }

  const testLines = output.match(/^(ok|not ok) \d+ - .+$/gm) || [];
  const tests = testLines.map((line) => {
    const m = line.match(/^(ok|not ok) \d+ - (.+)$/);
    return { name: m[2], pass: m[1] === 'ok' };
  });
  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.length - passed;
  return { passed, total: tests.length, tests, output };
}

module.exports = { tryCandidate };
