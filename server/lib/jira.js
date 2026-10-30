// Reads open issues from a Jira Cloud project and turns them into pipeline
// tickets. Read-only: nothing here writes to Jira.
//
// Needs three environment variables (set them in your hosting dashboard,
// never in code):
//   JIRA_BASE_URL   e.g. https://yourname.atlassian.net
//   JIRA_EMAIL      the Atlassian account email the token belongs to
//   JIRA_API_TOKEN  created at id.atlassian.com -> Security -> API tokens
// Optional:
//   JIRA_PROJECT    project key, default KAN
//   JIRA_JQL        full JQL, overrides the default query
// Without the three required variables, every function here is skipped.

const CACHE_MS = 60_000;
let cache = { at: 0, issues: [], error: null };

const enabled = () =>
  Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);

const baseUrl = () => process.env.JIRA_BASE_URL.replace(/\/+$/, '');

// Jira descriptions come back as Atlassian Document Format (a tree of nodes).
// Flatten it to plain text.
function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  const inner = (node.content || []).map(adfToText).join(node.type === 'doc' ? '\n' : '');
  return ['paragraph', 'heading', 'listItem', 'codeBlock'].includes(node.type) ? inner + '\n' : inner;
}

const STOPWORDS = new Set(
  ('the and for with that this from when then than into have has had are was were not but can could should would will ' +
    'does doesnt dont isnt its our you your they them their what which while where there here about after before ' +
    'because also only just some any all more most other such like need needs make makes made using used use get gets').split(' ')
);

// Pulls search keywords out of the ticket text: lowercase words of 4+ letters,
// minus common words, most frequent first. The Locator greps the code for them.
function keywordsFrom(text) {
  const counts = new Map();
  (text.toLowerCase().match(/[a-z][a-z0-9_]{3,}/g) || []).forEach((w) => {
    if (!STOPWORDS.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
}

function toTicket(issue) {
  const f = issue.fields || {};
  const description = adfToText(f.description).trim() || '(no description in Jira)';
  return {
    id: issue.key,
    title: String(f.summary || issue.key),
    description,
    keywords: keywordsFrom(`${f.summary || ''} ${description}`),
    source: 'jira',
    url: `${baseUrl()}/browse/${issue.key}`,
    jiraStatus: f.status?.name || null,
    // Not known from Jira. The Locator works these out (see server.js).
    targetFile: null,
    testFile: null,
  };
}

async function fetchIssues() {
  if (!enabled()) return [];
  const project = (process.env.JIRA_PROJECT || 'KAN').replace(/[^A-Za-z0-9_]/g, '');
  const jql = process.env.JIRA_JQL || `project = "${project}" AND statusCategory != Done ORDER BY created DESC`;
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

  const res = await fetch(`${baseUrl()}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql, maxResults: 50, fields: ['summary', 'description', 'status', 'issuetype'] }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Jira ${res.status}: ${text.slice(0, 160)}`);
  return (JSON.parse(text).issues || []).map(toTicket);
}

// Cached for a minute so the dashboard polling does not hammer Jira. On
// failure the last good list is kept and the error is reported by status().
async function getTickets() {
  if (!enabled()) return [];
  if (Date.now() - cache.at < CACHE_MS) return cache.issues;
  try {
    cache = { at: Date.now(), issues: await fetchIssues(), error: null };
  } catch (err) {
    console.error(`[jira] fetch failed: ${err.message}`);
    cache = { at: Date.now(), issues: cache.issues, error: err.message };
  }
  return cache.issues;
}

function status() {
  return { enabled: enabled(), ok: enabled() && !cache.error, count: cache.issues.length, error: cache.error };
}

module.exports = { enabled, getTickets, status, adfToText, keywordsFrom };
