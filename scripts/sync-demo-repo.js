// Copies the files in target-repo/ (src/ and tests/) to the demo repo on GitHub,
// onto BOTH the "baseline" and "main" branches, so real pull requests and the
// Reset demo button work with the larger practice repo.
//
// Usage (from the project folder; the token is read from your terminal session
// and is never written to a file):
//   export GITHUB_TOKEN=...      # fine-grained token, Contents: read/write on the demo repo only
//   node scripts/sync-demo-repo.js            # shows what it would do
//   node scripts/sync-demo-repo.js --yes      # does it
//
// Run it with the target-repo files at their original (buggy) state:
//   git checkout target-repo

const fs = require('fs');
const path = require('path');

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const REPO = process.env.GITHUB_REPO || 'DeepikaBT369/checkout-demo-app';
const BRANCHES = [process.env.GITHUB_BASELINE || 'baseline', process.env.GITHUB_BASE || 'main'];
const ROOT = path.join(__dirname, '..', 'target-repo');
const apply = process.argv.includes('--yes');

if (!process.env.GITHUB_TOKEN) {
  console.error('Set GITHUB_TOKEN in this terminal first (export GITHUB_TOKEN=...).');
  process.exit(1);
}

async function gh(method, urlPath, body, okStatuses = []) {
  const res = await fetch(`${API}/repos/${REPO}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ticket-to-pr-pipeline',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok && !okStatuses.includes(res.status)) {
    throw new Error(`${method} ${urlPath} -> ${res.status}: ${data.message || text.slice(0, 120)}`);
  }
  return { status: res.status, data };
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : listFiles(full);
    return [path.relative(ROOT, full).split(path.sep).join('/')];
  });
}

async function main() {
  const files = ['src', 'tests'].flatMap((d) => listFiles(path.join(ROOT, d)));
  console.log(`${files.length} files from target-repo -> ${REPO} (${BRANCHES.join(', ')})${apply ? '' : '   [dry run, add --yes to apply]'}`);

  for (const branch of BRANCHES) {
    let created = 0, updated = 0, same = 0;
    for (const file of files) {
      const local = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const cur = await gh('GET', `/contents/${encodeURI(file)}?ref=${encodeURIComponent(branch)}`, null, [404]);
      const remote = cur.status === 404 ? null : Buffer.from(cur.data.content, 'base64').toString('utf8');
      if (remote === local) { same++; continue; }
      remote === null ? created++ : updated++;
      if (apply) {
        await gh('PUT', `/contents/${encodeURI(file)}`, {
          message: `${remote === null ? 'Add' : 'Reset'} ${file} (practice repo sync)`,
          content: Buffer.from(local, 'utf8').toString('base64'),
          sha: remote === null ? undefined : cur.data.sha,
          branch,
        });
      }
    }
    console.log(`${branch}: ${created} to create, ${updated} to update, ${same} already identical`);
  }
  if (!apply) console.log('Nothing was changed. Run again with --yes to apply.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
