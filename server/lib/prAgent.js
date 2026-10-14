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

function explanation(candidate) {
  return (
    `The fixer ran all candidates against the real test suite and selected ${candidate.id} ` +
    `— "${candidate.title}" — because it passed the most tests (${candidate.passed}/${candidate.total}). ` +
    `${candidate.description}`
  );
}

function commitMessage(ticketId, candidate) {
  const num = ticketId.replace(/[^0-9]/g, '');
  return `fix(checkout): ${candidate.title.toLowerCase()} (#${num})`;
}

module.exports = { buildDiff, explanation, commitMessage };
