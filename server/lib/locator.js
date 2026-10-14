const fs = require('fs');
const path = require('path');

// Recursively lists every .js file under dir, returning paths relative to repoRoot
// (using forward slashes so output looks the same on every OS).
function listJsFilesRecursive(dir, repoRoot) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFilesRecursive(full, repoRoot));
    } else if (entry.name.endsWith('.js')) {
      out.push(path.relative(repoRoot, full).split(path.sep).join('/'));
    }
  }
  return out;
}

// Real grep over the target repo's source files — not a hardcoded list.
// Walks src/ recursively so nested files (e.g. src/pricing/discount.js) are
// actually searched, not just files directly under src/.
function locate(ticket, repoRoot) {
  const srcDir = path.join(repoRoot, 'src');
  const relativeFiles = listJsFilesRecursive(srcDir, repoRoot);

  return relativeFiles.map((relFile) => {
    const content = fs.readFileSync(path.join(repoRoot, relFile), 'utf8');
    const regexes = ticket.keywords.map((kw) => new RegExp(kw, 'i'));
    let hits = 0;
    const matches = []; // { line, text } for every source line containing a keyword

    content.split(/\r?\n/).forEach((text, idx) => {
      const lineHits = ticket.keywords.reduce((n, kw) => {
        const m = text.match(new RegExp(kw, 'gi'));
        return n + (m ? m.length : 0);
      }, 0);
      if (regexes.some((re) => re.test(text))) {
        matches.push({ line: idx + 1, text: text.trim() });
      }
      hits += lineHits;
    });

    return { file: relFile, hits, relevant: hits > 0, matches };
  });
}

module.exports = { locate };
