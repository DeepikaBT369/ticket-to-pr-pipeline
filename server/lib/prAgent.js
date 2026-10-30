const { diffLines } = require('diff');

// Real unified-style diff between the original file and the winning
// candidate's content — computed with the `diff` library, not hand-typed.
function buildDiff(originalContent, newContent, filePath) {
  const parts = diffLines(originalContent, newContent);
  let added = 0;
  let removed = 0;
  const lines = [];

  parts.forEach((part) => {
    const type = part.added ? 'add' : part.removed ? 'rem' : 'ctx';
    const rows = part.value.split('\n');
    // diffLines leaves a trailing empty string from the final newline; drop it.
    if (rows[rows.length - 1] === '') rows.pop();
    rows.forEach((text) => {
      lines.push({ type, text });
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

function commitMessage(ticketId, candidate) {
  const num = ticketId.replace(/[^0-9]/g, '');
  return `fix(checkout): ${candidate.title.toLowerCase()} (#${num})`;
}

module.exports = { buildDiff, explanation, commitMessage };
