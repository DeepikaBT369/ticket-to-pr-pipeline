// Opens, comments on and merges real GitHub pull requests in the demo repo.
//
// Needs GITHUB_TOKEN (a fine-grained personal access token with Contents:
// read/write and Pull requests: read/write on the demo repo only). Set it in
// your hosting dashboard; never commit it. Without a token every function
// here is skipped and the app behaves as before (local-only demo).

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const REPO = process.env.GITHUB_REPO || 'DeepikaBT369/checkout-demo-app';
const BASE = process.env.GITHUB_BASE || 'main';
const BASELINE = process.env.GITHUB_BASELINE || 'baseline';

const enabled = () => Boolean(process.env.GITHUB_TOKEN);

async function gh(method, path, body) {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ticket-to-pr-pipeline',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${data.message || text.slice(0, 120)}`);
  return data;
}

function buildBody({ ticketId, ticket, candidate, explanation, gate, source }) {
  const gateLine = gate
    ? `- Syntax: ${gate.syntax?.ok ? 'pass' : 'FAIL'}\n- Tests: ${gate.tests?.passed}/${gate.tests?.total} passed\n- Static scan: ${gate.staticScan?.ok ? 'clean' : 'debug statements found'}`
    : '- Gate has not run yet';
  return [
    `## ${ticketId}: ${ticket.title}`,
    '',
    '### What this PR does',
    explanation,
    '',
    `### Chosen candidate`,
    `**${candidate.id}** — ${candidate.title} (${candidate.passed}/${candidate.total} tests passed). Candidates written by: ${source}.`,
    '',
    '### Gate results',
    gateLine,
    '',
    '---',
    'Opened automatically by ticket-to-pr-pipeline. A human must approve before this is merged.',
  ].join('\n');
}

async function openPullRequest({ ticketId, ticket, candidate, explanation, commitMessage, gate, source }) {
  const base = await gh('GET', `/git/ref/heads/${BASE}`);
  const branch = `fix/${ticketId.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
  await gh('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: base.object.sha });

  const filePath = ticket.targetFile;
  const existing = await gh('GET', `/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`);
  await gh('PUT', `/contents/${encodeURI(filePath)}`, {
    message: commitMessage,
    content: Buffer.from(candidate.content, 'utf8').toString('base64'),
    sha: existing.sha,
    branch,
  });

  const pr = await gh('POST', '/pulls', {
    title: `${ticketId}: ${ticket.title}`.slice(0, 200),
    head: branch,
    base: BASE,
    body: buildBody({ ticketId, ticket, candidate, explanation, gate, source }),
  });
  return { number: pr.number, url: pr.html_url, branch };
}

const commentOnPullRequest = (number, text) => gh('POST', `/issues/${number}/comments`, { body: text });

const mergePullRequest = (number) => gh('PUT', `/pulls/${number}/merge`, { merge_method: 'squash' });

// Puts the main branch back to the untouched "baseline" branch so the next
// tester's PR starts from the buggy code again. Merged PRs stay visible in
// the PR list as history.
async function resetMainToBaseline() {
  const baseline = await gh('GET', `/git/ref/heads/${BASELINE}`);
  await gh('PATCH', `/git/refs/heads/${BASE}`, { sha: baseline.object.sha, force: true });
}

module.exports = { enabled, openPullRequest, commentOnPullRequest, mergePullRequest, resetMainToBaseline, REPO };
