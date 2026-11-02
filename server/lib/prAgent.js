const { diffLines } = require('diff');

// Real unified-style diff between the original file and the winning
// candidate's content — computed with the `diff` library, not hand-typed.
function buildDiff(originalContent, newContent, filePath) {
  const parts = diffLines(originalContent, newContent);
  let added = 0;
  let removed = 0;
  const lines = [];
  let oldNo = 1;
  let newNo = 1;

  parts.forEach((part) => {
    const type = part.added ? 'add' : part.removed ? 'rem' : 'ctx';
    const rows = part.value.split('\n');
    // diffLines leaves a trailing empty string from the final newline; drop it.
    if (rows[rows.length - 1] === '') rows.pop();
    rows.forEach((text) => {
      // oldNo/newNo are the line numbers in the original and the fixed file.
      lines.push({ type, text, oldNo: type === 'add' ? null : oldNo, newNo: type === 'rem' ? null : newNo });
      if (type !== 'add') oldNo++;
      if (type !== 'rem') newNo++;
      if (type === 'add') added++;
      if (type === 'rem') removed++;
    });
  });

  return { filePath, added, removed, lines };
}

// The reason shown to the reviewer is built from measured facts (test results
// and size of the change), never from the model's own opinion of its fix.
// `selection` comes from chooseWinner() in server.js.
function explanation(candidate, selection) {
  const parts = [];
  if (selection) {
    parts.push(selection.reason);
  } else {
    parts.push(`${candidate.id} (${candidate.title}) was recommended.`);
  }
  if (candidate.description) parts.push(`What it does: ${candidate.description}`);
  return parts.join(' ');
}

// The scope is the folder of the changed file (src/shipping/x.js -> shipping),
// or the file name when it sits directly in src/ (src/checkoutFlow.js).
function commitMessage(ticketId, candidate, targetFile = '') {
  const num = ticketId.replace(/[^0-9]/g, '');
  const parts = String(targetFile).split('/').filter(Boolean);
  const scope = parts.length > 2 ? parts[parts.length - 2] : (parts[parts.length - 1] || 'fix').replace(/\.js$/, '');
  return `fix(${scope}): ${candidate.title.toLowerCase()} (#${num})`;
}

module.exports = { buildDiff, explanation, commitMessage };
